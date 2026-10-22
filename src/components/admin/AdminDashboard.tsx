import React, { useMemo } from 'react';
import {
  Banknote,
  BookOpen,
  CalendarDays,
  ChevronRight,
  Clock,
  FileSpreadsheet,
  LayoutDashboard,
  MapPin,
  Plus,
  QrCode,
  ScanLine,
  Tent,
  TrendingUp,
  UserCheck,
  Users,
  Wallet,
} from 'lucide-react';
import { useCamp } from '../../context/CampContext';
import { useAuth } from '../../context/AuthContext';
import { PaymentTransaction } from '../../types/camp';
import { daysUntil, formatDateRange, getCampPhase, initials, monthLabel, PHASE_META, todayISO, formatBs, isPaymentPending } from '../../utils/campUtils';
import { AdminPage, AdminPageHeader, Badge, Button, CampFilterSelect, Card, EmptyState, StatCard } from './ui';

const PAY_STATUS: Record<PaymentTransaction['status'], { label: string; className: string }> = {
  completed: { label: 'Pagado', className: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  pending_cash: { label: 'Pago en caja', className: 'bg-amber-50 text-amber-700 border-amber-200' },
  pending_verification: { label: 'Por verificar', className: 'bg-violet-50 text-violet-700 border-violet-200' },
  rejected: { label: 'Comprobante rechazado', className: 'bg-red-50 text-red-700 border-red-200' },
  refunded: { label: 'Reembolsado', className: 'bg-slate-100 text-slate-500 border-slate-200' },
};

const SectionTitle: React.FC<{ icon: React.ElementType; title: string; hint?: string; action?: React.ReactNode }> = ({
  icon: Icon,
  title,
  hint,
  action,
}) => (
  <div className="flex items-center justify-between gap-3 mb-4">
    <div className="flex items-center gap-2 min-w-0">
      <div className="p-2 rounded-xl bg-sky-50 text-[#0284C7] shrink-0">
        <Icon className="w-4 h-4" />
      </div>
      <div className="min-w-0">
        <h3 className="text-sm font-black text-slate-900 font-display truncate">{title}</h3>
        {hint && <p className="text-[11px] text-slate-500 truncate">{hint}</p>}
      </div>
    </div>
    {action}
  </div>
);

export const AdminDashboard: React.FC = () => {
  const {
    camps,
    getCampById,
    featuredCamp,
    adminCampFilter,
    setAdminCampFilter,
    registrations,
    courses,
    tribes,
    checkIns,
    setActiveTab,
    setSelectedCamperForBadge,
    getTribeById,
  } = useCamp();
  const { can } = useAuth();
  const canScan = can('checkins:create');
  const canReports = can('reports:export');
  const canCreateCamp = can('camps:create');
  const canSeeCamps = can('camps:read');
  const canSeeRoster = can('registrations:read');
  const quickActions = [canScan, canReports, canCreateCamp].filter(Boolean).length;

  const filterCamp = adminCampFilter === 'ALL' ? undefined : getCampById(adminCampFilter);
  const inScope = (campId: string) => adminCampFilter === 'ALL' || campId === adminCampFilter;

  const scopedRegs = useMemo(
    () =>
      registrations.filter(
        (r) => (adminCampFilter === 'ALL' || r.campId === adminCampFilter) && r.status !== 'cancelled'
      ),
    [registrations, adminCampFilter]
  );
  const scopedCourses = courses.filter((c) => inScope(c.campId));
  const scopedCheckIns = checkIns.filter((c) => inScope(c.campId));

  const today = todayISO();
  const paidRegs = scopedRegs.filter((r) => r.payment.status === 'completed');
  const revenue = paidRegs.reduce((acc, r) => acc + (r.payment.totalAmount || 0), 0);
  const pendingRegs = scopedRegs.filter((r) => isPaymentPending(r.payment.status));
  const pendingAmount = pendingRegs.reduce((acc, r) => {
    const camp = getCampById(r.campId);
    const total =
      r.payment.status === 'pending_cash'
        ? (camp?.price ?? r.payment.baseCampFee) + (r.payment.championshipsFees || 0)
        : r.payment.totalAmount;
    return acc + Math.max(0, total - (r.payment.advanceAmount || 0));
  }, 0);
  const todayCheckIns = scopedCheckIns.filter((c) => c.timestamp.startsWith(today));
  const totalSeats = scopedCourses.reduce((acc, c) => acc + c.maxCapacity, 0);
  const takenSeats = scopedCourses.reduce((acc, c) => acc + c.enrolledCount, 0);

  const sortedCamps = useMemo(() => [...camps].sort((a, b) => a.startDate.localeCompare(b.startDate)), [camps]);

  const campStats = (campId: string) => {
    const regs = registrations.filter((r) => r.campId === campId && r.status !== 'cancelled');
    const income = regs
      .filter((r) => r.payment.status === 'completed')
      .reduce((acc, r) => acc + (r.payment.totalAmount || 0), 0);
    return { count: regs.length, income };
  };

  const tribeDistribution = useMemo(() => {
    const rows = tribes.map((t) => ({ tribe: t, count: scopedRegs.filter((r) => r.tribeId === t.id).length }));
    const max = Math.max(1, ...rows.map((r) => r.count));
    return { rows, max };
  }, [tribes, scopedRegs]);

  const regionalDistribution = useMemo(() => {
    const counts: Record<string, number> = {};
    scopedRegs.forEach((r) => {
      const key = r.regional || 'Sin regional';
      counts[key] = (counts[key] || 0) + 1;
    });
    const rows = Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8);
    const max = Math.max(1, ...rows.map((r) => r[1]));
    return { rows, max };
  }, [scopedRegs]);

  const latestRegs = [...scopedRegs].sort((a, b) => b.registeredAt.localeCompare(a.registeredAt)).slice(0, 6);
  const latestCheckIns = [...scopedCheckIns].sort((a, b) => b.timestamp.localeCompare(a.timestamp)).slice(0, 6);

  const featuredStats = featuredCamp ? campStats(featuredCamp.id) : null;
  const featuredPhase = featuredCamp ? getCampPhase(featuredCamp) : null;
  const countdownText = () => {
    if (!featuredCamp || !featuredPhase) return '';
    if (featuredPhase === 'en_curso') return 'En curso ahora';
    if (featuredPhase === 'finalizado') return 'Finalizado';
    const d = daysUntil(featuredCamp.startDate);
    if (d === 0) return 'Empieza hoy';
    if (d === 1) return 'Falta 1 día';
    return `Faltan ${d} días`;
  };

  return (
    <AdminPage>
      <AdminPageHeader
        kicker="Panel de administración"
        title="Resumen general"
        description={
          filterCamp
            ? `Métricas de ${filterCamp.name} · ${formatDateRange(filterCamp.startDate, filterCamp.endDate)}`
            : `Métricas consolidadas de los ${camps.length} campamentos del año.`
        }
        icon={LayoutDashboard}
        actions={
          <>
            <CampFilterSelect className="w-full sm:w-72" />
            {quickActions > 0 && (
              <div
                className={`grid ${
                  quickActions === 3 ? 'grid-cols-3' : quickActions === 2 ? 'grid-cols-2' : 'grid-cols-1'
                } sm:flex gap-2 w-full sm:w-auto [&>button]:px-2 sm:[&>button]:px-4`}
              >
                {canScan && (
                  <Button variant="primary" icon={ScanLine} onClick={() => setActiveTab('admin-scanner')}>
                    Escáner<span className="hidden sm:inline"> QR</span>
                  </Button>
                )}
                {canReports && (
                  <Button variant="secondary" icon={FileSpreadsheet} onClick={() => setActiveTab('admin-reports')}>
                    Reportes
                  </Button>
                )}
                {canCreateCamp && (
                  <Button variant="secondary" icon={Plus} onClick={() => setActiveTab('admin-camps')}>
                    Nuevo<span className="hidden sm:inline"> campamento</span>
                  </Button>
                )}
              </div>
            )}
          </>
        }
      />

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3 sm:gap-4">
        <StatCard
          label="Inscritos"
          value={scopedRegs.length}
          hint={filterCamp ? `de ${filterCamp.capacity} cupos` : `${camps.length} campamentos`}
          icon={Users}
          tone="sky"
        />
        <StatCard
          label="Ingresos cobrados"
          value={<span className="text-2xl sm:text-3xl">{formatBs(revenue)}</span>}
          hint={`${paidRegs.length} pagos confirmados`}
          icon={Banknote}
          tone="emerald"
        />
        <StatCard
          label="Pendientes de pago"
          value={pendingRegs.length}
          hint={`${formatBs(pendingAmount)} por cobrar`}
          icon={Wallet}
          tone="amber"
        />
        <StatCard
          label="Talleres"
          value={scopedCourses.length}
          hint={totalSeats > 0 ? `${takenSeats}/${totalSeats} cupos ocupados` : 'Sin cupos definidos'}
          icon={BookOpen}
          tone="violet"
        />
        <div className="col-span-2 lg:col-span-1">
          <StatCard
            label="Check-ins de hoy"
            value={todayCheckIns.length}
            hint={`${scopedCheckIns.length} registros en total`}
            icon={UserCheck}
            tone="rose"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Campamento activo */}
        <Card className="lg:col-span-7 overflow-hidden">
          {featuredCamp && featuredStats && featuredPhase ? (
            <div className="flex flex-col h-full">
              <div className="relative h-48 sm:h-56 bg-sky-900">
                {featuredCamp.imageUrl && (
                  <img src={featuredCamp.imageUrl} alt={featuredCamp.name} className="absolute inset-0 w-full h-full object-cover" />
                )}
                <div className="absolute inset-0 bg-linear-to-t from-slate-950/85 via-slate-950/30 to-transparent" />
                <div className="absolute top-4 left-4 right-4 flex items-center justify-between gap-2">
                  <Badge className="bg-white/90 text-[#0284C7] border-white">
                    <Tent className="w-3 h-3" /> Campamento activo
                  </Badge>
                  <Badge className={PHASE_META[featuredPhase].className}>
                    <span className={`w-1.5 h-1.5 rounded-full ${PHASE_META[featuredPhase].dot}`} />
                    {PHASE_META[featuredPhase].label}
                  </Badge>
                </div>
                <div className="absolute bottom-4 left-4 right-4 text-white">
                  <h3 className="text-xl sm:text-2xl font-black font-display leading-tight">{featuredCamp.name}</h3>
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-white/85 mt-1">
                    <span className="flex items-center gap-1">
                      <CalendarDays className="w-3.5 h-3.5" />
                      {formatDateRange(featuredCamp.startDate, featuredCamp.endDate)}
                    </span>
                    {featuredCamp.location && (
                      <span className="flex items-center gap-1">
                        <MapPin className="w-3.5 h-3.5" />
                        {featuredCamp.location}
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <div className="p-5 space-y-4">
                <div className="grid grid-cols-3 gap-3">
                  <div className="rounded-2xl bg-sky-50 p-3 text-center">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-sky-700">Cuenta regresiva</div>
                    <div className="text-sm sm:text-base font-black text-slate-900 mt-1">{countdownText()}</div>
                  </div>
                  <div className="rounded-2xl bg-slate-50 p-3 text-center">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Inscritos</div>
                    <div className="text-sm sm:text-base font-black text-slate-900 mt-1 font-mono tabular-nums">
                      {featuredStats.count}/{featuredCamp.capacity}
                    </div>
                  </div>
                  <div className="rounded-2xl bg-slate-50 p-3 text-center">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Precio</div>
                    <div className="text-sm sm:text-base font-black text-slate-900 mt-1 font-mono tabular-nums">
                      {formatBs(featuredCamp.price)}
                    </div>
                  </div>
                </div>
                <div>
                  <div className="flex items-center justify-between text-[11px] font-bold text-slate-500 mb-1.5">
                    <span>Ocupación</span>
                    <span className="font-mono">
                      {featuredCamp.capacity > 0
                        ? Math.min(100, Math.round((featuredStats.count / featuredCamp.capacity) * 100))
                        : 0}
                      %
                    </span>
                  </div>
                  <div className="h-2.5 rounded-full bg-slate-100 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-linear-to-r from-[#38BDF8] to-[#0284C7] transition-all"
                      style={{
                        width: `${featuredCamp.capacity > 0 ? Math.min(100, (featuredStats.count / featuredCamp.capacity) * 100) : 0}%`,
                      }}
                    />
                  </div>
                  <div className="text-[11px] text-slate-500 mt-1.5">Ingresos cobrados: {formatBs(featuredStats.income)}</div>
                </div>
                <div className="flex flex-col sm:flex-row gap-2">
                  <Button
                    className="flex-1"
                    icon={TrendingUp}
                    variant="secondary"
                    onClick={() => setAdminCampFilter(featuredCamp.id)}
                  >
                    Ver métricas de este campamento
                  </Button>
                  {canSeeCamps && (
                    <Button className="flex-1" icon={Tent} onClick={() => setActiveTab('admin-camps')}>
                      Gestionar campamento
                    </Button>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <EmptyState
              icon={Tent}
              title="No hay un campamento activo"
              description="Marca un campamento como destacado para mostrarlo en la portada y en la inscripción."
              action={
                canSeeCamps ? (
                  <Button icon={Plus} onClick={() => setActiveTab('admin-camps')}>
                    Ir a campamentos
                  </Button>
                ) : undefined
              }
            />
          )}
        </Card>

        {/* Campamentos del año */}
        <Card className="lg:col-span-5 p-5">
          <SectionTitle
            icon={CalendarDays}
            title="Campamentos del año"
            hint="Toca uno para filtrar el panel"
            action={
              adminCampFilter !== 'ALL' ? (
                <Button size="sm" variant="ghost" onClick={() => setAdminCampFilter('ALL')}>
                  Ver todos
                </Button>
              ) : undefined
            }
          />
          {sortedCamps.length === 0 ? (
            <EmptyState icon={Tent} title="Aún no hay campamentos" />
          ) : (
            <div className="space-y-2 max-h-[26rem] overflow-y-auto pr-1 -mr-1">
              {sortedCamps.map((camp) => {
                const phase = getCampPhase(camp);
                const stats = campStats(camp.id);
                const date = monthLabel(camp.startDate);
                const active = adminCampFilter === camp.id;
                return (
                  <button
                    key={camp.id}
                    type="button"
                    onClick={() => setAdminCampFilter(active ? 'ALL' : camp.id)}
                    className={`w-full flex items-center gap-3 p-2.5 rounded-2xl border text-left transition-all cursor-pointer ${
                      active ? 'border-sky-300 bg-sky-50 ring-2 ring-sky-100' : 'border-slate-100 hover:border-sky-200 hover:bg-sky-50/50'
                    }`}
                  >
                    <div
                      className={`w-12 h-12 rounded-xl flex flex-col items-center justify-center shrink-0 ${
                        active ? 'bg-[#0284C7] text-white' : 'bg-slate-50 text-slate-700'
                      }`}
                    >
                      <span className="text-[9px] font-black tracking-wider">{date.month}</span>
                      <span className="text-base font-black leading-none">{date.day}</span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        {camp.isFeatured && <span className="text-amber-500 text-xs">★</span>}
                        <span className="text-xs font-black text-slate-900 truncate">{camp.name}</span>
                      </div>
                      <div className="flex flex-wrap items-center gap-1.5 mt-1">
                        <Badge className={PHASE_META[phase].className}>
                          <span className={`w-1.5 h-1.5 rounded-full ${PHASE_META[phase].dot}`} />
                          {PHASE_META[phase].label}
                        </Badge>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-xs font-black text-slate-900 font-mono tabular-nums">
                        {stats.count}
                        <span className="text-slate-400 font-bold">/{camp.capacity}</span>
                      </div>
                      <div className="text-[10px] text-emerald-600 font-bold font-mono">{formatBs(stats.income)}</div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </Card>
      </div>

      {/* Distribuciones */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="p-5">
          <SectionTitle icon={Users} title="Distribución por tribu" hint={`${scopedRegs.length} inscritos`} />
          {scopedRegs.length === 0 ? (
            <EmptyState icon={Users} title="Sin inscritos todavía" />
          ) : (
            <div className="space-y-2.5">
              {tribeDistribution.rows.map(({ tribe, count }) => (
                <div key={tribe.id} className="flex items-center gap-3">
                  <div className="w-28 sm:w-36 flex items-center gap-2 min-w-0 shrink-0">
                    <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: tribe.colorHex }} />
                    <span className="text-[11px] font-bold text-slate-700 truncate">{tribe.name}</span>
                  </div>
                  <div className="flex-1 h-2.5 rounded-full bg-slate-100 overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{ width: `${(count / tribeDistribution.max) * 100}%`, backgroundColor: tribe.colorHex }}
                    />
                  </div>
                  <span className="w-7 text-right text-xs font-black text-slate-900 font-mono tabular-nums">{count}</span>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card className="p-5">
          <SectionTitle icon={MapPin} title="Distribución por regional" hint="Top 8 regionales" />
          {regionalDistribution.rows.length === 0 ? (
            <EmptyState icon={MapPin} title="Sin inscritos todavía" />
          ) : (
            <div className="space-y-2.5">
              {regionalDistribution.rows.map(([name, count], i) => (
                <div key={name} className="flex items-center gap-3">
                  <span className="w-5 text-[10px] font-black text-slate-400 font-mono">{i + 1}</span>
                  <span className="w-24 sm:w-32 text-[11px] font-bold text-slate-700 truncate shrink-0">{name}</span>
                  <div className="flex-1 h-2.5 rounded-full bg-slate-100 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-linear-to-r from-[#38BDF8] to-[#0284C7] transition-all"
                      style={{ width: `${(count / regionalDistribution.max) * 100}%` }}
                    />
                  </div>
                  <span className="w-7 text-right text-xs font-black text-slate-900 font-mono tabular-nums">{count}</span>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      {/* Actividad reciente */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="p-5">
          <SectionTitle
            icon={QrCode}
            title="Últimas inscripciones"
            hint="Toca para ver la credencial"
            action={
              canSeeRoster ? (
                <Button size="sm" variant="ghost" onClick={() => setActiveTab('admin-roster')}>
                  Ver todas <ChevronRight className="w-3.5 h-3.5" />
                </Button>
              ) : undefined
            }
          />
          {latestRegs.length === 0 ? (
            <EmptyState icon={Users} title="Sin inscripciones" description="Las nuevas inscripciones aparecerán aquí." />
          ) : (
            <div className="divide-y divide-slate-100">
              {latestRegs.map((r) => {
                const tribe = getTribeById(r.tribeId);
                const camp = getCampById(r.campId);
                const pay = PAY_STATUS[r.payment.status];
                return (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => setSelectedCamperForBadge(r)}
                    className="w-full flex items-center gap-3 py-2.5 text-left hover:bg-sky-50/60 rounded-xl px-2 -mx-2 transition-colors cursor-pointer"
                  >
                    <div
                      className="w-9 h-9 rounded-xl flex items-center justify-center text-white text-[11px] font-black shrink-0"
                      style={{ backgroundColor: tribe?.colorHex || '#0284C7' }}
                    >
                      {initials(r.fullName)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-bold text-slate-900 truncate">{r.fullName}</div>
                      <div className="text-[10px] text-slate-500 truncate">
                        <span className="font-mono">{r.ticketCode}</span>
                        {adminCampFilter === 'ALL' && camp ? ` · ${camp.name}` : ''}
                      </div>
                    </div>
                    <Badge className={pay.className}>{pay.label}</Badge>
                  </button>
                );
              })}
            </div>
          )}
        </Card>

        <Card className="p-5">
          <SectionTitle
            icon={UserCheck}
            title="Check-ins recientes"
            hint={`${todayCheckIns.length} hoy`}
            action={
              canScan ? (
                <Button size="sm" variant="ghost" onClick={() => setActiveTab('admin-scanner')}>
                  Escáner <ChevronRight className="w-3.5 h-3.5" />
                </Button>
              ) : undefined
            }
          />
          {latestCheckIns.length === 0 ? (
            <EmptyState icon={ScanLine} title="Sin check-ins" description="Los ingresos validados con QR aparecerán aquí." />
          ) : (
            <div className="divide-y divide-slate-100">
              {latestCheckIns.map((log) => {
                const [date, time] = log.timestamp.split(' ');
                return (
                  <div key={log.id} className="flex items-center gap-3 py-2.5">
                    <div
                      className={`p-2 rounded-xl shrink-0 ${
                        log.type === 'GATE_ENTRY' ? 'bg-sky-50 text-[#0284C7]' : 'bg-violet-50 text-violet-600'
                      }`}
                    >
                      {log.type === 'GATE_ENTRY' ? <Tent className="w-4 h-4" /> : <BookOpen className="w-4 h-4" />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-bold text-slate-900 truncate">{log.camperName}</div>
                      <div className="text-[10px] text-slate-500 truncate">{log.courseTitle}</div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="flex items-center justify-end gap-1 text-[11px] font-bold text-slate-700 font-mono">
                        <Clock className="w-3 h-3 text-slate-400" />
                        {time?.slice(0, 5)}
                      </div>
                      <div className="text-[10px] text-slate-400 font-mono">{date === today ? 'Hoy' : date}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      </div>
    </AdminPage>
  );
};
