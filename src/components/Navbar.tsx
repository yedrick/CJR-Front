import React, { useState } from 'react';
import { useCamp } from '../context/CampContext';
import { useAuth } from '../context/AuthContext';
import { CJNLogo } from './common/CJNLogo';
import { 
  Tent, 
  QrCode, 
  UserPlus, 
  Compass, 
  ShieldCheck, 
  Trophy, 
  History, 
  LogIn, 
  LogOut, 
  User as UserIcon, 
  ChevronDown, 
  Banknote,
  Users,
  Flame,
  Menu,
  X,
  Sparkles,
  BookOpen,
  MapPin
} from 'lucide-react';

export const Navbar: React.FC = () => {
  const { activeTab, setActiveTab, registrations, setSelectedCamperForBadge } = useCamp();
  const { currentUser, isAuthenticated, logout, setIsAuthModalOpen, setAuthModalMode, switchRole } = useAuth();
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Find if current user has an active registration
  const myCamperProfile = currentUser
    ? registrations.find((r) => r.userId === currentUser.id || r.email.toLowerCase() === currentUser.email.toLowerCase())
    : null;

  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-sky-100 shadow-xs transition-all">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between gap-4 h-20">
          
          {/* Zone 1: CJN Official Logo & Title */}
          <button
            onClick={() => {
              setActiveTab('catalog');
              setIsMobileMenuOpen(false);
            }}
            className="flex items-center gap-3 text-left group transition-transform active:scale-98 cursor-pointer"
          >
            <CJNLogo size="sm" showSubtitle={false} />
            <div className="hidden sm:block border-l border-sky-200 pl-3">
              <div className="flex items-center gap-1.5">
                <span className="text-base font-black tracking-tight text-[#0284C7] font-display whitespace-nowrap block">
                  Comité Juvenil Regional
                </span>
                <span className="text-[9px] font-extrabold px-1.5 py-0.2 rounded-full bg-sky-100 text-[#0284C7] border border-sky-300">
                  CJN
                </span>
              </div>
              <span className="text-[10px] font-semibold text-slate-500 tracking-wider block -mt-0.5">
                Unión Cristiana Evangélica
              </span>
            </div>
          </button>

          {/* Zone 2: Desktop Navigation Links (Celeste & Blanco) */}
          <nav className="hidden lg:flex items-center gap-1">
            <button
              onClick={() => setActiveTab('catalog')}
              className={`px-3.5 py-2 text-xs font-bold rounded-2xl whitespace-nowrap transition-all cursor-pointer ${
                activeTab === 'catalog'
                  ? 'bg-[#0284C7] text-white shadow-md'
                  : 'text-slate-700 hover:text-[#0284C7] hover:bg-sky-50'
              }`}
            >
              Inicio & Portada
            </button>

            <button
              onClick={() => {
                if (activeTab !== 'catalog') {
                  setActiveTab('catalog');
                }
                setTimeout(() => {
                  const el = document.getElementById('courses-catalog-section');
                  el?.scrollIntoView({ behavior: 'smooth' });
                }, 50);
              }}
              className="px-3.5 py-2 text-xs font-bold rounded-2xl whitespace-nowrap text-slate-700 hover:text-[#0284C7] hover:bg-sky-50 transition-colors cursor-pointer"
            >
              Talleres con Facilitadores
            </button>

            <button
              onClick={() => setActiveTab('championships')}
              className={`px-3.5 py-2 text-xs font-bold rounded-2xl whitespace-nowrap transition-all flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'championships'
                  ? 'bg-[#0284C7] text-white shadow-md'
                  : 'text-slate-700 hover:text-[#0284C7] hover:bg-sky-50'
              }`}
            >
              <Trophy className="w-3.5 h-3.5 text-amber-500" />
              Olimpiadas & Deportes
            </button>

            <button
              onClick={() => setActiveTab('history')}
              className={`px-3.5 py-2 text-xs font-bold rounded-2xl whitespace-nowrap transition-all flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'history'
                  ? 'bg-[#0284C7] text-white shadow-md'
                  : 'text-slate-700 hover:text-[#0284C7] hover:bg-sky-50'
              }`}
            >
              <History className="w-3.5 h-3.5 text-sky-600" />
              Recuerdos & Galería
            </button>

            <button
              onClick={() => setActiveTab('enroll')}
              className={`px-4 py-2 text-xs font-extrabold rounded-2xl whitespace-nowrap transition-all flex items-center gap-1.5 cursor-pointer shadow-xs ${
                activeTab === 'enroll'
                  ? 'bg-amber-500 text-slate-950 shadow-md'
                  : 'text-white bg-[#0284C7] hover:bg-[#0369A1] hover:scale-105 active:scale-95'
              }`}
            >
              <UserPlus className="w-3.5 h-3.5" />
              Inscripción Rápida
            </button>

            {/* Admin direct link only if Administrator */}
            {currentUser?.role === 'Administrador' && (
              <>
                <div className="h-4 w-px bg-slate-200 mx-1" />
                <button
                  onClick={() => setActiveTab('admin-dashboard')}
                  className={`px-3.5 py-2 text-xs font-bold rounded-2xl whitespace-nowrap transition-all flex items-center gap-1.5 cursor-pointer ${
                    activeTab.startsWith('admin')
                      ? 'bg-sky-950 text-sky-200 shadow-xs'
                      : 'text-sky-900 bg-sky-50 hover:bg-sky-100 border border-sky-200'
                  }`}
                >
                  <ShieldCheck className="w-3.5 h-3.5 text-[#0284C7]" />
                  Panel Administrador
                </button>
              </>
            )}
          </nav>

          {/* Zone 3: Authentication & Action Area */}
          <div className="flex items-center gap-2 shrink-0">
            {isAuthenticated && currentUser ? (
              <div className="relative">
                <button
                  onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-2xl bg-sky-50 border border-sky-200 hover:border-sky-300 transition-all text-xs font-bold text-slate-800 shadow-2xs cursor-pointer"
                >
                  <div className="w-6 h-6 rounded-full bg-[#0284C7] text-white text-[10px] font-black flex items-center justify-center shadow-xs">
                    {currentUser.firstName[0]}
                  </div>
                  <span className="truncate max-w-[100px] hidden sm:inline text-slate-900">
                    {currentUser.firstName}
                  </span>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-mono font-bold ${
                    currentUser.role === 'Administrador' ? 'bg-amber-100 text-amber-900' : 'bg-sky-100 text-[#0284C7]'
                  }`}>
                    {currentUser.role}
                  </span>
                  <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                </button>

                {/* Dropdown Menu */}
                {isUserMenuOpen && (
                  <div className="absolute right-0 mt-2 w-64 bg-white rounded-3xl shadow-xl border border-sky-100 py-2 z-50 animate-fade-in text-xs">
                    <div className="px-4 py-2.5 border-b border-slate-100">
                      <div className="font-extrabold text-slate-900">
                        {currentUser.firstName} {currentUser.paternalLastName}
                      </div>
                      <div className="text-[11px] text-slate-500 font-mono truncate">
                        {currentUser.email}
                      </div>
                      <div className="text-[10px] text-[#0284C7] font-bold mt-0.5 flex items-center gap-1">
                        <MapPin className="w-3 h-3 text-[#0284C7]" />
                        <span>Regional: {currentUser.regional}</span>
                      </div>
                    </div>

                    {/* Role toggle test switcher */}
                    <div className="p-2 border-b border-slate-100 bg-sky-50/50">
                      <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block mb-1">
                        Cambiar Rol de Prueba:
                      </span>
                      <div className="grid grid-cols-2 gap-1 font-semibold text-[11px]">
                        <button
                          type="button"
                          onClick={() => {
                            switchRole('Cliente');
                            setIsUserMenuOpen(false);
                            setActiveTab('catalog');
                          }}
                          className={`py-1 rounded-xl text-center transition-colors cursor-pointer ${
                            currentUser.role === 'Cliente'
                              ? 'bg-[#0284C7] text-white font-bold'
                              : 'bg-white text-slate-700 hover:bg-slate-200'
                          }`}
                        >
                          Cliente
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            switchRole('Administrador');
                            setIsUserMenuOpen(false);
                            setActiveTab('admin-dashboard');
                          }}
                          className={`py-1 rounded-xl text-center transition-colors cursor-pointer ${
                            currentUser.role === 'Administrador'
                              ? 'bg-amber-600 text-white font-bold'
                              : 'bg-white text-slate-700 hover:bg-slate-200'
                          }`}
                        >
                          Administrador
                        </button>
                      </div>
                    </div>

                    {/* Camper pass if registered */}
                    {myCamperProfile && (
                      <button
                        onClick={() => {
                          setIsUserMenuOpen(false);
                          setSelectedCamperForBadge(myCamperProfile);
                        }}
                        className="w-full text-left px-4 py-2.5 hover:bg-sky-50 font-bold text-[#0284C7] flex items-center gap-2 cursor-pointer"
                      >
                        <QrCode className="w-4 h-4 text-[#0284C7]" />
                        <span>Mi Credencial Oficial QR</span>
                      </button>
                    )}

                    {currentUser.role === 'Administrador' && (
                      <button
                        onClick={() => {
                          setIsUserMenuOpen(false);
                          setActiveTab('admin-dashboard');
                        }}
                        className="w-full text-left px-4 py-2 hover:bg-slate-50 font-semibold text-slate-800 flex items-center gap-2 cursor-pointer"
                      >
                        <ShieldCheck className="w-4 h-4 text-slate-600" />
                        <span>Abrir Panel de Control</span>
                      </button>
                    )}

                    <button
                      onClick={() => {
                        setIsUserMenuOpen(false);
                        logout();
                      }}
                      className="w-full text-left px-4 py-2 hover:bg-red-50 font-semibold text-red-600 flex items-center gap-2 border-t border-slate-100 cursor-pointer"
                    >
                      <LogOut className="w-4 h-4" />
                      <span>Cerrar Sesión</span>
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => {
                    setAuthModalMode('login');
                    setIsAuthModalOpen(true);
                  }}
                  className="px-2.5 sm:px-3 py-2 text-xs font-bold text-slate-700 hover:text-[#0284C7] hover:bg-sky-50 rounded-xl transition-colors flex items-center gap-1 cursor-pointer"
                >
                  <LogIn className="w-3.5 h-3.5" />
                  <span>Ingresar</span>
                </button>

                <button
                  onClick={() => {
                    setAuthModalMode('register');
                    setIsAuthModalOpen(true);
                  }}
                  className="px-3 sm:px-3.5 py-2 text-xs font-bold text-white bg-[#0284C7] hover:bg-[#0369A1] rounded-xl shadow-xs transition-all cursor-pointer"
                >
                  Registrarse
                </button>
              </div>
            )}

            {/* Mobile Hamburger Menu Button */}
            <button
              type="button"
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="lg:hidden p-2 rounded-xl text-slate-700 hover:text-[#0284C7] hover:bg-sky-50 transition-colors cursor-pointer"
              aria-label="Abrir menú"
            >
              {isMobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Drawer Navigation Menu */}
      {isMobileMenuOpen && (
        <div className="lg:hidden border-t border-sky-100 bg-white px-4 pt-3 pb-6 space-y-3 shadow-xl animate-fade-in">
          <div className="flex items-center justify-between py-1 border-b border-slate-100">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
              Navegación Olimpiadas CJN
            </span>
            <span className="text-[10px] font-mono text-[#0284C7] font-bold bg-sky-100 px-2 py-0.5 rounded-full">
              31 Regionales
            </span>
          </div>

          <div className="grid grid-cols-1 gap-1.5 text-xs font-semibold">
            <button
              onClick={() => {
                setActiveTab('catalog');
                setIsMobileMenuOpen(false);
              }}
              className={`w-full text-left px-3.5 py-2.5 rounded-xl transition-colors flex items-center justify-between ${
                activeTab === 'catalog' ? 'bg-[#0284C7] text-white font-bold' : 'text-slate-800 hover:bg-slate-100'
              }`}
            >
              <div className="flex items-center gap-2">
                <Tent className="w-4 h-4 text-sky-400" />
                <span>Inicio & Portada</span>
              </div>
              <span className="text-[10px] opacity-70">Talleres & Cupos</span>
            </button>

            <button
              onClick={() => {
                setActiveTab('championships');
                setIsMobileMenuOpen(false);
              }}
              className={`w-full text-left px-3.5 py-2.5 rounded-xl transition-colors flex items-center justify-between ${
                activeTab === 'championships' ? 'bg-[#0284C7] text-white font-bold' : 'text-slate-800 hover:bg-slate-100'
              }`}
            >
              <div className="flex items-center gap-2">
                <Trophy className="w-4 h-4 text-amber-500" />
                <span>Campeonatos Deportivos</span>
              </div>
              <span className="text-[10px] opacity-70">Fútbol, Vóley, Ajedrez</span>
            </button>

            <button
              onClick={() => {
                setActiveTab('history');
                setIsMobileMenuOpen(false);
              }}
              className={`w-full text-left px-3.5 py-2.5 rounded-xl transition-colors flex items-center justify-between ${
                activeTab === 'history' ? 'bg-[#0284C7] text-white font-bold' : 'text-slate-800 hover:bg-slate-100'
              }`}
            >
              <div className="flex items-center gap-2">
                <History className="w-4 h-4 text-[#0284C7]" />
                <span>Recuerdos de Campamentos (Fotos & Video)</span>
              </div>
              <span className="text-[10px] opacity-70">Galería HD</span>
            </button>

            <button
              onClick={() => {
                setActiveTab('enroll');
                setIsMobileMenuOpen(false);
              }}
              className={`w-full text-left px-3.5 py-2.5 rounded-xl transition-colors flex items-center justify-between ${
                activeTab === 'enroll' ? 'bg-amber-500 text-slate-950 font-bold' : 'bg-sky-50 text-[#0284C7] border border-sky-200 font-bold'
              }`}
            >
              <div className="flex items-center gap-2">
                <UserPlus className="w-4 h-4 text-[#0284C7]" />
                <span>Inscripción Rápida</span>
              </div>
              <span className="text-[10px]">Sin Ficha Médica</span>
            </button>

            {myCamperProfile && (
              <button
                onClick={() => {
                  setSelectedCamperForBadge(myCamperProfile);
                  setIsMobileMenuOpen(false);
                }}
                className="w-full text-left px-3.5 py-2.5 rounded-xl bg-sky-100 text-[#0284C7] border border-sky-300 font-bold flex items-center gap-2"
              >
                <QrCode className="w-4 h-4 text-[#0284C7] animate-pulse" />
                <span>Ver Mi Credencial Oficial QR</span>
              </button>
            )}

            {currentUser?.role === 'Administrador' && (
              <button
                onClick={() => {
                  setActiveTab('admin-dashboard');
                  setIsMobileMenuOpen(false);
                }}
                className="w-full text-left px-3.5 py-2.5 rounded-xl bg-sky-950 text-sky-200 font-bold flex items-center gap-2"
              >
                <ShieldCheck className="w-4 h-4 text-sky-400" />
                <span>Panel de Administración Completo</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* Sub-bar for Admin Tabs when in admin mode */}
      {activeTab.startsWith('admin') && (
        <div className="border-t border-sky-100 bg-sky-50/90 px-4 sm:px-6 lg:px-8 py-2">
          <div className="max-w-7xl mx-auto flex items-center justify-between overflow-x-auto text-xs font-medium scrollbar-thin">
            <div className="flex items-center gap-1 whitespace-nowrap">
              <span className="text-slate-500 uppercase tracking-wider text-[10px] font-bold mr-2 flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5 text-[#0284C7]" /> Administración:
              </span>
              <button
                onClick={() => setActiveTab('admin-dashboard')}
                className={`px-2.5 py-1.5 rounded-xl transition-colors cursor-pointer ${
                  activeTab === 'admin-dashboard'
                    ? 'bg-[#0284C7] text-white font-bold'
                    : 'text-slate-700 hover:bg-slate-200'
                }`}
              >
                Resumen
              </button>
              <button
                onClick={() => setActiveTab('admin-courses')}
                className={`px-2.5 py-1.5 rounded-xl transition-colors cursor-pointer ${
                  activeTab === 'admin-courses'
                    ? 'bg-[#0284C7] text-white font-bold'
                    : 'text-slate-700 hover:bg-slate-200'
                }`}
              >
                Cursos & Cupos
              </button>
              <button
                onClick={() => setActiveTab('admin-tribes')}
                className={`px-2.5 py-1.5 rounded-xl transition-colors cursor-pointer ${
                  activeTab === 'admin-tribes'
                    ? 'bg-[#0284C7] text-white font-bold'
                    : 'text-slate-700 hover:bg-slate-200'
                }`}
              >
                12 Tribus Fijas
              </button>
              <button
                onClick={() => setActiveTab('admin-roster')}
                className={`px-2.5 py-1.5 rounded-xl transition-colors cursor-pointer ${
                  activeTab === 'admin-roster'
                    ? 'bg-[#0284C7] text-white font-bold'
                    : 'text-slate-700 hover:bg-slate-200'
                }`}
              >
                Inscritos ({registrations.length})
              </button>
              <button
                onClick={() => setActiveTab('admin-cashier')}
                className={`px-2.5 py-1.5 rounded-xl transition-colors flex items-center gap-1 cursor-pointer ${
                  activeTab === 'admin-cashier'
                    ? 'bg-amber-600 text-white font-bold'
                    : 'text-amber-900 bg-amber-100 hover:bg-amber-200 font-bold'
                }`}
              >
                <Banknote className="w-3 h-3 text-amber-600" />
                <span>Pagos en Caja</span>
              </button>
              <button
                onClick={() => setActiveTab('admin-scanner')}
                className={`px-2.5 py-1.5 rounded-xl transition-colors cursor-pointer ${
                  activeTab === 'admin-scanner'
                    ? 'bg-[#0284C7] text-white font-bold'
                    : 'text-slate-700 hover:bg-slate-200'
                }`}
              >
                Escáner QR
              </button>
              <button
                onClick={() => setActiveTab('admin-reports')}
                className={`px-2.5 py-1.5 rounded-xl transition-colors cursor-pointer ${
                  activeTab === 'admin-reports'
                    ? 'bg-[#0284C7] text-white font-bold'
                    : 'text-slate-700 hover:bg-slate-200'
                }`}
              >
                Reportes
              </button>
            </div>
          </div>
        </div>
      )}
    </header>
  );
};
