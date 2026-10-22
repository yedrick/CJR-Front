/** Reglas de formato que comparten los formularios del cliente. */
export const EMAIL_RE = /^[^\s@]{1,64}@[^\s@]{1,190}\.[a-z]{2,}$/i;

/** Celular boliviano: 8 dígitos, empieza con 6 o 7. */
export const PHONE_RE = /^[67]\d{7}$/;

/** Deja solo los 8 dígitos locales de un teléfono guardado con o sin +591. */
export const localPhone = (phone?: string) => (phone || '').replace(/\D/g, '').replace(/^591/, '').slice(0, 8);
