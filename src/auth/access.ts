// Rutas de la interfaz (URL ↔ pantalla) y el acceso que exige cada una.
import type { ViewTab } from '../types/camp';
import { hasPermission, Permission } from './permissions';

export type ViewAccess = 'public' | 'auth' | Permission[];

export interface ViewRoute {
  tab: ViewTab;
  path: string;
  title: string;
  access: ViewAccess;
}

export const VIEW_ROUTES: ViewRoute[] = [
  { tab: 'catalog', path: '/', title: 'Inicio', access: 'public' },
  { tab: 'camps', path: '/campamentos', title: 'Campamentos', access: 'public' },
  { tab: 'championships', path: '/olimpiadas', title: 'Olimpiadas', access: 'public' },
  { tab: 'history', path: '/galeria', title: 'Galería', access: 'public' },
  { tab: 'enroll', path: '/inscripcion', title: 'Inscripción', access: 'public' },
  { tab: 'my-registrations', path: '/mis-inscripciones', title: 'Mis inscripciones', access: 'auth' },
  { tab: 'registration-detail', path: '/mis-inscripciones/:id', title: 'Mi campamento', access: 'auth' },
  { tab: 'team-invite', path: '/equipo/:code', title: 'Invitación a un equipo', access: 'public' },
  { tab: 'profile', path: '/perfil', title: 'Mi perfil', access: 'auth' },
  { tab: 'admin-dashboard', path: '/admin', title: 'Resumen', access: ['dashboard:read'] },
  { tab: 'admin-camps', path: '/admin/campamentos', title: 'Campamentos', access: ['camps:read'] },
  { tab: 'admin-courses', path: '/admin/talleres', title: 'Talleres', access: ['courses:create', 'courses:update', 'courses:delete'] },
  { tab: 'admin-roster', path: '/admin/inscritos', title: 'Inscritos', access: ['registrations:read'] },
  { tab: 'admin-tribes', path: '/admin/tribus', title: 'Tribus', access: ['tribes:create', 'tribes:update', 'tribes:delete'] },
  { tab: 'admin-cashier', path: '/admin/pagos', title: 'Pagos y caja', access: ['payments:read', 'payments:verify', 'payments:collect'] },
  { tab: 'admin-payment-settings', path: '/admin/metodos-de-pago', title: 'Métodos de pago', access: ['payment_settings:update'] },
  { tab: 'admin-scanner', path: '/admin/escaner', title: 'Escáner QR', access: ['checkins:create'] },
  { tab: 'admin-reports', path: '/admin/reportes', title: 'Reportes', access: ['reports:export'] },
  { tab: 'admin-championships', path: '/admin/campeonatos', title: 'Campeonatos y equipos', access: ['championships:create', 'championships:update', 'championships:delete'] },
  { tab: 'admin-catalogs', path: '/admin/catalogos', title: 'Catálogos', access: ['catalogs:create', 'catalogs:update', 'catalogs:delete'] },
  { tab: 'admin-notifications', path: '/admin/avisos', title: 'Avisos', access: ['notifications:send'] },
  { tab: 'admin-users', path: '/admin/usuarios', title: 'Usuarios', access: ['users:read'] },
  { tab: 'admin-roles', path: '/admin/roles', title: 'Roles y permisos', access: ['roles:read'] },
  { tab: 'admin-api', path: '/admin/api', title: 'Explorador de API', access: ['system:read'] },
  { tab: 'not-found', path: '/404', title: 'Página no encontrada', access: 'public' },
];

const BY_TAB = Object.fromEntries(VIEW_ROUTES.map((r) => [r.tab, r])) as Record<ViewTab, ViewRoute>;

export type RouteParams = Record<string, string>;

/** Construye la URL de una pantalla, reemplazando sus parámetros (ej. /equipo/:code). */
export const pathForTab = (tab: ViewTab, params: RouteParams = {}) =>
  (BY_TAB[tab]?.path || '/').replace(/:([A-Za-z]+)/g, (_, k) => encodeURIComponent(params[k] || ''));
export const routeForTab = (tab: ViewTab) => BY_TAB[tab];

export function matchView(pathname: string): { tab: ViewTab; params: RouteParams } {
  const clean = pathname.replace(/\/+$/, '') || '/';
  const parts = clean.split('/').filter(Boolean);
  for (const r of VIEW_ROUTES) {
    const pattern = r.path.split('/').filter(Boolean);
    if (pattern.length !== parts.length) continue;
    const params: RouteParams = {};
    if (pattern.every((seg, i) => (seg.startsWith(':') ? ((params[seg.slice(1)] = decodeURIComponent(parts[i])), true) : seg === parts[i]))) {
      return { tab: r.tab, params };
    }
  }
  return { tab: 'not-found', params: {} };
}

export const tabForPath = (pathname: string): ViewTab => matchView(pathname).tab;

export type AccessResult = 'ok' | 'unauthenticated' | 'forbidden';

export function checkViewAccess(tab: ViewTab, user: { permissions: readonly string[] } | null): AccessResult {
  const access = BY_TAB[tab]?.access ?? 'public';
  if (access === 'public') return 'ok';
  if (!user) return 'unauthenticated';
  if (access === 'auth') return 'ok';
  return hasPermission(user.permissions, access) ? 'ok' : 'forbidden';
}

/** Primera pantalla del panel a la que el usuario tiene acceso (o null si no es del equipo). */
export function firstAdminTab(user: { permissions: readonly string[] } | null): ViewTab | null {
  if (!user) return null;
  const r = VIEW_ROUTES.find((v) => v.tab.startsWith('admin') && checkViewAccess(v.tab, user) === 'ok');
  return r ? r.tab : null;
}
