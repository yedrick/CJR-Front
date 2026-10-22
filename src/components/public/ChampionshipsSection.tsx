import React, { useState } from 'react';
import { useCamp } from '../../context/CampContext';
import { Championship } from '../../types/camp';
import { formatDateRange, formatLongDate, isCampEnrollable, todayISO } from '../../utils/campUtils';
import {
  ArrowRight,
  CalendarClock,
  CheckCircle2,
  Clock,
  Hourglass,
  Info,
  Lock,
  Medal,
  Ticket,
  Trophy,
  User,
  Users,
  X,
} from 'lucide-react';

interface ChampionshipsSectionProps {
  onSelectChampionshipForEnrollment?: (champId: string) => void;
}

const FALLBACK_IMAGE = 'https://images.unsplash.com/photo-1574629810360-7efbbe195018?q=80&w=800&auto=format&fit=crop';

/** "Individual" o "Por equipos 5–8 integrantes". */
function modeLabel(ch: Championship): string {
  if (ch.mode !== 'team') return 'Individual';
  const min = ch.minTeamSize;
  const max = ch.maxTeamSize;
  if (min && max && min !== max) return `Por equipos ${min}–${max} integrantes`;
  if (min || max) return `Por equipos de ${min || max} integrantes`;
  return 'Por equipos';
}

/** "Gratis" · "20 Bs por persona" · "160 Bs por equipo". */
function feeLabel(ch: Championship): string {
  if (!ch.registrationFee) return 'Gratis';
  return `${ch.registrationFee} Bs ${ch.mode === 'team' ? 'por equipo' : 'por persona'}`;
}

const isClosed = (ch: Championship) => !!ch.registrationClosesAt && ch.registrationClosesAt < todayISO();

const GENDER_STYLE: Record<Championship['genderCategory'], string> = {
  Varonil: 'bg-sky-500/90 text-white',
  Femenil: 'bg-pink-500/90 text-white',
  Mixto: 'bg-violet-500/90 text-white',
};

export const ChampionshipsSection: React.FC<ChampionshipsSectionProps> = ({ onSelectChampionshipForEnrollment }) => {
  const { championships, selectedCamp, setActiveTab, myRegistrations } = useCamp();
  const [activeModalChamp, setActiveModalChamp] = useState<Championship | null>(null);

  // Solo los campeonatos del campamento seleccionado
  const list = selectedCamp ? championships.filter((ch) => ch.campId === selectedCamp.id) : [];

  // Los campeonatos se eligen DESPUÉS de pagar el campamento, desde «Mi campamento»
  const myReg = selectedCamp ? myRegistrations.find((r) => r.campId === selectedCamp.id) : undefined;
  const isPaid = myReg?.payment.status === 'completed';
  const enrollable = isCampEnrollable(selectedCamp);
  const goToMyCamp = () => myReg && setActiveTab('registration-detail', { id: myReg.id });
  const goEnrollCamp = (champId?: string) => {
    if (champId && onSelectChampionshipForEnrollment) onSelectChampionshipForEnrollment(champId);
    else setActiveTab('enroll');
  };

  const ctaFor = (ch: Championship) => {
    const full = ch.enrolledTeamsCount >= ch.maxTeamsOrParticipants;
    if (myReg && isPaid) {
      if (myReg.enrolledChampionshipIds.includes(ch.id)) {
        return { label: 'Inscrito', icon: CheckCircle2, onClick: goToMyCamp, disabled: false, tone: 'done' as const };
      }
      if (isClosed(ch)) return { label: 'Cerrado', icon: Lock, onClick: goToMyCamp, disabled: true, tone: 'muted' as const };
      if (full) return { label: 'Sin cupos', icon: Lock, onClick: goToMyCamp, disabled: true, tone: 'muted' as const };
      return {
        label: ch.mode === 'team' ? 'Armar mi equipo' : 'Inscribirme',
        icon: ArrowRight,
        onClick: goToMyCamp,
        disabled: false,
        tone: 'primary' as const,
      };
    }
    if (myReg) return { label: 'Tras tu pago', icon: Hourglass, onClick: goToMyCamp, disabled: false, tone: 'pending' as const };
    return {
      label: enrollable ? 'Inscríbete al campamento' : 'Inscripciones cerradas',
      icon: Ticket,
      onClick: () => goEnrollCamp(ch.id),
      disabled: !enrollable,
      tone: 'primary' as const,
    };
  };

  const CTA_TONE = {
    primary: 'bg-[#0284C7] hover:bg-[#0369A1] text-white',
    done: 'bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100',
    pending: 'bg-amber-50 text-amber-800 border border-amber-200 hover:bg-amber-100',
    muted: 'bg-slate-100 text-slate-400',
  } as const;

  const headerCta = myReg
    ? { label: isPaid ? 'Elegir mis campeonatos' : 'Ver mi inscripción', onClick: goToMyCamp, disabled: false }
    : { label: enrollable ? 'Inscríbete al campamento' : 'Inscripciones cerradas', onClick: () => goEnrollCamp(), disabled: !enrollable };

  const note = isPaid
    ? 'Tu pago está confirmado: inscríbete o arma tu equipo desde «Mi campamento».'
    : myReg
    ? 'Podrás inscribirte a los campeonatos cuando se confirme el pago de tu campamento.'
    : 'Te inscribes a los campeonatos después de pagar tu campamento.';

  return (
    <section id="championships-section" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 border-t border-sky-100 animate-fade-in">
      {/* Encabezado */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-6">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-xs font-extrabold text-[#0284C7] uppercase tracking-widest">
            <Trophy className="w-4 h-4 text-amber-500" />
            <span>Olimpiadas y campeonatos</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 font-display mt-1">
            {selectedCamp ? `Campeonatos de ${selectedCamp.name}` : 'Campeonatos'}
          </h2>
          {selectedCamp && (
            <p className="text-xs sm:text-sm text-slate-500 mt-1">
              {formatDateRange(selectedCamp.startDate, selectedCamp.endDate)} · {selectedCamp.location}
            </p>
          )}
        </div>

        <button
          type="button"
          onClick={headerCta.onClick}
          disabled={headerCta.disabled}
          className="inline-flex items-center gap-2 px-5 py-2.5 text-xs font-bold text-white bg-[#0284C7] hover:bg-[#0369A1] rounded-xl transition-all shadow-md self-start md:self-auto shrink-0 active:scale-95 cursor-pointer disabled:bg-slate-200 disabled:text-slate-500 disabled:shadow-none disabled:cursor-not-allowed"
        >
          {headerCta.label}
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>

      <div
        className={`mb-6 flex items-start gap-2 rounded-2xl border px-4 py-3 text-xs font-semibold ${
          isPaid ? 'bg-sky-50 border-sky-100 text-sky-900' : 'bg-amber-50 border-amber-100 text-amber-900'
        }`}
      >
        <Info className={`w-4 h-4 shrink-0 mt-px ${isPaid ? 'text-sky-600' : 'text-amber-600'}`} />
        <span>{note}</span>
      </div>

      {list.length === 0 ? (
        <div className="text-center py-14 rounded-3xl bg-slate-50 border border-dashed border-slate-200">
          <Trophy className="w-10 h-10 text-slate-300 mx-auto" />
          <p className="text-sm font-bold text-slate-600 mt-2">Este campamento aún no tiene campeonatos publicados.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {list.map((champ) => {
            const max = Math.max(1, champ.maxTeamsOrParticipants);
            const spotsLeft = Math.max(0, champ.maxTeamsOrParticipants - champ.enrolledTeamsCount);
            const percent = Math.min(100, Math.round((champ.enrolledTeamsCount / max) * 100));
            const unit = champ.mode === 'team' ? 'equipos' : 'participantes';
            const closed = isClosed(champ);
            const cta = ctaFor(champ);
            const CtaIcon = cta.icon;

            return (
              <article
                key={champ.id}
                className="bg-white rounded-3xl border border-sky-100 overflow-hidden shadow-sm hover:shadow-xl transition-all duration-300 flex flex-col group hover:-translate-y-1"
              >
                <div className="relative h-44 w-full bg-slate-900 overflow-hidden">
                  <img
                    src={champ.imageUrl || FALLBACK_IMAGE}
                    alt={champ.name}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    onError={(e) => {
                      e.currentTarget.style.display = 'none';
                    }}
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/40 to-transparent" />
                  <div className="absolute top-3 left-3 right-3 flex items-center justify-between gap-2">
                    <span className={`text-[10px] font-extrabold px-2.5 py-0.5 rounded-full backdrop-blur-md ${GENDER_STYLE[champ.genderCategory]}`}>
                      {champ.genderCategory}
                    </span>
                    <span
                      className={`text-[10px] font-black px-2.5 py-0.5 rounded-full shadow-sm ${
                        champ.registrationFee ? 'bg-amber-400 text-slate-950' : 'bg-emerald-500 text-white'
                      }`}
                    >
                      {feeLabel(champ)}
                    </span>
                  </div>
                  <div className="absolute bottom-3 left-3 right-3">
                    <span className="text-[10px] font-bold text-amber-300 uppercase tracking-wider block">{champ.sport}</span>
                    <h3 className="text-sm font-extrabold text-white font-display truncate">{champ.name}</h3>
                  </div>
                </div>

                <div className="p-4 space-y-3 flex-1">
                  <span
                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-bold border ${
                      champ.mode === 'team' ? 'bg-indigo-50 text-indigo-700 border-indigo-100' : 'bg-sky-50 text-sky-700 border-sky-100'
                    }`}
                  >
                    {champ.mode === 'team' ? <Users className="w-3 h-3" /> : <User className="w-3 h-3" />}
                    {modeLabel(champ)}
                  </span>

                  <p className="text-xs text-slate-600 line-clamp-2 leading-relaxed">{champ.description}</p>

                  <div className="space-y-1.5 text-[11px] text-slate-600 pt-2 border-t border-slate-100">
                    {champ.schedule && (
                      <div className="flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 text-[#0284C7] shrink-0" />
                        <span className="truncate">{champ.schedule}</span>
                      </div>
                    )}
                    {champ.prizeSummary && (
                      <div className="flex items-center gap-1.5">
                        <Medal className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                        <span className="truncate font-medium text-slate-800">{champ.prizeSummary}</span>
                      </div>
                    )}
                    {champ.registrationClosesAt && (
                      <div className={`flex items-center gap-1.5 ${closed ? 'text-slate-400' : ''}`}>
                        <CalendarClock className={`w-3.5 h-3.5 shrink-0 ${closed ? 'text-slate-400' : 'text-violet-500'}`} />
                        <span className="truncate">
                          {closed ? 'Inscripciones cerradas' : `Inscripción hasta el ${formatLongDate(champ.registrationClosesAt).toLowerCase()}`}
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="p-2.5 rounded-xl bg-sky-50/70 border border-sky-100">
                    <div className="flex items-center justify-between mb-1 text-[11px]">
                      <span className="text-slate-500 font-medium capitalize">{unit} inscritos</span>
                      <span className="font-mono font-bold text-slate-900">
                        {champ.enrolledTeamsCount}/{champ.maxTeamsOrParticipants}
                      </span>
                    </div>
                    <div className="w-full bg-slate-200 rounded-full h-1.5 overflow-hidden">
                      <div
                        className="bg-gradient-to-r from-[#0284C7] to-amber-500 h-1.5 rounded-full transition-all duration-500"
                        style={{ width: `${percent}%` }}
                      />
                    </div>
                    <div className="text-[10px] text-slate-500 mt-1">
                      {spotsLeft > 0 ? `${spotsLeft} ${spotsLeft === 1 ? 'cupo libre' : 'cupos libres'}` : 'Sin cupos'}
                    </div>
                  </div>
                </div>

                <div className="px-4 py-3 bg-slate-50 border-t border-slate-100 flex items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => setActiveModalChamp(champ)}
                    className="text-xs font-bold text-slate-600 hover:text-[#0284C7] transition-colors cursor-pointer"
                  >
                    Ver detalle
                  </button>
                  <button
                    type="button"
                    disabled={cta.disabled}
                    onClick={cta.onClick}
                    className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-extrabold transition-all cursor-pointer active:scale-95 disabled:bg-slate-100 disabled:text-slate-400 disabled:border-transparent disabled:cursor-not-allowed ${CTA_TONE[cta.tone]}`}
                  >
                    {cta.tone !== 'primary' && <CtaIcon className="w-3.5 h-3.5" />}
                    <span>{cta.label}</span>
                    {cta.tone === 'primary' && <CtaIcon className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {/* Detalle */}
      {activeModalChamp &&
        (() => {
          const ch = activeModalChamp;
          const cta = ctaFor(ch);
          const CtaIcon = cta.icon;
          return (
            <div
              className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4 bg-slate-950/60 backdrop-blur-sm animate-fade-in"
              onClick={() => setActiveModalChamp(null)}
            >
              <div
                role="dialog"
                aria-modal="true"
                aria-label={ch.name}
                className="bg-white rounded-t-3xl sm:rounded-3xl max-w-lg w-full overflow-hidden shadow-2xl max-h-[92vh] overflow-y-auto animate-fade-in-scale"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="relative h-44 w-full bg-slate-900 overflow-hidden">
                  <img src={ch.imageUrl || FALLBACK_IMAGE} alt="" className="w-full h-full object-cover" />
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/40 to-transparent" />
                  <button
                    type="button"
                    onClick={() => setActiveModalChamp(null)}
                    aria-label="Cerrar"
                    className="absolute top-3 right-3 w-8 h-8 rounded-full bg-black/60 hover:bg-black/90 text-white flex items-center justify-center border border-white/20 cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                  <div className="absolute bottom-3 left-4 right-4 text-white">
                    <span className="text-[10px] font-bold text-amber-300 uppercase tracking-wider">{ch.sport}</span>
                    <h3 className="text-lg font-bold font-display">{ch.name}</h3>
                  </div>
                </div>

                <div className="p-6 space-y-4 text-xs">
                  <p className="text-slate-600 leading-relaxed text-sm">{ch.description}</p>

                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { label: 'Modalidad', value: modeLabel(ch) },
                      { label: 'Categoría', value: ch.genderCategory },
                      { label: 'Costo', value: feeLabel(ch) },
                      {
                        label: 'Cupos',
                        value: `${Math.max(0, ch.maxTeamsOrParticipants - ch.enrolledTeamsCount)} de ${ch.maxTeamsOrParticipants} ${
                          ch.mode === 'team' ? 'equipos' : 'participantes'
                        }`,
                      },
                      ...(ch.schedule ? [{ label: 'Horario', value: ch.schedule }] : []),
                      ...(ch.registrationClosesAt
                        ? [{ label: 'Inscripción hasta', value: isClosed(ch) ? 'Cerrada' : formatLongDate(ch.registrationClosesAt) }]
                        : []),
                    ].map((it) => (
                      <div key={it.label} className="p-3 rounded-xl bg-slate-50 border border-slate-100 min-w-0">
                        <span className="text-[10px] text-slate-400 block font-bold uppercase">{it.label}</span>
                        <span className="font-bold text-slate-800 break-words">{it.value}</span>
                      </div>
                    ))}
                  </div>

                  {ch.prizeSummary && (
                    <div className="flex items-center gap-2 p-3 rounded-xl bg-amber-50 border border-amber-100 text-amber-900 font-semibold">
                      <Medal className="w-4 h-4 text-amber-500 shrink-0" /> {ch.prizeSummary}
                    </div>
                  )}

                  <div className="p-3.5 rounded-2xl bg-sky-50 border border-sky-100 text-sky-900 space-y-1.5">
                    <div className="font-black uppercase tracking-wider text-[10px] text-[#0284C7]">¿Cómo me inscribo?</div>
                    <p className="leading-relaxed">
                      {ch.mode === 'team'
                        ? 'Después de pagar tu campamento, el capitán crea el equipo desde «Mi campamento», paga la inscripción del equipo y comparte el enlace de invitación con sus compañeros.'
                        : 'Después de pagar tu campamento, inscríbete desde «Mi campamento»' +
                          (ch.registrationFee ? ` y paga ${feeLabel(ch)}.` : '. Es gratis.')}
                    </p>
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                    <button
                      type="button"
                      onClick={() => setActiveModalChamp(null)}
                      className="px-4 py-2.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
                    >
                      Cerrar
                    </button>
                    <button
                      type="button"
                      disabled={cta.disabled}
                      onClick={() => {
                        cta.onClick();
                        setActiveModalChamp(null);
                      }}
                      className={`inline-flex items-center gap-2 px-5 py-2.5 text-xs font-extrabold rounded-xl shadow-sm cursor-pointer disabled:bg-slate-100 disabled:text-slate-400 disabled:border-transparent disabled:cursor-not-allowed ${CTA_TONE[cta.tone]}`}
                    >
                      <CtaIcon className="w-4 h-4" /> {cta.label}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          );
        })()}
    </section>
  );
};
