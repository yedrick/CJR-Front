import React, { createContext, useContext, useState, useEffect } from 'react';
import { User, BolivianCity, Regional, UserRole } from '../types/camp';
import { INITIAL_USERS, getRegionalByCity } from '../data/initialData';

interface AuthContextType {
  currentUser: User | null;
  isAuthenticated: boolean;
  users: User[];
  login: (emailOrPhone: string, password?: string) => { success: boolean; message?: string };
  registerUser: (data: {
    firstName: string;
    paternalLastName: string;
    maternalLastName: string;
    birthDate: string;
    age: number;
    phone: string;
    email: string;
    city: BolivianCity;
    password?: string;
  }) => { success: boolean; user?: User; message?: string };
  logout: () => void;
  requestPasswordReset: (emailOrPhone: string) => { success: boolean; message: string };
  switchRole: (role: UserRole) => void;
  isAuthModalOpen: boolean;
  setIsAuthModalOpen: (open: boolean) => void;
  authModalMode: 'login' | 'register' | 'recovery';
  setAuthModalMode: (mode: 'login' | 'register' | 'recovery') => void;
}

const STORAGE_KEY_AUTH = 'campflow_auth_user_v2';
const STORAGE_KEY_USERS = 'campflow_all_users_v2';

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [users, setUsers] = useState<User[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_USERS);
      return saved ? JSON.parse(saved) : INITIAL_USERS;
    } catch {
      return INITIAL_USERS;
    }
  });

  const [currentUser, setCurrentUser] = useState<User | null>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_AUTH);
      return saved ? JSON.parse(saved) : INITIAL_USERS[1]; // Logged in as cliente by default for seamless test
    } catch {
      return INITIAL_USERS[1];
    }
  });

  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [authModalMode, setAuthModalMode] = useState<'login' | 'register' | 'recovery'>('login');

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_USERS, JSON.stringify(users));
    } catch (e) {
      console.error(e);
    }
  }, [users]);

  useEffect(() => {
    try {
      if (currentUser) {
        localStorage.setItem(STORAGE_KEY_AUTH, JSON.stringify(currentUser));
      } else {
        localStorage.removeItem(STORAGE_KEY_AUTH);
      }
    } catch (e) {
      console.error(e);
    }
  }, [currentUser]);

  const login = (emailOrPhone: string, _password?: string) => {
    const clean = emailOrPhone.trim().toLowerCase();
    const found = users.find(
      (u) =>
        u.email.toLowerCase() === clean ||
        u.phone.replace(/\s+/g, '') === clean.replace(/\s+/g, '')
    );

    if (found) {
      setCurrentUser(found);
      setIsAuthModalOpen(false);
      return { success: true };
    }

    return {
      success: false,
      message: 'No encontramos un usuario registrado con este correo o celular.',
    };
  };

  const registerUser = (data: {
    firstName: string;
    paternalLastName: string;
    maternalLastName: string;
    birthDate: string;
    age: number;
    phone: string;
    email: string;
    city: BolivianCity;
    password?: string;
  }) => {
    const existing = users.find(
      (u) => u.email.toLowerCase() === data.email.toLowerCase() || u.phone === data.phone
    );

    if (existing) {
      return {
        success: false,
        message: 'Ya existe una cuenta con este correo o número de WhatsApp.',
      };
    }

    const regional = getRegionalByCity(data.city);
    const now = new Date();
    const formatted = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

    const newUser: User = {
      id: `usr-${Date.now().toString().slice(-6)}`,
      firstName: data.firstName.trim(),
      paternalLastName: data.paternalLastName.trim(),
      maternalLastName: data.maternalLastName.trim(),
      birthDate: data.birthDate,
      age: data.age,
      phone: data.phone.trim(),
      email: data.email.trim().toLowerCase(),
      city: data.city,
      regional,
      role: 'Cliente',
      createdAt: formatted,
    };

    setUsers((prev) => [newUser, ...prev]);
    setCurrentUser(newUser);
    setIsAuthModalOpen(false);

    return { success: true, user: newUser };
  };

  const logout = () => {
    setCurrentUser(null);
  };

  const requestPasswordReset = (emailOrPhone: string) => {
    const clean = emailOrPhone.trim().toLowerCase();
    const found = users.find(
      (u) =>
        u.email.toLowerCase() === clean ||
        u.phone.replace(/\s+/g, '') === clean.replace(/\s+/g, '')
    );

    if (found) {
      return {
        success: true,
        message: `Se ha enviado un enlace de recuperación con código temporal a ${found.email} y vía WhatsApp al ${found.phone}.`,
      };
    }

    return {
      success: false,
      message: 'No existe una cuenta asociada a este correo o celular.',
    };
  };

  const switchRole = (role: UserRole) => {
    if (currentUser) {
      const updated = { ...currentUser, role };
      setCurrentUser(updated);
      setUsers((prev) => prev.map((u) => (u.id === currentUser.id ? updated : u)));
    } else {
      // Find default user of this role
      const match = users.find((u) => u.role === role) || users[0];
      setCurrentUser(match);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        isAuthenticated: !!currentUser,
        users,
        login,
        registerUser,
        logout,
        requestPasswordReset,
        switchRole,
        isAuthModalOpen,
        setIsAuthModalOpen,
        authModalMode,
        setAuthModalMode,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
