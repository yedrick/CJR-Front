import React, { useState } from 'react';
import { CampProvider, useCamp } from './context/CampContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Navbar } from './components/Navbar';
import { HeroBanner } from './components/public/HeroBanner';
import { CourseCatalog } from './components/public/CourseCatalog';
import { ChampionshipsSection } from './components/public/ChampionshipsSection';
import { PastEditionsGallery } from './components/public/PastEditionsGallery';
import { PastCampsCarousel } from './components/public/PastCampsCarousel';
import { MobileBottomNav } from './components/common/MobileBottomNav';
import { EnrollmentWizard } from './components/public/EnrollmentWizard';
import { AdminDashboard } from './components/admin/AdminDashboard';
import { CoursesManager } from './components/admin/CoursesManager';
import { TribesManager } from './components/admin/TribesManager';
import { CampersRoster } from './components/admin/CampersRoster';
import { CashierPayments } from './components/admin/CashierPayments';
import { QRScannerView } from './components/admin/QRScannerView';
import { ReportsExporter } from './components/admin/ReportsExporter';
import { BadgeModal } from './components/common/BadgeModal';
import { AuthModal } from './components/auth/AuthModal';
import { 
  Tent, 
  RefreshCw, 
  ShieldCheck, 
  Lock, 
  UserCheck, 
  Sparkles 
} from 'lucide-react';

const CampApp: React.FC = () => {
  const { 
    activeTab, 
    setActiveTab, 
    selectedCamperForBadge, 
    setSelectedCamperForBadge,
    resetToDemoData 
  } = useCamp();

  const { currentUser, switchRole } = useAuth();

  const [preSelectedCourseId, setPreSelectedCourseId] = useState<string | undefined>(undefined);
  const [preSelectedChampId, setPreSelectedChampId] = useState<string | undefined>(undefined);

  const handleSelectCourseForEnrollment = (courseId: string) => {
    setPreSelectedCourseId(courseId);
    setActiveTab('enroll');
  };

  const handleSelectChampionshipForEnrollment = (champId: string) => {
    setPreSelectedChampId(champId);
    setActiveTab('enroll');
  };

  // Role Security Guard for Admin Views
  const isAdminView = activeTab.startsWith('admin');
  const hasAdminAccess = currentUser?.role === 'Administrador';

  return (
    <div className="min-h-screen flex flex-col bg-slate-50/60 text-slate-900">
      
      {/* Top Navbar */}
      <Navbar />

      {/* Main Content Area - Mobile responsive and clean */}
      <main className="flex-1 pb-20 lg:pb-0 overflow-x-hidden">
        
        {/* LANDING PAGE (Inicio & Portada + Talleres con Facilitadores + Campeonatos Deportivos) */}
        {activeTab === 'catalog' && (
          <>
            <HeroBanner />
            <CourseCatalog onSelectCourseForEnrollment={handleSelectCourseForEnrollment} />
            <ChampionshipsSection onSelectChampionshipForEnrollment={handleSelectChampionshipForEnrollment} />
          </>
        )}

        {/* STANDALONE CAMPEONATOS SECTION */}
        {activeTab === 'championships' && (
          <div className="py-6">
            <ChampionshipsSection onSelectChampionshipForEnrollment={handleSelectChampionshipForEnrollment} />
          </div>
        )}

        {/* STANDALONE HISTORIAL / EDICIONES PASADAS (Carrusel + Galería Completa) */}
        {activeTab === 'history' && (
          <div className="py-4">
            <PastCampsCarousel />
            <PastEditionsGallery />
          </div>
        )}

        {/* ENROLLMENT WIZARD */}
        {activeTab === 'enroll' && (
          <EnrollmentWizard
            initialCourseId={preSelectedCourseId}
            initialChampionshipId={preSelectedChampId}
            onEnrollmentComplete={() => {
              setPreSelectedCourseId(undefined);
              setPreSelectedChampId(undefined);
              setActiveTab('catalog');
            }}
          />
        )}

        {/* ADMIN VIEWS WITH ROLE & PERMISSION CHECK */}
        {isAdminView && !hasAdminAccess ? (
          <div className="max-w-xl mx-auto my-16 p-8 bg-white rounded-2xl border border-stone-200 shadow-md text-center space-y-4">
            <div className="w-14 h-14 bg-red-100 text-red-700 rounded-full flex items-center justify-center mx-auto">
              <Lock className="w-7 h-7" />
            </div>
            <h3 className="text-xl font-bold font-display text-stone-900">
              Control de Seguridad: Acceso Restringido a Administradores
            </h3>
            <p className="text-xs text-stone-600 leading-relaxed">
              Tu cuenta actual tiene el rol <strong>"Cliente / Campamentista"</strong> ({currentUser?.email || 'Sin sesión'}). Solo el personal con rol de <strong>"Administrador"</strong> tiene permisos para gestionar inscripciones, cobros en caja y cupos.
            </p>
            <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-2">
              <button
                type="button"
                onClick={() => switchRole('Administrador')}
                className="w-full sm:w-auto px-5 py-2.5 text-xs font-bold text-white bg-[#1B4332] hover:bg-[#2D6A4F] rounded-xl shadow-xs flex items-center justify-center gap-1.5"
              >
                <UserCheck className="w-4 h-4 text-emerald-300" />
                <span>Cambiar a Rol Administrador</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('catalog')}
                className="w-full sm:w-auto px-4 py-2.5 text-xs font-semibold text-stone-600 hover:text-stone-900 hover:bg-stone-100 rounded-xl"
              >
                Volver a la Página Principal
              </button>
            </div>
          </div>
        ) : (
          <>
            {activeTab === 'admin-dashboard' && <AdminDashboard />}
            {activeTab === 'admin-courses' && <CoursesManager />}
            {activeTab === 'admin-tribes' && <TribesManager />}
            {activeTab === 'admin-roster' && <CampersRoster />}
            {activeTab === 'admin-cashier' && <CashierPayments />}
            {activeTab === 'admin-scanner' && <QRScannerView />}
            {activeTab === 'admin-reports' && <ReportsExporter />}
          </>
        )}
      </main>

      {/* Credential / Lanyard QR Badge Modal */}
      <BadgeModal
        camper={selectedCamperForBadge}
        onClose={() => setSelectedCamperForBadge(null)}
      />

      {/* Authentication Modal (Login / Register / Recovery) */}
      <AuthModal />

      {/* Clean Footer - Celeste & Blanco CJN */}
      <footer className="mt-auto border-t border-sky-100 bg-white text-slate-600 text-xs py-8 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#0284C7] text-white flex items-center justify-center shadow-xs">
              <Tent className="w-5 h-5 text-sky-100" />
            </div>
            <div>
              <span className="font-extrabold text-[#0284C7] font-display text-sm block">
                Comité Juvenil Regional (CJN) · Unión Cristiana Evangélica
              </span>
              <span className="text-[11px] text-slate-500">
                Olimpiadas Bíblicas & Deportivas 2026 · 31 Regionales · Talleres en Vivo · 12 Tribus
              </span>
            </div>
          </div>

          <div className="flex items-center gap-4 text-[11px] text-slate-500">
            <span className="flex items-center gap-1 font-semibold text-[#0284C7]">
              <ShieldCheck className="w-3.5 h-3.5 text-[#0284C7]" />
              Roles y Seguridad Activos
            </span>
            <span>·</span>
            <button
              onClick={() => {
                if (confirm('¿Restablecer datos del campamento a los valores de demostración iniciales?')) {
                  resetToDemoData();
                  alert('Datos restablecidos con éxito.');
                }
              }}
              className="inline-flex items-center gap-1 text-slate-500 hover:text-[#0284C7] transition-colors hover:underline cursor-pointer"
            >
              <RefreshCw className="w-3 h-3" />
              Restablecer Datos Demo
            </button>
          </div>
        </div>
      </footer>

      {/* Sticky Mobile Bottom Navigation Bar (Thumb-friendly for smartphones) */}
      <MobileBottomNav />

    </div>
  );
};

export default function App() {
  return (
    <AuthProvider>
      <CampProvider>
        <CampApp />
      </CampProvider>
    </AuthProvider>
  );
}
