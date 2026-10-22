import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  Building2,
  CheckCircle2,
  Edit2,
  HandHeart,
  Info,
  Layers,
  Loader2,
  Lock,
  Map as MapIcon,
  MapPin,
  Palette,
  Plus,
  Settings2,
  Tags,
  Trash2,
  Trophy,
} from 'lucide-react';
import { useCamp } from '../../context/CampContext';
import { CampType, City, RegionalItem, ServiceArea, Subdirectiva } from '../../types/camp';
import { uid, normalizeText, plural } from '../../utils/campUtils';
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
  Modal,
  SearchInput,
  SelectInput,
  Table,
  TextInput,
} from './ui';

// =========================================================
// Utilidades locales
// =========================================================

type TabId = 'cities' | 'subdirectivas' | 'regionales' | 'serviceAreas' | 'campTypes';


const normalize = (s: string) => normalizeText(s).trim();

const matches = (q: string, ...values: (string | undefined)[]) => {
  const nq = normalize(q);
  return !nq || values.some((v) => v && normalize(v).includes(nq));
};

const byName = <T extends { name: string }>(a: T, b: T) => a.name.localeCompare(b.name, 'es');

/** Lista corta de nombres: «A», «B», «C» y 2 más. */
const nameList = (names: string[], max = 3) => {
  const shown = names.slice(0, max).map((n) => `«${n}»`);
  const rest = names.length - shown.length;
  return rest > 0 ? `${shown.join(', ')} y ${rest} más` : shown.join(', ');
};

const onEnter = (fn: () => void) => (e: React.KeyboardEvent) => {
  if (e.key === 'Enter') {
    e.preventDefault();
    fn();
  }
};

const isHex = (v: string) => /^#[0-9a-fA-F]{6}$/.test(v);

const PRESET_COLORS = [
  '#0284C7',
  '#2563EB',
  '#7C3AED',
  '#DB2777',
  '#DC2626',
  '#EA580C',
  '#D97706',
  '#059669',
  '#0D9488',
  '#0891B2',
  '#4F46E5',
  '#1E293B',
];

const Th: React.FC<{ children?: React.ReactNode; className?: string }> = ({ children, className = '' }) => (
  <th className={`px-4 py-3 whitespace-nowrap ${className}`}>{children}</th>
);

const Td: React.FC<{ children?: React.ReactNode; className?: string }> = ({ children, className = '' }) => (
  <td className={`px-4 py-3 align-middle ${className}`}>{children}</td>
);

/** Permisos de escritura de los catálogos. */
const useWritePerms = (resource: 'catalogs' = 'catalogs') => {
  const { can } = useAuth();
  const canCreate = can(`${resource}:create`);
  const canUpdate = can(`${resource}:update`);
  const canDelete = can(`${resource}:delete`);
  return { canCreate, canUpdate, canDelete, readOnly: !canCreate && !canUpdate && !canDelete };
};

/** Estado de guardado / borrado en curso de una pestaña (evita dobles envíos). */
const useBusy = () => {
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const runSave = async <T,>(fn: () => Promise<T>): Promise<T> => {
    setSaving(true);
    try {
      return await fn();
    } finally {
      setSaving(false);
    }
  };
  const runDelete = async (id: string, fn: () => Promise<unknown>) => {
    setDeletingId(id);
    try {
      await fn();
    } finally {
      setDeletingId(null);
    }
  };
  return { saving, deletingId, runSave, runDelete };
};

const RowActions: React.FC<{
  onEdit: () => void;
  onDelete: () => void;
  label: string;
  canEdit?: boolean;
  canDelete?: boolean;
  deleting?: boolean;
  disabled?: boolean;
}> = ({ onEdit, onDelete, label, canEdit = true, canDelete = true, deleting = false, disabled = false }) =>
  !canEdit && !canDelete ? (
    <div className="flex items-center justify-end px-2" title="Solo lectura">
      <Lock className="w-3.5 h-3.5 text-slate-300" aria-label="Solo lectura" />
    </div>
  ) : (
    <div className="flex items-center justify-end gap-1">
      {canEdit && (
        <button
          type="button"
          onClick={onEdit}
          className="p-2 rounded-xl text-slate-500 hover:text-[#0284C7] hover:bg-sky-50 cursor-pointer transition-colors"
          aria-label={`Editar ${label}`}
          title="Editar"
        >
          <Edit2 className="w-4 h-4" />
        </button>
      )}
      {canDelete && (
        <button
          type="button"
          onClick={onDelete}
          disabled={disabled || deleting}
          className="p-2 rounded-xl text-slate-500 hover:text-red-600 hover:bg-red-50 cursor-pointer transition-colors disabled:opacity-50 disabled:cursor-wait"
          aria-label={`Eliminar ${label}`}
          title="Eliminar"
        >
          {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
        </button>
      )}
    </div>
  );

const CountPill: React.FC<{ value: number; label: string }> = ({ value, label }) => (
  <span
    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border whitespace-nowrap ${
      value > 0 ? 'bg-sky-50 text-sky-700 border-sky-200' : 'bg-slate-50 text-slate-400 border-slate-200'
    }`}
  >
    <span className="font-mono tabular-nums">{value}</span> {label}
  </span>
);

const Toolbar: React.FC<{
  search: string;
  onSearch: (v: string) => void;
  placeholder: string;
  /** sin onNew no se muestra el botón (usuario sin permiso de crear) */
  onNew?: () => void;
  newLabel?: string;
  readOnly?: boolean;
  /** Con dos filtros, el buscador ocupa toda la fila en tablet. */
  wideSearch?: boolean;
  children?: React.ReactNode;
}> = ({ search, onSearch, placeholder, onNew, newLabel = 'Nuevo', wideSearch, readOnly, children }) => (
  <div className="flex flex-col lg:flex-row lg:items-center gap-3">
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:flex lg:items-center gap-3 flex-1 min-w-0">
      <SearchInput
        value={search}
        onChange={onSearch}
        placeholder={placeholder}
        className={`lg:w-72 ${wideSearch || !children ? 'sm:col-span-2' : ''}`}
      />
      {children}
    </div>
    {readOnly && (
      <Badge className="bg-slate-100 text-slate-600 border-slate-200 self-start lg:self-auto shrink-0">
        <Lock className="w-3 h-3" /> Solo lectura
      </Badge>
    )}
    {onNew && (
      <Button icon={Plus} onClick={onNew} className="w-full sm:w-auto sm:self-end lg:self-auto shrink-0">
        {newLabel}
      </Button>
    )}
  </div>
);

const ModalFooter: React.FC<{
  onCancel: () => void;
  onSave: () => void;
  isEditing: boolean;
  createLabel: string;
  saving?: boolean;
}> = ({ onCancel, onSave, isEditing, createLabel, saving = false }) => (
  <>
    <Button variant="secondary" onClick={onCancel} disabled={saving}>
      Cancelar
    </Button>
    <Button
      icon={saving ? Loader2 : CheckCircle2}
      onClick={onSave}
      disabled={saving}
      className={saving ? '[&>svg]:animate-spin' : ''}
    >
      {saving ? 'Guardando…' : isEditing ? 'Guardar cambios' : createLabel}
    </Button>
  </>
);

const ResultCount: React.FC<{ shown: number; total: number; noun: string }> = ({ shown, total, noun }) => (
  <p className="text-[11px] font-bold text-slate-400 px-1">
    Mostrando {shown} de {total} {noun}
  </p>
);

/** Tabla en escritorio y lista de tarjetas en móvil. */
const ResponsiveList: React.FC<{ head: React.ReactNode; rows: React.ReactNode; cards: React.ReactNode }> = ({
  head,
  rows,
  cards,
}) => (
  <>
    <div className="hidden md:block">
      <Table head={head}>{rows}</Table>
    </div>
    <Card className="md:hidden overflow-hidden divide-y divide-slate-100">{cards}</Card>
  </>
);

const MobileRow: React.FC<{
  leading?: React.ReactNode;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  meta?: React.ReactNode;
  actions: React.ReactNode;
}> = ({ leading, title, subtitle, meta, actions }) => (
  <div className="flex items-start gap-3 p-4 transition-colors hover:bg-sky-50/40">
    {leading}
    <div className="min-w-0 flex-1">
      <div className="text-sm font-bold text-slate-900 break-words">{title}</div>
      {subtitle && <div className="text-[11px] text-slate-500 mt-0.5 break-words">{subtitle}</div>}
      {meta && <div className="flex flex-wrap items-center gap-1.5 mt-2">{meta}</div>}
    </div>
    <div className="shrink-0 -mr-2 -mt-1.5">{actions}</div>
  </div>
);

const InfoNote: React.FC<{ children: React.ReactNode; tone?: 'info' | 'warning' }> = ({ children, tone = 'info' }) => (
  <div
    className={`flex items-start gap-2 rounded-xl border px-3 py-2.5 text-[11px] leading-relaxed ${
      tone === 'warning' ? 'bg-amber-50 border-amber-200 text-amber-800' : 'bg-sky-50/70 border-sky-100 text-slate-600'
    }`}
  >
    {tone === 'warning' ? (
      <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-px text-amber-600" />
    ) : (
      <Info className="w-3.5 h-3.5 shrink-0 mt-px text-[#0284C7]" />
    )}
    <span>{children}</span>
  </div>
);

const CityLabel: React.FC<{ name: string }> = ({ name }) => (
  <span className="inline-flex items-center gap-1 text-slate-600 whitespace-nowrap">
    <MapPin className="w-3 h-3 text-[#0284C7]" /> {name}
  </span>
);

type Errors = Record<string, string | undefined>;

// =========================================================
// Ciudades
// =========================================================

const CitiesTab: React.FC = () => {
  const { catalogs, registrations, saveCatalogItem, deleteCatalogItem } = useCamp();
  const { confirm } = useConfirm();
  const perms = useWritePerms('catalogs');
  const { saving, deletingId, runSave, runDelete } = useBusy();
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<City>({ id: '', name: '' });
  const [editingName, setEditingName] = useState('');
  const [errors, setErrors] = useState<Errors>({});

  const subsOf = (cityId: string) => catalogs.subdirectivas.filter((s) => s.cityId === cityId);
  const subCount = (cityId: string) => subsOf(cityId).length;
  const regsOf = (cityId: string) => {
    const subs = subsOf(cityId).map((s) => s.id);
    return catalogs.regionales.filter((r) => subs.includes(r.subdirectivaId));
  };
  const regCount = (cityId: string) => regsOf(cityId).length;

  const rows = useMemo(
    () => [...catalogs.cities].sort(byName).filter((c) => matches(search, c.name)),
    [catalogs.cities, search]
  );

  const openForm = (item?: City) => {
    setDraft(item ? { ...item } : { id: '', name: '' });
    setEditingName(item?.name || '');
    setErrors({});
    setOpen(true);
  };

  const save = async () => {
    if (saving || !(draft.id ? perms.canUpdate : perms.canCreate)) return;
    const name = draft.name.trim();
    const e: Errors = {};
    if (!name) e.name = 'El nombre es obligatorio.';
    else if (catalogs.cities.some((c) => c.id !== draft.id && normalize(c.name) === normalize(name)))
      e.name = 'Ya existe una ciudad con ese nombre.';
    setErrors(e);
    if (Object.keys(e).length) return;
    const saved = await runSave(() => saveCatalogItem('cities', { ...draft, id: draft.id || uid('city'), name }));
    if (saved) setOpen(false);
  };

  const remove = async (city: City) => {
    const subs = subsOf(city.id);
    const regs = regsOf(city.id);
    const inscritos = registrations.filter((r) => normalize(r.city || '') === normalize(city.name)).length;
    const details: React.ReactNode[] = [];
    if (subs.length > 0)
      details.push(
        <>
          Se eliminarán <b>{plural(subs.length, 'sub-directiva', 'sub-directivas')}</b>: {nameList(subs.map((s) => s.name))}.
        </>
      );
    if (regs.length > 0)
      details.push(
        <>
          Se eliminarán <b>{plural(regs.length, 'regional', 'regionales')}</b> que dependen de ellas.
        </>
      );
    if (inscritos > 0)
      details.push(
        `${plural(inscritos, 'inscripción conserva', 'inscripciones conservan')} esta ciudad como texto, pero ya no aparecerá en el formulario.`
      );
    details.push('Esta acción no se puede deshacer.');
    const ok = await confirm({
      title: `¿Eliminar la ciudad «${city.name}»?`,
      message:
        subs.length > 0
          ? 'Esta ciudad tiene dependientes en la jerarquía y se eliminarán junto con ella.'
          : 'La ciudad dejará de estar disponible en el formulario de inscripción.',
      details,
      confirmText: 'Sí, eliminar ciudad',
      tone: 'danger',
      requireText: subs.length > 0 ? 'ELIMINAR' : undefined,
    });
    if (ok) await runDelete(city.id, () => deleteCatalogItem('cities', city.id));
  };

  const editingSubs = draft.id ? subCount(draft.id) : 0;
  const editingRegs = draft.id ? regCount(draft.id) : 0;

  return (
    <div className="space-y-4">
      <Toolbar search={search} onSearch={setSearch} placeholder="Buscar ciudad…" onNew={perms.canCreate ? () => openForm() : undefined}
        readOnly={perms.readOnly} newLabel="Nueva ciudad" />
      {rows.length === 0 ? (
        <Card>
          <EmptyState
            icon={MapPin}
            title={catalogs.cities.length === 0 ? 'Sin ciudades' : 'Ninguna ciudad coincide'}
            description={
              catalogs.cities.length === 0
                ? 'Registra las ciudades donde existen sub-directivas.'
                : 'Prueba con otra búsqueda.'
            }
            action={
              catalogs.cities.length === 0 && perms.canCreate ? (
                <Button icon={Plus} onClick={() => openForm()}>
                  Nueva ciudad
                </Button>
              ) : undefined
            }
          />
        </Card>
      ) : (
        <>
          <ResponsiveList
            head={
              <tr>
                <Th>Ciudad</Th>
                <Th>Sub-directivas</Th>
                <Th>Regionales</Th>
                <Th className="text-right">Acciones</Th>
              </tr>
            }
            rows={rows.map((c) => (
              <tr key={c.id} className="hover:bg-sky-50/40 transition-colors">
                <Td className="font-bold text-slate-900 whitespace-nowrap">{c.name}</Td>
                <Td>
                  <CountPill value={subCount(c.id)} label="sub-directivas" />
                </Td>
                <Td>
                  <CountPill value={regCount(c.id)} label="regionales" />
                </Td>
                <Td>
                  <RowActions label={c.name} onEdit={() => openForm(c)} onDelete={() => remove(c)} canEdit={perms.canUpdate} canDelete={perms.canDelete} deleting={deletingId === c.id} disabled={!!deletingId} />
                </Td>
              </tr>
            ))}
            cards={rows.map((c) => (
              <MobileRow
                key={c.id}
                title={<CityLabel name={c.name} />}
                meta={
                  <>
                    <CountPill value={subCount(c.id)} label="sub-directivas" />
                    <CountPill value={regCount(c.id)} label="regionales" />
                  </>
                }
                actions={<RowActions label={c.name} onEdit={() => openForm(c)} onDelete={() => remove(c)} canEdit={perms.canUpdate} canDelete={perms.canDelete} deleting={deletingId === c.id} disabled={!!deletingId} />}
              />
            ))}
          />
          <ResultCount shown={rows.length} total={catalogs.cities.length} noun="ciudades" />
        </>
      )}

      <Modal
        open={open}
        onClose={() => !saving && setOpen(false)}
        size="md"
        icon={MapPin}
        title={draft.id ? 'Editar ciudad' : 'Nueva ciudad'}
        subtitle={draft.id ? `Editando · ${editingName}` : 'Primer nivel de la jerarquía ciudad → sub-directiva → regional.'}
        footer={
          <ModalFooter saving={saving} onCancel={() => setOpen(false)} onSave={save} isEditing={!!draft.id} createLabel="Crear ciudad" />
        }
      >
        <FormSection title="Datos de la ciudad" icon={MapPin}>
          <Field label="Nombre" required error={errors.name}>
            <TextInput
              autoFocus
              value={draft.name}
              onChange={(e) => {
                setDraft({ ...draft, name: e.target.value });
                if (errors.name) setErrors({});
              }}
              onKeyDown={onEnter(save)}
              placeholder="Ej. Santa Cruz"
            />
          </Field>
          {draft.id && (
            <InfoNote>
              Tiene {plural(editingSubs, 'sub-directiva', 'sub-directivas')} y {plural(editingRegs, 'regional', 'regionales')}{' '}
              asociadas. Cambiar el nombre no afecta esa relación.
            </InfoNote>
          )}
        </FormSection>
      </Modal>
    </div>
  );
};

// =========================================================
// Sub-directivas
// =========================================================

const SubdirectivasTab: React.FC = () => {
  const { catalogs, registrations, saveCatalogItem, deleteCatalogItem } = useCamp();
  const { confirm } = useConfirm();
  const perms = useWritePerms('catalogs');
  const { saving, deletingId, runSave, runDelete } = useBusy();
  const [search, setSearch] = useState('');
  const [cityFilter, setCityFilter] = useState('ALL');
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<Subdirectiva>({ id: '', name: '', cityId: '' });
  const [editingName, setEditingName] = useState('');
  const [errors, setErrors] = useState<Errors>({});

  const cityName = (id: string) => catalogs.cities.find((c) => c.id === id)?.name || 'Sin ciudad';
  const regsOf = (subId: string) => catalogs.regionales.filter((r) => r.subdirectivaId === subId);
  const regCount = (subId: string) => regsOf(subId).length;
  const sortedCities = useMemo(() => [...catalogs.cities].sort(byName), [catalogs.cities]);

  const rows = useMemo(
    () =>
      [...catalogs.subdirectivas]
        .filter((s) => cityFilter === 'ALL' || s.cityId === cityFilter)
        .filter((s) => matches(search, s.name, cityName(s.cityId)))
        .sort((a, b) => cityName(a.cityId).localeCompare(cityName(b.cityId), 'es') || byName(a, b)),
    [catalogs.subdirectivas, catalogs.cities, cityFilter, search]
  );

  const openForm = (item?: Subdirectiva) => {
    const defaultCity = cityFilter !== 'ALL' ? cityFilter : sortedCities[0]?.id || '';
    setDraft(item ? { ...item } : { id: '', name: '', cityId: defaultCity });
    setEditingName(item ? `${item.name} (${cityName(item.cityId)})` : '');
    setErrors({});
    setOpen(true);
  };

  const set = <K extends keyof Subdirectiva>(key: K, value: Subdirectiva[K]) => {
    setDraft((prev) => ({ ...prev, [key]: value }));
    if (errors[key]) setErrors((prev) => ({ ...prev, [key]: undefined }));
  };

  const save = async () => {
    if (saving || !(draft.id ? perms.canUpdate : perms.canCreate)) return;
    const name = draft.name.trim();
    const e: Errors = {};
    if (!name) e.name = 'El nombre es obligatorio.';
    if (!draft.cityId) e.cityId = 'Selecciona la ciudad.';
    if (
      name &&
      draft.cityId &&
      catalogs.subdirectivas.some(
        (s) => s.id !== draft.id && s.cityId === draft.cityId && normalize(s.name) === normalize(name)
      )
    )
      e.name = 'Ya existe una sub-directiva con ese nombre en esta ciudad.';
    setErrors(e);
    if (Object.keys(e).length) return;
    const saved = await runSave(() =>
      saveCatalogItem('subdirectivas', { ...draft, id: draft.id || uid('sub'), name, cityId: draft.cityId })
    );
    if (saved) setOpen(false);
  };

  const remove = async (sub: Subdirectiva) => {
    const regs = regsOf(sub.id);
    const regNames = regs.map((r) => normalize(r.name));
    const inscritos = registrations.filter((r) => regNames.includes(normalize(r.regional || ''))).length;
    const details: React.ReactNode[] = [];
    if (regs.length > 0)
      details.push(
        <>
          Se eliminarán <b>{plural(regs.length, 'regional', 'regionales')}</b>: {nameList(regs.map((r) => r.name))}.
        </>
      );
    if (inscritos > 0)
      details.push(
        `${plural(inscritos, 'inscripción usa', 'inscripciones usan')} esas regionales; conservarán el nombre como texto.`
      );
    details.push('Esta acción no se puede deshacer.');
    const ok = await confirm({
      title: `¿Eliminar la sub-directiva «${sub.name}»?`,
      message: `Pertenece a ${cityName(sub.cityId)}.`,
      details,
      confirmText: 'Sí, eliminar sub-directiva',
      tone: 'danger',
      requireText: regs.length > 0 ? 'ELIMINAR' : undefined,
    });
    if (ok) await runDelete(sub.id, () => deleteCatalogItem('subdirectivas', sub.id));
  };

  const movingCity =
    !!draft.id && catalogs.subdirectivas.find((s) => s.id === draft.id)?.cityId !== draft.cityId && regCount(draft.id) > 0;

  return (
    <div className="space-y-4">
      <Toolbar
        search={search}
        onSearch={setSearch}
        placeholder="Buscar sub-directiva…"
        onNew={perms.canCreate ? () => openForm() : undefined}
        readOnly={perms.readOnly}
        newLabel="Nueva sub-directiva"
      >
        <SelectInput value={cityFilter} onChange={(e) => setCityFilter(e.target.value)} className="py-2 text-xs lg:w-52">
          <option value="ALL">Todas las ciudades</option>
          {sortedCities.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </SelectInput>
      </Toolbar>

      {catalogs.cities.length === 0 && (
        <InfoNote tone="warning">Primero registra al menos una ciudad para poder crear sub-directivas.</InfoNote>
      )}

      {rows.length === 0 ? (
        <Card>
          <EmptyState icon={Building2} title="Sin sub-directivas" description="No hay sub-directivas para los filtros aplicados." />
        </Card>
      ) : (
        <>
          <ResponsiveList
            head={
              <tr>
                <Th>Sub-directiva</Th>
                <Th>Ciudad</Th>
                <Th>Regionales</Th>
                <Th className="text-right">Acciones</Th>
              </tr>
            }
            rows={rows.map((s) => (
              <tr key={s.id} className="hover:bg-sky-50/40 transition-colors">
                <Td className="font-bold text-slate-900 whitespace-nowrap">{s.name}</Td>
                <Td>
                  <CityLabel name={cityName(s.cityId)} />
                </Td>
                <Td>
                  <CountPill value={regCount(s.id)} label="regionales" />
                </Td>
                <Td>
                  <RowActions label={s.name} onEdit={() => openForm(s)} onDelete={() => remove(s)} canEdit={perms.canUpdate} canDelete={perms.canDelete} deleting={deletingId === s.id} disabled={!!deletingId} />
                </Td>
              </tr>
            ))}
            cards={rows.map((s) => (
              <MobileRow
                key={s.id}
                title={s.name}
                subtitle={<CityLabel name={cityName(s.cityId)} />}
                meta={<CountPill value={regCount(s.id)} label="regionales" />}
                actions={<RowActions label={s.name} onEdit={() => openForm(s)} onDelete={() => remove(s)} canEdit={perms.canUpdate} canDelete={perms.canDelete} deleting={deletingId === s.id} disabled={!!deletingId} />}
              />
            ))}
          />
          <ResultCount shown={rows.length} total={catalogs.subdirectivas.length} noun="sub-directivas" />
        </>
      )}

      <Modal
        open={open}
        onClose={() => !saving && setOpen(false)}
        size="md"
        icon={Building2}
        title={draft.id ? 'Editar sub-directiva' : 'Nueva sub-directiva'}
        subtitle={draft.id ? `Editando · ${editingName}` : 'Agrupa regionales dentro de una ciudad.'}
        footer={
          <ModalFooter
            saving={saving}
            onCancel={() => setOpen(false)}
            onSave={save}
            isEditing={!!draft.id}
            createLabel="Crear sub-directiva"
          />
        }
      >
        <FormSection title="Datos de la sub-directiva" icon={Building2}>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Nombre" required error={errors.name}>
              <TextInput
                autoFocus
                value={draft.name}
                onChange={(e) => set('name', e.target.value)}
                onKeyDown={onEnter(save)}
                placeholder="Ej. Sub-directiva Norte"
              />
            </Field>
            <Field label="Ciudad" required error={errors.cityId}>
              <SelectInput value={draft.cityId} onChange={(e) => set('cityId', e.target.value)}>
                <option value="">Selecciona una ciudad…</option>
                {draft.cityId && !catalogs.cities.some((c) => c.id === draft.cityId) && (
                  <option value={draft.cityId}>Ciudad no disponible</option>
                )}
                {sortedCities.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </SelectInput>
            </Field>
          </div>
          {movingCity && (
            <InfoNote tone="warning">
              Sus {plural(regCount(draft.id), 'regional se moverá', 'regionales se moverán')} también a la nueva ciudad.
            </InfoNote>
          )}
        </FormSection>
      </Modal>
    </div>
  );
};

// =========================================================
// Regionales
// =========================================================

const RegionalesTab: React.FC = () => {
  const { catalogs, registrations, saveCatalogItem, deleteCatalogItem } = useCamp();
  const { confirm } = useConfirm();
  const perms = useWritePerms('catalogs');
  const { saving, deletingId, runSave, runDelete } = useBusy();
  const [search, setSearch] = useState('');
  const [cityFilter, setCityFilter] = useState('ALL');
  const [subFilter, setSubFilter] = useState('ALL');
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<RegionalItem>({ id: '', name: '', subdirectivaId: '' });
  const [editingName, setEditingName] = useState('');
  const [errors, setErrors] = useState<Errors>({});

  const sortedCities = useMemo(() => [...catalogs.cities].sort(byName), [catalogs.cities]);
  const subById = useMemo(() => {
    const map: Record<string, Subdirectiva> = {};
    catalogs.subdirectivas.forEach((s) => (map[s.id] = s));
    return map;
  }, [catalogs.subdirectivas]);
  const cityName = (id?: string) => catalogs.cities.find((c) => c.id === id)?.name || 'Sin ciudad';

  const regCounts = useMemo(() => {
    const map: Record<string, number> = {};
    registrations.forEach((r) => {
      const key = normalize(r.regional || '');
      if (key) map[key] = (map[key] || 0) + 1;
    });
    return map;
  }, [registrations]);
  const usage = (name: string) => regCounts[normalize(name)] || 0;

  const subsGrouped = useMemo(
    () =>
      sortedCities
        .map((c) => ({ city: c, subs: catalogs.subdirectivas.filter((s) => s.cityId === c.id).sort(byName) }))
        .filter((g) => g.subs.length > 0),
    [sortedCities, catalogs.subdirectivas]
  );

  const subFilterOptions = useMemo(
    () => catalogs.subdirectivas.filter((s) => cityFilter === 'ALL' || s.cityId === cityFilter).sort(byName),
    [catalogs.subdirectivas, cityFilter]
  );

  const rows = useMemo(
    () =>
      catalogs.regionales
        .filter((r) => {
          const sub = subById[r.subdirectivaId];
          if (cityFilter !== 'ALL' && sub?.cityId !== cityFilter) return false;
          if (subFilter !== 'ALL' && r.subdirectivaId !== subFilter) return false;
          return matches(search, r.name, sub?.name, cityName(sub?.cityId));
        })
        .sort(byName),
    [catalogs.regionales, subById, cityFilter, subFilter, search]
  );

  const openForm = (item?: RegionalItem) => {
    const defaultSub = subFilter !== 'ALL' ? subFilter : subFilterOptions[0]?.id || subsGrouped[0]?.subs[0]?.id || '';
    setDraft(item ? { ...item } : { id: '', name: '', subdirectivaId: defaultSub });
    setEditingName(item?.name || '');
    setErrors({});
    setOpen(true);
  };

  const set = <K extends keyof RegionalItem>(key: K, value: RegionalItem[K]) => {
    setDraft((prev) => ({ ...prev, [key]: value }));
    if (errors[key]) setErrors((prev) => ({ ...prev, [key]: undefined }));
  };

  const save = async () => {
    if (saving || !(draft.id ? perms.canUpdate : perms.canCreate)) return;
    const name = draft.name.trim().toUpperCase();
    const e: Errors = {};
    if (!name) e.name = 'El nombre es obligatorio.';
    if (!draft.subdirectivaId) e.subdirectivaId = 'Selecciona la sub-directiva.';
    if (name && catalogs.regionales.some((r) => r.id !== draft.id && normalize(r.name) === normalize(name))) {
      const other = catalogs.regionales.find((r) => r.id !== draft.id && normalize(r.name) === normalize(name));
      const otherSub = other ? subById[other.subdirectivaId] : undefined;
      e.name = `Ya existe la regional «${other?.name}»${otherSub ? ` en ${otherSub.name}` : ''}.`;
    }
    setErrors(e);
    if (Object.keys(e).length) return;

    const previous = draft.id ? catalogs.regionales.find((r) => r.id === draft.id) : undefined;
    // Si cambia el nombre, se pregunta antes si el servidor debe actualizar también las inscripciones
    let cascadeRename = false;
    if (previous && previous.name !== name) {
      const affected = registrations.filter((r) => normalize(r.regional || '') === normalize(previous.name));
      if (affected.length > 0) {
        cascadeRename = await confirm({
          title: '¿Actualizar también las inscripciones?',
          message: (
            <>
              La regional cambió de <b>{previous.name}</b> a <b>{name}</b>.
            </>
          ),
          details: [
            `${plural(affected.length, 'inscripción usa', 'inscripciones usan')} el nombre anterior.`,
            'Si no las actualizas, conservarán el nombre antiguo en reportes y credenciales.',
          ],
          confirmText: 'Sí, actualizar inscripciones',
          cancelText: 'No, dejarlas así',
          tone: 'info',
        });
      }
    }
    const saved = await runSave(() =>
      saveCatalogItem(
        'regionales',
        { ...draft, id: draft.id || uid('reg'), name, subdirectivaId: draft.subdirectivaId },
        cascadeRename ? { cascadeRename: true } : undefined
      )
    );
    if (saved) setOpen(false);
  };

  const remove = async (reg: RegionalItem) => {
    const used = usage(reg.name);
    const sub = subById[reg.subdirectivaId];
    const details: React.ReactNode[] = [];
    if (used > 0) {
      details.push(
        <>
          <b>{plural(used, 'inscripción usa', 'inscripciones usan')}</b> esta regional; conservarán el nombre como texto.
        </>
      );
    }
    details.push('Ya no aparecerá como opción en el formulario de inscripción.');
    const ok = await confirm({
      title: `¿Eliminar la regional «${reg.name}»?`,
      message: sub ? `Pertenece a ${sub.name} · ${cityName(sub.cityId)}.` : undefined,
      details,
      confirmText: 'Sí, eliminar regional',
      tone: 'danger',
    });
    if (ok) await runDelete(reg.id, () => deleteCatalogItem('regionales', reg.id));
  };

  const editingUsage = draft.id ? usage(editingName) : 0;
  const renaming = !!draft.id && normalize(draft.name) !== normalize(editingName);

  return (
    <div className="space-y-4">
      <Toolbar
        search={search}
        onSearch={setSearch}
        placeholder="Buscar regional…"
        onNew={perms.canCreate ? () => openForm() : undefined}
        readOnly={perms.readOnly}
        newLabel="Nueva regional"
        wideSearch
      >
        <SelectInput
          value={cityFilter}
          onChange={(e) => {
            setCityFilter(e.target.value);
            setSubFilter('ALL');
          }}
          className="py-2 text-xs lg:w-44"
        >
          <option value="ALL">Todas las ciudades</option>
          {sortedCities.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </SelectInput>
        <SelectInput value={subFilter} onChange={(e) => setSubFilter(e.target.value)} className="py-2 text-xs lg:w-56">
          <option value="ALL">Todas las sub-directivas</option>
          {subFilterOptions.map((s) => (
            <option key={s.id} value={s.id}>
              {cityFilter === 'ALL' ? `${s.name} · ${cityName(s.cityId)}` : s.name}
            </option>
          ))}
        </SelectInput>
      </Toolbar>

      {catalogs.subdirectivas.length === 0 && (
        <InfoNote tone="warning">Primero registra al menos una sub-directiva para poder crear regionales.</InfoNote>
      )}

      {rows.length === 0 ? (
        <Card>
          <EmptyState icon={MapIcon} title="Sin regionales" description="No hay regionales para los filtros aplicados." />
        </Card>
      ) : (
        <>
          <ResponsiveList
            head={
              <tr>
                <Th>Regional</Th>
                <Th>Sub-directiva</Th>
                <Th>Ciudad</Th>
                <Th>Inscripciones</Th>
                <Th className="text-right">Acciones</Th>
              </tr>
            }
            rows={rows.map((r) => {
              const sub = subById[r.subdirectivaId];
              return (
                <tr key={r.id} className="hover:bg-sky-50/40 transition-colors">
                  <Td className="font-black text-slate-900 whitespace-nowrap tracking-wide">{r.name}</Td>
                  <Td className="whitespace-nowrap">{sub?.name || <span className="text-slate-400">Sin sub-directiva</span>}</Td>
                  <Td>
                    <CityLabel name={cityName(sub?.cityId)} />
                  </Td>
                  <Td>
                    <CountPill value={usage(r.name)} label="inscritos" />
                  </Td>
                  <Td>
                    <RowActions label={r.name} onEdit={() => openForm(r)} onDelete={() => remove(r)} canEdit={perms.canUpdate} canDelete={perms.canDelete} deleting={deletingId === r.id} disabled={!!deletingId} />
                  </Td>
                </tr>
              );
            })}
            cards={rows.map((r) => {
              const sub = subById[r.subdirectivaId];
              return (
                <MobileRow
                  key={r.id}
                  title={<span className="font-black tracking-wide">{r.name}</span>}
                  subtitle={
                    <>
                      {sub?.name || 'Sin sub-directiva'} · {cityName(sub?.cityId)}
                    </>
                  }
                  meta={<CountPill value={usage(r.name)} label="inscritos" />}
                  actions={<RowActions label={r.name} onEdit={() => openForm(r)} onDelete={() => remove(r)} canEdit={perms.canUpdate} canDelete={perms.canDelete} deleting={deletingId === r.id} disabled={!!deletingId} />}
                />
              );
            })}
          />
          <ResultCount shown={rows.length} total={catalogs.regionales.length} noun="regionales" />
        </>
      )}

      <Modal
        open={open}
        onClose={() => !saving && setOpen(false)}
        size="md"
        icon={MapIcon}
        title={draft.id ? 'Editar regional' : 'Nueva regional'}
        subtitle={
          draft.id
            ? `Editando · ${editingName} · ${plural(editingUsage, 'inscrito', 'inscritos')}`
            : 'El nombre se guarda en mayúsculas y debe ser único.'
        }
        footer={
          <ModalFooter saving={saving} onCancel={() => setOpen(false)} onSave={save} isEditing={!!draft.id} createLabel="Crear regional" />
        }
      >
        <FormSection title="Datos de la regional" description="Aparece en el formulario de inscripción." icon={MapIcon}>
          <div className="grid grid-cols-1 gap-4">
            <Field label="Nombre" required error={errors.name} hint="Se guarda en mayúsculas.">
              <TextInput
                autoFocus
                value={draft.name}
                onChange={(e) => set('name', e.target.value)}
                onKeyDown={onEnter(save)}
                placeholder="Ej. PLAN 3000"
                className="uppercase"
              />
            </Field>
            <Field label="Sub-directiva" required error={errors.subdirectivaId}>
              <SelectInput value={draft.subdirectivaId} onChange={(e) => set('subdirectivaId', e.target.value)}>
                <option value="">Selecciona una sub-directiva…</option>
                {draft.subdirectivaId && !subById[draft.subdirectivaId] && (
                  <option value={draft.subdirectivaId}>Sub-directiva no disponible</option>
                )}
                {subsGrouped.map((g) => (
                  <optgroup key={g.city.id} label={g.city.name}>
                    {g.subs.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} · {g.city.name}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </SelectInput>
            </Field>
          </div>
          {renaming && editingUsage > 0 && (
            <InfoNote tone="warning">
              {plural(editingUsage, 'inscripción usa', 'inscripciones usan')} «{editingName}». Al guardar te
              preguntaremos si también quieres actualizarlas.
            </InfoNote>
          )}
        </FormSection>
      </Modal>
    </div>
  );
};

// =========================================================
// Áreas de servicio
// =========================================================

const ServiceAreasTab: React.FC = () => {
  const { catalogs, registrations, saveCatalogItem, deleteCatalogItem } = useCamp();
  const { confirm } = useConfirm();
  const perms = useWritePerms('catalogs');
  const { saving, deletingId, runSave, runDelete } = useBusy();
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<ServiceArea>({ id: '', name: '' });
  const [editingName, setEditingName] = useState('');
  const [errors, setErrors] = useState<Errors>({});

  const usage = (name: string) =>
    registrations.filter((r) => normalize(r.serviceAreaOfInterest || '') === normalize(name)).length;

  const rows = useMemo(
    () => [...catalogs.serviceAreas].sort(byName).filter((a) => matches(search, a.name)),
    [catalogs.serviceAreas, search]
  );

  const openForm = (item?: ServiceArea) => {
    setDraft(item ? { ...item } : { id: '', name: '' });
    setEditingName(item?.name || '');
    setErrors({});
    setOpen(true);
  };

  const save = async () => {
    if (saving || !(draft.id ? perms.canUpdate : perms.canCreate)) return;
    const name = draft.name.trim();
    const e: Errors = {};
    if (!name) e.name = 'El nombre es obligatorio.';
    else if (catalogs.serviceAreas.some((a) => a.id !== draft.id && normalize(a.name) === normalize(name)))
      e.name = 'Ya existe un área de servicio con ese nombre.';
    setErrors(e);
    if (Object.keys(e).length) return;
    const saved = await runSave(() => saveCatalogItem('serviceAreas', { ...draft, id: draft.id || uid('area'), name }));
    if (saved) setOpen(false);
  };

  const remove = async (area: ServiceArea) => {
    const used = usage(area.name);
    const details: React.ReactNode[] = [];
    if (used > 0)
      details.push(
        <>
          <b>{plural(used, 'joven la eligió', 'jóvenes la eligieron')}</b> como área de interés; conservarán el dato como
          texto.
        </>
      );
    details.push('Ya no aparecerá como opción en el formulario de inscripción.');
    const ok = await confirm({
      title: `¿Eliminar el área de servicio «${area.name}»?`,
      details,
      confirmText: 'Sí, eliminar área',
      tone: 'danger',
    });
    if (ok) await runDelete(area.id, () => deleteCatalogItem('serviceAreas', area.id));
  };

  const editingUsage = draft.id ? usage(editingName) : 0;

  return (
    <div className="space-y-4">
      <Toolbar
        search={search}
        onSearch={setSearch}
        placeholder="Buscar área de servicio…"
        onNew={perms.canCreate ? () => openForm() : undefined}
        readOnly={perms.readOnly}
        newLabel="Nueva área"
      />
      {rows.length === 0 ? (
        <Card>
          <EmptyState icon={HandHeart} title="Sin áreas de servicio" description="Agrega las áreas en las que los jóvenes pueden servir." />
        </Card>
      ) : (
        <>
          <ResponsiveList
            head={
              <tr>
                <Th>Área de servicio</Th>
                <Th>Interesados</Th>
                <Th className="text-right">Acciones</Th>
              </tr>
            }
            rows={rows.map((a) => (
              <tr key={a.id} className="hover:bg-sky-50/40 transition-colors">
                <Td className="font-bold text-slate-900 whitespace-nowrap">{a.name}</Td>
                <Td>
                  <CountPill value={usage(a.name)} label="inscritos" />
                </Td>
                <Td>
                  <RowActions label={a.name} onEdit={() => openForm(a)} onDelete={() => remove(a)} canEdit={perms.canUpdate} canDelete={perms.canDelete} deleting={deletingId === a.id} disabled={!!deletingId} />
                </Td>
              </tr>
            ))}
            cards={rows.map((a) => (
              <MobileRow
                key={a.id}
                title={a.name}
                meta={<CountPill value={usage(a.name)} label="interesados" />}
                actions={<RowActions label={a.name} onEdit={() => openForm(a)} onDelete={() => remove(a)} canEdit={perms.canUpdate} canDelete={perms.canDelete} deleting={deletingId === a.id} disabled={!!deletingId} />}
              />
            ))}
          />
          <ResultCount shown={rows.length} total={catalogs.serviceAreas.length} noun="áreas" />
        </>
      )}

      <Modal
        open={open}
        onClose={() => !saving && setOpen(false)}
        size="md"
        icon={HandHeart}
        title={draft.id ? 'Editar área de servicio' : 'Nueva área de servicio'}
        subtitle={
          draft.id
            ? `Editando · ${editingName} · ${plural(editingUsage, 'interesado', 'interesados')}`
            : 'Opciones de servicio que el joven puede elegir al inscribirse.'
        }
        footer={<ModalFooter saving={saving} onCancel={() => setOpen(false)} onSave={save} isEditing={!!draft.id} createLabel="Crear área" />}
      >
        <FormSection title="Datos del área" icon={HandHeart}>
          <Field label="Nombre" required error={errors.name}>
            <TextInput
              autoFocus
              value={draft.name}
              onChange={(e) => {
                setDraft({ ...draft, name: e.target.value });
                if (errors.name) setErrors({});
              }}
              onKeyDown={onEnter(save)}
              placeholder="Ej. Alabanza y adoración"
            />
          </Field>
        </FormSection>
      </Modal>
    </div>
  );
};

// =========================================================
// Tipos de campamento
// =========================================================

const CampTypesTab: React.FC = () => {
  const { catalogs, camps, saveCatalogItem, deleteCatalogItem } = useCamp();
  const { confirm, notify } = useConfirm();
  const perms = useWritePerms('catalogs');
  const { saving, deletingId, runSave, runDelete } = useBusy();
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<CampType>({ id: '', name: '', colorHex: PRESET_COLORS[0] });
  const [editingName, setEditingName] = useState('');
  const [errors, setErrors] = useState<Errors>({});

  const campsOf = (typeId: string) => camps.filter((c) => c.typeId === typeId);
  const usage = (typeId: string) => campsOf(typeId).length;

  const rows = useMemo(
    () => [...catalogs.campTypes].sort(byName).filter((t) => matches(search, t.name)),
    [catalogs.campTypes, search]
  );

  const openForm = (item?: CampType) => {
    setDraft(
      item
        ? { ...item, colorHex: (item.colorHex || PRESET_COLORS[0]).toUpperCase() }
        : { id: '', name: '', colorHex: PRESET_COLORS[catalogs.campTypes.length % PRESET_COLORS.length] }
    );
    setEditingName(item?.name || '');
    setErrors({});
    setOpen(true);
  };

  const set = <K extends keyof CampType>(key: K, value: CampType[K]) => {
    setDraft((prev) => ({ ...prev, [key]: value }));
    if (errors[key]) setErrors((prev) => ({ ...prev, [key]: undefined }));
  };

  const save = async () => {
    if (saving || !(draft.id ? perms.canUpdate : perms.canCreate)) return;
    const name = draft.name.trim();
    const e: Errors = {};
    if (!name) e.name = 'El nombre es obligatorio.';
    else if (catalogs.campTypes.some((t) => t.id !== draft.id && normalize(t.name) === normalize(name)))
      e.name = 'Ya existe un tipo de campamento con ese nombre.';
    if (!isHex(draft.colorHex)) e.colorHex = 'Usa un color hexadecimal válido (#RRGGBB).';
    setErrors(e);
    if (Object.keys(e).length) return;
    const saved = await runSave(() =>
      saveCatalogItem('campTypes', { ...draft, id: draft.id || uid('type'), name, colorHex: draft.colorHex.toUpperCase() })
    );
    if (saved) setOpen(false);
  };

  const remove = async (type: CampType) => {
    const using = campsOf(type.id);
    if (using.length > 0) {
      await notify({
        title: `No se puede eliminar «${type.name}»`,
        message: `Este tipo está asignado a ${plural(using.length, 'campamento', 'campamentos')}.`,
        details: [
          <>En uso por: {nameList(using.map((c) => c.name))}.</>,
          'Edita esos campamentos y asígnales otro tipo antes de eliminarlo.',
        ],
        tone: 'warning',
      });
      return;
    }
    const ok = await confirm({
      title: `¿Eliminar el tipo «${type.name}»?`,
      message: 'Ningún campamento lo usa actualmente.',
      details: ['Dejará de aparecer en los filtros y en el formulario de campamentos.', 'Esta acción no se puede deshacer.'],
      confirmText: 'Sí, eliminar tipo',
      tone: 'danger',
    });
    if (ok) await runDelete(type.id, () => deleteCatalogItem('campTypes', type.id));
  };

  const previewColor = isHex(draft.colorHex) ? draft.colorHex : '#0284C7';
  const editingUsage = draft.id ? usage(draft.id) : 0;

  return (
    <div className="space-y-4">
      <Toolbar search={search} onSearch={setSearch} placeholder="Buscar tipo…" onNew={perms.canCreate ? () => openForm() : undefined}
        readOnly={perms.readOnly} newLabel="Nuevo tipo" />
      {rows.length === 0 ? (
        <Card>
          <EmptyState icon={Tags} title="Sin tipos de campamento" description="Los tipos ayudan a clasificar y colorear los campamentos." />
        </Card>
      ) : (
        <>
          <ResponsiveList
            head={
              <tr>
                <Th>Tipo</Th>
                <Th>Color</Th>
                <Th>Campamentos</Th>
                <Th className="text-right">Acciones</Th>
              </tr>
            }
            rows={rows.map((t) => (
              <tr key={t.id} className="hover:bg-sky-50/40 transition-colors">
                <Td className="whitespace-nowrap">
                  <Badge color={t.colorHex} className="text-[11px]">
                    <span className="w-2 h-2 rounded-full" style={{ backgroundColor: t.colorHex }} />
                    {t.name}
                  </Badge>
                </Td>
                <Td className="whitespace-nowrap">
                  <span className="inline-flex items-center gap-2 font-mono text-[11px] text-slate-500">
                    <span className="w-5 h-5 rounded-lg border border-slate-200" style={{ backgroundColor: t.colorHex }} />
                    {t.colorHex}
                  </span>
                </Td>
                <Td>
                  <CountPill value={usage(t.id)} label="campamentos" />
                </Td>
                <Td>
                  <RowActions label={t.name} onEdit={() => openForm(t)} onDelete={() => remove(t)} canEdit={perms.canUpdate} canDelete={perms.canDelete} deleting={deletingId === t.id} disabled={!!deletingId} />
                </Td>
              </tr>
            ))}
            cards={rows.map((t) => (
              <MobileRow
                key={t.id}
                leading={
                  <span
                    className="w-10 h-10 rounded-xl border border-slate-200 shrink-0 shadow-sm"
                    style={{ backgroundColor: t.colorHex }}
                  />
                }
                title={t.name}
                subtitle={<span className="font-mono">{t.colorHex}</span>}
                meta={<CountPill value={usage(t.id)} label="campamentos" />}
                actions={<RowActions label={t.name} onEdit={() => openForm(t)} onDelete={() => remove(t)} canEdit={perms.canUpdate} canDelete={perms.canDelete} deleting={deletingId === t.id} disabled={!!deletingId} />}
              />
            ))}
          />
          <ResultCount shown={rows.length} total={catalogs.campTypes.length} noun="tipos" />
        </>
      )}

      <Modal
        open={open}
        onClose={() => !saving && setOpen(false)}
        size="md"
        icon={Palette}
        title={draft.id ? 'Editar tipo de campamento' : 'Nuevo tipo de campamento'}
        subtitle={
          draft.id
            ? `Editando · ${editingName} · usado por ${plural(editingUsage, 'campamento', 'campamentos')}`
            : 'Clasifica y colorea los campamentos en la portada y el panel.'
        }
        footer={<ModalFooter saving={saving} onCancel={() => setOpen(false)} onSave={save} isEditing={!!draft.id} createLabel="Crear tipo" />}
      >
        <div className="space-y-4">
          <FormSection title="Datos del tipo" icon={Tags}>
            <Field label="Nombre" required error={errors.name}>
              <TextInput
                autoFocus
                value={draft.name}
                onChange={(e) => set('name', e.target.value)}
                onKeyDown={onEnter(save)}
                placeholder="Ej. Adolescentes"
              />
            </Field>
          </FormSection>

          <FormSection title="Color" description="Se usa en etiquetas, tarjetas y filtros." icon={Palette}>
            <Field label="Color hexadecimal" required error={errors.colorHex}>
              <div className="flex items-center gap-3">
                <input
                  type="color"
                  value={previewColor}
                  onChange={(e) => set('colorHex', e.target.value.toUpperCase())}
                  className="w-12 h-11 rounded-xl border border-slate-200 bg-white p-1 cursor-pointer shrink-0"
                  aria-label="Seleccionar color"
                />
                <TextInput
                  value={draft.colorHex}
                  onChange={(e) => set('colorHex', e.target.value)}
                  className="font-mono uppercase"
                  maxLength={7}
                />
              </div>
            </Field>
            <div className="grid grid-cols-6 sm:grid-cols-12 gap-2">
              {PRESET_COLORS.map((c) => {
                const active = draft.colorHex.toUpperCase() === c.toUpperCase();
                return (
                  <button
                    key={c}
                    type="button"
                    onClick={() => set('colorHex', c)}
                    className={`aspect-square w-full max-w-9 rounded-xl border-2 cursor-pointer transition-transform hover:scale-110 ${
                      active ? 'border-slate-900 scale-110' : 'border-white shadow'
                    }`}
                    style={{ backgroundColor: c }}
                    aria-label={`Color ${c}`}
                    aria-pressed={active}
                  />
                );
              })}
            </div>
            <div className="rounded-2xl bg-slate-50 border border-slate-100 p-3 flex flex-wrap items-center gap-2">
              <span className="text-[11px] font-bold text-slate-500">Vista previa:</span>
              <span
                className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-black text-white shadow-sm"
                style={{ backgroundColor: previewColor }}
              >
                {draft.name.trim() || 'Tipo de campamento'}
              </span>
              <Badge color={previewColor} className="text-[11px]">
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: previewColor }} />
                {draft.name.trim() || 'Tipo de campamento'}
              </Badge>
            </div>
          </FormSection>
        </div>
      </Modal>
    </div>
  );
};

// =========================================================
// Página principal
// =========================================================

export const CatalogsManager: React.FC = () => {
  const { catalogs, championships, setActiveTab } = useCamp();
  const { can } = useAuth();
  const [tab, setTab] = useState<TabId>('cities');

  const tabs: { id: TabId; label: string; icon: React.ElementType; count: number }[] = [
    { id: 'cities', label: 'Ciudades', icon: MapPin, count: catalogs.cities.length },
    { id: 'subdirectivas', label: 'Sub-directivas', icon: Building2, count: catalogs.subdirectivas.length },
    { id: 'regionales', label: 'Regionales', icon: MapIcon, count: catalogs.regionales.length },
    { id: 'serviceAreas', label: 'Áreas de servicio', icon: HandHeart, count: catalogs.serviceAreas.length },
    { id: 'campTypes', label: 'Tipos de campamento', icon: Palette, count: catalogs.campTypes.length },
  ];

  return (
    <AdminPage>
      <AdminPageHeader
        kicker="Configuración"
        title="Catálogos del sistema"
        icon={Settings2}
        description="Estas listas alimentan el formulario de inscripción (ciudad → sub-directiva → regional), las áreas de servicio, y la clasificación de los campamentos."
      />

      <div className="-mx-4 px-4 sm:mx-0 sm:px-0 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
        <div className="flex gap-2 w-max sm:w-auto sm:flex-wrap pb-1" role="tablist">
          {tabs.map((t) => {
            const Icon = t.icon;
            const active = tab === t.id;
            return (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setTab(t.id)}
                className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-xs font-bold whitespace-nowrap border transition-all cursor-pointer ${
                  active
                    ? 'bg-[#0284C7] text-white border-[#0284C7] shadow-md'
                    : 'bg-white text-slate-600 border-slate-200 hover:border-sky-300 hover:text-[#0284C7] hover:bg-sky-50/50'
                }`}
              >
                <Icon className="w-4 h-4" />
                {t.label}
                <span
                  className={`px-1.5 py-0.5 rounded-full text-[10px] font-mono tabular-nums ${
                    active ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500'
                  }`}
                >
                  {t.count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {(tab === 'cities' || tab === 'subdirectivas' || tab === 'regionales') && (
        <div className="flex items-start gap-2 text-[11px] text-slate-500 bg-sky-50/60 border border-sky-100 rounded-2xl px-4 py-2.5">
          <Layers className="w-4 h-4 text-[#0284C7] shrink-0" />
          <span>
            Jerarquía: <b className="text-slate-700">Ciudad</b> → <b className="text-slate-700">Sub-directiva</b> →{' '}
            <b className="text-slate-700">Regional</b>. Al eliminar un nivel superior se eliminan sus dependientes.
          </span>
        </div>
      )}

      {tab === 'cities' && <CitiesTab />}
      {tab === 'subdirectivas' && <SubdirectivasTab />}
      {tab === 'regionales' && <RegionalesTab />}
      {tab === 'serviceAreas' && <ServiceAreasTab />}
      {tab === 'campTypes' && <CampTypesTab />}

      <Card className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center gap-4 bg-gradient-to-r from-amber-50/70 via-white to-sky-50/60">
        <div className="w-11 h-11 rounded-2xl bg-amber-100 text-amber-600 flex items-center justify-center shrink-0">
          <Trophy className="w-5 h-5" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-black text-slate-900">¿Buscas los campeonatos?</p>
          <p className="text-xs text-slate-500 mt-0.5">
            Los campeonatos ahora se gestionan por campamento en «Campeonatos y equipos»
            {championships.length > 0 && <> ({championships.length} registrados)</>}.
          </p>
        </div>
        {can(['championships:create', 'championships:update', 'championships:delete']) && (
          <Button variant="secondary" icon={ArrowRight} onClick={() => setActiveTab('admin-championships')} className="w-full sm:w-auto shrink-0">
            Ir a Campeonatos y equipos
          </Button>
        )}
      </Card>
    </AdminPage>
  );
};
