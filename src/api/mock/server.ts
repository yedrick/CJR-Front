// Servidor de API SIMULADO: atiende las rutas de src/api/routes.ts dentro del navegador,
// con autenticación JWT, permisos por recurso, validaciones y códigos HTTP reales.
import { env } from '../../config/env';
import { ApiError } from '../errors';
import { API_ROUTES, ApiRoute, HttpMethod, matchPath, RouteId } from '../routes';
import { hasPermission, Permission } from '../../auth/permissions';
import type { StoredUser } from '../../types/camp';
import { getDb, MockDb, persist } from './db';
import { verifyJwt } from './jwt';
import { HANDLERS } from './handlers';

export interface MockRequest {
  method: HttpMethod;
  path: string; // sin la URL base, con query string opcional
  body?: unknown;
  headers?: Record<string, string>;
}

export interface MockResponse {
  status: number;
  data: unknown;
  headers?: Record<string, string>;
}

export interface HandlerContext {
  db: MockDb;
  route: ApiRoute;
  params: Record<string, string>;
  query: URLSearchParams;
  body: any;
  user: StoredUser | null;
  sessionId: string | null;
  permissions: Permission[];
  /** true si el acceso se concedió por permiso (no por ser dueño) */
  grantedByPermission: boolean;
  userAgent: string;
}

export type Handler = (ctx: HandlerContext) => unknown | { status: number; data: unknown };

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const ROUTES = Object.values(API_ROUTES) as ApiRoute[];

function findRoute(method: HttpMethod, pathname: string) {
  let pathExists = false;
  for (const route of ROUTES) {
    const params = matchPath(route.path, pathname);
    if (!params) continue;
    pathExists = true;
    if (route.method === method) return { route, params, pathExists };
  }
  return { route: null, params: {}, pathExists };
}

export const userPermissions = (db: MockDb, user: StoredUser | null): Permission[] =>
  user ? db.roles.find((r) => r.id === user.role)?.permissions || [] : [];

export async function handleMockRequest(req: MockRequest): Promise<MockResponse> {
  const db = getDb();
  const [pathname, qs] = req.path.split('?');
  const query = new URLSearchParams(qs || '');

  // Latencia de red simulada (±30 %)
  const latency = env.mock.latencyMs;
  if (latency > 0) await sleep(latency * (0.7 + Math.random() * 0.6));

  try {
    const { route, params, pathExists } = findRoute(req.method, pathname);
    if (!route) {
      if (pathExists) throw new ApiError(405, `Método ${req.method} no permitido en ${pathname}.`, { code: 'BAD_REQUEST' });
      throw new ApiError(404, `La ruta ${req.method} ${pathname} no existe.`);
    }

    // Fallas aleatorias configurables (VITE_MOCK_ERROR_RATE) para probar el manejo de errores 500
    if (env.mock.errorRate > 0 && route.id !== 'health' && Math.random() * 100 < env.mock.errorRate) {
      throw new ApiError(500, 'Error interno simulado del servidor (VITE_MOCK_ERROR_RATE).');
    }

    // ── Autenticación (Bearer JWT) ─────────────────────
    let user: StoredUser | null = null;
    let sessionId: string | null = null;
    const auth = req.headers?.authorization || req.headers?.Authorization;
    if (auth?.startsWith('Bearer ')) {
      const check = verifyJwt(auth.slice(7));
      if (check.ok) {
        const session = db.sessions.find((s) => s.id === check.payload.sid && s.expiresAt > Date.now());
        const found = db.users.find((u) => u.id === check.payload.sub);
        if (session && found) {
          user = found;
          sessionId = session.id;
        } else if (route.access !== 'public') {
          throw new ApiError(401, 'La sesión fue cerrada. Inicia sesión nuevamente.', { code: 'UNAUTHORIZED' });
        }
      } else if (route.access !== 'public') {
        throw new ApiError(
          401,
          check.reason === 'expired' ? 'Tu sesión expiró. Vuelve a iniciar sesión.' : 'Token inválido.',
          { code: 'UNAUTHORIZED' }
        );
      }
    }

    if (route.access !== 'public' && !user) throw new ApiError(401, 'Debes iniciar sesión para continuar.');
    if (user && user.status === 'disabled' && route.access !== 'public') {
      throw new ApiError(403, 'Tu cuenta está desactivada. Comunícate con la directiva.');
    }

    // ── Autorización por permisos ──────────────────────
    const permissions = userPermissions(db, user);
    let grantedByPermission = false;
    if (Array.isArray(route.access)) {
      if (!hasPermission(permissions, route.access)) {
        throw new ApiError(403, `No tienes permiso para esta acción (requiere: ${route.access.join(' o ')}).`);
      }
      grantedByPermission = true;
    } else if (typeof route.access === 'object') {
      grantedByPermission = hasPermission(permissions, route.access.or);
      // la propiedad del recurso la valida el handler
    }

    const handler = HANDLERS[route.id as RouteId];
    if (!handler) throw new ApiError(501 as number, `La ruta ${route.id} aún no está implementada.`, { code: 'SERVER_ERROR' });

    const result = handler({
      db,
      route,
      params,
      query,
      body: req.body ?? {},
      user,
      sessionId,
      permissions,
      grantedByPermission,
      userAgent: req.headers?.['x-client'] || navigator.userAgent,
    });
    // los GET no modifican la base: evita serializarla entera (con comprobantes en base64) en cada lectura
    if (req.method !== 'GET') persist();

    const isWrapped = result && typeof result === 'object' && 'status' in (result as object) && 'data' in (result as object);
    const status = isWrapped ? (result as MockResponse).status : req.method === 'POST' ? 201 : 200;
    const data = isWrapped ? (result as MockResponse).data : result;
    return { status, data: data === undefined ? null : structuredClone(data) };
  } catch (e) {
    if (e instanceof ApiError) {
      return {
        status: e.status,
        data: e.toJSON(),
        headers: e.retryAfter ? { 'retry-after': String(e.retryAfter) } : undefined,
      };
    }
    console.error('[mock-api] Error no controlado', e);
    return { status: 500, data: new ApiError(500).toJSON() };
  }
}
