import React, { useState } from 'react';
import { useCamp } from '../context/CampContext';
import { useAuth } from '../context/AuthContext';
import { ViewTab } from '../types/camp';
import { CJNLogo } from './common/CJNLogo';
import { NotificationBell } from './common/NotificationBell';
import { checkViewAccess, firstAdminTab } from '../auth/access';
import { ROLE_LABEL } from '../auth/permissions';
import {
  Banknote,
  CreditCard,
  BarChart3,
  BookOpen,
  CalendarDays,
  ChevronDown,
  FileSpreadsheet,
  History,
  LayoutDashboard,
  ListTree,
  LogIn,
  LogOut,
  MapPin,
  Menu,
  QrCode,
  ShieldCheck,
  Tent,
  Ticket,
  UserCircle,
  Trophy,
  UserPlus,
  Users,
  Flame,
  X,
} from 'lucide-react';

const PUBLIC_LINKS: { tab: ViewTab; label: string; icon: React.ElementType }[] = [
  { tab: 'catalog', label: 'Inicio', icon: Tent },
  { tab: 'camps', label: 'Campamentos', icon: CalendarDays },
  { tab: 'championships', label: 'Olimpiadas', icon: Trophy },
  { tab: 'history', label: 'Galería', icon: History },
];

const ADMIN_LINKS: { tab: ViewTab; label: string; icon: React.ElementType }[] = [
  { tab: 'admin-dashboard', label: 'Resumen', icon: LayoutDashboard },
  { tab: 'admin-camps', label: 'Campamentos', icon: Tent },
  { tab: 'admin-courses', label: 'Talleres', icon: BookOpen },
  { tab: 'admin-roster', label: 'Inscritos', icon: Users },
  { tab: 'admin-tribes', label: 'Tribus', icon: Flame },
  { tab: 'admin-cashier', label: 'Pagos y caja', icon: Banknote },
  { tab: 'admin-payment-settings', label: 'Métodos de pago', icon: CreditCard },
  { tab: 'admin-scanner', label: 'Escáner QR', icon: QrCode },
  { tab: 'admin-reports', label: 'Reportes', icon: FileSpreadsheet },
  { tab: 'admin-catalogs', label: 'Catálogos', icon: ListTree },
];

export const Navbar: React.FC = () => {
  const { activeTab, setActiveTab, myRegistrations } = useCamp();
  const { currentUser, isAuthenticated, logout, requireLogin, isStaff } = useAuth();
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const myRegs = myRegistrations;
  // El panel solo aparece para el equipo; la primera sección depende de sus permisos
  const adminHome = firstAdminTab(currentUser);
  const isAdmin = isStaff && !!adminHome;
  const inAdmin = activeTab.startsWith('admin');

  const go = (tab: ViewTab) => {
    setActiveTab(tab);
    setIsMobileMenuOpen(false);
    setIsUserMenuOpen(false);
  };

  return (
    <header className="sticky top-0 z-40 bg-white/90 backdrop-blur-xl border-b border-slate-100 no-print">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between gap-4 h-16 sm:h-20">
          <button onClick={() => go('catalog')} className="flex items-center gap-3 text-left cursor-pointer shrink-0">
            <CJNLogo size="sm" showSubtitle={false} />
            <div className="hidden sm:block xl:hidden 2xl:block border-l border-sky-100 pl-3">
              <span className="text-sm font-black tracking-tight text-[#0284C7] font-display block leading-tight">
                Comité Juvenil
              </span>
              <span className="text-[10px] font-semibold text-slate-500 tracking-wide block">Unión Cristiana Evangélica</span>
            </div>
          </button>

          <nav className="hidden xl:flex items-center gap-1">
            {PUBLIC_LINKS.map(({ tab, label, icon: Icon }) => (
              <button
                key={tab}
                onClick={() => go(tab)}
                className={`px-3.5 py-2 text-xs font-bold rounded-xl whitespace-nowrap transition-all flex items-center gap-1.5 cursor-pointer ${
                  activeTab === tab ? 'bg-sky-50 text-[#0284C7]' : 'text-slate-600 hover:text-[#0284C7] hover:bg-slate-50'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {label}
              </button>
            ))}
            {isAuthenticated && (
              <button
                onClick={() => go('my-registrations')}
                className={`px-3.5 py-2 text-xs font-bold rounded-xl whitespace-nowrap transition-all flex items-center gap-1.5 cursor-pointer ${
                  activeTab === 'my-registrations' ? 'bg-sky-50 text-[#0284C7]' : 'text-slate-600 hover:text-[#0284C7] hover:bg-slate-50'
                }`}
              >
                <Ticket className="w-3.5 h-3.5" />
                Mis inscripciones
                {myRegs.length > 0 && (
                  <span className="text-[10px] font-black bg-[#0284C7] text-white rounded-full px-1.5">{myRegs.length}</span>
                )}
              </button>
            )}
            <button
              onClick={() => go('enroll')}
              className="ml-1 px-4 py-2.5 text-xs font-black rounded-xl whitespace-nowrap flex items-center gap-1.5 cursor-pointer text-white bg-gradient-to-r from-amber-400 to-orange-500 hover:from-amber-500 hover:to-orange-600 shadow-md active:scale-95"
            >
              <UserPlus className="w-3.5 h-3.5" /> Inscribirme
            </button>
            {isAdmin && (
              <button
                onClick={() => go(adminHome || 'catalog')}
                className={`ml-1 px-3.5 py-2 text-xs font-bold rounded-xl whitespace-nowrap flex items-center gap-1.5 cursor-pointer ${
                  inAdmin ? 'bg-slate-900 text-white' : 'text-slate-800 bg-slate-100 hover:bg-slate-200'
                }`}
              >
                <ShieldCheck className="w-3.5 h-3.5" /> Admin
              </button>
            )}
          </nav>

          <div className="flex items-center gap-2 shrink-0">
            {isAuthenticated && <NotificationBell />}
            {isAuthenticated && currentUser ? (
              <div className="relative">
                <button
                  onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                  className="flex items-center gap-2 pl-1.5 pr-2.5 py-1.5 rounded-2xl bg-slate-50 border border-slate-200 hover:border-sky-300 text-xs font-bold text-slate-800 cursor-pointer"
                >
                  <span className="w-7 h-7 rounded-full bg-gradient-to-br from-sky-500 to-blue-600 text-white text-[11px] font-black flex items-center justify-center">
                    {currentUser.firstName[0]}
                  </span>
                  <span className="truncate max-w-[90px] hidden sm:inline">{currentUser.firstName}</span>
                  <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                </button>

                {isUserMenuOpen && (
                  <div className="absolute right-0 mt-2 w-64 bg-white rounded-3xl shadow-xl border border-slate-100 py-2 z-50 animate-fade-in text-xs">
                    <div className="px-4 py-2.5 border-b border-slate-100">
                      <div className="font-extrabold text-slate-900">
                        {currentUser.firstName} {currentUser.paternalLastName}
                      </div>
                      <div className="text-[11px] text-slate-500 font-mono truncate">{currentUser.email}</div>
                      <div className="text-[10px] text-[#0284C7] font-bold mt-0.5 flex items-center gap-1">
                        <MapPin className="w-3 h-3" /> {ROLE_LABEL[currentUser.role]} · Regional {currentUser.regional}
                      </div>
                    </div>
                    <button
                      onClick={() => go('my-registrations')}
                      className="w-full text-left px-4 py-2.5 hover:bg-sky-50 font-bold text-[#0284C7] flex items-center gap-2 cursor-pointer"
                    >
                      <Ticket className="w-4 h-4" /> Mis inscripciones ({myRegs.length})
                    </button>
                    {isAdmin && (
                      <button
                        onClick={() => go(adminHome || 'catalog')}
                        className="w-full text-left px-4 py-2 hover:bg-slate-50 font-semibold text-slate-800 flex items-center gap-2 cursor-pointer"
                      >
                        <BarChart3 className="w-4 h-4" /> Panel de administración
                      </button>
                    )}
                    <button
                      onClick={() => go('profile')}
                      className="w-full text-left px-4 py-2 hover:bg-slate-50 font-semibold text-slate-800 flex items-center gap-2 cursor-pointer"
                    >
                      <UserCircle className="w-4 h-4" /> Mi perfil y seguridad
                    </button>
                    <button
                      onClick={() => {
                        setIsUserMenuOpen(false);
                        logout();
                        setActiveTab('catalog');
                      }}
                      className="w-full text-left px-4 py-2 hover:bg-red-50 font-semibold text-red-600 flex items-center gap-2 border-t border-slate-100 cursor-pointer"
                    >
                      <LogOut className="w-4 h-4" /> Cerrar sesión
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => requireLogin('login')}
                  className="px-3 py-2 text-xs font-bold text-slate-700 hover:text-[#0284C7] hover:bg-sky-50 rounded-xl flex items-center gap-1 cursor-pointer"
                >
                  <LogIn className="w-3.5 h-3.5" /> Ingresar
                </button>
                <button
                  onClick={() => requireLogin('register')}
                  className="hidden sm:inline-flex px-3.5 py-2 text-xs font-bold text-white bg-[#0284C7] hover:bg-[#0369A1] rounded-xl cursor-pointer"
                >
                  Registrarse
                </button>
              </div>
            )}

            <button
              type="button"
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="xl:hidden p-2 rounded-xl text-slate-700 hover:bg-slate-100 cursor-pointer"
              aria-label="Abrir menú"
            >
              {isMobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>
      </div>

      {isMobileMenuOpen && (
        <div className="xl:hidden border-t border-slate-100 bg-white px-4 pt-3 pb-6 space-y-1.5 shadow-xl animate-fade-in text-sm font-semibold max-h-[80vh] overflow-y-auto">
          {[...PUBLIC_LINKS, ...(isAuthenticated ? [{ tab: 'my-registrations' as ViewTab, label: 'Mis inscripciones', icon: Ticket }] : [])].map(
            ({ tab, label, icon: Icon }) => (
              <button
                key={tab}
                onClick={() => go(tab)}
                className={`w-full text-left px-4 py-3 rounded-2xl flex items-center gap-3 ${
                  activeTab === tab ? 'bg-sky-50 text-[#0284C7] font-bold' : 'text-slate-700 hover:bg-slate-50'
                }`}
              >
                <Icon className="w-4 h-4" /> {label}
              </button>
            )
          )}
          <button
            onClick={() => go('enroll')}
            className="w-full px-4 py-3 rounded-2xl bg-gradient-to-r from-amber-400 to-orange-500 text-white font-black flex items-center justify-center gap-2"
          >
            <UserPlus className="w-4 h-4" /> Inscribirme
          </button>
          {isAdmin && (
            <div className="pt-3 mt-2 border-t border-slate-100 space-y-1">
              <span className="px-4 text-[10px] font-black uppercase tracking-wider text-slate-400">Administración</span>
              <div className="grid grid-cols-2 gap-1.5">
                {ADMIN_LINKS.filter((l) => checkViewAccess(l.tab, currentUser) === 'ok').map(({ tab, label, icon: Icon }) => (
                  <button
                    key={tab}
                    onClick={() => go(tab)}
                    className={`px-3 py-2.5 rounded-xl flex items-center gap-2 text-xs ${
                      activeTab === tab ? 'bg-slate-900 text-white font-bold' : 'bg-slate-50 text-slate-700'
                    }`}
                  >
                    <Icon className="w-4 h-4" /> {label}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

    </header>
  );
};
