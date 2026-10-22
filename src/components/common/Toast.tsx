import React, { createContext, useCallback, useContext, useRef, useState, useMemo } from 'react';
import { AlertTriangle, CheckCircle2, Info, ShieldAlert, WifiOff, X, XCircle } from 'lucide-react';
import { Portal } from './Portal';
import { ApiError, errorMessage, isApiError } from '../../api/errors';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface ToastOptions {
  type?: ToastType;
  title: string;
  message?: string;
  /** milisegundos; 0 = no se cierra solo */
  duration?: number;
  action?: { label: string; onClick: () => void };
}

interface ToastItem extends ToastOptions {
  id: number;
}

interface ToastContextType {
  toast: (opts: ToastOptions) => number;
  dismiss: (id: number) => void;
  /** Muestra un error de la API con un título según el código HTTP. */
  toastError: (e: unknown, fallbackTitle?: string) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

const STYLE: Record<ToastType, { icon: React.ElementType; bar: string; iconCls: string }> = {
  success: { icon: CheckCircle2, bar: 'bg-emerald-500', iconCls: 'text-emerald-500' },
  error: { icon: XCircle, bar: 'bg-red-500', iconCls: 'text-red-500' },
  warning: { icon: AlertTriangle, bar: 'bg-amber-500', iconCls: 'text-amber-500' },
  info: { icon: Info, bar: 'bg-sky-500', iconCls: 'text-sky-500' },
};

export function apiErrorTitle(e: unknown): string {
  if (!isApiError(e)) return 'Ocurrió un error';
  switch (e.status) {
    case 0:
      return e.code === 'TIMEOUT' ? 'Tiempo de espera agotado' : 'Sin conexión';
    case 400:
      return 'Solicitud no válida (400)';
    case 401:
      return 'Sesión expirada (401)';
    case 403:
      return 'Acceso denegado (403)';
    case 404:
      return 'No encontrado (404)';
    case 409:
      return 'Conflicto (409)';
    case 413:
      return 'Archivo muy grande (413)';
    case 422:
      return 'Datos no válidos (422)';
    case 429:
      return 'Demasiados intentos (429)';
    default:
      return e.status >= 500 ? `Error del servidor (${e.status})` : `Error ${e.status}`;
  }
}

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [items, setItems] = useState<ToastItem[]>([]);
  const seq = useRef(0);

  const dismiss = useCallback((id: number) => setItems((prev) => prev.filter((t) => t.id !== id)), []);

  const toast = useCallback(
    (opts: ToastOptions) => {
      const id = ++seq.current;
      setItems((prev) => [...prev.slice(-3), { type: 'info', duration: 4500, ...opts, id }]);
      const duration = opts.duration ?? (opts.type === 'error' ? 7000 : 4500);
      if (duration > 0) setTimeout(() => dismiss(id), duration);
      return id;
    },
    [dismiss]
  );

  const toastError = useCallback(
    (e: unknown, fallbackTitle?: string) => {
      const status = e instanceof ApiError ? e.status : -1;
      toast({
        type: status === 409 || status === 422 || status === 429 ? 'warning' : 'error',
        title: fallbackTitle && status < 0 ? fallbackTitle : apiErrorTitle(e),
        message: errorMessage(e),
      });
    },
    [toast]
  );

  const value = useMemo(() => ({ toast, dismiss, toastError }), [toast, dismiss, toastError]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <Portal>
        <div
          aria-live="polite"
          className="fixed z-[90] top-3 left-3 right-3 sm:left-auto sm:top-auto sm:bottom-5 sm:right-5 sm:w-96 flex flex-col gap-2 pointer-events-none no-print"
        >
          {items.map((t) => {
            const s = STYLE[t.type || 'info'];
            const Icon = t.title.startsWith('Acceso denegado') ? ShieldAlert : t.title.startsWith('Sin conexión') ? WifiOff : s.icon;
            return (
              <div
                key={t.id}
                role="status"
                className="pointer-events-auto relative overflow-hidden bg-white rounded-2xl shadow-2xl border border-slate-100 pl-4 pr-10 py-3.5 flex gap-3 animate-slide-in-right"
              >
                <span className={`absolute left-0 top-0 bottom-0 w-1 ${s.bar}`} />
                <Icon className={`w-5 h-5 shrink-0 mt-0.5 ${s.iconCls}`} />
                <div className="min-w-0">
                  <p className="text-sm font-black text-slate-900">{t.title}</p>
                  {t.message && <p className="text-xs text-slate-600 mt-0.5 leading-relaxed">{t.message}</p>}
                  {t.action && (
                    <button
                      type="button"
                      onClick={() => {
                        t.action!.onClick();
                        dismiss(t.id);
                      }}
                      className="mt-2 text-xs font-black text-[#0284C7] hover:underline cursor-pointer"
                    >
                      {t.action.label}
                    </button>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => dismiss(t.id)}
                  className="absolute top-2.5 right-2.5 p-1 rounded-lg text-slate-400 hover:bg-slate-100 cursor-pointer"
                  aria-label="Cerrar aviso"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            );
          })}
        </div>
      </Portal>
    </ToastContext.Provider>
  );
};

export const useToast = () => {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within a ToastProvider');
  return ctx;
};
