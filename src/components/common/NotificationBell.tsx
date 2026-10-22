import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import {
  AlertCircle,
  Bell,
  BellOff,
  BellRing,
  CheckCheck,
  CheckCircle2,
  FileUp,
  Info,
  Loader2,
  Megaphone,
  RefreshCw,
  Ticket,
  Wallet,
  X,
  XCircle,
} from 'lucide-react';
import { Portal, useEscapeKey } from './Portal';
import { useToast, type ToastType } from './Toast';
import { useAuth } from '../../context/AuthContext';
import { useCamp } from '../../context/CampContext';
import { notificationsApi } from '../../api/services';
import { matchView } from '../../auth/access';
import { env } from '../../config/env';
import type { AppNotification, NotificationType } from '../../types/camp';
import {
  getPermission,
  requestPermission,
  showLocalNotification,
  subscribePush,
  vapidConfigured,
  type PermissionStatus,
} from '../../pwa/notifications';
import { onPushReceived } from '../../pwa/registerSW';

// =========================================================
// Campana de notificaciones del encabezado (solo usuarios autenticados)
// =========================================================

const TYPE_STYLE: Record<NotificationType, { icon: React.ElementType; box: string; toast: ToastType }> = {
  payment_approved: { icon: CheckCircle2, box: 'bg-emerald-100 text-emerald-600', toast: 'success' },
  payment_rejected: { icon: XCircle, box: 'bg-red-100 text-red-600', toast: 'error' },
  voucher_submitted: { icon: FileUp, box: 'bg-violet-100 text-violet-600', toast: 'info' },
  announcement: { icon: Megaphone, box: 'bg-sky-100 text-sky-600', toast: 'info' },
  registration_created: { icon: Ticket, box: 'bg-amber-100 text-amber-600', toast: 'success' },
  payment_collected: { icon: Wallet, box: 'bg-teal-100 text-teal-600', toast: 'success' },
  system: { icon: Info, box: 'bg-slate-100 text-slate-600', toast: 'info' },
};

const REFRESH_TYPES: NotificationType[] = ['payment_approved', 'payment_rejected', 'payment_collected', 'voucher_submitted'];

/** Acepta ISO o "AAAA-MM-DD HH:mm[:ss]" (hora local). */
function parseDate(value: string): Date {
  const d = new Date(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}/.test(value) ? value.replace(' ', 'T') : value);
  return Number.isNaN(d.getTime()) ? new Date() : d;
}

export function timeAgo(value: string, now = Date.now()): string {
  const date = parseDate(value);
  const sec = Math.max(0, Math.round((now - date.getTime()) / 1000));
  if (sec < 45) return 'hace un momento';
  const min = Math.round(sec / 60);
  if (min < 60) return `hace ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `hace ${h} h`;
  const days = Math.round(h / 24);
  if (days === 1) return 'ayer';
  if (days < 7) return `hace ${days} días`;
  return date.toLocaleDateString('es-BO', { day: 'numeric', month: 'short', year: days > 300 ? 'numeric' : undefined });
}

interface PanelPos {
  mobile: boolean;
  top: number;
  right: number;
}

export const NotificationBell: React.FC = () => {
  const { currentUser, isAuthenticated } = useAuth();
  const { setActiveTab, refreshData } = useCamp();
  const { toast, toastError } = useToast();

  const [items, setItems] = useState<AppNotification[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [open, setOpen] = useState(false);
  const [permission, setPermission] = useState<PermissionStatus>(getPermission);
  const [enabling, setEnabling] = useState(false);
  const [pos, setPos] = useState<PanelPos | null>(null);

  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const seenIds = useRef<Set<string> | null>(null);
  const inFlight = useRef(false);
  const lastFetch = useRef(0);

  const unread = items.filter((n) => !n.read).length;

  const goTo = useCallback(
    (link?: string) => {
      if (!link) return;
      const { tab, params } = matchView(new URL(link, window.location.origin).pathname);
      if (tab !== 'not-found') setActiveTab(tab, params);
    },
    [setActiveTab]
  );

  // ── carga / polling ──
  const fetchNotifications = useCallback(
    async (opts: { manual?: boolean } = {}) => {
      if (inFlight.current) return;
      inFlight.current = true;
      lastFetch.current = Date.now();
      if (opts.manual) setLoading(true);
      try {
        const list = await notificationsApi.list();
        setItems(list);
        setError(false);
        setLoaded(true);

        // Notificaciones nuevas desde la carga anterior (en la primera carga no se avisa nada)
        if (seenIds.current) {
          const fresh = list.filter((n) => !n.read && !seenIds.current!.has(n.id));
          fresh.slice(0, 3).forEach((n) => {
            toast({
              type: TYPE_STYLE[n.type]?.toast || 'info',
              title: n.title,
              message: n.body,
              action: n.link ? { label: 'Ver', onClick: () => goTo(n.link) } : undefined,
            });
            // en pantalla ya se ve el toast: la notificación del sistema es para cuando la ventana no tiene el foco
            if (getPermission() === 'granted' && !document.hasFocus()) void showLocalNotification(n);
          });
          if (fresh.some((n) => REFRESH_TYPES.includes(n.type))) void refreshData();
        }
        seenIds.current = new Set(list.map((n) => n.id));
      } catch {
        // en el polling no se muestran toasts (evita el spam): el panel ofrece "Reintentar"
        setError(true);
      } finally {
        inFlight.current = false;
        if (opts.manual) setLoading(false);
      }
    },
    [toast, goTo, refreshData]
  );
  // el polling siempre llama a la versión más reciente (sin reiniciar el intervalo)
  const fetchRef = useRef(fetchNotifications);
  fetchRef.current = fetchNotifications;

  useEffect(() => {
    if (!isAuthenticated || !currentUser) return;
    const fetchNotifications = () => fetchRef.current();
    seenIds.current = null;
    setItems([]);
    setLoaded(false);
    void fetchNotifications();

    const interval = window.setInterval(() => {
      if (document.visibilityState === 'visible') void fetchNotifications();
    }, Math.max(5000, env.notificationsPollMs));

    const onVisible = () => {
      if (document.visibilityState === 'visible' && Date.now() - lastFetch.current > 5000) void fetchNotifications();
    };
    const offPush = onPushReceived(() => void fetchNotifications());
    window.addEventListener('focus', onVisible);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener('focus', onVisible);
      document.removeEventListener('visibilitychange', onVisible);
      offPush();
      seenIds.current = null;
    };
    // se reinicia solo cuando cambia el usuario (logout / otro login)
  }, [isAuthenticated, currentUser?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── posición del panel (portal: el header usa backdrop-blur y recortaría un `fixed`) ──
  const computePos = useCallback(() => {
    const btn = buttonRef.current;
    if (!btn) return;
    const mobile = window.innerWidth < 640;
    const header = btn.closest('header');
    const rect = btn.getBoundingClientRect();
    setPos({
      mobile,
      top: mobile ? (header?.getBoundingClientRect().bottom ?? rect.bottom + 8) : rect.bottom + 10,
      right: Math.max(12, window.innerWidth - rect.right - 8),
    });
  }, []);

  useLayoutEffect(() => {
    if (!open) return;
    computePos();
    window.addEventListener('resize', computePos);
    window.addEventListener('scroll', computePos, true);
    return () => {
      window.removeEventListener('resize', computePos);
      window.removeEventListener('scroll', computePos, true);
    };
  }, [open, computePos]);

  // cerrar al hacer clic fuera
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      const t = e.target as Node;
      if (panelRef.current?.contains(t) || buttonRef.current?.contains(t)) return;
      setOpen(false);
    };
    document.addEventListener('pointerdown', onDown);
    return () => document.removeEventListener('pointerdown', onDown);
  }, [open]);

  const close = useCallback(() => setOpen(false), []);
  useEscapeKey(open, close);

  const toggle = () => {
    const next = !open;
    setOpen(next);
    if (next) {
      setPermission(getPermission());
      if (Date.now() - lastFetch.current > 5000) void fetchNotifications();
    }
  };

  // ── acciones ──
  const openNotification = (n: AppNotification) => {
    if (!n.read) {
      setItems((prev) => prev.map((x) => (x.id === n.id ? { ...x, read: true } : x)));
      notificationsApi.read(n.id).catch(() => undefined);
    }
    setOpen(false);
    goTo(n.link);
  };

  const markAll = async () => {
    const prev = items;
    setItems((list) => list.map((n) => ({ ...n, read: true })));
    try {
      await notificationsApi.readAll();
    } catch (e) {
      setItems(prev);
      toastError(e, 'No se pudieron marcar como leídas');
    }
  };

  const enableDeviceNotifications = async () => {
    setEnabling(true);
    try {
      const p = await requestPermission();
      setPermission(p);
      if (p !== 'granted') return;
      if (vapidConfigured()) {
        const res = await subscribePush();
        toast(
          res.ok
            ? { type: 'success', title: 'Notificaciones activadas', message: 'Recibirás avisos aunque la app esté cerrada.' }
            : { type: 'warning', title: 'Notificaciones activadas (solo con la app abierta)', message: res.message }
        );
      } else {
        toast({ type: 'success', title: 'Notificaciones activadas', message: 'Te avisaremos en este dispositivo mientras la app esté abierta.' });
      }
    } finally {
      setEnabling(false);
    }
  };

  if (!isAuthenticated) return null;

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        onClick={toggle}
        aria-label={unread ? `Notificaciones: ${unread} sin leer` : 'Notificaciones'}
        aria-expanded={open}
        aria-haspopup="dialog"
        className={`relative w-10 h-10 rounded-2xl flex items-center justify-center border transition-colors cursor-pointer ${
          open ? 'bg-sky-50 border-sky-300 text-[#0284C7]' : 'bg-slate-50 border-slate-200 text-slate-600 hover:border-sky-300 hover:text-[#0284C7]'
        }`}
      >
        {unread > 0 ? <BellRing className="w-[18px] h-[18px]" /> : <Bell className="w-[18px] h-[18px]" />}
        {unread > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] font-black leading-[18px] text-center ring-2 ring-white">
            {unread > 99 ? '99+' : unread}
          </span>
        )}
      </button>

      {open && pos && (
        <Portal>
          {pos.mobile && (
            <div className="fixed inset-x-0 bottom-0 z-[54] bg-slate-900/30 animate-fade-in no-print" style={{ top: pos.top }} aria-hidden />
          )}
          <div
            ref={panelRef}
            role="dialog"
            aria-label="Notificaciones"
            className={`fixed z-[55] bg-white shadow-2xl border border-slate-100 flex flex-col overflow-hidden animate-fade-in no-print ${
              pos.mobile ? 'inset-x-0 rounded-b-3xl border-t-0' : 'w-[380px] rounded-3xl'
            }`}
            style={
              pos.mobile
                ? { top: pos.top, maxHeight: `calc(100dvh - ${pos.top}px - 5.5rem)` }
                : { top: pos.top, right: pos.right, maxHeight: `min(560px, calc(100dvh - ${pos.top}px - 1.5rem))` }
            }
          >
            {/* encabezado */}
            <div className="flex items-center justify-between gap-2 px-4 sm:px-5 py-3.5 border-b border-slate-100 shrink-0">
              <div className="min-w-0">
                <h3 className="text-sm font-black text-slate-900 font-display">Notificaciones</h3>
                <p className="text-[11px] text-slate-500">{unread ? `${unread} sin leer` : 'Estás al día'}</p>
              </div>
              <div className="flex items-center gap-1">
                {unread > 0 && (
                  <button
                    type="button"
                    onClick={markAll}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-[11px] font-bold text-[#0284C7] hover:bg-sky-50 cursor-pointer"
                  >
                    <CheckCheck className="w-3.5 h-3.5" /> Marcar todas como leídas
                  </button>
                )}
                <button
                  type="button"
                  onClick={close}
                  aria-label="Cerrar"
                  className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* permiso del dispositivo */}
            {permission === 'default' && (
              <div className="mx-3 mt-3 p-3 rounded-2xl bg-sky-50 border border-sky-100 flex items-center gap-3 shrink-0">
                <div className="w-9 h-9 rounded-xl bg-white text-[#0284C7] flex items-center justify-center shrink-0 shadow-sm">
                  <BellRing className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-black text-slate-800">Activar notificaciones en este dispositivo</p>
                  <p className="text-[10px] text-slate-500">Entérate al instante cuando aprueben tu pago.</p>
                </div>
                <button
                  type="button"
                  disabled={enabling}
                  onClick={enableDeviceNotifications}
                  className="px-3 py-2 rounded-xl bg-[#0284C7] hover:bg-[#0369A1] text-white text-[11px] font-black shrink-0 cursor-pointer disabled:opacity-60"
                >
                  {enabling ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Activar'}
                </button>
              </div>
            )}
            {permission === 'denied' && (
              <div className="mx-3 mt-3 p-3 rounded-2xl bg-slate-50 border border-slate-100 flex items-start gap-2.5 shrink-0">
                <BellOff className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                <p className="text-[11px] text-slate-500 leading-relaxed">
                  Bloqueaste las notificaciones de este sitio. Para recibirlas, actívalas desde el candado de la barra de direcciones o
                  los ajustes del navegador.
                </p>
              </div>
            )}

            {/* error con reintento */}
            {error && (
              <div className="mx-3 mt-3 p-3 rounded-2xl bg-amber-50 border border-amber-100 flex items-center gap-2.5 shrink-0">
                <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                <p className="flex-1 text-[11px] font-semibold text-amber-800">
                  {loaded ? 'No se pudieron actualizar las notificaciones.' : 'No se pudieron cargar las notificaciones.'}
                </p>
                <button
                  type="button"
                  onClick={() => fetchNotifications({ manual: true })}
                  disabled={loading}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-white border border-amber-200 text-[11px] font-bold text-amber-800 hover:bg-amber-100 cursor-pointer"
                >
                  <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} /> Reintentar
                </button>
              </div>
            )}

            {/* lista */}
            <div className="flex-1 overflow-y-auto overscroll-contain py-2">
              {!loaded && !error ? (
                <div className="space-y-2 px-3 py-1">
                  {[0, 1, 2].map((i) => (
                    <div key={i} className="flex gap-3 p-2.5 animate-pulse">
                      <div className="w-9 h-9 rounded-xl bg-slate-100 shrink-0" />
                      <div className="flex-1 space-y-2 py-1">
                        <div className="h-2.5 bg-slate-100 rounded w-2/3" />
                        <div className="h-2 bg-slate-100 rounded w-full" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : items.length === 0 && loaded ? (
                <div className="text-center py-10 px-6">
                  <div className="w-12 h-12 rounded-2xl bg-sky-50 text-sky-400 flex items-center justify-center mx-auto">
                    <Bell className="w-6 h-6" />
                  </div>
                  <p className="mt-3 text-sm font-black text-slate-700">Sin notificaciones</p>
                  <p className="text-[11px] text-slate-500 mt-0.5">Aquí verás los avisos de tus pagos e inscripciones.</p>
                </div>
              ) : (
                <ul className="px-2">
                  {items.map((n) => {
                    const s = TYPE_STYLE[n.type] || TYPE_STYLE.system;
                    const Icon = s.icon;
                    return (
                      <li key={n.id}>
                        <button
                          type="button"
                          onClick={() => openNotification(n)}
                          className={`w-full text-left flex gap-3 p-2.5 rounded-2xl transition-colors cursor-pointer ${
                            n.read ? 'hover:bg-slate-50' : 'bg-sky-50/60 hover:bg-sky-50'
                          }`}
                        >
                          <span className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${s.box}`}>
                            <Icon className="w-4 h-4" />
                          </span>
                          <span className="flex-1 min-w-0">
                            <span className="flex items-start gap-2">
                              <span className={`flex-1 text-xs leading-snug ${n.read ? 'font-bold text-slate-700' : 'font-black text-slate-900'}`}>
                                {n.title}
                              </span>
                              {!n.read && <span className="w-2 h-2 rounded-full bg-[#0284C7] shrink-0 mt-1" aria-label="Sin leer" />}
                            </span>
                            <span className="block text-[11px] text-slate-500 leading-relaxed mt-0.5 line-clamp-3">{n.body}</span>
                            <span className="block text-[10px] font-semibold text-slate-400 mt-1">{timeAgo(n.createdAt)}</span>
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </div>
        </Portal>
      )}
    </>
  );
};
