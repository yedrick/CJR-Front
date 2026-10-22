// =========================================================
// ROLES Y PERMISOS (RBAC)
// Cada permiso es "recurso:acción". El backend (real o simulado) valida
// SIEMPRE el permiso; la interfaz solo oculta lo que el usuario no puede usar.
// =========================================================

export const PERMISSIONS = {
  // Panel
  'dashboard:read': 'Ver el resumen del panel',
  // Campamentos
  'camps:read': 'Ver campamentos (incluye borradores)',
  'camps:create': 'Crear campamentos',
  'camps:update': 'Editar campamentos y marcar el activo',
  'camps:delete': 'Eliminar campamentos',
  // Talleres
  'courses:create': 'Crear talleres',
  'courses:update': 'Editar talleres',
  'courses:delete': 'Eliminar talleres',
  // Tribus
  'tribes:create': 'Crear tribus',
  'tribes:update': 'Editar tribus',
  'tribes:delete': 'Eliminar tribus',
  // Campeonatos
  'championships:create': 'Crear campeonatos',
  'championships:update': 'Editar campeonatos',
  'championships:delete': 'Eliminar campeonatos',
  // Catálogos
  'catalogs:create': 'Crear elementos de catálogos',
  'catalogs:update': 'Editar catálogos',
  'catalogs:delete': 'Eliminar elementos de catálogos',
  // Inscripciones
  'registrations:read': 'Ver todas las inscripciones',
  'registrations:update': 'Editar inscripciones',
  'registrations:delete': 'Eliminar inscripciones',
  // Pagos
  'payments:read': 'Ver pagos',
  'payments:verify': 'Aprobar o rechazar comprobantes',
  'payments:collect': 'Cobrar en caja',
  'payment_settings:update': 'Configurar métodos de pago',
  // Control de acceso
  'checkins:read': 'Ver registros de ingreso',
  'checkins:create': 'Registrar ingresos con el escáner',
  // Reportes
  'reports:export': 'Exportar reportes',
  // Notificaciones
  'notifications:send': 'Enviar avisos a los inscritos',
  // Usuarios y roles
  'users:read': 'Ver usuarios',
  'users:create': 'Crear usuarios',
  'users:update': 'Editar usuarios y asignar roles',
  'users:delete': 'Desactivar o eliminar usuarios',
  'roles:read': 'Ver roles y permisos',
  'roles:update': 'Modificar permisos de los roles',
  // Sistema
  'system:read': 'Ver el explorador de API y el estado del sistema',
} as const;

export type Permission = keyof typeof PERMISSIONS;
export const ALL_PERMISSIONS = Object.keys(PERMISSIONS) as Permission[];

export const PERMISSION_GROUPS: { label: string; resource: string }[] = [
  { label: 'Panel', resource: 'dashboard' },
  { label: 'Campamentos', resource: 'camps' },
  { label: 'Talleres', resource: 'courses' },
  { label: 'Tribus', resource: 'tribes' },
  { label: 'Campeonatos', resource: 'championships' },
  { label: 'Catálogos', resource: 'catalogs' },
  { label: 'Inscripciones', resource: 'registrations' },
  { label: 'Pagos', resource: 'payments' },
  { label: 'Métodos de pago', resource: 'payment_settings' },
  { label: 'Control de acceso', resource: 'checkins' },
  { label: 'Reportes', resource: 'reports' },
  { label: 'Notificaciones', resource: 'notifications' },
  { label: 'Usuarios', resource: 'users' },
  { label: 'Roles', resource: 'roles' },
  { label: 'Sistema', resource: 'system' },
];

export type RoleId = 'super_admin' | 'admin' | 'tesorero' | 'coordinador' | 'control_acceso' | 'campista';

export interface Role {
  id: RoleId;
  name: string;
  description: string;
  permissions: Permission[];
  /** Los roles de sistema no se pueden eliminar; super_admin tampoco se puede editar. */
  locked: boolean;
  isStaff: boolean;
}

const without = (...exclude: Permission[]) => ALL_PERMISSIONS.filter((p) => !exclude.includes(p));

export const DEFAULT_ROLES: Role[] = [
  {
    id: 'super_admin',
    name: 'Super administrador',
    description: 'Control total del sistema, incluidos usuarios, roles y configuración.',
    permissions: [...ALL_PERMISSIONS],
    locked: true,
    isStaff: true,
  },
  {
    id: 'admin',
    name: 'Administrador',
    description: 'Directiva nacional: gestiona campamentos, inscripciones, pagos y catálogos.',
    permissions: without('roles:update', 'users:delete', 'system:read'),
    locked: false,
    isStaff: true,
  },
  {
    id: 'tesorero',
    name: 'Tesorería',
    description: 'Verifica comprobantes, cobra en caja y configura los métodos de pago.',
    permissions: [
      'dashboard:read',
      'camps:read',
      'registrations:read',
      'payments:read',
      'payments:verify',
      'payments:collect',
      'payment_settings:update',
      'reports:export',
    ],
    locked: false,
    isStaff: true,
  },
  {
    id: 'coordinador',
    name: 'Coordinador de campamento',
    description: 'Organiza talleres, tribus e inscritos; controla los ingresos.',
    permissions: [
      'dashboard:read',
      'camps:read',
      'camps:update',
      'courses:create',
      'courses:update',
      'courses:delete',
      'tribes:create',
      'tribes:update',
      'championships:create',
      'championships:update',
      'registrations:read',
      'registrations:update',
      'checkins:read',
      'checkins:create',
      'reports:export',
      'notifications:send',
    ],
    locked: false,
    isStaff: true,
  },
  {
    id: 'control_acceso',
    name: 'Control de acceso',
    description: 'Escanea credenciales en la puerta y en los talleres.',
    permissions: ['camps:read', 'registrations:read', 'checkins:read', 'checkins:create'],
    locked: false,
    isStaff: true,
  },
  {
    id: 'campista',
    name: 'Campista',
    description: 'Joven que se inscribe: solo ve y gestiona sus propias inscripciones.',
    permissions: [],
    locked: true,
    isStaff: false,
  },
];

export const ROLE_LABEL: Record<RoleId, string> = Object.fromEntries(DEFAULT_ROLES.map((r) => [r.id, r.name])) as Record<
  RoleId,
  string
>;

/** Colores de la etiqueta de cada rol (roles personalizados usan el de campista). */
export const ROLE_TONE: Record<string, string> = {
  super_admin: 'bg-violet-50 text-violet-700 border-violet-200',
  admin: 'bg-sky-50 text-sky-700 border-sky-200',
  tesorero: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  coordinador: 'bg-amber-50 text-amber-700 border-amber-200',
  control_acceso: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  campista: 'bg-slate-100 text-slate-600 border-slate-200',
};

/** ¿El conjunto de permisos incluye alguno de los pedidos? */
export function hasPermission(granted: readonly string[] | undefined, required: Permission | Permission[]): boolean {
  if (!granted) return false;
  const list = Array.isArray(required) ? required : [required];
  return list.some((p) => granted.includes(p));
}
