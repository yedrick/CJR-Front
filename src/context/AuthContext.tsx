import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { AuthTokens, User } from '../types/camp';
import { authApi, RegisterPayload } from '../api/services';
import { refreshSession } from '../api/http';
import { tokenStore } from '../api/tokenStore';
import { ApiError, errorMessage } from '../api/errors';
import { hasPermission, Permission } from '../auth/permissions';
import { useToast } from '../components/common/Toast';

export interface AuthResult {
  success: boolean;
  message?: string;
  /** errores por campo (422 / 409) */
  errors?: Record<string, string>;
  status?: number;
  retryAfter?: number;
}

type AuthModalMode = 'login' | 'register' | 'recovery';

interface AuthContextType {
  currentUser: User | null;
  isAuthenticated: boolean;
  /** true mientras se restaura la sesión al cargar la página */
  isRestoring: boolean;
  /** el usuario pertenece al equipo (tiene algún permiso de administración) */
  isStaff: boolean;
  can: (permission: Permission | Permission[]) => boolean;
  login: (email: string, password: string) => Promise<AuthResult>;
  registerUser: (data: RegisterPayload) => Promise<AuthResult>;
  logout: () => Promise<void>;
  requestPasswordReset: (email: string) => Promise<AuthResult & { devCode?: string }>;
  resetPassword: (email: string, code: string, newPassword: string) => Promise<AuthResult>;
  changePassword: (currentPassword: string, newPassword: string) => Promise<AuthResult>;
  updateProfile: (data: Partial<User>) => Promise<AuthResult>;
  reloadUser: () => Promise<void>;
  /** Abre la sesión con tokens recibidos de otro endpoint (p. ej. la compra en un solo paso). */
  applySession: (user: User, tokens: AuthTokens) => void;
  isAuthModalOpen: boolean;
  setIsAuthModalOpen: (open: boolean) => void;
  authModalMode: AuthModalMode;
  setAuthModalMode: (mode: AuthModalMode) => void;
  /** abre el modal de login */
  requireLogin: (mode?: AuthModalMode) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const toResult = (e: unknown): AuthResult => {
  if (e instanceof ApiError) {
    return { success: false, message: e.message, errors: e.errors, status: e.status, retryAfter: e.retryAfter };
  }
  return { success: false, message: errorMessage(e) };
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { toast } = useToast();
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isRestoring, setIsRestoring] = useState(true);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [authModalMode, setAuthModalMode] = useState<AuthModalMode>('login');

  // Restaurar la sesión con el refresh token al cargar la app
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        if (tokenStore.getRefresh() && (await refreshSession())) {
          const user = await authApi.me();
          if (!cancelled) setCurrentUser(user);
        }
      } catch {
        tokenStore.clear();
      } finally {
        if (!cancelled) setIsRestoring(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Si el refresh token deja de ser válido en cualquier petición → cerrar sesión
  useEffect(() => {
    const unsubscribe = tokenStore.onSessionLost(() => {
      setCurrentUser((prev) => {
        if (prev) toast({ type: 'warning', title: 'Tu sesión expiró', message: 'Vuelve a iniciar sesión para continuar.' });
        return null;
      });
    });
    return () => {
      unsubscribe();
    };
  }, [toast]);

  const can = useCallback(
    (permission: Permission | Permission[]) => hasPermission(currentUser?.permissions, permission),
    [currentUser]
  );

  const login = async (email: string, password: string): Promise<AuthResult> => {
    try {
      const { user, tokens } = await authApi.login(email.trim(), password);
      applySession(user, tokens);
      setIsAuthModalOpen(false);
      toast({ type: 'success', title: `¡Bienvenido/a, ${user.firstName}!` });
      return { success: true };
    } catch (e) {
      return toResult(e);
    }
  };

  const registerUser = async (data: RegisterPayload): Promise<AuthResult> => {
    try {
      const { user, tokens } = await authApi.register(data);
      applySession(user, tokens);
      setIsAuthModalOpen(false);
      toast({ type: 'success', title: 'Cuenta creada', message: 'Ya puedes inscribirte a los campamentos.' });
      return { success: true };
    } catch (e) {
      return toResult(e);
    }
  };

  const logout = async () => {
    try {
      if (tokenStore.getAccess() || tokenStore.getRefresh()) await authApi.logout();
    } catch {
      /* aunque falle la API, la sesión local se cierra */
    }
    tokenStore.clear();
    setCurrentUser(null);
    toast({ type: 'info', title: 'Sesión cerrada' });
  };

  const requestPasswordReset = async (email: string) => {
    try {
      const res = await authApi.forgotPassword(email);
      return { success: true, message: res.message, devCode: res.devCode };
    } catch (e) {
      return toResult(e);
    }
  };

  const resetPassword = async (email: string, code: string, newPassword: string) => {
    try {
      const res = await authApi.resetPassword(email, code, newPassword);
      return { success: true, message: res.message };
    } catch (e) {
      return toResult(e);
    }
  };

  const changePassword = async (currentPassword: string, newPassword: string) => {
    try {
      const res = await authApi.changePassword(currentPassword, newPassword);
      return { success: true, message: res.message };
    } catch (e) {
      return toResult(e);
    }
  };

  const updateProfile = async (data: Partial<User>) => {
    try {
      const user = await authApi.updateMe(data);
      setCurrentUser(user);
      return { success: true, message: 'Perfil actualizado.' };
    } catch (e) {
      return toResult(e);
    }
  };

  const reloadUser = async () => {
    try {
      setCurrentUser(await authApi.me());
    } catch {
      /* el manejador de sesión perdida se encarga */
    }
  };

  const applySession = (user: User, tokens: AuthTokens) => {
    tokenStore.set(tokens.accessToken, tokens.refreshToken);
    setCurrentUser(user);
  };

  const requireLogin = (mode: AuthModalMode = 'login') => {
    setAuthModalMode(mode);
    setIsAuthModalOpen(true);
  };

  const isStaff = !!currentUser && currentUser.role !== 'campista' && currentUser.permissions.length > 0;

  // Las acciones solo usan setters, `toast` y módulos estables: el valor se recrea cuando cambia el estado.
  const value = useMemo<AuthContextType>(
    () => ({
      currentUser,
      isAuthenticated: !!currentUser,
      isRestoring,
      isStaff,
      can,
      login,
      registerUser,
      logout,
      requestPasswordReset,
      resetPassword,
      changePassword,
      updateProfile,
      reloadUser,
      applySession,
      isAuthModalOpen,
      setIsAuthModalOpen,
      authModalMode,
      setAuthModalMode,
      requireLogin,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [currentUser, isRestoring, isStaff, can, isAuthModalOpen, authModalMode, toast]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};

