import React, { useMemo, useState } from 'react';
import {
  AlertCircle,
  BookOpen,
  CalendarClock,
  CalendarDays,
  CalendarRange,
  CheckCircle2,
  Clock,
  Copy,
  DoorClosed,
  DoorOpen,
  Edit3,
  Eye,
  IdCard,
  Loader2,
  Lock,
  Image as ImageIcon,
  MapPin,
  Plus,
  Sun,
  Tent,
  Trash2,
  UserRound,
  Users,
} from 'lucide-react';
import { useCamp } from '../../context/CampContext';
import { useConfirm } from '../common/ConfirmDialog';
import { useAuth } from '../../context/AuthContext';
import type { Camp, CampCourse, CamperRegistration, CourseScheduleType } from '../../types/camp';
import {
  PHASE_META,
  campDays,
  formatCourseSchedule,
  formatDateRange,
  formatLongDate,
  getCampPhase,
  initials,
  nowLocalStamp,
  courseWindowState,
  type CourseWindowState,
} from '../../utils/campUtils';
import {
  AdminPage,
  AdminPageHeader,
  Badge,
  Button,
  Card,
  CampFilterSelect,
  EmptyState,
  Field,
  FormSection,
  ImageInput,
  Modal,
  SearchInput,
  SelectInput,
  TextArea,
  TextInput,
  Toggle,
} from './ui';

type CourseForm = Omit<CampCourse, 'id' | 'enrolledCount'>;
type ScheduleFilter = 'ALL' | 'all_days' | 'single_day' | 'full_day';
type FormErrors = Partial<Record<'campId' | 'title' | 'date' | 'time' | 'maxCapacity' | 'ages' | 'enrollment', string>>;

const DEFAULT_CATEGORIES = [
  'Liderazgo y Discipulado',
  'Música y Alabanza',
  'Misiones y Evangelismo',
  'Arte y Creatividad',
  'Deporte y Recreación',
  'Familia y Valores',
];

const emptyForm = (camp?: Camp): CourseForm => ({
  campId: camp?.id || '',
  title: '',
  category: '',
  scheduleType: 'all_days',
  date: undefined,
  fullDay: false,
  startTime: '08:30',
  endTime: '10:30',
  location: '',
  instructor: '',
  instructorRole: '',
  instructorPhotoUrl: '',
  instructorBio: '',
  coverImageUrl: '',
  maxCapacity: 25,
  description: '',
  minAge: camp?.minAge ?? 12,
  maxAge: camp?.maxAge ?? 35,
  enrollmentOpensAt: '',
  enrollmentClosesAt: '',
});

/** "2026-10-20T08:00" → "20/10 08:00" */
const fmtWindow = (stamp?: string) => {
  if (!stamp) return '';
  const [date, time = ''] = stamp.split('T');
  const [, m, d] = date.split('-');
  return `${d}/${m}${time ? ` ${time.slice(0, 5)}` : ''}`;
};


const WINDOW_META: Record<CourseWindowState, { label: string; cls: string; icon: React.ElementType }> = {
  none: { label: 'Sin ventana', cls: 'bg-slate-50 text-slate-500 border-slate-200', icon: CalendarClock },
  soon: { label: 'Próximamente', cls: 'bg-violet-50 text-violet-700 border-violet-200', icon: Clock },
  open: { label: 'Abierto', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200', icon: DoorOpen },
  closed: { label: 'Cerrado', cls: 'bg-rose-50 text-rose-700 border-rose-200', icon: DoorClosed },
};

const enrollmentWindow = (c: Pick<CampCourse, 'enrollmentOpensAt' | 'enrollmentClosesAt'>, now = nowLocalStamp()) => {
  const opens = c.enrollmentOpensAt || '';
  const closes = c.enrollmentClosesAt || '';
  const state = courseWindowState(c, now);
  const parts = [opens && `abre ${fmtWindow(opens)}`, closes && `cierra ${fmtWindow(closes)}`].filter(Boolean);
  const detail = parts.length ? `Inscripción: ${parts.join(' · ')}` : 'Inscripción abierta mientras haya cupo';
  return { state, detail };
};

const WindowBadge: React.FC<{ course: Pick<CampCourse, 'enrollmentOpensAt' | 'enrollmentClosesAt'> }> = ({ course }) => {
  const { state, detail } = enrollmentWindow(course);
  const meta = WINDOW_META[state];
  const Icon = meta.icon;
  return (
    <span title={detail}>
      <Badge className={meta.cls}>
        <Icon className="w-3 h-3" /> {meta.label}
        {state === 'soon' && course.enrollmentOpensAt && <span className="font-mono font-semibold">· {fmtWindow(course.enrollmentOpensAt)}</span>}
        {state === 'open' && course.enrollmentClosesAt && (
          <span className="font-mono font-semibold">· hasta {fmtWindow(course.enrollmentClosesAt)}</span>
        )}
      </Badge>
    </span>
  );
};

const toForm = (c: CampCourse): CourseForm => {
  const { id: _id, enrolledCount: _count, ...rest } = c;
  return {
    ...rest,
    instructorRole: rest.instructorRole || '',
    instructorPhotoUrl: rest.instructorPhotoUrl || '',
    instructorBio: rest.instructorBio || '',
    coverImageUrl: rest.coverImageUrl || '',
    enrollmentOpensAt: rest.enrollmentOpensAt || '',
    enrollmentClosesAt: rest.enrollmentClosesAt || '',
  };
};

/** Ajusta la fecha de un taller de un solo día para que caiga dentro del campamento. */
const fitDateToCamp = (form: CourseForm, camp?: Camp): CourseForm => {
  if (form.scheduleType !== 'single_day') return { ...form, date: undefined };
  const days = campDays(camp);
  if (form.date && days.includes(form.date)) return form;
  return { ...form, date: days[0] };
};

export const CoursesManager: React.FC = () => {
  const {
    courses,
    camps,
    featuredCamp,
    catalogs,
    registrations,
    adminCampFilter,
    addCourse,
    updateCourse,
    deleteCourse,
    getCampById,
    getTribeById,
    setSelectedCamperForBadge,
  } = useCamp();
  const { confirm } = useConfirm();
  const { can } = useAuth();
  const canCreate = can('courses:create');
  const canUpdate = can('courses:update');
  const canDelete = can('courses:delete');
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [scheduleFilter, setScheduleFilter] = useState<ScheduleFilter>('ALL');

  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<CourseForm>(emptyForm());
  const [triedSave, setTriedSave] = useState(false);

  const [rosterCourse, setRosterCourse] = useState<CampCourse | null>(null);
  const [duplicating, setDuplicating] = useState<CampCourse | null>(null);
  const [duplicateTarget, setDuplicateTarget] = useState('');

  const filteredCamp = adminCampFilter !== 'ALL' ? getCampById(adminCampFilter) : undefined;
  const sortedCamps = useMemo(() => [...camps].sort((a, b) => a.startDate.localeCompare(b.startDate)), [camps]);

  const categories = useMemo(() => {
    const set = new Set(courses.map((c) => c.category).filter(Boolean));
    return [...set].sort((a, b) => a.localeCompare(b, 'es'));
  }, [courses]);

  const categorySuggestions = useMemo(
    () => [...new Set([...categories, ...DEFAULT_CATEGORIES])].sort((a, b) => a.localeCompare(b, 'es')),
    [categories]
  );

  const enrolledByCourse = useMemo(() => {
    const map: Record<string, CamperRegistration[]> = {};
    registrations.forEach((r) =>
      r.enrolledCourseIds.forEach((cid) => {
        (map[cid] ||= []).push(r);
      })
    );
    return map;
  }, [registrations]);

  const hasActiveFilters = search.trim() !== '' || categoryFilter !== 'ALL' || scheduleFilter !== 'ALL';

  const filteredCourses = useMemo(() => {
    const q = search.trim().toLowerCase();
    return courses
      .filter((c) => adminCampFilter === 'ALL' || c.campId === adminCampFilter)
      .filter(
        (c) =>
          !q ||
          c.title.toLowerCase().includes(q) ||
          c.instructor.toLowerCase().includes(q) ||
          c.location.toLowerCase().includes(q)
      )
      .filter((c) => categoryFilter === 'ALL' || c.category === categoryFilter)
      .filter((c) => {
        if (scheduleFilter === 'ALL') return true;
        if (scheduleFilter === 'full_day') return c.fullDay;
        return c.scheduleType === scheduleFilter;
      })
      .sort((a, b) => {
        const da = a.scheduleType === 'single_day' ? a.date || '' : '';
        const db = b.scheduleType === 'single_day' ? b.date || '' : '';
        if (da !== db) return da.localeCompare(db);
        const ta = a.fullDay ? '00:00' : a.startTime;
        const tb = b.fullDay ? '00:00' : b.startTime;
        return ta.localeCompare(tb) || a.title.localeCompare(b.title, 'es');
      });
  }, [courses, adminCampFilter, search, categoryFilter, scheduleFilter]);

  const groups = useMemo(() => {
    if (adminCampFilter !== 'ALL') return [];
    const result: { camp?: Camp; items: CampCourse[] }[] = sortedCamps
      .map((camp) => ({ camp, items: filteredCourses.filter((c) => c.campId === camp.id) }))
      .filter((g) => g.items.length > 0 || !hasActiveFilters);
    const orphans = filteredCourses.filter((c) => !camps.some((camp) => camp.id === c.campId));
    if (orphans.length > 0) result.push({ camp: undefined, items: orphans });
    return result;
  }, [adminCampFilter, sortedCamps, filteredCourses, hasActiveFilters, camps]);

  const campCourses = filteredCamp ? courses.filter((c) => c.campId === filteredCamp.id) : [];
  const campTotalSeats = campCourses.reduce((sum, c) => sum + c.maxCapacity, 0);
  const campTotalEnrolled = campCourses.reduce((sum, c) => sum + c.enrolledCount, 0);

  const campTypeColor = (camp?: Camp) => catalogs.campTypes.find((t) => t.id === camp?.typeId)?.colorHex || '#0284C7';

  // ── Formulario ──────────────────────────────────────
  const formCamp = getCampById(form.campId);
  const formDays = campDays(formCamp);

  const openCreate = (campId?: string) => {
    const camp = getCampById(campId) || filteredCamp || featuredCamp || sortedCamps[0];
    setEditingId(null);
    setForm(emptyForm(camp));
    setTriedSave(false);
    setFormOpen(true);
  };

  const openEdit = (course: CampCourse) => {
    setEditingId(course.id);
    setForm(toForm(course));
    setTriedSave(false);
    setFormOpen(true);
  };

  const closeForm = () => {
    if (saving) return;
    setFormOpen(false);
    setEditingId(null);
  };

  const patch = (updates: Partial<CourseForm>) => setForm((f) => ({ ...f, ...updates }));

  const changeCamp = (campId: string) => setForm((f) => fitDateToCamp({ ...f, campId }, getCampById(campId)));

  const changeScheduleType = (scheduleType: CourseScheduleType) =>
    setForm((f) => fitDateToCamp({ ...f, scheduleType }, getCampById(f.campId)));

  const validate = (): FormErrors => {
    const e: FormErrors = {};
    if (!formCamp) e.campId = 'Selecciona el campamento al que pertenece el taller.';
    if (!form.title.trim()) e.title = 'El título es obligatorio.';
    if (form.scheduleType === 'single_day') {
      if (!form.date) e.date = 'Selecciona el día del taller.';
      else if (!formDays.includes(form.date)) e.date = 'La fecha debe estar dentro de las fechas del campamento.';
    }
    if (!form.fullDay) {
      if (!form.startTime || !form.endTime) e.time = 'Indica la hora de inicio y de fin.';
      else if (form.endTime <= form.startTime) e.time = 'La hora de fin debe ser posterior a la hora de inicio.';
    }
    const editing = editingId ? courses.find((c) => c.id === editingId) : undefined;
    if (!form.maxCapacity || form.maxCapacity < 1) e.maxCapacity = 'El cupo debe ser de al menos 1 persona.';
    else if (editing && form.maxCapacity < editing.enrolledCount)
      e.maxCapacity = `Ya hay ${editing.enrolledCount} inscritos; el cupo no puede ser menor.`;
    if (Number.isNaN(form.minAge) || Number.isNaN(form.maxAge)) e.ages = 'Indica la edad mínima y la máxima.';
    else if (form.minAge > form.maxAge) e.ages = 'La edad mínima no puede ser mayor que la máxima.';
    if (form.enrollmentOpensAt && form.enrollmentClosesAt && form.enrollmentClosesAt <= form.enrollmentOpensAt)
      e.enrollment = 'El cierre debe ser posterior a la apertura.';
    return e;
  };

  const handleSave = async (ev?: React.FormEvent) => {
    ev?.preventDefault();
    if (saving || !(editingId ? canUpdate : canCreate)) return;
    setTriedSave(true);
    if (Object.keys(validate()).length > 0) return;

    const payload: CourseForm = {
      ...form,
      title: form.title.trim(),
      category: form.category.trim() || 'General',
      location: form.location.trim(),
      instructor: form.instructor.trim() || 'Por confirmar',
      date: form.scheduleType === 'single_day' ? form.date : undefined,
      // '' = sin límite (se envía vacío para poder quitar una ventana ya configurada)
      enrollmentOpensAt: form.enrollmentOpensAt || '',
      enrollmentClosesAt: form.enrollmentClosesAt || '',
    };

    setSaving(true);
    try {
      const saved = editingId ? await updateCourse(editingId, payload) : await addCourse(payload);
      if (!saved) return; // el aviso de error ya se mostró; el formulario queda abierto
      setFormOpen(false);
      setEditingId(null);
    } finally {
      setSaving(false);
    }
  };

  const canSaveForm = editingId ? canUpdate : canCreate;
  const errors: FormErrors = triedSave ? validate() : {};
  const errorCount = Object.keys(errors).length;
  const editingCourse = editingId ? courses.find((c) => c.id === editingId) : undefined;
  const previewEnrolled = editingCourse?.enrolledCount || 0;
  const previewCapacity = Number.isNaN(form.maxCapacity) ? 0 : form.maxCapacity;
  const previewPct = previewCapacity > 0 ? Math.min(100, (previewEnrolled / previewCapacity) * 100) : 0;
  const previewSchedule = formatCourseSchedule({ ...form, id: 'preview', enrolledCount: previewEnrolled });

  // ── Acciones ────────────────────────────────────────
  const handleDelete = async (course: CampCourse) => {
    const enrolledList = enrolledByCourse[course.id] || [];
    const enrolled = enrolledList.length;
    const camp = getCampById(course.campId);
    const ok = await confirm({
      tone: 'danger',
      title: `¿Eliminar el taller «${course.title}»?`,
      message: enrolled
        ? 'Los jóvenes inscritos quedarán sin este taller y podrán elegir otro desde su inscripción.'
        : 'El taller dejará de mostrarse en el catálogo y en la inscripción.',
      details: [
        `${camp?.name || 'Sin campamento'} · ${formatCourseSchedule(course)}`,
        enrolled > 0
          ? `${enrolled} ${enrolled === 1 ? 'joven inscrito perderá' : 'jóvenes inscritos perderán'} este taller`
          : 'No tiene jóvenes inscritos',
        `Se liberarán ${course.maxCapacity} ${course.maxCapacity === 1 ? 'cupo' : 'cupos'} de la programación del campamento`,
        'Esta acción no se puede deshacer.',
      ],
      confirmText: 'Sí, eliminar taller',
    });
    if (!ok) return;
    // El servidor quita el taller de las inscripciones afectadas
    setDeletingId(course.id);
    try {
      await deleteCourse(course.id);
    } finally {
      setDeletingId(null);
    }
  };

  const openDuplicate = (course: CampCourse) => {
    setDuplicating(course);
    setDuplicateTarget(course.campId);
  };

  const [duplicatingBusy, setDuplicatingBusy] = useState(false);
  const confirmDuplicate = async () => {
    if (!duplicating || duplicatingBusy || !canCreate) return;
    const target = getCampById(duplicateTarget);
    if (!target) return;
    const base = toForm(duplicating);
    const sameCamp = target.id === duplicating.campId;
    setDuplicatingBusy(true);
    try {
      const created = await addCourse(
        fitDateToCamp(
          { ...base, campId: target.id, title: sameCamp ? `${duplicating.title} (copia)` : duplicating.title },
          target
        )
      );
      if (created) setDuplicating(null);
    } finally {
      setDuplicatingBusy(false);
    }
  };

  const openBadge = (r: CamperRegistration) => {
    setRosterCourse(null);
    setSelectedCamperForBadge(r);
  };

  // ── Render ──────────────────────────────────────────
  const renderCourse = (course: CampCourse, showCamp: boolean) => {
    const camp = getCampById(course.campId);
    const enrolled = enrolledByCourse[course.id]?.length || 0;
    const pct = course.maxCapacity > 0 ? Math.min(100, (course.enrolledCount / course.maxCapacity) * 100) : 0;
    const full = course.enrolledCount >= course.maxCapacity;
    return (
      <Card key={course.id} className="p-3 sm:p-4 hover:shadow-md hover:border-sky-100 transition-all">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="w-full sm:w-36 h-36 sm:h-24 rounded-2xl overflow-hidden bg-sky-50 shrink-0 relative">
            {course.coverImageUrl ? (
              <img src={course.coverImageUrl} alt="" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-sky-300">
                <BookOpen className="w-8 h-8" />
              </div>
            )}
            {course.fullDay && (
              <span className="absolute top-2 left-2 inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-400 text-amber-950 text-[9px] font-black uppercase tracking-wide">
                <Sun className="w-3 h-3" /> Todo el día
              </span>
            )}
          </div>

          <div className="flex-1 min-w-0 space-y-2">
            <div className="flex flex-wrap items-center gap-1.5">
              <Badge className="bg-sky-50 text-sky-700 border-sky-200">{course.category || 'General'}</Badge>
              {showCamp && camp && (
                <Badge color={campTypeColor(camp)}>
                  <Tent className="w-3 h-3" /> {camp.name}
                </Badge>
              )}
              <Badge className="bg-slate-50 text-slate-500 border-slate-200">
                {course.minAge}–{course.maxAge} años
              </Badge>
              <WindowBadge course={course} />
            </div>
            <h4 className="text-sm sm:text-base font-black text-slate-900 leading-snug">{course.title}</h4>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-6 gap-y-1.5 text-xs text-slate-600">
              <span className="flex items-center gap-1.5 min-w-0">
                {course.scheduleType === 'single_day' ? (
                  <CalendarDays className="w-3.5 h-3.5 text-[#0284C7] shrink-0" />
                ) : (
                  <CalendarRange className="w-3.5 h-3.5 text-[#0284C7] shrink-0" />
                )}
                <span className="truncate font-semibold">{formatCourseSchedule(course)}</span>
              </span>
              <span className="flex items-center gap-1.5 min-w-0">
                <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                <span className="truncate">{course.location || 'Lugar por definir'}</span>
              </span>
              <span className="flex items-center gap-2 min-w-0">
                {course.instructorPhotoUrl ? (
                  <img src={course.instructorPhotoUrl} alt="" className="w-6 h-6 rounded-full object-cover shrink-0" />
                ) : (
                  <span className="w-6 h-6 rounded-full bg-sky-100 text-sky-700 text-[9px] font-black flex items-center justify-center shrink-0">
                    {initials(course.instructor) || '?'}
                  </span>
                )}
                <span className="truncate">
                  <span className="font-bold text-slate-800">{course.instructor}</span>
                  {course.instructorRole && <span className="text-slate-400"> · {course.instructorRole}</span>}
                </span>
              </span>
              <span className="flex items-center gap-2 text-[11px] text-slate-400">
                <Users className="w-3.5 h-3.5 shrink-0" />
                <span className="font-mono tabular-nums">
                  {course.enrolledCount}/{course.maxCapacity} cupos
                </span>
                <span className="w-16 h-1 rounded-full bg-slate-100 overflow-hidden">
                  <span
                    className={`block h-full ${full ? 'bg-amber-400' : 'bg-sky-300'}`}
                    style={{ width: `${pct}%` }}
                  />
                </span>
                {full && <span className="text-amber-600 font-bold">Lleno</span>}
              </span>
            </div>
          </div>

          <div className="flex sm:flex-col flex-wrap gap-1.5 sm:w-32 shrink-0 sm:justify-center">
            <Button variant="secondary" size="sm" icon={Users} onClick={() => setRosterCourse(course)} className="flex-1 sm:flex-none">
              Inscritos ({enrolled})
            </Button>
            <Button variant="secondary" size="sm" icon={canUpdate ? Edit3 : Eye} onClick={() => openEdit(course)} className="flex-1 sm:flex-none">
              {canUpdate ? 'Editar' : 'Ver'}
            </Button>
            {canCreate && (
              <Button variant="ghost" size="sm" icon={Copy} onClick={() => openDuplicate(course)} className="flex-1 sm:flex-none">
                Duplicar
              </Button>
            )}
            {canDelete && (
              <Button
                variant="danger"
                size="sm"
                icon={deletingId === course.id ? Loader2 : Trash2}
                disabled={!!deletingId}
                onClick={() => handleDelete(course)}
                className={`flex-1 sm:flex-none ${deletingId === course.id ? '[&>svg]:animate-spin' : ''}`}
              >
                {deletingId === course.id ? 'Eliminando…' : 'Eliminar'}
              </Button>
            )}
          </div>
        </div>
      </Card>
    );
  };

  const rosterList = rosterCourse ? enrolledByCourse[rosterCourse.id] || [] : [];
  const duplicateCamp = getCampById(duplicateTarget);

  return (
    <AdminPage>
      <AdminPageHeader
        kicker="Talleres"
        title="Talleres por campamento"
        description="Cada taller pertenece a un campamento. Define si se dicta todos los días o un solo día, su horario y su facilitador."
        icon={BookOpen}
        actions={
          <>
            {!canCreate && !canUpdate && !canDelete && (
              <Badge className="bg-slate-100 text-slate-600 border-slate-200">
                <Lock className="w-3 h-3" /> Solo lectura
              </Badge>
            )}
            <CampFilterSelect className="w-full sm:w-72" />
            {canCreate && (
              <Button icon={Plus} onClick={() => openCreate()} disabled={camps.length === 0}>
                Nuevo taller
              </Button>
            )}
          </>
        }
      />

      {filteredCamp && (
        <Card className="p-3 sm:p-4">
          <div className="flex flex-col sm:flex-row sm:items-center gap-4">
            <div className="flex items-center gap-3 min-w-0 flex-1">
              <div className="w-16 h-16 sm:w-20 sm:h-16 rounded-2xl overflow-hidden bg-sky-50 shrink-0">
                {filteredCamp.imageUrl ? (
                  <img src={filteredCamp.imageUrl} alt="" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-sky-300">
                    <Tent className="w-6 h-6" />
                  </div>
                )}
              </div>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-1.5">
                  <h3 className="text-sm sm:text-base font-black text-slate-900 truncate">{filteredCamp.name}</h3>
                  <Badge className={PHASE_META[getCampPhase(filteredCamp)].className}>
                    <span className={`w-1.5 h-1.5 rounded-full ${PHASE_META[getCampPhase(filteredCamp)].dot}`} />
                    {PHASE_META[getCampPhase(filteredCamp)].label}
                  </Badge>
                </div>
                <p className="text-xs text-slate-500 mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5">
                  <span className="flex items-center gap-1">
                    <CalendarRange className="w-3.5 h-3.5" /> {formatDateRange(filteredCamp.startDate, filteredCamp.endDate)}
                  </span>
                  <span className="flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5" /> {filteredCamp.location}
                  </span>
                </p>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2 sm:flex sm:gap-3 shrink-0">
              {[
                { label: 'Talleres', value: campCourses.length },
                { label: 'Cupos totales', value: campTotalSeats },
                { label: 'Ocupados', value: campTotalEnrolled },
              ].map((s) => (
                <div key={s.label} className="px-3 py-2 rounded-2xl bg-sky-50 text-center sm:min-w-24">
                  <div className="text-lg font-black text-[#0284C7] font-mono tabular-nums">{s.value}</div>
                  <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{s.label}</div>
                </div>
              ))}
            </div>
          </div>
        </Card>
      )}

      <Card className="p-3 sm:p-4">
        <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_auto] gap-2">
          <SearchInput value={search} onChange={setSearch} placeholder="Buscar por título, facilitador o lugar…" />
          <SelectInput
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="py-2 text-xs md:w-56"
          >
            <option value="ALL">Todas las categorías</option>
            {categories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </SelectInput>
          <SelectInput
            value={scheduleFilter}
            onChange={(e) => setScheduleFilter(e.target.value as ScheduleFilter)}
            className="py-2 text-xs md:w-52"
          >
            <option value="ALL">Cualquier programación</option>
            <option value="all_days">Todos los días</option>
            <option value="single_day">Un solo día</option>
            <option value="full_day">Jornada completa</option>
          </SelectInput>
        </div>
        <div className="mt-2 flex items-center justify-between text-[11px] text-slate-500">
          <span>
            {filteredCourses.length} taller{filteredCourses.length === 1 ? '' : 'es'}
            {hasActiveFilters ? ' con los filtros aplicados' : ''}
          </span>
          {hasActiveFilters && (
            <button
              type="button"
              className="font-bold text-[#0284C7] hover:underline cursor-pointer"
              onClick={() => {
                setSearch('');
                setCategoryFilter('ALL');
                setScheduleFilter('ALL');
              }}
            >
              Limpiar filtros
            </button>
          )}
        </div>
      </Card>

      {adminCampFilter !== 'ALL' ? (
        filteredCourses.length > 0 ? (
          <div className="space-y-3">{filteredCourses.map((c) => renderCourse(c, false))}</div>
        ) : (
          <Card>
            <EmptyState
              icon={BookOpen}
              title={hasActiveFilters ? 'Ningún taller coincide con los filtros' : 'Este campamento aún no tiene talleres'}
              description={
                hasActiveFilters
                  ? 'Prueba con otra búsqueda o limpia los filtros.'
                  : 'Crea el primer taller para que los jóvenes puedan elegirlo al inscribirse.'
              }
              action={
                !hasActiveFilters &&
                canCreate && (
                  <Button icon={Plus} onClick={() => openCreate(adminCampFilter)}>
                    Nuevo taller
                  </Button>
                )
              }
            />
          </Card>
        )
      ) : groups.length > 0 ? (
        <div className="space-y-8">
          {groups.map(({ camp, items }) => {
            const phase = camp ? PHASE_META[getCampPhase(camp)] : null;
            return (
              <section key={camp?.id || 'sin-campamento'} className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-slate-100">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span
                      className="w-2.5 h-8 rounded-full shrink-0"
                      style={{ backgroundColor: camp ? campTypeColor(camp) : '#94A3B8' }}
                    />
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <h3 className="text-sm sm:text-base font-black text-slate-900 truncate">
                          {camp ? camp.name : 'Sin campamento asignado'}
                        </h3>
                        {phase && (
                          <Badge className={phase.className}>
                            <span className={`w-1.5 h-1.5 rounded-full ${phase.dot}`} />
                            {phase.label}
                          </Badge>
                        )}
                      </div>
                      {camp && (
                        <p className="text-[11px] text-slate-500">
                          {formatDateRange(camp.startDate, camp.endDate)} · {camp.location} · {items.length} taller
                          {items.length === 1 ? '' : 'es'}
                        </p>
                      )}
                    </div>
                  </div>
                  {camp && canCreate && (
                    <Button variant="ghost" size="sm" icon={Plus} onClick={() => openCreate(camp.id)}>
                      Agregar taller
                    </Button>
                  )}
                </div>
                {items.length > 0 ? (
                  <div className="space-y-3">{items.map((c) => renderCourse(c, true))}</div>
                ) : (
                  <p className="text-xs text-slate-400 px-1">Todavía no hay talleres en este campamento.</p>
                )}
              </section>
            );
          })}
        </div>
      ) : (
        <Card>
          <EmptyState
            icon={BookOpen}
            title={hasActiveFilters ? 'Ningún taller coincide con los filtros' : 'No hay talleres registrados'}
            description={
              hasActiveFilters ? 'Prueba con otra búsqueda o limpia los filtros.' : 'Crea un campamento y luego agrega sus talleres.'
            }
          />
        </Card>
      )}

      {/* ── Crear / editar taller ── */}
      <Modal
        open={formOpen}
        onClose={closeForm}
        size="xl"
        icon={editingId ? Edit3 : BookOpen}
        title={editingId ? 'Editar taller' : 'Nuevo taller'}
        subtitle={
          editingCourse
            ? `Editando · ${editingCourse.title}${formCamp ? ` · ${formCamp.name}` : ''}`
            : formCamp
              ? `Nuevo taller para ${formCamp.name} · ${formatDateRange(formCamp.startDate, formCamp.endDate)}`
              : 'Selecciona el campamento al que pertenece el taller.'
        }
        footer={
          <>
            {!canSaveForm && (
              <span className="flex items-center justify-center sm:justify-start gap-1.5 text-[11px] font-bold text-slate-500 sm:mr-auto">
                <Lock className="w-3.5 h-3.5" /> Solo lectura
              </span>
            )}
            <Button variant="ghost" onClick={closeForm} disabled={saving}>
              {canSaveForm ? 'Cancelar' : 'Cerrar'}
            </Button>
            {canSaveForm && (
              <Button
                icon={saving ? Loader2 : editingId ? CheckCircle2 : Plus}
                onClick={() => handleSave()}
                disabled={saving}
                className={saving ? '[&>svg]:animate-spin' : ''}
              >
                {saving ? 'Guardando…' : editingId ? 'Guardar cambios' : 'Crear taller'}
              </Button>
            )}
          </>
        }
      >
        <form onSubmit={handleSave} noValidate className="contents">
        <fieldset disabled={!canSaveForm || saving} className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_250px] gap-5 border-0 p-0 m-0 min-w-0">
          <div className="space-y-4 min-w-0">
            {errorCount > 0 && (
              <div className="flex items-start gap-2 p-3 rounded-2xl bg-red-50 border border-red-200 text-xs text-red-700 font-semibold">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                Hay {errorCount} {errorCount === 1 ? 'campo por corregir' : 'campos por corregir'} antes de guardar.
              </div>
            )}

            <FormSection
              title="Campamento y programación"
              description="A qué campamento pertenece, qué días se dicta y en qué horario."
              icon={CalendarRange}
            >
              <Field label="Campamento" required error={errors.campId}>
                <SelectInput value={form.campId} onChange={(e) => changeCamp(e.target.value)}>
                  <option value="">Selecciona un campamento…</option>
                  {form.campId && !formCamp && <option value={form.campId}>Campamento eliminado</option>}
                  {sortedCamps.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.isFeatured ? '★ ' : ''}
                      {c.name} · {formatDateRange(c.startDate, c.endDate)}
                    </option>
                  ))}
                </SelectInput>
              </Field>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {(
                  [
                    {
                      value: 'all_days',
                      icon: CalendarRange,
                      title: 'Todos los días',
                      hint: formCamp
                        ? `Del ${formatLongDate(formCamp.startDate)} al ${formatLongDate(formCamp.endDate)}`
                        : 'Se repite cada día del campamento',
                    },
                    {
                      value: 'single_day',
                      icon: CalendarDays,
                      title: 'Un solo día',
                      hint: 'Se dicta en una fecha específica',
                    },
                  ] as const
                ).map((opt) => {
                  const active = form.scheduleType === opt.value;
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => changeScheduleType(opt.value)}
                      aria-pressed={active}
                      className={`flex items-start gap-3 p-3.5 rounded-2xl border-2 text-left transition-all cursor-pointer ${
                        active ? 'border-[#0284C7] bg-sky-50 shadow-sm' : 'border-slate-200 bg-white hover:border-sky-200'
                      }`}
                    >
                      <span
                        className={`mt-0.5 w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${
                          active ? 'border-[#0284C7]' : 'border-slate-300'
                        }`}
                      >
                        {active && <span className="w-2 h-2 rounded-full bg-[#0284C7]" />}
                      </span>
                      <span className="min-w-0">
                        <span className="flex items-center gap-1.5 text-sm font-black text-slate-900">
                          <opt.icon className={`w-4 h-4 ${active ? 'text-[#0284C7]' : 'text-slate-400'}`} />
                          {opt.title}
                        </span>
                        <span className="block text-[11px] text-slate-500 mt-0.5">{opt.hint}</span>
                      </span>
                    </button>
                  );
                })}
              </div>

              {form.scheduleType === 'single_day' && (
                <Field label="Día del taller" required error={errors.date}>
                  <SelectInput value={form.date || ''} onChange={(e) => patch({ date: e.target.value })}>
                    {formDays.length === 0 && <option value="">Primero selecciona un campamento</option>}
                    {form.date && !formDays.includes(form.date) && (
                      <option value={form.date}>{formatLongDate(form.date)} (fuera del campamento)</option>
                    )}
                    {formDays.map((d, i) => (
                      <option key={d} value={d}>
                        Día {i + 1} · {formatLongDate(d)}
                      </option>
                    ))}
                  </SelectInput>
                </Field>
              )}

              <Toggle
                checked={form.fullDay}
                onChange={(v) => patch({ fullDay: v })}
                label="Jornada completa (todo el día)"
                hint="El taller ocupa toda la jornada; no se indica horario."
              />

              {!form.fullDay && (
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Hora de inicio" required error={errors.time}>
                    <TextInput type="time" value={form.startTime} onChange={(e) => patch({ startTime: e.target.value })} />
                  </Field>
                  <Field label="Hora de fin" required>
                    <TextInput type="time" value={form.endTime} onChange={(e) => patch({ endTime: e.target.value })} />
                  </Field>
                </div>
              )}

              <Field label="Lugar" hint="Ambiente o espacio del campamento donde se dicta.">
                <TextInput
                  value={form.location}
                  placeholder="Ej. Auditorio central"
                  onChange={(e) => patch({ location: e.target.value })}
                />
              </Field>
            </FormSection>

            <FormSection
              title="Contenido e imagen"
              description="Lo que verán los jóvenes en el catálogo al elegir su taller."
              icon={ImageIcon}
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Field label="Título" required error={errors.title} className="sm:col-span-2">
                  <TextInput
                    value={form.title}
                    placeholder="Ej. Liderazgo juvenil y carácter cristiano"
                    onChange={(e) => patch({ title: e.target.value })}
                  />
                </Field>
                <Field label="Categoría" hint="Escribe una nueva o elige una sugerencia." className="sm:col-span-2">
                  <TextInput
                    list="course-category-options"
                    value={form.category}
                    placeholder="Ej. Liderazgo y Discipulado"
                    onChange={(e) => patch({ category: e.target.value })}
                  />
                  <datalist id="course-category-options">
                    {categorySuggestions.map((c) => (
                      <option key={c} value={c} />
                    ))}
                  </datalist>
                </Field>
                <Field label="Descripción" className="sm:col-span-2">
                  <TextArea
                    value={form.description}
                    placeholder="¿Qué aprenderán los jóvenes en este taller?"
                    onChange={(e) => patch({ description: e.target.value })}
                  />
                </Field>
              </div>
              <div className="space-y-1">
                <span className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider">Imagen de portada</span>
                <ImageInput value={form.coverImageUrl || ''} onChange={(v) => patch({ coverImageUrl: v })} />
              </div>
            </FormSection>

            <FormSection title="Facilitador" description="Quién dicta el taller. Si aún no se sabe, déjalo en blanco." icon={UserRound}>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Field label="Nombre del facilitador" hint="Si lo dejas vacío se mostrará «Por confirmar».">
                  <TextInput
                    value={form.instructor}
                    placeholder="Ej. Pr. Marcos Andrade"
                    onChange={(e) => patch({ instructor: e.target.value })}
                  />
                </Field>
                <Field label="Rol del facilitador">
                  <TextInput
                    value={form.instructorRole || ''}
                    placeholder="Ej. Pastor de jóvenes"
                    onChange={(e) => patch({ instructorRole: e.target.value })}
                  />
                </Field>
                <Field label="Biografía" className="sm:col-span-2">
                  <TextArea
                    rows={2}
                    value={form.instructorBio || ''}
                    placeholder="Breve presentación del facilitador"
                    onChange={(e) => patch({ instructorBio: e.target.value })}
                  />
                </Field>
              </div>
              <div className="space-y-1">
                <span className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider">Foto del facilitador</span>
                <ImageInput
                  aspect="square"
                  value={form.instructorPhotoUrl || ''}
                  onChange={(v) => patch({ instructorPhotoUrl: v })}
                />
              </div>
            </FormSection>

            <FormSection title="Cupos y edades" description="Límite de participantes y rango de edad permitido." icon={Users}>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <Field
                  label="Cupo máximo"
                  required
                  error={errors.maxCapacity}
                  hint={editingCourse ? `${editingCourse.enrolledCount} inscritos actualmente` : undefined}
                >
                  <TextInput
                    type="number"
                    min={editingCourse?.enrolledCount || 1}
                    value={Number.isNaN(form.maxCapacity) ? '' : form.maxCapacity}
                    onChange={(e) => patch({ maxCapacity: e.target.value === '' ? NaN : Number(e.target.value) })}
                  />
                </Field>
                <Field label="Edad mínima" required error={errors.ages}>
                  <TextInput
                    type="number"
                    min={0}
                    value={Number.isNaN(form.minAge) ? '' : form.minAge}
                    onChange={(e) => patch({ minAge: e.target.value === '' ? NaN : Number(e.target.value) })}
                  />
                </Field>
                <Field label="Edad máxima" required>
                  <TextInput
                    type="number"
                    min={0}
                    value={Number.isNaN(form.maxAge) ? '' : form.maxAge}
                    onChange={(e) => patch({ maxAge: e.target.value === '' ? NaN : Number(e.target.value) })}
                  />
                </Field>
              </div>
              {formCamp && (
                <p className="text-[11px] text-slate-500">
                  El campamento admite de {formCamp.minAge} a {formCamp.maxAge} años y hasta{' '}
                  {formCamp.maxCoursesPerCamper} {formCamp.maxCoursesPerCamper === 1 ? 'taller' : 'talleres'} por joven.
                </p>
              )}
            </FormSection>

            <FormSection
              title="Ventana de inscripción"
              description="Los jóvenes con pago confirmado se inscriben solos dentro de esta ventana; vacío = abierto mientras haya cupo."
              icon={CalendarClock}
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Field label="Abre" hint="Opcional">
                  <TextInput
                    type="datetime-local"
                    value={form.enrollmentOpensAt || ''}
                    max={form.enrollmentClosesAt || undefined}
                    onChange={(e) => patch({ enrollmentOpensAt: e.target.value })}
                  />
                </Field>
                <Field label="Cierra" hint="Opcional" error={errors.enrollment}>
                  <TextInput
                    type="datetime-local"
                    value={form.enrollmentClosesAt || ''}
                    min={form.enrollmentOpensAt || undefined}
                    onChange={(e) => patch({ enrollmentClosesAt: e.target.value })}
                  />
                </Field>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <WindowBadge course={form} />
                <span className="text-[11px] text-slate-500">{enrollmentWindow(form).detail}.</span>
                {(form.enrollmentOpensAt || form.enrollmentClosesAt) && (
                  <button
                    type="button"
                    onClick={() => patch({ enrollmentOpensAt: '', enrollmentClosesAt: '' })}
                    className="text-[11px] font-bold text-[#0284C7] hover:underline cursor-pointer"
                  >
                    Quitar ventana
                  </button>
                )}
              </div>
            </FormSection>
          </div>

          {/* Vista previa en vivo */}
          <aside className="lg:sticky lg:top-0 self-start space-y-2">
            <p className="text-[11px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-1.5">
              <Eye className="w-3.5 h-3.5" /> Vista previa
            </p>
            <div className="rounded-3xl border border-slate-100 bg-white shadow-md overflow-hidden">
              <div className="relative h-32 bg-gradient-to-br from-sky-100 to-sky-50">
                {form.coverImageUrl ? (
                  <img src={form.coverImageUrl} alt="" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-sky-300">
                    <BookOpen className="w-9 h-9" />
                  </div>
                )}
                <span className="absolute top-2 left-2 px-2 py-0.5 rounded-full bg-white/95 text-sky-700 text-[9px] font-black uppercase tracking-wide shadow-sm max-w-[85%] truncate">
                  {form.category.trim() || 'General'}
                </span>
                {form.fullDay && (
                  <span className="absolute bottom-2 left-2 inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-400 text-amber-950 text-[9px] font-black uppercase">
                    <Sun className="w-3 h-3" /> Todo el día
                  </span>
                )}
              </div>
              <div className="p-3.5 space-y-2.5">
                <h4 className="text-sm font-black text-slate-900 leading-snug break-words">
                  {form.title.trim() || 'Título del taller'}
                </h4>
                <div className="space-y-1 text-[11px] text-slate-600">
                  <p className="flex items-start gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-[#0284C7] shrink-0 mt-px" />
                    <span>{previewSchedule}</span>
                  </p>
                  <p className="flex items-start gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-px" />
                    <span>{form.location.trim() || 'Lugar por definir'}</span>
                  </p>
                  <p className="flex items-start gap-1.5">
                    <Users className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-px" />
                    <span>
                      {Number.isNaN(form.minAge) ? '?' : form.minAge}–{Number.isNaN(form.maxAge) ? '?' : form.maxAge} años
                    </span>
                  </p>
                </div>
                {form.description.trim() && (
                  <p className="text-[11px] text-slate-500 line-clamp-3">{form.description.trim()}</p>
                )}
                <div className="flex items-center gap-2 pt-2.5 border-t border-slate-100">
                  {form.instructorPhotoUrl ? (
                    <img src={form.instructorPhotoUrl} alt="" className="w-8 h-8 rounded-full object-cover shrink-0" />
                  ) : (
                    <span className="w-8 h-8 rounded-full bg-sky-100 text-sky-700 text-[10px] font-black flex items-center justify-center shrink-0">
                      {initials(form.instructor.trim() || 'Por confirmar') || '?'}
                    </span>
                  )}
                  <span className="min-w-0">
                    <span className="block text-[11px] font-bold text-slate-800 truncate">
                      {form.instructor.trim() || 'Por confirmar'}
                    </span>
                    {form.instructorRole && (
                      <span className="block text-[10px] text-slate-400 truncate">{form.instructorRole}</span>
                    )}
                  </span>
                </div>
                <div>
                  <div className="flex justify-between text-[10px] font-bold text-slate-500">
                    <span>Cupos</span>
                    <span className="font-mono tabular-nums">
                      {previewEnrolled}/{Number.isNaN(form.maxCapacity) ? 0 : form.maxCapacity}
                    </span>
                  </div>
                  <div className="mt-1 h-1.5 rounded-full bg-slate-100 overflow-hidden">
                    <div className="h-full rounded-full bg-[#0284C7]" style={{ width: `${previewPct}%` }} />
                  </div>
                </div>
              </div>
            </div>
            <p className="text-[10px] text-slate-400">Así se verá la tarjeta del taller en el catálogo.</p>
          </aside>
          <button type="submit" className="hidden" aria-hidden="true" />
        </fieldset>
        </form>
      </Modal>

      {/* ── Inscritos del taller ── */}
      <Modal
        open={!!rosterCourse}
        onClose={() => setRosterCourse(null)}
        icon={Users}
        title={rosterCourse ? `Inscritos · ${rosterCourse.title}` : 'Inscritos'}
        subtitle={
          rosterCourse
            ? `${getCampById(rosterCourse.campId)?.name || 'Sin campamento'} · ${formatCourseSchedule(rosterCourse)}`
            : undefined
        }
      >
        {rosterList.length === 0 ? (
          <EmptyState icon={Users} title="Aún no hay inscritos" description="Los jóvenes aparecerán aquí al elegir este taller." />
        ) : (
          <ul className="divide-y divide-slate-100">
            {rosterList.map((r) => {
              const tribe = getTribeById(r.tribeId);
              return (
                <li key={r.id} className="flex items-center gap-3 py-2.5">
                  <span
                    className="w-9 h-9 rounded-full text-white text-xs font-black flex items-center justify-center shrink-0"
                    style={{ backgroundColor: tribe?.colorHex || '#0284C7' }}
                  >
                    {initials(r.fullName)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold text-slate-900 truncate">{r.fullName}</p>
                    <p className="text-[11px] text-slate-500 truncate">
                      <span className="font-mono">{r.ticketCode}</span> · {r.regional}
                      {tribe ? ` · ${tribe.name}` : ''}
                    </p>
                  </div>
                  <Button variant="secondary" size="sm" icon={IdCard} onClick={() => openBadge(r)}>
                    <span className="hidden sm:inline">Ver credencial</span>
                  </Button>
                </li>
              );
            })}
          </ul>
        )}
      </Modal>

      {/* ── Duplicar taller ── */}
      <Modal
        open={!!duplicating}
        onClose={() => setDuplicating(null)}
        size="md"
        icon={Copy}
        title="Duplicar taller"
        subtitle={duplicating ? `Copiando · ${duplicating.title}` : undefined}
        footer={
          <>
            <Button variant="ghost" onClick={() => setDuplicating(null)} disabled={duplicatingBusy}>
              Cancelar
            </Button>
            <Button
              icon={duplicatingBusy ? Loader2 : Copy}
              onClick={confirmDuplicate}
              disabled={!duplicateCamp || duplicatingBusy}
              className={duplicatingBusy ? '[&>svg]:animate-spin' : ''}
            >
              {duplicatingBusy ? 'Duplicando…' : 'Duplicar'}
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <Field label="Campamento de destino" required>
            <SelectInput value={duplicateTarget} onChange={(e) => setDuplicateTarget(e.target.value)}>
              {sortedCamps.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.id === duplicating?.campId ? '(mismo) ' : ''}
                  {c.name} · {formatDateRange(c.startDate, c.endDate)}
                </option>
              ))}
            </SelectInput>
          </Field>
          <p className="text-xs text-slate-500">
            Se creará una copia con los mismos datos y sin inscritos.
            {duplicating?.scheduleType === 'single_day' &&
              duplicateCamp &&
              duplicating.date &&
              !campDays(duplicateCamp).includes(duplicating.date) &&
              ` Como la fecha original no está dentro de este campamento, se asignará al ${formatLongDate(
                campDays(duplicateCamp)[0]
              )}.`}
          </p>
        </div>
      </Modal>
    </AdminPage>
  );
};
