import React, { useState } from 'react';
import {
  ArrowLeft,
  Compass,
  Home,
  LayoutDashboard,
  Loader2,
  LockKeyhole,
  LogIn,
  RefreshCw,
  Server,
  ServerCrash,
  ShieldX,
  Tent,
  UserPlus,
  Wifi,
  WifiOff,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useCamp } from '../../context/CampContext';
import { env, isTesting } from '../../config/env';
import { ROLE_LABEL } from '../../auth/permissions';
import { firstAdminTab, routeForTab } from '../../auth/access';

// =========================================================
// Pantallas de estado: 404 · 403 · 401 · 500 · carga inicial
// =========================================================

type Tone = 'sky' | 'amber' | 'rose' | 'violet';

const TONES: Record<Tone, { number: string; iconBox: string; blob: string; ring: string }> = {
  sky: {
    number: 'from-sky-500 via-[#0284C7] to-indigo-600',
    iconBox: 'bg-[#0284C7] text-white shadow-sky-300/60',
    blob: 'bg-sky-200/50',
    ring: 'border-sky-200',
  },
  amber: {
    number: 'from-amber-400 via-orange-500 to-rose-500',
    iconBox: 'bg-amber-500 text-white shadow-amber-300/60',
    blob: 'bg-amber-200/50',
    ring: 'border-amber-200',
  },
  rose: {
    number: 'from-rose-400 via-red-500 to-rose-700',
    iconBox: 'bg-red-500 text-white shadow-red-300/60',
    blob: 'bg-rose-200/50',
    ring: 'border-rose-200',
  },
  violet: {
    number: 'from-violet-400 via-indigo-500 to-[#0284C7]',
    iconBox: 'bg-indigo-600 text-white shadow-indigo-300/60',
    blob: 'bg-violet-200/50',
    ring: 'border-violet-200',
  },
};

const ActionButton: React.FC<{
  onClick: () => void;
  icon: React.ElementType;
  variant?: 'primary' | 'secondary';
  disabled?: boolean;
  children: React.ReactNode;
}> = ({ onClick, icon: Icon, variant = 'primary', disabled, children }) => (
  <button
    type="button"
    onClick={onClick}
    disabled={disabled}
    className={`w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-3 rounded-2xl text-sm font-black transition-all active:scale-[0.98] cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed ${
      variant === 'primary'
        ? 'bg-[#0284C7] hover:bg-[#0369A1] text-white shadow-lg shadow-sky-200'
        : 'bg-white hover:bg-sky-50 text-slate-700 border border-slate-200'
    }`}
  >
    <Icon className={`w-4 h-4 ${disabled && Icon === RefreshCw ? 'animate-spin' : ''}`} />
    {children}
  </button>
);

const StatusLayout: React.FC<{
  code: string;
  icon: React.ElementType;
  tone: Tone;
  kicker: string;
  title: string;
  description: React.ReactNode;
  actions: React.ReactNode;
  extra?: React.ReactNode;
  fullScreen?: boolean;
}> = ({ code, icon: Icon, tone, kicker, title, description, actions, extra, fullScreen }) => {
  const t = TONES[tone];
  return (
    <section
      className={`relative overflow-hidden flex items-center justify-center px-4 sm:px-6 ${
        fullScreen ? 'min-h-screen bg-gradient-to-b from-slate-50 via-white to-sky-50' : 'min-h-[calc(100dvh-10rem)] py-12'
      }`}
    >
      {/* Ilustración de fondo */}
      <div className={`absolute top-10 -left-24 w-72 h-72 rounded-full blur-3xl ${t.blob} animate-float`} aria-hidden="true" />
      <div className={`absolute bottom-0 -right-24 w-80 h-80 rounded-full blur-3xl ${t.blob} animate-float-2`} aria-hidden="true" />

      <div className="relative w-full max-w-xl text-center animate-fade-in-up">
        <div className="relative inline-flex items-center justify-center">
          <span
            className={`font-display font-black leading-none tracking-tighter text-[6.5rem] sm:text-[9rem] md:text-[11rem] bg-gradient-to-br ${t.number} bg-clip-text text-transparent select-none`}
            aria-hidden="true"
          >
            {code}
          </span>
          <span
            className={`absolute -bottom-3 left-1/2 -translate-x-1/2 w-16 h-16 sm:w-20 sm:h-20 rounded-3xl flex items-center justify-center shadow-xl ring-8 ring-white ${t.iconBox} animate-bounce-soft`}
          >
            <Icon className="w-8 h-8 sm:w-10 sm:h-10" />
          </span>
        </div>

        <p className="mt-10 text-[11px] font-black uppercase tracking-widest text-slate-400">
          <span className="sr-only">Error {code} · </span>
          {kicker}
        </p>
        <h1 className="mt-1 text-2xl sm:text-3xl font-black text-slate-900 font-display tracking-tight">{title}</h1>
        <div className="mt-3 text-sm sm:text-base text-slate-500 leading-relaxed max-w-md mx-auto">{description}</div>

        <div className="mt-7 flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-2.5">{actions}</div>

        {extra && <div className={`mt-8 mx-auto max-w-md rounded-2xl border border-dashed ${t.ring} bg-white/70 p-4 text-left`}>{extra}</div>}
      </div>
    </section>
  );
};

// ── 404 ───────────────────────────────────────────────────
export const NotFoundPage: React.FC = () => {
  const { setActiveTab } = useCamp();
  const path = typeof window !== 'undefined' ? window.location.pathname : '';
  return (
    <StatusLayout
      code="404"
      icon={Compass}
      tone="sky"
      kicker="Página no encontrada"
      title="Parece que te saliste del sendero"
      description={
        <>
          No encontramos la página que buscas. Puede que el enlace esté mal escrito o que la página ya no exista.
          {path && path !== '/404' && (
            <span className="block mt-2 font-mono text-xs text-slate-400 break-all">{path}</span>
          )}
        </>
      }
      actions={
        <>
          <ActionButton icon={Home} onClick={() => setActiveTab('catalog')}>
            Ir al inicio
          </ActionButton>
          <ActionButton icon={Tent} variant="secondary" onClick={() => setActiveTab('camps')}>
            Ver campamentos
          </ActionButton>
        </>
      }
    />
  );
};

// ── 403 ───────────────────────────────────────────────────
export const ForbiddenPage: React.FC = () => {
  const { currentUser } = useAuth();
  const { activeTab, setActiveTab } = useCamp();
  const section = routeForTab(activeTab)?.title;
  const roleLabel = currentUser ? ROLE_LABEL[currentUser.role] || currentUser.role : '';
  const panelTab = firstAdminTab(currentUser);

  const goBack = () => {
    if (window.history.length > 1) window.history.back();
    else setActiveTab(panelTab || 'catalog');
  };

  return (
    <StatusLayout
      code="403"
      icon={ShieldX}
      tone="amber"
      kicker="Acceso denegado"
      title="Esta sección no está disponible para ti"
      description={
        <>
          Tu rol{roleLabel && <span className="font-bold text-slate-700"> «{roleLabel}»</span>} no tiene permiso para entrar a
          {section ? <span className="font-bold text-slate-700"> {section}</span> : ' esta sección'}. Si crees que lo necesitas,
          pídele a un administrador que revise tus permisos.
        </>
      }
      actions={
        <>
          <ActionButton icon={ArrowLeft} variant="secondary" onClick={goBack}>
            Volver
          </ActionButton>
          <ActionButton icon={panelTab ? LayoutDashboard : Home} onClick={() => setActiveTab(panelTab || 'catalog')}>
            {panelTab ? 'Ir a mi panel' : 'Ir al inicio'}
          </ActionButton>
        </>
      }
      extra={
        currentUser && (
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
              <LockKeyhole className="w-5 h-5" />
            </div>
            <div className="min-w-0 text-xs">
              <p className="font-bold text-slate-800 truncate">
                {currentUser.firstName} {currentUser.paternalLastName}
              </p>
              <p className="text-slate-500">
                {roleLabel} · {currentUser.permissions.length} {currentUser.permissions.length === 1 ? 'permiso' : 'permisos'}
              </p>
            </div>
          </div>
        )
      }
    />
  );
};

// ── 401 ───────────────────────────────────────────────────
export const UnauthorizedPage: React.FC = () => {
  const { requireLogin } = useAuth();
  const { activeTab } = useCamp();
  const section = routeForTab(activeTab)?.title;
  return (
    <StatusLayout
      code="401"
      icon={LockKeyhole}
      tone="violet"
      kicker="Necesitas iniciar sesión"
      title="Inicia sesión para continuar"
      description={
        <>
          {section ? (
            <>
              Para ver <span className="font-bold text-slate-700">{section}</span> necesitas entrar con tu cuenta.
            </>
          ) : (
            'Esta sección es solo para usuarios registrados.'
          )}{' '}
          Si aún no tienes una, créala gratis en menos de un minuto.
        </>
      }
      actions={
        <>
          <ActionButton icon={LogIn} onClick={() => requireLogin('login')}>
            Iniciar sesión
          </ActionButton>
          <ActionButton icon={UserPlus} variant="secondary" onClick={() => requireLogin('register')}>
            Crear cuenta
          </ActionButton>
        </>
      }
    />
  );
};

// ── 500 (se muestra fuera del layout principal) ─────────────
export const ServerErrorPage: React.FC<{ message?: string; onRetry?: () => void | Promise<void> }> = ({ message, onRetry }) => {
  const [retrying, setRetrying] = useState(false);
  const online = typeof navigator === 'undefined' ? true : navigator.onLine;

  const retry = async () => {
    if (!onRetry) {
      window.location.reload();
      return;
    }
    setRetrying(true);
    try {
      await onRetry();
    } finally {
      setRetrying(false);
    }
  };

  return (
    <StatusLayout
      fullScreen
      code="500"
      icon={ServerCrash}
      tone="rose"
      kicker="Error del servidor"
      title="No pudimos conectarnos"
      description={
        <>
          {message || 'Ocurrió un problema al cargar la información.'} Espera unos segundos y vuelve a intentarlo.
        </>
      }
      actions={
        <>
          <ActionButton icon={RefreshCw} onClick={retry} disabled={retrying}>
            {retrying ? 'Reintentando…' : 'Reintentar'}
          </ActionButton>
          {onRetry && (
            <ActionButton icon={Home} variant="secondary" onClick={() => window.location.assign('/')}>
              Recargar el sitio
            </ActionButton>
          )}
        </>
      }
      extra={
        <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-1.5 text-xs">
          <dt className="text-slate-400 font-bold flex items-center gap-1.5">
            <Server className="w-3.5 h-3.5" /> Servidor
          </dt>
          <dd className="font-mono text-slate-700 truncate" title={env.useMockApi ? 'API simulada' : env.apiUrl}>
            {env.useMockApi ? 'API simulada' : env.apiUrl || '(sin configurar)'}
          </dd>
          <dt className="text-slate-400 font-bold">Entorno</dt>
          <dd className="text-slate-700">{isTesting ? 'Pruebas' : 'Producción'}</dd>
          <dt className="text-slate-400 font-bold flex items-center gap-1.5">
            {online ? <Wifi className="w-3.5 h-3.5" /> : <WifiOff className="w-3.5 h-3.5" />} Conexión
          </dt>
          <dd className={online ? 'text-emerald-700 font-semibold' : 'text-red-600 font-semibold'}>
            {online ? 'Con internet' : 'Sin internet'}
          </dd>
        </dl>
      }
    />
  );
};

// ── Carga inicial (fuera del layout principal) ──────────────
export const LoadingScreen: React.FC = () => (
  <div
    className="min-h-screen flex flex-col items-center justify-center gap-8 px-6 bg-gradient-to-br from-sky-50 via-white to-indigo-50 relative overflow-hidden"
    role="status"
    aria-live="polite"
  >
    <div className="absolute -top-24 -left-24 w-80 h-80 rounded-full bg-sky-200/40 blur-3xl animate-float" aria-hidden="true" />
    <div className="absolute -bottom-24 -right-24 w-96 h-96 rounded-full bg-indigo-200/40 blur-3xl animate-float-2" aria-hidden="true" />

    <div className="relative flex flex-col items-center text-center animate-fade-in-up">
      <div className="relative">
        <div className="absolute inset-0 rounded-3xl bg-[#0284C7]/30 blur-xl animate-pulse" aria-hidden="true" />
        <div className="relative w-20 h-20 rounded-3xl bg-gradient-to-br from-[#0284C7] to-indigo-600 text-white flex items-center justify-center shadow-2xl animate-pulse-glow">
          <Tent className="w-10 h-10" />
        </div>
      </div>
      <h1 className="mt-6 text-2xl sm:text-3xl font-black text-slate-900 font-display tracking-tight">{env.appName}</h1>
      <p className="mt-1 text-sm text-slate-500">Comité Juvenil · Unión Cristiana Evangélica</p>
    </div>

    <div className="relative w-full max-w-xs space-y-4">
      <div className="h-1.5 rounded-full bg-slate-200/80 overflow-hidden">
        <div className="h-full w-0 rounded-full bg-gradient-to-r from-sky-400 to-[#0284C7] animate-[progress_1.6s_ease-in-out_infinite]" />
      </div>
      <p className="flex items-center justify-center gap-2 text-xs font-semibold text-slate-500">
        <Loader2 className="w-3.5 h-3.5 animate-spin text-[#0284C7]" /> Preparando todo para ti…
      </p>
      <div className="space-y-2 opacity-70" aria-hidden="true">
        {[100, 80, 90].map((w, i) => (
          <div key={i} className="h-2.5 rounded-full bg-slate-200/70 animate-pulse mx-auto" style={{ width: `${w}%` }} />
        ))}
      </div>
    </div>
    {isTesting && (
      <span className="absolute bottom-6 text-[10px] font-bold uppercase tracking-widest text-amber-600">Entorno de pruebas</span>
    )}
  </div>
);
