// Notificaciones del sistema (locales y Web Push).
import { env } from '../config/env';
import { notificationsApi } from '../api/services';
import type { AppNotification } from '../types/camp';
import { navigateInApp, pwaStore } from './registerSW';

export type PermissionStatus = NotificationPermission | 'unsupported';

export const notificationsSupported = () => typeof window !== 'undefined' && 'Notification' in window;

export const pushSupported = () =>
  typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window && notificationsSupported();

export const vapidConfigured = () => env.vapidPublicKey.trim().length > 0;

/** Estado del permiso de notificaciones de este dispositivo. */
export function getPermission(): PermissionStatus {
  return notificationsSupported() ? Notification.permission : 'unsupported';
}

/** Pide permiso al usuario (debe llamarse desde un clic). */
export async function requestPermission(): Promise<PermissionStatus> {
  if (!notificationsSupported()) return 'unsupported';
  if (Notification.permission !== 'default') return Notification.permission;
  try {
    return await Notification.requestPermission();
  } catch {
    // Safari antiguo usa la versión con callback
    return new Promise<PermissionStatus>((resolve) => {
      try {
        Notification.requestPermission((p) => resolve(p));
      } catch {
        resolve('unsupported');
      }
    });
  }
}

/** Registro del SW activo, sin quedarse esperando si no hay ninguno (ej. en desarrollo). */
async function activeRegistration(): Promise<ServiceWorkerRegistration | null> {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return null;
  try {
    const reg = await navigator.serviceWorker.getRegistration();
    return reg?.active ? reg : null;
  } catch {
    return null;
  }
}

/**
 * Muestra una notificación del sistema. Usa el service worker si existe (necesario en Android);
 * si no (desarrollo), usa `new Notification`. Devuelve false si no hay permiso o no es posible.
 */
export async function showLocalNotification(n: Pick<AppNotification, 'id' | 'title' | 'body' | 'link'>): Promise<boolean> {
  if (getPermission() !== 'granted') return false;
  const options: NotificationOptions = {
    body: n.body,
    icon: '/icons/icon-192.png',
    badge: '/icons/favicon-32.png',
    tag: n.id,
    lang: 'es',
    data: { link: n.link || '/' },
  };
  const reg = await activeRegistration();
  if (reg) {
    try {
      await reg.showNotification(n.title, options);
      return true;
    } catch {
      /* se intenta con la API directa */
    }
  }
  try {
    const notification = new Notification(n.title, options);
    notification.onclick = () => {
      window.focus();
      if (n.link) navigateInApp(n.link);
      notification.close();
    };
    return true;
  } catch {
    // Android Chrome no permite `new Notification` sin service worker
    return false;
  }
}

/** Convierte la clave pública VAPID (base64url) al formato que pide pushManager.subscribe. */
export function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  const output = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) output[i] = raw.charCodeAt(i);
  return output;
}

export type PushSubscribeResult =
  | { ok: true; endpoint: string }
  | { ok: false; reason: 'unsupported' | 'no-vapid' | 'no-service-worker' | 'denied' | 'error'; message: string };

/**
 * Suscribe este dispositivo a Web Push y envía la suscripción al backend.
 * No hace nada (y lo explica en `message`) si falta la clave VAPID, el SW o el soporte del navegador.
 */
export async function subscribePush(): Promise<PushSubscribeResult> {
  if (!pushSupported()) return { ok: false, reason: 'unsupported', message: 'Este navegador no soporta notificaciones push.' };
  if (!vapidConfigured())
    return { ok: false, reason: 'no-vapid', message: 'Push no configurado (falta VITE_VAPID_PUBLIC_KEY): solo avisos dentro de la app.' };
  const reg = await activeRegistration();
  if (!reg)
    return { ok: false, reason: 'no-service-worker', message: 'El service worker no está activo (solo funciona en el build de producción).' };
  const permission = await requestPermission();
  if (permission !== 'granted') return { ok: false, reason: 'denied', message: 'No se concedió el permiso de notificaciones.' };
  try {
    const existing = await reg.pushManager.getSubscription();
    const sub =
      existing ||
      (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(env.vapidPublicKey.trim()) }));
    await notificationsApi.subscribePush(sub.toJSON());
    return { ok: true, endpoint: sub.endpoint };
  } catch (e) {
    return { ok: false, reason: 'error', message: e instanceof Error ? e.message : 'No se pudo activar push.' };
  }
}

export interface PushDiagnostics {
  permission: PermissionStatus;
  pwaEnabled: boolean;
  swSupported: boolean;
  swActive: boolean;
  pushSupported: boolean;
  vapidConfigured: boolean;
  subscribed: boolean;
  isStandalone: boolean;
  swVersion: string | null;
}

/** Resumen del estado de notificaciones/PWA en este dispositivo (para el panel). */
export async function getPushDiagnostics(): Promise<PushDiagnostics> {
  const reg = await activeRegistration();
  let subscribed = false;
  if (reg && 'pushManager' in reg) {
    try {
      subscribed = !!(await reg.pushManager.getSubscription());
    } catch {
      subscribed = false;
    }
  }
  const s = pwaStore.get();
  return {
    permission: getPermission(),
    pwaEnabled: env.enablePwa && import.meta.env.PROD,
    swSupported: s.swSupported,
    swActive: !!reg,
    pushSupported: pushSupported(),
    vapidConfigured: vapidConfigured(),
    subscribed,
    isStandalone: s.isStandalone,
    swVersion: s.swVersion,
  };
}
