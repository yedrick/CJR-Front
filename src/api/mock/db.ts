// Base de datos del servidor SIMULADO: vive en memoria y se persiste en localStorage.
// Los datos de ejemplo (src/data/initialData.ts) SOLO se usan aquí como semilla;
// ningún componente los importa: todo llega por la API.
import type {
  AppNotification,
  Camp,
  CampCourse,
  CamperRegistration,
  Catalogs,
  Championship,
  ChampionshipEntry,
  CheckInLog,
  GroupCoupon,
  PastCampEdition,
  PaymentSettings,
  StoredUser,
  TribeGroup,
} from '../../types/camp';
import { DEFAULT_ROLES, Role, RoleId } from '../../auth/permissions';
import {
  FIXED_12_TRIBES,
  INITIAL_CAMPS,
  INITIAL_CATALOGS,
  INITIAL_CHAMPIONSHIPS,
  INITIAL_CHECKINS,
  INITIAL_COURSES,
  INITIAL_PAYMENT_SETTINGS,
  INITIAL_REGISTRATIONS,
  PAST_CAMP_EDITIONS,
  VALID_GROUP_COUPONS,
} from '../../data/initialData';
import { hashPassword } from './crypto';
import { DEMO_ACCOUNTS } from './demoAccounts';

export interface Session {
  id: string;
  userId: string;
  refreshToken: string;
  expiresAt: number;
  createdAt: number;
  userAgent: string;
}

export interface MockDb {
  version: number;
  users: StoredUser[];
  roles: Role[];
  sessions: Session[];
  camps: Camp[];
  catalogs: Catalogs;
  courses: CampCourse[];
  tribes: TribeGroup[];
  championships: Championship[];
  registrations: CamperRegistration[];
  championshipEntries: ChampionshipEntry[];
  checkins: CheckInLog[];
  paymentSettings: PaymentSettings;
  notifications: AppNotification[];
  editions: PastCampEdition[];
  coupons: GroupCoupon[];
  resetCodes: { email: string; code: string; expiresAt: number; attempts: number }[];
  loginAttempts: Record<string, { count: number; firstAt: number; lockedUntil?: number }>;
  rateLimits: Record<string, number[]>;
  pushSubscriptions: { userId: string; endpoint: string; createdAt: string }[];
}

const DB_KEY = 'cjn_mock_db_v1';
const DB_VERSION = 2;

/** Datos personales de los jóvenes de las inscripciones de ejemplo que no tienen usuario. */
const EXTRA_CAMPERS: { id: string; email: string; firstName: string; paternalLastName: string; maternalLastName: string; phone: string; regional: string; birthDate: string }[] = [
  { id: 'usr-client-04', email: 'diego.condori@cjn.bo', firstName: 'Diego', paternalLastName: 'Condori', maternalLastName: 'Choque', phone: '+591 78945612', regional: 'EL ALTO', birthDate: '2006-07-22' },
  { id: 'usr-client-05', email: 'valeria.huanca@cjn.bo', firstName: 'Valeria', paternalLastName: 'Huanca', maternalLastName: 'Mamani', phone: '+591 71234567', regional: 'ORURO', birthDate: '2009-02-11' },
  { id: 'usr-client-06', email: 'lucia.quispe@cjn.bo', firstName: 'Lucía', paternalLastName: 'Quispe', maternalLastName: 'Rojas', phone: '+591 72233445', regional: 'VALLE ALTO', birthDate: '2005-11-02' },
  { id: 'usr-client-07', email: 'jorge.mamani@cjn.bo', firstName: 'Jorge', paternalLastName: 'Mamani', maternalLastName: 'Cruz', phone: '+591 73344556', regional: 'CHALLAPATA', birthDate: '2004-04-18' },
];

const ageFrom = (birth: string) => {
  const b = new Date(birth);
  const t = new Date();
  let a = t.getFullYear() - b.getFullYear();
  if (t.getMonth() < b.getMonth() || (t.getMonth() === b.getMonth() && t.getDate() < b.getDate())) a--;
  return a;
};

function seedUsers(): StoredUser[] {
  const users: StoredUser[] = [];
  const add = (u: Omit<StoredUser, 'passwordHash' | 'passwordSalt' | 'status' | 'createdAt'> & { password: string }) => {
    const { hash, salt } = hashPassword(u.password);
    const { password: _pw, ...rest } = u;
    users.push({ ...rest, passwordHash: hash, passwordSalt: salt, status: 'active', createdAt: '2026-01-02 09:00' });
  };
  DEMO_ACCOUNTS.forEach((acc) =>
    add({
      id: acc.id,
      email: acc.email,
      password: acc.password,
      role: acc.role as RoleId,
      firstName: acc.firstName,
      paternalLastName: acc.paternalLastName,
      maternalLastName: acc.maternalLastName,
      phone: acc.phone,
      regional: acc.regional,
      birthDate: acc.birthDate,
      age: ageFrom(acc.birthDate),
    })
  );
  EXTRA_CAMPERS.forEach((c) => add({ ...c, password: 'Campista123*', role: 'campista', age: ageFrom(c.birthDate) }));
  return users;
}

// Modalidad de cada campeonato de ejemplo: los deportes de conjunto se juegan por equipos
const TEAM_SPORTS: Record<string, [number, number]> = {
  'champ-fut-varones': [7, 12],
  'champ-futsal-damas': [5, 10],
  'champ-basket-varones': [5, 10],
  'champ-basket-damas': [5, 10],
  'champ-voley-varones': [6, 10],
  'champ-voley-damas': [6, 10],
  'champ-coro': [6, 20],
};

function seedChampionships(): Championship[] {
  return INITIAL_CHAMPIONSHIPS.map((c) => {
    const team = TEAM_SPORTS[c.id];
    return {
      ...c,
      mode: (team ? 'team' : 'individual') as Championship['mode'],
      minTeamSize: team?.[0],
      maxTeamSize: team?.[1],
      registrationFee: team ? c.registrationFee * 4 : c.registrationFee,
      registrationClosesAt: '2026-10-25',
    };
  });
}

/** Talleres: ventana de inscripción para jóvenes con pago confirmado. */
function seedCourses(): CampCourse[] {
  return INITIAL_COURSES.map((c) => {
    if (c.id === 'c-107') return { ...c, enrollmentOpensAt: '2026-10-20T08:00', enrollmentClosesAt: '2026-10-27T20:00' };
    if (c.campId === 'camp-2026-nacional') return { ...c, enrollmentOpensAt: '2026-10-01T00:00', enrollmentClosesAt: '2026-10-25T23:59' };
    return c;
  });
}

const paid = (amount: number, folio: string): ChampionshipEntry['payment'] => ({
  amount,
  method: 'qr_bank',
  status: 'completed',
  verifiedAt: '2026-10-11 10:00',
  verifiedBy: 'Pasarela bancaria',
  folio,
});

function seedEntries(regs: CamperRegistration[]): ChampionshipEntry[] {
  const member = (id: string, role: 'captain' | 'member') => {
    const r = regs.find((x) => x.id === id)!;
    return { registrationId: r.id, userId: r.userId, fullName: r.fullName, tribeId: r.tribeId, role, joinedAt: r.registeredAt };
  };
  return [
    {
      id: 'ent-001',
      championshipId: 'champ-romanos',
      campId: 'camp-2026-nacional',
      type: 'individual',
      captainRegistrationId: 'CMP-2026-1042',
      captainUserId: 'usr-client-01',
      members: [member('CMP-2026-1042', 'captain')],
      status: 'confirmed',
      payment: paid(20, 'QR-X-100201'),
      createdAt: '2026-10-11 10:00',
    },
    {
      id: 'ent-002',
      championshipId: 'champ-futsal-damas',
      campId: 'camp-2026-nacional',
      type: 'team',
      captainRegistrationId: 'CMP-2026-1042',
      captainUserId: 'usr-client-01',
      teamName: 'Leonas de Potosí',
      inviteCode: 'LEONAS26',
      members: [member('CMP-2026-1042', 'captain')],
      status: 'confirmed',
      payment: paid(160, 'QR-X-100202'),
      createdAt: '2026-10-11 10:05',
    },
    {
      id: 'ent-003',
      championshipId: 'champ-fut-varones',
      campId: 'camp-2026-nacional',
      type: 'team',
      captainRegistrationId: 'CMP-2026-2184',
      captainUserId: 'usr-client-02',
      teamName: 'Cochabamba FC',
      inviteCode: 'COCHAFC7',
      members: [member('CMP-2026-2184', 'captain')],
      status: 'pending_payment',
      payment: {
        amount: 200,
        method: 'transfer',
        status: 'pending_verification',
        voucherReferenceNumber: '20261012-554410',
        voucherUploadedAt: '2026-10-12 18:30',
        folio: 'EXT-554410',
      },
      createdAt: '2026-10-12 18:30',
    },
  ];
}

/** Las inscripciones sin pago confirmado todavía no tienen talleres ni campeonatos. */
const SEED_GENDER: Record<string, 'M' | 'F'> = {
  'usr-client-01': 'F',
  'usr-client-02': 'M',
  'usr-client-04': 'M',
  'usr-client-05': 'F',
  'usr-client-06': 'F',
  'usr-client-07': 'M',
};

function seedRegistrations(entries: ChampionshipEntry[]): CamperRegistration[] {
  return INITIAL_REGISTRATIONS.map((r) => ({
    ...r,
    gender: SEED_GENDER[r.userId],
    enrolledCourseIds: r.payment.status === 'completed' ? r.enrolledCourseIds : [],
    enrolledChampionshipIds: entries
      .filter((e) => e.status !== 'cancelled' && e.members.some((m) => m.registrationId === r.id))
      .map((e) => e.championshipId),
    championshipsStatus: undefined,
  }));
}

function seed(): MockDb {
  const entries = seedEntries(INITIAL_REGISTRATIONS);
  return {
    version: DB_VERSION,
    users: seedUsers(),
    roles: DEFAULT_ROLES.map((r) => ({ ...r, permissions: [...r.permissions] })),
    sessions: [],
    camps: INITIAL_CAMPS,
    catalogs: INITIAL_CATALOGS,
    courses: seedCourses(),
    tribes: FIXED_12_TRIBES,
    championships: seedChampionships(),
    registrations: seedRegistrations(entries),
    championshipEntries: entries,
    checkins: INITIAL_CHECKINS,
    paymentSettings: INITIAL_PAYMENT_SETTINGS,
    notifications: [
      {
        id: 'ntf-seed-1',
        userId: 'usr-client-01',
        type: 'payment_approved',
        title: 'Pago confirmado',
        body: 'Tu inscripción al Campamento Nacional CJN 2026 está confirmada. ¡Te esperamos!',
        link: '/mis-inscripciones',
        read: false,
        createdAt: '2026-10-10 14:25',
      },
      {
        id: 'ntf-seed-2',
        userId: 'usr-client-07',
        type: 'payment_rejected',
        title: 'Comprobante rechazado',
        body: 'Monto incorrecto: se transfirió 400 Bs y el campamento cuesta 450 Bs. Sube un nuevo comprobante.',
        link: '/mis-inscripciones',
        read: false,
        createdAt: '2026-10-14 11:20',
      },
    ],
    editions: PAST_CAMP_EDITIONS,
    coupons: VALID_GROUP_COUPONS,
    resetCodes: [],
    loginAttempts: {},
    rateLimits: {},
    pushSubscriptions: [],
  };
}

let db: MockDb | null = null;

export function getDb(): MockDb {
  if (db) return db;
  try {
    const raw = localStorage.getItem(DB_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as MockDb;
      if (parsed.version === DB_VERSION) {
        db = parsed;
        return db;
      }
    }
  } catch {
    /* datos corruptos: se vuelve a sembrar */
  }
  db = structuredClone(seed());
  persist();
  return db;
}

let persistTimer: ReturnType<typeof setTimeout> | undefined;
let dirty = false;

function flush() {
  clearTimeout(persistTimer);
  if (!dirty || !db) return;
  dirty = false;
  try {
    localStorage.setItem(DB_KEY, JSON.stringify(db));
  } catch (e) {
    console.warn('[mock-api] No se pudo guardar la base simulada (¿cuota llena?)', e);
  }
}

/** Guarda la base (agrupando escrituras seguidas); se vacía siempre antes de cerrar o recargar la página. */
export function persist() {
  dirty = true;
  clearTimeout(persistTimer);
  persistTimer = setTimeout(flush, 30);
}

if (typeof window !== 'undefined') {
  window.addEventListener('pagehide', flush);
  document.addEventListener('visibilitychange', () => document.visibilityState === 'hidden' && flush());
}

/** Restablece la base simulada a los datos de ejemplo. */
export function resetDb() {
  db = structuredClone(seed());
  try {
    localStorage.setItem(DB_KEY, JSON.stringify(db));
  } catch {
    /* ignorar */
  }
}
