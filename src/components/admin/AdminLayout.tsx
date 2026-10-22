import React from 'react';
import { useCamp } from '../../context/CampContext';
import { useAuth } from '../../context/AuthContext';
import { ViewTab } from '../../types/camp';
import { CampFilterSelect } from './ui';
import { checkViewAccess } from '../../auth/access';
import { ROLE_LABEL } from '../../auth/permissions';
import {
  Banknote,
  Bell,
  Code2,
  KeyRound,
  UserCog,
  Trophy,
  BookOpen,
  CreditCard,
  FileSpreadsheet,
  Flame,
  LayoutDashboard,
  ListTree,
  LogOut,
  QrCode,
  ShieldCheck,
  Tent,
  Users,
} from 'lucide-react';

interface NavItem {
  tab: ViewTab;
  label: string;
  icon: React.ElementType;
  badge?: number;
  badgeTone?: 'amber' | 'violet';
}

export const AdminLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { activeTab, setActiveTab, registrations, adminCampFilter, getCampById } = useCamp();
  const { currentUser } = useAuth();

  const scoped = adminCampFilter === 'ALL' ? registrations : registrations.filter((r) => r.campId === adminCampFilter);
  const toVerify = scoped.filter((r) => r.payment.status === 'pending_verification').length;
  const inCash = scoped.filter((r) => r.payment.status === 'pending_cash').length;
  const filteredCamp = adminCampFilter === 'ALL' ? undefined : getCampById(adminCampFilter);

  const baseGroups: { title: string; items: NavItem[] }[] = [
    { title: 'General', items: [{ tab: 'admin-dashboard', label: 'Resumen', icon: LayoutDashboard }] },
    {
      title: 'Campamentos',
      items: [
        { tab: 'admin-camps', label: 'Campamentos', icon: Tent },
        { tab: 'admin-courses', label: 'Talleres', icon: BookOpen },
        { tab: 'admin-roster', label: 'Inscritos', icon: Users, badge: scoped.length },
        { tab: 'admin-tribes', label: 'Tribus', icon: Flame },
        { tab: 'admin-championships', label: 'Campeonatos y equipos', icon: Trophy },
      ],
    },
    {
      title: 'Finanzas',
      items: [
        { tab: 'admin-cashier', label: 'Pagos y caja', icon: Banknote, badge: toVerify + inCash, badgeTone: toVerify ? 'violet' : 'amber' },
        { tab: 'admin-payment-settings', label: 'Métodos de pago', icon: CreditCard },
      ],
    },
    {
      title: 'Operación',
      items: [
        { tab: 'admin-scanner', label: 'Escáner QR', icon: QrCode },
        { tab: 'admin-reports', label: 'Reportes', icon: FileSpreadsheet },
      ],
    },
    {
      title: 'Comunicación',
      items: [{ tab: 'admin-notifications', label: 'Avisos y notificaciones', icon: Bell }],
    },
    {
      title: 'Configuración',
      items: [
        { tab: 'admin-catalogs', label: 'Catálogos', icon: ListTree },
        { tab: 'admin-users', label: 'Usuarios', icon: UserCog },
        { tab: 'admin-roles', label: 'Roles y permisos', icon: KeyRound },
        { tab: 'admin-api', label: 'Explorador de API', icon: Code2 },
      ],
    },
  ];
  // Solo se muestran las secciones a las que el usuario tiene permiso
  const groups = baseGroups
    .map((g) => ({ ...g, items: g.items.filter((i) => checkViewAccess(i.tab, currentUser) === 'ok') }))
    .filter((g) => g.items.length > 0);
  const allItems = groups.flatMap((g) => g.items);

  const badgeCls = (tone?: 'amber' | 'violet', active?: boolean) =>
    active
      ? 'bg-white/25 text-white'
      : tone === 'violet'
      ? 'bg-violet-500 text-white'
      : tone === 'amber'
      ? 'bg-amber-400 text-slate-950'
      : 'bg-slate-800 text-slate-300';

  return (
    <div className="lg:grid lg:grid-cols-[264px_minmax(0,1fr)] min-h-[calc(100vh-5rem)]">
      {/* ── BARRA LATERAL (escritorio) ─────────────────── */}
      <aside className="hidden lg:flex flex-col bg-slate-950 text-slate-300 sticky top-20 h-[calc(100vh-5rem)] overflow-y-auto no-scrollbar no-print">
        <div className="p-5 border-b border-white/5">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-[#0284C7] text-white flex items-center justify-center">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="text-sm font-black text-white font-display leading-tight">Panel de administración</div>
              <div className="text-[11px] text-slate-500 truncate">
                {currentUser ? ROLE_LABEL[currentUser.role] : ''} · {currentUser?.email}
              </div>
            </div>
          </div>
          <div className="mt-4 space-y-1.5">
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Trabajando en</span>
            <CampFilterSelect inSidebar />
            {filteredCamp && (
              <div className="flex items-center gap-2 rounded-xl overflow-hidden bg-white/5 border border-white/5">
                <img src={filteredCamp.imageUrl} alt="" className="w-12 h-10 object-cover" />
                <span className="text-[11px] font-semibold text-slate-300 truncate pr-2">{filteredCamp.location}</span>
              </div>
            )}
          </div>
        </div>

        <nav className="flex-1 p-3 space-y-5">
          {groups.map((g) => (
            <div key={g.title}>
              <div className="px-3 pb-1.5 text-[10px] font-black uppercase tracking-widest text-slate-600">{g.title}</div>
              <div className="space-y-0.5">
                {g.items.map(({ tab, label, icon: Icon, badge, badgeTone }) => {
                  const active = activeTab === tab;
                  return (
                    <button
                      key={tab}
                      type="button"
                      onClick={() => setActiveTab(tab)}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-colors cursor-pointer ${
                        active ? 'bg-[#0284C7] text-white shadow-lg shadow-sky-900/40' : 'hover:bg-white/5 hover:text-white'
                      }`}
                    >
                      <Icon className={`w-4 h-4 ${active ? 'text-white' : 'text-slate-500'}`} />
                      <span className="flex-1 text-left">{label}</span>
                      {!!badge && (
                        <span className={`min-w-5 h-5 px-1.5 rounded-full text-[10px] font-black flex items-center justify-center ${badgeCls(badgeTone, active)}`}>
                          {badge}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        <div className="p-3 border-t border-white/5">
          <button
            type="button"
            onClick={() => setActiveTab('catalog')}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold text-slate-400 hover:bg-white/5 hover:text-white cursor-pointer"
          >
            <LogOut className="w-4 h-4" /> Volver al sitio
          </button>
        </div>
      </aside>

      {/* ── CONTENIDO ──────────────────────────────────── */}
      <div className="min-w-0">
        {/* Navegación compacta para celular y tablet */}
        <div className="lg:hidden sticky top-16 sm:top-20 z-30 bg-slate-950 no-print">
          <div className="flex gap-1 overflow-x-auto no-scrollbar px-3 py-2">
            {allItems.map(({ tab, label, icon: Icon, badge, badgeTone }) => {
              const active = activeTab === tab;
              return (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setActiveTab(tab)}
                  className={`shrink-0 inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold cursor-pointer ${
                    active ? 'bg-[#0284C7] text-white' : 'text-slate-300 hover:bg-white/10'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  {label}
                  {!!badge && (
                    <span className={`min-w-4 h-4 px-1 rounded-full text-[9px] font-black flex items-center justify-center ${badgeCls(badgeTone, active)}`}>
                      {badge}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
        {children}
      </div>
    </div>
  );
};
