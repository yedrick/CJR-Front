// Cliente HTTP único de la aplicación.
// Según VITE_USE_MOCK_API usa el servidor simulado o la API real (fetch a VITE_API_URL).
// Agrega el Bearer JWT, renueva el token ante un 401 y normaliza los errores.
import { env } from '../config/env';
import { ApiError, ApiErrorBody } from './errors';
import { API_ROUTES, buildPath, HttpMethod, RouteId } from './routes';
import { tokenStore } from './tokenStore';
import type { AuthTokens } from '../types/camp';

export interface RequestOptions {
  params?: Record<string, string | number>;
  query?: Record<string, string | number | boolean | undefined>;
  body?: unknown;
  /** false = no adjuntar el token (rutas públicas) */
  auth?: boolean;
  signal?: AbortSignal;
}

export interface TrafficEntry {
  id: number;
  method: HttpMethod;
  path: string;
  status: number;
  ms: number;
  at: string;
}

const traffic: TrafficEntry[] = [];
const trafficListeners = new Set<() => void>();
let trafficSeq = 0;

export const apiTraffic = {
  list: () => traffic,
  subscribe(cb: () => void) {
    trafficListeners.add(cb);
    return () => trafficListeners.delete(cb);
  },
};

function logTraffic(method: HttpMethod, path: string, status: number, started: number) {
  traffic.unshift({ id: ++trafficSeq, method, path, status, ms: Math.round(performance.now() - started), at: new Date().toLocaleTimeString() });
  traffic.length = Math.min(traffic.length, 80);
  trafficListeners.forEach((l) => l());
  if (env.appEnv === 'testing') {
    const color = status >= 500 ? 'red' : status >= 400 ? 'orange' : 'green';
    console.debug(`%c[api] ${method} ${path} → ${status}`, `color:${color}`);
  }
}

interface RawResponse {
  status: number;
  data: unknown;
  headers?: Record<string, string>;
}

async function realAdapter(method: HttpMethod, path: string, body: unknown, headers: Record<string, string>, signal?: AbortSignal): Promise<RawResponse> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), env.apiTimeoutMs);
  signal?.addEventListener('abort', () => controller.abort(), { once: true });
  try {
    const res = await fetch(`${env.apiUrl}${path}`, {
      method,
      headers: { Accept: 'application/json', ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}), ...headers },
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: controller.signal,
      credentials: 'include',
    });
    const text = await res.text();
    let data: unknown = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = { message: text };
    }
    return { status: res.status, data, headers: { 'retry-after': res.headers.get('retry-after') || '' } };
  } catch (e) {
    if ((e as Error).name === 'AbortError') throw new ApiError(0, undefined, { code: signal?.aborted ? 'NETWORK_ERROR' : 'TIMEOUT' });
    throw new ApiError(0, undefined, { code: 'NETWORK_ERROR' });
  } finally {
    clearTimeout(timeout);
  }
}

async function mockAdapter(method: HttpMethod, path: string, body: unknown, headers: Record<string, string>): Promise<RawResponse> {
  // Condición evaluada al compilar: con VITE_USE_MOCK_API=false Vite elimina el servidor simulado
  // (y sus datos/cuentas de prueba) del build de producción.
  if (import.meta.env.VITE_USE_MOCK_API === 'false') throw new ApiError(0, undefined, { code: 'NETWORK_ERROR' });
  const { handleMockRequest } = await import('./mock/server');
  return handleMockRequest({ method, path, body, headers });
}

const adapter = env.useMockApi ? mockAdapter : realAdapter;

let refreshing: Promise<boolean> | null = null;

/** Renueva el access token (una sola vez aunque fallen varias peticiones a la vez). */
export function refreshSession(): Promise<boolean> {
  if (refreshing) return refreshing;
  const refreshToken = tokenStore.getRefresh();
  if (!refreshToken) return Promise.resolve(false);
  refreshing = (async () => {
    try {
      const res = await adapter('POST', API_ROUTES.refresh.path, { refreshToken }, {});
      if (res.status >= 400) {
        tokenStore.clear();
        return false;
      }
      const { tokens } = res.data as { tokens: AuthTokens };
      tokenStore.set(tokens.accessToken, tokens.refreshToken);
      return true;
    } catch {
      return false; // error de red: no se cierra la sesión
    } finally {
      refreshing = null;
    }
  })();
  return refreshing;
}

function buildUrl(path: string, query?: RequestOptions['query']) {
  if (!query) return path;
  const qs = new URLSearchParams();
  Object.entries(query).forEach(([k, v]) => v !== undefined && v !== '' && qs.set(k, String(v)));
  const s = qs.toString();
  return s ? `${path}?${s}` : path;
}

export async function apiRequest<T>(routeId: RouteId, options: RequestOptions = {}): Promise<T> {
  const route = API_ROUTES[routeId];
  const path = buildUrl(buildPath(route.path, options.params), options.query);
  const useAuth = options.auth ?? route.access !== 'public';

  const send = async () => {
    const headers: Record<string, string> = {};
    const token = tokenStore.getAccess();
    // las rutas públicas también envían el token si existe (p. ej. para ver borradores)
    if (token && (useAuth || route.access === 'public')) headers.Authorization = `Bearer ${token}`;
    return adapter(route.method, path, options.body, headers, options.signal);
  };

  const started = performance.now();
  let res: RawResponse;
  try {
    if (useAuth && !tokenStore.getAccess() && tokenStore.getRefresh()) await refreshSession();
    res = await send();
    // Token vencido → se renueva y se reintenta una vez
    if (res.status === 401 && useAuth && route.id !== 'refresh' && route.id !== 'login') {
      const ok = await refreshSession();
      if (ok) res = await send();
      else tokenStore.clear();
    }
  } catch (e) {
    logTraffic(route.method, path, 0, started);
    throw e;
  }
  logTraffic(route.method, path, res.status, started);

  if (res.status >= 400) {
    const body = (res.data || {}) as Partial<ApiErrorBody>;
    const retry = Number(res.headers?.['retry-after']) || body.retryAfter;
    throw ApiError.from({ ...body, status: res.status, retryAfter: retry || undefined });
  }
  return res.data as T;
}

/** Petición libre (usada por el Explorador de API). */
export async function rawRequest(method: HttpMethod, path: string, body?: unknown) {
  const started = performance.now();
  const headers: Record<string, string> = {};
  const token = tokenStore.getAccess();
  if (token) headers.Authorization = `Bearer ${token}`;
  try {
    const res = await adapter(method, path, body, headers);
    logTraffic(method, path, res.status, started);
    return { status: res.status, data: res.data, ms: Math.round(performance.now() - started) };
  } catch (e) {
    logTraffic(method, path, 0, started);
    const err = e instanceof ApiError ? e : new ApiError(0, undefined, { code: 'NETWORK_ERROR' });
    return { status: err.status, data: err.toJSON(), ms: Math.round(performance.now() - started) };
  }
}
