import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';

/** Renderiza en document.body para que los modales siempre cubran toda la pantalla. */
export const Portal: React.FC<{ children: React.ReactNode }> = ({ children }) => createPortal(children, document.body);

/** Bloquea el scroll del fondo mientras un modal está abierto. */
export function useLockBodyScroll(active: boolean) {
  useEffect(() => {
    if (!active) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [active]);
}

/** Cierra con la tecla Escape. */
export function useEscapeKey(active: boolean, onEscape: () => void) {
  useEffect(() => {
    if (!active) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onEscape();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [active, onEscape]);
}
