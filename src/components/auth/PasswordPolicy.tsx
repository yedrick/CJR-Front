import React, { useState } from 'react';
import { Check, Eye, EyeOff, Lock, X } from 'lucide-react';

// =========================================================
// Política de contraseñas del cliente.
// Refleja EXACTAMENTE las reglas del servidor (passwordProblems en la API):
// ≥ 8 caracteres (máx. 72), mayúsculas + minúsculas, un número,
// no contener la parte del correo antes de la @, no ser común.
// El servidor vuelve a validar siempre: esto es solo para guiar al usuario.
// =========================================================

const COMMON_PASSWORDS = ['12345678', 'password', 'contraseña', 'qwerty123'];

export interface PasswordCheck {
  id: string;
  label: string;
  ok: boolean;
}

// Solo se exige si la parte del correo tiene 4+ caracteres (con correos muy cortos sería imposible cumplirla)
const emailUser = (email: string) => {
  const user = (email || '').split('@')[0].trim().toLowerCase();
  return user.length >= 4 ? user : '';
};

export function passwordChecks(password: string, email = ''): PasswordCheck[] {
  const user = emailUser(email);
  return [
    { id: 'length', label: 'Entre 8 y 72 caracteres', ok: password.length >= 8 && password.length <= 72 },
    { id: 'case', label: 'Mayúsculas y minúsculas', ok: /[a-z]/.test(password) && /[A-Z]/.test(password) },
    { id: 'digit', label: 'Al menos un número', ok: /\d/.test(password) },
    {
      id: 'email',
      label: 'No contiene tu correo',
      ok: !!password && (!user || !password.toLowerCase().includes(user)),
    },
    { id: 'common', label: 'No es una contraseña común', ok: !!password && !COMMON_PASSWORDS.includes(password.toLowerCase()) },
  ];
}

/** Mismo mensaje que devolvería el servidor (o null si cumple la política). */
export function passwordProblem(password: string, email = ''): string | null {
  if (password.length < 8) return 'Debe tener al menos 8 caracteres.';
  if (password.length > 72) return 'No puede superar los 72 caracteres.';
  if (!/[a-z]/.test(password) || !/[A-Z]/.test(password)) return 'Debe combinar mayúsculas y minúsculas.';
  if (!/\d/.test(password)) return 'Debe incluir al menos un número.';
  const user = emailUser(email);
  if (user && password.toLowerCase().includes(user)) return 'No debe contener tu correo.';
  if (COMMON_PASSWORDS.includes(password.toLowerCase())) return 'Es demasiado común.';
  return null;
}

/** Puntaje 0–4 para el medidor de seguridad. */
export function passwordScore(password: string, email = ''): number {
  if (!password) return 0;
  const checks = passwordChecks(password, email);
  const passed = checks.filter((c) => c.ok).length;
  if (passed < checks.length) return Math.min(2, Math.max(1, passed - 2));
  let score = 2;
  if (password.length >= 12) score++;
  if (/[^A-Za-z0-9]/.test(password) || password.length >= 16) score++;
  return Math.min(4, score);
}

const STRENGTH = [
  { label: 'Sin contraseña', bar: 'bg-slate-200', text: 'text-slate-400' },
  { label: 'Muy débil', bar: 'bg-red-500', text: 'text-red-600' },
  { label: 'Débil', bar: 'bg-amber-500', text: 'text-amber-600' },
  { label: 'Buena', bar: 'bg-sky-500', text: 'text-sky-600' },
  { label: 'Muy segura', bar: 'bg-emerald-500', text: 'text-emerald-600' },
];

/** Genera una contraseña temporal que cumple la política (sin caracteres ambiguos). */
export function generatePassword(length = 12): string {
  const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const lowerChars = 'abcdefghijkmnopqrstuvwxyz';
  const nums = '23456789';
  const symbols = '*#$%&!?';
  const all = upper + lowerChars + nums + symbols;
  const rnd = (max: number) => {
    const buf = new Uint32Array(1);
    crypto.getRandomValues(buf);
    return buf[0] % max;
  };
  const pick = (set: string) => set[rnd(set.length)];
  const chars = [pick(upper), pick(lowerChars), pick(nums), pick(symbols)];
  while (chars.length < length) chars.push(pick(all));
  for (let i = chars.length - 1; i > 0; i--) {
    const j = rnd(i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join('');
}

/** Medidor de seguridad + lista de requisitos en vivo. */
export const PasswordChecklist: React.FC<{
  password: string;
  email?: string;
  confirm?: string;
  /** muestra la fila "Las contraseñas coinciden" */
  showConfirm?: boolean;
  className?: string;
}> = ({ password, email = '', confirm = '', showConfirm = false, className = '' }) => {
  const checks = passwordChecks(password, email);
  if (showConfirm) checks.push({ id: 'match', label: 'Las contraseñas coinciden', ok: !!password && password === confirm });
  const score = passwordScore(password, email);
  const s = STRENGTH[score];
  return (
    <div className={`rounded-2xl border border-slate-100 bg-slate-50/80 p-3 space-y-2.5 ${className}`} aria-live="polite">
      <div className="flex items-center gap-3">
        <div className="flex-1 grid grid-cols-4 gap-1" aria-hidden="true">
          {[1, 2, 3, 4].map((i) => (
            <span key={i} className={`h-1.5 rounded-full transition-colors ${i <= score ? s.bar : 'bg-slate-200'}`} />
          ))}
        </div>
        <span className={`text-[11px] font-black shrink-0 ${s.text}`}>{s.label}</span>
      </div>
      <ul className="grid grid-cols-1 sm:grid-cols-2 gap-x-3 gap-y-1">
        {checks.map((c) => (
          <li key={c.id} className={`flex items-center gap-1.5 text-[11px] ${c.ok ? 'text-emerald-700' : 'text-slate-500'}`}>
            <span
              className={`w-4 h-4 rounded-full flex items-center justify-center shrink-0 ${
                c.ok ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-200 text-slate-400'
              }`}
            >
              {c.ok ? <Check className="w-2.5 h-2.5" strokeWidth={3} /> : <X className="w-2.5 h-2.5" strokeWidth={3} />}
            </span>
            <span className={c.ok ? 'font-semibold' : ''}>{c.label}</span>
          </li>
        ))}
      </ul>
    </div>
  );
};

/** Campo de contraseña con mostrar/ocultar y aviso de Bloq Mayús. */
export const PasswordInput: React.FC<
  Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> & {
    invalid?: boolean;
    withIcon?: boolean;
    inputRef?: React.Ref<HTMLInputElement>;
  }
> = ({ invalid, withIcon = true, inputRef, className = '', onKeyDown, onKeyUp, onBlur, ...props }) => {
  const [visible, setVisible] = useState(false);
  const [caps, setCaps] = useState(false);
  const detect = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (typeof e.getModifierState === 'function') setCaps(e.getModifierState('CapsLock'));
  };
  return (
    <div>
      <div className="relative">
        {withIcon && <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />}
        <input
          {...props}
          ref={inputRef}
          type={visible ? 'text' : 'password'}
          aria-invalid={invalid || undefined}
          aria-describedby={invalid && props.id ? `${props.id}-error` : undefined}
          onKeyDown={(e) => {
            detect(e);
            onKeyDown?.(e);
          }}
          onKeyUp={(e) => {
            detect(e);
            onKeyUp?.(e);
          }}
          onBlur={(e) => {
            setCaps(false);
            onBlur?.(e);
          }}
          className={`w-full ${withIcon ? 'pl-10' : 'pl-3.5'} pr-11 py-2.5 text-sm rounded-xl border bg-slate-50 text-slate-900 outline-none transition-all focus:bg-white focus:ring-2 ${
            invalid ? 'border-red-300 focus:border-red-400 focus:ring-red-100' : 'border-slate-200 focus:border-sky-400 focus:ring-sky-100'
          } ${className}`}
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          className="absolute right-1.5 top-1/2 -translate-y-1/2 p-2 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer"
          aria-label={visible ? 'Ocultar contraseña' : 'Mostrar contraseña'}
          aria-pressed={visible}
          tabIndex={-1}
        >
          {visible ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
        </button>
      </div>
      {caps && (
        <p className="mt-1 text-[11px] font-semibold text-amber-600 flex items-center gap-1" role="status">
          <span className="inline-block px-1 rounded bg-amber-100 font-mono text-[10px]">⇪</span> Bloq Mayús está activado
        </p>
      )}
    </div>
  );
};
