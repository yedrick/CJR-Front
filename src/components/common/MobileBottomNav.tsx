import React from 'react';
import { useCamp } from '../../context/CampContext';
import { useAuth } from '../../context/AuthContext';
import { ViewTab } from '../../types/camp';
import { CalendarDays, Image as ImageIcon, ShieldCheck, Tent, Ticket, UserPlus } from 'lucide-react';
import { firstAdminTab } from '../../auth/access';

export const MobileBottomNav: React.FC = () => {
  const { activeTab, setActiveTab, myRegistrations } = useCamp();
  const { currentUser, isStaff } = useAuth();
  const adminHome = isStaff ? firstAdminTab(currentUser) : null;
  const myRegs = myRegistrations;

  const items: { tab: ViewTab; label: string; icon: React.ElementType; badge?: number }[] = [
    { tab: 'catalog', label: 'Inicio', icon: Tent },
    { tab: 'camps', label: 'Campamentos', icon: CalendarDays },
    { tab: 'enroll', label: 'Inscribirme', icon: UserPlus },
    { tab: 'my-registrations', label: 'Mis entradas', icon: Ticket, badge: myRegs.length },
    adminHome
      ? { tab: adminHome, label: 'Panel', icon: ShieldCheck }
      : { tab: 'history', label: 'Galería', icon: ImageIcon },
  ];

  return (
    <nav
      aria-label="Navegación móvil inferior"
      className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-100 shadow-2xl px-2 py-1.5 pb-safe no-print"
    >
      <div className="grid grid-cols-5 items-end gap-1 max-w-md mx-auto">
        {items.map(({ tab, label, icon: Icon, badge }) => {
          const active = activeTab === tab || (label === 'Panel' && activeTab.startsWith('admin'));
          if (tab === 'enroll') {
            return (
              <button key={tab} type="button" onClick={() => setActiveTab(tab)} className="flex flex-col items-center -mt-5">
                <span className="w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 text-white flex items-center justify-center shadow-lg ring-4 ring-white">
                  <Icon className="w-5 h-5" />
                </span>
                <span className={`text-[10px] mt-0.5 ${active ? 'text-orange-600 font-extrabold' : 'text-slate-600'}`}>{label}</span>
              </button>
            );
          }
          return (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTab(tab)}
              className={`relative flex flex-col items-center justify-center py-1.5 rounded-xl transition-all ${
                active ? 'text-[#0284C7] font-extrabold bg-sky-50' : 'text-slate-500'
              }`}
            >
              <Icon className="w-5 h-5" />
              <span className="text-[10px] tracking-tight mt-0.5 truncate max-w-full">{label}</span>
              {!!badge && (
                <span className="absolute top-0.5 right-2 min-w-4 h-4 px-1 rounded-full bg-[#0284C7] text-white text-[9px] font-black flex items-center justify-center">
                  {badge}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
};
