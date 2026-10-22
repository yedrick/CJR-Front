// =========================================================
// CATÁLOGO DE RUTAS DE LA API  (base: VITE_API_URL, ej. https://api.cjn.bo/api/v1)
//
// Es la fuente única de verdad del contrato frontend ↔ backend:
//  · los servicios (src/api/services) construyen las URLs desde aquí,
//  · el servidor simulado (src/api/mock) atiende exactamente estas rutas,
//  · el Explorador de API del panel las lista y permite probarlas.
//
// access:
//  'public'           → sin token
//  'auth'             → cualquier usuario autenticado (Bearer JWT)
//  Permission[]       → requiere alguno de esos permisos (si no → 403)
//  { own: ... }       → el dueño del recurso O alguno de los permisos
// =========================================================
import type { Permission } from '../auth/permissions';

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export type RouteAccess = 'public' | 'auth' | Permission[] | { own: true; or: Permission[] };

export interface ApiRoute {
  id: string;
  method: HttpMethod;
  path: string;
  access: RouteAccess;
  group: string;
  description: string;
  /** Ejemplo de cuerpo para el Explorador de API */
  sampleBody?: unknown;
  /** Códigos de error que puede devolver (además de 401/500) */
  errors?: number[];
}

const r = (
  id: string,
  method: HttpMethod,
  path: string,
  access: RouteAccess,
  group: string,
  description: string,
  extra: Partial<Pick<ApiRoute, 'sampleBody' | 'errors'>> = {}
): ApiRoute => ({ id, method, path, access, group, description, ...extra });

export const API_ROUTES = {
  // ── AUTENTICACIÓN ────────────────────────────────────
  login: r('login', 'POST', '/auth/login', 'public', 'Autenticación', 'Inicia sesión y devuelve access + refresh token (JWT).', {
    sampleBody: { email: 'admin@cjn.bo', password: 'Admin123*' },
    errors: [401, 403, 422, 429],
  }),
  register: r('register', 'POST', '/auth/register', 'public', 'Autenticación', 'Crea una cuenta de campista (el rol lo asigna el servidor).', {
    errors: [409, 422],
  }),
  refresh: r('refresh', 'POST', '/auth/refresh', 'public', 'Autenticación', 'Renueva el access token con el refresh token (rotación).', {
    errors: [401],
  }),
  logout: r('logout', 'POST', '/auth/logout', 'auth', 'Autenticación', 'Revoca el refresh token de la sesión.'),
  me: r('me', 'GET', '/auth/me', 'auth', 'Autenticación', 'Usuario autenticado con sus permisos.'),
  updateMe: r('updateMe', 'PATCH', '/auth/me', 'auth', 'Autenticación', 'Actualiza el perfil propio.', { errors: [409, 422] }),
  changePassword: r('changePassword', 'POST', '/auth/change-password', 'auth', 'Autenticación', 'Cambia la contraseña (cierra las demás sesiones).', {
    errors: [401, 422],
  }),
  forgotPassword: r('forgotPassword', 'POST', '/auth/forgot-password', 'public', 'Autenticación', 'Envía un código de recuperación (respuesta genérica).', {
    sampleBody: { email: 'sofia.morales@cjn.bo' },
    errors: [422, 429],
  }),
  resetPassword: r('resetPassword', 'POST', '/auth/reset-password', 'public', 'Autenticación', 'Restablece la contraseña con el código recibido.', {
    errors: [400, 422],
  }),

  // ── PÚBLICO ──────────────────────────────────────────
  health: r('health', 'GET', '/system/health', 'public', 'Sistema', 'Estado de la API.'),
  listCamps: r('listCamps', 'GET', '/camps', 'public', 'Campamentos', 'Lista de campamentos (los borradores solo con camps:read).'),
  getCamp: r('getCamp', 'GET', '/camps/:id', 'public', 'Campamentos', 'Detalle de un campamento.', { errors: [404] }),
  listCourses: r('listCourses', 'GET', '/courses', 'public', 'Talleres', 'Talleres (filtro ?campId=).'),
  listChampionships: r('listChampionships', 'GET', '/championships', 'public', 'Campeonatos', 'Campeonatos (filtro ?campId=).'),
  listTribes: r('listTribes', 'GET', '/tribes', 'public', 'Tribus', 'Las tribus del campamento.'),
  getCatalogs: r('getCatalogs', 'GET', '/catalogs', 'public', 'Catálogos', 'Ciudades, sub-directivas, regionales, áreas y tipos.'),
  listEditions: r('listEditions', 'GET', '/editions', 'public', 'Galería', 'Ediciones pasadas y galería.'),
  getPaymentSettings: r('getPaymentSettings', 'GET', '/payment-settings', 'public', 'Pagos', 'Métodos de pago habilitados.'),
  validateCoupon: r('validateCoupon', 'POST', '/coupons/validate', 'auth', 'Pagos', 'Valida un cupón de delegación.', {
    sampleBody: { code: 'GRUPO35-NACIONAL', campId: 'camp-2026-nacional', regional: 'POTOSI', groupSize: 35 },
    errors: [404, 422],
  }),

  // ── CAMPAMENTOS (admin) ──────────────────────────────
  createCamp: r('createCamp', 'POST', '/camps', ['camps:create'], 'Campamentos', 'Crea un campamento.', { errors: [403, 422] }),
  updateCamp: r('updateCamp', 'PUT', '/camps/:id', ['camps:update'], 'Campamentos', 'Actualiza un campamento.', { errors: [403, 404, 422] }),
  deleteCamp: r('deleteCamp', 'DELETE', '/camps/:id', ['camps:delete'], 'Campamentos', 'Elimina un campamento sin inscritos.', {
    errors: [403, 404, 409],
  }),
  featureCamp: r('featureCamp', 'POST', '/camps/:id/feature', ['camps:update'], 'Campamentos', 'Marca el campamento activo (portada).', {
    errors: [403, 404, 409],
  }),

  // ── TALLERES ─────────────────────────────────────────
  createCourse: r('createCourse', 'POST', '/courses', ['courses:create'], 'Talleres', 'Crea un taller.', { errors: [403, 404, 422] }),
  updateCourse: r('updateCourse', 'PUT', '/courses/:id', ['courses:update'], 'Talleres', 'Actualiza un taller.', { errors: [403, 404, 409, 422] }),
  deleteCourse: r('deleteCourse', 'DELETE', '/courses/:id', ['courses:delete'], 'Talleres', 'Elimina un taller (lo quita de las inscripciones).', {
    errors: [403, 404],
  }),

  // ── TRIBUS ───────────────────────────────────────────
  createTribe: r('createTribe', 'POST', '/tribes', ['tribes:create'], 'Tribus', 'Crea una tribu.', { errors: [403, 409, 422] }),
  updateTribe: r('updateTribe', 'PUT', '/tribes/:id', ['tribes:update'], 'Tribus', 'Actualiza una tribu.', { errors: [403, 404, 409] }),
  deleteTribe: r('deleteTribe', 'DELETE', '/tribes/:id', ['tribes:delete'], 'Tribus', 'Elimina una tribu sin integrantes.', { errors: [403, 404, 409] }),

  // ── CAMPEONATOS ──────────────────────────────────────
  createChampionship: r('createChampionship', 'POST', '/championships', ['championships:create'], 'Campeonatos', 'Crea un campeonato.', {
    errors: [403, 422],
  }),
  updateChampionship: r('updateChampionship', 'PUT', '/championships/:id', ['championships:update'], 'Campeonatos', 'Actualiza un campeonato.', {
    errors: [403, 404],
  }),
  deleteChampionship: r('deleteChampionship', 'DELETE', '/championships/:id', ['championships:delete'], 'Campeonatos', 'Elimina un campeonato.', {
    errors: [403, 404],
  }),

  // ── CATÁLOGOS ────────────────────────────────────────
  createCatalogItem: r('createCatalogItem', 'POST', '/catalogs/:kind', ['catalogs:create'], 'Catálogos', 'Crea un elemento (cities, subdirectivas, regionales, serviceAreas, campTypes).', {
    errors: [403, 404, 409, 422],
  }),
  updateCatalogItem: r('updateCatalogItem', 'PUT', '/catalogs/:kind/:id', ['catalogs:update'], 'Catálogos', 'Actualiza un elemento del catálogo.', {
    errors: [403, 404, 409],
  }),
  deleteCatalogItem: r('deleteCatalogItem', 'DELETE', '/catalogs/:kind/:id', ['catalogs:delete'], 'Catálogos', 'Elimina un elemento (en cascada).', {
    errors: [403, 404, 409],
  }),

  // ── INSCRIPCIÓN EN UN SOLO PASO (cuenta + campamento) ─
  enroll: r('enroll', 'POST', '/enrollments', 'public', 'Inscripciones', 'Compra del campamento en un solo paso: crea la cuenta (si no hay sesión) y la inscripción.', {
    errors: [404, 409, 413, 422, 429],
  }),

  // ── INSCRIPCIONES ────────────────────────────────────
  myRegistrations: r('myRegistrations', 'GET', '/me/registrations', 'auth', 'Inscripciones', 'Inscripciones (entradas) del usuario autenticado.'),
  createRegistration: r('createRegistration', 'POST', '/registrations', 'auth', 'Inscripciones', 'Inscribe al usuario en un campamento y emite su credencial.', {
    errors: [404, 409, 413, 422],
  }),
  listRegistrations: r('listRegistrations', 'GET', '/registrations', ['registrations:read', 'payments:read'], 'Inscripciones', 'Todas las inscripciones (filtro ?campId=).'),
  getRegistration: r('getRegistration', 'GET', '/registrations/:id', { own: true, or: ['registrations:read'] }, 'Inscripciones', 'Detalle de una inscripción.', {
    errors: [403, 404],
  }),
  updateRegistration: r('updateRegistration', 'PATCH', '/registrations/:id', ['registrations:update'], 'Inscripciones', 'Edita datos, tribu o talleres.', {
    errors: [403, 404, 409, 422],
  }),
  deleteRegistration: r('deleteRegistration', 'DELETE', '/registrations/:id', ['registrations:delete'], 'Inscripciones', 'Elimina una inscripción y libera cupos.', {
    errors: [403, 404],
  }),
  enrollCourse: r('enrollCourse', 'POST', '/registrations/:id/courses', { own: true, or: ['registrations:update'] }, 'Talleres', 'Inscribe al joven en un taller (requiere pago confirmado y ventana abierta).', {
    sampleBody: { courseId: 'c-101' },
    errors: [403, 404, 409, 422],
  }),
  dropCourse: r('dropCourse', 'DELETE', '/registrations/:id/courses/:courseId', { own: true, or: ['registrations:update'] }, 'Talleres', 'Retira al joven de un taller (antes del cierre).', {
    errors: [403, 404, 409],
  }),
  resubmitVoucher: r('resubmitVoucher', 'POST', '/registrations/:id/voucher', { own: true, or: ['payments:verify'] }, 'Pagos', 'Reenvía un comprobante rechazado.', {
    errors: [403, 404, 409, 413, 422],
  }),

  // ── PAGOS ────────────────────────────────────────────
  approvePayment: r('approvePayment', 'POST', '/payments/:registrationId/approve', ['payments:verify'], 'Pagos', 'Aprueba el comprobante.', {
    errors: [403, 404, 409],
  }),
  rejectPayment: r('rejectPayment', 'POST', '/payments/:registrationId/reject', ['payments:verify'], 'Pagos', 'Rechaza el comprobante con motivo.', {
    errors: [403, 404, 409, 422],
  }),
  collectPayment: r('collectPayment', 'POST', '/payments/:registrationId/collect', ['payments:collect'], 'Pagos', 'Registra el cobro en caja.', {
    errors: [403, 404, 409],
  }),
  updatePaymentSettings: r('updatePaymentSettings', 'PUT', '/payment-settings', ['payment_settings:update'], 'Pagos', 'Configura los métodos de pago.', {
    errors: [403, 422],
  }),

  // ── CAMPEONATOS: INSCRIPCIONES, EQUIPOS Y PAGOS EXTRA ─
  listChampionshipEntries: r('listChampionshipEntries', 'GET', '/championship-entries', ['registrations:read', 'payments:read', 'championships:update'], 'Campeonatos', 'Inscripciones y equipos de los campeonatos (filtro ?campId=).'),
  myChampionshipEntries: r('myChampionshipEntries', 'GET', '/me/championship-entries', 'auth', 'Campeonatos', 'Campeonatos y equipos del usuario.'),
  createChampionshipEntry: r('createChampionshipEntry', 'POST', '/championship-entries', 'auth', 'Campeonatos', 'Inscripción individual o creación de equipo, con su pago extra.', {
    errors: [403, 404, 409, 413, 422],
  }),
  cancelChampionshipEntry: r('cancelChampionshipEntry', 'DELETE', '/championship-entries/:id', { own: true, or: ['championships:update'] }, 'Campeonatos', 'Anula una inscripción a campeonato (sin pago confirmado).', {
    errors: [403, 404, 409],
  }),
  resubmitEntryVoucher: r('resubmitEntryVoucher', 'POST', '/championship-entries/:id/voucher', { own: true, or: ['payments:verify'] }, 'Campeonatos', 'Reenvía el comprobante del pago extra.', {
    errors: [403, 404, 409, 413, 422],
  }),
  removeTeamMember: r('removeTeamMember', 'DELETE', '/championship-entries/:id/members/:registrationId', { own: true, or: ['championships:update'] }, 'Campeonatos', 'El capitán quita a un integrante (o el integrante sale del equipo).', {
    errors: [403, 404, 409],
  }),
  getTeamInvite: r('getTeamInvite', 'GET', '/teams/:code', 'public', 'Campeonatos', 'Datos públicos del equipo del enlace de invitación.', { errors: [404] }),
  joinTeam: r('joinTeam', 'POST', '/teams/:code/join', 'auth', 'Campeonatos', 'Une al joven al equipo con el código de invitación.', {
    errors: [403, 404, 409],
  }),
  approveEntryPayment: r('approveEntryPayment', 'POST', '/championship-entries/:id/approve', ['payments:verify'], 'Pagos', 'Aprueba el pago extra de un campeonato.', {
    errors: [403, 404, 409],
  }),
  rejectEntryPayment: r('rejectEntryPayment', 'POST', '/championship-entries/:id/reject', ['payments:verify'], 'Pagos', 'Rechaza el comprobante del pago extra.', {
    errors: [403, 404, 409, 422],
  }),
  collectEntryPayment: r('collectEntryPayment', 'POST', '/championship-entries/:id/collect', ['payments:collect'], 'Pagos', 'Cobra en caja el pago extra.', {
    errors: [403, 404, 409],
  }),

  // ── CONTROL DE ACCESO ────────────────────────────────
  listCheckins: r('listCheckins', 'GET', '/checkins', ['checkins:read'], 'Control de acceso', 'Ingresos registrados (filtro ?campId=).'),
  createCheckin: r('createCheckin', 'POST', '/checkins', ['checkins:create'], 'Control de acceso', 'Registra un ingreso con la credencial.', {
    errors: [403, 404, 409],
  }),

  // ── NOTIFICACIONES ───────────────────────────────────
  listNotifications: r('listNotifications', 'GET', '/notifications', 'auth', 'Notificaciones', 'Notificaciones del usuario.'),
  readNotification: r('readNotification', 'PATCH', '/notifications/:id/read', 'auth', 'Notificaciones', 'Marca una notificación como leída.', {
    errors: [403, 404],
  }),
  readAllNotifications: r('readAllNotifications', 'POST', '/notifications/read-all', 'auth', 'Notificaciones', 'Marca todas como leídas.'),
  broadcastNotification: r('broadcastNotification', 'POST', '/notifications/broadcast', ['notifications:send'], 'Notificaciones', 'Envía un aviso a los inscritos.', {
    sampleBody: { title: 'Recordatorio', body: 'Mañana salimos a las 7:00', campId: 'camp-2026-nacional', audience: 'campers' },
    errors: [403, 422],
  }),
  subscribePush: r('subscribePush', 'POST', '/notifications/push-subscriptions', 'auth', 'Notificaciones', 'Registra la suscripción Web Push del dispositivo.'),

  // ── USUARIOS Y ROLES ─────────────────────────────────
  listUsers: r('listUsers', 'GET', '/users', ['users:read'], 'Usuarios', 'Lista de usuarios.'),
  createUser: r('createUser', 'POST', '/users', ['users:create'], 'Usuarios', 'Crea un usuario del equipo con un rol.', { errors: [403, 409, 422] }),
  updateUser: r('updateUser', 'PATCH', '/users/:id', ['users:update'], 'Usuarios', 'Edita un usuario o cambia su rol/estado.', {
    errors: [403, 404, 409, 422],
  }),
  deleteUser: r('deleteUser', 'DELETE', '/users/:id', ['users:delete'], 'Usuarios', 'Elimina un usuario.', { errors: [403, 404, 409] }),
  listRoles: r('listRoles', 'GET', '/roles', ['roles:read', 'users:read'], 'Usuarios', 'Roles y sus permisos.'),
  updateRole: r('updateRole', 'PUT', '/roles/:id', ['roles:update'], 'Usuarios', 'Cambia los permisos de un rol.', { errors: [403, 404, 409] }),
} satisfies Record<string, ApiRoute>;

export type RouteId = keyof typeof API_ROUTES;
export const ROUTE_LIST: ApiRoute[] = Object.values(API_ROUTES);

/** Reemplaza :params en la ruta. */
export function buildPath(path: string, params: Record<string, string | number> = {}): string {
  return path.replace(/:([A-Za-z]+)/g, (_, key) => {
    if (params[key] === undefined) throw new Error(`Falta el parámetro "${key}" para ${path}`);
    return encodeURIComponent(String(params[key]));
  });
}

/** Devuelve los params si la ruta coincide con el patrón. */
export function matchPath(pattern: string, path: string): Record<string, string> | null {
  const p = pattern.split('/').filter(Boolean);
  const a = path.split('/').filter(Boolean);
  if (p.length !== a.length) return null;
  const params: Record<string, string> = {};
  for (let i = 0; i < p.length; i++) {
    if (p[i].startsWith(':')) params[p[i].slice(1)] = decodeURIComponent(a[i]);
    else if (p[i] !== a[i]) return null;
  }
  return params;
}

export function describeAccess(access: RouteAccess): string {
  if (access === 'public') return 'Pública';
  if (access === 'auth') return 'Usuario autenticado';
  if (Array.isArray(access)) return access.join(' · ');
  return `Dueño o ${access.or.join(' · ')}`;
}
