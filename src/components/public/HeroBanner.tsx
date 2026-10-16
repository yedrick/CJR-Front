import React from 'react';
import { useCamp } from '../../context/CampContext';
import { 
  Users, 
  Clock, 
  ShieldCheck, 
  QrCode, 
  ArrowRight, 
  MapPin,
  Sparkles,
  BookOpen,
  CheckCircle2,
  Calendar
} from 'lucide-react';

export const HeroBanner: React.FC = () => {
  const { setActiveTab, courses, registrations } = useCamp();

  const totalSpots = courses.reduce((acc, c) => acc + c.maxCapacity, 0);
  const totalEnrolled = courses.reduce((acc, c) => acc + c.enrolledCount, 0);
  const occupancyPercent = totalSpots > 0 ? Math.round((totalEnrolled / totalSpots) * 100) : 0;

  return (
    <div className="relative overflow-hidden bg-gradient-to-br from-[#0284C7] via-[#0369A1] to-[#0c4a6e] text-white pt-8 pb-12 sm:pt-14 sm:pb-16 px-4 sm:px-6 lg:px-8 border-b border-sky-400/30 shadow-xl">
      
      {/* Background subtle glowing pattern */}
      <div className="absolute inset-0 opacity-10 bg-[radial-gradient(#FFFFFF_1px,transparent_1px)] [background-size:20px_20px] pointer-events-none" />
      <div className="absolute -top-12 -right-12 w-80 h-80 bg-sky-300/20 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-8 -left-8 w-64 h-64 bg-amber-400/15 rounded-full blur-2xl pointer-events-none" />

      <div className="relative max-w-7xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">
          
          {/* Main Hero Copy - Clean, Visual, No Wall of Text */}
          <div className="lg:col-span-7 space-y-5 text-center lg:text-left">
            
            {/* Top Identity Kicker */}
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white text-[#0284C7] text-xs font-black uppercase tracking-wider shadow-sm border border-sky-100 mx-auto lg:mx-0">
              <Sparkles className="w-3.5 h-3.5 text-amber-500" />
              <span>Comité Juvenil Regional · CJN 2026</span>
            </div>

            {/* Impactful Title */}
            <h1 className="text-3xl sm:text-5xl lg:text-5xl font-black font-display tracking-tight text-white leading-tight drop-shadow-xs">
              Campamento Nacional Cristiano
            </h1>

            {/* Short, Punchy Subtitle - NO WALL OF TEXT */}
            <p className="text-sm sm:text-base text-sky-100 max-w-xl mx-auto lg:mx-0 font-medium leading-relaxed">
              El gran encuentro juvenil de Bolivia. Elige tu taller bíblico matutino con cupos limitados y obtén tu pase digital al instante.
            </p>

            {/* Visual 4-Feature Grid (Punchy & Descriptive) */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-1 text-left">
              <div className="bg-white/10 backdrop-blur-sm border border-white/15 rounded-2xl p-3">
                <MapPin className="w-4 h-4 text-amber-300 mb-1" />
                <div className="text-base sm:text-lg font-black text-white font-mono">31</div>
                <div className="text-[11px] text-sky-200 font-medium">Regionales</div>
              </div>

              <div className="bg-white/10 backdrop-blur-sm border border-white/15 rounded-2xl p-3">
                <BookOpen className="w-4 h-4 text-sky-200 mb-1" />
                <div className="text-base sm:text-lg font-black text-white font-mono">6</div>
                <div className="text-[11px] text-sky-200 font-medium">Talleres Diarios</div>
              </div>

              <div className="bg-white/10 backdrop-blur-sm border border-white/15 rounded-2xl p-3">
                <Calendar className="w-4 h-4 text-emerald-300 mb-1" />
                <div className="text-xs sm:text-sm font-black text-white mt-1">Lun - Vie</div>
                <div className="text-[11px] text-sky-200 font-medium">08:30 a 10:30</div>
              </div>

              <div className="bg-white/10 backdrop-blur-sm border border-white/15 rounded-2xl p-3">
                <QrCode className="w-4 h-4 text-amber-300 mb-1" />
                <div className="text-xs sm:text-sm font-black text-white mt-1">Pase QR</div>
                <div className="text-[11px] text-sky-200 font-medium">Inmediato</div>
              </div>
            </div>

            {/* Action Buttons - Touch friendly (min 44px) */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-center lg:justify-start gap-3 pt-2">
              <button
                type="button"
                onClick={() => setActiveTab('enroll')}
                className="inline-flex items-center justify-center gap-2 px-7 py-3.5 text-sm font-black text-[#0284C7] bg-white hover:bg-sky-50 rounded-2xl transition-all shadow-xl hover:shadow-2xl active:scale-95 cursor-pointer min-h-[48px]"
              >
                <span>¡Inscribirme a mi Taller!</span>
                <ArrowRight className="w-4 h-4 text-[#0284C7]" />
              </button>

              <button
                type="button"
                onClick={() => {
                  const el = document.getElementById('courses-catalog-section');
                  el?.scrollIntoView({ behavior: 'smooth' });
                }}
                className="inline-flex items-center justify-center gap-2 px-5 py-3.5 text-sm font-bold text-white bg-white/15 hover:bg-white/25 rounded-2xl border border-white/30 backdrop-blur-xs transition-colors cursor-pointer min-h-[48px]"
              >
                <BookOpen className="w-4 h-4 text-sky-200" />
                <span>Ver los 6 Talleres</span>
              </button>
            </div>
          </div>

          {/* KPI Card - Clean, Visual, Mobile Responsive */}
          <div className="lg:col-span-5 bg-white text-slate-900 rounded-3xl p-5 sm:p-6 shadow-2xl border border-sky-100">
            <div className="flex items-center justify-between pb-3.5 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <span className="relative flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
                </span>
                <span className="text-xs font-black uppercase tracking-wider text-slate-700">
                  Cupos en Vivo
                </span>
              </div>
              <span className="text-[11px] font-mono font-bold text-[#0284C7] bg-sky-50 px-2.5 py-0.5 rounded-full border border-sky-200">
                Campamento 2026
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3 my-4">
              <div className="p-3 bg-sky-50/70 rounded-2xl border border-sky-100">
                <div className="flex items-center gap-1.5 text-xs text-slate-500 font-medium">
                  <Clock className="w-3.5 h-3.5 text-[#0284C7]" />
                  <span>Talleres</span>
                </div>
                <div className="text-2xl font-black text-[#0284C7] font-mono mt-0.5">
                  6
                </div>
                <div className="text-[11px] text-slate-500">
                  Con pastores
                </div>
              </div>

              <div className="p-3 bg-sky-50/70 rounded-2xl border border-sky-100">
                <div className="flex items-center gap-1.5 text-xs text-slate-500 font-medium">
                  <Users className="w-3.5 h-3.5 text-[#0284C7]" />
                  <span>Inscritos</span>
                </div>
                <div className="text-2xl font-black text-[#0284C7] font-mono mt-0.5">
                  {registrations.length}
                </div>
                <div className="text-[11px] text-slate-500">
                  Jóvenes registrados
                </div>
              </div>
            </div>

            {/* Visual Capacity Meter */}
            <div className="space-y-1.5 pt-1">
              <div className="flex justify-between text-xs font-bold text-slate-700">
                <span>Plazas Ocupadas</span>
                <span className="font-mono text-[#0284C7]">
                  {occupancyPercent}% ({totalEnrolled}/{totalSpots})
                </span>
              </div>
              <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
                <div
                  className="bg-gradient-to-r from-[#0284C7] to-emerald-400 h-2.5 rounded-full transition-all duration-500"
                  style={{ width: `${Math.min(100, occupancyPercent)}%` }}
                />
              </div>
            </div>

            <div className="mt-4 pt-3.5 border-t border-slate-100 flex items-center justify-between text-xs text-slate-600">
              <div className="flex items-center gap-1.5 font-semibold text-slate-700">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                <span>Cupo Seguro</span>
              </div>
              <div className="flex items-center gap-1.5 font-semibold text-[#0284C7]">
                <CheckCircle2 className="w-4 h-4 text-[#0284C7]" />
                <span>Acreditación QR</span>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};
