import type { Permission, RoleId } from '../auth/permissions';

export type Gender = 'M' | 'F';

// Las regionales ahora son un catálogo administrable (CRUD), por eso es un string libre.
export type CJRRegional = string;

export interface User {
  id: string;
  firstName: string;
  paternalLastName: string;
  maternalLastName: string;
  birthDate: string;
  age: number;
  phone: string; // WhatsApp
  email: string;
  regional: CJRRegional;
  city?: string;
  subdirectivaNumber?: string;
  churchCongregation?: string;
  serviceAreaOfInterest?: string;
  idExpedition?: string;
  documentId?: string;
  /** Sexo (para las categorías Varonil / Femenil de los campeonatos). */
  gender?: Gender;
  role: RoleId;
  /** Permisos efectivos (los envía la API según el rol). */
  permissions: Permission[];
  status: 'active' | 'disabled';
  lastLoginAt?: string;
  createdAt: string;
}

/** Usuario almacenado en el servidor (incluye el hash de la contraseña; nunca se envía al frontend). */
export interface StoredUser extends Omit<User, 'permissions'> {
  passwordHash: string;
  passwordSalt: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  /** segundos de vida del access token */
  expiresIn: number;
  tokenType: 'Bearer';
}

export type NotificationType =
  | 'registration_created'
  | 'payment_approved'
  | 'payment_rejected'
  | 'payment_collected'
  | 'voucher_submitted'
  | 'announcement'
  | 'system';

export interface AppNotification {
  id: string;
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  /** ruta interna a abrir al tocar la notificación, ej. /mis-inscripciones */
  link?: string;
  read: boolean;
  createdAt: string;
}

// =========================================================
// CAMPAMENTOS (varios por año: 15 o más)
// =========================================================

/** Estado administrativo del campamento. La fase (próximo / en curso / finalizado) se calcula por fechas. */
export type CampStatus = 'borrador' | 'abierto' | 'cerrado';

export interface Camp {
  id: string;
  name: string;
  typeId: string; // catálogo de tipos de campamento
  theme?: string; // lema
  verse?: string;
  description: string; // detalle
  price: number; // Bs (tarifa individual)
  groupPrice?: number; // Bs (tarifa con cupón de delegación)
  cashAdvancePercent: number; // % de adelanto si paga en efectivo
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  location: string;
  cityId?: string;
  imageUrl: string;
  capacity: number;
  minAge: number;
  maxAge: number;
  maxCoursesPerCamper: number;
  includes: string[];
  status: CampStatus;
  isFeatured: boolean; // campamento activo (el que se muestra en portada e inscripción)
  createdAt: string;
}

export type CampPhase = 'borrador' | 'proximo' | 'abierto' | 'cerrado' | 'en_curso' | 'finalizado';

// =========================================================
// CATÁLOGOS ADMINISTRABLES
// =========================================================

export interface City {
  id: string;
  name: string;
}

export interface Subdirectiva {
  id: string;
  name: string;
  cityId: string;
}

export interface RegionalItem {
  id: string;
  name: string;
  subdirectivaId: string;
}

export interface ServiceArea {
  id: string;
  name: string;
}

export interface CampType {
  id: string;
  name: string;
  colorHex: string;
}

export interface Catalogs {
  cities: City[];
  subdirectivas: Subdirectiva[];
  regionales: RegionalItem[];
  serviceAreas: ServiceArea[];
  campTypes: CampType[];
}

export type CatalogKind = keyof Catalogs;

// =========================================================
// TALLERES (cada taller pertenece a un campamento)
// =========================================================

/** 'all_days' = se dicta todos los días del campamento; 'single_day' = un solo día. */
export type CourseScheduleType = 'all_days' | 'single_day';

export interface CampCourse {
  id: string;
  campId: string;
  title: string;
  category: string;
  scheduleType: CourseScheduleType;
  date?: string; // YYYY-MM-DD cuando scheduleType = 'single_day'
  fullDay: boolean; // jornada completa (todo el día)
  startTime: string; // HH:mm
  endTime: string; // HH:mm
  location: string;
  instructor: string;
  instructorRole?: string;
  instructorPhotoUrl?: string;
  instructorBio?: string;
  coverImageUrl?: string;
  maxCapacity: number;
  enrolledCount: number;
  description: string;
  minAge: number;
  maxAge: number;
  /**
   * Ventana en la que los jóvenes CON PAGO CONFIRMADO pueden inscribirse al taller
   * (formato YYYY-MM-DDTHH:mm, hora local). Vacío = abierto mientras haya cupo.
   */
  enrollmentOpensAt?: string;
  enrollmentClosesAt?: string;
}

/** individual = cada joven compite solo; team = un capitán arma un equipo e invita con un enlace. */
export type ChampionshipMode = 'individual' | 'team';

export interface Championship {
  id: string;
  /** Cada campeonato pertenece a un campamento (obligatorio). */
  campId: string;
  name: string;
  sport: string;
  genderCategory: 'Varonil' | 'Femenil' | 'Mixto';
  mode: ChampionshipMode;
  /** Integrantes por equipo (solo mode = team; incluye al capitán). */
  minTeamSize?: number;
  maxTeamSize?: number;
  /** Costo extra en Bs: por persona (individual) o por equipo (team). 0 = gratis. */
  registrationFee: number;
  description: string;
  /** Cupo: participantes (individual) o equipos (team). */
  maxTeamsOrParticipants: number;
  /** Inscripciones activas (lo calcula el servidor). */
  enrolledTeamsCount: number;
  prizeSummary: string;
  schedule: string;
  imageUrl?: string;
  /** Fecha límite para inscribirse (YYYY-MM-DD). */
  registrationClosesAt?: string;
}

/** Pago extra de una actividad (campeonato) después de la inscripción al campamento. */
export interface ExtraPayment {
  amount: number;
  method: 'qr_bank' | 'transfer' | 'cash_box' | 'free';
  status: 'completed' | 'pending_verification' | 'pending_cash' | 'rejected';
  voucherImageUrl?: string;
  voucherReferenceNumber?: string;
  voucherUploadedAt?: string;
  rejectionReason?: string;
  verifiedBy?: string;
  verifiedAt?: string;
  collectedBy?: string;
  collectedAt?: string;
  folio: string;
}

export interface TeamMember {
  registrationId: string;
  userId: string;
  fullName: string;
  tribeId?: string;
  role: 'captain' | 'member';
  joinedAt: string;
}

/** Inscripción a un campeonato: individual o un equipo completo. */
export interface ChampionshipEntry {
  id: string;
  championshipId: string;
  campId: string;
  type: ChampionshipMode;
  captainRegistrationId: string;
  captainUserId: string;
  teamName?: string;
  /** Código del enlace de invitación (solo equipos). */
  inviteCode?: string;
  members: TeamMember[];
  status: 'pending_payment' | 'confirmed' | 'cancelled';
  payment: ExtraPayment;
  createdAt: string;
}

/** Vista pública de un equipo (para la página del enlace de invitación). */
export interface TeamInvite {
  inviteCode: string;
  teamName: string;
  entryStatus: ChampionshipEntry['status'];
  championship: Pick<Championship, 'id' | 'name' | 'sport' | 'genderCategory' | 'schedule' | 'imageUrl' | 'minTeamSize' | 'maxTeamSize'>;
  camp: { id: string; name: string; startDate: string; endDate: string; location: string };
  captainName: string;
  members: { fullName: string; role: TeamMember['role'] }[];
  slotsLeft: number;
}

export interface TribeGroup {
  id: string;
  number: number;
  name: string;
  colorHex: string;
  animalSymbol: string;
  leaderName: string;
  motto: string;
  accentBg: string;
}

export interface PaymentTransaction {
  id: string;
  registrationId: string;
  camperName: string;
  baseCampFee: number; // in Bs
  coursesFees: number; // in Bs
  championshipsFees: number; // in Bs
  discountAmount: number; // in Bs
  couponCodeApplied?: string;
  totalAmount: number; // in Bs
  advanceAmount?: number;
  remainingBalance?: number;
  currency: 'Bs' | 'USD';
  date: string;
  status: 'completed' | 'pending_cash' | 'pending_verification' | 'rejected' | 'refunded';
  paymentMethod: 'qr_bank' | 'transfer' | 'cash_box';
  voucherImageUrl?: string;
  voucherFileName?: string;
  voucherUploadedAt?: string;
  voucherReferenceNumber?: string;
  webhookReceivedAt?: string;
  webhookPayload?: Record<string, any>;
  verifiedAt?: string;
  verifiedBy?: string;
  cashierCollectedBy?: string;
  cashierCollectedAt?: string;
  rejectionReason?: string;
  rejectedAt?: string;
  rejectedBy?: string;
  /** Historial de comprobantes enviados (cuando un pago se rechaza y se reenvía). */
  voucherHistory?: { imageUrl?: string; reference?: string; uploadedAt: string; status: 'rejected'; reason?: string }[];
  transactionFolio: string;
}

export interface CheckInLog {
  id: string;
  campId: string;
  registrationId: string;
  camperName: string;
  courseId: string;
  courseTitle: string;
  timestamp: string;
  type: 'GATE_ENTRY' | 'COURSE_ATTENDANCE' | 'CHAMPIONSHIP_CHECKIN';
  verifiedBy: string;
}

/** Inscripción = "entrada" del joven a un campamento. Guarda su credencial. */
export interface CamperRegistration {
  id: string;
  campId: string;
  ticketCode: string; // código de credencial / entrada
  userId: string;
  qrPayload: string;
  fullName: string;
  firstName: string;
  paternalLastName: string;
  maternalLastName: string;
  birthDate: string;
  age: number;
  gender?: Gender;
  documentId: string;
  idExpedition?: string;
  phone: string; // WhatsApp
  email: string;
  city?: string;
  regional: CJRRegional;
  churchCongregation?: string;
  subdirectivaNumber?: string;
  serviceAreaOfInterest?: string;
  delegateRole?: string;
  isDelegate?: boolean;
  championshipsStatus?: 'pending_payment' | 'confirmed';
  emergencyContactName?: string;
  emergencyPhone?: string;
  tribeId: string;
  enrolledCourseIds: string[];
  enrolledChampionshipIds: string[];
  groupSize: number;
  payment: PaymentTransaction;
  status: 'active' | 'pending_payment' | 'cancelled';
  registeredAt: string;
}

export interface EditionPhoto {
  id: string;
  url: string;
  title: string;
  category: 'Adoración y Fogata' | 'Talleres y Liderazgo' | 'Desafíos de Tribus' | 'Campeonatos' | 'Comunión y Paisajes';
  aspectRatio?: string;
}

export interface PastCampEdition {
  year: number;
  name: string;
  editionTagline?: string;
  location: string;
  participantsCount: number;
  theme: string;
  scriptureVerse?: string;
  quote: string;
  summary: string;
  highlights: string[];
  coverGradient: string;
  imageUrl?: string;
  photoCount: number;
  videoDuration: string;
  photoGallery?: EditionPhoto[];
}

export interface GroupCoupon {
  code: string;
  requiredGroupSize: number;
  allowedRegionals: CJRRegional[]; // vacío = todas
  discountedPricePerPerson: number; // se usa si el campamento no define groupPrice
  description: string;
  isActive: boolean;
}

export type ViewTab =
  | 'catalog'
  | 'camps'
  | 'championships'
  | 'history'
  | 'enroll'
  | 'my-registrations'
  | 'admin-dashboard'
  | 'admin-camps'
  | 'admin-courses'
  | 'admin-tribes'
  | 'admin-roster'
  | 'admin-cashier'
  | 'admin-scanner'
  | 'admin-reports'
  | 'admin-catalogs'
  | 'admin-payment-settings'
  | 'admin-users'
  | 'admin-roles'
  | 'admin-notifications'
  | 'admin-api'
  | 'profile'
  | 'registration-detail'
  | 'team-invite'
  | 'admin-championships'
  | 'not-found';

// =========================================================
// CONFIGURACIÓN DE MÉTODOS DE PAGO (administrable)
// =========================================================
export interface BankAccount {
  id: string;
  bank: string;
  accountNumber: string;
  holder: string;
  holderDocument?: string; // CI / NIT del titular
  accountType: string;
  currency: 'Bs' | 'USD';
  isActive: boolean;
}

export interface PaymentSettings {
  qr: {
    enabled: boolean;
    label: string;
    description: string;
    bankName: string;
    /** Imagen QR fija subida por tesorería (si no hay, se genera un QR dinámico). */
    qrImageUrl?: string;
    /** true = se confirma automáticamente (pasarela/webhook); false = tesorería verifica el comprobante. */
    autoConfirm: boolean;
    instructions: string;
  };
  transfer: {
    enabled: boolean;
    label: string;
    description: string;
    accounts: BankAccount[];
    requireVoucher: boolean;
    requireReference: boolean;
    verificationHours: number;
    instructions: string;
  };
  cash: {
    enabled: boolean;
    label: string;
    description: string;
    allowAdvance: boolean;
    places: string;
    instructions: string;
  };
  whatsappContact: string;
}
