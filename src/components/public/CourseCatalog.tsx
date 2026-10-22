import React, { useMemo, useState } from 'react';
import { useCamp } from '../../context/CampContext';
import { CampCourse } from '../../types/camp';
import {
  formatCourseSchedule,
  formatCourseScheduleShort,
  formatDateRange,
  formatLongDate,
  getCampPhase,
  isCampEnrollable,
  courseWindowState,
  type CourseWindowState,
} from '../../utils/campUtils';
import {
  ArrowRight,
  BookOpen,
  CalendarDays,
  CheckCircle2,
  Clock,
  Hourglass,
  Info,
  Lock,
  MapPin,
  Sparkles,
  Sun,
  Tent,
  Ticket,
  Users,
  X,
} from 'lucide-react';

interface CourseCatalogProps {
  onSelectCourseForEnrollment?: (courseId: string) => void;
}

const FALLBACK_COVER = 'https://images.unsplash.com/photo-1524178232363-1fb2b075b655?q=80&w=800&auto=format&fit=crop';

const MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

/** "2026-10-20T08:00" → "20 oct, 08:00" (hora local, como la guarda el servidor). */
function formatStamp(stamp: string): string {
  const [date, time = ''] = stamp.split('T');
  const [, m, d] = date.split('-').map(Number);
  return `${d} ${MONTHS[(m || 1) - 1]}${time ? `, ${time.slice(0, 5)}` : ''}`;
}

type WindowState = Exclude<CourseWindowState, 'none'>;

/** Ventana de inscripción del taller (solo para jóvenes con pago confirmado). */
function courseEnrollmentWindow(course: CampCourse): { state: WindowState; label: string } {
  const state = courseWindowState(course);
  if (state === 'soon') return { state, label: `Abre el ${formatStamp(course.enrollmentOpensAt!)}` };
  if (state === 'closed') return { state, label: 'Inscripción cerrada' };
  if (course.enrollmentClosesAt) return { state: 'open', label: `Abierto hasta el ${formatStamp(course.enrollmentClosesAt)}` };
  return { state: 'open', label: 'Inscripción abierta' };
}

const WINDOW_STYLE: Record<WindowState, { cls: string; icon: React.ElementType }> = {
  soon: { cls: 'bg-violet-50 text-violet-700 border-violet-100', icon: Hourglass },
  open: { cls: 'bg-emerald-50 text-emerald-700 border-emerald-100', icon: CheckCircle2 },
  closed: { cls: 'bg-slate-100 text-slate-500 border-slate-200', icon: Lock },
};

const WindowBadge: React.FC<{ course: CampCourse; className?: string }> = ({ course, className = '' }) => {
  const w = courseEnrollmentWindow(course);
  const st = WINDOW_STYLE[w.state];
  const Icon = st.icon;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-bold border ${st.cls} ${className}`}>
      <Icon className="w-3 h-3 shrink-0" />
      {w.label}
    </span>
  );
};

export const CourseCatalog: React.FC<CourseCatalogProps> = ({ onSelectCourseForEnrollment }) => {
  const { camps, selectedCamp, setSelectedCampId, getCoursesForCamp, setActiveTab, myRegistrations } = useCamp();
  const [selectedCourseModal, setSelectedCourseModal] = useState<CampCourse | null>(null);
  const [dayFilter, setDayFilter] = useState<string>('ALL');

  const campCourses = getCoursesForCamp(selectedCamp?.id);
  const enrollable = isCampEnrollable(selectedCamp);

  const days = useMemo(
    () =>
      Array.from(
        new Set(campCourses.filter((c) => c.scheduleType === 'single_day' && c.date).map((c) => c.date as string))
      ).sort(),
    [campCourses]
  );

  const visible = campCourses
    .filter((c) => dayFilter === 'ALL' || (dayFilter === 'DAILY' ? c.scheduleType === 'all_days' : c.date === dayFilter))
    .sort((a, b) => (a.scheduleType === b.scheduleType ? a.startTime.localeCompare(b.startTime) : a.scheduleType === 'all_days' ? -1 : 1));

  const selectableCamps = camps
    .filter((c) => c.status !== 'borrador' && getCampPhase(c) !== 'finalizado')
    .sort((a, b) => a.startDate.localeCompare(b.startDate));

  // Los talleres NO se eligen al comprar: el joven se inscribe desde «Mi campamento» cuando su pago está confirmado
  const myReg = selectedCamp ? myRegistrations.find((r) => r.campId === selectedCamp.id) : undefined;
  const isPaid = myReg?.payment.status === 'completed';

  const goToMyCamp = () => myReg && setActiveTab('registration-detail', { id: myReg.id });

  const goEnrollCamp = (courseId?: string) => {
    if (courseId && onSelectCourseForEnrollment) onSelectCourseForEnrollment(courseId);
    else setActiveTab('enroll');
  };

  /** Botón de acción de cada taller según el estado del joven. */
  const courseCta = (course: CampCourse) => {
    const isFull = course.enrolledCount >= course.maxCapacity;
    if (myReg && isPaid) {
      if (myReg.enrolledCourseIds.includes(course.id)) {
        return { label: 'Inscrito', icon: CheckCircle2, onClick: goToMyCamp, disabled: false, tone: 'done' as const };
      }
      const w = courseEnrollmentWindow(course);
      if (isFull) return { label: 'Completo', icon: Lock, onClick: goToMyCamp, disabled: true, tone: 'muted' as const };
      if (w.state === 'soon') return { label: 'Abre pronto', icon: Hourglass, onClick: goToMyCamp, disabled: true, tone: 'muted' as const };
      if (w.state === 'closed') return { label: 'Cerrado', icon: Lock, onClick: goToMyCamp, disabled: true, tone: 'muted' as const };
      return { label: 'Inscribirme', icon: ArrowRight, onClick: goToMyCamp, disabled: false, tone: 'primary' as const };
    }
    if (myReg) {
      return { label: 'Tras tu pago', icon: Hourglass, onClick: goToMyCamp, disabled: false, tone: 'pending' as const };
    }
    return {
      label: enrollable ? 'Inscríbete al campamento' : 'Inscripciones cerradas',
      icon: Ticket,
      onClick: () => goEnrollCamp(course.id),
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
    ? isPaid
      ? { label: 'Elegir mis talleres', onClick: goToMyCamp, disabled: false }
      : { label: 'Ver mi inscripción', onClick: goToMyCamp, disabled: false }
    : { label: 'Inscríbete al campamento', onClick: () => goEnrollCamp(), disabled: !enrollable };

  return (
    <section id="courses-catalog-section" className="bg-white border-y border-slate-100 scroll-mt-24">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14">
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-5">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-xs font-black text-[#0284C7] uppercase tracking-widest">
              <Sparkles className="w-4 h-4 text-amber-500" />
              Talleres con facilitadores
            </div>
            <h2 className="text-3xl sm:text-4xl font-black text-slate-900 font-display mt-1 tracking-tight">
              {selectedCamp ? `Talleres de ${selectedCamp.name}` : 'Talleres'}
            </h2>
            {selectedCamp && (
              <div className="flex flex-wrap items-center gap-2 mt-3 text-xs">
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-sky-50 text-sky-800 border border-sky-100 font-bold">
                  <CalendarDays className="w-3.5 h-3.5 text-[#0284C7]" />
                  {formatDateRange(selectedCamp.startDate, selectedCamp.endDate)}
                </span>
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-50 text-amber-900 border border-amber-100 font-bold">
                  <Users className="w-3.5 h-3.5 text-amber-600" />
                  Hasta {selectedCamp.maxCoursesPerCamper} {selectedCamp.maxCoursesPerCamper === 1 ? 'taller' : 'talleres'} por joven
                </span>
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-50 text-emerald-900 border border-emerald-100 font-bold">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  Incluidos en tu inscripción
                </span>
                <span
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border font-bold ${
                    isPaid ? 'bg-sky-600 text-white border-sky-600' : 'bg-violet-50 text-violet-900 border-violet-100'
                  }`}
                >
                  <Info className={`w-3.5 h-3.5 ${isPaid ? 'text-white' : 'text-violet-600'}`} />
                  {isPaid
                    ? 'Tu pago está confirmado: ya puedes elegir tus talleres'
                    : myReg
                    ? 'Podrás elegir tus talleres cuando se confirme tu pago'
                    : 'Te inscribes a los talleres después de pagar'}
                </span>
              </div>
            )}
          </div>

          <div className="flex flex-col sm:flex-row gap-2 lg:items-center">
            <label className="relative">
              <Tent className="w-4 h-4 text-[#0284C7] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <select
                value={selectedCamp?.id || ''}
                onChange={(e) => {
                  setSelectedCampId(e.target.value);
                  setDayFilter('ALL');
                }}
                className="w-full sm:w-72 pl-9 pr-3 py-3 rounded-2xl border border-slate-200 bg-slate-50 text-xs font-bold text-slate-800 cursor-pointer focus:ring-2 focus:ring-sky-200 outline-none"
              >
                {selectableCamps.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.isFeatured ? '★ ' : ''}
                    {c.name}
                  </option>
                ))}
                {selectedCamp && !selectableCamps.some((c) => c.id === selectedCamp.id) && (
                  <option value={selectedCamp.id}>{selectedCamp.name}</option>
                )}
              </select>
            </label>
            <button
              type="button"
              onClick={headerCta.onClick}
              disabled={headerCta.disabled}
              className="inline-flex items-center justify-center gap-2 px-6 py-3 text-sm font-black text-white bg-[#0284C7] hover:bg-[#0369A1] rounded-2xl shadow-md active:scale-95 cursor-pointer disabled:bg-slate-200 disabled:text-slate-500 disabled:shadow-none disabled:cursor-not-allowed"
            >
              {headerCta.label} <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {(days.length > 0 || campCourses.some((c) => c.scheduleType === 'all_days')) && (
          <div className="flex gap-1.5 overflow-x-auto mt-6 pb-1 -mx-1 px-1 no-scrollbar">
            {[
              { id: 'ALL', label: 'Todos' },
              ...(campCourses.some((c) => c.scheduleType === 'all_days') ? [{ id: 'DAILY', label: 'Todos los días' }] : []),
              ...days.map((d) => ({ id: d, label: formatLongDate(d) })),
            ].map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => setDayFilter(f.id)}
                className={`px-3.5 py-2 rounded-full text-xs font-bold whitespace-nowrap cursor-pointer transition-colors ${
                  dayFilter === f.id ? 'bg-[#0284C7] text-white' : 'bg-slate-100 text-slate-600 hover:bg-sky-50'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        )}

        {visible.length === 0 ? (
          <div className="mt-8 text-center py-14 rounded-3xl bg-slate-50 border border-dashed border-slate-200">
            <BookOpen className="w-10 h-10 text-slate-300 mx-auto" />
            <p className="text-sm font-bold text-slate-600 mt-2">Este campamento aún no tiene talleres publicados.</p>
          </div>
        ) : (
          <div className="mt-8 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {visible.map((course) => {
              const spots = course.maxCapacity - course.enrolledCount;
              const isFull = spots <= 0;
              const lastSpots = !isFull && spots <= Math.max(3, Math.round(course.maxCapacity * 0.15));
              const cta = courseCta(course);
              const CtaIcon = cta.icon;

              return (
                <article
                  key={course.id}
                  className="bg-white rounded-3xl border border-slate-100 overflow-hidden shadow-sm hover:shadow-xl transition-all duration-300 flex flex-col group hover:-translate-y-1"
                >
                  <div className="relative h-48 bg-slate-900 overflow-hidden">
                    <img
                      src={course.coverImageUrl || FALLBACK_COVER}
                      alt={course.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/40 to-transparent" />
                    <div className="absolute top-3 left-3 right-3 flex items-center justify-between gap-2">
                      <span
                        className={`inline-flex items-center gap-1 text-[10px] font-black px-2.5 py-1 rounded-full backdrop-blur-md ${
                          course.fullDay ? 'bg-amber-400 text-slate-950' : 'bg-white/90 text-sky-700'
                        }`}
                      >
                        {course.fullDay ? <Sun className="w-3 h-3" /> : <Clock className="w-3 h-3" />}
                        {formatCourseScheduleShort(course)}
                      </span>
                      {(isFull || lastSpots) && (
                        <span
                          className={`text-[10px] font-black px-2.5 py-1 rounded-full ${
                            isFull ? 'bg-red-500 text-white' : 'bg-orange-500 text-white'
                          }`}
                        >
                          {isFull ? 'Completo' : '¡Últimos lugares!'}
                        </span>
                      )}
                    </div>
                    <div className="absolute bottom-3 left-3 right-3 flex items-center gap-3">
                      {course.instructorPhotoUrl && (
                        <img
                          src={course.instructorPhotoUrl}
                          alt={course.instructor}
                          className="w-11 h-11 rounded-full object-cover border-2 border-white shadow-md shrink-0"
                        />
                      )}
                      <div className="min-w-0">
                        <span className="text-[10px] uppercase font-bold text-sky-300 tracking-wider block">Facilitador</span>
                        <h4 className="text-sm font-extrabold text-white truncate">{course.instructor}</h4>
                      </div>
                    </div>
                  </div>

                  <div className="p-5 space-y-2 flex-1">
                    <span className="text-[10px] font-black uppercase tracking-wider text-[#0284C7]">{course.category}</span>
                    <h3 className="text-lg font-extrabold text-slate-900 font-display leading-snug group-hover:text-[#0284C7] transition-colors">
                      {course.title}
                    </h3>
                    <p className="text-xs text-slate-600 line-clamp-3 leading-relaxed">{course.description}</p>
                    <div className="flex items-center gap-1.5 text-[11px] text-slate-500 pt-1">
                      <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span className="truncate">{course.location}</span>
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5 pt-1">
                      <WindowBadge course={course} />
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-bold border bg-slate-50 text-slate-600 border-slate-100">
                        <Users className="w-3 h-3" />
                        {isFull ? 'Sin cupos' : `${spots} ${spots === 1 ? 'cupo' : 'cupos'}`}
                      </span>
                    </div>
                  </div>

                  <div className="px-5 py-3.5 bg-slate-50/80 border-t border-slate-100 flex items-center justify-between gap-3">
                    <button
                      type="button"
                      onClick={() => setSelectedCourseModal(course)}
                      className="text-xs font-bold text-[#0284C7] hover:underline cursor-pointer"
                    >
                      Ver detalle
                    </button>
                    <button
                      type="button"
                      disabled={cta.disabled}
                      onClick={cta.onClick}
                      className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-black active:scale-95 cursor-pointer disabled:bg-slate-100 disabled:text-slate-400 disabled:border-transparent disabled:cursor-not-allowed ${CTA_TONE[cta.tone]}`}
                    >
                      {cta.tone !== 'primary' && <CtaIcon className="w-3.5 h-3.5" />}
                      {cta.label}
                      {cta.tone === 'primary' && <CtaIcon className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>

      {selectedCourseModal && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4 bg-slate-950/60 backdrop-blur-sm animate-fade-in"
          onClick={() => setSelectedCourseModal(null)}
        >
          <div
            className="bg-white rounded-t-3xl sm:rounded-3xl max-w-lg w-full overflow-hidden shadow-2xl animate-fade-in-scale max-h-[92vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="relative h-48 bg-slate-900">
              <img src={selectedCourseModal.coverImageUrl || FALLBACK_COVER} alt="" className="w-full h-full object-cover" />
              <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/50 to-transparent" />
              <button
                type="button"
                onClick={() => setSelectedCourseModal(null)}
                className="absolute top-3 right-3 w-8 h-8 rounded-full bg-black/50 hover:bg-black/80 text-white flex items-center justify-center cursor-pointer"
                aria-label="Cerrar"
              >
                <X className="w-4 h-4" />
              </button>
              <div className="absolute bottom-4 left-5 right-5">
                <span className="text-[10px] font-black uppercase tracking-wider text-sky-300">{selectedCourseModal.category}</span>
                <h3 className="text-xl font-extrabold text-white font-display leading-tight">{selectedCourseModal.title}</h3>
              </div>
            </div>

            <div className="p-6 space-y-4">
              <div className="flex items-center gap-3.5 p-3.5 rounded-2xl bg-sky-50 border border-sky-100">
                {selectedCourseModal.instructorPhotoUrl && (
                  <img
                    src={selectedCourseModal.instructorPhotoUrl}
                    alt={selectedCourseModal.instructor}
                    className="w-14 h-14 rounded-full object-cover border-2 border-[#0284C7] shrink-0"
                  />
                )}
                <div className="min-w-0">
                  <div className="text-sm font-extrabold text-slate-900">{selectedCourseModal.instructor}</div>
                  <div className="text-xs text-slate-500">{selectedCourseModal.instructorRole}</div>
                </div>
              </div>

              {selectedCourseModal.instructorBio && (
                <p className="text-xs text-slate-600 italic leading-relaxed">“{selectedCourseModal.instructorBio}”</p>
              )}

              <p className="text-sm text-slate-700 leading-relaxed">{selectedCourseModal.description}</p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                  <span className="text-[10px] text-slate-400 block font-bold uppercase">Cuándo</span>
                  <span className="font-bold text-slate-800 flex items-center gap-1 mt-0.5">
                    <CalendarDays className="w-3.5 h-3.5 text-[#0284C7] shrink-0" />
                    {formatCourseSchedule(selectedCourseModal)}
                  </span>
                </div>
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                  <span className="text-[10px] text-slate-400 block font-bold uppercase">Dónde</span>
                  <span className="font-bold text-slate-800 flex items-center gap-1 mt-0.5">
                    <MapPin className="w-3.5 h-3.5 text-[#0284C7] shrink-0" />
                    {selectedCourseModal.location}
                  </span>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 p-3 rounded-2xl bg-violet-50/70 border border-violet-100 text-xs text-violet-900">
                <WindowBadge course={selectedCourseModal} className="bg-white" />
                <span className="flex-1 min-w-[12rem] leading-relaxed">
                  {isPaid
                    ? 'Inscríbete a este taller desde «Mi campamento», dentro de su horario de inscripción.'
                    : 'Te inscribes a los talleres después de pagar tu campamento, desde «Mi campamento».'}
                </span>
              </div>

              {(() => {
                const cta = courseCta(selectedCourseModal);
                const CtaIcon = cta.icon;
                return (
                  <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                    <button
                      type="button"
                      onClick={() => setSelectedCourseModal(null)}
                      className="px-4 py-2.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
                    >
                      Cerrar
                    </button>
                    <button
                      type="button"
                      disabled={cta.disabled}
                      onClick={() => {
                        cta.onClick();
                        setSelectedCourseModal(null);
                      }}
                      className={`inline-flex items-center gap-2 px-5 py-2.5 text-xs font-extrabold rounded-xl shadow-sm cursor-pointer disabled:bg-slate-100 disabled:text-slate-400 disabled:border-transparent disabled:cursor-not-allowed ${CTA_TONE[cta.tone]}`}
                    >
                      <CtaIcon className="w-4 h-4" /> {cta.label}
                    </button>
                  </div>
                );
              })()}
            </div>
          </div>
        </div>
      )}
    </section>
  );
};
