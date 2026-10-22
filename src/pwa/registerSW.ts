// Registro del service worker + estado global de la PWA (instalación, actualización, conexión).
// Se usa desde React con usePwa() (useSyncExternalStore). Sin dependencias externas.
import { useSyncExternalStore } from 'react';
import { env } from '../config/env';

/** Evento no estándar de Chrome/Edge/Android para instalar la app. */
export interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
  prompt(): Promise<void>;
}

export interface PwaState {
  /** el navegador soporta service workers */
  swSupported: boolean;
  /** hay un service worker controlando esta página */
  swActive: boolean;
  /** hay una versión nueva esperando para activarse */
  updateAvailable: boolean;
  offline: boolean;
  /** se puede ofrecer "Instalar app" (beforeinstallprompt) */
  canInstall: boolean;
  /** la app se abrió instalada (pantalla de inicio) */
  isStandalone: boolean;
  isIOS: boolean;
  /** versión del build informada por el service worker */
  swVersion: string | null;
}

const isBrowser = typeof window !== 'undefined';

const detectStandalone = () =>
  isBrowser &&
  (window.matchMedia?.('(display-mode: standalone)').matches ||
    // Safari iOS
    (navigator as Navigator & { standalone?: boolean }).standalone === true);

const detectIOS = () => {
  if (!isBrowser) return false;
  const ua = navigator.userAgent;
  // iPadOS 13+ se presenta como Mac con pantalla táctil
  return /iPad|iPhone|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
};

let state: PwaState = {
  swSupported: isBrowser && 'serviceWorker' in navigator,
  swActive: isBrowser && 'serviceWorker' in navigator && !!navigator.serviceWorker.controller,
  updateAvailable: false,
  offline: isBrowser ? !navigator.onLine : false,
  canInstall: false,
  isStandalone: detectStandalone(),
  isIOS: detectIOS(),
  swVersion: null,
};

const listeners = new Set<() => void>();
const setState = (patch: Partial<PwaState>) => {
  state = { ...state, ...patch };
  listeners.forEach((l) => l());
};

export const pwaStore = {
  get: () => state,
  subscribe(cb: () => void) {
    listeners.add(cb);
    return () => {
      listeners.delete(cb);
    };
  },
};

/** Hook React con el estado de la PWA. */
export const usePwa = () => useSyncExternalStore(pwaStore.subscribe, pwaStore.get, pwaStore.get);

// ───────────────────────────── navegación pedida por el SW ─────────────────────────────
type NavigateHandler = (path: string) => void;
let navigateHandler: NavigateHandler | null = null;
let pendingNavigation: string | null = null;

/** La app registra cómo navegar (ej. setActiveTab(tabForPath(path))). Devuelve la función para quitarlo. */
export function setNavigateHandler(fn: NavigateHandler | null) {
  navigateHandler = fn;
  if (fn && pendingNavigation) {
    const p = pendingNavigation;
    pendingNavigation = null;
    fn(p);
  }
  return () => {
    if (navigateHandler === fn) navigateHandler = null;
  };
}

/** Navega dentro de la SPA (o guarda el pedido hasta que la app registre el handler). */
export function navigateInApp(path: string) {
  if (navigateHandler) navigateHandler(path);
  else pendingNavigation = path;
}

// ───────────────────────────── push recibido (para refrescar la campana) ─────────────────────────────
const pushListeners = new Set<(payload: unknown) => void>();
export function onPushReceived(cb: (payload: unknown) => void) {
  pushListeners.add(cb);
  return () => {
    pushListeners.delete(cb);
  };
}

// ───────────────────────────── instalación ─────────────────────────────
let deferredPrompt: BeforeInstallPromptEvent | null = null;

/** Muestra el diálogo nativo de instalación. Devuelve true si el usuario aceptó. */
export async function promptInstall(): Promise<boolean> {
  if (!deferredPrompt) return false;
  const evt = deferredPrompt;
  deferredPrompt = null;
  setState({ canInstall: false });
  try {
    await evt.prompt();
    const choice = await evt.userChoice;
    return choice.outcome === 'accepted';
  } catch {
    return false;
  }
}

// ───────────────────────────── actualización ─────────────────────────────
let registration: ServiceWorkerRegistration | null = null;
let updateRequested = false;

/** Activa la versión que está esperando y recarga la página cuando toma el control. */
export function applyUpdate() {
  const waiting = registration?.waiting;
  if (!waiting) {
    window.location.reload();
    return;
  }
  updateRequested = true;
  waiting.postMessage({ type: 'SKIP_WAITING' });
  // por si controllerchange no llega (navegadores antiguos)
  setTimeout(() => {
    if (updateRequested) window.location.reload();
  }, 4000);
}

function trackRegistration(reg: ServiceWorkerRegistration) {
  registration = reg;
  const markIfWaiting = () => {
    // solo es "actualización" si ya había una versión controlando la página
    if (reg.waiting && navigator.serviceWorker.controller) setState({ updateAvailable: true });
  };
  markIfWaiting();
  reg.addEventListener('updatefound', () => {
    const installing = reg.installing;
    if (!installing) return;
    installing.addEventListener('statechange', () => {
      if (installing.state === 'installed') markIfWaiting();
      if (installing.state === 'activated') {
        setState({ swActive: !!navigator.serviceWorker.controller });
        requestVersion();
      }
    });
  });
}

function requestVersion() {
  const controller = navigator.serviceWorker?.controller;
  if (controller) controller.postMessage({ type: 'GET_VERSION' });
}

// ───────────────────────────── inicialización ─────────────────────────────
let initialized = false;

/**
 * Llamar una vez desde main.tsx. Siempre escucha conexión e instalación; el service worker solo se
 * registra en el build de producción (vite build) y si VITE_ENABLE_PWA=true, así `vite dev` y el HMR
 * no se ven afectados.
 */
export function initPwa() {
  if (!isBrowser || initialized) return;
  initialized = true;

  window.addEventListener('online', () => setState({ offline: false }));
  window.addEventListener('offline', () => setState({ offline: true }));

  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e as BeforeInstallPromptEvent;
    setState({ canInstall: true });
  });
  window.addEventListener('appinstalled', () => {
    deferredPrompt = null;
    setState({ canInstall: false, isStandalone: true });
  });
  window.matchMedia?.('(display-mode: standalone)').addEventListener?.('change', () => setState({ isStandalone: detectStandalone() }));

  if (!('serviceWorker' in navigator)) return;
  const sw = navigator.serviceWorker;

  sw.addEventListener('message', (event: MessageEvent) => {
    const data = (event.data || {}) as { type?: string; url?: string; version?: string; payload?: unknown };
    if (data.type === 'NAVIGATE' && data.url) navigateInApp(data.url);
    else if (data.type === 'VERSION' && data.version) setState({ swVersion: data.version });
    else if (data.type === 'PUSH_RECEIVED') pushListeners.forEach((l) => l(data.payload));
  });

  sw.addEventListener('controllerchange', () => {
    setState({ swActive: !!sw.controller });
    if (updateRequested) {
      updateRequested = false;
      window.location.reload();
    }
  });

  if (!(import.meta.env.PROD && env.enablePwa)) {
    // Desarrollo o PWA desactivada: elimina un SW que haya quedado de un build anterior en este origen
    sw.getRegistrations()
      .then((regs) => regs.filter((r) => r.active?.scriptURL.endsWith('/sw.js')).forEach((r) => r.unregister()))
      .catch(() => undefined);
    return;
  }

  const register = () => {
    sw.register('/sw.js', { scope: '/' })
      .then((reg) => {
        trackRegistration(reg);
        requestVersion();
        // busca versiones nuevas al volver a la pestaña y cada hora
        document.addEventListener('visibilitychange', () => {
          if (document.visibilityState === 'visible') reg.update().catch(() => undefined);
        });
        setInterval(() => reg.update().catch(() => undefined), 60 * 60 * 1000);
      })
      .catch((err) => {
        if (env.appEnv === 'testing') console.warn('[pwa] No se pudo registrar el service worker', err);
      });
  };

  if (document.readyState === 'complete') register();
  else window.addEventListener('load', register, { once: true });
}
