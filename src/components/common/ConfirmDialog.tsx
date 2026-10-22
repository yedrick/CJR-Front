import React, { createContext, useCallback, useContext, useRef, useState, useMemo } from 'react';
import { AlertTriangle, CheckCircle2, Info, Trash2, X, XCircle } from 'lucide-react';
import { Portal, useEscapeKey, useLockBodyScroll } from './Portal';

type Tone = 'danger' | 'warning' | 'info' | 'success';

export interface ConfirmOptions {
  title: string;
  message?: React.ReactNode;
  /** Lista de consecuencias o datos que se muestran en un recuadro. */
  details?: React.ReactNode[];
  confirmText?: string;
  cancelText?: string;
  tone?: Tone;
  /** Exige escribir este texto para confirmar (borrados delicados). */
  requireText?: string;
}

export interface NotifyOptions {
  title: string;
  message?: React.ReactNode;
  details?: React.ReactNode[];
  tone?: Tone;
  okText?: string;
}

interface DialogState extends ConfirmOptions {
  mode: 'confirm' | 'notify';
}

interface ConfirmContextType {
  confirm: (opts: ConfirmOptions) => Promise<boolean>;
  notify: (opts: NotifyOptions) => Promise<void>;
}

const ConfirmContext = createContext<ConfirmContextType | undefined>(undefined);

const TONE: Record<Tone, { icon: React.ElementType; iconBox: string; button: string }> = {
  danger: { icon: Trash2, iconBox: 'bg-red-100 text-red-600', button: 'bg-red-600 hover:bg-red-700 text-white' },
  warning: { icon: AlertTriangle, iconBox: 'bg-amber-100 text-amber-600', button: 'bg-amber-500 hover:bg-amber-600 text-white' },
  info: { icon: Info, iconBox: 'bg-sky-100 text-sky-600', button: 'bg-[#0284C7] hover:bg-[#0369A1] text-white' },
  success: { icon: CheckCircle2, iconBox: 'bg-emerald-100 text-emerald-600', button: 'bg-emerald-600 hover:bg-emerald-700 text-white' },
};

export const ConfirmProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [dialog, setDialog] = useState<DialogState | null>(null);
  const [typed, setTyped] = useState('');
  const resolver = useRef<(v: boolean) => void>(() => undefined);

  const close = useCallback((value: boolean) => {
    resolver.current(value);
    setDialog(null);
    setTyped('');
  }, []);

  const confirm = useCallback(
    (opts: ConfirmOptions) =>
      new Promise<boolean>((resolve) => {
        resolver.current = resolve;
        setDialog({ tone: 'danger', ...opts, mode: 'confirm' });
      }),
    []
  );

  const notify = useCallback(
    (opts: NotifyOptions) =>
      new Promise<void>((resolve) => {
        resolver.current = () => resolve();
        setDialog({ tone: 'info', confirmText: opts.okText || 'Entendido', ...opts, mode: 'notify' });
      }),
    []
  );

  const value = useMemo(() => ({ confirm, notify }), [confirm, notify]);

  useLockBodyScroll(!!dialog);
  useEscapeKey(!!dialog, () => close(false));

  const tone = TONE[dialog?.tone || 'info'];
  const Icon = dialog?.mode === 'notify' && dialog.tone === 'danger' ? XCircle : tone.icon;
  const blocked = !!dialog?.requireText && typed.trim().toUpperCase() !== dialog.requireText.toUpperCase();

  return (
    <ConfirmContext.Provider value={value}>
      {children}
      {dialog && (
        <Portal>
          <div
            className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-fade-in"
            onMouseDown={() => close(false)}
          >
            <div
              role="alertdialog"
              aria-modal="true"
              aria-label={dialog.title}
              className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl border border-slate-100 p-6 animate-pop-in"
              onMouseDown={(e) => e.stopPropagation()}
            >
              <button
                type="button"
                onClick={() => close(false)}
                className="absolute top-4 right-4 p-1.5 rounded-xl text-slate-400 hover:bg-slate-100 hover:text-slate-700 cursor-pointer"
                aria-label="Cerrar"
              >
                <X className="w-4 h-4" />
              </button>
              <div className={`w-14 h-14 rounded-2xl flex items-center justify-center ${tone.iconBox}`}>
                <Icon className="w-7 h-7" />
              </div>
              <h3 className="mt-4 text-lg font-black text-slate-900 font-display pr-6">{dialog.title}</h3>
              {dialog.message && <div className="mt-1.5 text-sm text-slate-600 leading-relaxed">{dialog.message}</div>}
              {dialog.details && dialog.details.length > 0 && (
                <ul className="mt-3 space-y-1.5 rounded-2xl bg-slate-50 border border-slate-100 p-3.5 text-xs text-slate-700">
                  {dialog.details.map((d, i) => (
                    <li key={i} className="flex gap-2">
                      <span className="text-slate-400">•</span>
                      <span>{d}</span>
                    </li>
                  ))}
                </ul>
              )}
              {dialog.requireText && (
                <label className="block mt-4 space-y-1">
                  <span className="text-[11px] font-bold text-slate-600">
                    Escribe <span className="font-mono font-black text-red-600">{dialog.requireText}</span> para confirmar
                  </span>
                  <input
                    autoFocus
                    value={typed}
                    onChange={(e) => setTyped(e.target.value)}
                    className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-slate-200 bg-slate-50 outline-none focus:bg-white focus:border-red-300 focus:ring-2 focus:ring-red-100 font-mono"
                  />
                </label>
              )}
              <div className="mt-6 flex flex-col-reverse sm:flex-row gap-2 sm:justify-end">
                {dialog.mode === 'confirm' && (
                  <button
                    type="button"
                    onClick={() => close(false)}
                    className="px-5 py-2.5 rounded-xl text-sm font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 cursor-pointer"
                  >
                    {dialog.cancelText || 'Cancelar'}
                  </button>
                )}
                <button
                  type="button"
                  autoFocus={!dialog.requireText}
                  disabled={blocked}
                  onClick={() => close(true)}
                  className={`px-5 py-2.5 rounded-xl text-sm font-black shadow-md cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${tone.button}`}
                >
                  {dialog.confirmText || (dialog.tone === 'danger' ? 'Sí, eliminar' : 'Confirmar')}
                </button>
              </div>
            </div>
          </div>
        </Portal>
      )}
    </ConfirmContext.Provider>
  );
};

export const useConfirm = () => {
  const ctx = useContext(ConfirmContext);
  if (!ctx) throw new Error('useConfirm must be used within a ConfirmProvider');
  return ctx;
};
