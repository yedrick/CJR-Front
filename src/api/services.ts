// Servicios tipados por recurso. Los componentes NUNCA llaman a fetch ni al mock directamente:
// todo pasa por aquí → apiRequest → (API real | servidor simulado).
import { apiRequest } from './http';
import type {
  AppNotification,
  AuthTokens,
  Camp,
  CampCourse,
  CamperRegistration,
  Catalogs,
  CatalogKind,
  Championship,
  ChampionshipEntry,
  CheckInLog,
  PastCampEdition,
  PaymentSettings,
  TeamInvite,
  TribeGroup,
  User,
} from '../types/camp';
import type { Permission, Role, RoleId } from '../auth/permissions';

export interface AuthResponse {
  user: User;
  tokens: AuthTokens;
}

export interface RegisterPayload {
  firstName: string;
  paternalLastName: string;
  maternalLastName: string;
  birthDate: string;
  phone: string;
  email: string;
  password: string;
  regional: string;
  acceptTerms: boolean;
}

export interface NewRegistrationPayload {
  campId: string;
  firstName: string;
  paternalLastName: string;
  maternalLastName: string;
  birthDate: string;
  age: number;
  gender: 'M' | 'F';
  documentId: string;
  idExpedition?: string;
  phone: string;
  city?: string;
  regional: string;
  subdirectivaNumber?: string;
  churchCongregation?: string;
  serviceAreaOfInterest?: string;
  emergencyContactName?: string;
  emergencyPhone?: string;
  enrolledCourseIds: string[];
  enrolledChampionshipIds: string[];
  payment: {
    method: 'qr_bank' | 'transfer' | 'cash_box';
    couponCode?: string;
    voucherImageUrl?: string;
    voucherFileName?: string;
    voucherReferenceNumber?: string;
    /** confirmación de la pasarela QR (en producción la envía el banco por webhook al backend) */
    gatewayConfirmed?: boolean;
  };
  /** Cuenta nueva (solo en la compra sin sesión: inscripción en un solo paso). */
  account?: EnrollAccount;
}

export type RoleWithCount = Role & { userCount: number };

/** Datos de la cuenta nueva cuando se compra el campamento sin sesión. */
export interface EnrollAccount {
  email: string;
  password: string;
  acceptTerms: boolean;
}

export interface EnrollResponse {
  registration: CamperRegistration;
  /** solo cuando se creó una cuenta nueva (sin sesión previa) */
  user?: User;
  tokens?: AuthTokens;
}

export interface ExtraPaymentPayload {
  method: 'qr_bank' | 'transfer' | 'cash_box';
  voucherImageUrl?: string;
  voucherReferenceNumber?: string;
  gatewayConfirmed?: boolean;
}

export const authApi = {
  login: (email: string, password: string) => apiRequest<AuthResponse>('login', { body: { email, password } }),
  register: (data: RegisterPayload) => apiRequest<AuthResponse>('register', { body: data }),
  logout: () => apiRequest<{ message: string }>('logout'),
  me: () => apiRequest<User>('me'),
  updateMe: (data: Partial<User>) => apiRequest<User>('updateMe', { body: data }),
  changePassword: (currentPassword: string, newPassword: string) =>
    apiRequest<{ message: string }>('changePassword', { body: { currentPassword, newPassword } }),
  forgotPassword: (email: string) => apiRequest<{ message: string; devCode?: string }>('forgotPassword', { body: { email } }),
  resetPassword: (email: string, code: string, newPassword: string) =>
    apiRequest<{ message: string }>('resetPassword', { body: { email, code, newPassword } }),
};

export const campsApi = {
  list: () => apiRequest<Camp[]>('listCamps'),
  create: (camp: Omit<Camp, 'id' | 'createdAt'> & Partial<Pick<Camp, 'id'>>) => apiRequest<Camp>('createCamp', { body: camp }),
  update: (id: string, camp: Partial<Camp>) => apiRequest<Camp>('updateCamp', { params: { id }, body: camp }),
  remove: (id: string) => apiRequest<{ deleted: string }>('deleteCamp', { params: { id } }),
  feature: (id: string) => apiRequest<Camp[]>('featureCamp', { params: { id } }),
};

export const coursesApi = {
  list: (campId?: string) => apiRequest<CampCourse[]>('listCourses', { query: { campId } }),
  create: (course: Omit<CampCourse, 'id' | 'enrolledCount'>) => apiRequest<CampCourse>('createCourse', { body: course }),
  update: (id: string, course: Partial<CampCourse>) => apiRequest<CampCourse>('updateCourse', { params: { id }, body: course }),
  remove: (id: string) => apiRequest<{ deleted: string }>('deleteCourse', { params: { id } }),
};

export const tribesApi = {
  list: () => apiRequest<TribeGroup[]>('listTribes'),
  create: (tribe: Omit<TribeGroup, 'id'>) => apiRequest<TribeGroup>('createTribe', { body: tribe }),
  update: (id: string, tribe: Partial<TribeGroup>) => apiRequest<TribeGroup>('updateTribe', { params: { id }, body: tribe }),
  remove: (id: string) => apiRequest<{ deleted: string }>('deleteTribe', { params: { id } }),
};

export const championshipsApi = {
  list: (campId?: string) => apiRequest<Championship[]>('listChampionships', { query: { campId } }),
  create: (ch: Omit<Championship, 'id'>) => apiRequest<Championship>('createChampionship', { body: ch }),
  update: (id: string, ch: Partial<Championship>) => apiRequest<Championship>('updateChampionship', { params: { id }, body: ch }),
  remove: (id: string) => apiRequest<{ deleted: string }>('deleteChampionship', { params: { id } }),
};

export const catalogsApi = {
  get: () => apiRequest<Catalogs>('getCatalogs'),
  create: <K extends CatalogKind>(kind: K, item: Omit<Catalogs[K][number], 'id'>) =>
    apiRequest<Catalogs[K][number]>('createCatalogItem', { params: { kind }, body: item }),
  update: <K extends CatalogKind>(kind: K, id: string, item: Partial<Catalogs[K][number]> & { cascadeRename?: boolean }) =>
    apiRequest<Catalogs[K][number]>('updateCatalogItem', { params: { kind, id }, body: item }),
  remove: (kind: CatalogKind, id: string) => apiRequest<Catalogs>('deleteCatalogItem', { params: { kind, id } }),
};

export const editionsApi = {
  list: () => apiRequest<PastCampEdition[]>('listEditions'),
};

export const registrationsApi = {
  mine: () => apiRequest<CamperRegistration[]>('myRegistrations'),
  list: (campId?: string) => apiRequest<CamperRegistration[]>('listRegistrations', { query: { campId } }),
  /** Compra del campamento en un solo paso (crea la cuenta si no hay sesión). */
  enroll: (data: NewRegistrationPayload) => apiRequest<EnrollResponse>('enroll', { body: data }),
  enrollCourse: (id: string, courseId: string) => apiRequest<CamperRegistration>('enrollCourse', { params: { id }, body: { courseId } }),
  dropCourse: (id: string, courseId: string) => apiRequest<CamperRegistration>('dropCourse', { params: { id, courseId } }),
  update: (id: string, data: Partial<CamperRegistration>) => apiRequest<CamperRegistration>('updateRegistration', { params: { id }, body: data }),
  remove: (id: string) => apiRequest<{ deleted: string }>('deleteRegistration', { params: { id } }),
  resubmitVoucher: (id: string, voucher: { imageUrl: string; fileName?: string; reference: string }) =>
    apiRequest<CamperRegistration>('resubmitVoucher', { params: { id }, body: voucher }),
};

export const paymentsApi = {
  approve: (registrationId: string) => apiRequest<CamperRegistration>('approvePayment', { params: { registrationId } }),
  reject: (registrationId: string, reason: string) =>
    apiRequest<CamperRegistration>('rejectPayment', { params: { registrationId }, body: { reason } }),
  collect: (registrationId: string) => apiRequest<CamperRegistration>('collectPayment', { params: { registrationId } }),
  getSettings: () => apiRequest<PaymentSettings>('getPaymentSettings'),
  updateSettings: (settings: PaymentSettings) => apiRequest<PaymentSettings>('updatePaymentSettings', { body: settings }),
  validateCoupon: (data: { code: string; campId: string; regional: string; groupSize: number }) =>
    apiRequest<{ valid: true; discountedPricePerPerson: number }>('validateCoupon', { body: data }),
};

export const championshipEntriesApi = {
  list: (campId?: string) => apiRequest<ChampionshipEntry[]>('listChampionshipEntries', { query: { campId } }),
  mine: () => apiRequest<ChampionshipEntry[]>('myChampionshipEntries'),
  create: (data: { registrationId: string; championshipId: string; teamName?: string; payment?: ExtraPaymentPayload }) =>
    apiRequest<ChampionshipEntry>('createChampionshipEntry', { body: data }),
  cancel: (id: string) => apiRequest<ChampionshipEntry>('cancelChampionshipEntry', { params: { id } }),
  resubmitVoucher: (id: string, voucher: { imageUrl: string; reference: string }) =>
    apiRequest<ChampionshipEntry>('resubmitEntryVoucher', { params: { id }, body: voucher }),
  removeMember: (id: string, registrationId: string) =>
    apiRequest<ChampionshipEntry>('removeTeamMember', { params: { id, registrationId } }),
  getInvite: (code: string) => apiRequest<TeamInvite>('getTeamInvite', { params: { code } }),
  join: (code: string, registrationId?: string) => apiRequest<ChampionshipEntry>('joinTeam', { params: { code }, body: { registrationId } }),
  approve: (id: string) => apiRequest<ChampionshipEntry>('approveEntryPayment', { params: { id } }),
  reject: (id: string, reason: string) => apiRequest<ChampionshipEntry>('rejectEntryPayment', { params: { id }, body: { reason } }),
  collect: (id: string) => apiRequest<ChampionshipEntry>('collectEntryPayment', { params: { id } }),
};

export const checkinsApi = {
  list: (campId?: string) => apiRequest<CheckInLog[]>('listCheckins', { query: { campId } }),
  create: (data: { registrationId: string; courseId: string; campId?: string }) => apiRequest<CheckInLog>('createCheckin', { body: data }),
};

export const notificationsApi = {
  list: () => apiRequest<AppNotification[]>('listNotifications'),
  read: (id: string) => apiRequest<AppNotification>('readNotification', { params: { id } }),
  readAll: () => apiRequest<{ ok: true }>('readAllNotifications'),
  broadcast: (data: { title: string; body: string; campId?: string; audience: 'campers' | 'staff' | 'all'; link?: string }) =>
    apiRequest<{ sent: number }>('broadcastNotification', { body: data }),
  subscribePush: (subscription: PushSubscriptionJSON) => apiRequest<{ ok: true }>('subscribePush', { body: subscription }),
};

export const usersApi = {
  list: () => apiRequest<User[]>('listUsers'),
  create: (data: Partial<User> & { password: string; role: RoleId }) => apiRequest<User>('createUser', { body: data }),
  update: (id: string, data: Partial<User> & { password?: string }) => apiRequest<User>('updateUser', { params: { id }, body: data }),
  remove: (id: string) => apiRequest<{ deleted: string }>('deleteUser', { params: { id } }),
  roles: () => apiRequest<RoleWithCount[]>('listRoles'),
  updateRole: (id: RoleId, permissions: Permission[], description?: string) =>
    apiRequest<Role>('updateRole', { params: { id }, body: { permissions, description } }),
};
