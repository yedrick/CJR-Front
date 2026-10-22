// Almacenamiento de tokens.
//  · access token: SOLO en memoria (no queda expuesto en localStorage ante XSS).
//  · refresh token: en localStorage para mantener la sesión al recargar.
//    En producción, el backend debería enviarlo como cookie httpOnly + Secure + SameSite=Strict
//    y este módulo dejaría de guardarlo.
const REFRESH_KEY = 'cjn_rt';

let accessToken: string | null = null;
const listeners = new Set<() => void>();

export const tokenStore = {
  getAccess: () => accessToken,
  getRefresh: (): string | null => {
    try {
      return localStorage.getItem(REFRESH_KEY);
    } catch {
      return null;
    }
  },
  set(access: string, refresh: string) {
    accessToken = access;
    try {
      localStorage.setItem(REFRESH_KEY, refresh);
    } catch {
      /* sin almacenamiento: la sesión dura lo que la pestaña */
    }
  },
  clear() {
    accessToken = null;
    try {
      localStorage.removeItem(REFRESH_KEY);
    } catch {
      /* ignorar */
    }
    listeners.forEach((l) => l());
  },
  /** Se ejecuta cuando la sesión se pierde (refresh inválido). */
  onSessionLost(cb: () => void) {
    listeners.add(cb);
    return () => listeners.delete(cb);
  },
};
