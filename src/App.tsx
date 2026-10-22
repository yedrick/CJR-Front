import React, { useState } from 'react';
import { CampProvider, useCamp } from './context/CampContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Navbar } from './components/Navbar';
import { HeroBanner } from './components/public/HeroBanner';
import { CampsSection } from './components/public/CampsSection';
import { CourseCatalog } from './components/public/CourseCatalog';
import { ChampionshipsSection } from './components/public/ChampionshipsSection';
import { PastEditionsGallery } from './components/public/PastEditionsGallery';
import { PastCampsCarousel } from './components/public/PastCampsCarousel';
import { MyRegistrations } from './components/public/MyRegistrations';
import { MobileBottomNav } from './components/common/MobileBottomNav';
import { EnrollmentWizard } from './components/public/EnrollmentWizard';
import { AdminDashboard } from './components/admin/AdminDashboard';
import { CampsManager } from './components/admin/CampsManager';
import { CatalogsManager } from './components/admin/CatalogsManager';
import { CoursesManager } from './components/admin/CoursesManager';
import { TribesManager } from './components/admin/TribesManager';
import { CampersRoster } from './components/admin/CampersRoster';
import { CashierPayments } from './components/admin/CashierPayments';
import { QRScannerView } from './components/admin/QRScannerView';
import { ReportsExporter } from './components/admin/ReportsExporter';
import { PaymentSettingsManager } from './components/admin/PaymentSettingsManager';
import { AdminLayout } from './components/admin/AdminLayout';
import { ConfirmProvider, useConfirm } from './components/common/ConfirmDialog';
import { BadgeModal } from './components/common/BadgeModal';
import { AuthModal } from './components/auth/AuthModal';
import { ToastProvider } from './components/common/Toast';
import { NotFoundPage, ForbiddenPage, UnauthorizedPage, ServerErrorPage, LoadingScreen } from './components/common/StatusPages';
import { ProfilePage } from './components/public/ProfilePage';
import { RegistrationHub } from './components/public/RegistrationHub';
import { TeamInvitePage } from './components/public/TeamInvitePage';
import { ChampionshipsManager } from './components/admin/ChampionshipsManager';
import { UsersManager } from './components/admin/UsersManager';
import { RolesManager } from './components/admin/RolesManager';
import { NotificationsManager } from './components/admin/NotificationsManager';
import { ApiExplorer } from './components/admin/ApiExplorer';
import { PwaPrompts } from './components/pwa/PwaPrompts';
import { checkViewAccess } from './auth/access';
import { env, isTesting } from './config/env';
import { Tent, RefreshCw, Server } from 'lucide-react';

const CampApp: React.FC = () => {
  const {
    activeTab,
    setActiveTab,
    selectedCamperForBadge,
    setSelectedCamperForBadge,
    resetToDemoData,
    camps,
    catalogs,
    tribes,
    selectedCampId,
    getChampionshipsForCamp,
    isLoading,
    dataError,
    refreshData,
  } = useCamp();
  const { currentUser, isRestoring } = useAuth();
  const { confirm } = useConfirm();

  const [preSelectedCourseId, setPreSelectedCourseId] = useState<string | undefined>(undefined);
  const [preSelectedChampId, setPreSelectedChampId] = useState<string | undefined>(undefined);
  const [wizardKey, setWizardKey] = useState(0);

  const openEnrollment = () => {
    setWizardKey((k) => k + 1);
    setActiveTab('enroll');
  };

  const handleSelectCourseForEnrollment = (courseId: string) => {
    setPreSelectedCourseId(courseId);
    openEnrollment();
  };

  const handleSelectChampionshipForEnrollment = (champId: string) => {
    setPreSelectedChampId(champId);
    openEnrollment();
  };

  const isAdminView = activeTab.startsWith('admin');
  const access = checkViewAccess(activeTab, currentUser);
  const hasChampionships = getChampionshipsForCamp(selectedCampId).length > 0;

  // Restaurando sesión o cargando los datos iniciales de la API
  if (isRestoring || (isLoading && !dataError)) return <LoadingScreen />;
  // La API no respondió (500, sin conexión, etc.)
  if (dataError && camps.length === 0) return <ServerErrorPage message={dataError} onRetry={refreshData} />;

  const renderAdmin = () => (
    <AdminLayout>
      {activeTab === 'admin-dashboard' && <AdminDashboard />}
      {activeTab === 'admin-camps' && <CampsManager />}
      {activeTab === 'admin-courses' && <CoursesManager />}
      {activeTab === 'admin-tribes' && <TribesManager />}
      {activeTab === 'admin-roster' && <CampersRoster />}
      {activeTab === 'admin-cashier' && <CashierPayments />}
      {activeTab === 'admin-scanner' && <QRScannerView />}
      {activeTab === 'admin-reports' && <ReportsExporter />}
      {activeTab === 'admin-championships' && <ChampionshipsManager />}
      {activeTab === 'admin-catalogs' && <CatalogsManager />}
      {activeTab === 'admin-payment-settings' && <PaymentSettingsManager />}
      {activeTab === 'admin-users' && <UsersManager />}
      {activeTab === 'admin-roles' && <RolesManager />}
      {activeTab === 'admin-notifications' && <NotificationsManager />}
      {activeTab === 'admin-api' && <ApiExplorer />}
    </AdminLayout>
  );

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900">
      <Navbar />

      <main className="flex-1 pb-20 lg:pb-0 overflow-x-clip">
        {access === 'unauthenticated' ? (
          <UnauthorizedPage />
        ) : access === 'forbidden' ? (
          <ForbiddenPage />
        ) : activeTab === 'not-found' ? (
          <NotFoundPage />
        ) : isAdminView ? (
          renderAdmin()
        ) : (
          <>
            {activeTab === 'catalog' && (
              <>
                <HeroBanner />
                <CampsSection variant="compact" />
                <CourseCatalog onSelectCourseForEnrollment={handleSelectCourseForEnrollment} />
                {hasChampionships && (
                  <ChampionshipsSection onSelectChampionshipForEnrollment={handleSelectChampionshipForEnrollment} />
                )}
              </>
            )}

            {activeTab === 'camps' && (
              <>
                <CampsSection variant="full" />
                <CourseCatalog onSelectCourseForEnrollment={handleSelectCourseForEnrollment} />
              </>
            )}

            {activeTab === 'championships' && (
              <div className="py-6">
                <ChampionshipsSection onSelectChampionshipForEnrollment={handleSelectChampionshipForEnrollment} />
              </div>
            )}

            {activeTab === 'history' && (
              <div className="py-4">
                <PastCampsCarousel />
                <PastEditionsGallery />
              </div>
            )}

            {activeTab === 'my-registrations' && <MyRegistrations />}

            {activeTab === 'enroll' && (
              <EnrollmentWizard
                // No se remonta al iniciar sesión ni al crear la cuenta en la compra: se conservan los datos escritos
                key={wizardKey}
                initialCourseId={preSelectedCourseId}
                initialChampionshipId={preSelectedChampId}
                onEnrollmentComplete={() => {
                  setPreSelectedCourseId(undefined);
                  setPreSelectedChampId(undefined);
                  setActiveTab('catalog');
                }}
              />
            )}

            {activeTab === 'profile' && <ProfilePage />}
            {activeTab === 'registration-detail' && <RegistrationHub />}
            {activeTab === 'team-invite' && <TeamInvitePage />}
          </>
        )}
      </main>

      <BadgeModal camper={selectedCamperForBadge} onClose={() => setSelectedCamperForBadge(null)} />
      <AuthModal />

      <footer className="mt-auto bg-slate-950 text-slate-400 text-xs no-print">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[#0284C7] text-white flex items-center justify-center">
              <Tent className="w-5 h-5" />
            </div>
            <div>
              <span className="font-extrabold text-white font-display text-sm block">
                Comité Juvenil · Unión Cristiana Evangélica
              </span>
              <span className="text-[11px] text-slate-500">
                {camps.filter((c) => c.status !== 'borrador').length} campamentos · {catalogs.regionales.length} regionales ·{' '}
                {tribes.length} tribus
              </span>
            </div>
          </div>
          <div className="flex flex-col sm:items-end gap-1.5">
          <span className="inline-flex items-center gap-1.5 text-[11px] text-slate-500">
            <Server className="w-3 h-3" />
            {isTesting ? 'Entorno de pruebas' : 'Producción'} · {env.useMockApi ? 'API simulada' : 'API real'}
          </span>
          {env.useMockApi && isTesting && (
          <button
            onClick={async () => {
              const ok = await confirm({
                title: '¿Restablecer los datos de demostración?',
                message: 'Se perderán los campamentos, inscripciones y cambios guardados en este navegador.',
                confirmText: 'Sí, restablecer',
                tone: 'warning',
              });
              if (ok) resetToDemoData();
            }}
            className="inline-flex items-center gap-1 text-slate-500 hover:text-sky-300 transition-colors cursor-pointer"
          >
            <RefreshCw className="w-3 h-3" /> Restablecer datos demo
          </button>
          )}
          </div>
        </div>
      </footer>

      <MobileBottomNav />
      <PwaPrompts />
    </div>
  );
};

export default function App() {
  return (
    <ToastProvider>
      <AuthProvider>
        <CampProvider>
          <ConfirmProvider>
            <CampApp />
          </ConfirmProvider>
        </CampProvider>
      </AuthProvider>
    </ToastProvider>
  );
}
