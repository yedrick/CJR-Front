import React from 'react';
import { useCamp } from '../../context/CampContext';
import { useAuth } from '../../context/AuthContext';
import { 
  Tent, 
  BookOpen, 
  Trophy, 
  Image as ImageIcon, 
  QrCode, 
  UserPlus
} from 'lucide-react';

export const MobileBottomNav: React.FC = () => {
  const { activeTab, setActiveTab, registrations, setSelectedCamperForBadge } = useCamp();
  const { currentUser } = useAuth();

  // Find if current user has an active registration
  const myCamperProfile = currentUser
    ? registrations.find(
        (r) => r.userId === currentUser.id || r.email.toLowerCase() === currentUser.email.toLowerCase()
      )
    : null;

  return (
    <nav 
      aria-label="Navegación móvil inferior"
      className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-sky-100 shadow-2xl px-2 py-1.5 pb-safe"
    >
      <div className="grid grid-cols-5 items-center gap-1 max-w-md mx-auto">
        
        {/* Tab 1: Inicio */}
        <button
          type="button"
          onClick={() => {
            setActiveTab('catalog');
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
          className={`flex flex-col items-center justify-center py-1.5 px-1 rounded-xl transition-all ${
            activeTab === 'catalog'
              ? 'text-[#0284C7] font-extrabold bg-sky-50'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Tent className={`w-5 h-5 ${activeTab === 'catalog' ? 'text-[#0284C7]' : 'text-slate-400'}`} />
          <span className="text-[10px] tracking-tight mt-0.5">Inicio</span>
        </button>

        {/* Tab 2: Talleres */}
        <button
          type="button"
          onClick={() => {
            if (activeTab !== 'catalog') {
              setActiveTab('catalog');
            }
            setTimeout(() => {
              const el = document.getElementById('courses-catalog-section');
              el?.scrollIntoView({ behavior: 'smooth' });
            }, 50);
          }}
          className={`flex flex-col items-center justify-center py-1.5 px-1 rounded-xl transition-all ${
            activeTab === 'catalog'
              ? 'text-slate-700'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <BookOpen className="w-5 h-5 text-slate-400" />
          <span className="text-[10px] tracking-tight mt-0.5">Talleres</span>
        </button>

        {/* Tab 3: Campeonatos */}
        <button
          type="button"
          onClick={() => {
            setActiveTab('championships');
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
          className={`flex flex-col items-center justify-center py-1.5 px-1 rounded-xl transition-all ${
            activeTab === 'championships'
              ? 'text-[#0284C7] font-extrabold bg-sky-50'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Trophy className={`w-5 h-5 ${activeTab === 'championships' ? 'text-amber-500' : 'text-slate-400'}`} />
          <span className="text-[10px] tracking-tight mt-0.5">Torneos</span>
        </button>

        {/* Tab 4: Galería / Ediciones Pasadas */}
        <button
          type="button"
          onClick={() => {
            setActiveTab('history');
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
          className={`flex flex-col items-center justify-center py-1.5 px-1 rounded-xl transition-all ${
            activeTab === 'history'
              ? 'text-[#0284C7] font-extrabold bg-sky-50'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <ImageIcon className={`w-5 h-5 ${activeTab === 'history' ? 'text-[#0284C7]' : 'text-slate-400'}`} />
          <span className="text-[10px] tracking-tight mt-0.5">Galería</span>
        </button>

        {/* Tab 5: Inscripción / Gafete QR */}
        {myCamperProfile ? (
          <button
            type="button"
            onClick={() => setSelectedCamperForBadge(myCamperProfile)}
            className="flex flex-col items-center justify-center py-1.5 px-1 rounded-xl text-[#0284C7] font-bold bg-sky-50 hover:bg-sky-100 transition-all border border-sky-300"
          >
            <QrCode className="w-5 h-5 text-[#0284C7] animate-pulse" />
            <span className="text-[10px] tracking-tight mt-0.5">Mi Gafete</span>
          </button>
        ) : (
          <button
            type="button"
            onClick={() => {
              setActiveTab('enroll');
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            className={`flex flex-col items-center justify-center py-1.5 px-1 rounded-xl transition-all ${
              activeTab === 'enroll'
                ? 'text-[#0284C7] font-extrabold bg-sky-50'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <UserPlus className={`w-5 h-5 ${activeTab === 'enroll' ? 'text-[#0284C7]' : 'text-slate-400'}`} />
            <span className="text-[10px] tracking-tight mt-0.5">Inscribirme</span>
          </button>
        )}

      </div>
    </nav>
  );
};
