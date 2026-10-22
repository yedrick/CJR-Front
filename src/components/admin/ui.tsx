import React, { useRef } from 'react';
import { AlertCircle, ImagePlus, Search, Tent, Upload, X } from 'lucide-react';
import { useCamp } from '../../context/CampContext';
import { readFileAsDataUrl } from '../../utils/campUtils';
import { Portal, useEscapeKey, useLockBodyScroll } from '../common/Portal';

// =========================================================
// Componentes de interfaz compartidos por todo el panel admin
// =========================================================

export const AdminPage: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6 animate-fade-in">{children}</div>
);

export const AdminPageHeader: React.FC<{
  kicker: string;
  title: string;
  description?: string;
  icon?: React.ElementType;
  actions?: React.ReactNode;
}> = ({ kicker, title, description, icon: Icon, actions }) => (
  <div className="flex flex-col xl:flex-row xl:items-end justify-between gap-4 pb-6 border-b border-sky-100">
    <div className="min-w-0">
      <div className="flex items-center gap-2 text-[11px] font-black text-[#0284C7] uppercase tracking-widest">
        {Icon && <Icon className="w-4 h-4" />}
        <span>{kicker}</span>
      </div>
      <h2 className="text-2xl sm:text-3xl font-black text-slate-900 font-display mt-1 tracking-tight">{title}</h2>
      {description && <p className="text-sm text-slate-500 mt-1 max-w-2xl">{description}</p>}
    </div>
    {actions && <div className="flex flex-wrap items-center gap-2 xl:shrink-0 xl:justify-end">{actions}</div>}
  </div>
);

type BtnVariant = 'primary' | 'secondary' | 'danger' | 'ghost' | 'amber';
const BTN: Record<BtnVariant, string> = {
  primary: 'bg-[#0284C7] hover:bg-[#0369A1] text-white shadow-md',
  secondary: 'bg-white hover:bg-sky-50 text-slate-700 border border-slate-200',
  danger: 'bg-red-50 hover:bg-red-100 text-red-700 border border-red-200',
  ghost: 'text-slate-600 hover:bg-slate-100',
  amber: 'bg-amber-500 hover:bg-amber-600 text-white shadow-md',
};

export const Button: React.FC<
  React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: BtnVariant; icon?: React.ElementType; size?: 'sm' | 'md' }
> = ({ variant = 'primary', icon: Icon, size = 'md', className = '', children, ...props }) => (
  <button
    type="button"
    {...props}
    className={`inline-flex items-center justify-center gap-1.5 font-bold rounded-xl transition-all active:scale-95 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${
      size === 'sm' ? 'px-2.5 py-1.5 text-[11px]' : 'px-4 py-2.5 text-xs'
    } ${BTN[variant]} ${className}`}
  >
    {Icon && <Icon className={size === 'sm' ? 'w-3.5 h-3.5' : 'w-4 h-4'} />}
    {children}
  </button>
);

export const Card: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className = '' }) => (
  <div className={`bg-white rounded-3xl border border-slate-100 shadow-sm ${className}`}>{children}</div>
);

export const StatCard: React.FC<{
  label: string;
  value: React.ReactNode;
  hint?: React.ReactNode;
  icon: React.ElementType;
  tone?: 'sky' | 'emerald' | 'amber' | 'violet' | 'rose' | 'slate';
}> = ({ label, value, hint, icon: Icon, tone = 'sky' }) => {
  const tones: Record<string, string> = {
    sky: 'bg-sky-50 text-sky-600',
    emerald: 'bg-emerald-50 text-emerald-600',
    amber: 'bg-amber-50 text-amber-600',
    violet: 'bg-violet-50 text-violet-600',
    rose: 'bg-rose-50 text-rose-600',
    slate: 'bg-slate-100 text-slate-600',
  };
  return (
    <Card className="p-5">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">{label}</span>
        <div className={`p-2 rounded-xl ${tones[tone]}`}>
          <Icon className="w-4 h-4" />
        </div>
      </div>
      <div className="text-2xl sm:text-3xl font-black text-slate-900 font-mono tabular-nums mt-2 whitespace-nowrap">{value}</div>
      {hint && <div className="text-xs text-slate-500 mt-1">{hint}</div>}
    </Card>
  );
};

export const Modal: React.FC<{
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  icon?: React.ElementType;
  children: React.ReactNode;
  footer?: React.ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}> = ({ open, onClose, title, subtitle, icon: Icon, children, footer, size = 'lg' }) => {
  useLockBodyScroll(open);
  useEscapeKey(open, onClose);
  if (!open) return null;
  const width = { sm: 'max-w-md', md: 'max-w-lg', lg: 'max-w-2xl', xl: 'max-w-4xl' }[size];
  return (
    <Portal>
      <div
        className="fixed inset-0 z-[60] flex items-center justify-center p-3 sm:p-6 bg-slate-950/60 backdrop-blur-sm animate-fade-in"
        onMouseDown={onClose}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <div
          className={`bg-white w-full ${width} rounded-3xl shadow-2xl border border-slate-100 max-h-[calc(100dvh-1.5rem)] sm:max-h-[calc(100dvh-3rem)] flex flex-col animate-fade-in-scale overflow-hidden`}
          onMouseDown={(e) => e.stopPropagation()}
        >
          <div className="flex items-start justify-between gap-4 px-5 sm:px-6 py-4 border-b border-slate-100 bg-gradient-to-r from-sky-50/80 to-white shrink-0">
            <div className="flex items-center gap-3 min-w-0">
              {Icon && (
                <div className="w-10 h-10 rounded-2xl bg-[#0284C7] text-white flex items-center justify-center shrink-0 shadow-md">
                  <Icon className="w-5 h-5" />
                </div>
              )}
              <div className="min-w-0">
                <h3 className="text-base sm:text-lg font-black text-slate-900 font-display leading-tight">{title}</h3>
                {subtitle && <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>}
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-xl text-slate-400 hover:text-slate-800 hover:bg-slate-100 cursor-pointer shrink-0"
              aria-label="Cerrar"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          <div className="px-5 sm:px-6 py-5 overflow-y-auto flex-1 overscroll-contain">{children}</div>
          {footer && (
            <div className="px-5 sm:px-6 py-3.5 border-t border-slate-100 bg-slate-50/70 flex flex-col-reverse sm:flex-row sm:items-center sm:justify-end gap-2 shrink-0 [&>button]:w-full sm:[&>button]:w-auto">
              {footer}
            </div>
          )}
        </div>
      </div>
    </Portal>
  );
};

/** Bloque de formulario con título, para ordenar los modales de edición por secciones. */
export const FormSection: React.FC<{
  title: string;
  description?: string;
  icon?: React.ElementType;
  children: React.ReactNode;
  className?: string;
}> = ({ title, description, icon: Icon, children, className = '' }) => (
  <section className={`rounded-2xl border border-slate-100 bg-white p-4 sm:p-5 space-y-4 ${className}`}>
    <div className="flex items-start gap-2.5">
      {Icon && (
        <div className="w-8 h-8 rounded-xl bg-sky-50 text-[#0284C7] flex items-center justify-center shrink-0">
          <Icon className="w-4 h-4" />
        </div>
      )}
      <div>
        <h4 className="text-sm font-black text-slate-900">{title}</h4>
        {description && <p className="text-[11px] text-slate-500 mt-0.5">{description}</p>}
      </div>
    </div>
    {children}
  </section>
);

export const Field: React.FC<{
  label: string;
  required?: boolean;
  hint?: string;
  error?: string;
  className?: string;
  children: React.ReactNode;
}> = ({ label, required, hint, error, className = '', children }) => (
  <label className={`block space-y-1 ${className}`}>
    <span className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider">
      {label}
      {required && <span className="text-[#0284C7] ml-0.5">*</span>}
    </span>
    {children}
    {hint && !error && <span className="block text-[10px] text-slate-400">{hint}</span>}
    {error && (
      <span className="flex items-center gap-1 text-[11px] text-red-600 font-semibold">
        <AlertCircle className="w-3 h-3" /> {error}
      </span>
    )}
  </label>
);

const inputCls =
  'w-full px-3.5 py-2.5 text-sm rounded-xl border border-slate-200 bg-slate-50 text-slate-900 outline-none transition-all focus:bg-white focus:border-sky-400 focus:ring-2 focus:ring-sky-100';

export const TextInput: React.FC<React.InputHTMLAttributes<HTMLInputElement>> = ({ className = '', ...props }) => (
  <input {...props} className={`${inputCls} ${className}`} />
);

export const TextArea: React.FC<React.TextareaHTMLAttributes<HTMLTextAreaElement>> = ({ className = '', ...props }) => (
  <textarea rows={3} {...props} className={`${inputCls} resize-y ${className}`} />
);

export const SelectInput: React.FC<React.SelectHTMLAttributes<HTMLSelectElement>> = ({ className = '', ...props }) => (
  <select {...props} className={`${inputCls} cursor-pointer ${className}`} />
);

export const Toggle: React.FC<{ checked: boolean; onChange: (v: boolean) => void; label: string; hint?: string }> = ({
  checked,
  onChange,
  label,
  hint,
}) => (
  <button
    type="button"
    onClick={() => onChange(!checked)}
    className={`w-full flex items-center justify-between gap-3 p-3 rounded-xl border text-left transition-colors cursor-pointer ${
      checked ? 'border-sky-300 bg-sky-50' : 'border-slate-200 bg-slate-50'
    }`}
  >
    <span>
      <span className="block text-xs font-bold text-slate-800">{label}</span>
      {hint && <span className="block text-[10px] text-slate-500">{hint}</span>}
    </span>
    <span className={`relative w-10 h-6 rounded-full transition-colors shrink-0 ${checked ? 'bg-[#0284C7]' : 'bg-slate-300'}`}>
      <span
        className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-all ${checked ? 'left-5' : 'left-1'}`}
      />
    </span>
  </button>
);

/** Imagen por URL o subida desde el dispositivo (se guarda como data URL). */
export const ImageInput: React.FC<{ value: string; onChange: (v: string) => void; aspect?: 'wide' | 'square' }> = ({
  value,
  onChange,
  aspect = 'wide',
}) => {
  const fileRef = useRef<HTMLInputElement>(null);
  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) onChange(await readFileAsDataUrl(file));
  };
  return (
    <div className="flex gap-3 items-start">
      <div
        className={`${aspect === 'wide' ? 'w-28 h-20' : 'w-20 h-20'} rounded-xl overflow-hidden bg-slate-100 border border-slate-200 shrink-0 flex items-center justify-center`}
      >
        {value ? (
          <img src={value} alt="" className="w-full h-full object-cover" />
        ) : (
          <ImagePlus className="w-6 h-6 text-slate-300" />
        )}
      </div>
      <div className="flex-1 space-y-2 min-w-0">
        <TextInput
          value={value.startsWith('data:') ? '' : value}
          placeholder={value.startsWith('data:') ? 'Imagen subida desde el dispositivo' : 'https://… (URL de la imagen)'}
          onChange={(e) => onChange(e.target.value)}
        />
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" icon={Upload} onClick={() => fileRef.current?.click()}>
            Subir imagen
          </Button>
          {value && (
            <Button variant="ghost" size="sm" onClick={() => onChange('')}>
              Quitar
            </Button>
          )}
        </div>
        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />
      </div>
    </div>
  );
};

export const SearchInput: React.FC<{ value: string; onChange: (v: string) => void; placeholder?: string; className?: string }> = ({
  value,
  onChange,
  placeholder = 'Buscar…',
  className = '',
}) => (
  <div className={`relative ${className}`}>
    <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
    <input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className={`${inputCls} pl-9 py-2 text-xs`}
    />
  </div>
);

/** Selector de campamento para filtrar (usa el filtro global del admin). */
export const CampFilterSelect: React.FC<{ className?: string; includeAll?: boolean; inSidebar?: boolean }> = ({
  className = '',
  includeAll = true,
  inSidebar = false,
}) => {
  const { camps, adminCampFilter, setAdminCampFilter } = useCamp();
  const sorted = [...camps].sort((a, b) => a.startDate.localeCompare(b.startDate));
  return (
    // En escritorio el filtro vive en la barra lateral del admin; en las páginas solo se muestra en pantallas menores
    <div className={`relative ${inSidebar ? '' : 'lg:hidden'} ${className}`}>
      <Tent className="w-4 h-4 text-[#0284C7] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
      <select
        value={adminCampFilter}
        onChange={(e) => setAdminCampFilter(e.target.value)}
        className={`${inputCls} pl-9 py-2 text-xs font-bold cursor-pointer`}
      >
        {includeAll && <option value="ALL">Todos los campamentos ({camps.length})</option>}
        {sorted.map((c) => (
          <option key={c.id} value={c.id}>
            {c.isFeatured ? '★ ' : ''}
            {c.name} · {c.startDate.slice(5).split('-').reverse().join('/')}
          </option>
        ))}
      </select>
    </div>
  );
};

export const EmptyState: React.FC<{ icon: React.ElementType; title: string; description?: string; action?: React.ReactNode }> = ({
  icon: Icon,
  title,
  description,
  action,
}) => (
  <div className="text-center py-14 px-6">
    <div className="w-14 h-14 rounded-2xl bg-sky-50 text-sky-500 flex items-center justify-center mx-auto">
      <Icon className="w-7 h-7" />
    </div>
    <h4 className="mt-3 text-sm font-black text-slate-800">{title}</h4>
    {description && <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">{description}</p>}
    {action && <div className="mt-4 flex justify-center">{action}</div>}
  </div>
);

export const Badge: React.FC<{ children: React.ReactNode; className?: string; color?: string }> = ({
  children,
  className = '',
  color,
}) => (
  <span
    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${className}`}
    style={color ? { color, backgroundColor: `${color}14`, borderColor: `${color}40` } : undefined}
  >
    {children}
  </span>
);

/** Tabla responsiva simple. */
export const Table: React.FC<{ head: React.ReactNode; children: React.ReactNode }> = ({ head, children }) => (
  <Card className="overflow-hidden">
    <div className="overflow-x-auto">
      <table className="w-full text-left text-xs border-collapse">
        <thead className="bg-slate-50 border-b border-slate-100 text-[10px] text-slate-500 uppercase tracking-wider font-bold">
          {head}
        </thead>
        <tbody className="divide-y divide-slate-100 text-slate-700">{children}</tbody>
      </table>
    </div>
  </Card>
);
