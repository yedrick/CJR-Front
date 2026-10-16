export type DayOfWeek = 'Lunes a Viernes' | 'Lunes (Día 1)' | 'Martes (Día 2)' | 'Miércoles (Día 3)' | 'Jueves (Día 4)' | 'Viernes (Día 5)';

export type TimeSlot = 
  | '08:30 - 10:30' 
  | '11:00 - 13:00' 
  | '14:30 - 16:30' 
  | '17:00 - 19:00';

export type CourseCategory = 
  | 'Liderazgo y Discipulado' 
  | 'Ciencia, Robótica y Fe' 
  | 'Música y Alabanza' 
  | 'Misiones y Evangelismo' 
  | 'Supervivencia y Aventura';

export type UserRole = 'Cliente' | 'Administrador';

// 31 COMITÉS JUVENILES REGIONALES (CJR / CJN - Unión Cristiana Evangélica)
export type CJRRegional = 
  | 'CHALLAPATA'
  | 'POCOATA'
  | 'ANDAMARCA'
  | 'CHARAGUA'
  | 'AIQUILE'
  | 'COCHABAMBA'
  | 'ORURO'
  | 'MAGDALENA'
  | 'CHUQUISACA'
  | 'EL ALTO'
  | 'TRINIDAD'
  | 'POTOSI'
  | 'TROPICO'
  | 'CORQUE'
  | 'CAMARGO'
  | 'MONTERO'
  | 'COCAPATA'
  | 'SAN PEDRO DE BUENA VISTA'
  | 'VALLEGRANDE'
  | 'SANTA CRUZ'
  | 'GUAYARAMERIN'
  | 'SAN JULIAN'
  | 'LLALLAGUA'
  | 'GRAN CHACO'
  | 'VALLE ALTO'
  | 'YAWISLA'
  | 'ILLIMANI'
  | 'EL TORNO'
  | 'CAMIRI'
  | 'RIBERALTA'
  | 'TARIJA';

export type Regional = CJRRegional;
export type BolivianCity = CJRRegional;

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
  role: UserRole;
  createdAt: string;
}

export interface CampCourse {
  id: string;
  title: string;
  category: CourseCategory;
  day: DayOfWeek;
  timeSlot: TimeSlot;
  location: string;
  instructor: string;
  instructorRole?: string;
  instructorPhotoUrl?: string;
  instructorBio?: string;
  coverImageUrl?: string;
  maxCapacity: number;
  enrolledCount: number;
  description: string;
  materialsFee: number; // in Bs
  minAge: number;
  maxAge: number;
  iconName: string;
}

export type SportDiscipline = 
  | 'Fútbol Varones'
  | 'Futsal Damas'
  | 'Básquetbol Damas'
  | 'Básquetbol Varones'
  | 'Voleibol Varones'
  | 'Voleibol Damas'
  | 'Natación Varones'
  | 'Natación Damas'
  | 'Ajedrez Varones'
  | 'Ajedrez Damas'
  | 'Pin Pon Varones'
  | 'Pin Pon Damas'
  | 'Maratón Varones 3K'
  | 'Maratón Damas 1K'
  | 'Velocidad 100 Varones'
  | 'Velocidad 100 Damas'
  | 'Postas 400m Varones'
  | 'Postas 400m Damas'
  | 'Libro de Romanos (Olimpiada Bíblica)'
  | 'Coro Teatral Himno'
  | 'Tarde Boliviana';

export interface Championship {
  id: string;
  name: string;
  sport: string;
  genderCategory: 'Varonil' | 'Femenil' | 'Mixto';
  registrationFee: number; // in Bs
  description: string;
  maxTeamsOrParticipants: number;
  enrolledTeamsCount: number;
  prizeSummary: string;
  schedule: string;
  imageUrl?: string;
}

export interface TribeGroup {
  id: string;
  number: number; // 1 to 12
  name: string;
  colorHex: string;
  animalSymbol: string;
  leaderName: string;
  motto: string;
  accentBg: string;
}

// Estructura opcional y ligera si se necesita compatibilidad
export interface MedicalRecord {
  allergies?: string;
  hasEpipen?: boolean;
  bloodType?: string;
  dailyMedications?: string;
  dietaryRestrictions?: string;
  emergencyContact1Name?: string;
  emergencyContact1Phone?: string;
  emergencyContact1Relation?: string;
  emergencyContact2Name?: string;
  emergencyContact2Phone?: string;
  emergencyContact2Relation?: string;
  medicalNotes?: string;
  waiversAccepted?: boolean;
  photoConsent?: boolean;
}

export interface PaymentTransaction {
  id: string;
  registrationId: string;
  camperName: string;
  baseCampFee: number; // in Bs
  coursesFees: number; // in Bs (0 Bs - talleres incluidos)
  championshipsFees: number; // in Bs
  discountAmount: number; // in Bs
  couponCodeApplied?: string;
  totalAmount: number; // in Bs
  advanceAmount?: number; // Adelanto en efectivo en sede (ej. 100 Bs)
  remainingBalance?: number; // Saldo pendiente a pagar en caja (ej. 350 Bs)
  currency: 'Bs' | 'USD';
  date: string;
  status: 'completed' | 'pending_cash' | 'pending_verification' | 'refunded';
  paymentMethod: 'qr_bank' | 'cash_box';
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
  transactionFolio: string;
}

export interface CheckInLog {
  id: string;
  registrationId: string;
  camperName: string;
  courseId: string;
  courseTitle: string;
  timestamp: string;
  type: 'GATE_ENTRY' | 'COURSE_ATTENDANCE' | 'CHAMPIONSHIP_CHECKIN';
  verifiedBy: string;
}

export interface CamperRegistration {
  id: string;
  userId: string;
  qrPayload: string;
  fullName: string;
  firstName: string;
  paternalLastName: string;
  maternalLastName: string;
  birthDate: string;
  age: number;
  documentId: string;
  idExpedition?: string;
  phone: string; // WhatsApp
  email: string;
  regional: CJRRegional;
  churchCongregation?: string;
  subdirectivaNumber?: string;
  serviceAreaOfInterest?: string;
  delegateRole?: string;
  isDelegate?: boolean;
  championshipsStatus?: 'pending_payment' | 'confirmed';
  guardianName?: string;
  guardianPhone?: string;
  emergencyContactName?: string;
  emergencyPhone?: string;
  tribeId: string;
  enrolledCourseIds: string[];
  enrolledChampionshipIds: string[];
  groupSize: number;
  medical: MedicalRecord; // Para compatibilidad existente
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
  requiredGroupSize: number; // exact 35
  allowedRegionals: CJRRegional[];
  discountedPricePerPerson: number; // e.g. 360 Bs instead of 450 Bs
  description: string;
  isActive: boolean;
}

export type ViewTab = 
  | 'catalog' 
  | 'championships'
  | 'history'
  | 'enroll' 
  | 'my-badge'
  | 'admin-dashboard' 
  | 'admin-courses' 
  | 'admin-tribes' 
  | 'admin-roster' 
  | 'admin-cashier' 
  | 'admin-scanner' 
  | 'admin-reports';
