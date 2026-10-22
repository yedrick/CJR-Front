import React, { useEffect, useRef, useState } from 'react';
import { Download, RefreshCw, Share, SquarePlus, Wifi, WifiOff, X } from 'lucide-react';
import { useCamp } from '../../context/CampContext';
import { useToast } from '../common/Toast';
import { tabForPath } from '../../auth/access';
import { applyUpdate, promptInstall, setNavigateHandler, usePwa } from '../../pwa/registerSW';

// =========================================================
// Avisos de la PWA: instalar la app, nueva versión y estado de conexión
// =========================================================

const INSTALL_DISMISSED_KEY = 'cjn.pwa.installDismissedAt';
const IOS_TIP_KEY = 'cjn.pwa.iosTipSeen';
const DISMISS_DAYS = 14;
const SHOW_DELAY_MS = 3500;

const storage = {
  get(key: string): string | null {
    try {
      return window.localStorage.getItem(key);
    } catch {
      return null;
    }
  },
  set(key: string, value: string) {
    try {
      window.localStorage.setItem(key, value);
    } catch {
      /* modo privado / almacenamiento bloqueado */
    }
  },
};

const installRecentlyDismissed = () => {
  const at = Number(storage.get(INSTALL_DISMISSED_KEY) || 0);
  return at > 0 && Date.now() - at < DISMISS_DAYS * 24 * 60 * 60 * 1000;
};

const isIOSSafari = () => !/CriOS|FxiOS|EdgiOS|OPiOS/.test(navigator.userAgent);

export const PwaPrompts: React.FC = () => {
  const pwa = usePwa();
  const { setActiveTab } = useCamp();
  const { toast } = useToast();

  // ── navegación pedida por el service worker (clic en una notificación) ──
  useEffect(
    () =>
      setNavigateHandler((path) => {
        const tab = tabForPath(new URL(path, window.location.origin).pathname);
        if (tab !== 'not-found') setActiveTab(tab);
      }),
    [setActiveTab]
  );

  // ── instalación ──
  const [ready, setReady] = useState(false);
  const [installDismissed, setInstallDismissed] = useState(installRecentlyDismissed);
  const [iosTipSeen, setIosTipSeen] = useState(() => storage.get(IOS_TIP_KEY) === '1');
  useEffect(() => {
    const t = setTimeout(() => setReady(true), SHOW_DELAY_MS);
    return () => clearTimeout(t);
  }, []);

  const showInstall = ready && pwa.canInstall && !pwa.isStandalone && !installDismissed;
  const showIosTip = ready && pwa.isIOS && isIOSSafari() && !pwa.isStandalone && !iosTipSeen && !showInstall;

  const dismissInstall = () => {
    storage.set(INSTALL_DISMISSED_KEY, String(Date.now()));
    setInstallDismissed(true);
  };
  const dismissIosTip = () => {
    storage.set(IOS_TIP_KEY, '1');
    setIosTipSeen(true);
  };
  const install = async () => {
    const accepted = await promptInstall();
    if (accepted) toast({ type: 'success', title: 'App instalada', message: 'Encuéntrala en la pantalla de inicio de tu dispositivo.' });
    else dismissInstall();
  };

  // ── nueva versión ──
  const [updateLater, setUpdateLater] = useState(false);
  const [updating, setUpdating] = useState(false);
  const showUpdate = pwa.updateAvailable && !updateLater;

  // ── conexión ──
  const [backOnline, setBackOnline] = useState(false);
  const wasOffline = useRef(pwa.offline);
  useEffect(() => {
    if (pwa.offline) {
      wasOffline.current = true;
      setBackOnline(false);
      return;
    }
    if (!wasOffline.current) return;
    wasOffline.current = false;
    setBackOnline(true);
    const t = setTimeout(() => setBackOnline(false), 3000);
    return () => clearTimeout(t);
  }, [pwa.offline]);

  return (
    <>
      {(pwa.offline || backOnline) && (
        <div
          role="status"
          aria-live="polite"
          className={`fixed top-0 inset-x-0 z-[70] no-print animate-fade-in pt-[env(safe-area-inset-top)] ${
            pwa.offline ? 'bg-amber-500 text-amber-950' : 'bg-emerald-500 text-white'
          }`}
        >
          <div className="max-w-7xl mx-auto px-4 py-1.5 flex items-center justify-center gap-2 text-[11px] sm:text-xs font-bold">
            {pwa.offline ? (
              <>
                <WifiOff className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate">Sin conexión: mostrando datos guardados</span>
              </>
            ) : (
              <>
                <Wifi className="w-3.5 h-3.5 shrink-0" />
                <span>Conexión restablecida</span>
              </>
            )}
          </div>
        </div>
      )}

      {(showUpdate || showInstall || showIosTip) && (
        <div className="fixed z-[60] left-3 right-3 bottom-20 sm:right-auto sm:w-[380px] lg:left-5 lg:bottom-5 flex flex-col gap-2 no-print pointer-events-none">
          {showUpdate && (
            <div
              role="alert"
              className="pointer-events-auto bg-slate-900 text-white rounded-3xl shadow-2xl p-4 flex items-center gap-3 animate-fade-in-up"
            >
              <div className="w-10 h-10 rounded-2xl bg-sky-500/20 text-sky-300 flex items-center justify-center shrink-0">
                <RefreshCw className={`w-5 h-5 ${updating ? 'animate-spin' : ''}`} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-black font-display leading-tight">Nueva versión disponible</p>
                <p className="text-[11px] text-slate-300 mt-0.5">Actualiza para obtener las últimas mejoras.</p>
              </div>
              <div className="flex flex-col sm:flex-row gap-1.5 shrink-0">
                <button
                  type="button"
                  disabled={updating}
                  onClick={() => {
                    setUpdating(true);
                    applyUpdate();
                  }}
                  className="px-3.5 py-2 rounded-xl bg-[#0284C7] hover:bg-sky-500 text-xs font-black cursor-pointer active:scale-95 transition-all disabled:opacity-60"
                >
                  {updating ? 'Actualizando…' : 'Actualizar'}
                </button>
                <button
                  type="button"
                  onClick={() => setUpdateLater(true)}
                  className="px-3 py-1.5 rounded-xl text-[11px] font-bold text-slate-300 hover:text-white hover:bg-white/10 cursor-pointer"
                >
                  Más tarde
                </button>
              </div>
            </div>
          )}

          {showInstall && (
            <div className="pointer-events-auto bg-white rounded-3xl shadow-2xl border border-sky-100 p-4 animate-fade-in-up">
              <div className="flex items-start gap-3">
                <img src="/icons/icon-192.png" alt="" className="w-12 h-12 rounded-2xl shadow-md shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-black text-slate-900 font-display leading-tight">Instala CJN en tu celular</p>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Abre tus credenciales más rápido, recibe avisos y úsala incluso sin conexión.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={dismissInstall}
                  aria-label="Cerrar"
                  className="p-1.5 -mr-1 -mt-1 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="flex gap-2 mt-3">
                <button
                  type="button"
                  onClick={install}
                  className="flex-1 inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-[#0284C7] hover:bg-[#0369A1] text-white text-xs font-black shadow-md cursor-pointer active:scale-95 transition-all"
                >
                  <Download className="w-4 h-4" /> Instalar app
                </button>
                <button
                  type="button"
                  onClick={dismissInstall}
                  className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 cursor-pointer"
                >
                  Ahora no
                </button>
              </div>
            </div>
          )}

          {showIosTip && (
            <div className="pointer-events-auto bg-white rounded-3xl shadow-2xl border border-sky-100 p-4 animate-fade-in-up">
              <div className="flex items-start gap-3">
                <img src="/icons/apple-touch-icon.png" alt="" className="w-11 h-11 rounded-2xl shadow-md shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-black text-slate-900 font-display leading-tight">Agrega CJN a tu pantalla de inicio</p>
                  <p className="text-[11px] text-slate-600 mt-1 leading-relaxed">
                    Toca{' '}
                    <span className="inline-flex items-center gap-0.5 font-bold text-[#0284C7]">
                      Compartir <Share className="w-3.5 h-3.5" />
                    </span>{' '}
                    → <span className="inline-flex items-center gap-0.5 font-bold text-[#0284C7]">
                      Agregar a inicio <SquarePlus className="w-3.5 h-3.5" />
                    </span>
                  </p>
                </div>
                <button
                  type="button"
                  onClick={dismissIosTip}
                  aria-label="Entendido"
                  className="p-1.5 -mr-1 -mt-1 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </>
  );
};
