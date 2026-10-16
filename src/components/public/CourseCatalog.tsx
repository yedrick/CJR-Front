import React, { useState } from 'react';
import { useCamp } from '../../context/CampContext';
import { CampCourse } from '../../types/camp';
import { 
  Clock, 
  MapPin, 
  User, 
  Check, 
  ArrowRight, 
  Sparkles,
  BookOpen,
  X,
  Users,
  CheckCircle2,
  Calendar,
  AlertCircle,
  ShieldCheck
} from 'lucide-react';

interface CourseCatalogProps {
  onSelectCourseForEnrollment?: (courseId: string) => void;
}

export const CourseCatalog: React.FC<CourseCatalogProps> = ({ onSelectCourseForEnrollment }) => {
  const { courses, setActiveTab } = useCamp();
  const [selectedCourseModal, setSelectedCourseModal] = useState<CampCourse | null>(null);

  const handleEnrollCourse = (courseId: string) => {
    if (onSelectCourseForEnrollment) {
      onSelectCourseForEnrollment(courseId);
    } else {
      setActiveTab('enroll');
    }
  };

  return (
    <section id="courses-catalog-section" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 animate-fade-in">
      
      {/* Header Section - Clean Celeste & Blanco (Minimal text, ultra visual) */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-6 border-b border-sky-100">
        <div>
          <div className="flex items-center gap-2 text-xs font-black text-[#0284C7] uppercase tracking-wider">
            <Sparkles className="w-4 h-4 text-amber-500" />
            <span>Formación Bíblica y Ministerial CJN</span>
          </div>
          <h2 className="text-2xl sm:text-3xl lg:text-4xl font-black text-slate-900 font-display mt-1 tracking-tight">
            Los 6 Talleres Oficiales
          </h2>
          
          {/* Visual quick info badges instead of a wall of text */}
          <div className="flex flex-wrap items-center gap-2 mt-3 text-xs">
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-sky-50 text-sky-800 border border-sky-200 font-bold">
              <Calendar className="w-3.5 h-3.5 text-[#0284C7]" />
              Lunes a Viernes · 08:30 a 10:30
            </span>
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-50 text-amber-900 border border-amber-200 font-bold">
              <Users className="w-3.5 h-3.5 text-amber-600" />
              1 Taller por Joven
            </span>
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-50 text-emerald-900 border border-emerald-200 font-bold">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
              Cupos: 20 y 25 máx.
            </span>
          </div>
        </div>

        <button
          onClick={() => setActiveTab('enroll')}
          className="inline-flex items-center justify-center gap-2 px-6 py-3.5 text-xs sm:text-sm font-black text-white bg-[#0284C7] hover:bg-[#0369A1] rounded-2xl transition-all shadow-md hover:shadow-lg active:scale-95 shrink-0 min-h-[44px] cursor-pointer"
        >
          <span>Elegir mi Taller</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>

      {/* GRID OF 6 WORKSHOPS - Clean Design: Foto de Fondo, Título, Pastor, Descripción */}
      <div className="mt-8 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {courses.slice(0, 6).map((course) => {
          const isFull = course.enrolledCount >= course.maxCapacity;
          const availableSpots = course.maxCapacity - course.enrolledCount;
          const percentFilled = Math.round((course.enrolledCount / course.maxCapacity) * 100);

          return (
            <div
              key={course.id}
              className="bg-white rounded-3xl border border-sky-100 overflow-hidden shadow-xs hover:shadow-xl transition-all duration-300 flex flex-col justify-between group hover:-translate-y-1"
            >
              <div>
                {/* 1. FOTO DE FONDO CON OVERLAY SUAVE */}
                <div className="relative h-48 w-full bg-slate-900 overflow-hidden">
                  <img
                    src={course.coverImageUrl || 'https://images.unsplash.com/photo-1524178232363-1fb2b075b655?q=80&w=800&auto=format&fit=crop'}
                    alt={course.title}
                    className="w-full h-full object-cover group-hover:scale-108 transition-transform duration-500"
                    onError={(e) => {
                      e.currentTarget.style.display = 'none';
                    }}
                  />
                  {/* Subtle dark gradient overlay */}
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/50 to-slate-950/20" />

                  {/* Top Quota Pill */}
                  <div className="absolute top-3 left-3 right-3 flex items-center justify-between z-10">
                    <span className="text-[10px] font-extrabold px-2.5 py-1 rounded-full bg-sky-950/80 text-sky-200 backdrop-blur-md border border-sky-400/30">
                      Lunes a Viernes · 08:30
                    </span>
                    <span className={`text-[10px] font-mono font-black px-2.5 py-1 rounded-full backdrop-blur-md shadow-xs ${
                      isFull 
                        ? 'bg-red-500/90 text-white' 
                        : 'bg-white/90 text-[#0284C7]'
                    }`}>
                      {isFull ? 'Cupo Lleno' : `${availableSpots} libres`}
                    </span>
                  </div>

                  {/* Pastor Photo and Name Over Background Image */}
                  <div className="absolute bottom-3 left-3 right-3 flex items-center gap-3 z-10">
                    <img
                      src={course.instructorPhotoUrl || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?q=80&w=400&auto=format&fit=crop'}
                      alt={course.instructor}
                      className="w-11 h-11 rounded-full object-cover border-2 border-white shadow-md shrink-0"
                    />
                    <div className="min-w-0">
                      <span className="text-[10px] uppercase font-bold text-sky-300 tracking-wider block">
                        Facilitador / Pastor
                      </span>
                      <h4 className="text-xs sm:text-sm font-extrabold text-white truncate drop-shadow-xs">
                        {course.instructor}
                      </h4>
                    </div>
                  </div>
                </div>

                {/* 2. CONTENIDO LIMPIO: TÍTULO Y DESCRIPCIÓN */}
                <div className="p-5 space-y-3">
                  <h3 className="text-base sm:text-lg font-extrabold text-slate-900 font-display group-hover:text-[#0284C7] transition-colors leading-snug">
                    {course.title}
                  </h3>

                  <p className="text-xs text-slate-600 line-clamp-3 leading-relaxed">
                    {course.description}
                  </p>

                  {/* Barra simple de cupos */}
                  <div className="pt-2">
                    <div className="flex items-center justify-between text-[11px] text-slate-500 font-medium mb-1">
                      <span>Inscritos</span>
                      <span className="font-mono font-bold text-slate-800">
                        {course.enrolledCount} / {course.maxCapacity} cupos
                      </span>
                    </div>
                    <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                      <div
                        className={`h-1.5 rounded-full transition-all duration-500 ${
                          isFull
                            ? 'bg-red-500'
                            : percentFilled >= 80
                            ? 'bg-amber-500'
                            : 'bg-[#0284C7]'
                        }`}
                        style={{ width: `${Math.min(100, percentFilled)}%` }}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* 3. BOTONES DE ACCIÓN: VER DETALLE & INSCRIBIRSE */}
              <div className="px-5 py-3.5 bg-slate-50/80 border-t border-slate-100 flex items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={() => setSelectedCourseModal(course)}
                  className="text-xs font-bold text-[#0284C7] hover:text-[#0369A1] transition-colors cursor-pointer hover:underline"
                >
                  Ver Detalle
                </button>

                <button
                  type="button"
                  disabled={isFull}
                  onClick={() => handleEnrollCourse(course.id)}
                  className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-black transition-all shadow-xs cursor-pointer ${
                    isFull
                      ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                      : 'bg-[#0284C7] hover:bg-[#0369A1] text-white hover:scale-105 active:scale-95'
                  }`}
                >
                  <span>{isFull ? 'Agotado' : 'Elegir Taller'}</span>
                  {!isFull && <ArrowRight className="w-3.5 h-3.5" />}
                </button>
              </div>

            </div>
          );
        })}
      </div>

      {/* MODAL DETALLADO CON EXCELENTE UI/UX (Clean, Centered, Beautiful) */}
      {selectedCourseModal && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in"
          onClick={() => setSelectedCourseModal(null)}
        >
          <div 
            className="bg-white rounded-3xl max-w-lg w-full overflow-hidden shadow-2xl border border-sky-100 animate-scale-in"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header con Imagen de Fondo del Taller */}
            <div className="relative h-44 w-full bg-slate-900 overflow-hidden">
              <img
                src={selectedCourseModal.coverImageUrl || 'https://images.unsplash.com/photo-1524178232363-1fb2b075b655?q=80&w=800&auto=format&fit=crop'}
                alt={selectedCourseModal.title}
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/60 to-slate-950/20" />

              {/* Botón cerrar */}
              <button
                type="button"
                onClick={() => setSelectedCourseModal(null)}
                className="absolute top-3 right-3 z-20 w-8 h-8 rounded-full bg-black/50 hover:bg-black/80 text-white flex items-center justify-center transition-colors cursor-pointer"
                aria-label="Cerrar modal"
              >
                <X className="w-4 h-4" />
              </button>

              {/* Badge de Horario en cabecera */}
              <div className="absolute top-3 left-3 z-10">
                <span className="text-[10px] font-mono font-bold px-3 py-1 rounded-full bg-white/90 text-[#0284C7] shadow-xs">
                  Lunes a Viernes · 08:30 a 10:30
                </span>
              </div>

              {/* Título sobre la imagen */}
              <div className="absolute bottom-3 left-4 right-4 z-10">
                <h3 className="text-lg sm:text-xl font-extrabold text-white font-display leading-tight drop-shadow-sm">
                  {selectedCourseModal.title}
                </h3>
              </div>
            </div>

            {/* Cuerpo del Modal */}
            <div className="p-6 space-y-4">
              
              {/* Tarjeta del Facilitador / Pastor */}
              <div className="flex items-center gap-3.5 p-3.5 rounded-2xl bg-sky-50 border border-sky-200">
                <img
                  src={selectedCourseModal.instructorPhotoUrl || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?q=80&w=400&auto=format&fit=crop'}
                  alt={selectedCourseModal.instructor}
                  className="w-14 h-14 rounded-full object-cover border-2 border-[#0284C7] shadow-xs shrink-0"
                />
                <div className="min-w-0">
                  <div className="text-[10px] font-mono font-bold text-[#0284C7] uppercase">
                    Pastor / Facilitador
                  </div>
                  <div className="text-sm font-extrabold text-slate-900 truncate">
                    {selectedCourseModal.instructor}
                  </div>
                  <div className="text-xs text-slate-500 truncate">
                    {selectedCourseModal.instructorRole}
                  </div>
                </div>
              </div>

              {/* Biografía / Reseña del Pastor */}
              {selectedCourseModal.instructorBio && (
                <div className="text-xs text-slate-600 bg-slate-50 p-3 rounded-xl border border-slate-200 italic leading-relaxed">
                  "{selectedCourseModal.instructorBio}"
                </div>
              )}

              {/* Descripción Bíblica del Taller */}
              <div className="space-y-1">
                <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  Propósito y Contenido
                </div>
                <p className="text-xs sm:text-sm text-slate-700 leading-relaxed">
                  {selectedCourseModal.description}
                </p>
              </div>

              {/* Datos de Lugar y Cupos */}
              <div className="grid grid-cols-2 gap-3 text-xs pt-1">
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                  <span className="text-[10px] text-slate-400 block font-medium">Ubicación / Sede</span>
                  <span className="font-bold text-slate-800 flex items-center gap-1 mt-0.5">
                    <MapPin className="w-3.5 h-3.5 text-[#0284C7] shrink-0" />
                    <span className="truncate">{selectedCourseModal.location}</span>
                  </span>
                </div>

                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                  <span className="text-[10px] text-slate-400 block font-medium">Capacidad Máxima</span>
                  <span className="font-bold text-slate-800 flex items-center gap-1 mt-0.5">
                    <Users className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                    <span>{selectedCourseModal.maxCapacity} participantes</span>
                  </span>
                </div>
              </div>

              {/* Estado de Cupos Disponibles */}
              <div className="p-3 rounded-xl bg-sky-50 border border-sky-100 flex items-center justify-between text-xs">
                <span className="text-slate-600 font-medium">Disponibilidad en tiempo real:</span>
                <span className="font-mono font-bold text-[#0284C7]">
                  {selectedCourseModal.maxCapacity - selectedCourseModal.enrolledCount} plazas libres de {selectedCourseModal.maxCapacity}
                </span>
              </div>

              {/* Botones de Acción del Modal */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setSelectedCourseModal(null)}
                  className="px-4 py-2.5 text-xs font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
                >
                  Cerrar
                </button>

                <button
                  type="button"
                  onClick={() => {
                    handleEnrollCourse(selectedCourseModal.id);
                    setSelectedCourseModal(null);
                  }}
                  className="inline-flex items-center gap-2 px-5 py-2.5 text-xs font-extrabold text-white bg-[#0284C7] hover:bg-[#0369A1] rounded-xl shadow-md transition-transform hover:scale-105 active:scale-95 cursor-pointer"
                >
                  <CheckCircle2 className="w-4 h-4 text-sky-200" />
                  <span>Inscribirme en este Taller</span>
                </button>
              </div>

            </div>
          </div>
        </div>
      )}

    </section>
  );
};
