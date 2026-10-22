import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  BadgeCheck,
  Calendar,
  CheckCircle2,
  ChevronDown,
  FlaskConical,
  KeyRound,
  Loader2,
  LogIn,
  Mail,
  MapPin,
  Phone,
  ShieldCheck,
  Tent,
  Timer,
  User as UserIcon,
  UserPlus,
  UserX,
  X,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useCamp } from '../../context/CampContext';
import { env, isTesting } from '../../config/env';
import { ROLE_LABEL } from '../../auth/permissions';
import type { DemoAccount } from '../../api/mock/demoAccounts';
import type { RegisterPayload } from '../../api/services';
import { Portal, useEscapeKey, useLockBodyScroll } from '../common/Portal';
import { PasswordChecklist, PasswordInput, passwordProblem } from './PasswordPolicy';
import { EMAIL_RE, PHONE_RE } from '../../utils/validation';

type Mode = 'login' | 'register' | 'recovery';
type Errors = Record<string, string>;

// El bloqueo por intentos fallidos sobrevive al cerrar/abrir el modal
let loginLockUntil = 0;

const onlyDigits = (v: string, max: number) => v.replace(/\D/g, '').slice(0, max);

const formatCountdown = (secs: number) => {
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
};

/** Segundos que faltan hasta `until` (se actualiza cada segundo). */
function useCountdown(until: number) {
  const calc = () => Math.max(0, Math.ceil((until - Date.now()) / 1000));
  const [left, setLeft] = useState(calc);
  useEffect(() => {
    setLeft(calc());
    if (until <= Date.now()) return;
    const id = window.setInterval(() => {
      const v = calc();
      setLeft(v);
      if (v <= 0) window.clearInterval(id);
    }, 1000);
    return () => window.clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [until]);
  return left;
}

const ageFrom = (iso: string) => Math.floor((Date.now() - Date.parse(iso)) / (365.25 * 86400000));
const isoYearsAgo = (years: number) => {
  const d = new Date();
  d.setFullYear(d.getFullYear() - years);
  return d.toISOString().slice(0, 10);
};

// =========================================================
// Piezas de formulario
// =========================================================
const inputBase =
  'w-full py-2.5 text-sm rounded-xl border bg-slate-50 text-slate-900 outline-none transition-all focus:bg-white focus:ring-2 placeholder:text-slate-400';
const inputTone = (invalid?: boolean) =>
  invalid ? 'border-red-300 focus:border-red-400 focus:ring-red-100' : 'border-slate-200 focus:border-sky-400 focus:ring-sky-100';

const FormField: React.FC<{
  id: string;
  label: string;
  required?: boolean;
  error?: string;
  hint?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}> = ({ id, label, required, error, hint, className = '', children }) => (
  <div className={`space-y-1 ${className}`}>
    <label htmlFor={id} className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider">
      {label}
      {required && <span className="text-[#0284C7] ml-0.5">*</span>}
    </label>
    {children}
    {error ? (
      <p id={`${id}-error`} className="flex items-start gap-1 text-[11px] text-red-600 font-semibold">
        <AlertCircle className="w-3 h-3 mt-0.5 shrink-0" /> {error}
      </p>
    ) : (
      hint && <p className="text-[10px] text-slate-400">{hint}</p>
    )}
  </div>
);

const IconInput: React.FC<React.InputHTMLAttributes<HTMLInputElement> & { icon: React.ElementType; invalid?: boolean }> = ({
  icon: Icon,
  invalid,
  className = '',
  ...props
}) => (
  <div className="relative">
    <Icon className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
    <input
      {...props}
      aria-invalid={invalid || undefined}
      aria-describedby={invalid && props.id ? `${props.id}-error` : undefined}
      className={`${inputBase} pl-10 pr-3.5 ${inputTone(invalid)} ${className}`}
    />
  </div>
);

const Banner: React.FC<{ tone: 'error' | 'warning' | 'info' | 'success'; icon?: React.ElementType; children: React.ReactNode }> = ({
  tone,
  icon,
  children,
}) => {
  const styles = {
    error: 'bg-red-50 border-red-200 text-red-800',
    warning: 'bg-amber-50 border-amber-200 text-amber-900',
    info: 'bg-sky-50 border-sky-200 text-sky-900',
    success: 'bg-emerald-50 border-emerald-200 text-emerald-900',
  }[tone];
  const Icon = icon || (tone === 'success' ? CheckCircle2 : AlertCircle);
  return (
    <div role={tone === 'error' ? 'alert' : 'status'} className={`flex items-start gap-2.5 p-3 rounded-2xl border text-xs leading-relaxed ${styles}`}>
      <Icon className="w-4 h-4 shrink-0 mt-0.5" />
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
};

const SubmitButton: React.FC<{ loading: boolean; disabled?: boolean; icon: React.ElementType; children: React.ReactNode }> = ({
  loading,
  disabled,
  icon: Icon,
  children,
}) => (
  <button
    type="submit"
    disabled={loading || disabled}
    className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 rounded-2xl bg-[#0284C7] hover:bg-[#0369A1] text-white text-sm font-black shadow-lg shadow-sky-200 transition-all active:scale-[0.98] cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed disabled:active:scale-100"
  >
    {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Icon className="w-4 h-4" />}
    {children}
  </button>
);

const EnvBadge: React.FC = () => (
  <span
    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${
      isTesting ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-emerald-50 text-emerald-700 border-emerald-200'
    }`}
  >
    {isTesting ? <FlaskConical className="w-3 h-3" /> : <ShieldCheck className="w-3 h-3" />}
    {isTesting ? 'Pruebas' : 'Producción'}
    {env.useMockApi && ' · API simulada'}
  </span>
);

// =========================================================
// INICIAR SESIÓN
// =========================================================
const LoginForm: React.FC<{ onForgot: () => void; initialIdentifier: string }> = ({ onForgot, initialIdentifier }) => {
  const { login } = useAuth();
  const [identifier, setIdentifier] = useState(initialIdentifier);
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Errors>({});
  const [alert, setAlert] = useState<{ kind: 'error' | 'disabled'; message: string } | null>(null);
  const [lockUntil, setLockUntil] = useState(loginLockUntil);
  const lockLeft = useCountdown(lockUntil);
  const locked = lockLeft > 0;
  const passwordRef = useRef<HTMLInputElement>(null);

  // Cuentas de prueba (solo entorno de pruebas; se cargan bajo demanda)
  const [demoOpen, setDemoOpen] = useState(false);
  const [demoAccounts, setDemoAccounts] = useState<DemoAccount[] | null>(null);
  const [demoError, setDemoError] = useState(false);

  useEffect(() => {
    // VITE_SHOW_DEMO_ACCOUNTS se compara en tiempo de compilación para que en producción
    // las cuentas de prueba no queden dentro del build.
    if (import.meta.env.VITE_SHOW_DEMO_ACCOUNTS !== 'true' || !demoOpen || demoAccounts) return;
    let cancelled = false;
    import('../../api/mock/demoAccounts')
      .then((m) => {
        if (cancelled) return;
        const seen = new Set<string>();
        setDemoAccounts(m.DEMO_ACCOUNTS.filter((a) => (seen.has(a.role) ? false : (seen.add(a.role), true))));
      })
      .catch(() => !cancelled && setDemoError(true));
    return () => {
      cancelled = true;
    };
  }, [demoOpen, demoAccounts]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (locked || loading) return;
    const errs: Errors = {};
    if (!identifier.trim()) errs.email = 'Ingresa tu correo o celular.';
    if (!password) errs.password = 'Ingresa tu contraseña.';
    setErrors(errs);
    setAlert(null);
    if (Object.keys(errs).length) return;

    setLoading(true);
    const res = await login(identifier.trim(), password);
    setLoading(false);
    if (res.success) return; // AuthContext cierra el modal y da la bienvenida

    setPassword('');
    switch (res.status) {
      case 401:
        setAlert({ kind: 'error', message: res.message || 'Correo o contraseña incorrectos.' });
        passwordRef.current?.focus();
        break;
      case 422:
        setErrors(res.errors || {});
        if (!res.errors) setAlert({ kind: 'error', message: res.message || 'Revisa los datos ingresados.' });
        break;
      case 429: {
        const until = Date.now() + (res.retryAfter ?? 300) * 1000;
        loginLockUntil = until;
        setLockUntil(until);
        break;
      }
      case 403:
        setAlert({ kind: 'disabled', message: res.message || 'Tu cuenta está desactivada. Comunícate con la directiva.' });
        break;
      default:
        setAlert({ kind: 'error', message: res.message || 'No se pudo iniciar sesión. Inténtalo de nuevo.' });
    }
  };

  const fillDemo = (a: DemoAccount) => {
    setIdentifier(a.email);
    setPassword(a.password);
    setErrors({});
    setAlert(null);
  };

  return (
    <form onSubmit={submit} noValidate className="space-y-4">
      {locked && (
        <Banner tone="warning" icon={Timer}>
          <p className="font-black">Acceso bloqueado temporalmente</p>
          <p>
            Hubo demasiados intentos fallidos. Podrás intentarlo de nuevo en{' '}
            <span className="font-mono font-black tabular-nums">{formatCountdown(lockLeft)}</span>.
          </p>
        </Banner>
      )}
      {!locked && alert?.kind === 'error' && <Banner tone="error">{alert.message}</Banner>}
      {!locked && alert?.kind === 'disabled' && (
        <Banner tone="warning" icon={UserX}>
          <p className="font-black">Cuenta desactivada</p>
          <p>{alert.message}</p>
        </Banner>
      )}

      <FormField id="login-email" label="Correo o celular" error={errors.email}>
        <IconInput
          id="login-email"
          icon={Mail}
          type="text"
          inputMode="email"
          autoComplete="username"
          autoCapitalize="none"
          spellCheck={false}
          placeholder="tu@correo.com o 7XXXXXXX"
          value={identifier}
          onChange={(e) => setIdentifier(e.target.value)}
          invalid={!!errors.email}
          autoFocus
        />
      </FormField>

      <div className="space-y-1">
        <div className="flex items-center justify-between gap-2">
          <label htmlFor="login-password" className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider">
            Contraseña
          </label>
          <button type="button" onClick={onForgot} className="text-[11px] font-bold text-[#0284C7] hover:underline cursor-pointer">
            ¿Olvidaste tu contraseña?
          </button>
        </div>
        <PasswordInput
          id="login-password"
          autoComplete="current-password"
          placeholder="Tu contraseña"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          invalid={!!errors.password}
          inputRef={passwordRef}
        />
        {errors.password && (
          <p id="login-password-error" className="flex items-center gap-1 text-[11px] text-red-600 font-semibold">
            <AlertCircle className="w-3 h-3" /> {errors.password}
          </p>
        )}
      </div>

      <SubmitButton loading={loading} disabled={locked} icon={LogIn}>
        {loading ? 'Verificando…' : locked ? `Espera ${formatCountdown(lockLeft)}` : 'Iniciar sesión'}
      </SubmitButton>

      {env.showDemoAccounts && (
        <div className="rounded-2xl border border-dashed border-amber-300 bg-amber-50/60 overflow-hidden">
          <button
            type="button"
            onClick={() => setDemoOpen((v) => !v)}
            aria-expanded={demoOpen}
            className="w-full flex items-center justify-between gap-2 px-3.5 py-2.5 text-left cursor-pointer"
          >
            <span className="flex items-center gap-2 text-[11px] font-black text-amber-800">
              <FlaskConical className="w-3.5 h-3.5" /> Cuentas de prueba (entorno de pruebas)
            </span>
            <ChevronDown className={`w-4 h-4 text-amber-700 transition-transform ${demoOpen ? 'rotate-180' : ''}`} />
          </button>
          {demoOpen && (
            <div className="px-2 pb-2 space-y-1">
              {!demoAccounts && !demoError && (
                <p className="px-2 py-2 text-[11px] text-amber-700 flex items-center gap-1.5">
                  <Loader2 className="w-3 h-3 animate-spin" /> Cargando cuentas…
                </p>
              )}
              {demoError && <p className="px-2 py-2 text-[11px] text-red-600">No se pudieron cargar las cuentas de prueba.</p>}
              {demoAccounts?.map((a) => (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => fillDemo(a)}
                  className="w-full flex items-center justify-between gap-3 px-2.5 py-2 rounded-xl bg-white/70 hover:bg-white border border-transparent hover:border-amber-200 text-left transition-colors cursor-pointer"
                >
                  <span className="min-w-0">
                    <span className="block text-xs font-bold text-slate-800">{ROLE_LABEL[a.role] || a.label}</span>
                    <span className="block text-[11px] text-slate-500 font-mono truncate">{a.email}</span>
                  </span>
                  <span className="text-[10px] font-bold text-amber-700 shrink-0">Usar</span>
                </button>
              ))}
              <p className="px-2 pt-1 text-[10px] text-amber-700/80">Al elegir una cuenta se completan los campos; luego pulsa «Iniciar sesión».</p>
            </div>
          )}
        </div>
      )}
    </form>
  );
};

// =========================================================
// CREAR CUENTA
// =========================================================
const RegisterForm: React.FC = () => {
  const { registerUser } = useAuth();
  const { catalogs } = useCamp();
  const regionales = useMemo(
    () => [...catalogs.regionales].sort((a, b) => a.name.localeCompare(b.name, 'es')),
    [catalogs.regionales]
  );
  const [form, setForm] = useState({
    firstName: '',
    paternalLastName: '',
    maternalLastName: '',
    birthDate: '',
    phone: '',
    email: '',
    regional: '',
    password: '',
    confirm: '',
    acceptTerms: false,
  });
  const [errors, setErrors] = useState<Errors>({});
  const [alert, setAlert] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const minBirth = isoYearsAgo(60);
  const maxBirth = isoYearsAgo(10);

  const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) => {
    setForm((f) => ({ ...f, [key]: value }));
    if (errors[key]) setErrors(({ [key]: _omit, ...rest }) => rest);
  };

  const focusFirstError = (errs: Errors) => {
    const order = ['firstName', 'paternalLastName', 'maternalLastName', 'birthDate', 'phone', 'email', 'regional', 'password', 'confirm', 'acceptTerms'];
    const first = order.find((k) => errs[k]) || Object.keys(errs)[0];
    if (first) window.setTimeout(() => document.getElementById(`reg-${first}`)?.focus(), 0);
  };

  const validate = (): Errors => {
    const e: Errors = {};
    const email = form.email.trim().toLowerCase();
    if (form.firstName.trim().length < 2) e.firstName = 'Ingresa tus nombres.';
    if (form.paternalLastName.trim().length < 2) e.paternalLastName = 'Ingresa tu apellido paterno.';
    if (!form.birthDate) e.birthDate = 'Ingresa tu fecha de nacimiento.';
    else {
      const age = ageFrom(form.birthDate);
      if (Number.isNaN(age) || age < 10 || age > 60) e.birthDate = 'La edad debe estar entre 10 y 60 años.';
    }
    if (!PHONE_RE.test(form.phone)) e.phone = 'Debe tener 8 dígitos y empezar con 6 o 7.';
    if (!EMAIL_RE.test(email)) e.email = 'Correo electrónico no válido.';
    if (!form.regional) e.regional = 'Selecciona tu regional.';
    const pwd = passwordProblem(form.password, email);
    if (pwd) e.password = pwd;
    if (!form.confirm) e.confirm = 'Repite tu contraseña.';
    else if (form.confirm !== form.password) e.confirm = 'Las contraseñas no coinciden.';
    if (!form.acceptTerms) e.acceptTerms = 'Debes aceptar el uso de tus datos para continuar.';
    return e;
  };

  const submit = async (ev: React.FormEvent) => {
    ev.preventDefault();
    if (loading) return;
    setAlert(null);
    const errs = validate();
    setErrors(errs);
    if (Object.keys(errs).length) {
      focusFirstError(errs);
      return;
    }
    const payload: RegisterPayload = {
      firstName: form.firstName.trim(),
      paternalLastName: form.paternalLastName.trim(),
      maternalLastName: form.maternalLastName.trim(),
      birthDate: form.birthDate,
      phone: `+591 ${form.phone}`,
      email: form.email.trim().toLowerCase(),
      password: form.password,
      regional: form.regional,
      acceptTerms: form.acceptTerms,
    };
    setLoading(true);
    const res = await registerUser(payload);
    setLoading(false);
    if (res.success) return;
    if (res.errors && Object.keys(res.errors).length) {
      setErrors(res.errors);
      focusFirstError(res.errors);
    }
    if (res.status === 409) setAlert(res.message || 'Ya existe una cuenta con esos datos.');
    else if (res.status === 422) setAlert(res.errors ? 'Revisa los campos marcados.' : res.message || 'Revisa los datos ingresados.');
    else if (res.status === 429) setAlert(res.message || 'Demasiados registros desde este dispositivo. Intenta más tarde.');
    else setAlert(res.message || 'No se pudo crear la cuenta. Inténtalo de nuevo.');
  };

  return (
    <form onSubmit={submit} noValidate className="space-y-5">
      {alert && <Banner tone="error">{alert}</Banner>}

      <fieldset className="space-y-3">
        <legend className="text-[11px] font-black text-[#0284C7] uppercase tracking-widest mb-1">Tus datos</legend>
        <FormField id="reg-firstName" label="Nombres" required error={errors.firstName}>
          <IconInput
            id="reg-firstName"
            icon={UserIcon}
            autoComplete="given-name"
            placeholder="Ej. María José"
            value={form.firstName}
            onChange={(e) => set('firstName', e.target.value)}
            invalid={!!errors.firstName}
            maxLength={60}
            autoFocus
          />
        </FormField>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <FormField id="reg-paternalLastName" label="Apellido paterno" required error={errors.paternalLastName}>
            <input
              id="reg-paternalLastName"
              autoComplete="family-name"
              value={form.paternalLastName}
              onChange={(e) => set('paternalLastName', e.target.value)}
              aria-invalid={!!errors.paternalLastName || undefined}
              maxLength={60}
              className={`${inputBase} px-3.5 ${inputTone(!!errors.paternalLastName)}`}
            />
          </FormField>
          <FormField id="reg-maternalLastName" label="Apellido materno" error={errors.maternalLastName}>
            <input
              id="reg-maternalLastName"
              autoComplete="additional-name"
              value={form.maternalLastName}
              onChange={(e) => set('maternalLastName', e.target.value)}
              maxLength={60}
              className={`${inputBase} px-3.5 ${inputTone(!!errors.maternalLastName)}`}
            />
          </FormField>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <FormField id="reg-birthDate" label="Fecha de nacimiento" required error={errors.birthDate}>
            <IconInput
              id="reg-birthDate"
              icon={Calendar}
              type="date"
              autoComplete="bday"
              min={minBirth}
              max={maxBirth}
              value={form.birthDate}
              onChange={(e) => set('birthDate', e.target.value)}
              invalid={!!errors.birthDate}
            />
          </FormField>
          <FormField id="reg-regional" label="Regional" required error={errors.regional}>
            <div className="relative">
              <MapPin className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <select
                id="reg-regional"
                value={form.regional}
                onChange={(e) => set('regional', e.target.value)}
                aria-invalid={!!errors.regional || undefined}
                className={`${inputBase} pl-10 pr-3 cursor-pointer ${inputTone(!!errors.regional)}`}
              >
                <option value="">Selecciona…</option>
                {regionales.map((r) => (
                  <option key={r.id} value={r.name}>
                    {r.name}
                  </option>
                ))}
              </select>
            </div>
          </FormField>
        </div>
      </fieldset>

      <fieldset className="space-y-3">
        <legend className="text-[11px] font-black text-[#0284C7] uppercase tracking-widest mb-1">Contacto</legend>
        <FormField id="reg-phone" label="WhatsApp" required error={errors.phone} hint="Te avisaremos por aquí sobre tu inscripción.">
          <div className="flex">
            <span className="inline-flex items-center gap-1.5 px-3 rounded-l-xl border border-r-0 border-slate-200 bg-slate-100 text-xs font-bold text-slate-600 shrink-0">
              <Phone className="w-3.5 h-3.5" /> +591
            </span>
            <input
              id="reg-phone"
              type="tel"
              inputMode="numeric"
              autoComplete="tel-national"
              placeholder="7XXXXXXX"
              value={form.phone}
              onChange={(e) => set('phone', onlyDigits(e.target.value, 8))}
              aria-invalid={!!errors.phone || undefined}
              maxLength={8}
              className={`${inputBase} rounded-l-none px-3.5 font-mono tracking-wider ${inputTone(!!errors.phone)}`}
            />
          </div>
        </FormField>
        <FormField id="reg-email" label="Correo electrónico" required error={errors.email}>
          <IconInput
            id="reg-email"
            icon={Mail}
            type="email"
            autoComplete="email"
            autoCapitalize="none"
            spellCheck={false}
            placeholder="tu@correo.com"
            value={form.email}
            onChange={(e) => set('email', e.target.value)}
            invalid={!!errors.email}
            maxLength={254}
          />
        </FormField>
      </fieldset>

      <fieldset className="space-y-3">
        <legend className="text-[11px] font-black text-[#0284C7] uppercase tracking-widest mb-1">Seguridad</legend>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <FormField id="reg-password" label="Contraseña" required error={errors.password}>
            <PasswordInput
              id="reg-password"
              autoComplete="new-password"
              value={form.password}
              onChange={(e) => set('password', e.target.value)}
              invalid={!!errors.password}
              maxLength={72}
            />
          </FormField>
          <FormField id="reg-confirm" label="Confirmar contraseña" required error={errors.confirm}>
            <PasswordInput
              id="reg-confirm"
              autoComplete="new-password"
              value={form.confirm}
              onChange={(e) => set('confirm', e.target.value)}
              invalid={!!errors.confirm}
              maxLength={72}
            />
          </FormField>
        </div>
        <PasswordChecklist password={form.password} email={form.email} confirm={form.confirm} showConfirm />
      </fieldset>

      <div className="space-y-1">
        <label
          htmlFor="reg-acceptTerms"
          className={`flex items-start gap-3 p-3 rounded-2xl border cursor-pointer transition-colors ${
            errors.acceptTerms ? 'border-red-300 bg-red-50/50' : form.acceptTerms ? 'border-sky-300 bg-sky-50' : 'border-slate-200 bg-slate-50'
          }`}
        >
          <input
            id="reg-acceptTerms"
            type="checkbox"
            checked={form.acceptTerms}
            onChange={(e) => set('acceptTerms', e.target.checked)}
            aria-invalid={!!errors.acceptTerms || undefined}
            className="mt-0.5 w-4 h-4 rounded accent-[#0284C7] cursor-pointer shrink-0"
          />
          <span className="text-xs text-slate-700 leading-relaxed">
            Acepto el uso de mis datos para la inscripción y la organización de los campamentos del Comité Juvenil. No se
            compartirán con terceros.
          </span>
        </label>
        {errors.acceptTerms && (
          <p className="flex items-center gap-1 text-[11px] text-red-600 font-semibold">
            <AlertCircle className="w-3 h-3" /> {errors.acceptTerms}
          </p>
        )}
      </div>

      <SubmitButton loading={loading} icon={UserPlus}>
        {loading ? 'Creando tu cuenta…' : 'Crear mi cuenta'}
      </SubmitButton>
    </form>
  );
};

// =========================================================
// RECUPERAR CONTRASEÑA
// =========================================================
const RecoveryForm: React.FC<{ onBackToLogin: (email?: string) => void }> = ({ onBackToLogin }) => {
  const { requestPasswordReset, resetPassword } = useAuth();
  const [step, setStep] = useState<'request' | 'reset' | 'done'>('request');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [devCode, setDevCode] = useState<string | undefined>();
  const [info, setInfo] = useState<string | null>(null);
  const [alert, setAlert] = useState<{ message: string; restart?: boolean } | null>(null);
  const [errors, setErrors] = useState<Errors>({});
  const [loading, setLoading] = useState(false);
  const [lockUntil, setLockUntil] = useState(0);
  const lockLeft = useCountdown(lockUntil);

  const request = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (loading || lockLeft > 0) return;
    const clean = email.trim().toLowerCase();
    setAlert(null);
    if (!EMAIL_RE.test(clean)) {
      setErrors({ email: 'Ingresa un correo válido.' });
      return;
    }
    setErrors({});
    setLoading(true);
    const res = await requestPasswordReset(clean);
    setLoading(false);
    if (res.success) {
      setInfo(res.message || 'Si el correo está registrado, recibirás un código de 6 dígitos.');
      setDevCode(res.devCode);
      setCode('');
      setStep('reset');
      return;
    }
    if (res.status === 422 && res.errors) setErrors(res.errors);
    else if (res.status === 429) {
      setLockUntil(Date.now() + (res.retryAfter ?? 600) * 1000);
      setAlert({ message: res.message || 'Demasiadas solicitudes. Espera un momento.' });
    } else setAlert({ message: res.message || 'No se pudo enviar el código.' });
  };

  const reset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    setAlert(null);
    const errs: Errors = {};
    if (!/^\d{6}$/.test(code)) errs.code = 'El código tiene 6 dígitos.';
    const pwd = passwordProblem(password, email);
    if (pwd) errs.newPassword = pwd;
    if (!confirm) errs.confirm = 'Repite la nueva contraseña.';
    else if (confirm !== password) errs.confirm = 'Las contraseñas no coinciden.';
    setErrors(errs);
    if (Object.keys(errs).length) return;
    setLoading(true);
    const res = await resetPassword(email.trim().toLowerCase(), code, password);
    setLoading(false);
    if (res.success) {
      setPassword('');
      setConfirm('');
      setInfo(res.message || 'Contraseña restablecida.');
      setStep('done');
      return;
    }
    if (res.status === 422 && res.errors) {
      setErrors(res.errors);
      if (res.errors.code) setCode('');
    } else if (res.status === 400 || res.status === 429) {
      setAlert({ message: res.message || 'El código ya no es válido. Solicita uno nuevo.', restart: true });
    } else setAlert({ message: res.message || 'No se pudo restablecer la contraseña.' });
  };

  const restart = () => {
    setStep('request');
    setAlert(null);
    setErrors({});
    setCode('');
    setDevCode(undefined);
    setInfo(null);
  };

  if (step === 'done') {
    return (
      <div className="text-center py-4 space-y-4 animate-fade-in-scale">
        <div className="w-16 h-16 rounded-3xl bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto animate-pop-in">
          <CheckCircle2 className="w-8 h-8" />
        </div>
        <div>
          <h4 className="text-lg font-black text-slate-900 font-display">¡Listo! Contraseña actualizada</h4>
          <p className="text-sm text-slate-500 mt-1">{info} Por seguridad, cerramos las sesiones abiertas en otros dispositivos.</p>
        </div>
        <button
          type="button"
          onClick={() => onBackToLogin(email.trim().toLowerCase())}
          className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 rounded-2xl bg-[#0284C7] hover:bg-[#0369A1] text-white text-sm font-black shadow-lg shadow-sky-200 cursor-pointer"
        >
          <LogIn className="w-4 h-4" /> Iniciar sesión
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Indicador de pasos */}
      <ol className="flex items-center gap-2 text-[11px] font-bold">
        {[
          { id: 'request', label: 'Tu correo' },
          { id: 'reset', label: 'Código y nueva contraseña' },
        ].map((s, i) => {
          const active = step === s.id;
          const done = step === 'reset' && s.id === 'request';
          return (
            <li key={s.id} className="flex items-center gap-2 min-w-0">
              {i > 0 && <span className="w-6 h-px bg-slate-200 shrink-0" />}
              <span
                className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 ${
                  done ? 'bg-emerald-100 text-emerald-600' : active ? 'bg-[#0284C7] text-white' : 'bg-slate-100 text-slate-400'
                }`}
              >
                {done ? <CheckCircle2 className="w-3.5 h-3.5" /> : i + 1}
              </span>
              <span className={`truncate ${active ? 'text-slate-800' : 'text-slate-400'}`}>{s.label}</span>
            </li>
          );
        })}
      </ol>

      {alert && (
        <Banner tone={lockLeft > 0 ? 'warning' : 'error'} icon={lockLeft > 0 ? Timer : undefined}>
          <p>{alert.message}</p>
          {lockLeft > 0 && (
            <p className="mt-0.5">
              Podrás solicitar otro código en <span className="font-mono font-black tabular-nums">{formatCountdown(lockLeft)}</span>.
            </p>
          )}
          {alert.restart && (
            <button type="button" onClick={restart} className="mt-1.5 font-black underline cursor-pointer">
              Solicitar un código nuevo
            </button>
          )}
        </Banner>
      )}

      {step === 'request' ? (
        <form onSubmit={request} noValidate className="space-y-4">
          <p className="text-xs text-slate-500 leading-relaxed">
            Escribe el correo con el que te registraste. Te enviaremos un código de 6 dígitos para crear una nueva contraseña.
          </p>
          <FormField id="rec-email" label="Correo electrónico" required error={errors.email}>
            <IconInput
              id="rec-email"
              icon={Mail}
              type="email"
              autoComplete="email"
              autoCapitalize="none"
              spellCheck={false}
              placeholder="tu@correo.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              invalid={!!errors.email}
              autoFocus
            />
          </FormField>
          <SubmitButton loading={loading} disabled={lockLeft > 0} icon={Mail}>
            {loading ? 'Enviando…' : lockLeft > 0 ? `Espera ${formatCountdown(lockLeft)}` : 'Enviar código'}
          </SubmitButton>
        </form>
      ) : (
        <form onSubmit={reset} noValidate className="space-y-4">
          {info && (
            <Banner tone="info" icon={Mail}>
              <p>{info}</p>
              <p className="mt-0.5">
                Correo: <span className="font-bold">{email.trim().toLowerCase()}</span> ·{' '}
                <button type="button" onClick={restart} className="font-black underline cursor-pointer">
                  cambiar
                </button>
              </p>
            </Banner>
          )}
          {devCode && (
            <div className="rounded-2xl border-2 border-dashed border-amber-300 bg-amber-50 p-3 text-center">
              <p className="text-[10px] font-black uppercase tracking-widest text-amber-700 flex items-center justify-center gap-1">
                <FlaskConical className="w-3 h-3" /> Código de prueba (en producción llega por correo)
              </p>
              <button
                type="button"
                onClick={() => setCode(devCode)}
                className="mt-1 font-mono text-2xl font-black tracking-[0.35em] text-amber-900 hover:text-amber-700 cursor-pointer"
                title="Usar este código"
              >
                {devCode}
              </button>
            </div>
          )}
          <FormField id="rec-code" label="Código de verificación" required error={errors.code}>
            <input
              id="rec-code"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="\d{6}"
              maxLength={6}
              placeholder="••••••"
              value={code}
              onChange={(e) => {
                setCode(onlyDigits(e.target.value, 6));
                if (errors.code) setErrors(({ code: _c, ...rest }) => rest);
              }}
              aria-invalid={!!errors.code || undefined}
              className={`${inputBase} px-3.5 text-center font-mono text-xl tracking-[0.5em] ${inputTone(!!errors.code)}`}
              autoFocus
            />
          </FormField>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <FormField id="rec-password" label="Nueva contraseña" required error={errors.newPassword}>
              <PasswordInput
                id="rec-password"
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                invalid={!!errors.newPassword}
                maxLength={72}
              />
            </FormField>
            <FormField id="rec-confirm" label="Confirmar" required error={errors.confirm}>
              <PasswordInput
                id="rec-confirm"
                autoComplete="new-password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                invalid={!!errors.confirm}
                maxLength={72}
              />
            </FormField>
          </div>
          <PasswordChecklist password={password} email={email} confirm={confirm} showConfirm />
          <SubmitButton loading={loading} icon={KeyRound}>
            {loading ? 'Guardando…' : 'Restablecer contraseña'}
          </SubmitButton>
          <button
            type="button"
            onClick={() => request()}
            disabled={loading || lockLeft > 0}
            className="w-full text-[11px] font-bold text-slate-500 hover:text-[#0284C7] cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            ¿No te llegó? Reenviar código
          </button>
        </form>
      )}
    </div>
  );
};

// =========================================================
// MODAL
// =========================================================
const COPY: Record<Mode, { title: string; subtitle: string; icon: React.ElementType }> = {
  login: { title: 'Bienvenido/a de nuevo', subtitle: 'Ingresa para ver tus inscripciones y credenciales.', icon: LogIn },
  register: { title: 'Crea tu cuenta', subtitle: 'Es gratis y solo toma un minuto. Luego podrás inscribirte.', icon: UserPlus },
  recovery: { title: 'Recupera tu acceso', subtitle: 'Te ayudamos a crear una nueva contraseña.', icon: KeyRound },
};

const AuthDialog: React.FC = () => {
  const { setIsAuthModalOpen, authModalMode, setAuthModalMode } = useAuth();
  const [prefill, setPrefill] = useState('');
  const close = useCallback(() => setIsAuthModalOpen(false), [setIsAuthModalOpen]);
  useLockBodyScroll(true);
  useEscapeKey(true, close);
  const mode = authModalMode as Mode;
  const copy = COPY[mode];
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0 });
  }, [mode]);

  return (
    <Portal>
      <div
        className="fixed inset-0 z-[70] flex items-center justify-center p-3 sm:p-6 bg-slate-950/60 backdrop-blur-sm animate-fade-in"
        onMouseDown={close}
      >
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="auth-title"
          onMouseDown={(e) => e.stopPropagation()}
          className="relative w-full max-w-md md:max-w-4xl bg-white rounded-3xl shadow-2xl overflow-hidden flex max-h-[calc(100dvh-1.5rem)] sm:max-h-[calc(100dvh-3rem)] animate-fade-in-scale"
        >
          {/* Panel de marca (tablet y escritorio) */}
          <aside className="hidden md:flex md:w-[38%] shrink-0 relative flex-col justify-between p-8 text-white bg-gradient-to-br from-[#0284C7] via-sky-600 to-indigo-700 overflow-hidden">
            <div className="absolute -top-16 -right-16 w-56 h-56 rounded-full bg-white/10 animate-float" aria-hidden="true" />
            <div className="absolute -bottom-20 -left-10 w-64 h-64 rounded-full bg-white/10 animate-float-2" aria-hidden="true" />
            <div className="relative">
              <div className="w-12 h-12 rounded-2xl bg-white/15 border border-white/20 flex items-center justify-center backdrop-blur">
                <Tent className="w-6 h-6" />
              </div>
              <p className="mt-4 text-[11px] font-black uppercase tracking-widest text-sky-100">{env.appName}</p>
              <h2 className="mt-1 text-2xl font-black font-display leading-tight">
                Campamentos que
                <br />
                transforman vidas
              </h2>
            </div>
            <ul className="relative space-y-3 text-sm text-sky-50">
              {[
                { icon: BadgeCheck, text: 'Inscríbete en minutos desde tu celular' },
                { icon: ShieldCheck, text: 'Tus datos protegidos y cifrados' },
                { icon: Calendar, text: 'Credencial QR y avisos de tu campamento' },
              ].map(({ icon: Icon, text }) => (
                <li key={text} className="flex items-start gap-2.5">
                  <span className="w-7 h-7 rounded-xl bg-white/15 flex items-center justify-center shrink-0">
                    <Icon className="w-3.5 h-3.5" />
                  </span>
                  <span className="pt-1 leading-snug">{text}</span>
                </li>
              ))}
            </ul>
            <p className="relative text-[11px] text-sky-100/80">Comité Juvenil · Unión Cristiana Evangélica</p>
          </aside>

          {/* Formulario */}
          <div ref={scrollRef} className="flex-1 min-w-0 overflow-y-auto overscroll-contain">
            <div className="px-5 sm:px-8 pt-5 sm:pt-7 pb-6 sm:pb-8">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-11 h-11 rounded-2xl bg-sky-50 text-[#0284C7] flex items-center justify-center shrink-0">
                    <copy.icon className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <h3 id="auth-title" className="text-lg sm:text-xl font-black text-slate-900 font-display leading-tight">
                      {copy.title}
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">{copy.subtitle}</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={close}
                  className="p-1.5 rounded-xl text-slate-400 hover:text-slate-800 hover:bg-slate-100 cursor-pointer shrink-0"
                  aria-label="Cerrar"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="mt-3">
                <EnvBadge />
              </div>

              {mode === 'recovery' ? (
                <button
                  type="button"
                  onClick={() => setAuthModalMode('login')}
                  className="mt-5 inline-flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-[#0284C7] cursor-pointer"
                >
                  <ArrowLeft className="w-3.5 h-3.5" /> Volver a iniciar sesión
                </button>
              ) : (
                <div className="mt-5 grid grid-cols-2 p-1 rounded-2xl bg-slate-100" role="tablist" aria-label="Acceso">
                  {(['login', 'register'] as const).map((m) => (
                    <button
                      key={m}
                      type="button"
                      role="tab"
                      aria-selected={mode === m}
                      onClick={() => setAuthModalMode(m)}
                      className={`py-2 rounded-xl text-xs font-black transition-all cursor-pointer ${
                        mode === m ? 'bg-white text-[#0284C7] shadow-sm' : 'text-slate-500 hover:text-slate-800'
                      }`}
                    >
                      {m === 'login' ? 'Iniciar sesión' : 'Crear cuenta'}
                    </button>
                  ))}
                </div>
              )}

              <div className="mt-5" key={mode}>
                {mode === 'login' && <LoginForm initialIdentifier={prefill} onForgot={() => setAuthModalMode('recovery')} />}
                {mode === 'register' && <RegisterForm />}
                {mode === 'recovery' && (
                  <RecoveryForm
                    onBackToLogin={(email) => {
                      if (email) setPrefill(email);
                      setAuthModalMode('login');
                    }}
                  />
                )}
              </div>

              {mode !== 'recovery' && (
                <p className="mt-5 text-center text-xs text-slate-500">
                  {mode === 'login' ? '¿Aún no tienes cuenta?' : '¿Ya tienes una cuenta?'}{' '}
                  <button
                    type="button"
                    onClick={() => setAuthModalMode(mode === 'login' ? 'register' : 'login')}
                    className="font-black text-[#0284C7] hover:underline cursor-pointer inline-flex items-center gap-0.5"
                  >
                    {mode === 'login' ? 'Créala aquí' : 'Inicia sesión'} <ArrowRight className="w-3 h-3" />
                  </button>
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </Portal>
  );
};

export const AuthModal: React.FC = () => {
  const { isAuthModalOpen } = useAuth();
  // Se monta solo al abrir: así los campos (y las contraseñas) se limpian cada vez que se cierra.
  return isAuthModalOpen ? <AuthDialog /> : null;
};
