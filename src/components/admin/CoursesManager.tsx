import React, { useState } from 'react';
import { useCamp } from '../../context/CampContext';
import { CampCourse, DayOfWeek, TimeSlot, CourseCategory } from '../../types/camp';
import { 
  BookOpen, 
  Plus, 
  Clock, 
  Users, 
  MapPin, 
  Edit3, 
  Trash2, 
  CheckCircle2, 
  AlertCircle, 
  X,
  Search
} from 'lucide-react';

const DAYS: DayOfWeek[] = [
  'Lunes a Viernes',
  'Lunes (Día 1)',
  'Martes (Día 2)',
  'Miércoles (Día 3)',
  'Jueves (Día 4)',
  'Viernes (Día 5)',
];

const TIME_SLOTS: TimeSlot[] = [
  '08:30 - 10:30',
  '11:00 - 13:00',
  '14:30 - 16:30',
  '17:00 - 19:00',
];

const CATEGORIES: CourseCategory[] = [
  'Liderazgo y Discipulado',
  'Ciencia, Robótica y Fe',
  'Música y Alabanza',
  'Misiones y Evangelismo',
  'Supervivencia y Aventura',
];

export const CoursesManager: React.FC = () => {
  const { courses, registrations, addCourse, updateCourse, deleteCourse, setSelectedCamperForBadge } = useCamp();
  const [filterDay, setFilterDay] = useState<string>('ALL');
  const [search, setSearch] = useState<string>('');
  
  // Modal states
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingCourse, setEditingCourse] = useState<CampCourse | null>(null);
  const [viewingRosterCourse, setViewingRosterCourse] = useState<CampCourse | null>(null);

  // Form states for Add / Edit
  const [formTitle, setFormTitle] = useState('');
  const [formCategory, setFormCategory] = useState<CourseCategory>('Liderazgo y Discipulado');
  const [formDay, setFormDay] = useState<DayOfWeek>('Lunes a Viernes');
  const [formTimeSlot, setFormTimeSlot] = useState<TimeSlot>('08:30 - 10:30');
  const [formLocation, setFormLocation] = useState('');
  const [formInstructor, setFormInstructor] = useState('');
  const [formMaxCapacity, setFormMaxCapacity] = useState(20);
  const [formDescription, setFormDescription] = useState('');
  const [formMaterialsFee, setFormMaterialsFee] = useState(20);
  const [formMinAge, setFormMinAge] = useState(10);
  const [formMaxAge, setFormMaxAge] = useState(17);

  const resetForm = () => {
    setFormTitle('');
    setFormCategory('Liderazgo y Discipulado');
    setFormDay('Lunes a Viernes');
    setFormTimeSlot('08:30 - 10:30');
    setFormLocation('');
    setFormInstructor('');
    setFormMaxCapacity(20);
    setFormDescription('');
    setFormMaterialsFee(20);
    setFormMinAge(10);
    setFormMaxAge(17);
  };

  const handleOpenAdd = () => {
    resetForm();
    setEditingCourse(null);
    setIsAddModalOpen(true);
  };

  const handleOpenEdit = (course: CampCourse) => {
    setEditingCourse(course);
    setFormTitle(course.title);
    setFormCategory(course.category);
    setFormDay(course.day);
    setFormTimeSlot(course.timeSlot);
    setFormLocation(course.location);
    setFormInstructor(course.instructor);
    setFormMaxCapacity(course.maxCapacity);
    setFormDescription(course.description);
    setFormMaterialsFee(course.materialsFee);
    setFormMinAge(course.minAge);
    setFormMaxAge(course.maxAge);
    setIsAddModalOpen(true);
  };

  const handleSaveCourse = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTitle.trim()) return;

    if (editingCourse) {
      updateCourse(editingCourse.id, {
        title: formTitle,
        category: formCategory,
        day: formDay,
        timeSlot: formTimeSlot,
        location: formLocation || 'Pabellón Central',
        instructor: formInstructor || 'Instructor Designado',
        maxCapacity: Number(formMaxCapacity),
        description: formDescription || 'Taller formativo de campamento.',
        materialsFee: Number(formMaterialsFee),
        minAge: Number(formMinAge),
        maxAge: Number(formMaxAge),
      });
    } else {
      addCourse({
        title: formTitle,
        category: formCategory,
        day: formDay,
        timeSlot: formTimeSlot,
        location: formLocation || 'Pabellón Central',
        instructor: formInstructor || 'Instructor Designado',
        maxCapacity: Number(formMaxCapacity),
        description: formDescription || 'Taller formativo de campamento.',
        materialsFee: Number(formMaterialsFee),
        minAge: Number(formMinAge),
        maxAge: Number(formMaxAge),
        iconName: 'Compass',
      });
    }

    setIsAddModalOpen(false);
  };

  const filteredCourses = courses.filter((c) => {
    const matchesDay = filterDay === 'ALL' || c.day === filterDay;
    const matchesSearch =
      c.title.toLowerCase().includes(search.toLowerCase()) ||
      c.instructor.toLowerCase().includes(search.toLowerCase()) ||
      c.location.toLowerCase().includes(search.toLowerCase());
    return matchesDay && matchesSearch;
  });

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6 animate-fade-in">
      
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-[#E6DEC8]">
        <div>
          <span className="text-xs font-bold text-emerald-800 uppercase tracking-widest">
            Control de Cupos y Oferta de Talleres
          </span>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-[#1B4332] font-display mt-0.5">
            Administración de Cursos por Días y Horas
          </h2>
          <p className="text-xs text-stone-600 mt-1">
            Configura el cupo máximo por curso (ej. 20 o 25 personas), instructores y turnos simultáneos.
          </p>
        </div>

        <button
          onClick={handleOpenAdd}
          className="inline-flex items-center gap-2 px-4 py-2.5 text-xs font-bold text-white bg-[#1B4332] hover:bg-[#2D6A4F] rounded-xl transition-all shadow-xs self-start sm:self-auto"
        >
          <Plus className="w-4 h-4 text-emerald-300" />
          Crear Nuevo Curso
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-stone-200 shadow-xs">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Buscar por curso, instructor..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-xs bg-stone-50 border border-stone-200 rounded-xl focus:ring-2 focus:ring-[#1B4332] text-stone-900"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <span className="text-xs text-stone-500 font-medium whitespace-nowrap">Filtrar por Día:</span>
          <select
            value={filterDay}
            onChange={(e) => setFilterDay(e.target.value)}
            className="px-3 py-2 text-xs bg-stone-50 border border-stone-200 rounded-xl focus:ring-2 focus:ring-[#1B4332] text-stone-800"
          >
            <option value="ALL">Todos los Días ({courses.length})</option>
            {DAYS.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Courses Table */}
      <div className="bg-white rounded-2xl border border-stone-200 overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-stone-50 border-b border-stone-200 text-stone-600 uppercase tracking-wider font-bold">
              <tr>
                <th className="py-3.5 px-4">Curso / Área</th>
                <th className="py-3.5 px-4">Día & Horario</th>
                <th className="py-3.5 px-4">Instructor & Lugar</th>
                <th className="py-3.5 px-4 text-center">Cupo / Ocupación</th>
                <th className="py-3.5 px-4 text-right">Tarifa Materiales</th>
                <th className="py-3.5 px-4 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100 font-medium text-stone-700">
              {filteredCourses.map((c) => {
                const isFull = c.enrolledCount >= c.maxCapacity;
                const percent = Math.round((c.enrolledCount / c.maxCapacity) * 100);

                return (
                  <tr key={c.id} className="hover:bg-stone-50/80 transition-colors">
                    
                    {/* Title & Category */}
                    <td className="py-3.5 px-4">
                      <div className="font-bold text-stone-900 text-sm font-display">
                        {c.title}
                      </div>
                      <div className="text-[11px] text-emerald-800 font-semibold mt-0.5">
                        {c.category} · Edades {c.minAge}-{c.maxAge} años
                      </div>
                    </td>

                    {/* Day & Slot */}
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <div className="font-semibold text-stone-800">{c.day}</div>
                      <div className="text-[11px] text-stone-500 font-mono flex items-center gap-1 mt-0.5">
                        <Clock className="w-3 h-3 text-stone-400" />
                        {c.timeSlot}
                      </div>
                    </td>

                    {/* Instructor & Location */}
                    <td className="py-3.5 px-4">
                      <div className="text-stone-900 font-semibold truncate max-w-xs">
                        Prof. {c.instructor}
                      </div>
                      <div className="text-[11px] text-stone-500 flex items-center gap-1 mt-0.5 truncate max-w-xs">
                        <MapPin className="w-3 h-3 text-stone-400" />
                        {c.location}
                      </div>
                    </td>

                    {/* Capacity & Live Meter */}
                    <td className="py-3.5 px-4 text-center">
                      <div className="inline-block w-36 text-left">
                        <div className="flex justify-between items-center text-[11px] mb-1">
                          <span className={`font-mono font-bold tabular-nums ${isFull ? 'text-red-600' : 'text-stone-800'}`}>
                            {c.enrolledCount} / {c.maxCapacity} cupos
                          </span>
                          <span className="text-stone-400 text-[10px]">{percent}%</span>
                        </div>
                        <div className="w-full bg-stone-200 rounded-full h-1.5 overflow-hidden">
                          <div
                            className={`h-1.5 rounded-full ${
                              isFull ? 'bg-red-500' : percent >= 80 ? 'bg-amber-500' : 'bg-[#1B4332]'
                            }`}
                            style={{ width: `${Math.min(100, percent)}%` }}
                          />
                        </div>
                        {isFull && (
                          <span className="text-[10px] text-red-600 font-bold block mt-0.5">
                            Cupo Agotado
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Fee */}
                    <td className="py-3.5 px-4 text-right font-mono font-bold text-stone-900 tabular-nums">
                      {c.materialsFee} Bs
                    </td>

                    {/* Actions */}
                    <td className="py-3.5 px-4 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => setViewingRosterCourse(c)}
                          className="px-2.5 py-1 text-xs font-semibold text-[#1B4332] bg-emerald-50 hover:bg-emerald-100 rounded-lg transition-colors border border-emerald-200"
                          title="Ver lista de alumnos inscritos"
                        >
                          Alumnos ({c.enrolledCount})
                        </button>
                        <button
                          onClick={() => handleOpenEdit(c)}
                          className="p-1.5 text-stone-500 hover:text-stone-900 hover:bg-stone-100 rounded-lg transition-colors"
                          title="Editar curso y cupo"
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => {
                            if (confirm(`¿Eliminar el curso "${c.title}"?`)) {
                              deleteCourse(c.id);
                            }
                          }}
                          className="p-1.5 text-stone-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          title="Eliminar curso"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>

                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add / Edit Course Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-xl w-full p-6 shadow-2xl border border-stone-200 overflow-y-auto max-h-[90vh]">
            <div className="flex items-center justify-between pb-4 border-b border-stone-100">
              <h3 className="text-lg font-bold text-stone-900 font-display">
                {editingCourse ? 'Editar Curso y Parámetros de Cupo' : 'Crear Nuevo Curso para Campamento'}
              </h3>
              <button onClick={() => setIsAddModalOpen(false)} className="text-stone-400 hover:text-stone-700">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveCourse} className="py-4 space-y-4 text-xs">
              <div>
                <label className="block font-bold text-stone-700 uppercase tracking-wider mb-1">
                  Título del Curso / Taller *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ej. Taller de Astronomía y Cohetes"
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-stone-50 border border-stone-200 rounded-xl text-stone-900"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-stone-700 uppercase tracking-wider mb-1">
                    Área Temática
                  </label>
                  <select
                    value={formCategory}
                    onChange={(e) => setFormCategory(e.target.value as any)}
                    className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl text-stone-800"
                  >
                    {CATEGORIES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-stone-700 uppercase tracking-wider mb-1">
                    Cupo Máximo de Alumnos (Estricto) *
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={100}
                    required
                    value={formMaxCapacity}
                    onChange={(e) => setFormMaxCapacity(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl font-mono tabular-nums font-bold text-stone-900"
                  />
                  <span className="text-[10px] text-stone-400 block mt-0.5">
                    Ej. 20 o 25 alumnos
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-stone-700 uppercase tracking-wider mb-1">
                    Día del Campamento *
                  </label>
                  <select
                    value={formDay}
                    onChange={(e) => setFormDay(e.target.value as any)}
                    className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl text-stone-800"
                  >
                    {DAYS.map((d) => (
                      <option key={d} value={d}>
                        {d}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-stone-700 uppercase tracking-wider mb-1">
                    Franja Horaria *
                  </label>
                  <select
                    value={formTimeSlot}
                    onChange={(e) => setFormTimeSlot(e.target.value as any)}
                    className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl text-stone-800 font-mono"
                  >
                    {TIME_SLOTS.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-stone-700 uppercase tracking-wider mb-1">
                    Instructor Responsable
                  </label>
                  <input
                    type="text"
                    placeholder="Ej. Sargento Diego Valdés"
                    value={formInstructor}
                    onChange={(e) => setFormInstructor(e.target.value)}
                    className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl text-stone-900"
                  />
                </div>

                <div>
                  <label className="block font-bold text-stone-700 uppercase tracking-wider mb-1">
                    Lugar / Sector del Campamento
                  </label>
                  <input
                    type="text"
                    placeholder="Ej. Bosque de Pinos - Sector A"
                    value={formLocation}
                    onChange={(e) => setFormLocation(e.target.value)}
                    className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl text-stone-900"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block font-bold text-stone-700 uppercase tracking-wider mb-1">
                    Arancel Materiales (Bs)
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={formMaterialsFee}
                    onChange={(e) => setFormMaterialsFee(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl font-mono tabular-nums text-stone-900"
                  />
                </div>

                <div>
                  <label className="block font-bold text-stone-700 uppercase tracking-wider mb-1">
                    Edad Mínima
                  </label>
                  <input
                    type="number"
                    min={5}
                    max={18}
                    value={formMinAge}
                    onChange={(e) => setFormMinAge(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl font-mono tabular-nums text-stone-900"
                  />
                </div>

                <div>
                  <label className="block font-bold text-stone-700 uppercase tracking-wider mb-1">
                    Edad Máxima
                  </label>
                  <input
                    type="number"
                    min={5}
                    max={18}
                    value={formMaxAge}
                    onChange={(e) => setFormMaxAge(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl font-mono tabular-nums text-stone-900"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-stone-700 uppercase tracking-wider mb-1">
                  Descripción Detallada
                </label>
                <textarea
                  rows={2}
                  placeholder="Detalles sobre lo que aprenderán los alumnos..."
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl text-stone-900"
                />
              </div>

              <div className="pt-4 border-t border-stone-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 text-stone-600 hover:bg-stone-100 rounded-lg"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 font-bold text-white bg-[#1B4332] hover:bg-[#2D6A4F] rounded-lg shadow-xs"
                >
                  {editingCourse ? 'Guardar Cambios' : 'Registrar Curso'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Viewing Enrolled Campers for Course Modal */}
      {viewingRosterCourse && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-stone-200">
            <div className="flex items-center justify-between pb-4 border-b border-stone-100">
              <div>
                <span className="text-[11px] font-bold text-emerald-800 uppercase tracking-wider">
                  Nómina Oficial del Curso
                </span>
                <h3 className="text-lg font-bold text-stone-900 font-display mt-0.5">
                  {viewingRosterCourse.title}
                </h3>
                <div className="text-xs text-stone-500 font-mono">
                  {viewingRosterCourse.day} · {viewingRosterCourse.timeSlot}
                </div>
              </div>
              <button onClick={() => setViewingRosterCourse(null)} className="text-stone-400 hover:text-stone-700">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="py-4 space-y-3 max-h-80 overflow-y-auto">
              {(() => {
                const enrolled = registrations.filter((r) =>
                  r.enrolledCourseIds.includes(viewingRosterCourse.id)
                );

                if (enrolled.length === 0) {
                  return (
                    <div className="text-center py-8 text-xs text-stone-400">
                      No hay alumnos inscritos en este curso todavía.
                    </div>
                  );
                }

                return enrolled.map((camper, idx) => (
                  <div
                    key={camper.id}
                    className="p-3 bg-stone-50 rounded-xl border border-stone-200 text-xs flex items-center justify-between"
                  >
                    <div>
                      <div className="font-bold text-stone-900">
                        {idx + 1}. {camper.fullName}
                      </div>
                      <div className="text-stone-500 font-mono text-[11px]">
                        ID: {camper.id} · {camper.age} años · Tutor: {camper.guardianPhone}
                      </div>
                    </div>
                    <button
                      onClick={() => {
                        setViewingRosterCourse(null);
                        setSelectedCamperForBadge(camper);
                      }}
                      className="px-2.5 py-1 text-[11px] font-semibold text-[#1B4332] bg-emerald-50 hover:bg-emerald-100 rounded-lg border border-emerald-200"
                    >
                      Ver Gafete QR
                    </button>
                  </div>
                ));
              })()}
            </div>

            <div className="pt-4 border-t border-stone-100 flex items-center justify-between text-xs">
              <span className="font-mono text-stone-600">
                Ocupación: {viewingRosterCourse.enrolledCount} de {viewingRosterCourse.maxCapacity} cupos
              </span>
              <button
                onClick={() => setViewingRosterCourse(null)}
                className="px-4 py-1.5 font-semibold text-stone-700 hover:bg-stone-100 rounded-lg"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
