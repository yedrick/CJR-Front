import React, { useMemo, useState } from 'react';
import { useCamp } from '../../context/CampContext';
import { Camp, CampPhase } from '../../types/camp';
import {
  campDurationDays,
  formatDateRange,
  getCampPhase,
  isCampEnrollable,
  monthLabel,
  PHASE_META,
} from '../../utils/campUtils';
import { ArrowRight, BookOpen, CalendarDays, CheckCircle2, MapPin, Sparkles, Tent, Ticket } from 'lucide-react';

type PhaseFilter = 'all' | 'available' | 'finalizado';

interface CampsSectionProps {
  /** compact = portada (muestra los próximos); full = pestaña de campamentos */
  variant?: 'compact' | 'full';
}

export const CampsSection: React.FC<CampsSectionProps> = ({ variant = 'compact' }) => {
  const {
    camps,
    catalogs,
    courses,
    selectedCampId,
    setSelectedCampId,
    setActiveTab,
    myRegistrations,
  } = useCamp();

  const [phaseFilter, setPhaseFilter] = useState<PhaseFilter>(variant === 'compact' ? 'available' : 'all');
  const [typeFilter, setTypeFilter] = useState<string>('ALL');

  const myRegs = myRegistrations;
  const myCampIds = new Set(myRegs.map((r) => r.campId));
  const publicCamps = useMemo(
    () => [...camps].filter((c) => c.status !== 'borrador').sort((a, b) => a.startDate.localeCompare(b.startDate)),
    [camps]
  );
  const year = publicCamps.find((c) => c.isFeatured)?.startDate.slice(0, 4) || String(new Date().getFullYear());

  const filtered = publicCamps.filter((c) => {
    const phase = getCampPhase(c);
    const matchPhase =
      phaseFilter === 'all' ||
      (phaseFilter === 'available' && (phase === 'abierto' || phase === 'en_curso' || phase === 'cerrado')) ||
      (phaseFilter === 'finalizado' && phase === 'finalizado');
    const matchType = typeFilter === 'ALL' || c.typeId === typeFilter;
    return matchPhase && matchType;
  });

  const getType = (id: string) => catalogs.campTypes.find((t) => t.id === id);

  // Compra en un solo paso: sin sesión también se va directo al formulario (la cuenta se crea al pagar)
  const handleEnroll = (camp: Camp) => {
    setSelectedCampId(camp.id);
    const myReg = myRegs.find((r) => r.campId === camp.id);
    if (myReg) setActiveTab('registration-detail', { id: myReg.id });
    else setActiveTab('enroll');
  };

  const handleSeeCourses = (camp: Camp) => {
    setSelectedCampId(camp.id);
    if (variant === 'full') setActiveTab('catalog');
    setTimeout(() => document.getElementById('courses-catalog-section')?.scrollIntoView({ behavior: 'smooth' }), 80);
  };

  const filters: { id: PhaseFilter; label: string }[] = [
    { id: 'available', label: 'Próximos' },
    { id: 'finalizado', label: 'Finalizados' },
    { id: 'all', label: `Todos (${publicCamps.length})` },
  ];

  return (
    <section id="camps-section" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14 scroll-mt-24">
      <div className="flex flex-col gap-5">
        <div>
          <div className="flex items-center gap-2 text-xs font-black text-[#0284C7] uppercase tracking-widest">
            <CalendarDays className="w-4 h-4" />
            Calendario {year}
          </div>
          <h2 className="text-3xl sm:text-4xl font-black text-slate-900 font-display mt-1 tracking-tight">
            {publicCamps.length} campamentos, un mismo propósito
          </h2>
          <p className="text-sm text-slate-500 mt-2 max-w-2xl">
            Nacionales, regionales, de adolescentes, líderes, señoritas, varones y más. Cada campamento tiene sus propios
            talleres, precio y fechas.
          </p>
        </div>

        <div className="rounded-3xl bg-white border border-slate-100 shadow-sm p-3 sm:p-4 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="grid grid-cols-3 sm:inline-flex p-1 rounded-2xl bg-slate-100 gap-1">
              {filters.map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setPhaseFilter(f.id)}
                  className={`px-2 sm:px-4 py-2 rounded-xl text-[11px] sm:text-xs font-bold transition-all cursor-pointer leading-tight ${
                    phaseFilter === f.id ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
            <span className="hidden sm:block text-xs font-semibold text-slate-400">
              {filtered.length} {filtered.length === 1 ? 'campamento' : 'campamentos'}
            </span>
          </div>

          {/* Tipo: selector en celular, chips en pantallas medianas y grandes */}
          <label className="sm:hidden relative block">
            <Tent className="w-4 h-4 text-[#0284C7] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="w-full pl-10 pr-3 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-sky-100 cursor-pointer"
            >
              <option value="ALL">Todos los tipos de campamento</option>
              {catalogs.campTypes.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </label>

          <div className="hidden sm:flex flex-wrap items-center gap-1.5 pt-3 border-t border-slate-100">
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 mr-1">Tipo</span>
            <button
              type="button"
              onClick={() => setTypeFilter('ALL')}
              className={`px-3 py-1.5 rounded-full text-[11px] font-bold cursor-pointer border transition-colors ${
                typeFilter === 'ALL'
                  ? 'bg-slate-900 text-white border-slate-900'
                  : 'bg-white text-slate-500 border-slate-200 hover:border-slate-300'
              }`}
            >
              Todos
            </button>
            {catalogs.campTypes.map((t) => {
              const active = typeFilter === t.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setTypeFilter(active ? 'ALL' : t.id)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-bold cursor-pointer border transition-colors"
                  style={
                    active
                      ? { backgroundColor: t.colorHex, borderColor: t.colorHex, color: '#fff' }
                      : { backgroundColor: '#fff', borderColor: '#e2e8f0', color: '#475569' }
                  }
                >
                  {!active && <span className="w-2 h-2 rounded-full" style={{ backgroundColor: t.colorHex }} />}
                  {t.name}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="mt-10 text-center py-14 rounded-3xl bg-white border border-dashed border-slate-200">
          <Tent className="w-10 h-10 text-slate-300 mx-auto" />
          <p className="text-sm font-bold text-slate-600 mt-2">No hay campamentos con este filtro.</p>
        </div>
      ) : (
        <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
          {(variant === 'compact' ? filtered.slice(0, 6) : filtered).map((camp) => (
            <CampCard
              key={camp.id}
              camp={camp}
              phase={getCampPhase(camp)}
              typeName={getType(camp.typeId)?.name}
              typeColor={getType(camp.typeId)?.colorHex || '#0284C7'}
              coursesCount={courses.filter((c) => c.campId === camp.id).length}
              isSelected={camp.id === selectedCampId}
              isMine={myCampIds.has(camp.id)}
              onEnroll={() => handleEnroll(camp)}
              onSeeCourses={() => handleSeeCourses(camp)}
            />
          ))}
        </div>
      )}

      {variant === 'compact' && filtered.length > 6 && (
        <div className="mt-8 text-center">
          <button
            type="button"
            onClick={() => setActiveTab('camps')}
            className="inline-flex items-center gap-2 px-6 py-3 rounded-2xl bg-white border border-sky-200 text-sky-700 font-black text-sm hover:bg-sky-50 cursor-pointer"
          >
            Ver todo el calendario <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      )}
    </section>
  );
};

const CampCard: React.FC<{
  camp: Camp;
  phase: CampPhase;
  typeName?: string;
  typeColor: string;
  coursesCount: number;
  isSelected: boolean;
  isMine: boolean;
  onEnroll: () => void;
  onSeeCourses: () => void;
}> = ({ camp, phase, typeName, typeColor, coursesCount, isSelected, isMine, onEnroll, onSeeCourses }) => {
  const { month, day } = monthLabel(camp.startDate);
  const enrollable = isCampEnrollable(camp);
  const finished = phase === 'finalizado';

  return (
    <article
      className={`group bg-white rounded-3xl overflow-hidden border shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 flex flex-col ${
        isSelected ? 'border-sky-400 ring-4 ring-sky-100' : 'border-slate-100'
      } ${finished ? 'opacity-90' : ''}`}
    >
      <div className="relative h-44 overflow-hidden bg-slate-900">
        <img
          src={camp.imageUrl}
          alt={camp.name}
          className={`w-full h-full object-cover group-hover:scale-105 transition-transform duration-700 ${finished ? 'grayscale-[60%]' : ''}`}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950/90 via-slate-950/20 to-transparent" />

        <div className="absolute top-3 left-3 w-14 rounded-2xl bg-white text-center shadow-lg overflow-hidden">
          <div className="text-[9px] font-black text-white py-0.5" style={{ backgroundColor: typeColor }}>
            {month}
          </div>
          <div className="text-xl font-black text-slate-900 font-display leading-7">{day}</div>
        </div>

        <div className="absolute top-3 right-3 flex flex-col items-end gap-1.5">
          {camp.isFeatured && (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-400 text-slate-950 text-[10px] font-black shadow">
              <Sparkles className="w-3 h-3" /> Activo
            </span>
          )}
          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold border ${PHASE_META[phase].className}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${PHASE_META[phase].dot}`} />
            {PHASE_META[phase].label}
          </span>
        </div>

        <div className="absolute bottom-3 left-4 right-4">
          {typeName && (
            <span
              className="inline-block text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md text-white"
              style={{ backgroundColor: typeColor }}
            >
              {typeName}
            </span>
          )}
          <h3 className="text-lg font-black text-white font-display leading-tight mt-1 line-clamp-2">{camp.name}</h3>
        </div>
      </div>

      <div className="p-5 flex-1 flex flex-col gap-3">
        {camp.theme && <p className="text-xs font-bold text-sky-700">“{camp.theme}”</p>}
        <div className="space-y-1.5 text-xs text-slate-600">
          <div className="flex items-center gap-2">
            <CalendarDays className="w-3.5 h-3.5 text-slate-400" />
            {formatDateRange(camp.startDate, camp.endDate)} · {campDurationDays(camp)} días
          </div>
          <div className="flex items-center gap-2">
            <MapPin className="w-3.5 h-3.5 text-slate-400" />
            {camp.location}
          </div>
          <div className="flex items-center gap-2">
            <BookOpen className="w-3.5 h-3.5 text-slate-400" />
            {coursesCount} {coursesCount === 1 ? 'taller' : 'talleres'} · {camp.minAge}–{camp.maxAge} años
          </div>
        </div>

        <div className="mt-auto pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
          <div>
            <span className="text-2xl font-black text-slate-900 font-mono">{camp.price}</span>
            <span className="text-xs text-slate-500 font-bold ml-1">Bs</span>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={onSeeCourses}
              className="px-3 py-2 rounded-xl text-[11px] font-bold text-sky-700 hover:bg-sky-50 cursor-pointer"
            >
              Talleres
            </button>
            {isMine ? (
              <button
                type="button"
                onClick={onEnroll}
                className="inline-flex items-center gap-1 px-3.5 py-2 rounded-xl text-[11px] font-black bg-emerald-50 text-emerald-700 border border-emerald-200 cursor-pointer"
              >
                <CheckCircle2 className="w-3.5 h-3.5" /> Inscrito
              </button>
            ) : (
              <button
                type="button"
                onClick={onEnroll}
                disabled={!enrollable}
                className="inline-flex items-center gap-1 px-3.5 py-2 rounded-xl text-[11px] font-black bg-[#0284C7] hover:bg-[#0369A1] text-white shadow disabled:bg-slate-100 disabled:text-slate-400 disabled:shadow-none disabled:cursor-not-allowed cursor-pointer"
              >
                <Ticket className="w-3.5 h-3.5" />
                {finished ? 'Finalizado' : enrollable ? 'Inscribirme' : 'Cerrado'}
              </button>
            )}
          </div>
        </div>
      </div>
    </article>
  );
};
