import React, { useMemo, useState } from 'react';
import {
  AlertCircle,
  BookOpen,
  CalendarDays,
  CheckCircle2,
  Copy,
  Edit2,
  Eye,
  Gift,
  ImageIcon,
  Info,
  Loader2,
  Lock,
  MapPin,
  Plus,
  PlayCircle,
  Star,
  Tent,
  Trash2,
  Users,
  Wallet,
  X,
} from 'lucide-react';
import { useCamp } from '../../context/CampContext';
import { Camp, CampPhase, CampStatus } from '../../types/camp';
import { PHASE_META, campDurationDays, formatDateRange, getCampPhase, nowStamp, uid, formatBs, plural } from '../../utils/campUtils';
import { useConfirm } from '../common/ConfirmDialog';
import { useAuth } from '../../context/AuthContext';
import {
  AdminPage,
  AdminPageHeader,
  Badge,
  Button,
  Card,
  EmptyState,
  Field,
  FormSection,
  ImageInput,
  Modal,
  SearchInput,
  SelectInput,
  StatCard,
  TextArea,
  TextInput,
  Toggle,
} from './ui';

const STATUS_OPTIONS: { value: CampStatus; label: string }[] = [
  { value: 'borrador', label: 'Borrador (no visible al público)' },
  { value: 'abierto', label: 'Abierto (inscripciones abiertas)' },
  { value: 'cerrado', label: 'Cerrado (inscripciones cerradas)' },
];

const PHASE_FILTERS: CampPhase[] = ['borrador', 'abierto', 'cerrado', 'en_curso', 'finalizado'];

const FALLBACK_COLOR = '#0284C7';

interface CampForm {
  id: string;
  name: string;
  typeId: string;
  theme: string;
  verse: string;
  description: string;
  price: string;
  groupPrice: string;
  cashAdvancePercent: string;
  startDate: string;
  endDate: string;
  location: string;
  cityId: string;
  imageUrl: string;
  capacity: string;
  minAge: string;
  maxAge: string;
  maxCoursesPerCamper: string;
  includes: string[];
  status: CampStatus;
  isFeatured: boolean;
  createdAt: string;
}

type FormErrors = Partial<Record<keyof CampForm, string>>;

const toForm = (camp: Camp): CampForm => ({
  id: camp.id,
  name: camp.name || '',
  typeId: camp.typeId || '',
  theme: camp.theme || '',
  verse: camp.verse || '',
  description: camp.description || '',
  price: camp.price !== undefined && camp.price !== null ? String(camp.price) : '',
  groupPrice: camp.groupPrice !== undefined && camp.groupPrice !== null ? String(camp.groupPrice) : '',
  cashAdvancePercent:
    camp.cashAdvancePercent !== undefined && camp.cashAdvancePercent !== null ? String(camp.cashAdvancePercent) : '',
  startDate: camp.startDate || '',
  endDate: camp.endDate || '',
  location: camp.location || '',
  cityId: camp.cityId || '',
  imageUrl: camp.imageUrl || '',
  capacity: camp.capacity !== undefined && camp.capacity !== null ? String(camp.capacity) : '',
  minAge: camp.minAge !== undefined && camp.minAge !== null ? String(camp.minAge) : '',
  maxAge: camp.maxAge !== undefined && camp.maxAge !== null ? String(camp.maxAge) : '',
  maxCoursesPerCamper:
    camp.maxCoursesPerCamper !== undefined && camp.maxCoursesPerCamper !== null ? String(camp.maxCoursesPerCamper) : '',
  includes: [...(camp.includes || [])],
  status: camp.status || 'borrador',
  isFeatured: !!camp.isFeatured,
  createdAt: camp.createdAt || '',
});

const emptyForm = (typeId: string): CampForm => ({
  id: '',
  name: '',
  typeId,
  theme: '',
  verse: '',
  description: '',
  price: '',
  groupPrice: '',
  cashAdvancePercent: '30',
  startDate: '',
  endDate: '',
  location: '',
  cityId: '',
  imageUrl: '',
  capacity: '300',
  minAge: '12',
  maxAge: '35',
  maxCoursesPerCamper: '2',
  includes: ['Hospedaje', 'Alimentación completa', 'Talleres', 'Kit del campista', 'Credencial QR'],
  status: 'borrador',
  isFeatured: false,
  createdAt: '',
});

const num = (v: string, fallback = 0) => {
  const n = Number(v);
  return v.trim() === '' || Number.isNaN(n) ? fallback : n;
};

// =========================================================
// Vista previa en vivo del campamento (dentro del modal)
// =========================================================

const CampPreview: React.FC<{
  form: CampForm;
  typeName?: string;
  typeColor: string;
  cityName?: string;
  enrolled: number;
}> = ({ form, typeName, typeColor, cityName, enrolled }) => {
  const validDates = !!form.startDate && !!form.endDate && form.endDate >= form.startDate;
  const phase: CampPhase | null = validDates
    ? getCampPhase({ status: form.status, startDate: form.startDate, endDate: form.endDate } as Camp)
    : form.status === 'borrador'
      ? 'borrador'
      : null;
  const meta = phase ? PHASE_META[phase] : null;
  const price = form.price.trim() !== '' && !Number.isNaN(Number(form.price)) ? Number(form.price) : null;
  const groupPrice =
    form.groupPrice.trim() !== '' && !Number.isNaN(Number(form.groupPrice)) ? Number(form.groupPrice) : null;
  const capacity = num(form.capacity, 0);
  const days = validDates ? campDurationDays(form) : 0;

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-1.5 text-[10px] font-black text-slate-500 uppercase tracking-widest">
        <Eye className="w-3.5 h-3.5" /> Vista previa
      </div>
      <div
        className={`rounded-2xl overflow-hidden border bg-white shadow-sm ${
          form.isFeatured ? 'ring-2 ring-amber-400 border-amber-200' : 'border-slate-200'
        }`}
      >
        <div className="relative h-32 sm:h-36 bg-gradient-to-br from-sky-500 to-sky-800">
          {form.imageUrl ? (
            <img src={form.imageUrl} alt="" className="absolute inset-0 w-full h-full object-cover" />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center">
              <ImageIcon className="w-8 h-8 text-white/40" />
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-slate-950/85 via-slate-950/25 to-transparent" />
          <div className="absolute top-2.5 left-2.5 right-2.5 flex flex-wrap items-start gap-1.5">
            <span
              className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-black text-white shadow-sm"
              style={{ backgroundColor: typeColor }}
            >
              {typeName || 'Sin tipo'}
            </span>
            {meta && (
              <Badge className={meta.className}>
                <span className={`w-1.5 h-1.5 rounded-full ${meta.dot}`} />
                {meta.label}
              </Badge>
            )}
            {form.isFeatured && (
              <span className="ml-auto inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-400 text-amber-950 shadow-sm">
                <Star className="w-3 h-3 fill-current" /> Activo
              </span>
            )}
          </div>
          <div className="absolute bottom-2.5 left-3 right-3 text-white min-w-0">
            <h4 className="font-display font-black text-base leading-tight line-clamp-2 break-words">
              {form.name.trim() || 'Nombre del campamento'}
            </h4>
            {form.theme.trim() && <p className="text-[11px] text-sky-100 italic truncate mt-0.5">«{form.theme.trim()}»</p>}
          </div>
        </div>
        <div className="p-3.5 space-y-1.5 text-xs text-slate-600">
          <div className="flex items-start gap-2">
            <CalendarDays className="w-3.5 h-3.5 text-[#0284C7] shrink-0 mt-0.5" />
            {validDates ? (
              <span>
                <span className="font-semibold text-slate-800">{formatDateRange(form.startDate, form.endDate)}</span>
                <span className="text-slate-400"> · {plural(days, 'día', 'días')}</span>
              </span>
            ) : (
              <span className="text-slate-400">Fechas por definir</span>
            )}
          </div>
          <div className="flex items-start gap-2 min-w-0">
            <MapPin className="w-3.5 h-3.5 text-[#0284C7] shrink-0 mt-0.5" />
            <span className={`min-w-0 break-words ${form.location.trim() ? '' : 'text-slate-400'}`}>
              {form.location.trim() || 'Lugar por definir'}
              {cityName && <span className="text-slate-400"> · {cityName}</span>}
            </span>
          </div>
          <div className="flex items-start gap-2 flex-wrap">
            <Wallet className="w-3.5 h-3.5 text-[#0284C7] shrink-0 mt-0.5" />
            {price !== null ? (
              <span className="font-black text-slate-900">{formatBs(price)}</span>
            ) : (
              <span className="text-slate-400">Precio por definir</span>
            )}
            {groupPrice !== null && (
              <span className="text-[11px] text-emerald-700 font-bold">· Delegación {formatBs(groupPrice)}</span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Users className="w-3.5 h-3.5 text-[#0284C7] shrink-0" />
            <span>
              <span className="font-mono font-bold text-slate-800 tabular-nums">
                {enrolled} / {capacity || '∞'}
              </span>{' '}
              inscritos · {form.minAge || '—'} a {form.maxAge || '—'} años
            </span>
          </div>
          {form.includes.length > 0 && (
            <div className="pt-2 flex flex-wrap gap-1">
              {form.includes.slice(0, 4).map((item) => (
                <span
                  key={item}
                  className="px-2 py-0.5 rounded-full bg-sky-50 border border-sky-100 text-sky-700 text-[10px] font-bold"
                >
                  {item}
                </span>
              ))}
              {form.includes.length > 4 && (
                <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 text-[10px] font-bold">
                  +{form.includes.length - 4}
                </span>
              )}
            </div>
          )}
        </div>
      </div>
      {form.isFeatured && form.status === 'borrador' && (
        <p className="flex items-start gap-1.5 text-[11px] text-amber-700 font-semibold">
          <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-px" />
          Un borrador no se muestra en la portada hasta que lo publiques.
        </p>
      )}
    </div>
  );
};

// =========================================================
// Página principal
// =========================================================

export const CampsManager: React.FC = () => {
  const {
    camps,
    catalogs,
    registrations,
    courses,
    championships,
    saveCamp,
    deleteCamp,
    setFeaturedCamp,
    setAdminCampFilter,
    setActiveTab,
  } = useCamp();
  const { confirm, notify } = useConfirm();
  const { can } = useAuth();
  const canCreate = can('camps:create');
  const canUpdate = can('camps:update');
  const canDelete = can('camps:delete');
  const readOnly = !canCreate && !canUpdate && !canDelete;
  /** acción en curso por tarjeta: 'feature:id' | 'dup:id' | 'del:id' */
  const [pending, setPending] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const runPending = async (key: string, fn: () => Promise<unknown>) => {
    setPending(key);
    try {
      await fn();
    } finally {
      setPending(null);
    }
  };

  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('ALL');
  const [phaseFilter, setPhaseFilter] = useState<'ALL' | CampPhase>('ALL');
  const [yearFilter, setYearFilter] = useState('ALL');

  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState<CampForm>(() => emptyForm(''));
  const [editingName, setEditingName] = useState('');
  const [errors, setErrors] = useState<FormErrors>({});
  const [includeDraft, setIncludeDraft] = useState('');

  const typeById = useMemo(() => {
    const map: Record<string, { name: string; colorHex: string }> = {};
    catalogs.campTypes.forEach((t) => (map[t.id] = t));
    return map;
  }, [catalogs.campTypes]);

  const cityById = useMemo(() => {
    const map: Record<string, string> = {};
    catalogs.cities.forEach((c) => (map[c.id] = c.name));
    return map;
  }, [catalogs.cities]);

  const regCountByCamp = useMemo(() => {
    const map: Record<string, number> = {};
    registrations.forEach((r) => (map[r.campId] = (map[r.campId] || 0) + 1));
    return map;
  }, [registrations]);

  const courseCountByCamp = useMemo(() => {
    const map: Record<string, number> = {};
    courses.forEach((c) => (map[c.campId] = (map[c.campId] || 0) + 1));
    return map;
  }, [courses]);

  const years = useMemo(
    () => Array.from(new Set(camps.map((c) => c.startDate.slice(0, 4)).filter(Boolean))).sort(),
    [camps]
  );

  const stats = useMemo(() => {
    const phases = camps.map((c) => getCampPhase(c));
    return {
      total: camps.length,
      open: phases.filter((p) => p === 'abierto').length,
      running: phases.filter((p) => p === 'en_curso').length,
      enrolled: registrations.filter((r) => camps.some((c) => c.id === r.campId)).length,
    };
  }, [camps, registrations]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return [...camps]
      .filter((c) => {
        if (q && !`${c.name} ${c.location} ${c.theme || ''}`.toLowerCase().includes(q)) return false;
        if (typeFilter !== 'ALL' && c.typeId !== typeFilter) return false;
        if (phaseFilter !== 'ALL' && getCampPhase(c) !== phaseFilter) return false;
        if (yearFilter !== 'ALL' && c.startDate.slice(0, 4) !== yearFilter) return false;
        return true;
      })
      .sort((a, b) => a.startDate.localeCompare(b.startDate));
  }, [camps, search, typeFilter, phaseFilter, yearFilter]);

  const hasFilters = search !== '' || typeFilter !== 'ALL' || phaseFilter !== 'ALL' || yearFilter !== 'ALL';

  const clearFilters = () => {
    setSearch('');
    setTypeFilter('ALL');
    setPhaseFilter('ALL');
    setYearFilter('ALL');
  };

  // ── Acciones ─────────────────────────────────────────
  const openCreate = () => {
    setForm(emptyForm(catalogs.campTypes[0]?.id || ''));
    setEditingName('');
    setErrors({});
    setIncludeDraft('');
    setModalOpen(true);
  };

  const openEdit = (camp: Camp) => {
    setForm(toForm(camp));
    setEditingName(camp.name);
    setErrors({});
    setIncludeDraft('');
    setModalOpen(true);
  };

  const closeModal = () => {
    if (!saving) setModalOpen(false);
  };

  const handleDuplicate = (camp: Camp) => {
    if (!canCreate || pending) return;
    return runPending(`dup:${camp.id}`, () =>
      saveCamp({
      ...camp,
      id: uid('camp'),
      name: `${camp.name} (copia)`,
      includes: [...camp.includes],
      isFeatured: false,
      status: 'borrador',
      createdAt: nowStamp(),
      })
    );
  };

  const handleFeature = async (camp: Camp) => {
    const current = camps.find((c) => c.isFeatured && c.id !== camp.id);
    const details: React.ReactNode[] = [];
    if (current) details.push(<>«{current.name}» dejará de ser el campamento activo.</>);
    if (camp.status === 'borrador')
      details.push('Está en borrador: no se mostrará en la portada hasta que cambies su estado a «Abierto».');
    if (details.length > 0) {
      const ok = await confirm({
        title: `¿Marcar «${camp.name}» como activo?`,
        message: 'El campamento activo es el que se muestra en la portada y en el formulario de inscripción.',
        details,
        confirmText: 'Sí, marcar como activo',
        tone: 'info',
      });
      if (!ok) return;
    }
    await runPending(`feature:${camp.id}`, () => setFeaturedCamp(camp.id));
  };

  const handleDelete = async (camp: Camp) => {
    const regs = regCountByCamp[camp.id] || 0;
    if (regs > 0) {
      await notify({
        title: `No se puede eliminar «${camp.name}»`,
        message: `Este campamento tiene ${plural(regs, 'inscripción registrada', 'inscripciones registradas')}. Para proteger esos datos no se permite eliminarlo.`,
        details: [
          'Elimina o traslada las inscripciones desde el padrón de campistas.',
          'Si solo quieres detener las inscripciones, edítalo y cambia su estado a «Cerrado».',
        ],
        tone: 'warning',
      });
      return;
    }
    const talleres = courseCountByCamp[camp.id] || 0;
    const champs = championships.filter((ch) => ch.campId === camp.id).length;
    const details: React.ReactNode[] = [];
    if (talleres > 0) details.push(<>Se eliminarán sus <b>{plural(talleres, 'taller', 'talleres')}</b>.</>);
    if (champs > 0)
      details.push(
        <>
          {plural(champs, 'campeonato quedará', 'campeonatos quedarán')} sin campamento asignado.
        </>
      );
    if (camp.isFeatured) details.push('Es el campamento activo de la portada: deberás marcar otro como activo.');
    details.push('Esta acción no se puede deshacer.');

    const ok = await confirm({
      title: `¿Eliminar el campamento «${camp.name}»?`,
      message: `${formatDateRange(camp.startDate, camp.endDate)} · ${camp.location}`,
      details,
      confirmText: 'Sí, eliminar campamento',
      tone: 'danger',
      requireText: talleres > 0 ? 'ELIMINAR' : undefined,
    });
    if (ok) await runPending(`del:${camp.id}`, () => deleteCamp(camp.id));
  };

  const goToCourses = (camp: Camp) => {
    setAdminCampFilter(camp.id);
    setActiveTab('admin-courses');
  };

  // ── Formulario ───────────────────────────────────────
  const set = <K extends keyof CampForm>(key: K, value: CampForm[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    if (errors[key]) setErrors((prev) => ({ ...prev, [key]: undefined }));
  };

  const addInclude = () => {
    const value = includeDraft.trim();
    if (!value) return;
    if (!form.includes.some((i) => i.toLowerCase() === value.toLowerCase())) {
      set('includes', [...form.includes, value]);
    }
    setIncludeDraft('');
  };

  const removeInclude = (item: string) => set('includes', form.includes.filter((i) => i !== item));

  const validate = (): FormErrors => {
    const e: FormErrors = {};
    if (!form.name.trim()) e.name = 'El nombre es obligatorio.';
    if (catalogs.campTypes.length > 0 && !typeById[form.typeId]) e.typeId = 'Selecciona un tipo de campamento.';
    if (form.price.trim() === '' || Number.isNaN(Number(form.price)) || Number(form.price) < 0)
      e.price = 'Ingresa un precio válido.';
    if (form.groupPrice.trim() !== '') {
      const gp = Number(form.groupPrice);
      if (Number.isNaN(gp) || gp < 0) e.groupPrice = 'Ingresa un precio válido.';
      else if (!e.price && gp >= Number(form.price)) e.groupPrice = 'Debe ser menor al precio individual.';
    }
    const adv = num(form.cashAdvancePercent, 0);
    if (adv < 0 || adv > 100) e.cashAdvancePercent = 'Debe estar entre 0 y 100.';
    if (!form.startDate) e.startDate = 'Indica la fecha de inicio.';
    if (!form.endDate) e.endDate = 'Indica la fecha de fin.';
    if (form.startDate && form.endDate && form.endDate < form.startDate)
      e.endDate = 'Debe ser igual o posterior al inicio.';
    if (!form.location.trim()) e.location = 'Indica el lugar del campamento.';
    if (num(form.capacity, 0) < 0) e.capacity = 'El cupo no puede ser negativo.';
    const min = num(form.minAge, 0);
    const max = num(form.maxAge, 99);
    if (min < 0) e.minAge = 'No puede ser negativa.';
    if (min > max) e.maxAge = 'Debe ser mayor o igual a la mínima.';
    if (num(form.maxCoursesPerCamper, 0) < 0) e.maxCoursesPerCamper = 'No puede ser negativo.';
    return e;
  };

  const handleSave = async () => {
    if (saving || !(form.id ? canUpdate : canCreate)) return;
    const e = validate();
    setErrors(e);
    if (Object.keys(e).length > 0) return;

    const camp: Camp = {
      id: form.id || uid('camp'),
      name: form.name.trim(),
      typeId: form.typeId,
      theme: form.theme.trim() || undefined,
      verse: form.verse.trim() || undefined,
      description: form.description.trim(),
      price: num(form.price),
      groupPrice: form.groupPrice.trim() === '' ? undefined : num(form.groupPrice),
      cashAdvancePercent: num(form.cashAdvancePercent, 0),
      startDate: form.startDate,
      endDate: form.endDate,
      location: form.location.trim(),
      cityId: form.cityId || undefined,
      imageUrl: form.imageUrl,
      capacity: num(form.capacity, 0),
      minAge: num(form.minAge, 0),
      maxAge: num(form.maxAge, 99),
      maxCoursesPerCamper: num(form.maxCoursesPerCamper, 0),
      includes: form.includes,
      status: form.status,
      isFeatured: form.isFeatured,
      createdAt: form.createdAt || nowStamp(),
    };
    setSaving(true);
    try {
      const saved = await saveCamp(camp);
      if (saved) setModalOpen(false); // ante un error (403/409/422) el formulario queda abierto
    } finally {
      setSaving(false);
    }
  };

  const isEditing = !!form.id;
  const canSave = isEditing ? canUpdate : canCreate;
  const editingRegs = isEditing ? regCountByCamp[form.id] || 0 : 0;
  const errorCount = Object.values(errors).filter(Boolean).length;
  const formType = typeById[form.typeId];

  return (
    <AdminPage>
      <AdminPageHeader
        kicker="Gestión de campamentos"
        title="Campamentos del año"
        icon={Tent}
        description="Cada año se organizan 15 o más campamentos. El campamento marcado como «Activo» es el que se muestra en la portada y en el formulario de inscripción."
        actions={
          <>
            {readOnly && (
              <Badge className="bg-slate-100 text-slate-600 border-slate-200">
                <Lock className="w-3 h-3" /> Solo lectura
              </Badge>
            )}
            {canCreate && (
              <Button icon={Plus} onClick={openCreate}>
                Nuevo campamento
              </Button>
            )}
          </>
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <StatCard label="Campamentos" value={stats.total} icon={Tent} hint={`${years.length || 0} año(s) registrados`} />
        <StatCard label="Abiertos" value={stats.open} icon={CheckCircle2} tone="emerald" hint="Inscripciones abiertas" />
        <StatCard label="En curso" value={stats.running} icon={PlayCircle} tone="violet" hint="Desarrollándose hoy" />
        <StatCard label="Inscritos" value={stats.enrolled} icon={Users} tone="amber" hint="En todos los campamentos" />
      </div>

      <Card className="p-3 sm:p-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-[2fr_1fr_1fr_1fr_auto] gap-3 items-center">
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder="Buscar por nombre, lema o lugar…"
            className="sm:col-span-3 lg:col-span-1"
          />
          <SelectInput value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} className="py-2 text-xs">
            <option value="ALL">Todos los tipos</option>
            {catalogs.campTypes.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </SelectInput>
          <SelectInput
            value={phaseFilter}
            onChange={(e) => setPhaseFilter(e.target.value as 'ALL' | CampPhase)}
            className="py-2 text-xs"
          >
            <option value="ALL">Todas las fases</option>
            {PHASE_FILTERS.map((p) => (
              <option key={p} value={p}>
                {PHASE_META[p].label}
              </option>
            ))}
          </SelectInput>
          <SelectInput value={yearFilter} onChange={(e) => setYearFilter(e.target.value)} className="py-2 text-xs">
            <option value="ALL">Todos los años</option>
            {years.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </SelectInput>
          <div className="flex items-center justify-between gap-2 sm:col-span-3 lg:col-span-1 lg:justify-end">
            <span className="text-[11px] font-bold text-slate-400 whitespace-nowrap">
              {plural(filtered.length, 'resultado', 'resultados')}
            </span>
            {hasFilters && (
              <Button variant="ghost" size="sm" icon={X} onClick={clearFilters}>
                Limpiar
              </Button>
            )}
          </div>
        </div>
      </Card>

      {filtered.length === 0 ? (
        <Card>
          <EmptyState
            icon={Tent}
            title={camps.length === 0 ? 'Aún no hay campamentos' : 'Ningún campamento coincide con los filtros'}
            description={
              camps.length === 0
                ? 'Crea el primer campamento del año para habilitar las inscripciones.'
                : 'Prueba con otra búsqueda o limpia los filtros aplicados.'
            }
            action={
              camps.length === 0 ? (
                canCreate ? (
                  <Button icon={Plus} onClick={openCreate}>
                    Nuevo campamento
                  </Button>
                ) : undefined
              ) : (
                <Button variant="secondary" icon={X} onClick={clearFilters}>
                  Limpiar filtros
                </Button>
              )
            }
          />
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 sm:gap-5">
          {filtered.map((camp) => {
            const type = typeById[camp.typeId];
            const color = type?.colorHex || FALLBACK_COLOR;
            const phase = getCampPhase(camp);
            const meta = PHASE_META[phase];
            const enrolled = regCountByCamp[camp.id] || 0;
            const talleres = courseCountByCamp[camp.id] || 0;
            const pct = camp.capacity > 0 ? Math.min(100, Math.round((enrolled / camp.capacity) * 100)) : 0;
            const days = campDurationDays(camp);
            return (
              <Card
                key={camp.id}
                className={`group overflow-hidden flex flex-col min-w-0 transition-all duration-200 hover:shadow-xl hover:border-sky-200 ${
                  camp.isFeatured ? 'ring-2 ring-amber-400 border-amber-200' : ''
                }`}
              >
                <div className="relative h-40 bg-gradient-to-br from-sky-500 to-sky-800 overflow-hidden">
                  {camp.imageUrl && (
                    <img
                      src={camp.imageUrl}
                      alt=""
                      className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-950/85 via-slate-950/30 to-transparent" />
                  <div className="absolute top-3 left-3 right-3 flex flex-wrap items-start gap-1.5">
                    <span
                      className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-black text-white shadow-sm"
                      style={{ backgroundColor: color }}
                    >
                      {type?.name || 'Sin tipo'}
                    </span>
                    <Badge className={meta.className}>
                      <span className={`w-1.5 h-1.5 rounded-full ${meta.dot}`} />
                      {meta.label}
                    </Badge>
                    {camp.isFeatured && (
                      <span className="ml-auto inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-400 text-amber-950 shadow-sm">
                        <Star className="w-3 h-3 fill-current" /> Activo
                      </span>
                    )}
                  </div>
                  <div className="absolute bottom-3 left-4 right-4 text-white min-w-0">
                    <h3 className="font-display font-black text-lg leading-tight line-clamp-2 break-words">{camp.name}</h3>
                    {camp.theme && <p className="text-xs text-sky-100 italic truncate mt-0.5">«{camp.theme}»</p>}
                  </div>
                </div>

                <div className="p-4 sm:p-5 flex-1 flex flex-col gap-3">
                  <div className="space-y-1.5 text-xs text-slate-600">
                    <div className="flex items-center gap-2 flex-wrap">
                      <CalendarDays className="w-3.5 h-3.5 text-[#0284C7] shrink-0" />
                      <span className="font-semibold text-slate-800">{formatDateRange(camp.startDate, camp.endDate)}</span>
                      <span className="text-slate-400">· {plural(days, 'día', 'días')}</span>
                    </div>
                    <div className="flex items-center gap-2 min-w-0">
                      <MapPin className="w-3.5 h-3.5 text-[#0284C7] shrink-0" />
                      <span className="truncate">
                        {camp.location}
                        {camp.cityId && cityById[camp.cityId] && (
                          <span className="text-slate-400"> · {cityById[camp.cityId]}</span>
                        )}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <Wallet className="w-3.5 h-3.5 text-[#0284C7] shrink-0" />
                      <span className="font-black text-slate-900">{formatBs(camp.price)}</span>
                      {camp.groupPrice !== undefined && camp.groupPrice !== null && (
                        <span className="text-[11px] text-emerald-700 font-bold">
                          · Delegación {formatBs(camp.groupPrice)}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="rounded-2xl bg-slate-50 border border-slate-100 p-3 space-y-2">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="flex items-center gap-1.5 font-bold text-slate-600">
                        <Users className="w-3.5 h-3.5" /> Inscritos
                      </span>
                      <span className="font-mono font-black text-slate-900 tabular-nums">
                        {enrolled}
                        <span className="text-slate-400 font-bold"> / {camp.capacity || '∞'}</span>
                      </span>
                    </div>
                    <div className="h-1.5 rounded-full bg-slate-200 overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${pct >= 90 ? 'bg-red-500' : pct >= 70 ? 'bg-amber-500' : 'bg-[#0284C7]'}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => goToCourses(camp)}
                      className="w-full flex items-center justify-between gap-2 text-[11px] font-bold text-slate-600 hover:text-[#0284C7] cursor-pointer transition-colors"
                    >
                      <span className="flex items-center gap-1.5">
                        <BookOpen className="w-3.5 h-3.5" /> {plural(talleres, 'taller', 'talleres')}
                      </span>
                      <span className="text-[#0284C7]">Ver talleres →</span>
                    </button>
                  </div>

                  <div className="mt-auto pt-1 flex flex-wrap items-center gap-2">
                    <Button size="sm" icon={canUpdate ? Edit2 : Eye} onClick={() => openEdit(camp)}>
                      {canUpdate ? 'Editar' : 'Ver'}
                    </Button>
                    {!camp.isFeatured && canUpdate && (
                      <Button
                        size="sm"
                        variant="secondary"
                        icon={pending === `feature:${camp.id}` ? Loader2 : Star}
                        disabled={!!pending}
                        className={pending === `feature:${camp.id}` ? '[&>svg]:animate-spin' : ''}
                        onClick={() => handleFeature(camp)}
                        title={
                          camp.status === 'borrador'
                            ? 'Un borrador no se mostrará en portada hasta publicarlo'
                            : 'Marcar como campamento activo (portada)'
                        }
                      >
                        Activar
                      </Button>
                    )}
                    {canCreate && (
                      <Button
                        size="sm"
                        variant="secondary"
                        icon={pending === `dup:${camp.id}` ? Loader2 : Copy}
                        disabled={!!pending}
                        className={pending === `dup:${camp.id}` ? '[&>svg]:animate-spin' : ''}
                        onClick={() => handleDuplicate(camp)}
                      >
                        Duplicar
                      </Button>
                    )}
                    {canDelete && (
                      <Button
                        size="sm"
                        variant="danger"
                        icon={pending === `del:${camp.id}` ? Loader2 : Trash2}
                        disabled={!!pending}
                        onClick={() => handleDelete(camp)}
                        aria-label={`Eliminar ${camp.name}`}
                        title="Eliminar"
                        className={`ml-auto ${pending === `del:${camp.id}` ? '[&>svg]:animate-spin' : ''}`}
                      >
                        <span className="sr-only sm:not-sr-only">Eliminar</span>
                      </Button>
                    )}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <Modal
        open={modalOpen}
        onClose={closeModal}
        size="xl"
        icon={isEditing ? Edit2 : Tent}
        title={isEditing ? (canSave ? 'Editar campamento' : 'Detalle del campamento') : 'Nuevo campamento'}
        subtitle={
          isEditing
            ? `Editando · ${editingName} · ${plural(editingRegs, 'inscrito', 'inscritos')}`
            : 'Completa los datos principales. Los campos con * son obligatorios.'
        }
        footer={
          <>
            {errorCount > 0 && (
              <span className="flex items-center justify-center sm:justify-start gap-1.5 text-[11px] font-bold text-red-600 sm:mr-auto">
                <AlertCircle className="w-3.5 h-3.5" />
                Revisa {plural(errorCount, 'campo marcado', 'campos marcados')} en rojo.
              </span>
            )}
            {!canSave && (
              <span className="flex items-center justify-center sm:justify-start gap-1.5 text-[11px] font-bold text-slate-500 sm:mr-auto">
                <Lock className="w-3.5 h-3.5" /> Solo lectura: no tienes permiso para editar campamentos.
              </span>
            )}
            <Button variant="secondary" onClick={closeModal} disabled={saving}>
              {canSave ? 'Cancelar' : 'Cerrar'}
            </Button>
            {canSave && (
              <Button
                icon={saving ? Loader2 : CheckCircle2}
                onClick={handleSave}
                disabled={saving}
                className={saving ? '[&>svg]:animate-spin' : ''}
              >
                {saving ? 'Guardando…' : isEditing ? 'Guardar cambios' : 'Crear campamento'}
              </Button>
            )}
          </>
        }
      >
        <fieldset disabled={!canSave || saving} className="border-0 p-0 m-0 min-w-0">
        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_260px] gap-5 items-start">
          <aside className="lg:order-2 lg:sticky lg:top-0">
            <CampPreview
              form={form}
              typeName={formType?.name}
              typeColor={formType?.colorHex || FALLBACK_COLOR}
              cityName={form.cityId ? cityById[form.cityId] : undefined}
              enrolled={editingRegs}
            />
          </aside>

          <div className="lg:order-1 space-y-4 min-w-0">
            <FormSection title="Información general" description="Cómo se verá el campamento en la portada." icon={Info}>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field label="Nombre" required error={errors.name} className="sm:col-span-2">
                  <TextInput
                    autoFocus
                    value={form.name}
                    onChange={(e) => set('name', e.target.value)}
                    placeholder="Ej. Campamento Nacional de Jóvenes 2026"
                  />
                </Field>
                <Field label="Tipo" required error={errors.typeId}>
                  <SelectInput value={form.typeId} onChange={(e) => set('typeId', e.target.value)}>
                    {catalogs.campTypes.length === 0 && <option value="">Sin tipos registrados</option>}
                    {form.typeId && !typeById[form.typeId] && <option value={form.typeId}>Tipo no disponible</option>}
                    {catalogs.campTypes.length > 0 && !form.typeId && <option value="">Selecciona un tipo…</option>}
                    {catalogs.campTypes.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                  </SelectInput>
                </Field>
                <Field label="Versículo" hint="Opcional">
                  <TextInput value={form.verse} onChange={(e) => set('verse', e.target.value)} placeholder="Ej. Josué 1:9" />
                </Field>
                <Field label="Lema" hint="Opcional" className="sm:col-span-2">
                  <TextInput value={form.theme} onChange={(e) => set('theme', e.target.value)} placeholder="Ej. Firmes en la Roca" />
                </Field>
                <Field label="Detalle / descripción" className="sm:col-span-2">
                  <TextArea
                    rows={3}
                    value={form.description}
                    onChange={(e) => set('description', e.target.value)}
                    placeholder="Describe el propósito, actividades y público del campamento…"
                  />
                </Field>
              </div>
            </FormSection>

            <FormSection title="Fechas y lugar" description="Define cuándo y dónde se realizará." icon={CalendarDays}>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field label="Fecha de inicio" required error={errors.startDate}>
                  <TextInput type="date" value={form.startDate} onChange={(e) => set('startDate', e.target.value)} />
                </Field>
                <Field label="Fecha de fin" required error={errors.endDate}>
                  <TextInput
                    type="date"
                    value={form.endDate}
                    min={form.startDate || undefined}
                    onChange={(e) => set('endDate', e.target.value)}
                  />
                </Field>
                <Field label="Lugar" required error={errors.location}>
                  <TextInput
                    value={form.location}
                    onChange={(e) => set('location', e.target.value)}
                    placeholder="Ej. Centro Vacacional Samaipata"
                  />
                </Field>
                <Field label="Ciudad" hint="Opcional">
                  <SelectInput value={form.cityId} onChange={(e) => set('cityId', e.target.value)}>
                    <option value="">Sin ciudad</option>
                    {form.cityId && !cityById[form.cityId] && <option value={form.cityId}>Ciudad no disponible</option>}
                    {catalogs.cities.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </SelectInput>
                </Field>
              </div>
              {form.startDate && form.endDate && form.endDate >= form.startDate && (
                <p className="text-[11px] text-slate-500 bg-sky-50/60 border border-sky-100 rounded-xl px-3 py-2">
                  Duración: <b className="text-slate-700">{plural(campDurationDays(form), 'día', 'días')}</b> ·{' '}
                  {formatDateRange(form.startDate, form.endDate)}
                </p>
              )}
            </FormSection>

            <FormSection title="Tarifas" description="Montos en bolivianos (Bs)." icon={Wallet}>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <Field label="Precio individual" required error={errors.price}>
                  <TextInput
                    type="number"
                    min={0}
                    inputMode="decimal"
                    value={form.price}
                    onChange={(e) => set('price', e.target.value)}
                    placeholder="0"
                  />
                </Field>
                <Field label="Precio delegación" hint="Con cupón · opcional" error={errors.groupPrice}>
                  <TextInput
                    type="number"
                    min={0}
                    inputMode="decimal"
                    value={form.groupPrice}
                    onChange={(e) => set('groupPrice', e.target.value)}
                    placeholder="Sin tarifa"
                  />
                </Field>
                <Field label="% adelanto efectivo" error={errors.cashAdvancePercent}>
                  <TextInput
                    type="number"
                    min={0}
                    max={100}
                    value={form.cashAdvancePercent}
                    onChange={(e) => set('cashAdvancePercent', e.target.value)}
                  />
                </Field>
              </div>
            </FormSection>

            <FormSection title="Cupos y requisitos" description="Límites de participación." icon={Users}>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <Field label="Cupo total" hint="0 = sin límite" error={errors.capacity}>
                  <TextInput type="number" min={0} value={form.capacity} onChange={(e) => set('capacity', e.target.value)} />
                </Field>
                <Field label="Edad mínima" error={errors.minAge}>
                  <TextInput type="number" min={0} value={form.minAge} onChange={(e) => set('minAge', e.target.value)} />
                </Field>
                <Field label="Edad máxima" error={errors.maxAge}>
                  <TextInput type="number" min={0} value={form.maxAge} onChange={(e) => set('maxAge', e.target.value)} />
                </Field>
                <Field label="Talleres por joven" error={errors.maxCoursesPerCamper}>
                  <TextInput
                    type="number"
                    min={0}
                    value={form.maxCoursesPerCamper}
                    onChange={(e) => set('maxCoursesPerCamper', e.target.value)}
                  />
                </Field>
              </div>
            </FormSection>

            <FormSection title="Incluye" description="Beneficios que recibe cada campista." icon={Gift}>
              <div className="flex flex-col sm:flex-row gap-2">
                <TextInput
                  value={includeDraft}
                  onChange={(e) => setIncludeDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      addInclude();
                    }
                  }}
                  placeholder="Ej. Polera oficial"
                  aria-label="Nuevo beneficio incluido"
                />
                <Button variant="secondary" icon={Plus} onClick={addInclude} disabled={!includeDraft.trim()} className="shrink-0">
                  Agregar
                </Button>
              </div>
              {form.includes.length === 0 ? (
                <p className="text-[11px] text-slate-400">Aún no agregaste beneficios incluidos.</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {form.includes.map((item) => (
                    <span
                      key={item}
                      className="inline-flex items-center gap-1.5 pl-3 pr-1.5 py-1 rounded-full bg-sky-50 border border-sky-200 text-sky-800 text-[11px] font-bold max-w-full"
                    >
                      <span className="truncate">{item}</span>
                      <button
                        type="button"
                        onClick={() => removeInclude(item)}
                        className="p-0.5 rounded-full hover:bg-sky-200 cursor-pointer shrink-0"
                        aria-label={`Quitar ${item}`}
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </FormSection>

            <FormSection title="Publicación" description="Visibilidad e imagen de portada." icon={Eye}>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-start">
                <Field label="Estado">
                  <SelectInput value={form.status} onChange={(e) => set('status', e.target.value as CampStatus)}>
                    {STATUS_OPTIONS.map((s) => (
                      <option key={s.value} value={s.value}>
                        {s.label}
                      </option>
                    ))}
                  </SelectInput>
                </Field>
                <div className="space-y-1">
                  <span className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider">Portada</span>
                  <Toggle
                    checked={form.isFeatured}
                    onChange={(v) => set('isFeatured', v)}
                    label="Campamento activo"
                    hint="Solo puede haber uno; los demás se desmarcan."
                  />
                </div>
                <Field label="Imagen de portada" className="sm:col-span-2">
                  <ImageInput value={form.imageUrl} onChange={(v) => set('imageUrl', v)} />
                </Field>
              </div>
            </FormSection>
          </div>
        </div>
        </fieldset>
      </Modal>
    </AdminPage>
  );
};
