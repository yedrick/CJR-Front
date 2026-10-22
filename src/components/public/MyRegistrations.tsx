import React, { useState } from 'react';
import { CamperRegistration } from '../../types/camp';
import { ResubmitModal } from './RegistrationHub';
import { useCamp } from '../../context/CampContext';
import { useAuth } from '../../context/AuthContext';
import { animalEmoji, daysUntil, formatDateRange, getCampPhase, PHASE_META } from '../../utils/campUtils';
import {
  AlertTriangle,
  ArrowRight,
  BookOpen,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  Clock,
  LogIn,
  MapPin,
  QrCode,
  Tent,
  Ticket,
  Trophy,
  Upload,
} from 'lucide-react';

export const MyRegistrations: React.FC = () => {
  const { myRegistrations, getCampById, getTribeById, setSelectedCamperForBadge, setActiveTab, resubmitVoucher } =
    useCamp();
  const [resubmitting, setResubmitting] = useState<CamperRegistration | null>(null);
  const { currentUser, isAuthenticated, requireLogin } = useAuth();

  if (!isAuthenticated) {
    return (
      <div className="max-w-md mx-auto my-16 px-4 text-center space-y-4">
        <div className="w-16 h-16 rounded-3xl bg-sky-100 text-sky-600 flex items-center justify-center mx-auto">
          <Ticket className="w-8 h-8" />
        </div>
        <h2 className="text-2xl font-black text-slate-900 font-display">Tus entradas te esperan</h2>
        <p className="text-sm text-slate-500">Inicia sesión para ver tus inscripciones y credenciales de cada campamento.</p>
        <button
          type="button"
          onClick={() => requireLogin('login')}
          className="inline-flex items-center gap-2 px-6 py-3 rounded-2xl bg-[#0284C7] text-white font-black text-sm shadow cursor-pointer"
        >
          <LogIn className="w-4 h-4" /> Iniciar sesión
        </button>
      </div>
    );
  }

  const regs = myRegistrations
    .map((r) => ({ reg: r, camp: getCampById(r.campId) }))
    .sort((a, b) => (b.camp?.startDate || '').localeCompare(a.camp?.startDate || ''));

  const upcoming = regs.filter(({ camp }) => camp && getCampPhase(camp) !== 'finalizado');
  const past = regs.filter(({ camp }) => !camp || getCampPhase(camp) === 'finalizado');

  const renderTicket = ({ reg, camp }: (typeof regs)[number], faded = false) => {
    const tribe = getTribeById(reg.tribeId);
    const color = tribe?.colorHex || '#0284C7';
    const phase = camp ? getCampPhase(camp) : 'finalizado';
    const isPaid = reg.payment.status === 'completed';
    const days = camp ? daysUntil(camp.startDate) : 0;
    const coursesCount = reg.enrolledCourseIds.length;
    const champsCount = reg.enrolledChampionshipIds.length;
    // Tocar la entrada abre "Mi campamento" (talleres, campeonatos, pagos y credencial)
    const openHub = () => setActiveTab('registration-detail', { id: reg.id });

    return (
      <div
        key={reg.id}
        role="button"
        tabIndex={0}
        aria-label={`Abrir mi campamento: ${camp?.name || 'Campamento'}`}
        onClick={openHub}
        onKeyDown={(e) => {
          if (e.target !== e.currentTarget) return;
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            openHub();
          }
        }}
        className={`group w-full text-left flex flex-col sm:flex-row bg-white rounded-3xl overflow-hidden border border-slate-100 shadow-sm hover:shadow-xl hover:-translate-y-0.5 transition-all cursor-pointer ${
          faded ? 'opacity-80' : ''
        }`}
      >
        <div className="relative sm:w-56 h-36 sm:h-auto shrink-0 bg-slate-900">
          {camp?.imageUrl && <img src={camp.imageUrl} alt="" className="absolute inset-0 w-full h-full object-cover" />}
          <div className="absolute inset-0" style={{ background: `linear-gradient(135deg, ${color}dd, ${color}55)` }} />
          <div className="relative h-full p-4 flex flex-col justify-between text-white">
            <span className="text-3xl">{animalEmoji(tribe?.animalSymbol)}</span>
            <div>
              <div className="text-[10px] font-black uppercase tracking-widest text-white/80">Tribu</div>
              <div className="text-sm font-black leading-tight">{tribe?.name.replace(/^Tribu \d+:\s*/, '') || 'Por asignar'}</div>
            </div>
          </div>
        </div>

        <div className="relative flex-1 p-5 flex flex-col gap-2 min-w-0">
          <div className="hidden sm:block absolute -left-3 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-slate-50" />
          <div className="flex flex-wrap items-center gap-2">
            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold border ${PHASE_META[phase].className}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${PHASE_META[phase].dot}`} />
              {PHASE_META[phase].label}
            </span>
            {isPaid ? (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-100">
                <CheckCircle2 className="w-3 h-3" /> Pagado
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-100">
                <Clock className="w-3 h-3" />{' '}
                {reg.payment.status === 'pending_verification'
                  ? 'Pago en revisión'
                  : reg.payment.status === 'rejected'
                  ? 'Comprobante rechazado'
                  : 'Pago pendiente'}
              </span>
            )}
          </div>
          <h3 className="text-lg font-black text-slate-900 font-display leading-tight group-hover:text-[#0284C7] transition-colors">
            {camp?.name || 'Campamento'}
          </h3>
          {camp && (
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500 font-semibold">
              <span className="flex items-center gap-1">
                <CalendarDays className="w-3.5 h-3.5" /> {formatDateRange(camp.startDate, camp.endDate)}
              </span>
              <span className="flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5" /> {camp.location}
              </span>
            </div>
          )}
          <div className="flex flex-wrap gap-1.5">
            <span
              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-bold border ${
                coursesCount ? 'bg-violet-50 text-violet-700 border-violet-100' : 'bg-slate-50 text-slate-500 border-slate-100'
              }`}
            >
              <BookOpen className="w-3 h-3" />
              {coursesCount ? `${coursesCount} ${coursesCount === 1 ? 'taller' : 'talleres'}` : 'Sin talleres'}
            </span>
            <span
              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-bold border ${
                champsCount ? 'bg-amber-50 text-amber-800 border-amber-100' : 'bg-slate-50 text-slate-500 border-slate-100'
              }`}
            >
              <Trophy className="w-3 h-3" />
              {champsCount ? `${champsCount} ${champsCount === 1 ? 'campeonato' : 'campeonatos'}` : 'Sin campeonatos'}
            </span>
            {isPaid && phase !== 'finalizado' && coursesCount === 0 && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-black bg-sky-50 text-sky-700 border border-sky-100">
                ¡Ya puedes elegir tus talleres!
              </span>
            )}
          </div>
          {reg.payment.status === 'rejected' && (
            <div
              className="rounded-2xl bg-red-50 border border-red-100 p-3 flex flex-col sm:flex-row sm:items-center gap-2.5"
              onClick={(e) => e.stopPropagation()}
            >
              <AlertTriangle className="w-5 h-5 text-red-500 shrink-0" />
              <div className="flex-1 text-xs text-red-800">
                <strong className="block">Tesorería rechazó tu comprobante</strong>
                Motivo: {reg.payment.rejectionReason || 'No especificado'}
              </div>
              <button
                type="button"
                onClick={() => setResubmitting(reg)}
                className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white text-[11px] font-black cursor-pointer"
              >
                <Upload className="w-3.5 h-3.5" /> Subir nuevo comprobante
              </button>
            </div>
          )}
          <div className="mt-auto pt-3 border-t border-dashed border-slate-200 flex items-center justify-between gap-3">
            <div>
              <div className="text-[9px] font-black uppercase tracking-wider text-slate-400">Código de entrada</div>
              <div className="font-mono text-sm font-black text-slate-800">{reg.ticketCode}</div>
            </div>
            <div className="flex items-center gap-3">
              {phase !== 'finalizado' && days > 0 && (
                <div className="text-right">
                  <div className="text-xl font-black font-mono text-[#0284C7] leading-none">{days}</div>
                  <div className="text-[9px] font-bold text-slate-400 uppercase">días</div>
                </div>
              )}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedCamperForBadge(reg);
                }}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-[11px] font-black bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 cursor-pointer"
              >
                <QrCode className="w-3.5 h-3.5" style={{ color }} /> Credencial
              </button>
              <span
                className="hidden sm:inline-flex items-center gap-1 px-3 py-2 rounded-xl text-[11px] font-black text-white"
                style={{ backgroundColor: color }}
              >
                Mi campamento <ChevronRight className="w-3.5 h-3.5" />
              </span>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-[70vh] bg-slate-50">
      <div className="bg-gradient-to-br from-slate-900 via-sky-900 to-[#0284C7] text-white">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
          <div className="text-[11px] font-black uppercase tracking-widest text-sky-200 flex items-center gap-2">
            <Ticket className="w-4 h-4" /> Mis inscripciones
          </div>
          <h1 className="text-3xl sm:text-4xl font-black font-display mt-1">Hola, {currentUser?.firstName} 👋</h1>
          <p className="text-sm text-sky-100 mt-1">
            Aquí se guardan tus entradas a cada campamento. Toca una para abrir «Mi campamento»: elige tus talleres y
            campeonatos, revisa tu pago y descarga tu credencial.
          </p>
          <div className="flex gap-3 mt-5">
            <div className="rounded-2xl bg-white/10 border border-white/15 px-4 py-2">
              <div className="text-2xl font-black font-mono">{upcoming.length}</div>
              <div className="text-[10px] text-sky-100 font-bold uppercase">Próximas</div>
            </div>
            <div className="rounded-2xl bg-white/10 border border-white/15 px-4 py-2">
              <div className="text-2xl font-black font-mono">{past.length}</div>
              <div className="text-[10px] text-sky-100 font-bold uppercase">Vividas</div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {regs.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-3xl border border-dashed border-slate-200">
            <Tent className="w-12 h-12 text-slate-300 mx-auto" />
            <h3 className="text-lg font-black text-slate-800 mt-3">Aún no tienes inscripciones</h3>
            <p className="text-sm text-slate-500 mt-1">Elige un campamento y obtén tu credencial en minutos.</p>
            <button
              type="button"
              onClick={() => setActiveTab('camps')}
              className="mt-5 inline-flex items-center gap-2 px-6 py-3 rounded-2xl bg-[#0284C7] text-white font-black text-sm shadow cursor-pointer"
            >
              Ver campamentos <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <>
            {upcoming.length > 0 && (
              <section className="space-y-3">
                <h2 className="text-sm font-black text-slate-500 uppercase tracking-wider">Próximos campamentos</h2>
                <div className="space-y-4">{upcoming.map((x) => renderTicket(x))}</div>
              </section>
            )}
            {past.length > 0 && (
              <section className="space-y-3">
                <h2 className="text-sm font-black text-slate-500 uppercase tracking-wider">Campamentos vividos</h2>
                <div className="space-y-4">{past.map((x) => renderTicket(x, true))}</div>
              </section>
            )}
            <div className="text-center">
              <button
                type="button"
                onClick={() => setActiveTab('camps')}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-white border border-sky-200 text-sky-700 font-bold text-xs cursor-pointer hover:bg-sky-50"
              >
                Inscribirme a otro campamento <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </>
        )}
      </div>

      <ResubmitModal
        open={!!resubmitting}
        onClose={() => setResubmitting(null)}
        title="Subir nuevo comprobante"
        subtitle={resubmitting ? `${getCampById(resubmitting.campId)?.name || ''} · ${resubmitting.ticketCode}` : ''}
        amount={resubmitting?.payment.totalAmount ?? 0}
        reason={resubmitting?.payment.rejectionReason}
        onSubmit={async (v) => !!resubmitting && !!(await resubmitVoucher(resubmitting.id, v))}
      />
    </div>
  );
};
