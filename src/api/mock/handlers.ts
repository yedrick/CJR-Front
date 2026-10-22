// Lógica de negocio de cada ruta del servidor simulado.
// Reglas que un backend real debe replicar: validaciones (422), conflictos (409),
// recursos inexistentes (404), propiedad del recurso (403), límites de intentos (429).
import { ApiError } from '../errors';
import type { RouteId } from '../routes';
import type { Handler, HandlerContext } from './server';
import { userPermissions } from './server';
import type {
  AppNotification,
  Camp,
  CampCourse,
  CamperRegistration,
  Catalogs,
  CatalogKind,
  Championship,
  ChampionshipEntry,
  CheckInLog,
  TeamInvite,
  PaymentSettings,
  PaymentTransaction,
  StoredUser,
  TribeGroup,
  User,
} from '../../types/camp';
import { ALL_PERMISSIONS, hasPermission, Permission, RoleId } from '../../auth/permissions';
import { env } from '../../config/env';
import { hashPassword, randomToken, verifyPassword } from './crypto';
import { signJwt } from './jwt';
import { buildTicketCode, coursesOverlap, isCampEnrollable, nowStamp, uid, nowLocalStamp } from '../../utils/campUtils';
import { buildCamperQrPayload } from '../../utils/qrGenerator';

// =========================================================
// UTILIDADES
// =========================================================
const REFRESH_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const MAX_LOGIN_FAILS = 5;
const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const LOCK_MS = 5 * 60 * 1000;
const MAX_VOUCHER_BYTES = 1.5 * 1024 * 1024;

const EMAIL_RE = /^[^\s@]{1,64}@[^\s@]{1,190}\.[a-z]{2,}$/i;
const PHONE_RE = /^(\+591\s?)?[67]\d{7}$/;

const clean = (v: unknown, max = 200) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const lower = (v: unknown) => clean(v).toLowerCase();
const digits = (v: string) => v.replace(/\D/g, '');

function validationError(errors: Record<string, string>): never {
  throw new ApiError(422, 'Revisa los datos ingresados.', { errors });
}

function check(errors: Record<string, string>) {
  if (Object.keys(errors).length) validationError(errors);
}

export function passwordProblems(password: string, email = ''): string | null {
  if (password.length < 8) return 'Debe tener al menos 8 caracteres.';
  if (password.length > 72) return 'No puede superar los 72 caracteres.';
  if (!/[a-z]/.test(password) || !/[A-Z]/.test(password)) return 'Debe combinar mayúsculas y minúsculas.';
  if (!/\d/.test(password)) return 'Debe incluir al menos un número.';
  const emailUser = email.split('@')[0].toLowerCase();
  if (emailUser.length >= 4 && password.toLowerCase().includes(emailUser)) return 'No debe contener tu correo.';
  if (['12345678', 'password', 'contraseña', 'qwerty123'].includes(password.toLowerCase())) return 'Es demasiado común.';
  return null;
}

export function publicUser(db: HandlerContext['db'], u: StoredUser): User {
  const { passwordHash: _h, passwordSalt: _s, ...rest } = u;
  return { ...rest, permissions: userPermissions(db, u) };
}

function issueSession(ctx: HandlerContext, user: StoredUser, existingSessionId?: string) {
  const { db } = ctx;
  const refreshToken = randomToken(32);
  let session = existingSessionId ? db.sessions.find((s) => s.id === existingSessionId) : undefined;
  if (session) {
    session.refreshToken = refreshToken; // rotación del refresh token
    session.expiresAt = Date.now() + REFRESH_TTL_MS;
  } else {
    session = {
      id: uid('ses'),
      userId: user.id,
      refreshToken,
      expiresAt: Date.now() + REFRESH_TTL_MS,
      createdAt: Date.now(),
      userAgent: ctx.userAgent.slice(0, 160),
    };
    db.sessions.push(session);
  }
  // limpieza de sesiones vencidas
  db.sessions = db.sessions.filter((s) => s.expiresAt > Date.now());
  const ttl = env.mock.accessTokenTtlMin * 60;
  return {
    user: publicUser(db, user),
    tokens: {
      accessToken: signJwt({ sub: user.id, role: user.role, email: user.email, sid: session.id }, ttl),
      refreshToken,
      expiresIn: ttl,
      tokenType: 'Bearer' as const,
    },
  };
}

/** Límite simple de solicitudes por clave (ventana deslizante). */
function rateLimit(ctx: HandlerContext, key: string, max: number, windowMs: number) {
  const now = Date.now();
  const hits = (ctx.db.rateLimits[key] || []).filter((t) => now - t < windowMs);
  if (hits.length >= max) {
    const retryAfter = Math.ceil((windowMs - (now - hits[0])) / 1000);
    throw new ApiError(429, `Demasiadas solicitudes. Intenta de nuevo en ${Math.ceil(retryAfter / 60)} min.`, { retryAfter });
  }
  hits.push(now);
  ctx.db.rateLimits[key] = hits;
}

function notify(ctx: HandlerContext, userIds: string[], n: Omit<AppNotification, 'id' | 'userId' | 'read' | 'createdAt'>) {
  const createdAt = nowStamp(true);
  Array.from(new Set(userIds)).forEach((userId) =>
    ctx.db.notifications.unshift({ ...n, id: uid('ntf'), userId, read: false, createdAt })
  );
  ctx.db.notifications = ctx.db.notifications.slice(0, 2000);
}

const usersWith = (ctx: HandlerContext, perm: Permission) =>
  ctx.db.users.filter((u) => u.status === 'active' && hasPermission(userPermissions(ctx.db, u), perm)).map((u) => u.id);

function requireOwnerOrPermission(ctx: HandlerContext, ownerId: string) {
  if (ctx.grantedByPermission) return;
  if (!ctx.user || ctx.user.id !== ownerId) throw new ApiError(403, 'Solo puedes acceder a tus propias inscripciones.');
}

const findOr404 = <T extends { id: string }>(list: T[], id: string, label: string): T => {
  const item = list.find((x) => x.id === id);
  if (!item) throw new ApiError(404, `${label} no existe.`);
  return item;
};

function checkImage(dataUrl: unknown, field: string) {
  if (!dataUrl) return;
  if (typeof dataUrl !== 'string' || !/^(data:image\/(png|jpe?g|webp|gif|svg\+xml)[;,]|https?:\/\/)/i.test(dataUrl)) {
    validationError({ [field]: 'Debe ser una imagen PNG, JPG, WEBP o una URL https.' });
  }
  if (dataUrl.startsWith('data:') && dataUrl.length * 0.75 > MAX_VOUCHER_BYTES) {
    throw new ApiError(413, 'La imagen supera el máximo de 1,5 MB. Comprímela o toma una foto más liviana.');
  }
}

// =========================================================
// AUTENTICACIÓN
// =========================================================
const login: Handler = (ctx) => {
  const identifier = lower(ctx.body.email || ctx.body.identifier);
  const password = typeof ctx.body.password === 'string' ? ctx.body.password : '';
  check({
    ...(!identifier ? { email: 'Ingresa tu correo o celular.' } : {}),
    ...(!password ? { password: 'Ingresa tu contraseña.' } : {}),
  });

  const attempts = ctx.db.loginAttempts[identifier];
  if (attempts?.lockedUntil && attempts.lockedUntil > Date.now()) {
    const retryAfter = Math.ceil((attempts.lockedUntil - Date.now()) / 1000);
    throw new ApiError(429, `Cuenta bloqueada temporalmente por intentos fallidos. Intenta en ${Math.ceil(retryAfter / 60)} min.`, {
      retryAfter,
    });
  }

  const user = ctx.db.users.find((u) => u.email === identifier || digits(u.phone) === digits(identifier) && digits(identifier).length >= 8);
  const valid = !!user && verifyPassword(password, user.passwordSalt, user.passwordHash);
  if (!valid) {
    const now = Date.now();
    const prev = attempts && now - attempts.firstAt < LOGIN_WINDOW_MS ? attempts : { count: 0, firstAt: now };
    const count = prev.count + 1;
    ctx.db.loginAttempts[identifier] = {
      count,
      firstAt: prev.firstAt,
      lockedUntil: count >= MAX_LOGIN_FAILS ? now + LOCK_MS : undefined,
    };
    const left = MAX_LOGIN_FAILS - count;
    // Mensaje genérico: no revela si el correo existe
    throw new ApiError(
      401,
      left > 0
        ? `Correo o contraseña incorrectos. Te quedan ${left} ${left === 1 ? 'intento' : 'intentos'}.`
        : 'Demasiados intentos fallidos. Tu acceso se bloqueó por 5 minutos.',
      { code: 'UNAUTHORIZED' }
    );
  }
  if (user.status === 'disabled') throw new ApiError(403, 'Tu cuenta está desactivada. Comunícate con la directiva.');
  delete ctx.db.loginAttempts[identifier];
  user.lastLoginAt = nowStamp();
  return issueSession(ctx, user);
};

/** Valida los datos de una cuenta nueva de campista y la construye (sin guardarla). */
function buildNewUser(ctx: HandlerContext, b: any): StoredUser {
  const email = lower(b.email);
  const phoneDigits = digits(clean(b.phone));
  const phone = phoneDigits.startsWith('591') ? phoneDigits.slice(3) : phoneDigits;
  const password = typeof b.password === 'string' ? b.password : '';
  const errors: Record<string, string> = {};
  if (clean(b.firstName).length < 2) errors.firstName = 'Ingresa tus nombres.';
  if (clean(b.paternalLastName).length < 2) errors.paternalLastName = 'Ingresa tu apellido paterno.';
  if (!EMAIL_RE.test(email)) errors.email = 'Correo electrónico no válido.';
  if (!PHONE_RE.test(phone)) errors.phone = 'Número de WhatsApp boliviano no válido (8 dígitos, empieza con 6 o 7).';
  const pwdProblem = passwordProblems(password, email);
  if (pwdProblem) errors.password = pwdProblem;
  if (!b.birthDate || Number.isNaN(Date.parse(b.birthDate))) errors.birthDate = 'Ingresa tu fecha de nacimiento.';
  else {
    const age = Math.floor((Date.now() - Date.parse(b.birthDate)) / (365.25 * 86400000));
    if (age < 10 || age > 60) errors.birthDate = 'La edad debe estar entre 10 y 60 años.';
  }
  if (!clean(b.regional)) errors.regional = 'Selecciona tu regional.';
  else if (!ctx.db.catalogs.regionales.some((r) => r.name === clean(b.regional))) errors.regional = 'La regional no existe.';
  if (b.acceptTerms !== true) errors.acceptTerms = 'Debes aceptar los términos y el uso de tus datos.';
  check(errors);

  if (ctx.db.users.some((u) => u.email === email)) {
    throw new ApiError(409, 'Ya existe una cuenta con este correo. Inicia sesión para continuar.', {
      errors: { email: 'Correo ya registrado: inicia sesión.' },
    });
  }
  if (ctx.db.users.some((u) => digits(u.phone).endsWith(phone))) {
    throw new ApiError(409, 'Ya existe una cuenta con este número de WhatsApp.', { errors: { phone: 'Número ya registrado.' } });
  }

  const { hash, salt } = hashPassword(password);
  const birthDate = clean(b.birthDate, 10);
  return {
    id: uid('usr'),
    firstName: clean(b.firstName, 60),
    paternalLastName: clean(b.paternalLastName, 60),
    maternalLastName: clean(b.maternalLastName, 60),
    birthDate,
    age: Math.floor((Date.now() - Date.parse(birthDate)) / (365.25 * 86400000)),
    phone: `+591 ${phone}`,
    email,
    regional: clean(b.regional),
    city: clean(b.city, 60) || undefined,
    churchCongregation: clean(b.churchCongregation, 120) || undefined,
    gender: b.gender === 'M' || b.gender === 'F' ? b.gender : undefined,
    role: 'campista', // el rol NUNCA lo decide el cliente
    status: 'active',
    passwordHash: hash,
    passwordSalt: salt,
    createdAt: nowStamp(),
    lastLoginAt: nowStamp(),
  };
}

const register: Handler = (ctx) => {
  rateLimit(ctx, 'register', 10, 10 * 60 * 1000);
  const user = buildNewUser(ctx, ctx.body);
  ctx.db.users.push(user);
  return { status: 201, data: issueSession(ctx, user) };
};

const refresh: Handler = (ctx) => {
  const token = clean(ctx.body.refreshToken, 128);
  const session = ctx.db.sessions.find((s) => s.refreshToken === token && s.expiresAt > Date.now());
  if (!token || !session) throw new ApiError(401, 'La sesión expiró. Vuelve a iniciar sesión.');
  const user = ctx.db.users.find((u) => u.id === session.userId);
  if (!user || user.status === 'disabled') {
    ctx.db.sessions = ctx.db.sessions.filter((s) => s.id !== session.id);
    throw new ApiError(401, 'La sesión ya no es válida.');
  }
  return { status: 200, data: issueSession(ctx, user, session.id) };
};

const logout: Handler = (ctx) => {
  ctx.db.sessions = ctx.db.sessions.filter((s) => s.id !== ctx.sessionId);
  return { status: 200, data: { message: 'Sesión cerrada.' } };
};

const me: Handler = (ctx) => publicUser(ctx.db, ctx.user!);

const updateMe: Handler = (ctx) => {
  const u = ctx.user!;
  const b = ctx.body;
  const errors: Record<string, string> = {};
  if (b.firstName !== undefined && clean(b.firstName).length < 2) errors.firstName = 'Nombre no válido.';
  if (b.phone !== undefined) {
    const p = digits(clean(b.phone)).replace(/^591/, '');
    if (!PHONE_RE.test(p)) errors.phone = 'Número no válido.';
    else if (ctx.db.users.some((x) => x.id !== u.id && digits(x.phone).endsWith(p))) {
      throw new ApiError(409, 'Ese número ya pertenece a otra cuenta.', { errors: { phone: 'Número ya registrado.' } });
    }
  }
  if (b.regional !== undefined && !ctx.db.catalogs.regionales.some((r) => r.name === clean(b.regional))) errors.regional = 'Regional no válida.';
  check(errors);
  (['firstName', 'paternalLastName', 'maternalLastName', 'churchCongregation', 'regional', 'city', 'subdirectivaNumber'] as const).forEach((k) => {
    if (b[k] !== undefined) (u as any)[k] = clean(b[k], 80);
  });
  if (b.phone !== undefined) u.phone = `+591 ${digits(clean(b.phone)).replace(/^591/, '')}`;
  return { status: 200, data: publicUser(ctx.db, u) };
};

const changePassword: Handler = (ctx) => {
  const u = ctx.user!;
  const { currentPassword, newPassword } = ctx.body;
  if (typeof currentPassword !== 'string' || !verifyPassword(currentPassword, u.passwordSalt, u.passwordHash)) {
    validationError({ currentPassword: 'La contraseña actual es incorrecta.' });
  }
  const problem = passwordProblems(String(newPassword || ''), u.email);
  if (problem) validationError({ newPassword: problem });
  if (newPassword === currentPassword) validationError({ newPassword: 'Debe ser distinta de la actual.' });
  const { hash, salt } = hashPassword(newPassword);
  u.passwordHash = hash;
  u.passwordSalt = salt;
  // cierra las demás sesiones abiertas
  ctx.db.sessions = ctx.db.sessions.filter((s) => s.userId !== u.id || s.id === ctx.sessionId);
  return { status: 200, data: { message: 'Contraseña actualizada. Se cerraron tus otras sesiones.' } };
};

const forgotPassword: Handler = (ctx) => {
  const email = lower(ctx.body.email);
  if (!EMAIL_RE.test(email)) validationError({ email: 'Ingresa un correo válido.' });
  rateLimit(ctx, `forgot:${email}`, 3, 10 * 60 * 1000);
  const user = ctx.db.users.find((u) => u.email === email && u.status === 'active');
  let devCode: string | undefined;
  if (user) {
    const code = String(Math.floor(100000 + Math.random() * 900000));
    ctx.db.resetCodes = ctx.db.resetCodes.filter((c) => c.email !== email);
    ctx.db.resetCodes.push({ email, code, expiresAt: Date.now() + 15 * 60 * 1000, attempts: 0 });
    if (env.appEnv === 'testing') devCode = code;
  }
  // Respuesta idéntica exista o no la cuenta (evita enumerar usuarios)
  return {
    status: 200,
    data: {
      message: 'Si el correo está registrado, recibirás un código de 6 dígitos válido por 15 minutos.',
      ...(devCode ? { devCode } : {}),
    },
  };
};

const resetPassword: Handler = (ctx) => {
  const email = lower(ctx.body.email);
  const code = clean(ctx.body.code, 6);
  const entry = ctx.db.resetCodes.find((c) => c.email === email);
  if (!entry || entry.expiresAt < Date.now()) throw new ApiError(400, 'El código expiró o no es válido. Solicita uno nuevo.');
  if (entry.attempts >= 5) {
    ctx.db.resetCodes = ctx.db.resetCodes.filter((c) => c !== entry);
    throw new ApiError(429, 'Demasiados intentos con este código. Solicita uno nuevo.');
  }
  if (entry.code !== code) {
    entry.attempts++;
    validationError({ code: 'Código incorrecto.' });
  }
  const problem = passwordProblems(String(ctx.body.newPassword || ''), email);
  if (problem) validationError({ newPassword: problem });
  const user = ctx.db.users.find((u) => u.email === email);
  if (!user) throw new ApiError(400, 'El código no es válido.');
  const { hash, salt } = hashPassword(ctx.body.newPassword);
  user.passwordHash = hash;
  user.passwordSalt = salt;
  ctx.db.resetCodes = ctx.db.resetCodes.filter((c) => c !== entry);
  ctx.db.sessions = ctx.db.sessions.filter((s) => s.userId !== user.id);
  delete ctx.db.loginAttempts[email];
  return { status: 200, data: { message: 'Contraseña restablecida. Ya puedes iniciar sesión.' } };
};

// =========================================================
// PÚBLICO
// =========================================================
const health: Handler = (ctx) => ({
  status: 'ok',
  mode: 'mock',
  env: env.appEnv,
  time: new Date().toISOString(),
  stats: {
    users: ctx.db.users.length,
    camps: ctx.db.camps.length,
    registrations: ctx.db.registrations.length,
    activeSessions: ctx.db.sessions.length,
  },
});

const canSeeDrafts = (ctx: HandlerContext) => hasPermission(ctx.permissions, 'camps:read');

const listCamps: Handler = (ctx) =>
  ctx.db.camps
    .filter((c) => c.status !== 'borrador' || canSeeDrafts(ctx))
    .sort((a, b) => a.startDate.localeCompare(b.startDate));

const getCamp: Handler = (ctx) => {
  const camp = ctx.db.camps.find((c) => c.id === ctx.params.id);
  if (!camp || (camp.status === 'borrador' && !canSeeDrafts(ctx))) throw new ApiError(404, 'El campamento no existe.');
  return camp;
};

const listCourses: Handler = (ctx) => {
  const campId = ctx.query.get('campId');
  return campId ? ctx.db.courses.filter((c) => c.campId === campId) : ctx.db.courses;
};
const listChampionships: Handler = (ctx) => {
  const campId = ctx.query.get('campId');
  const list = campId ? ctx.db.championships.filter((c) => c.campId === campId) : ctx.db.championships;
  // el contador de inscritos siempre refleja las inscripciones activas
  return list.map((c) => ({
    ...c,
    enrolledTeamsCount: ctx.db.championshipEntries.filter((e) => e.championshipId === c.id && e.status !== 'cancelled').length,
  }));
};
const listTribes: Handler = (ctx) => [...ctx.db.tribes].sort((a, b) => a.number - b.number);
const getCatalogs: Handler = (ctx) => ctx.db.catalogs;
const listEditions: Handler = (ctx) => ctx.db.editions;
const getPaymentSettings: Handler = (ctx) => {
  const s = ctx.db.paymentSettings;
  // A quien no administra pagos solo se le envían las cuentas activas
  if (hasPermission(ctx.permissions, 'payment_settings:update')) return s;
  return { ...s, transfer: { ...s.transfer, accounts: s.transfer.accounts.filter((a) => a.isActive) } };
};

function couponPrice(ctx: HandlerContext, code: string, camp: Camp, regional: string, groupSize: number): number {
  const coupon = ctx.db.coupons.find((c) => c.code.toUpperCase() === code.trim().toUpperCase() && c.isActive);
  if (!coupon) throw new ApiError(404, 'El cupón no existe o no está activo.');
  if (coupon.allowedRegionals.length && !coupon.allowedRegionals.includes(regional)) {
    throw new ApiError(422, `Este cupón es solo para: ${coupon.allowedRegionals.join(', ')}.`, { errors: { code: 'Regional no habilitada.' } });
  }
  if (groupSize !== coupon.requiredGroupSize) {
    throw new ApiError(422, `El cupón exige una delegación de ${coupon.requiredGroupSize} personas.`, { errors: { code: 'Tamaño de grupo.' } });
  }
  const price = camp.groupPrice ?? coupon.discountedPricePerPerson;
  if (price >= camp.price) throw new ApiError(422, 'Este campamento no tiene tarifa de delegación.');
  return price;
}

const validateCoupon: Handler = (ctx) => {
  const camp = findOr404(ctx.db.camps, clean(ctx.body.campId), 'El campamento');
  const price = couponPrice(ctx, clean(ctx.body.code, 40), camp, clean(ctx.body.regional), Number(ctx.body.groupSize) || 35);
  return { status: 200, data: { valid: true, discountedPricePerPerson: price } };
};

// =========================================================
// CAMPAMENTOS
// =========================================================
function validateCamp(ctx: HandlerContext, b: any): Camp {
  const errors: Record<string, string> = {};
  if (clean(b.name).length < 3) errors.name = 'El nombre es obligatorio.';
  if (!b.startDate || !b.endDate) errors.startDate = 'Las fechas son obligatorias.';
  else if (b.endDate < b.startDate) errors.endDate = 'La fecha de fin no puede ser anterior al inicio.';
  if (!(Number(b.price) >= 0)) errors.price = 'Precio no válido.';
  if (b.groupPrice !== undefined && b.groupPrice !== null && Number(b.groupPrice) >= Number(b.price)) {
    errors.groupPrice = 'Debe ser menor que el precio individual.';
  }
  if (!clean(b.location)) errors.location = 'El lugar es obligatorio.';
  if (Number(b.minAge) > Number(b.maxAge)) errors.minAge = 'La edad mínima supera la máxima.';
  if (!['borrador', 'abierto', 'cerrado'].includes(b.status)) errors.status = 'Estado no válido.';
  if (b.typeId && !ctx.db.catalogs.campTypes.some((t) => t.id === b.typeId)) errors.typeId = 'Tipo no válido.';
  checkImage(b.imageUrl, 'imageUrl');
  check(errors);
  return {
    ...b,
    name: clean(b.name, 120),
    price: Number(b.price),
    groupPrice: b.groupPrice === undefined || b.groupPrice === null || b.groupPrice === '' ? undefined : Number(b.groupPrice),
    capacity: Number(b.capacity) || 0,
    includes: Array.isArray(b.includes) ? b.includes.map((x: unknown) => clean(x, 60)).filter(Boolean) : [],
  };
}

const unfeatureOthers = (ctx: HandlerContext, id: string) =>
  ctx.db.camps.forEach((c) => {
    if (c.id !== id) c.isFeatured = false;
  });

const createCamp: Handler = (ctx) => {
  const camp = validateCamp(ctx, { ...ctx.body, id: uid('camp'), createdAt: nowStamp() });
  ctx.db.camps.push(camp);
  if (camp.isFeatured) unfeatureOthers(ctx, camp.id);
  return camp;
};

const updateCamp: Handler = (ctx) => {
  const idx = ctx.db.camps.findIndex((c) => c.id === ctx.params.id);
  if (idx < 0) throw new ApiError(404, 'El campamento no existe.');
  const camp = validateCamp(ctx, { ...ctx.db.camps[idx], ...ctx.body, id: ctx.params.id });
  ctx.db.camps[idx] = camp;
  if (camp.isFeatured) unfeatureOthers(ctx, camp.id);
  return camp;
};

const deleteCamp: Handler = (ctx) => {
  const camp = findOr404(ctx.db.camps, ctx.params.id, 'El campamento');
  const regs = ctx.db.registrations.filter((r) => r.campId === camp.id).length;
  if (regs > 0) {
    throw new ApiError(409, `No se puede eliminar: el campamento tiene ${regs} inscripciones. Ciérralo en lugar de borrarlo.`);
  }
  ctx.db.camps = ctx.db.camps.filter((c) => c.id !== camp.id);
  ctx.db.courses = ctx.db.courses.filter((c) => c.campId !== camp.id);
  ctx.db.championships = ctx.db.championships.filter((ch) => ch.campId !== camp.id);
  return { status: 200, data: { deleted: camp.id } };
};

const featureCamp: Handler = (ctx) => {
  const camp = findOr404(ctx.db.camps, ctx.params.id, 'El campamento');
  if (camp.status === 'borrador') throw new ApiError(409, 'Un campamento en borrador no puede ser el activo. Publícalo primero.');
  ctx.db.camps.forEach((c) => (c.isFeatured = c.id === camp.id));
  return { status: 200, data: ctx.db.camps };
};

// =========================================================
// TALLERES
// =========================================================
function validateCourse(ctx: HandlerContext, b: any): CampCourse {
  const errors: Record<string, string> = {};
  const camp = ctx.db.camps.find((c) => c.id === b.campId);
  if (!camp) errors.campId = 'El campamento no existe.';
  if (clean(b.title).length < 3) errors.title = 'El título es obligatorio.';
  if (b.scheduleType === 'single_day') {
    if (!b.date) errors.date = 'Elige el día del taller.';
    else if (camp && (b.date < camp.startDate || b.date > camp.endDate)) errors.date = 'El día debe estar dentro del campamento.';
  }
  if (!b.fullDay && (!b.startTime || !b.endTime || b.endTime <= b.startTime)) errors.endTime = 'La hora de fin debe ser posterior al inicio.';
  if (!(Number(b.maxCapacity) >= 1)) errors.maxCapacity = 'El cupo debe ser al menos 1.';
  if (Number(b.minAge) > Number(b.maxAge)) errors.minAge = 'La edad mínima supera la máxima.';
  checkImage(b.coverImageUrl, 'coverImageUrl');
  checkImage(b.instructorPhotoUrl, 'instructorPhotoUrl');
  check(errors);
  return { ...b, title: clean(b.title, 120), maxCapacity: Number(b.maxCapacity) };
}

const createCourse: Handler = (ctx) => {
  const course = validateCourse(ctx, { ...ctx.body, id: uid('c'), enrolledCount: 0 });
  ctx.db.courses.unshift(course);
  return course;
};

const updateCourse: Handler = (ctx) => {
  const idx = ctx.db.courses.findIndex((c) => c.id === ctx.params.id);
  if (idx < 0) throw new ApiError(404, 'El taller no existe.');
  const current = ctx.db.courses[idx];
  const course = validateCourse(ctx, { ...current, ...ctx.body, id: current.id, enrolledCount: current.enrolledCount });
  if (course.maxCapacity < current.enrolledCount) {
    throw new ApiError(409, `El cupo no puede ser menor a los ${current.enrolledCount} inscritos actuales.`);
  }
  ctx.db.courses[idx] = course;
  return course;
};

const deleteCourse: Handler = (ctx) => {
  const course = findOr404(ctx.db.courses, ctx.params.id, 'El taller');
  ctx.db.courses = ctx.db.courses.filter((c) => c.id !== course.id);
  ctx.db.registrations.forEach((r) => (r.enrolledCourseIds = r.enrolledCourseIds.filter((id) => id !== course.id)));
  return { status: 200, data: { deleted: course.id } };
};

// =========================================================
// TRIBUS Y CAMPEONATOS
// =========================================================
function validateTribe(ctx: HandlerContext, b: any): TribeGroup {
  const errors: Record<string, string> = {};
  if (clean(b.name).length < 2) errors.name = 'El nombre es obligatorio.';
  if (!/^#[0-9a-f]{6}$/i.test(b.colorHex || '')) errors.colorHex = 'Color no válido.';
  if (!(Number(b.number) >= 1)) errors.number = 'Número no válido.';
  check(errors);
  if (ctx.db.tribes.some((t) => t.id !== b.id && t.number === Number(b.number))) {
    throw new ApiError(409, `Ya existe la tribu N.º ${b.number}.`, { errors: { number: 'Número repetido.' } });
  }
  return { ...b, number: Number(b.number), name: clean(b.name, 80) };
}

const createTribe: Handler = (ctx) => {
  const tribe = validateTribe(ctx, { ...ctx.body, id: uid('t') });
  ctx.db.tribes.push(tribe);
  return tribe;
};
const updateTribe: Handler = (ctx) => {
  const idx = ctx.db.tribes.findIndex((t) => t.id === ctx.params.id);
  if (idx < 0) throw new ApiError(404, 'La tribu no existe.');
  const tribe = validateTribe(ctx, { ...ctx.db.tribes[idx], ...ctx.body, id: ctx.params.id });
  ctx.db.tribes[idx] = tribe;
  return tribe;
};
const deleteTribe: Handler = (ctx) => {
  const tribe = findOr404(ctx.db.tribes, ctx.params.id, 'La tribu');
  const members = ctx.db.registrations.filter((r) => r.tribeId === tribe.id).length;
  if (members) throw new ApiError(409, `La tribu tiene ${members} integrantes. Reasígnalos antes de eliminarla.`);
  ctx.db.tribes = ctx.db.tribes.filter((t) => t.id !== tribe.id);
  return { status: 200, data: { deleted: tribe.id } };
};

function validateChampionship(ctx: HandlerContext, b: any): Championship {
  const errors: Record<string, string> = {};
  if (clean(b.name).length < 3) errors.name = 'El nombre es obligatorio.';
  if (!ctx.db.camps.some((c) => c.id === b.campId)) errors.campId = 'Elige el campamento al que pertenece.';
  if (!['Varonil', 'Femenil', 'Mixto'].includes(b.genderCategory)) errors.genderCategory = 'Categoría no válida.';
  if (!['individual', 'team'].includes(b.mode)) errors.mode = 'Indica si es individual o por equipos.';
  if (!(Number(b.registrationFee) >= 0)) errors.registrationFee = 'Monto no válido.';
  if (!(Number(b.maxTeamsOrParticipants) >= 1)) errors.maxTeamsOrParticipants = 'El cupo debe ser al menos 1.';
  if (b.mode === 'team') {
    const min = Number(b.minTeamSize);
    const max = Number(b.maxTeamSize);
    if (!(min >= 2)) errors.minTeamSize = 'Un equipo necesita al menos 2 integrantes.';
    if (!(max >= min)) errors.maxTeamSize = 'El máximo debe ser mayor o igual al mínimo.';
  }
  checkImage(b.imageUrl, 'imageUrl');
  check(errors);
  const active = ctx.db.championshipEntries.filter((e) => e.championshipId === b.id && e.status !== 'cancelled').length;
  if (Number(b.maxTeamsOrParticipants) < active) {
    throw new ApiError(409, `El cupo no puede ser menor a las ${active} inscripciones actuales.`);
  }
  return {
    ...b,
    registrationFee: Number(b.registrationFee),
    maxTeamsOrParticipants: Number(b.maxTeamsOrParticipants),
    minTeamSize: b.mode === 'team' ? Number(b.minTeamSize) : undefined,
    maxTeamSize: b.mode === 'team' ? Number(b.maxTeamSize) : undefined,
    enrolledTeamsCount: active,
  };
}
const createChampionship: Handler = (ctx) => {
  const ch = validateChampionship(ctx, { ...ctx.body, id: uid('champ') });
  ctx.db.championships.push(ch);
  return ch;
};
const updateChampionship: Handler = (ctx) => {
  const idx = ctx.db.championships.findIndex((c) => c.id === ctx.params.id);
  if (idx < 0) throw new ApiError(404, 'El campeonato no existe.');
  const current = ctx.db.championships[idx];
  if (ctx.body.mode && ctx.body.mode !== current.mode && ctx.db.championshipEntries.some((e) => e.championshipId === current.id && e.status !== 'cancelled')) {
    throw new ApiError(409, 'No se puede cambiar entre individual y equipos cuando ya hay inscritos.');
  }
  const ch = validateChampionship(ctx, { ...current, ...ctx.body, id: ctx.params.id });
  ctx.db.championships[idx] = ch;
  return ch;
};
const deleteChampionship: Handler = (ctx) => {
  const ch = findOr404(ctx.db.championships, ctx.params.id, 'El campeonato');
  const active = ctx.db.championshipEntries.filter((e) => e.championshipId === ch.id && e.status !== 'cancelled').length;
  if (active) throw new ApiError(409, `El campeonato tiene ${active} inscripciones activas. Anúlalas antes de eliminarlo.`);
  ctx.db.championships = ctx.db.championships.filter((c) => c.id !== ch.id);
  ctx.db.championshipEntries = ctx.db.championshipEntries.filter((e) => e.championshipId !== ch.id);
  ctx.db.registrations.forEach((r) => (r.enrolledChampionshipIds = r.enrolledChampionshipIds.filter((id) => id !== ch.id)));
  return { status: 200, data: { deleted: ch.id } };
};

// =========================================================
// CATÁLOGOS
// =========================================================
const CATALOG_KINDS: CatalogKind[] = ['cities', 'subdirectivas', 'regionales', 'serviceAreas', 'campTypes'];
const PARENT: Partial<Record<CatalogKind, { key: string; kind: CatalogKind }>> = {
  subdirectivas: { key: 'cityId', kind: 'cities' },
  regionales: { key: 'subdirectivaId', kind: 'subdirectivas' },
};

function catalogKind(ctx: HandlerContext): CatalogKind {
  const kind = ctx.params.kind as CatalogKind;
  if (!CATALOG_KINDS.includes(kind)) throw new ApiError(404, `El catálogo "${ctx.params.kind}" no existe.`);
  return kind;
}

function validateCatalogItem(ctx: HandlerContext, kind: CatalogKind, item: any) {
  const name = clean(item.name, 120);
  if (name.length < 2) validationError({ name: 'El nombre es obligatorio.' });
  const parent = PARENT[kind];
  if (parent) {
    const list = ctx.db.catalogs[parent.kind] as { id: string }[];
    if (!list.some((p) => p.id === item[parent.key])) validationError({ [parent.key]: 'El elemento padre no existe.' });
  }
  if (kind === 'campTypes' && !/^#[0-9a-f]{6}$/i.test(item.colorHex || '')) validationError({ colorHex: 'Color no válido.' });
  const normalized = kind === 'regionales' ? name.toUpperCase() : name;
  const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const dup = (ctx.db.catalogs[kind] as any[]).some(
    (x) => x.id !== item.id && norm(x.name) === norm(normalized) && (!parent || kind === 'regionales' || x[parent.key] === item[parent.key])
  );
  if (dup) throw new ApiError(409, `Ya existe "${normalized}" en este catálogo.`, { errors: { name: 'Nombre repetido.' } });
  return { ...item, name: normalized };
}

const createCatalogItem: Handler = (ctx) => {
  const kind = catalogKind(ctx);
  const item = validateCatalogItem(ctx, kind, { ...ctx.body, id: uid(kind.slice(0, 4)) });
  (ctx.db.catalogs[kind] as any[]).push(item);
  return item;
};

const updateCatalogItem: Handler = (ctx) => {
  const kind = catalogKind(ctx);
  const list = ctx.db.catalogs[kind] as any[];
  const idx = list.findIndex((x) => x.id === ctx.params.id);
  if (idx < 0) throw new ApiError(404, 'El elemento no existe.');
  const before = list[idx];
  const item = validateCatalogItem(ctx, kind, { ...before, ...ctx.body, id: ctx.params.id });
  list[idx] = item;
  // Renombrar una regional actualiza las inscripciones que la usan
  if (kind === 'regionales' && before.name !== item.name && ctx.body.cascadeRename) {
    ctx.db.registrations.forEach((r) => {
      if (r.regional === before.name) r.regional = item.name;
    });
  }
  return item;
};

const deleteCatalogItem: Handler = (ctx) => {
  const kind = catalogKind(ctx);
  const id = ctx.params.id;
  const c: Catalogs = ctx.db.catalogs;
  if (!(c[kind] as { id: string }[]).some((x) => x.id === id)) throw new ApiError(404, 'El elemento no existe.');
  if (kind === 'campTypes') {
    const used = ctx.db.camps.filter((x) => x.typeId === id).length;
    if (used) throw new ApiError(409, `Hay ${used} campamentos de este tipo. Reasígnalos antes de eliminarlo.`);
  }
  (c as any)[kind] = (c[kind] as { id: string }[]).filter((x) => x.id !== id);
  if (kind === 'cities') {
    const subs = c.subdirectivas.filter((s) => s.cityId === id).map((s) => s.id);
    c.subdirectivas = c.subdirectivas.filter((s) => s.cityId !== id);
    c.regionales = c.regionales.filter((r) => !subs.includes(r.subdirectivaId));
  }
  if (kind === 'subdirectivas') c.regionales = c.regionales.filter((r) => r.subdirectivaId !== id);
  return { status: 200, data: ctx.db.catalogs };
};

// =========================================================
// INSCRIPCIONES
// =========================================================
function assignTribe(ctx: HandlerContext, campId: string): string {
  const tribes = ctx.db.tribes;
  if (!tribes.length) return '';
  const counts: Record<string, number> = Object.fromEntries(tribes.map((t) => [t.id, 0]));
  ctx.db.registrations.filter((r) => r.campId === campId).forEach((r) => counts[r.tribeId] !== undefined && counts[r.tribeId]++);
  return tribes.reduce((min, t) => (counts[t.id] < counts[min.id] ? t : min), tribes[0]).id;
}

function checkCourses(ctx: HandlerContext, camp: Camp, courseIds: string[], age: number, previous: string[] = []) {
  if (!Array.isArray(courseIds)) validationError({ enrolledCourseIds: 'Lista de talleres no válida.' });
  if (courseIds.length > camp.maxCoursesPerCamper) {
    validationError({ enrolledCourseIds: `Máximo ${camp.maxCoursesPerCamper} talleres por joven.` });
  }
  const courses = courseIds.map((id) => {
    const course = ctx.db.courses.find((c) => c.id === id && c.campId === camp.id);
    if (!course) throw new ApiError(404, 'Uno de los talleres no existe en este campamento.');
    if (!previous.includes(id) && course.enrolledCount >= course.maxCapacity) {
      throw new ApiError(409, `El taller "${course.title}" ya no tiene cupos.`, { errors: { enrolledCourseIds: 'Taller lleno.' } });
    }
    if (age && (age < course.minAge || age > course.maxAge)) {
      validationError({ enrolledCourseIds: `"${course.title}" es para ${course.minAge}–${course.maxAge} años.` });
    }
    return course;
  });
  courses.forEach((a, i) =>
    courses.slice(i + 1).forEach((b) => {
      if (coursesOverlap(a, b)) throw new ApiError(409, `"${a.title}" y "${b.title}" se cruzan en horario.`);
    })
  );
}

function adjustCourseCounts(ctx: HandlerContext, added: string[], removed: string[]) {
  ctx.db.courses.forEach((c) => {
    if (added.includes(c.id)) c.enrolledCount = Math.min(c.maxCapacity, c.enrolledCount + 1);
    if (removed.includes(c.id)) c.enrolledCount = Math.max(0, c.enrolledCount - 1);
  });
}

function createRegistrationFor(ctx: HandlerContext, user: StoredUser, b: any): CamperRegistration {
  const camp = ctx.db.camps.find((c) => c.id === b.campId);
  if (!camp || camp.status === 'borrador') throw new ApiError(404, 'El campamento no existe.');
  if (!isCampEnrollable(camp)) throw new ApiError(409, 'Las inscripciones para este campamento están cerradas.');
  if (ctx.db.registrations.some((r) => r.campId === camp.id && r.userId === user.id)) {
    throw new ApiError(409, 'Ya estás inscrito en este campamento. Revisa «Mis inscripciones».');
  }

  const errors: Record<string, string> = {};
  if (clean(b.firstName).length < 2) errors.firstName = 'Ingresa tus nombres.';
  if (clean(b.paternalLastName).length < 2) errors.paternalLastName = 'Ingresa tu apellido paterno.';
  if (digits(clean(b.documentId)).length < 5) errors.documentId = 'Número de CI no válido.';
  const age = Number(b.age);
  if (!(age >= camp.minAge && age <= camp.maxAge)) errors.age = `Este campamento es para ${camp.minAge} a ${camp.maxAge} años.`;
  if (!ctx.db.catalogs.regionales.some((r) => r.name === b.regional)) errors.regional = 'Regional no válida.';
  if (b.gender !== 'M' && b.gender !== 'F') errors.gender = 'Indica si eres varón o mujer.';
  check(errors);

  const docDigits = digits(clean(b.documentId));
  if (ctx.db.registrations.some((r) => r.campId === camp.id && digits(r.documentId) === docDigits)) {
    throw new ApiError(409, 'Ya existe una inscripción con este CI en este campamento.', { errors: { documentId: 'CI ya inscrito.' } });
  }
  // Talleres y campeonatos NO se eligen al comprar: se habilitan cuando el pago está confirmado
  const courseIds: string[] = [];
  const champIds: string[] = [];

  // ── Pago: el monto lo calcula el SERVIDOR (nunca se confía en el cliente) ──
  const settings = ctx.db.paymentSettings;
  const method = b.payment?.method as PaymentTransaction['paymentMethod'];
  const enabled = { qr_bank: settings.qr.enabled, transfer: settings.transfer.enabled, cash_box: settings.cash.enabled };
  if (!method || !enabled[method]) validationError({ paymentMethod: 'Método de pago no disponible.' });
  let fee = camp.price;
  let couponCodeApplied: string | undefined;
  if (b.payment.couponCode && method !== 'cash_box') {
    fee = couponPrice(ctx, b.payment.couponCode, camp, b.regional, 35);
    couponCodeApplied = String(b.payment.couponCode).toUpperCase();
  }
  const needsVoucher = method === 'transfer' || (method === 'qr_bank' && !settings.qr.autoConfirm);
  if (needsVoucher) {
    if ((method === 'qr_bank' || settings.transfer.requireVoucher) && !b.payment.voucherImageUrl) {
      validationError({ voucher: 'Sube la foto de tu comprobante.' });
    }
    if (method === 'transfer' && settings.transfer.requireReference && !clean(b.payment.voucherReferenceNumber)) {
      validationError({ reference: 'Ingresa el número de referencia.' });
    }
    checkImage(b.payment.voucherImageUrl, 'voucher');
  }
  const advance = method === 'cash_box' && settings.cash.allowAdvance ? Math.ceil((camp.price * camp.cashAdvancePercent) / 100) : 0;
  const paidByGateway = method === 'qr_bank' && settings.qr.autoConfirm && b.payment.gatewayConfirmed === true;
  const now = nowStamp();
  const id = `CMP-${camp.startDate.slice(0, 4)}-${Math.floor(1000 + Math.random() * 9000)}`;
  const fullName = [b.firstName, b.paternalLastName, b.maternalLastName].map((x) => clean(x, 60)).filter(Boolean).join(' ');
  const tribeId = assignTribe(ctx, camp.id);

  const payment: PaymentTransaction = {
    id: uid('PAY'),
    registrationId: id,
    camperName: fullName,
    baseCampFee: fee,
    coursesFees: 0,
    championshipsFees: 0,
    discountAmount: camp.price - fee,
    couponCodeApplied,
    totalAmount: method === 'cash_box' ? camp.price : fee,
    advanceAmount: method === 'cash_box' ? advance : undefined,
    remainingBalance: method === 'cash_box' ? camp.price - advance : undefined,
    currency: 'Bs',
    date: now,
    status: paidByGateway ? 'completed' : needsVoucher ? 'pending_verification' : method === 'qr_bank' ? 'pending_verification' : 'pending_cash',
    paymentMethod: method,
    voucherImageUrl: needsVoucher ? b.payment.voucherImageUrl : undefined,
    voucherFileName: needsVoucher ? clean(b.payment.voucherFileName, 120) : undefined,
    voucherUploadedAt: needsVoucher ? now : undefined,
    voucherReferenceNumber: needsVoucher ? clean(b.payment.voucherReferenceNumber, 60) : undefined,
    webhookReceivedAt: paidByGateway ? now : undefined,
    verifiedAt: paidByGateway ? now : undefined,
    verifiedBy: paidByGateway ? 'Pasarela bancaria' : undefined,
    transactionFolio: paidByGateway
      ? `QR-${Math.floor(100000 + Math.random() * 900000)}`
      : needsVoucher
      ? `TRX-REF-${clean(b.payment.voucherReferenceNumber, 40) || Date.now().toString().slice(-6)}`
      : `CAJA-${Math.floor(1000 + Math.random() * 9000)}`,
  };

  const registration: CamperRegistration = {
    id,
    campId: camp.id,
    ticketCode: buildTicketCode(camp, ctx.db.registrations.filter((r) => r.campId === camp.id).length + 1),
    userId: user.id,
    qrPayload: buildCamperQrPayload(id, fullName, tribeId),
    fullName,
    firstName: clean(b.firstName, 60),
    paternalLastName: clean(b.paternalLastName, 60),
    maternalLastName: clean(b.maternalLastName, 60),
    birthDate: clean(b.birthDate, 10),
    age,
    gender: b.gender,
    documentId: clean(b.documentId, 20),
    idExpedition: clean(b.idExpedition, 4),
    phone: clean(b.phone, 20) || user.phone,
    email: user.email,
    city: clean(b.city, 60),
    regional: b.regional,
    churchCongregation: clean(b.churchCongregation, 120),
    subdirectivaNumber: clean(b.subdirectivaNumber, 80),
    serviceAreaOfInterest: clean(b.serviceAreaOfInterest, 120),
    delegateRole: 'CAMPAMENTISTA',
    isDelegate: false,
    championshipsStatus: champIds.length ? (paidByGateway ? 'confirmed' : 'pending_payment') : undefined,
    emergencyContactName: clean(b.emergencyContactName, 80),
    emergencyPhone: clean(b.emergencyPhone, 20),
    tribeId,
    enrolledCourseIds: courseIds,
    enrolledChampionshipIds: champIds,
    groupSize: 1,
    payment,
    status: paidByGateway ? 'active' : 'pending_payment',
    registeredAt: now,
  };
  ctx.db.registrations.unshift(registration);
  adjustCourseCounts(ctx, courseIds, []);

  notify(ctx, [user.id], {
    type: 'registration_created',
    title: '¡Inscripción registrada!',
    body: `Tu entrada ${registration.ticketCode} para ${camp.name} fue creada.${
      paidByGateway ? ' Pago confirmado: ya puedes elegir tus talleres y campeonatos.' : ' Al confirmarse tu pago podrás elegir talleres y campeonatos.'
    }`,
    link: `/mis-inscripciones/${registration.id}`,
  });
  if (payment.status === 'pending_verification') {
    notify(ctx, usersWith(ctx, 'payments:verify'), {
      type: 'voucher_submitted',
      title: 'Nuevo comprobante por verificar',
      body: `${fullName} · ${camp.name} · ${payment.totalAmount} Bs`,
      link: '/admin/pagos',
    });
  }
  return registration;
}

const createRegistration: Handler = (ctx) => ({ status: 201, data: createRegistrationFor(ctx, ctx.user!, ctx.body) });

/**
 * Compra del campamento en UN SOLO PASO.
 * Sin sesión: valida la cuenta nueva y la inscripción juntas; solo si ambas son válidas se guardan.
 * Con sesión: equivale a POST /registrations.
 */
const enroll: Handler = (ctx) => {
  const b = ctx.body;
  if (ctx.user) {
    const registration = createRegistrationFor(ctx, ctx.user, b);
    return { status: 201, data: { registration } };
  }
  rateLimit(ctx, 'enroll', 15, 10 * 60 * 1000);
  const account = b.account || {};
  const user = buildNewUser(ctx, {
    ...account,
    firstName: b.firstName,
    paternalLastName: b.paternalLastName,
    maternalLastName: b.maternalLastName,
    birthDate: b.birthDate,
    phone: b.phone,
    regional: b.regional,
    city: b.city,
    churchCongregation: b.churchCongregation,
    gender: b.gender,
  });
  // createRegistrationFor lanza el error antes de guardar nada si algo falla
  const registration = createRegistrationFor(ctx, user, b);
  ctx.db.users.push(user);
  return { status: 201, data: { registration, ...issueSession(ctx, user) } };
};

const myRegistrations: Handler = (ctx) => ctx.db.registrations.filter((r) => r.userId === ctx.user!.id);

const listRegistrations: Handler = (ctx) => {
  const campId = ctx.query.get('campId');
  return campId ? ctx.db.registrations.filter((r) => r.campId === campId) : ctx.db.registrations;
};

const getRegistration: Handler = (ctx) => {
  const r = findOr404(ctx.db.registrations, ctx.params.id, 'La inscripción');
  requireOwnerOrPermission(ctx, r.userId);
  return r;
};

const updateRegistration: Handler = (ctx) => {
  const r = findOr404(ctx.db.registrations, ctx.params.id, 'La inscripción');
  const b = ctx.body;
  const camp = findOr404(ctx.db.camps, r.campId, 'El campamento');
  if (b.regional !== undefined && !ctx.db.catalogs.regionales.some((x) => x.name === b.regional)) validationError({ regional: 'Regional no válida.' });
  if (b.tribeId !== undefined && !ctx.db.tribes.some((t) => t.id === b.tribeId)) validationError({ tribeId: 'Tribu no válida.' });
  if (b.enrolledCourseIds !== undefined) {
    checkCourses(ctx, camp, b.enrolledCourseIds, r.age, r.enrolledCourseIds);
    const added = b.enrolledCourseIds.filter((id: string) => !r.enrolledCourseIds.includes(id));
    const removed = r.enrolledCourseIds.filter((id) => !b.enrolledCourseIds.includes(id));
    adjustCourseCounts(ctx, added, removed);
    r.enrolledCourseIds = b.enrolledCourseIds;
  }
  const editable = [
    'phone', 'email', 'regional', 'city', 'subdirectivaNumber', 'churchCongregation',
    'serviceAreaOfInterest', 'emergencyContactName', 'emergencyPhone', 'tribeId',
  ] as const;
  editable.forEach((k) => {
    if (b[k] !== undefined) (r as any)[k] = clean(b[k], 120);
  });
  if (b.tribeId !== undefined) r.qrPayload = buildCamperQrPayload(r.id, r.fullName, r.tribeId);
  if (Array.isArray(b.enrolledChampionshipIds)) r.enrolledChampionshipIds = b.enrolledChampionshipIds;
  return r;
};

const deleteRegistration: Handler = (ctx) => {
  const r = findOr404(ctx.db.registrations, ctx.params.id, 'La inscripción');
  adjustCourseCounts(ctx, [], r.enrolledCourseIds);
  ctx.db.championshipEntries.forEach((e) => {
    if (e.captainRegistrationId === r.id) e.status = 'cancelled';
    e.members = e.members.filter((m) => m.registrationId !== r.id);
  });
  ctx.db.registrations = ctx.db.registrations.filter((x) => x.id !== r.id);
  ctx.db.checkins = ctx.db.checkins.filter((c) => c.registrationId !== r.id);
  return { status: 200, data: { deleted: r.id } };
};

const resubmitVoucher: Handler = (ctx) => {
  const r = findOr404(ctx.db.registrations, ctx.params.id, 'La inscripción');
  requireOwnerOrPermission(ctx, r.userId);
  if (r.payment.status !== 'rejected') throw new ApiError(409, 'Solo se puede reenviar un comprobante rechazado.');
  const imageUrl = ctx.body.imageUrl;
  if (!imageUrl) validationError({ imageUrl: 'Sube la foto del comprobante.' });
  checkImage(imageUrl, 'imageUrl');
  const reference = clean(ctx.body.reference, 60);
  if (ctx.db.paymentSettings.transfer.requireReference && !reference) validationError({ reference: 'Ingresa la referencia.' });
  const p = r.payment;
  p.voucherHistory = [
    ...(p.voucherHistory || []),
    { imageUrl: p.voucherImageUrl, reference: p.voucherReferenceNumber, uploadedAt: p.voucherUploadedAt || p.date, status: 'rejected', reason: p.rejectionReason },
  ];
  Object.assign(p, {
    status: 'pending_verification',
    paymentMethod: 'transfer',
    voucherImageUrl: imageUrl,
    voucherFileName: clean(ctx.body.fileName, 120),
    voucherReferenceNumber: reference,
    voucherUploadedAt: nowStamp(),
    rejectionReason: undefined,
    rejectedAt: undefined,
    rejectedBy: undefined,
    transactionFolio: `TRX-REF-${reference || Date.now().toString().slice(-6)}`,
  });
  r.status = 'pending_payment';
  notify(ctx, usersWith(ctx, 'payments:verify'), {
    type: 'voucher_submitted',
    title: 'Comprobante reenviado',
    body: `${r.fullName} subió un nuevo comprobante (${r.ticketCode}).`,
    link: '/admin/pagos',
  });
  return { status: 200, data: r };
};

// =========================================================
// TALLERES DESPUÉS DE PAGAR
// =========================================================
const humanDate = (v: string) => v.replace('T', ' ');

function ownRegistration(ctx: HandlerContext, id: string) {
  const r = findOr404(ctx.db.registrations, id, 'La inscripción');
  requireOwnerOrPermission(ctx, r.userId);
  return r;
}

function requirePaid(r: CamperRegistration, what: string) {
  if (r.payment.status !== 'completed') {
    throw new ApiError(409, `Podrás ${what} cuando tu pago del campamento esté confirmado.`);
  }
}

const enrollCourse: Handler = (ctx) => {
  const r = ownRegistration(ctx, ctx.params.id);
  const staff = ctx.grantedByPermission;
  if (!staff) requirePaid(r, 'inscribirte a talleres');
  const course = ctx.db.courses.find((c) => c.id === clean(ctx.body.courseId, 60));
  if (!course || course.campId !== r.campId) throw new ApiError(404, 'El taller no existe en tu campamento.');
  if (r.enrolledCourseIds.includes(course.id)) throw new ApiError(409, 'Ya estás inscrito en este taller.');
  const now = nowLocalStamp();
  if (!staff && course.enrollmentOpensAt && now < course.enrollmentOpensAt) {
    throw new ApiError(409, `La inscripción a "${course.title}" abre el ${humanDate(course.enrollmentOpensAt)}.`);
  }
  if (!staff && course.enrollmentClosesAt && now > course.enrollmentClosesAt) {
    throw new ApiError(409, `La inscripción a "${course.title}" cerró el ${humanDate(course.enrollmentClosesAt)}.`);
  }
  const camp = findOr404(ctx.db.camps, r.campId, 'El campamento');
  checkCourses(ctx, camp, [...r.enrolledCourseIds, course.id], r.age, r.enrolledCourseIds);
  r.enrolledCourseIds = [...r.enrolledCourseIds, course.id];
  adjustCourseCounts(ctx, [course.id], []);
  return { status: 201, data: r };
};

const dropCourse: Handler = (ctx) => {
  const r = ownRegistration(ctx, ctx.params.id);
  const course = findOr404(ctx.db.courses, ctx.params.courseId, 'El taller');
  if (!r.enrolledCourseIds.includes(course.id)) throw new ApiError(404, 'No estás inscrito en este taller.');
  if (!ctx.grantedByPermission && course.enrollmentClosesAt && nowLocalStamp() > course.enrollmentClosesAt) {
    throw new ApiError(409, 'La inscripción a este taller ya cerró; pide el cambio a la coordinación.');
  }
  r.enrolledCourseIds = r.enrolledCourseIds.filter((id) => id !== course.id);
  adjustCourseCounts(ctx, [], [course.id]);
  return { status: 200, data: r };
};

// =========================================================
// CAMPEONATOS: INSCRIPCIONES, EQUIPOS Y PAGOS EXTRA
// =========================================================
const activeEntries = (ctx: HandlerContext, championshipId: string) =>
  ctx.db.championshipEntries.filter((e) => e.championshipId === championshipId && e.status !== 'cancelled');

const findEntryOf = (ctx: HandlerContext, championshipId: string, registrationId: string) =>
  activeEntries(ctx, championshipId).find((e) => e.members.some((m) => m.registrationId === registrationId));

/** Categoría Varonil / Femenil según el sexo registrado en la inscripción. */
function checkGender(ch: Championship, r: CamperRegistration) {
  if (ch.genderCategory === 'Mixto' || !r.gender) return;
  if (ch.genderCategory === 'Varonil' && r.gender !== 'M') throw new ApiError(409, `«${ch.name}» es una categoría varonil.`);
  if (ch.genderCategory === 'Femenil' && r.gender !== 'F') throw new ApiError(409, `«${ch.name}» es una categoría femenil.`);
}

function inviteCode(ctx: HandlerContext) {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  do {
    code = Array.from({ length: 8 }, () => alphabet[Math.floor(Math.random() * alphabet.length)]).join('');
  } while (ctx.db.championshipEntries.some((e) => e.inviteCode === code));
  return code;
}

function syncChampionshipIds(ctx: HandlerContext, registrationId: string) {
  const r = ctx.db.registrations.find((x) => x.id === registrationId);
  if (!r) return;
  r.enrolledChampionshipIds = Array.from(
    new Set(
      ctx.db.championshipEntries
        .filter((e) => e.status !== 'cancelled' && e.members.some((m) => m.registrationId === registrationId))
        .map((e) => e.championshipId)
    )
  );
}

/** Pago extra: el monto lo fija el servidor según el campeonato. */
function buildExtraPayment(ctx: HandlerContext, fee: number, p: any): ChampionshipEntry['payment'] {
  if (fee <= 0) return { amount: 0, method: 'free', status: 'completed', folio: 'SIN-COSTO' };
  const settings = ctx.db.paymentSettings;
  const method = p?.method;
  const enabled = { qr_bank: settings.qr.enabled, transfer: settings.transfer.enabled, cash_box: settings.cash.enabled } as Record<string, boolean>;
  if (!method || !enabled[method]) validationError({ paymentMethod: 'Método de pago no disponible.' });
  const needsVoucher = method === 'transfer' || (method === 'qr_bank' && !settings.qr.autoConfirm);
  if (needsVoucher) {
    if (!p.voucherImageUrl) validationError({ voucher: 'Sube la foto de tu comprobante.' });
    checkImage(p.voucherImageUrl, 'voucher');
    if (method === 'transfer' && settings.transfer.requireReference && !clean(p.voucherReferenceNumber)) {
      validationError({ reference: 'Ingresa el número de referencia.' });
    }
  }
  const paid = method === 'qr_bank' && settings.qr.autoConfirm && p.gatewayConfirmed === true;
  const now = nowStamp();
  return {
    amount: fee,
    method,
    status: paid ? 'completed' : needsVoucher || method === 'qr_bank' ? 'pending_verification' : 'pending_cash',
    voucherImageUrl: needsVoucher ? p.voucherImageUrl : undefined,
    voucherReferenceNumber: needsVoucher ? clean(p.voucherReferenceNumber, 60) : undefined,
    voucherUploadedAt: needsVoucher ? now : undefined,
    verifiedAt: paid ? now : undefined,
    verifiedBy: paid ? 'Pasarela bancaria' : undefined,
    folio: paid ? `QR-X-${Math.floor(100000 + Math.random() * 900000)}` : `EXT-${Math.floor(100000 + Math.random() * 900000)}`,
  };
}

const listChampionshipEntries: Handler = (ctx) => {
  const campId = ctx.query.get('campId');
  return campId ? ctx.db.championshipEntries.filter((e) => e.campId === campId) : ctx.db.championshipEntries;
};

const myChampionshipEntries: Handler = (ctx) =>
  ctx.db.championshipEntries.filter((e) => e.members.some((m) => m.userId === ctx.user!.id) || e.captainUserId === ctx.user!.id);

const createChampionshipEntry: Handler = (ctx) => {
  const b = ctx.body;
  const r = ownRegistration(ctx, clean(b.registrationId, 60));
  requirePaid(r, 'inscribirte a campeonatos');
  const ch = findOr404(ctx.db.championships, clean(b.championshipId, 60), 'El campeonato');
  if (ch.campId !== r.campId) throw new ApiError(409, 'Este campeonato es de otro campamento.');
  if (ch.registrationClosesAt && nowLocalStamp().slice(0, 10) > ch.registrationClosesAt) {
    throw new ApiError(409, `Las inscripciones a "${ch.name}" cerraron el ${ch.registrationClosesAt}.`);
  }
  checkGender(ch, r);
  if (findEntryOf(ctx, ch.id, r.id)) throw new ApiError(409, 'Ya participas en este campeonato.');
  if (activeEntries(ctx, ch.id).length >= ch.maxTeamsOrParticipants) {
    throw new ApiError(409, ch.mode === 'team' ? 'Ya no hay cupo para más equipos.' : 'Ya no hay cupo para más participantes.');
  }
  let teamName: string | undefined;
  if (ch.mode === 'team') {
    teamName = clean(b.teamName, 40);
    if (teamName.length < 3) validationError({ teamName: 'Ponle un nombre a tu equipo (mínimo 3 letras).' });
    if (activeEntries(ctx, ch.id).some((e) => e.teamName?.toLowerCase() === teamName!.toLowerCase())) {
      throw new ApiError(409, 'Ya existe un equipo con ese nombre en este campeonato.', { errors: { teamName: 'Nombre repetido.' } });
    }
  }
  const payment = buildExtraPayment(ctx, ch.registrationFee, b.payment);
  const entry: ChampionshipEntry = {
    id: uid('ent'),
    championshipId: ch.id,
    campId: ch.campId,
    type: ch.mode,
    captainRegistrationId: r.id,
    captainUserId: r.userId,
    teamName,
    inviteCode: ch.mode === 'team' ? inviteCode(ctx) : undefined,
    members: [{ registrationId: r.id, userId: r.userId, fullName: r.fullName, tribeId: r.tribeId, role: 'captain', joinedAt: nowStamp() }],
    status: payment.status === 'completed' ? 'confirmed' : 'pending_payment',
    payment,
    createdAt: nowStamp(),
  };
  ctx.db.championshipEntries.unshift(entry);
  syncChampionshipIds(ctx, r.id);
  if (payment.status === 'pending_verification') {
    notify(ctx, usersWith(ctx, 'payments:verify'), {
      type: 'voucher_submitted',
      title: 'Pago extra por verificar',
      body: `${r.fullName} · ${ch.name}${teamName ? ` (equipo ${teamName})` : ''} · ${payment.amount} Bs`,
      link: '/admin/pagos',
    });
  }
  return { status: 201, data: entry };
};

const cancelChampionshipEntry: Handler = (ctx) => {
  const e = findOr404(ctx.db.championshipEntries, ctx.params.id, 'La inscripción al campeonato');
  if (!ctx.grantedByPermission && e.captainUserId !== ctx.user!.id) throw new ApiError(403, 'Solo el capitán puede anular la inscripción.');
  if (e.status === 'cancelled') throw new ApiError(409, 'La inscripción ya estaba anulada.');
  if (!ctx.grantedByPermission && e.payment.status === 'completed' && e.payment.amount > 0) {
    throw new ApiError(409, 'El pago ya fue confirmado. Pide la anulación a la coordinación.');
  }
  e.status = 'cancelled';
  e.members.forEach((m) => syncChampionshipIds(ctx, m.registrationId));
  return { status: 200, data: e };
};

const resubmitEntryVoucher: Handler = (ctx) => {
  const e = findOr404(ctx.db.championshipEntries, ctx.params.id, 'La inscripción al campeonato');
  if (!ctx.grantedByPermission && e.captainUserId !== ctx.user!.id) throw new ApiError(403, 'Solo quien pagó puede reenviar el comprobante.');
  if (e.payment.status !== 'rejected') throw new ApiError(409, 'Solo se puede reenviar un comprobante rechazado.');
  if (!ctx.body.imageUrl) validationError({ imageUrl: 'Sube la foto del comprobante.' });
  checkImage(ctx.body.imageUrl, 'imageUrl');
  Object.assign(e.payment, {
    status: 'pending_verification',
    method: 'transfer',
    voucherImageUrl: ctx.body.imageUrl,
    voucherReferenceNumber: clean(ctx.body.reference, 60),
    voucherUploadedAt: nowStamp(),
    rejectionReason: undefined,
  });
  notify(ctx, usersWith(ctx, 'payments:verify'), {
    type: 'voucher_submitted',
    title: 'Comprobante extra reenviado',
    body: `${e.members[0]?.fullName || ''} · ${e.payment.amount} Bs`,
    link: '/admin/pagos',
  });
  return { status: 200, data: e };
};

const removeTeamMember: Handler = (ctx) => {
  const e = findOr404(ctx.db.championshipEntries, ctx.params.id, 'El equipo');
  const member = e.members.find((m) => m.registrationId === ctx.params.registrationId);
  if (!member) throw new ApiError(404, 'Esa persona no es parte del equipo.');
  const isCaptain = e.captainUserId === ctx.user!.id;
  const isSelf = member.userId === ctx.user!.id;
  if (!ctx.grantedByPermission && !isCaptain && !isSelf) throw new ApiError(403, 'Solo el capitán puede quitar integrantes.');
  if (member.role === 'captain') throw new ApiError(409, 'El capitán no puede salir; anula el equipo o pide ayuda a la coordinación.');
  e.members = e.members.filter((m) => m !== member);
  syncChampionshipIds(ctx, member.registrationId);
  if (!isSelf) {
    notify(ctx, [member.userId], { type: 'system', title: 'Saliste de un equipo', body: `Ya no formas parte de «${e.teamName}».`, link: '/mis-inscripciones' });
  }
  return { status: 200, data: e };
};

function teamView(ctx: HandlerContext, e: ChampionshipEntry): TeamInvite {
  const ch = findOr404(ctx.db.championships, e.championshipId, 'El campeonato');
  const camp = findOr404(ctx.db.camps, e.campId, 'El campamento');
  return {
    inviteCode: e.inviteCode!,
    teamName: e.teamName || '',
    entryStatus: e.status,
    championship: {
      id: ch.id,
      name: ch.name,
      sport: ch.sport,
      genderCategory: ch.genderCategory,
      schedule: ch.schedule,
      imageUrl: ch.imageUrl,
      minTeamSize: ch.minTeamSize,
      maxTeamSize: ch.maxTeamSize,
    },
    camp: { id: camp.id, name: camp.name, startDate: camp.startDate, endDate: camp.endDate, location: camp.location },
    captainName: e.members.find((m) => m.role === 'captain')?.fullName.split(' ')[0] || '',
    // solo nombres de pila: la página del enlace es pública
    members: e.members.map((m) => ({ fullName: m.fullName.split(' ').slice(0, 2).join(' '), role: m.role })),
    slotsLeft: Math.max(0, (ch.maxTeamSize || 0) - e.members.length),
  };
}

const getTeamInvite: Handler = (ctx) => {
  const e = ctx.db.championshipEntries.find((x) => x.inviteCode === clean(ctx.params.code, 12).toUpperCase() && x.status !== 'cancelled');
  if (!e) throw new ApiError(404, 'El enlace de invitación no existe o el equipo fue anulado.');
  return teamView(ctx, e);
};

const joinTeam: Handler = (ctx) => {
  const e = ctx.db.championshipEntries.find((x) => x.inviteCode === clean(ctx.params.code, 12).toUpperCase() && x.status !== 'cancelled');
  if (!e) throw new ApiError(404, 'El enlace de invitación no existe o el equipo fue anulado.');
  if (e.status !== 'confirmed') throw new ApiError(409, 'El equipo aún no confirma su pago; el enlace se activa cuando tesorería lo apruebe.');
  const ch = findOr404(ctx.db.championships, e.championshipId, 'El campeonato');
  const r =
    (ctx.body.registrationId ? ctx.db.registrations.find((x) => x.id === ctx.body.registrationId) : undefined) ||
    ctx.db.registrations.find((x) => x.userId === ctx.user!.id && x.campId === e.campId);
  if (!r) throw new ApiError(409, `Primero inscríbete al ${findOr404(ctx.db.camps, e.campId, 'El campamento').name}.`);
  if (r.userId !== ctx.user!.id) throw new ApiError(403, 'Solo puedes unirte con tu propia inscripción.');
  if (r.campId !== e.campId) throw new ApiError(409, 'Tu inscripción es de otro campamento.');
  requirePaid(r, 'unirte a un equipo');
  if (e.members.some((m) => m.registrationId === r.id)) throw new ApiError(409, 'Ya eres parte de este equipo.');
  checkGender(ch, r);
  if (findEntryOf(ctx, ch.id, r.id)) throw new ApiError(409, 'Ya participas en este campeonato con otro equipo.');
  if (ch.maxTeamSize && e.members.length >= ch.maxTeamSize) throw new ApiError(409, 'El equipo ya está completo.');
  e.members.push({ registrationId: r.id, userId: r.userId, fullName: r.fullName, tribeId: r.tribeId, role: 'member', joinedAt: nowStamp() });
  syncChampionshipIds(ctx, r.id);
  notify(ctx, [e.captainUserId], {
    type: 'system',
    title: 'Nuevo integrante en tu equipo',
    body: `${r.fullName} se unió a «${e.teamName}» (${e.members.length}/${ch.maxTeamSize}).`,
    link: `/mis-inscripciones/${e.captainRegistrationId}`,
  });
  return { status: 200, data: e };
};

function entryPaymentGuard(e: ChampionshipEntry) {
  if (e.status === 'cancelled') throw new ApiError(409, 'La inscripción al campeonato está anulada.');
  if (e.payment.status === 'completed') throw new ApiError(409, 'Este pago extra ya fue confirmado.');
}

const approveEntryPayment: Handler = (ctx) => {
  const e = findOr404(ctx.db.championshipEntries, ctx.params.id, 'La inscripción al campeonato');
  entryPaymentGuard(e);
  if (e.payment.status === 'pending_cash') throw new ApiError(409, 'Este pago se cobra en caja.');
  Object.assign(e.payment, { status: 'completed', verifiedAt: nowStamp(), verifiedBy: staffName(ctx), rejectionReason: undefined });
  e.status = 'confirmed';
  const ch = ctx.db.championships.find((c) => c.id === e.championshipId);
  notify(ctx, [e.captainUserId], {
    type: 'payment_approved',
    title: 'Pago extra aprobado',
    body: e.type === 'team' ? `Tu equipo «${e.teamName}» está confirmado. ¡Comparte el enlace para invitar a tu equipo!` : `Tu inscripción a ${ch?.name} está confirmada.`,
    link: `/mis-inscripciones/${e.captainRegistrationId}`,
  });
  return { status: 200, data: e };
};

const rejectEntryPayment: Handler = (ctx) => {
  const e = findOr404(ctx.db.championshipEntries, ctx.params.id, 'La inscripción al campeonato');
  entryPaymentGuard(e);
  const reason = clean(ctx.body.reason, 300);
  if (reason.length < 5) validationError({ reason: 'Indica el motivo del rechazo.' });
  if (e.payment.status !== 'pending_verification') throw new ApiError(409, 'Solo se rechazan comprobantes pendientes de verificación.');
  Object.assign(e.payment, { status: 'rejected', rejectionReason: reason });
  notify(ctx, [e.captainUserId], {
    type: 'payment_rejected',
    title: 'Comprobante extra rechazado',
    body: `${reason}. Sube un nuevo comprobante desde «Mis inscripciones».`,
    link: `/mis-inscripciones/${e.captainRegistrationId}`,
  });
  return { status: 200, data: e };
};

const collectEntryPayment: Handler = (ctx) => {
  const e = findOr404(ctx.db.championshipEntries, ctx.params.id, 'La inscripción al campeonato');
  entryPaymentGuard(e);
  Object.assign(e.payment, {
    status: 'completed',
    method: 'cash_box',
    collectedBy: staffName(ctx),
    collectedAt: nowStamp(),
    folio: `REC-EXT-${Math.floor(100000 + Math.random() * 900000)}`,
  });
  e.status = 'confirmed';
  notify(ctx, [e.captainUserId], { type: 'payment_collected', title: 'Pago extra registrado en caja', body: `Recibimos ${e.payment.amount} Bs. Folio ${e.payment.folio}.`, link: `/mis-inscripciones/${e.captainRegistrationId}` });
  return { status: 200, data: e };
};

// =========================================================
// PAGOS
// =========================================================
const staffName = (ctx: HandlerContext) => `${ctx.user!.firstName} ${ctx.user!.paternalLastName}`.trim();
const campName = (ctx: HandlerContext, id: string) => ctx.db.camps.find((c) => c.id === id)?.name || 'el campamento';

const approvePayment: Handler = (ctx) => {
  const r = findOr404(ctx.db.registrations, ctx.params.registrationId, 'La inscripción');
  if (r.payment.status === 'completed') throw new ApiError(409, 'Este pago ya fue confirmado.');
  if (!['pending_verification', 'rejected'].includes(r.payment.status)) {
    throw new ApiError(409, 'Este pago se cobra en caja, no tiene comprobante que aprobar.');
  }
  Object.assign(r.payment, { status: 'completed', verifiedAt: nowStamp(), verifiedBy: staffName(ctx), rejectionReason: undefined });
  r.status = 'active';
  if (r.enrolledChampionshipIds.length) r.championshipsStatus = 'confirmed';
  notify(ctx, [r.userId], {
    type: 'payment_approved',
    title: '¡Pago aprobado!',
    body: `Tesorería confirmó tu pago para ${campName(ctx, r.campId)}. Tu credencial ya está activa.`,
    link: `/mis-inscripciones/${r.id}`,
  });
  return { status: 200, data: r };
};

const rejectPayment: Handler = (ctx) => {
  const r = findOr404(ctx.db.registrations, ctx.params.registrationId, 'La inscripción');
  const reason = clean(ctx.body.reason, 300);
  if (reason.length < 5) validationError({ reason: 'Indica el motivo del rechazo.' });
  if (r.payment.status !== 'pending_verification') throw new ApiError(409, 'Solo se pueden rechazar comprobantes pendientes de verificación.');
  Object.assign(r.payment, { status: 'rejected', rejectionReason: reason, rejectedAt: nowStamp(), rejectedBy: staffName(ctx), verifiedAt: undefined, verifiedBy: undefined });
  r.status = 'pending_payment';
  notify(ctx, [r.userId], {
    type: 'payment_rejected',
    title: 'Comprobante rechazado',
    body: `${reason}. Sube un nuevo comprobante desde «Mis inscripciones».`,
    link: `/mis-inscripciones/${r.id}`,
  });
  return { status: 200, data: r };
};

const collectPayment: Handler = (ctx) => {
  const r = findOr404(ctx.db.registrations, ctx.params.registrationId, 'La inscripción');
  if (r.payment.status === 'completed') throw new ApiError(409, 'Este pago ya fue cobrado.');
  const camp = findOr404(ctx.db.camps, r.campId, 'El campamento');
  const total = camp.price + (r.payment.championshipsFees || 0);
  Object.assign(r.payment, {
    baseCampFee: camp.price,
    discountAmount: 0,
    couponCodeApplied: undefined,
    totalAmount: total,
    status: 'completed',
    paymentMethod: 'cash_box',
    remainingBalance: 0,
    cashierCollectedBy: staffName(ctx),
    cashierCollectedAt: nowStamp(),
    transactionFolio: `REC-CAJA-${Math.floor(100000 + Math.random() * 900000)}`,
  });
  r.status = 'active';
  if (r.enrolledChampionshipIds.length) r.championshipsStatus = 'confirmed';
  notify(ctx, [r.userId], {
    type: 'payment_collected',
    title: 'Pago registrado en caja',
    body: `Recibimos ${total} Bs para ${camp.name}. Folio ${r.payment.transactionFolio}.`,
    link: `/mis-inscripciones/${r.id}`,
  });
  return { status: 200, data: r };
};

const updatePaymentSettings: Handler = (ctx) => {
  const s = ctx.body as PaymentSettings;
  if (!s?.qr || !s?.transfer || !s?.cash) validationError({ settings: 'Configuración incompleta.' });
  if (!s.qr.enabled && !s.transfer.enabled && !s.cash.enabled) validationError({ methods: 'Debe quedar al menos un método habilitado.' });
  if (s.transfer.enabled && !s.transfer.accounts.some((a) => a.isActive)) {
    validationError({ accounts: 'La transferencia necesita al menos una cuenta activa.' });
  }
  checkImage(s.qr.qrImageUrl, 'qrImageUrl');
  ctx.db.paymentSettings = s;
  return { status: 200, data: s };
};

// =========================================================
// CONTROL DE ACCESO
// =========================================================
const listCheckins: Handler = (ctx) => {
  const campId = ctx.query.get('campId');
  return campId ? ctx.db.checkins.filter((c) => c.campId === campId) : ctx.db.checkins;
};

const createCheckin: Handler = (ctx) => {
  const code = clean(ctx.body.registrationId || ctx.body.code, 60);
  const r =
    ctx.db.registrations.find((x) => x.id === code || x.ticketCode === code.toUpperCase()) ||
    (digits(code).length >= 5 ? ctx.db.registrations.find((x) => digits(x.documentId) === digits(code)) : undefined);
  if (!r) throw new ApiError(404, 'Credencial no encontrada.');
  if (ctx.body.campId && r.campId !== ctx.body.campId) {
    throw new ApiError(409, `Esta credencial es de ${campName(ctx, r.campId)}.`);
  }
  if (r.payment.status !== 'completed') throw new ApiError(409, 'Pago pendiente: no se permite el ingreso.');
  const courseId = clean(ctx.body.courseId, 60) || 'CAMP_GATE';
  let courseTitle = 'Acceso General Campamento';
  let type: CheckInLog['type'] = 'GATE_ENTRY';
  if (courseId !== 'CAMP_GATE') {
    const course = findOr404(ctx.db.courses, courseId, 'El taller');
    if (!r.enrolledCourseIds.includes(courseId)) throw new ApiError(409, `${r.fullName} no está inscrito en "${course.title}".`);
    courseTitle = course.title;
    type = 'COURSE_ATTENDANCE';
  }
  const log: CheckInLog = {
    id: uid('chk'),
    campId: r.campId,
    registrationId: r.id,
    camperName: r.fullName,
    courseId,
    courseTitle,
    timestamp: nowStamp(true),
    type,
    verifiedBy: staffName(ctx),
  };
  ctx.db.checkins.unshift(log);
  return { status: 201, data: log };
};

// =========================================================
// NOTIFICACIONES
// =========================================================
const listNotifications: Handler = (ctx) => ctx.db.notifications.filter((n) => n.userId === ctx.user!.id).slice(0, 60);

const readNotification: Handler = (ctx) => {
  const n = findOr404(ctx.db.notifications, ctx.params.id, 'La notificación');
  if (n.userId !== ctx.user!.id) throw new ApiError(403, 'Esta notificación no te pertenece.');
  n.read = true;
  return { status: 200, data: n };
};

const readAllNotifications: Handler = (ctx) => {
  ctx.db.notifications.forEach((n) => {
    if (n.userId === ctx.user!.id) n.read = true;
  });
  return { status: 200, data: { ok: true } };
};

const broadcastNotification: Handler = (ctx) => {
  const title = clean(ctx.body.title, 80);
  const body = clean(ctx.body.body, 400);
  const errors: Record<string, string> = {};
  if (title.length < 3) errors.title = 'El título es obligatorio.';
  if (body.length < 5) errors.body = 'Escribe el mensaje.';
  check(errors);
  const audience = ctx.body.audience || 'campers';
  const campId = clean(ctx.body.campId, 60);
  let targets: string[] = [];
  if (audience === 'campers' || audience === 'all') {
    targets.push(...ctx.db.registrations.filter((r) => !campId || r.campId === campId).map((r) => r.userId));
  }
  if (audience === 'staff' || audience === 'all') {
    targets.push(...ctx.db.users.filter((u) => u.role !== 'campista' && u.status === 'active').map((u) => u.id));
  }
  targets = targets.filter((id) => ctx.db.users.some((u) => u.id === id));
  if (!targets.length) throw new ApiError(422, 'No hay destinatarios para este aviso.');
  notify(ctx, targets, { type: 'announcement', title, body, link: ctx.body.link || '/mis-inscripciones' });
  return { status: 201, data: { sent: new Set(targets).size } };
};

const subscribePush: Handler = (ctx) => {
  const endpoint = clean(ctx.body.endpoint, 500);
  if (!endpoint) validationError({ endpoint: 'Suscripción no válida.' });
  ctx.db.pushSubscriptions = ctx.db.pushSubscriptions.filter((s) => s.endpoint !== endpoint);
  ctx.db.pushSubscriptions.push({ userId: ctx.user!.id, endpoint, createdAt: nowStamp() });
  return { status: 201, data: { ok: true } };
};

// =========================================================
// USUARIOS Y ROLES
// =========================================================
const listUsers: Handler = (ctx) => ctx.db.users.map((u) => publicUser(ctx.db, u));

const ensureRole = (ctx: HandlerContext, role: unknown): RoleId => {
  if (!ctx.db.roles.some((r) => r.id === role)) validationError({ role: 'Rol no válido.' });
  return role as RoleId;
};

const createUser: Handler = (ctx) => {
  const b = ctx.body;
  const email = lower(b.email);
  const errors: Record<string, string> = {};
  if (clean(b.firstName).length < 2) errors.firstName = 'Nombre obligatorio.';
  if (!EMAIL_RE.test(email)) errors.email = 'Correo no válido.';
  const problem = passwordProblems(String(b.password || ''), email);
  if (problem) errors.password = problem;
  check(errors);
  const role = ensureRole(ctx, b.role);
  if (role === 'super_admin' && ctx.user!.role !== 'super_admin') throw new ApiError(403, 'Solo un super administrador puede crear otro.');
  if (ctx.db.users.some((u) => u.email === email)) throw new ApiError(409, 'Ya existe un usuario con este correo.', { errors: { email: 'Correo repetido.' } });
  const { hash, salt } = hashPassword(b.password);
  const user: StoredUser = {
    id: uid('usr'),
    firstName: clean(b.firstName, 60),
    paternalLastName: clean(b.paternalLastName, 60),
    maternalLastName: clean(b.maternalLastName, 60),
    birthDate: clean(b.birthDate, 10),
    age: Number(b.age) || 0,
    phone: clean(b.phone, 20),
    email,
    regional: clean(b.regional, 60),
    role,
    status: 'active',
    passwordHash: hash,
    passwordSalt: salt,
    createdAt: nowStamp(),
  };
  ctx.db.users.push(user);
  return { status: 201, data: publicUser(ctx.db, user) };
};

const updateUser: Handler = (ctx) => {
  const u = findOr404(ctx.db.users, ctx.params.id, 'El usuario');
  const b = ctx.body;
  const self = u.id === ctx.user!.id;
  if (u.role === 'super_admin' && ctx.user!.role !== 'super_admin') throw new ApiError(403, 'No puedes modificar a un super administrador.');
  if (b.role !== undefined) {
    const role = ensureRole(ctx, b.role);
    if (self && role !== u.role) throw new ApiError(409, 'No puedes cambiar tu propio rol.');
    if (role === 'super_admin' && ctx.user!.role !== 'super_admin') throw new ApiError(403, 'Solo un super administrador puede asignar ese rol.');
    u.role = role;
  }
  if (b.status !== undefined) {
    if (!['active', 'disabled'].includes(b.status)) validationError({ status: 'Estado no válido.' });
    if (self && b.status === 'disabled') throw new ApiError(409, 'No puedes desactivar tu propia cuenta.');
    u.status = b.status;
    if (b.status === 'disabled') ctx.db.sessions = ctx.db.sessions.filter((s) => s.userId !== u.id);
  }
  if (b.email !== undefined) {
    const email = lower(b.email);
    if (!EMAIL_RE.test(email)) validationError({ email: 'Correo no válido.' });
    if (ctx.db.users.some((x) => x.id !== u.id && x.email === email)) throw new ApiError(409, 'Ya existe un usuario con este correo.');
    u.email = email;
  }
  (['firstName', 'paternalLastName', 'maternalLastName', 'phone', 'regional'] as const).forEach((k) => {
    if (b[k] !== undefined) (u as any)[k] = clean(b[k], 80);
  });
  if (b.password) {
    const problem = passwordProblems(String(b.password), u.email);
    if (problem) validationError({ password: problem });
    const { hash, salt } = hashPassword(b.password);
    u.passwordHash = hash;
    u.passwordSalt = salt;
    ctx.db.sessions = ctx.db.sessions.filter((s) => s.userId !== u.id);
  }
  return { status: 200, data: publicUser(ctx.db, u) };
};

const deleteUser: Handler = (ctx) => {
  const u = findOr404(ctx.db.users, ctx.params.id, 'El usuario');
  if (u.id === ctx.user!.id) throw new ApiError(409, 'No puedes eliminar tu propia cuenta.');
  if (u.role === 'super_admin') throw new ApiError(403, 'Un super administrador no se puede eliminar.');
  if (ctx.db.registrations.some((r) => r.userId === u.id)) {
    throw new ApiError(409, 'El usuario tiene inscripciones. Desactívalo en lugar de eliminarlo.');
  }
  ctx.db.users = ctx.db.users.filter((x) => x.id !== u.id);
  ctx.db.sessions = ctx.db.sessions.filter((s) => s.userId !== u.id);
  return { status: 200, data: { deleted: u.id } };
};

const listRoles: Handler = (ctx) =>
  ctx.db.roles.map((r) => ({ ...r, userCount: ctx.db.users.filter((u) => u.role === r.id).length }));

const updateRole: Handler = (ctx) => {
  const role = findOr404(ctx.db.roles, ctx.params.id, 'El rol');
  if (role.id === 'super_admin') throw new ApiError(409, 'Los permisos del super administrador no se pueden modificar.');
  const perms = ctx.body.permissions;
  if (!Array.isArray(perms) || perms.some((p: string) => !ALL_PERMISSIONS.includes(p as Permission))) {
    validationError({ permissions: 'Lista de permisos no válida.' });
  }
  if (role.id === 'campista' && perms.length) throw new ApiError(409, 'El rol campista no puede recibir permisos de administración.');
  role.permissions = perms;
  if (ctx.body.description !== undefined) role.description = clean(ctx.body.description, 200);
  return { status: 200, data: role };
};

// =========================================================
export const HANDLERS: Record<RouteId, Handler> = {
  login,
  register,
  refresh,
  logout,
  me,
  updateMe,
  changePassword,
  forgotPassword,
  resetPassword,
  health,
  listCamps,
  getCamp,
  listCourses,
  listChampionships,
  listTribes,
  getCatalogs,
  listEditions,
  getPaymentSettings,
  validateCoupon,
  createCamp,
  updateCamp,
  deleteCamp,
  featureCamp,
  createCourse,
  updateCourse,
  deleteCourse,
  createTribe,
  updateTribe,
  deleteTribe,
  createChampionship,
  updateChampionship,
  deleteChampionship,
  createCatalogItem,
  updateCatalogItem,
  deleteCatalogItem,
  myRegistrations,
  enroll,
  createRegistration,
  enrollCourse,
  dropCourse,
  listChampionshipEntries,
  myChampionshipEntries,
  createChampionshipEntry,
  cancelChampionshipEntry,
  resubmitEntryVoucher,
  removeTeamMember,
  getTeamInvite,
  joinTeam,
  approveEntryPayment,
  rejectEntryPayment,
  collectEntryPayment,
  listRegistrations,
  getRegistration,
  updateRegistration,
  deleteRegistration,
  resubmitVoucher,
  approvePayment,
  rejectPayment,
  collectPayment,
  updatePaymentSettings,
  listCheckins,
  createCheckin,
  listNotifications,
  readNotification,
  readAllNotifications,
  broadcastNotification,
  subscribePush,
  listUsers,
  createUser,
  updateUser,
  deleteUser,
  listRoles,
  updateRole,
};

