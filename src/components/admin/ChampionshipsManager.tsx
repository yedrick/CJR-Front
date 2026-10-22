import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  Ban,
  Banknote,
  CalendarClock,
  CalendarX,
  CheckCircle2,
  Clock,
  Copy,
  Crown,
  Edit2,
  Eye,
  FileImage,
  ImageIcon,
  Landmark,
  Link2,
  Loader2,
  Lock,
  Medal,
  Plus,
  QrCode,
  Tent,
  Ticket,
  Trash2,
  Trophy,
  User as UserIcon,
  UserMinus,
  Users,
  Wallet,
  XCircle,
} from 'lucide-react';
import { useCamp } from '../../context/CampContext';
import { useAuth } from '../../context/AuthContext';
import { useConfirm } from '../common/ConfirmDialog';
import { Camp, Championship, ChampionshipEntry, ChampionshipMode, ExtraPayment, TeamMember } from '../../types/camp';
import { formatDateRange, formatShortDate, initials, todayISO, uid, formatBs, normalizeText, isPaymentPending, openImageInNewTab } from '../../utils/campUtils';
import {
  AdminPage,
  AdminPageHeader,
  Badge,
  Button,
  CampFilterSelect,
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
} from './ui';

// =========================================================
// Helpers
// =========================================================

type Gender = Championship['genderCategory'];

const normalize = (s?: string) => normalizeText(s).trim();

const GENDER_CLASS: Record<Gender, string> = {
  Varonil: 'bg-sky-50 text-sky-700 border-sky-200',
  Femenil: 'bg-pink-50 text-pink-700 border-pink-200',
  Mixto: 'bg-violet-50 text-violet-700 border-violet-200',
};

/** "Gratis", "20 Bs por persona", "160 Bs por equipo" */
const championshipFeeText = (ch: Pick<Championship, 'registrationFee' | 'mode'>) =>
  ch.registrationFee > 0 ? `${formatBs(ch.registrationFee)} por ${ch.mode === 'team' ? 'equipo' : 'persona'}` : 'Gratis';

const modeLabel = (ch: Pick<Championship, 'mode' | 'minTeamSize' | 'maxTeamSize'>) =>
  ch.mode === 'team'
    ? `Equipos ${ch.minTeamSize ?? '?'}${ch.maxTeamSize && ch.maxTeamSize !== ch.minTeamSize ? `–${ch.maxTeamSize}` : ''}`
    : 'Individual';

const ModeBadge: React.FC<{ ch: Pick<Championship, 'mode' | 'minTeamSize' | 'maxTeamSize'> }> = ({ ch }) => (
  <Badge
    className={
      ch.mode === 'team' ? 'bg-indigo-50 text-indigo-700 border-indigo-200' : 'bg-teal-50 text-teal-700 border-teal-200'
    }
  >
    {ch.mode === 'team' ? <Users className="w-3 h-3" /> : <UserIcon className="w-3 h-3" />}
    {modeLabel(ch)}
  </Badge>
);

const ENTRY_STATUS: Record<ChampionshipEntry['status'], { label: string; cls: string; icon: React.ElementType }> = {
  confirmed: { label: 'Confirmada', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200', icon: CheckCircle2 },
  pending_payment: { label: 'Pago pendiente', cls: 'bg-amber-50 text-amber-700 border-amber-200', icon: Clock },
  cancelled: { label: 'Anulada', cls: 'bg-slate-100 text-slate-500 border-slate-200', icon: Ban },
};

const PAY_STATUS: Record<ExtraPayment['status'], { label: string; cls: string; icon: React.ElementType }> = {
  completed: { label: 'Pagado', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200', icon: CheckCircle2 },
  pending_verification: { label: 'Por verificar', cls: 'bg-violet-50 text-violet-700 border-violet-200', icon: FileImage },
  pending_cash: { label: 'Pago en caja', cls: 'bg-amber-50 text-amber-700 border-amber-200', icon: Banknote },
  rejected: { label: 'Rechazado', cls: 'bg-rose-50 text-rose-700 border-rose-200', icon: XCircle },
};

const METHOD_LABEL: Record<ExtraPayment['method'], string> = {
  qr_bank: 'QR',
  transfer: 'Transferencia',
  cash_box: 'Efectivo',
  free: 'Sin costo',
};

const EntryStatusBadge: React.FC<{ status: ChampionshipEntry['status'] }> = ({ status }) => {
  const cfg = ENTRY_STATUS[status];
  const Icon = cfg.icon;
  return (
    <Badge className={cfg.cls}>
      <Icon className="w-3 h-3" /> {cfg.label}
    </Badge>
  );
};

const PayStatusBadge: React.FC<{ payment: ExtraPayment }> = ({ payment }) => {
  if (payment.method === 'free' || payment.amount <= 0)
    return <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200">Gratis</Badge>;
  const cfg = PAY_STATUS[payment.status];
  const Icon = cfg.icon;
  return (
    <Badge className={cfg.cls}>
      <Icon className="w-3 h-3" /> {cfg.label}
    </Badge>
  );
};

const isClosed = (ch: Championship, today = todayISO()) => !!ch.registrationClosesAt && today > ch.registrationClosesAt;

// =========================================================
// Formulario
// =========================================================

interface ChampForm {
  id: string;
  campId: string;
  name: string;
  sport: string;
  genderCategory: Gender;
  mode: ChampionshipMode;
  minTeamSize: string;
  maxTeamSize: string;
  registrationFee: string;
  maxTeamsOrParticipants: string;
  enrolledTeamsCount: number;
  registrationClosesAt: string;
  schedule: string;
  prizeSummary: string;
  description: string;
  imageUrl: string;
}

type Errors = Partial<Record<keyof ChampForm, string>>;

const emptyForm = (campId: string): ChampForm => ({
  id: '',
  campId,
  name: '',
  sport: '',
  genderCategory: 'Mixto',
  mode: 'individual',
  minTeamSize: '5',
  maxTeamSize: '10',
  registrationFee: '0',
  maxTeamsOrParticipants: '16',
  enrolledTeamsCount: 0,
  registrationClosesAt: '',
  schedule: '',
  prizeSummary: '',
  description: '',
  imageUrl: '',
});

const toForm = (ch: Championship): ChampForm => ({
  id: ch.id,
  campId: ch.campId || '',
  name: ch.name || '',
  sport: ch.sport || '',
  genderCategory: ch.genderCategory || 'Mixto',
  mode: ch.mode || 'individual',
  minTeamSize: String(ch.minTeamSize ?? 5),
  maxTeamSize: String(ch.maxTeamSize ?? 10),
  registrationFee: String(ch.registrationFee ?? 0),
  maxTeamsOrParticipants: String(ch.maxTeamsOrParticipants ?? 1),
  enrolledTeamsCount: ch.enrolledTeamsCount || 0,
  registrationClosesAt: ch.registrationClosesAt || '',
  schedule: ch.schedule || '',
  prizeSummary: ch.prizeSummary || '',
  description: ch.description || '',
  imageUrl: ch.imageUrl || '',
});

const Segmented = <T extends string>({
  value,
  options,
  onChange,
  disabled,
}: {
  value: T;
  options: { id: T; label: string; icon?: React.ElementType; hint?: string }[];
  onChange: (v: T) => void;
  disabled?: boolean;
}) => (
  <div className="grid grid-cols-2 gap-2" role="radiogroup">
    {options.map((o) => {
      const active = value === o.id;
      const Icon = o.icon;
      return (
        <button
          key={o.id}
          type="button"
          role="radio"
          aria-checked={active}
          disabled={disabled && !active}
          onClick={() => onChange(o.id)}
          className={`flex items-start gap-2.5 p-3 rounded-2xl border-2 text-left transition-all cursor-pointer disabled:cursor-not-allowed disabled:opacity-50 ${
            active ? 'border-[#0284C7] bg-sky-50 shadow-sm' : 'border-slate-200 bg-white hover:border-sky-200'
          }`}
        >
          {Icon && (
            <span
              className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
                active ? 'bg-[#0284C7] text-white' : 'bg-slate-100 text-slate-500'
              }`}
            >
              <Icon className="w-4 h-4" />
            </span>
          )}
          <span className="min-w-0">
            <span className={`block text-xs font-black ${active ? 'text-[#0369A1]' : 'text-slate-800'}`}>{o.label}</span>
            {o.hint && <span className="block text-[10px] text-slate-500 mt-0.5">{o.hint}</span>}
          </span>
        </button>
      );
    })}
  </div>
);

/** Barra de cupo (inscritos / máximo). */
const CupoBar: React.FC<{ used: number; max: number; unit: string }> = ({ used, max, unit }) => {
  const pct = max > 0 ? Math.min(100, Math.round((used / max) * 100)) : 0;
  const full = max > 0 && used >= max;
  return (
    <div>
      <div className="flex items-center justify-between text-[11px]">
        <span className="font-bold text-slate-500">Cupo</span>
        <span className={`font-mono font-black tabular-nums ${full ? 'text-rose-600' : 'text-slate-800'}`}>
          {used}/{max} <span className="font-sans font-semibold text-slate-400">{unit}</span>
        </span>
      </div>
      <div className="h-1.5 mt-1 rounded-full bg-slate-100 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${full ? 'bg-rose-500' : pct >= 80 ? 'bg-amber-500' : 'bg-[#0284C7]'}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
};

// =========================================================
// Página principal
// =========================================================

export const ChampionshipsManager: React.FC = () => {
  const {
    championships,
    championshipEntries,
    camps,
    featuredCamp,
    adminCampFilter,
    getCampById,
    saveChampionship,
    deleteChampionship,
  } = useCamp();
  const { can } = useAuth();
  const { confirm } = useConfirm();
  const canCreate = can('championships:create');
  const canUpdate = can('championships:update');
  const canDelete = can('championships:delete');

  const [search, setSearch] = useState('');
  const [modeFilter, setModeFilter] = useState<'ALL' | ChampionshipMode>('ALL');
  const [formOpen, setFormOpen] = useState(false);
  const [draft, setDraft] = useState<ChampForm>(() => emptyForm(''));
  const [errors, setErrors] = useState<Errors>({});
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [detailId, setDetailId] = useState<string | null>(null);

  const today = todayISO();
  const sortedCamps = useMemo(() => [...camps].sort((a, b) => a.startDate.localeCompare(b.startDate)), [camps]);

  const inScope = (campId?: string) => adminCampFilter === 'ALL' || campId === adminCampFilter;
  const scopedChamps = championships.filter((ch) => inScope(ch.campId));
  const scopedEntries = championshipEntries.filter((e) => inScope(e.campId));
  const activeEntries = scopedEntries.filter((e) => e.status !== 'cancelled');
  const teams = activeEntries.filter((e) => e.type === 'team');
  const teamMembers = teams.reduce((acc, e) => acc + e.members.length, 0);
  const pendingPayments = scopedEntries.filter(
    (e) => e.status !== 'cancelled' && isPaymentPending(e.payment.status)
  );
  const pendingAmount = pendingPayments.reduce((acc, e) => acc + (e.payment.amount || 0), 0);

  const entriesOf = (chId: string) => championshipEntries.filter((e) => e.championshipId === chId);

  const rows = scopedChamps
    .filter((ch) => modeFilter === 'ALL' || ch.mode === modeFilter)
    .filter((ch) => {
      const q = normalize(search);
      return !q || [ch.name, ch.sport, ch.genderCategory, getCampById(ch.campId)?.name].some((v) => normalize(v).includes(q));
    })
    .sort((a, b) => a.name.localeCompare(b.name, 'es'));

  /** Agrupados por campamento (en orden de fecha). */
  const groups = (() => {
    const out: { camp?: Camp; campId: string; items: Championship[] }[] = [];
    sortedCamps.forEach((c) => {
      const items = rows.filter((ch) => ch.campId === c.id);
      if (items.length) out.push({ camp: c, campId: c.id, items });
    });
    const orphans = rows.filter((ch) => !getCampById(ch.campId));
    if (orphans.length) out.push({ camp: undefined, campId: '__none__', items: orphans });
    return out;
  })();

  // ── Formulario ───────────────────────────────────────
  const defaultCampId = adminCampFilter !== 'ALL' ? adminCampFilter : featuredCamp?.id || sortedCamps[0]?.id || '';

  const openForm = (ch?: Championship) => {
    setDraft(ch ? toForm(ch) : emptyForm(defaultCampId));
    setErrors({});
    setFormOpen(true);
  };

  const set = <K extends keyof ChampForm>(key: K, value: ChampForm[K]) => {
    setDraft((prev) => ({ ...prev, [key]: value }));
    if (errors[key]) setErrors((prev) => ({ ...prev, [key]: undefined }));
  };

  const editingOriginal = draft.id ? championships.find((c) => c.id === draft.id) : undefined;
  const modeLocked = !!editingOriginal && draft.enrolledTeamsCount > 0;
  const draftCamp = getCampById(draft.campId);
  const isTeam = draft.mode === 'team';

  const validate = (): Errors => {
    const e: Errors = {};
    const name = draft.name.trim();
    if (!draft.campId) e.campId = 'Elige el campamento al que pertenece.';
    if (name.length < 3) e.name = 'El nombre es obligatorio (mínimo 3 letras).';
    else if (
      championships.some((c) => c.id !== draft.id && c.campId === draft.campId && normalize(c.name) === normalize(name))
    )
      e.name = 'Ya existe un campeonato con ese nombre en este campamento.';
    const fee = Number(draft.registrationFee);
    if (draft.registrationFee.trim() === '' || Number.isNaN(fee) || fee < 0) e.registrationFee = 'Ingresa un monto válido.';
    const cupo = Number(draft.maxTeamsOrParticipants);
    if (!Number.isInteger(cupo) || cupo < 1) e.maxTeamsOrParticipants = 'El cupo debe ser al menos 1.';
    else if (cupo < draft.enrolledTeamsCount)
      e.maxTeamsOrParticipants = `Ya hay ${draft.enrolledTeamsCount} inscripciones activas; el cupo no puede ser menor.`;
    if (isTeam) {
      const min = Number(draft.minTeamSize);
      const max = Number(draft.maxTeamSize);
      if (!Number.isInteger(min) || min < 2) e.minTeamSize = 'Un equipo necesita al menos 2 integrantes.';
      if (!Number.isInteger(max) || max < min) e.maxTeamSize = 'Debe ser mayor o igual al mínimo.';
    }
    if (draft.registrationClosesAt && draftCamp && draft.registrationClosesAt > draftCamp.endDate)
      e.registrationClosesAt = 'Debe ser antes de que termine el campamento.';
    return e;
  };

  const save = async () => {
    if (saving || !(draft.id ? canUpdate : canCreate)) return;
    const e = validate();
    setErrors(e);
    if (Object.keys(e).length) return;
    const payload: Championship = {
      id: draft.id || uid('champ'),
      campId: draft.campId,
      name: draft.name.trim(),
      sport: draft.sport.trim(),
      genderCategory: draft.genderCategory,
      mode: draft.mode,
      minTeamSize: isTeam ? Number(draft.minTeamSize) : undefined,
      maxTeamSize: isTeam ? Number(draft.maxTeamSize) : undefined,
      registrationFee: Number(draft.registrationFee),
      maxTeamsOrParticipants: Number(draft.maxTeamsOrParticipants),
      enrolledTeamsCount: draft.enrolledTeamsCount,
      registrationClosesAt: draft.registrationClosesAt || undefined,
      schedule: draft.schedule.trim(),
      prizeSummary: draft.prizeSummary.trim(),
      description: draft.description.trim(),
      imageUrl: draft.imageUrl || undefined,
    };
    setSaving(true);
    const saved = await saveChampionship(payload).finally(() => setSaving(false));
    if (saved) setFormOpen(false);
  };

  const remove = async (ch: Championship) => {
    const active = entriesOf(ch.id).filter((e) => e.status !== 'cancelled').length;
    const camp = getCampById(ch.campId);
    const ok = await confirm({
      title: `¿Eliminar «${ch.name}»?`,
      message: `${ch.sport || 'Campeonato'} · ${ch.genderCategory} · ${camp?.name || 'Sin campamento'}`,
      details: [
        active > 0 ? (
          <>
            Tiene <b>{active} inscripciones activas</b>: el servidor no permitirá eliminarlo hasta que se anulen.
          </>
        ) : (
          'No tiene inscripciones activas.'
        ),
        'Esta acción no se puede deshacer.',
      ],
      confirmText: 'Sí, eliminar campeonato',
      tone: 'danger',
    });
    if (!ok) return;
    setDeletingId(ch.id);
    await deleteChampionship(ch.id).finally(() => setDeletingId(null));
  };

  // ── Piezas ───────────────────────────────────────────
  const renderCard = (ch: Championship) => {
    const entries = entriesOf(ch.id);
    const pend = entries.filter(
      (e) => e.status !== 'cancelled' && isPaymentPending(e.payment.status)
    ).length;
    const closed = isClosed(ch, today);
    return (
      <Card key={ch.id} className="overflow-hidden flex flex-col hover:shadow-md transition-shadow">
        <div className="relative h-32 bg-gradient-to-br from-sky-500 via-sky-600 to-indigo-600 shrink-0">
          {ch.imageUrl ? (
            <img src={ch.imageUrl} alt="" className="absolute inset-0 w-full h-full object-cover" />
          ) : (
            <Trophy className="absolute right-4 bottom-3 w-16 h-16 text-white/20" />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-slate-950/70 via-slate-950/10 to-transparent" />
          <div className="absolute top-3 left-3 right-3 flex flex-wrap gap-1.5 [&>span]:bg-white/95">
            <ModeBadge ch={ch} />
            <Badge className={GENDER_CLASS[ch.genderCategory]}>{ch.genderCategory}</Badge>
          </div>
          <div className="absolute bottom-3 left-4 right-4">
            <h4 className="text-white font-black text-base leading-tight line-clamp-2 drop-shadow">{ch.name}</h4>
            {ch.sport && <p className="text-white/80 text-[11px] font-semibold">{ch.sport}</p>}
          </div>
        </div>
        <div className="p-4 space-y-3 flex-1 flex flex-col">
          <div className="flex items-center justify-between gap-2">
            <span
              className={`text-sm font-black ${ch.registrationFee > 0 ? 'text-slate-900' : 'text-emerald-600'} font-mono`}
            >
              {championshipFeeText(ch)}
            </span>
            {pend > 0 && (
              <Badge className="bg-violet-50 text-violet-700 border-violet-200">
                <Wallet className="w-3 h-3" /> {pend} por cobrar
              </Badge>
            )}
          </div>
          <CupoBar used={ch.enrolledTeamsCount} max={ch.maxTeamsOrParticipants} unit={ch.mode === 'team' ? 'equipos' : 'participantes'} />
          <div className="flex items-center gap-1.5 text-[11px]">
            {ch.registrationClosesAt ? (
              closed ? (
                <span className="inline-flex items-center gap-1 font-bold text-rose-600">
                  <CalendarX className="w-3.5 h-3.5" /> Inscripciones cerradas ({formatShortDate(ch.registrationClosesAt)})
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-slate-600">
                  <CalendarClock className="w-3.5 h-3.5 text-[#0284C7]" /> Cierra el{' '}
                  <b className="text-slate-800">{formatShortDate(ch.registrationClosesAt)}</b>
                </span>
              )
            ) : (
              <span className="inline-flex items-center gap-1 text-slate-400">
                <CalendarClock className="w-3.5 h-3.5" /> Sin fecha de cierre
              </span>
            )}
          </div>
          {ch.schedule && <p className="text-[11px] text-slate-500 line-clamp-1">{ch.schedule}</p>}
          <div className="flex items-center gap-1.5 pt-2 mt-auto border-t border-slate-100">
            <Button size="sm" variant="secondary" icon={Users} className="flex-1" onClick={() => setDetailId(ch.id)}>
              Ver inscritos{entries.length ? ` (${entries.filter((e) => e.status !== 'cancelled').length})` : ''}
            </Button>
            {canUpdate && (
              <button
                type="button"
                onClick={() => openForm(ch)}
                className="p-2 rounded-xl text-slate-500 hover:text-[#0284C7] hover:bg-sky-50 cursor-pointer"
                aria-label={`Editar ${ch.name}`}
                title="Editar"
              >
                <Edit2 className="w-4 h-4" />
              </button>
            )}
            {canDelete && (
              <button
                type="button"
                onClick={() => remove(ch)}
                disabled={!!deletingId}
                className="p-2 rounded-xl text-slate-500 hover:text-red-600 hover:bg-red-50 cursor-pointer disabled:opacity-50 disabled:cursor-wait"
                aria-label={`Eliminar ${ch.name}`}
                title="Eliminar"
              >
                {deletingId === ch.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
              </button>
            )}
          </div>
        </div>
      </Card>
    );
  };

  // Vista previa del formulario
  const previewChamp: Championship = {
    id: 'preview',
    campId: draft.campId,
    name: draft.name.trim() || 'Nombre del campeonato',
    sport: draft.sport.trim() || 'Disciplina',
    genderCategory: draft.genderCategory,
    mode: draft.mode,
    minTeamSize: Number(draft.minTeamSize) || undefined,
    maxTeamSize: Number(draft.maxTeamSize) || undefined,
    registrationFee: Math.max(0, Number(draft.registrationFee) || 0),
    maxTeamsOrParticipants: Math.max(0, Number(draft.maxTeamsOrParticipants) || 0),
    enrolledTeamsCount: draft.enrolledTeamsCount,
    registrationClosesAt: draft.registrationClosesAt || undefined,
    schedule: draft.schedule,
    prizeSummary: draft.prizeSummary,
    description: draft.description,
    imageUrl: draft.imageUrl || undefined,
  };

  const detailChamp = detailId ? championships.find((c) => c.id === detailId) : undefined;

  return (
    <AdminPage>
      <AdminPageHeader
        kicker="Actividades"
        title="Campeonatos y equipos"
        icon={Trophy}
        description="Cada campeonato pertenece a un campamento. Los jóvenes con el campamento pagado se inscriben solos o arman equipos e invitan con un enlace."
        actions={
          <>
            <CampFilterSelect className="w-full sm:w-72" />
            {canCreate && (
              <Button icon={Plus} onClick={() => openForm()} disabled={!camps.length} className="w-full sm:w-auto">
                Nuevo campeonato
              </Button>
            )}
          </>
        }
      />

      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3 sm:gap-4">
        <StatCard
          label="Campeonatos"
          value={scopedChamps.length}
          hint={`${scopedChamps.filter((c) => c.mode === 'team').length} por equipos · ${
            scopedChamps.filter((c) => c.mode !== 'team').length
          } individuales`}
          icon={Trophy}
          tone="amber"
        />
        <StatCard
          label="Inscripciones activas"
          value={activeEntries.length}
          hint={`${activeEntries.filter((e) => e.status === 'confirmed').length} confirmadas`}
          icon={Ticket}
          tone="sky"
        />
        <StatCard label="Equipos" value={teams.length} hint={`${teamMembers} integrantes en total`} icon={Users} tone="violet" />
        <StatCard
          label="Pagos extra por verificar"
          value={pendingPayments.length}
          hint={pendingPayments.length ? `${formatBs(pendingAmount)} pendientes` : 'Todo al día'}
          icon={Wallet}
          tone={pendingPayments.length ? 'rose' : 'emerald'}
        />
      </div>

      <Card className="p-3 sm:p-4 flex flex-col sm:flex-row gap-3">
        <SearchInput value={search} onChange={setSearch} placeholder="Buscar campeonato, disciplina o campamento…" className="flex-1" />
        <div className="flex gap-1.5 bg-slate-100 rounded-xl p-1 shrink-0">
          {(
            [
              ['ALL', 'Todos'],
              ['individual', 'Individual'],
              ['team', 'Por equipos'],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setModeFilter(id)}
              className={`flex-1 sm:flex-none px-3 py-1.5 rounded-lg text-[11px] font-bold whitespace-nowrap cursor-pointer transition-colors ${
                modeFilter === id ? 'bg-white text-[#0284C7] shadow-sm' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </Card>

      {groups.length === 0 ? (
        <Card>
          <EmptyState
            icon={Trophy}
            title={scopedChamps.length ? 'Sin resultados' : 'Aún no hay campeonatos'}
            description={
              scopedChamps.length
                ? 'Ningún campeonato coincide con la búsqueda.'
                : 'Crea campeonatos individuales o por equipos para el campamento.'
            }
            action={
              canCreate && !scopedChamps.length ? (
                <Button icon={Plus} onClick={() => openForm()} disabled={!camps.length}>
                  Nuevo campeonato
                </Button>
              ) : undefined
            }
          />
        </Card>
      ) : (
        groups.map((g) => (
          <section key={g.campId} className="space-y-3">
            <div className="flex flex-wrap items-center gap-2 px-1">
              <span className="w-8 h-8 rounded-xl bg-sky-50 text-[#0284C7] flex items-center justify-center">
                {g.camp ? <Tent className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4 text-amber-500" />}
              </span>
              <div className="min-w-0">
                <h3 className="text-sm font-black text-slate-900 leading-tight">
                  {g.camp ? g.camp.name : 'Sin campamento válido'}
                  {g.camp?.isFeatured && <span className="ml-1.5 text-amber-500">★</span>}
                </h3>
                <p className="text-[11px] text-slate-500">
                  {g.camp
                    ? `${formatDateRange(g.camp.startDate, g.camp.endDate)} · ${g.items.length} campeonato${g.items.length === 1 ? '' : 's'}`
                    : 'Edítalos y asígnales un campamento.'}
                </p>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">{g.items.map(renderCard)}</div>
          </section>
        ))
      )}

      {/* ════════ Modal: crear / editar ════════ */}
      <Modal
        open={formOpen}
        onClose={() => !saving && setFormOpen(false)}
        size="xl"
        icon={Trophy}
        title={draft.id ? 'Editar campeonato' : 'Nuevo campeonato'}
        subtitle={
          draft.id
            ? `${editingOriginal?.name || ''} · ${draft.enrolledTeamsCount} inscripciones activas`
            : 'Define la modalidad, el cupo y el costo extra para los jóvenes inscritos al campamento.'
        }
        footer={
          <>
            <Button variant="secondary" onClick={() => setFormOpen(false)} disabled={saving}>
              Cancelar
            </Button>
            <Button
              icon={saving ? Loader2 : CheckCircle2}
              onClick={save}
              disabled={saving}
              className={saving ? '[&>svg]:animate-spin' : ''}
            >
              {saving ? 'Guardando…' : draft.id ? 'Guardar cambios' : 'Crear campeonato'}
            </Button>
          </>
        }
      >
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
          <div className="lg:col-span-3 space-y-4">
            <FormSection title="Campamento y datos" icon={Tent}>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field label="Campamento" required error={errors.campId} className="sm:col-span-2">
                  <SelectInput value={draft.campId} onChange={(e) => set('campId', e.target.value)}>
                    <option value="">Selecciona un campamento…</option>
                    {draft.campId && !draftCamp && <option value={draft.campId}>Campamento eliminado</option>}
                    {sortedCamps.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.isFeatured ? '★ ' : ''}
                        {c.name} · {formatDateRange(c.startDate, c.endDate)}
                      </option>
                    ))}
                  </SelectInput>
                </Field>
                <Field label="Nombre" required error={errors.name} className="sm:col-span-2">
                  <TextInput
                    value={draft.name}
                    onChange={(e) => set('name', e.target.value)}
                    placeholder="Ej. Fútbol de salón varones"
                  />
                </Field>
                <Field label="Disciplina">
                  <TextInput
                    value={draft.sport}
                    onChange={(e) => set('sport', e.target.value)}
                    placeholder="Ej. Fútbol, Vóley, Olimpiada bíblica"
                  />
                </Field>
                <Field label="Categoría">
                  <SelectInput value={draft.genderCategory} onChange={(e) => set('genderCategory', e.target.value as Gender)}>
                    <option value="Varonil">Varonil</option>
                    <option value="Femenil">Femenil</option>
                    <option value="Mixto">Mixto</option>
                  </SelectInput>
                </Field>
              </div>
            </FormSection>

            <FormSection
              title="Modalidad y cupo"
              icon={Users}
              description="En equipos, el capitán paga la inscripción e invita a sus compañeros con un enlace."
            >
              <Segmented<ChampionshipMode>
                value={draft.mode}
                disabled={modeLocked}
                onChange={(v) => set('mode', v)}
                options={[
                  { id: 'individual', label: 'Individual', icon: UserIcon, hint: 'Cada joven compite solo' },
                  { id: 'team', label: 'Por equipos', icon: Users, hint: 'Un capitán arma su equipo' },
                ]}
              />
              {modeLocked && (
                <p className="flex items-center gap-1.5 text-[11px] text-amber-700">
                  <Lock className="w-3.5 h-3.5" /> No se puede cambiar la modalidad porque ya hay inscripciones activas.
                </p>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {isTeam && (
                  <>
                    <Field label="Mín. integrantes" required error={errors.minTeamSize} hint="Incluye al capitán">
                      <TextInput
                        type="number"
                        min={2}
                        value={draft.minTeamSize}
                        onChange={(e) => set('minTeamSize', e.target.value)}
                      />
                    </Field>
                    <Field label="Máx. integrantes" required error={errors.maxTeamSize}>
                      <TextInput
                        type="number"
                        min={2}
                        value={draft.maxTeamSize}
                        onChange={(e) => set('maxTeamSize', e.target.value)}
                      />
                    </Field>
                  </>
                )}
                <Field
                  label={isTeam ? 'Cupo de equipos' : 'Cupo de participantes'}
                  required
                  error={errors.maxTeamsOrParticipants}
                  hint={draft.enrolledTeamsCount > 0 ? `Inscripciones activas: ${draft.enrolledTeamsCount}` : undefined}
                  className={isTeam ? '' : 'sm:col-span-3'}
                >
                  <TextInput
                    type="number"
                    min={1}
                    value={draft.maxTeamsOrParticipants}
                    onChange={(e) => set('maxTeamsOrParticipants', e.target.value)}
                  />
                </Field>
              </div>
            </FormSection>

            <FormSection title="Costo e inscripciones" icon={Wallet}>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field
                  label={`Costo extra ${isTeam ? 'por equipo' : 'por persona'} (Bs)`}
                  required
                  hint="0 = gratis. Se paga aparte del campamento."
                  error={errors.registrationFee}
                >
                  <TextInput
                    type="number"
                    min={0}
                    inputMode="decimal"
                    value={draft.registrationFee}
                    onChange={(e) => set('registrationFee', e.target.value)}
                  />
                </Field>
                <Field
                  label="Cierre de inscripciones"
                  error={errors.registrationClosesAt}
                  hint={draftCamp ? `El campamento termina el ${formatShortDate(draftCamp.endDate)}.` : 'Opcional.'}
                >
                  <TextInput
                    type="date"
                    value={draft.registrationClosesAt}
                    max={draftCamp?.endDate}
                    onChange={(e) => set('registrationClosesAt', e.target.value)}
                  />
                </Field>
              </div>
            </FormSection>

            <FormSection title="Detalles" description="Información visible para los jóvenes." icon={CalendarClock}>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field label="Horario">
                  <TextInput
                    value={draft.schedule}
                    onChange={(e) => set('schedule', e.target.value)}
                    placeholder="Ej. Lunes y martes, 15:00 a 17:30"
                  />
                </Field>
                <Field label="Premios">
                  <TextInput
                    value={draft.prizeSummary}
                    onChange={(e) => set('prizeSummary', e.target.value)}
                    placeholder="Ej. Trofeo, medallas y diplomas"
                  />
                </Field>
                <Field label="Descripción" className="sm:col-span-2">
                  <TextArea
                    value={draft.description}
                    onChange={(e) => set('description', e.target.value)}
                    placeholder="Reglas, formato del torneo, requisitos…"
                  />
                </Field>
              </div>
            </FormSection>

            <FormSection title="Imagen" description="Opcional. Se muestra en la tarjeta del campeonato." icon={ImageIcon}>
              <ImageInput value={draft.imageUrl} onChange={(v) => set('imageUrl', v)} />
            </FormSection>
          </div>

          {/* Vista previa */}
          <div className="lg:col-span-2">
            <div className="lg:sticky lg:top-0 space-y-2">
              <p className="text-[11px] font-black uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                <Eye className="w-3.5 h-3.5" /> Vista previa
              </p>
              <div className="pointer-events-none">
                <Card className="overflow-hidden">
                  <div className="relative h-36 bg-gradient-to-br from-sky-500 via-sky-600 to-indigo-600">
                    {previewChamp.imageUrl ? (
                      <img src={previewChamp.imageUrl} alt="" className="absolute inset-0 w-full h-full object-cover" />
                    ) : (
                      <Trophy className="absolute right-4 bottom-3 w-16 h-16 text-white/20" />
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-slate-950/70 to-transparent" />
                    <div className="absolute top-3 left-3 flex flex-wrap gap-1.5 [&>span]:bg-white/95">
                      <ModeBadge ch={previewChamp} />
                      <Badge className={GENDER_CLASS[previewChamp.genderCategory]}>{previewChamp.genderCategory}</Badge>
                    </div>
                    <div className="absolute bottom-3 left-4 right-4">
                      <h4 className="text-white font-black text-base leading-tight line-clamp-2">{previewChamp.name}</h4>
                      <p className="text-white/80 text-[11px] font-semibold">{previewChamp.sport}</p>
                    </div>
                  </div>
                  <div className="p-4 space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <span
                        className={`text-sm font-black font-mono ${
                          previewChamp.registrationFee > 0 ? 'text-slate-900' : 'text-emerald-600'
                        }`}
                      >
                        {championshipFeeText(previewChamp)}
                      </span>
                      {draftCamp && (
                        <span className="text-[10px] text-slate-500 truncate inline-flex items-center gap-1">
                          <Tent className="w-3 h-3 text-[#0284C7]" /> {draftCamp.name}
                        </span>
                      )}
                    </div>
                    <CupoBar
                      used={previewChamp.enrolledTeamsCount}
                      max={previewChamp.maxTeamsOrParticipants}
                      unit={isTeam ? 'equipos' : 'participantes'}
                    />
                    <div className="text-[11px] text-slate-600 space-y-1">
                      <p className="flex items-center gap-1.5">
                        <CalendarClock className="w-3.5 h-3.5 text-[#0284C7]" />
                        {previewChamp.registrationClosesAt
                          ? `Inscripciones hasta el ${formatShortDate(previewChamp.registrationClosesAt)}`
                          : 'Inscripciones abiertas mientras haya cupo'}
                      </p>
                      {previewChamp.schedule && (
                        <p className="flex items-center gap-1.5">
                          <Clock className="w-3.5 h-3.5 text-slate-400" /> {previewChamp.schedule}
                        </p>
                      )}
                      {previewChamp.prizeSummary && (
                        <p className="flex items-center gap-1.5">
                          <Medal className="w-3.5 h-3.5 text-amber-500" /> {previewChamp.prizeSummary}
                        </p>
                      )}
                    </div>
                    {previewChamp.description && (
                      <p className="text-[11px] text-slate-500 line-clamp-3">{previewChamp.description}</p>
                    )}
                  </div>
                </Card>
              </div>
              {isTeam && (
                <div className="rounded-2xl bg-indigo-50/70 border border-indigo-100 p-3 text-[11px] text-indigo-800 leading-relaxed">
                  <b>Cómo funciona:</b> el capitán crea el equipo
                  {previewChamp.registrationFee > 0 ? ` y paga ${formatBs(previewChamp.registrationFee)}` : ''}; luego comparte el
                  enlace de invitación hasta completar {previewChamp.minTeamSize || '?'}–{previewChamp.maxTeamSize || '?'}{' '}
                  integrantes.
                </div>
              )}
            </div>
          </div>
        </div>
      </Modal>

      {/* ════════ Modal: inscritos ════════ */}
      <EntriesModal championship={detailChamp} onClose={() => setDetailId(null)} />
    </AdminPage>
  );
};

// =========================================================
// Modal de inscritos (individuales o equipos)
// =========================================================

const EntriesModal: React.FC<{ championship?: Championship; onClose: () => void }> = ({ championship: ch, onClose }) => {
  const {
    championshipEntries,
    registrations,
    getCampById,
    getTribeById,
    approveEntryPayment,
    rejectEntryPayment,
    collectEntryPayment,
    cancelChampionshipEntry,
    removeTeamMember,
    setSelectedCamperForBadge,
  } = useCamp();
  const { can } = useAuth();
  const { confirm } = useConfirm();
  const canVerify = can('payments:verify');
  const canCollect = can('payments:collect');
  const canManage = can('championships:update');

  const [filter, setFilter] = useState<'active' | 'all' | 'cancelled'>('active');
  const [search, setSearch] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [rejectFor, setRejectFor] = useState<ChampionshipEntry | null>(null);
  const [reason, setReason] = useState('');
  const [reasonError, setReasonError] = useState('');
  const [copied, setCopied] = useState<string | null>(null);

  const entries = useMemo(
    () => (ch ? championshipEntries.filter((e) => e.championshipId === ch.id) : []),
    [championshipEntries, ch]
  );

  if (!ch) return null;

  const camp = getCampById(ch.campId);
  const isTeam = ch.mode === 'team';
  const regOf = (id: string) => registrations.find((r) => r.id === id);

  const visible = entries
    .filter((e) => (filter === 'all' ? true : filter === 'cancelled' ? e.status === 'cancelled' : e.status !== 'cancelled'))
    .filter((e) => {
      const q = normalize(search);
      if (!q) return true;
      return (
        normalize(e.teamName).includes(q) ||
        normalize(e.inviteCode).includes(q) ||
        e.members.some((m) => normalize(m.fullName).includes(q) || normalize(regOf(m.registrationId)?.documentId).includes(q))
      );
    })
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  const active = entries.filter((e) => e.status !== 'cancelled');
  const collected = active.filter((e) => e.payment.status === 'completed').reduce((acc, e) => acc + (e.payment.amount || 0), 0);

  const run = async (key: string, fn: () => Promise<unknown>) => {
    if (busy) return;
    setBusy(key);
    try {
      await fn();
    } finally {
      setBusy(null);
    }
  };

  const label = (e: ChampionshipEntry) => (e.type === 'team' ? `el equipo «${e.teamName}»` : e.members[0]?.fullName || 'la inscripción');

  const approve = async (e: ChampionshipEntry) => {
    const ok = await confirm({
      title: 'Aprobar pago extra',
      message: <>Se confirmará la inscripción de {label(e)} a {ch.name}.</>,
      details: [
        <>
          Monto: <b className="font-mono">{formatBs(e.payment.amount)}</b> · {METHOD_LABEL[e.payment.method]}
        </>,
        e.payment.voucherReferenceNumber ? <>Referencia: <span className="font-mono">{e.payment.voucherReferenceNumber}</span></> : 'Sin referencia',
      ],
      tone: e.payment.status === 'rejected' ? 'warning' : 'success',
      confirmText: 'Sí, aprobar',
    });
    if (ok) await run(`approve:${e.id}`, () => approveEntryPayment(e.id));
  };

  const collect = async (e: ChampionshipEntry) => {
    const ok = await confirm({
      title: 'Cobrar en caja',
      message: <>Registrar el cobro en efectivo de {label(e)}.</>,
      details: [<>Monto a cobrar: <b className="font-mono">{formatBs(e.payment.amount)}</b></>],
      tone: 'info',
      confirmText: 'Confirmar cobro',
    });
    if (ok) await run(`collect:${e.id}`, () => collectEntryPayment(e.id));
  };

  const cancel = async (e: ChampionshipEntry) => {
    const ok = await confirm({
      title: `¿Anular la inscripción de ${label(e)}?`,
      message: 'Se liberará el cupo y los integrantes dejarán de figurar en el campeonato.',
      details:
        e.payment.status === 'completed' && e.payment.amount > 0
          ? [<>El pago extra de <b>{formatBs(e.payment.amount)}</b> ya fue confirmado: coordina la devolución con tesorería.</>]
          : undefined,
      tone: 'danger',
      confirmText: 'Sí, anular',
    });
    if (ok) await run(`cancel:${e.id}`, () => cancelChampionshipEntry(e.id));
  };

  const removeMember = async (e: ChampionshipEntry, m: TeamMember) => {
    const ok = await confirm({
      title: `¿Quitar a ${m.fullName} del equipo?`,
      message: <>Dejará de formar parte de «{e.teamName}». Se le notificará.</>,
      tone: 'warning',
      confirmText: 'Sí, quitar',
    });
    if (ok) await run(`member:${e.id}:${m.registrationId}`, () => removeTeamMember(e.id, m.registrationId));
  };

  const openBadge = (registrationId: string) => {
    const reg = regOf(registrationId);
    if (!reg) return;
    onClose();
    setSelectedCamperForBadge(reg);
  };

  const submitReject = async () => {
    if (!rejectFor) return;
    if (reason.trim().length < 5) {
      setReasonError('Describe el motivo (mínimo 5 caracteres).');
      return;
    }
    let ok = false;
    await run(`reject:${rejectFor.id}`, async () => {
      ok = !!(await rejectEntryPayment(rejectFor.id, reason.trim()));
    });
    if (ok) setRejectFor(null);
  };

  const copyCode = async (code: string) => {
    const link = `${window.location.origin}/equipo/${code}`;
    try {
      await navigator.clipboard.writeText(link);
      setCopied(code);
      setTimeout(() => setCopied(null), 1800);
    } catch {
      /* sin portapapeles */
    }
  };

  const tribeDot = (tribeId?: string) => {
    const t = tribeId ? getTribeById(tribeId) : undefined;
    return (
      <span
        className="w-2.5 h-2.5 rounded-full shrink-0 ring-2 ring-white"
        style={{ backgroundColor: t?.colorHex || '#CBD5E1' }}
        title={t ? `Tribu ${t.name}` : 'Sin tribu'}
      />
    );
  };

  const spinIf = (key: string) => (busy === key ? Loader2 : undefined);

  const paymentActions = (e: ChampionshipEntry) => {
    if (e.status === 'cancelled' || e.payment.status === 'completed') return null;
    const p = e.payment.status;
    return (
      <>
        {canVerify && (p === 'pending_verification' || p === 'rejected') && (
          <Button
            size="sm"
            icon={spinIf(`approve:${e.id}`) || CheckCircle2}
            className={`!bg-emerald-600 hover:!bg-emerald-700 ${busy === `approve:${e.id}` ? '[&>svg]:animate-spin' : ''}`}
            disabled={!!busy}
            onClick={() => approve(e)}
          >
            {p === 'rejected' ? 'Aprobar de todos modos' : 'Aprobar'}
          </Button>
        )}
        {canVerify && p === 'pending_verification' && (
          <Button
            size="sm"
            variant="danger"
            icon={Ban}
            disabled={!!busy}
            onClick={() => {
              setRejectFor(e);
              setReason('');
              setReasonError('');
            }}
          >
            Rechazar
          </Button>
        )}
        {canCollect && (p === 'pending_cash' || p === 'rejected') && (
          <Button
            size="sm"
            variant="amber"
            icon={spinIf(`collect:${e.id}`) || Banknote}
            className={busy === `collect:${e.id}` ? '[&>svg]:animate-spin' : ''}
            disabled={!!busy}
            onClick={() => collect(e)}
          >
            Cobrar
          </Button>
        )}
      </>
    );
  };

  const paymentBlock = (e: ChampionshipEntry) => {
    const p = e.payment;
    const free = p.method === 'free' || p.amount <= 0;
    return (
      <div className="flex items-start gap-3 rounded-2xl bg-slate-50 border border-slate-100 p-3">
        {p.voucherImageUrl ? (
          <button
            type="button"
            onClick={() => openImageInNewTab(p.voucherImageUrl!)}
            className="w-12 h-14 rounded-lg overflow-hidden border border-slate-200 bg-white shrink-0 cursor-zoom-in"
            title="Ver comprobante"
          >
            <img src={p.voucherImageUrl} alt="Comprobante" className="w-full h-full object-cover" />
          </button>
        ) : (
          <div className="w-12 h-14 rounded-lg border border-dashed border-slate-200 bg-white shrink-0 flex items-center justify-center text-slate-300">
            {p.method === 'cash_box' ? <Banknote className="w-4 h-4" /> : p.method === 'qr_bank' ? <QrCode className="w-4 h-4" /> : free ? <CheckCircle2 className="w-4 h-4" /> : <Landmark className="w-4 h-4" />}
          </div>
        )}
        <div className="min-w-0 flex-1 text-[11px] space-y-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <PayStatusBadge payment={p} />
            {!free && (
              <>
                <span className="font-mono font-black text-slate-900">{formatBs(p.amount)}</span>
                <span className="text-slate-500">· {METHOD_LABEL[p.method]}</span>
              </>
            )}
          </div>
          {!free && (
            <div className="text-slate-500 font-mono truncate">
              Folio {p.folio}
              {p.voucherReferenceNumber ? ` · Ref. ${p.voucherReferenceNumber}` : ''}
            </div>
          )}
          {p.status === 'rejected' && p.rejectionReason && (
            <div className="text-rose-600 flex gap-1">
              <AlertTriangle className="w-3 h-3 shrink-0 mt-0.5" /> {p.rejectionReason}
            </div>
          )}
          {p.status === 'completed' && !free && (p.verifiedBy || p.collectedBy) && (
            <div className="text-emerald-700">
              {p.collectedBy ? `Cobrado por ${p.collectedBy}` : `Verificado por ${p.verifiedBy}`}
            </div>
          )}
        </div>
      </div>
    );
  };

  const counts = {
    active: active.length,
    all: entries.length,
    cancelled: entries.length - active.length,
  };

  return (
    <>
      <Modal
        open={!!ch && !rejectFor}
        onClose={() => !busy && onClose()}
        size="xl"
        icon={isTeam ? Users : Trophy}
        title={`Inscritos · ${ch.name}`}
        subtitle={`${camp?.name || 'Sin campamento'} · ${modeLabel(ch)} · ${ch.enrolledTeamsCount}/${ch.maxTeamsOrParticipants} ${
          isTeam ? 'equipos' : 'participantes'
        } · ${championshipFeeText(ch)}`}
        footer={
          <Button variant="secondary" onClick={onClose} disabled={!!busy}>
            Cerrar
          </Button>
        }
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {[
              { k: 'Confirmadas', v: active.filter((e) => e.status === 'confirmed').length, cls: 'text-emerald-600' },
              { k: 'Pago pendiente', v: active.filter((e) => e.status === 'pending_payment').length, cls: 'text-amber-600' },
              { k: 'Anuladas', v: counts.cancelled, cls: 'text-slate-500' },
              { k: 'Cobrado', v: formatBs(collected), cls: 'text-[#0284C7]' },
            ].map((s) => (
              <div key={s.k} className="rounded-2xl border border-slate-100 bg-slate-50/70 px-3 py-2">
                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{s.k}</div>
                <div className={`text-lg font-black font-mono tabular-nums ${s.cls}`}>{s.v}</div>
              </div>
            ))}
          </div>

          <div className="flex flex-col sm:flex-row gap-2">
            <SearchInput
              value={search}
              onChange={setSearch}
              placeholder={isTeam ? 'Buscar equipo, integrante, CI o código…' : 'Buscar por nombre o CI…'}
              className="flex-1"
            />
            <div className="flex gap-1 bg-slate-100 rounded-xl p-1 shrink-0">
              {(
                [
                  ['active', 'Activas'],
                  ['cancelled', 'Anuladas'],
                  ['all', 'Todas'],
                ] as const
              ).map(([id, l]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setFilter(id)}
                  className={`flex-1 sm:flex-none px-3 py-1.5 rounded-lg text-[11px] font-bold whitespace-nowrap cursor-pointer ${
                    filter === id ? 'bg-white text-[#0284C7] shadow-sm' : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  {l} <span className="font-mono">({counts[id]})</span>
                </button>
              ))}
            </div>
          </div>

          {visible.length === 0 ? (
            <EmptyState
              icon={isTeam ? Users : UserIcon}
              title={entries.length ? 'Sin resultados' : 'Aún no hay inscritos'}
              description={
                entries.length
                  ? 'Prueba con otro filtro o búsqueda.'
                  : isTeam
                  ? 'Cuando un capitán cree su equipo aparecerá aquí.'
                  : 'Cuando un joven se inscriba aparecerá aquí.'
              }
            />
          ) : isTeam ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {visible.map((e) => {
                const captain = e.members.find((m) => m.role === 'captain') || e.members[0];
                const max = ch.maxTeamSize || e.members.length;
                const min = ch.minTeamSize || 0;
                const incomplete = e.members.length < min;
                return (
                  <Card key={e.id} className={`p-4 space-y-3 ${e.status === 'cancelled' ? 'opacity-70' : ''}`}>
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="text-sm font-black text-slate-900 truncate">{e.teamName || 'Equipo sin nombre'}</div>
                        <div className="text-[11px] text-slate-500 flex items-center gap-1 mt-0.5">
                          <Crown className="w-3 h-3 text-amber-500" /> {captain?.fullName || '—'}
                        </div>
                      </div>
                      <EntryStatusBadge status={e.status} />
                    </div>

                    <div className="flex flex-wrap items-center gap-2 text-[11px]">
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border font-bold ${
                          incomplete ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-sky-50 text-sky-700 border-sky-200'
                        }`}
                        title={incomplete ? `Faltan ${min - e.members.length} para el mínimo` : undefined}
                      >
                        <Users className="w-3 h-3" /> {e.members.length}/{max}
                        {incomplete && ` · mín. ${min}`}
                      </span>
                      {e.inviteCode && (
                        <button
                          type="button"
                          onClick={() => copyCode(e.inviteCode!)}
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full border border-slate-200 bg-white font-mono font-bold text-slate-700 hover:border-sky-300 hover:text-[#0284C7] cursor-pointer"
                          title="Copiar enlace de invitación"
                        >
                          {copied === e.inviteCode ? <CheckCircle2 className="w-3 h-3 text-emerald-600" /> : <Link2 className="w-3 h-3" />}
                          {e.inviteCode}
                          {copied !== e.inviteCode && <Copy className="w-3 h-3 text-slate-400" />}
                        </button>
                      )}
                    </div>

                    <ul className="rounded-2xl border border-slate-100 divide-y divide-slate-100">
                      {e.members.map((m) => {
                        const reg = regOf(m.registrationId);
                        const memberBusy = busy === `member:${e.id}:${m.registrationId}`;
                        return (
                          <li key={m.registrationId} className="flex items-center gap-2 px-3 py-2">
                            {tribeDot(m.tribeId)}
                            <div className="min-w-0 flex-1">
                              <div className="text-xs font-bold text-slate-800 truncate">
                                {m.fullName}
                                {m.role === 'captain' && (
                                  <span className="ml-1.5 text-[9px] font-black uppercase text-amber-600">Capitán</span>
                                )}
                              </div>
                              {reg && <div className="text-[10px] text-slate-400 font-mono">CI {reg.documentId || '—'}</div>}
                            </div>
                            {reg && (
                              <button
                                type="button"
                                onClick={() => openBadge(m.registrationId)}
                                className="p-1.5 rounded-lg text-slate-400 hover:text-[#0284C7] hover:bg-sky-50 cursor-pointer"
                                title="Ver credencial"
                                aria-label={`Ver credencial de ${m.fullName}`}
                              >
                                <QrCode className="w-3.5 h-3.5" />
                              </button>
                            )}
                            {canManage && m.role !== 'captain' && e.status !== 'cancelled' && (
                              <button
                                type="button"
                                onClick={() => removeMember(e, m)}
                                disabled={!!busy}
                                className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 cursor-pointer disabled:opacity-50"
                                title="Quitar del equipo"
                                aria-label={`Quitar a ${m.fullName}`}
                              >
                                {memberBusy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <UserMinus className="w-3.5 h-3.5" />}
                              </button>
                            )}
                          </li>
                        );
                      })}
                    </ul>

                    {paymentBlock(e)}

                    <div className="flex flex-wrap gap-1.5 justify-end">
                      {paymentActions(e)}
                      {canManage && e.status !== 'cancelled' && (
                        <Button
                          size="sm"
                          variant="ghost"
                          icon={spinIf(`cancel:${e.id}`) || XCircle}
                          className={busy === `cancel:${e.id}` ? '[&>svg]:animate-spin' : ''}
                          disabled={!!busy}
                          onClick={() => cancel(e)}
                        >
                          Anular
                        </Button>
                      )}
                    </div>
                  </Card>
                );
              })}
            </div>
          ) : (
            <ul className="space-y-2">
              {visible.map((e) => {
                const m = e.members[0];
                const reg = m ? regOf(m.registrationId) : undefined;
                const tribe = m?.tribeId ? getTribeById(m.tribeId) : undefined;
                return (
                  <li
                    key={e.id}
                    className={`rounded-2xl border border-slate-100 bg-white p-3 flex flex-col lg:flex-row lg:items-center gap-3 ${
                      e.status === 'cancelled' ? 'opacity-70' : ''
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0 lg:w-64 shrink-0">
                      <span
                        className="w-9 h-9 rounded-2xl flex items-center justify-center text-[11px] font-black text-white shrink-0"
                        style={{ backgroundColor: tribe?.colorHex || '#0284C7' }}
                      >
                        {initials(m?.fullName || '?')}
                      </span>
                      <div className="min-w-0">
                        <div className="text-xs font-bold text-slate-900 truncate">{m?.fullName || '—'}</div>
                        <div className="text-[10px] text-slate-500 truncate">
                          {tribe ? `Tribu ${tribe.name}` : 'Sin tribu'}
                          {reg ? ` · CI ${reg.documentId || '—'}` : ''}
                        </div>
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">{paymentBlock(e)}</div>
                    <div className="flex flex-wrap items-center gap-1.5 lg:justify-end lg:w-56 shrink-0">
                      <EntryStatusBadge status={e.status} />
                      {reg && (
                        <Button size="sm" variant="ghost" icon={QrCode} onClick={() => openBadge(reg.id)}>
                          Credencial
                        </Button>
                      )}
                      {paymentActions(e)}
                      {canManage && e.status !== 'cancelled' && (
                        <Button
                          size="sm"
                          variant="ghost"
                          icon={spinIf(`cancel:${e.id}`) || XCircle}
                          className={busy === `cancel:${e.id}` ? '[&>svg]:animate-spin' : ''}
                          disabled={!!busy}
                          onClick={() => cancel(e)}
                        >
                          Anular
                        </Button>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}

          {!canVerify && !canCollect && (
            <p className="text-[11px] text-slate-400 flex items-center gap-1">
              <Lock className="w-3 h-3" /> Los pagos extra los aprueba o cobra tesorería en «Pagos y caja».
            </p>
          )}
        </div>
      </Modal>

      {/* Motivo del rechazo */}
      <Modal
        open={!!rejectFor}
        onClose={() => !busy && setRejectFor(null)}
        size="sm"
        icon={Ban}
        title="Rechazar comprobante"
        subtitle={rejectFor ? `${label(rejectFor)} · ${formatBs(rejectFor.payment.amount)}` : undefined}
        footer={
          <>
            <Button variant="secondary" onClick={() => setRejectFor(null)} disabled={!!busy}>
              Volver
            </Button>
            <Button
              icon={busy?.startsWith('reject:') ? Loader2 : Ban}
              className={`!bg-red-600 hover:!bg-red-700 ${busy?.startsWith('reject:') ? '[&>svg]:animate-spin' : ''}`}
              disabled={!!busy}
              onClick={submitReject}
            >
              Confirmar rechazo
            </Button>
          </>
        }
      >
        <Field label="Motivo" required error={reasonError} hint="El capitán verá este motivo y podrá reenviar su comprobante.">
          <TextArea
            autoFocus
            value={reason}
            onChange={(e) => {
              setReason(e.target.value);
              setReasonError('');
            }}
            placeholder="Ej.: El monto depositado no coincide con el costo del equipo."
          />
        </Field>
      </Modal>
    </>
  );
};
