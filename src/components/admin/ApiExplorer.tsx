import React, { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  Check,
  CheckCircle2,
  Clock,
  Copy,
  Fingerprint,
  Globe,
  KeyRound,
  Loader2,
  Lock,
  Play,
  Radio,
  Route as RouteIcon,
  Send,
  Server,
  ShieldCheck,
  Terminal,
  Unlock,
  UserRound,
  X,
} from 'lucide-react';
import { env } from '../../config/env';
import { apiTraffic, rawRequest } from '../../api/http';
import { buildPath, describeAccess, HttpMethod, ROUTE_LIST } from '../../api/routes';
import type { ApiRoute, RouteAccess } from '../../api/routes';
import { tokenStore } from '../../api/tokenStore';
import { useAuth } from '../../context/AuthContext';
import { useCamp } from '../../context/CampContext';
import { AdminPage, AdminPageHeader, Badge, Button, Card, EmptyState, Field, Modal, SearchInput, SelectInput, TextInput } from './ui';

// =========================================================
// Utilidades
// =========================================================

const METHODS: HttpMethod[] = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'];

const METHOD_CLS: Record<HttpMethod, string> = {
  GET: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  POST: 'bg-sky-50 text-sky-700 border-sky-200',
  PUT: 'bg-amber-50 text-amber-700 border-amber-200',
  PATCH: 'bg-violet-50 text-violet-700 border-violet-200',
  DELETE: 'bg-red-50 text-red-700 border-red-200',
};

const MethodBadge: React.FC<{ method: HttpMethod; className?: string }> = ({ method, className = '' }) => (
  <span
    className={`inline-flex items-center justify-center w-14 shrink-0 px-1.5 py-0.5 rounded-md border text-[10px] font-black font-mono tracking-wide ${METHOD_CLS[method]} ${className}`}
  >
    {method}
  </span>
);

const statusCls = (status: number) =>
  status >= 200 && status < 300
    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
    : status >= 300 && status < 400
    ? 'bg-sky-50 text-sky-700 border-sky-200'
    : status >= 400 && status < 500
    ? 'bg-amber-50 text-amber-700 border-amber-200'
    : 'bg-red-50 text-red-700 border-red-200';

const StatusPill: React.FC<{ status: number; size?: 'sm' | 'md' }> = ({ status, size = 'sm' }) => (
  <span
    className={`inline-flex items-center justify-center rounded-full border font-black font-mono tabular-nums ${statusCls(status)} ${
      size === 'md' ? 'px-3 py-1 text-xs' : 'px-2 py-0.5 text-[10px]'
    }`}
  >
    {status === 0 ? 'SIN RED' : status}
  </span>
);

const paramNames = (path: string) => [...path.matchAll(/:([A-Za-z]+)/g)].map((m) => m[1]);

interface TokenPayload {
  sub?: string;
  role?: string;
  email?: string;
  sid?: string;
  iat?: number;
  exp?: number;
  iss?: string;
}

/** Lee el payload del JWT (parte central en base64url) SIN verificar la firma: solo para mostrarlo. */
function decodeJwtPayload(token: string | null): TokenPayload | null {
  if (!token) return null;
  const part = token.split('.')[1];
  if (!part) return null;
  try {
    const b64 = part.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(part.length / 4) * 4, '=');
    const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
    return JSON.parse(new TextDecoder().decode(bytes)) as TokenPayload;
  } catch {
    return null;
  }
}

const fmtStamp = (sec?: number) =>
  sec ? new Date(sec * 1000).toLocaleString('es-BO', { dateStyle: 'short', timeStyle: 'medium' }) : '—';

const fmtCountdown = (ms: number) => {
  if (ms <= 0) return '00:00';
  const total = Math.floor(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
};

const pretty = (data: unknown) => {
  if (data === undefined) return '';
  try {
    return JSON.stringify(data, null, 2) ?? String(data);
  } catch {
    return String(data);
  }
};

/** Copia al portapapeles y marca la clave copiada durante 2 s. */
const useCopy = () => {
  const [copied, setCopied] = useState('');
  const copy = (text: string, key: string) => {
    navigator.clipboard
      ?.writeText(text)
      .then(() => {
        setCopied(key);
        setTimeout(() => setCopied((k) => (k === key ? '' : k)), 2000);
      })
      .catch(() => undefined);
  };
  return { copied, copy };
};

// =========================================================
// Página
// =========================================================

export const ApiExplorer: React.FC = () => {
  const { currentUser, can } = useAuth();
  const { refreshData } = useCamp();
  const { copied, copy } = useCopy();

  // ── Reloj (cuenta regresiva del token) ───────────────
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  // ── Tráfico reciente ─────────────────────────────────
  const [, setTrafficTick] = useState(0);
  useEffect(() => {
    const unsubscribe = apiTraffic.subscribe(() => setTrafficTick((n) => n + 1));
    return () => {
      unsubscribe();
    };
  }, []);
  const traffic = apiTraffic.list().slice(0, 30);

  // ── Salud de la API ──────────────────────────────────
  const [health, setHealth] = useState<{ status: number; ms: number; data: unknown; at: string } | null>(null);
  const [checkingHealth, setCheckingHealth] = useState(false);
  const checkHealth = async () => {
    if (checkingHealth) return;
    setCheckingHealth(true);
    try {
      const res = await rawRequest('GET', '/system/health');
      setHealth({ ...res, at: new Date().toLocaleTimeString('es-BO') });
    } finally {
      setCheckingHealth(false);
    }
  };
  const healthData = (health?.data || {}) as { status?: string; mode?: string; env?: string; stats?: Record<string, number> };

  // ── Sesión actual (payload del access token) ─────────
  const token = tokenStore.getAccess();
  const payload = useMemo(() => decodeJwtPayload(token), [token]);
  const expiresIn = payload?.exp ? payload.exp * 1000 - now : 0;
  const lifetime = payload?.exp && payload?.iat ? (payload.exp - payload.iat) * 1000 : 0;
  const lifePct = lifetime > 0 ? Math.max(0, Math.min(100, (expiresIn / lifetime) * 100)) : 0;

  // ── Catálogo de rutas ────────────────────────────────
  const [search, setSearch] = useState('');
  const [groupFilter, setGroupFilter] = useState('ALL');
  const [methodFilter, setMethodFilter] = useState<'ALL' | HttpMethod>('ALL');

  const groups = useMemo(() => [...new Set(ROUTE_LIST.map((r) => r.group))], []);

  const hasAccess = (access: RouteAccess): boolean => {
    if (access === 'public') return true;
    if (!currentUser) return false;
    if (access === 'auth') return true;
    if (Array.isArray(access)) return can(access);
    // { own: true, or: [...] } → el dueño del recurso siempre puede; el resto necesita algún permiso
    return true;
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return ROUTE_LIST.filter(
      (r) =>
        (groupFilter === 'ALL' || r.group === groupFilter) &&
        (methodFilter === 'ALL' || r.method === methodFilter) &&
        (!q || `${r.method} ${r.path} ${r.description} ${r.id} ${r.group}`.toLowerCase().includes(q))
    );
  }, [search, groupFilter, methodFilter]);

  const grouped = useMemo(() => {
    const map = new Map<string, ApiRoute[]>();
    filtered.forEach((r) => map.set(r.group, [...(map.get(r.group) || []), r]));
    return [...map.entries()];
  }, [filtered]);

  const accessibleCount = ROUTE_LIST.filter((r) => hasAccess(r.access)).length;
  const hasFilters = search.trim() !== '' || groupFilter !== 'ALL' || methodFilter !== 'ALL';

  // ── Probar una ruta ──────────────────────────────────
  const [testing, setTesting] = useState<ApiRoute | null>(null);
  const [params, setParams] = useState<Record<string, string>>({});
  const [query, setQuery] = useState('');
  const [bodyText, setBodyText] = useState('');
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<{ status: number; ms: number; data: unknown; url: string } | null>(null);
  const [sendError, setSendError] = useState('');

  const takesBody = (m: HttpMethod) => m !== 'GET' && m !== 'DELETE';

  const openTest = (route: ApiRoute) => {
    setTesting(route);
    setParams(Object.fromEntries(paramNames(route.path).map((p) => [p, ''])));
    setQuery('');
    setBodyText(takesBody(route.method) ? pretty(route.sampleBody ?? {}) : '');
    setResult(null);
    setSendError('');
  };

  const closeTest = () => {
    if (!sending) setTesting(null);
  };

  const bodyError = useMemo(() => {
    if (!testing || !takesBody(testing.method) || !bodyText.trim()) return '';
    try {
      JSON.parse(bodyText);
      return '';
    } catch (e) {
      return `JSON no válido: ${(e as Error).message}`;
    }
  }, [bodyText, testing]);

  const missingParams = testing ? paramNames(testing.path).filter((p) => !params[p]?.trim()) : [];

  const builtUrl = (() => {
    if (!testing) return '';
    const filled = Object.fromEntries(
      paramNames(testing.path).map((p) => [p, params[p]?.trim() || `:${p}`])
    ) as Record<string, string>;
    let path = testing.path;
    try {
      path = buildPath(testing.path, filled).replace(/%3A/gi, ':');
    } catch {
      /* se muestra el patrón */
    }
    const q = query.trim().replace(/^\?/, '');
    return q ? `${path}?${q}` : path;
  })();

  const send = async () => {
    if (!testing || sending) return;
    if (missingParams.length) {
      setSendError(`Completa ${missingParams.map((p) => `:${p}`).join(', ')}.`);
      return;
    }
    if (bodyError) {
      setSendError('Corrige el cuerpo JSON antes de enviar.');
      return;
    }
    setSendError('');
    let path: string;
    try {
      path = buildPath(testing.path, Object.fromEntries(Object.entries(params).map(([k, v]) => [k, v.trim()])));
    } catch (e) {
      setSendError((e as Error).message);
      return;
    }
    const q = query.trim().replace(/^\?/, '');
    const url = q ? `${path}?${q}` : path;
    const body = takesBody(testing.method) && bodyText.trim() ? JSON.parse(bodyText) : undefined;
    setSending(true);
    try {
      const res = await rawRequest(testing.method, url, body);
      setResult({ ...res, url });
      // Si se modificaron datos con éxito, el panel se recarga para reflejarlos
      if (testing.method !== 'GET' && res.status >= 200 && res.status < 300 && testing.group !== 'Autenticación') {
        refreshData().catch(() => undefined);
      }
    } finally {
      setSending(false);
    }
  };

  const resultText = result ? pretty(result.data) : '';

  return (
    <AdminPage>
      <AdminPageHeader
        kicker="Sistema"
        title="Explorador de API"
        description="Contrato frontend ↔ backend: todas las rutas de la API, quién puede usarlas y una consola para probarlas con tu sesión actual."
        icon={Terminal}
        actions={
          <Badge className="bg-slate-100 text-slate-700 border-slate-200 !text-[11px] !px-3 !py-1">
            <RouteIcon className="w-3.5 h-3.5" /> {ROUTE_LIST.length} rutas · {accessibleCount} accesibles
          </Badge>
        }
      />

      {/* ── Entorno y sesión ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-5">
        <Card className="p-5 space-y-4 min-w-0">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-2xl bg-sky-50 text-[#0284C7] flex items-center justify-center shrink-0">
                <Server className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <h3 className="text-sm font-black text-slate-900">Entorno</h3>
                <p className="text-[11px] text-slate-500">Configuración leída de los archivos .env</p>
              </div>
            </div>
            <Badge
              className={
                env.appEnv === 'production'
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                  : 'bg-amber-50 text-amber-700 border-amber-200'
              }
            >
              {env.appEnv === 'production' ? 'Producción' : 'Pruebas'}
            </Badge>
          </div>

          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <div className="rounded-xl bg-slate-50 border border-slate-100 p-3 min-w-0">
              <dt className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Modo</dt>
              <dd className="font-bold text-slate-900 mt-0.5 flex items-center gap-1.5">
                {env.useMockApi ? <Radio className="w-3.5 h-3.5 text-violet-500" /> : <Globe className="w-3.5 h-3.5 text-emerald-600" />}
                {env.useMockApi ? 'API simulada (en el navegador)' : 'API real'}
              </dd>
            </div>
            <div className="rounded-xl bg-slate-50 border border-slate-100 p-3 min-w-0">
              <dt className="text-[10px] font-bold uppercase tracking-wider text-slate-500">URL base</dt>
              <dd className="font-mono text-[11px] text-slate-900 mt-0.5 break-all">
                {env.apiUrl || (env.useMockApi ? 'mock://local' : 'Sin configurar')}
              </dd>
            </div>
          </dl>

          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            <Button
              variant="secondary"
              icon={checkingHealth ? Loader2 : Activity}
              onClick={checkHealth}
              disabled={checkingHealth}
              className={checkingHealth ? '[&>svg]:animate-spin' : ''}
            >
              {checkingHealth ? 'Comprobando…' : 'Comprobar estado'}
            </Button>
            {health ? (
              <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-600">
                <StatusPill status={health.status} />
                <span className="inline-flex items-center gap-1 font-mono">
                  <Clock className="w-3 h-3" /> {health.ms} ms
                </span>
                {healthData.status && (
                  <span className="font-bold text-slate-800">
                    {healthData.status === 'ok' ? 'Operativa' : healthData.status}
                    {healthData.mode ? ` · ${healthData.mode}` : ''}
                  </span>
                )}
                <span className="text-slate-400">a las {health.at}</span>
              </div>
            ) : (
              <span className="text-[11px] text-slate-400">GET /system/health</span>
            )}
          </div>
          {health && healthData.stats && (
            <div className="flex flex-wrap gap-1.5">
              {Object.entries(healthData.stats).map(([k, v]) => (
                <span key={k} className="px-2 py-0.5 rounded-md bg-slate-100 text-[10px] font-mono text-slate-600">
                  {k}: <b className="text-slate-900">{v}</b>
                </span>
              ))}
            </div>
          )}
        </Card>

        <Card className="p-5 space-y-4 min-w-0">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-2xl bg-violet-50 text-violet-600 flex items-center justify-center shrink-0">
                <KeyRound className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <h3 className="text-sm font-black text-slate-900">Sesión actual</h3>
                <p className="text-[11px] text-slate-500">Payload del access token (JWT)</p>
              </div>
            </div>
            {payload &&
              (expiresIn > 0 ? (
                <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200">
                  <ShieldCheck className="w-3 h-3" /> Vigente
                </Badge>
              ) : (
                <Badge className="bg-red-50 text-red-700 border-red-200">
                  <AlertTriangle className="w-3 h-3" /> Vencido
                </Badge>
              ))}
          </div>

          {payload ? (
            <>
              <dl className="grid grid-cols-2 gap-x-4 gap-y-2.5 text-xs">
                {[
                  { label: 'Usuario (sub)', value: payload.sub, icon: UserRound },
                  { label: 'Rol', value: payload.role, icon: ShieldCheck },
                  { label: 'Sesión (sid)', value: payload.sid, icon: Fingerprint },
                  { label: 'Correo', value: payload.email || currentUser?.email, icon: Globe },
                ].map((item) => (
                  <div key={item.label} className="min-w-0">
                    <dt className="text-[10px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1">
                      <item.icon className="w-3 h-3" /> {item.label}
                    </dt>
                    <dd className="font-mono text-[11px] text-slate-900 truncate" title={item.value || ''}>
                      {item.value || '—'}
                    </dd>
                  </div>
                ))}
                <div className="min-w-0">
                  <dt className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Emitido</dt>
                  <dd className="text-[11px] text-slate-700">{fmtStamp(payload.iat)}</dd>
                </div>
                <div className="min-w-0">
                  <dt className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Expira</dt>
                  <dd className="text-[11px] text-slate-700">{fmtStamp(payload.exp)}</dd>
                </div>
              </dl>
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-slate-500 font-bold">Tiempo restante</span>
                  <span className={`font-mono font-black tabular-nums ${expiresIn > 60_000 ? 'text-slate-900' : 'text-red-600'}`}>
                    {fmtCountdown(expiresIn)}
                  </span>
                </div>
                <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-1000 ${lifePct > 20 ? 'bg-[#0284C7]' : 'bg-red-500'}`}
                    style={{ width: `${lifePct}%` }}
                  />
                </div>
                <p className="text-[10px] text-slate-400">
                  Al vencer, la próxima petición renueva el token automáticamente con el refresh token.
                </p>
              </div>
            </>
          ) : (
            <div className="rounded-2xl border border-dashed border-slate-200 p-5 text-center">
              <Unlock className="w-6 h-6 text-slate-300 mx-auto" />
              <p className="text-sm font-black text-slate-700 mt-2">Sin sesión</p>
              <p className="text-[11px] text-slate-500">
                No hay un access token en memoria; las peticiones se enviarán sin cabecera Authorization.
              </p>
            </div>
          )}
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 lg:gap-6 items-start">
        {/* ── Catálogo de rutas ── */}
        <div className="lg:col-span-2 space-y-4 min-w-0">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <SearchInput value={search} onChange={setSearch} placeholder="Buscar ruta, método o descripción…" className="sm:col-span-3 lg:col-span-1" />
            <SelectInput value={groupFilter} onChange={(e) => setGroupFilter(e.target.value)} className="py-2 text-xs sm:col-span-2 lg:col-span-1">
              <option value="ALL">Todos los grupos</option>
              {groups.map((g) => (
                <option key={g} value={g}>
                  {g}
                </option>
              ))}
            </SelectInput>
            <SelectInput
              value={methodFilter}
              onChange={(e) => setMethodFilter(e.target.value as 'ALL' | HttpMethod)}
              className="py-2 text-xs"
            >
              <option value="ALL">Todos los métodos</option>
              {METHODS.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </SelectInput>
          </div>

          {grouped.length === 0 ? (
            <Card>
              <EmptyState
                icon={RouteIcon}
                title="Ninguna ruta coincide"
                description="Prueba con otra búsqueda o quita los filtros."
                action={
                  hasFilters ? (
                    <Button
                      variant="secondary"
                      icon={X}
                      onClick={() => {
                        setSearch('');
                        setGroupFilter('ALL');
                        setMethodFilter('ALL');
                      }}
                    >
                      Limpiar filtros
                    </Button>
                  ) : undefined
                }
              />
            </Card>
          ) : (
            grouped.map(([group, routes]) => (
              <Card key={group} className="overflow-hidden">
                <div className="px-4 sm:px-5 py-3 border-b border-slate-100 bg-slate-50/70 flex items-center justify-between gap-2">
                  <h3 className="text-xs font-black text-slate-800 uppercase tracking-wider">{group}</h3>
                  <span className="text-[10px] font-bold text-slate-400">
                    {routes.length} {routes.length === 1 ? 'ruta' : 'rutas'}
                  </span>
                </div>
                <ul className="divide-y divide-slate-100">
                  {routes.map((route) => {
                    const allowed = hasAccess(route.access);
                    return (
                      <li key={route.id} className="px-4 sm:px-5 py-3 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
                        <div className="min-w-0 flex-1 space-y-1">
                          <div className="flex items-center gap-2 min-w-0">
                            <MethodBadge method={route.method} />
                            <code className="font-mono text-xs font-bold text-slate-900 break-all">{route.path}</code>
                          </div>
                          <p className="text-[11px] text-slate-500">{route.description}</p>
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span
                              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px] font-bold ${
                                allowed
                                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                  : 'bg-slate-50 text-slate-500 border-slate-200'
                              }`}
                              title={allowed ? 'Tu usuario puede usar esta ruta' : 'Tu usuario recibiría 401/403'}
                            >
                              {allowed ? <Unlock className="w-3 h-3" /> : <Lock className="w-3 h-3" />}
                              {describeAccess(route.access)}
                            </span>
                            {(route.errors || []).map((code) => (
                              <span
                                key={code}
                                className={`px-1.5 py-0.5 rounded-md border text-[9px] font-black font-mono ${statusCls(code)}`}
                              >
                                {code}
                              </span>
                            ))}
                          </div>
                        </div>
                        <Button size="sm" variant={allowed ? 'secondary' : 'ghost'} icon={Play} onClick={() => openTest(route)} className="self-start sm:self-center shrink-0">
                          Probar
                        </Button>
                      </li>
                    );
                  })}
                </ul>
              </Card>
            ))
          )}
        </div>

        {/* ── Tráfico reciente ── */}
        <Card className="lg:sticky lg:top-28 overflow-hidden min-w-0">
          <div className="px-4 sm:px-5 py-3 border-b border-slate-100 bg-gradient-to-r from-sky-50 to-white flex items-center gap-2">
            <Activity className="w-4 h-4 text-[#0284C7]" />
            <h3 className="text-[11px] font-black uppercase tracking-widest text-[#0284C7]">Tráfico reciente</h3>
            <span className="ml-auto text-[10px] text-slate-400">{traffic.length} peticiones</span>
          </div>
          {traffic.length === 0 ? (
            <EmptyState icon={Activity} title="Sin peticiones aún" description="Las llamadas a la API aparecerán aquí en tiempo real." />
          ) : (
            <ul className="divide-y divide-slate-100 max-h-[32rem] overflow-y-auto overscroll-contain">
              {traffic.map((t) => (
                <li key={t.id} className="px-4 py-2 flex items-center gap-2 text-[11px]">
                  <MethodBadge method={t.method} className="!w-12" />
                  <code className="font-mono text-slate-700 truncate flex-1 min-w-0" title={t.path}>
                    {t.path}
                  </code>
                  <StatusPill status={t.status} />
                  <span className="hidden sm:inline font-mono text-slate-400 tabular-nums w-14 text-right">{t.ms} ms</span>
                  <span className="font-mono text-slate-400 tabular-nums">{t.at}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      {/* ── Consola de prueba ── */}
      <Modal
        open={!!testing}
        onClose={closeTest}
        size="xl"
        icon={Terminal}
        title="Probar ruta"
        subtitle={testing ? `${testing.method} ${testing.path} · ${testing.description}` : undefined}
        footer={
          <>
            {sendError && (
              <span className="flex items-center justify-center sm:justify-start gap-1.5 text-[11px] font-bold text-red-600 sm:mr-auto">
                <AlertTriangle className="w-3.5 h-3.5" /> {sendError}
              </span>
            )}
            <Button variant="secondary" onClick={closeTest} disabled={sending}>
              Cerrar
            </Button>
            <Button
              icon={sending ? Loader2 : Send}
              onClick={send}
              disabled={sending || !!bodyError}
              className={sending ? '[&>svg]:animate-spin' : ''}
            >
              {sending ? 'Enviando…' : 'Enviar'}
            </Button>
          </>
        }
      >
        {testing && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 rounded-xl bg-slate-900 text-slate-100 px-3 py-2.5 min-w-0">
              <MethodBadge method={testing.method} />
              <code className="font-mono text-xs break-all flex-1 min-w-0">{builtUrl}</code>
            </div>

            {!hasAccess(testing.access) && (
              <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-[11px] text-amber-800">
                <Lock className="w-3.5 h-3.5 shrink-0 mt-px" />
                Esta ruta requiere {describeAccess(testing.access)}. Con tu sesión el servidor debería responder{' '}
                {currentUser ? '403' : '401'}.
              </div>
            )}
            {testing.method !== 'GET' && (
              <p className="text-[11px] text-slate-500">
                Las peticiones que modifican datos se aplican de verdad sobre la API {env.useMockApi ? 'simulada' : 'real'}.
              </p>
            )}

            {paramNames(testing.path).length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {paramNames(testing.path).map((p) => (
                  <Field key={p} label={`:${p}`} required>
                    <TextInput
                      value={params[p] || ''}
                      onChange={(e) => setParams((prev) => ({ ...prev, [p]: e.target.value }))}
                      placeholder={p === 'kind' ? 'cities' : `valor de ${p}`}
                      className="font-mono"
                    />
                  </Field>
                ))}
              </div>
            )}

            <Field label="Query string" hint="Opcional, por ejemplo campId=camp-2026-nacional">
              <TextInput value={query} onChange={(e) => setQuery(e.target.value)} placeholder="clave=valor&otra=valor" className="font-mono" />
            </Field>

            {takesBody(testing.method) && (
              <Field label="Cuerpo (JSON)" error={bodyError || undefined}>
                <textarea
                  value={bodyText}
                  onChange={(e) => setBodyText(e.target.value)}
                  rows={8}
                  spellCheck={false}
                  className={`w-full px-3.5 py-2.5 text-xs font-mono rounded-xl border bg-slate-50 text-slate-900 outline-none transition-all resize-y focus:bg-white focus:ring-2 ${
                    bodyError ? 'border-red-300 focus:ring-red-100' : 'border-slate-200 focus:border-sky-400 focus:ring-sky-100'
                  }`}
                />
              </Field>
            )}

            {result && (
              <div className="space-y-2 animate-fade-in">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[11px] font-black uppercase tracking-wider text-slate-500">Respuesta</span>
                  <StatusPill status={result.status} size="md" />
                  <span className="inline-flex items-center gap-1 text-[11px] font-mono text-slate-500">
                    <Clock className="w-3 h-3" /> {result.ms} ms
                  </span>
                  {result.status >= 200 && result.status < 300 && <CheckCircle2 className="w-4 h-4 text-emerald-500" />}
                  <Button
                    size="sm"
                    variant="ghost"
                    icon={copied === 'response' ? Check : Copy}
                    onClick={() => copy(resultText, 'response')}
                    className="ml-auto"
                  >
                    {copied === 'response' ? 'Copiado' : 'Copiar'}
                  </Button>
                </div>
                <pre className="max-h-80 overflow-auto overscroll-contain rounded-xl bg-slate-900 text-emerald-200 text-[11px] leading-relaxed font-mono p-3 whitespace-pre">
                  {resultText || '(sin contenido)'}
                </pre>
              </div>
            )}
          </div>
        )}
      </Modal>
    </AdminPage>
  );
};
