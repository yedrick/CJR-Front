import React, { useMemo, useState } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  BookOpen,
  CheckCircle2,
  Church,
  Clock,
  Crown,
  Edit3,
  Eye,
  HeartPulse,
  History,
  IdCard,
  Loader2,
  Lock,
  MapPin,
  Phone,
  Receipt,
  Shield,
  Tent,
  Trash2,
  Trophy,
  UserRound,
  Users,
  Wallet,
  XCircle,
} from 'lucide-react';
import { useCamp } from '../../context/CampContext';
import type { CampCourse, CamperRegistration, ChampionshipEntry, ExtraPayment, PaymentTransaction } from '../../types/camp';
import { coursesOverlap, formatCourseSchedule, formatDateRange, formatLongDate, initials, formatBs, digitsOf, normalizeText, isPaymentPending } from '../../utils/campUtils';
import { useConfirm } from '../common/ConfirmDialog';
import { useAuth } from '../../context/AuthContext';
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
  Modal,
  SearchInput,
  SelectInput,
  Table,
  TextInput,
} from './ui';

const PAYMENT_STATUS: Record<PaymentTransaction['status'], { label: string; className: string; icon: React.ElementType }> = {
  completed: { label: 'Pagado', className: 'bg-emerald-50 text-emerald-700 border-emerald-200', icon: CheckCircle2 },
  pending_cash: { label: 'Pendiente en caja', className: 'bg-amber-50 text-amber-700 border-amber-200', icon: Clock },
  pending_verification: { label: 'Por verificar', className: 'bg-violet-50 text-violet-700 border-violet-200', icon: Clock },
  rejected: { label: 'Comprobante rechazado', className: 'bg-red-50 text-red-700 border-red-200', icon: XCircle },
  refunded: { label: 'Reembolsado', className: 'bg-slate-100 text-slate-500 border-slate-200', icon: Receipt },
};

const PAYMENT_METHOD: Record<PaymentTransaction['paymentMethod'], string> = {
  qr_bank: 'QR bancario',
  transfer: 'Transferencia',
  cash_box: 'Efectivo en caja',
};

const REG_STATUS: Record<CamperRegistration['status'], { label: string; className: string }> = {
  active: { label: 'Inscripción activa', className: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  pending_payment: { label: 'Pendiente de pago', className: 'bg-amber-50 text-amber-700 border-amber-200' },
  cancelled: { label: 'Cancelada', className: 'bg-slate-100 text-slate-500 border-slate-200' },
};

type PaymentFilter = 'ALL' | 'pending' | PaymentTransaction['status'];

interface EditForm {
  phone: string;
  email: string;
  city: string;
  regional: string;
  subdirectivaNumber: string;
  churchCongregation: string;
  serviceAreaOfInterest: string;
  emergencyContactName: string;
  emergencyPhone: string;
  tribeId: string;
  enrolledCourseIds: string[];
}

type EditErrors = Partial<Record<'phone' | 'email' | 'emergencyPhone' | 'courses', string>>;

const PAGE_SIZE = 50;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;


const ENTRY_STATUS_META: Record<ChampionshipEntry['status'], { label: string; cls: string }> = {
  confirmed: { label: 'Confirmada', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  pending_payment: { label: 'Pago pendiente', cls: 'bg-amber-50 text-amber-700 border-amber-200' },
  cancelled: { label: 'Anulada', cls: 'bg-slate-100 text-slate-500 border-slate-200' },
};

const EXTRA_PAY_META: Record<ExtraPayment['status'], { label: string; cls: string }> = {
  completed: { label: 'pagado', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  pending_verification: { label: 'por verificar', cls: 'bg-violet-50 text-violet-700 border-violet-200' },
  pending_cash: { label: 'en caja', cls: 'bg-amber-50 text-amber-700 border-amber-200' },
  rejected: { label: 'rechazado', cls: 'bg-rose-50 text-rose-700 border-rose-200' },
};
/** Agrega una opción al catálogo si el valor actual no está (para no perder datos al editar). */
const withCurrent = (options: string[], current: string) =>
  current && !options.includes(current) ? [current, ...options] : options;

const ciLabel = (r: CamperRegistration) => {
  const doc = r.documentId || '—';
  if (!r.idExpedition || doc.toUpperCase().includes(r.idExpedition.toUpperCase())) return doc;
  return `${doc} ${r.idExpedition}`;
};

/** Dato de solo lectura para las fichas de detalle. */
const InfoItem: React.FC<{ label: string; value?: React.ReactNode; mono?: boolean; className?: string }> = ({
  label,
  value,
  mono,
  className = '',
}) => (
  <div className={`min-w-0 ${className}`}>
    <dt className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{label}</dt>
    <dd className={`text-xs font-semibold text-slate-800 break-words ${mono ? 'font-mono' : ''}`}>
      {value === undefined || value === null || value === '' ? <span className="text-slate-400 font-normal">—</span> : value}
    </dd>
  </div>
);

export const CampersRoster: React.FC = () => {
  const {
    registrations,
    tribes,
    courses,
    catalogs,
    adminCampFilter,
    getCampById,
    getTribeById,
    getCourseById,
    getChampionshipById,
    getCoursesForCamp,
    championshipEntries,
    updateRegistration,
    deleteRegistration,
    setSelectedCamperForBadge,
  } = useCamp();
  const { confirm } = useConfirm();
  const { can } = useAuth();
  const canEdit = can('registrations:update');
  const canDelete = can('registrations:delete');
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [regionalFilter, setRegionalFilter] = useState('ALL');
  const [tribeFilter, setTribeFilter] = useState('ALL');
  const [paymentFilter, setPaymentFilter] = useState<PaymentFilter>('ALL');
  const [courseFilter, setCourseFilter] = useState('ALL');
  const [visible, setVisible] = useState(PAGE_SIZE);

  const [editing, setEditing] = useState<CamperRegistration | null>(null);
  const [form, setForm] = useState<EditForm | null>(null);
  const [triedSave, setTriedSave] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);

  const isAllCamps = adminCampFilter === 'ALL';
  const sortedTribes = useMemo(() => [...tribes].sort((a, b) => a.number - b.number), [tribes]);
  const regionalNames = useMemo(
    () => [...new Set(catalogs.regionales.map((r) => r.name))].sort((a, b) => a.localeCompare(b, 'es')),
    [catalogs.regionales]
  );
  const subdirectivaNames = useMemo(
    () => [...new Set(catalogs.subdirectivas.map((s) => s.name))].sort((a, b) => a.localeCompare(b, 'es')),
    [catalogs.subdirectivas]
  );
  const cityNames = useMemo(
    () => [...new Set(catalogs.cities.map((c) => c.name))].sort((a, b) => a.localeCompare(b, 'es')),
    [catalogs.cities]
  );
  const serviceAreaNames = useMemo(
    () => [...new Set(catalogs.serviceAreas.map((a) => a.name))].sort((a, b) => a.localeCompare(b, 'es')),
    [catalogs.serviceAreas]
  );

  const courseOptions = useMemo(
    () =>
      (isAllCamps ? courses : courses.filter((c) => c.campId === adminCampFilter)).slice().sort((a, b) => {
        if (a.campId !== b.campId) return a.campId.localeCompare(b.campId);
        return a.title.localeCompare(b.title, 'es');
      }),
    [courses, isAllCamps, adminCampFilter]
  );
  const effectiveCourseFilter = courseOptions.some((c) => c.id === courseFilter) ? courseFilter : 'ALL';

  const campRegistrations = useMemo(
    () => (isAllCamps ? registrations : registrations.filter((r) => r.campId === adminCampFilter)),
    [registrations, isAllCamps, adminCampFilter]
  );

  const filtered = useMemo(() => {
    const q = normalizeText(search.trim());
    const qDigits = digitsOf(q);
    // El CI se compara solo por sus dígitos: "1234567", "1234567 LP" o "1234567-LP" encuentran al mismo joven.
    const digitSearch = qDigits.length >= 3 && !q.startsWith('cjn');
    return campRegistrations
      .filter((r) => {
        if (!q) return true;
        return (
          normalizeText(r.fullName).includes(q) ||
          normalizeText(r.documentId).includes(q) ||
          (r.ticketCode || '').toLowerCase().includes(q) ||
          (r.email || '').toLowerCase().includes(q) ||
          (digitSearch && (digitsOf(r.documentId).includes(qDigits) || digitsOf(r.phone).includes(qDigits)))
        );
      })
      .filter((r) => regionalFilter === 'ALL' || r.regional === regionalFilter)
      .filter((r) => tribeFilter === 'ALL' || r.tribeId === tribeFilter)
      .filter((r) => {
        if (paymentFilter === 'ALL') return true;
        if (paymentFilter === 'pending')
          return isPaymentPending(r.payment.status);
        return r.payment.status === paymentFilter;
      })
      .filter((r) => effectiveCourseFilter === 'ALL' || r.enrolledCourseIds.includes(effectiveCourseFilter))
      .sort((a, b) => b.registeredAt.localeCompare(a.registeredAt));
  }, [campRegistrations, search, regionalFilter, tribeFilter, paymentFilter, effectiveCourseFilter]);

  const summary = useMemo(() => {
    const paid = campRegistrations.filter((r) => r.payment.status === 'completed');
    return {
      total: campRegistrations.length,
      paid: paid.length,
      pending: campRegistrations.filter(
        (r) => isPaymentPending(r.payment.status)
      ).length,
      rejected: campRegistrations.filter((r) => r.payment.status === 'rejected').length,
      collected: paid.reduce((sum, r) => sum + (r.payment.totalAmount || 0), 0),
    };
  }, [campRegistrations]);

  const hasFilters =
    search.trim() !== '' ||
    regionalFilter !== 'ALL' ||
    tribeFilter !== 'ALL' ||
    paymentFilter !== 'ALL' ||
    effectiveCourseFilter !== 'ALL';

  const clearFilters = () => {
    setSearch('');
    setRegionalFilter('ALL');
    setTribeFilter('ALL');
    setPaymentFilter('ALL');
    setCourseFilter('ALL');
    setVisible(PAGE_SIZE);
  };

  const subdirectivaOf = (r: CamperRegistration) => {
    const reg = catalogs.regionales.find((x) => x.name === r.regional);
    const sub = reg ? catalogs.subdirectivas.find((s) => s.id === reg.subdirectivaId) : undefined;
    return sub?.name || r.subdirectivaNumber || '';
  };

  const coursesOf = (r: CamperRegistration) =>
    r.enrolledCourseIds.map((id) => getCourseById(id)).filter(Boolean) as CampCourse[];

  // ── Edición ─────────────────────────────────────────
  const openEdit = (r: CamperRegistration) => {
    setDetailId(null);
    setEditing(r);
    setTriedSave(false);
    setForm({
      phone: r.phone || '',
      email: r.email || '',
      city: r.city || '',
      regional: r.regional || '',
      subdirectivaNumber: r.subdirectivaNumber || subdirectivaOf(r) || '',
      churchCongregation: r.churchCongregation || '',
      serviceAreaOfInterest: r.serviceAreaOfInterest || '',
      emergencyContactName: r.emergencyContactName || '',
      emergencyPhone: r.emergencyPhone || '',
      tribeId: r.tribeId,
      enrolledCourseIds: [...r.enrolledCourseIds],
    });
  };

  const closeEdit = () => {
    if (saving) return;
    setEditing(null);
    setForm(null);
    setTriedSave(false);
  };

  const patch = (updates: Partial<EditForm>) => setForm((f) => (f ? { ...f, ...updates } : f));

  const changeRegional = (regional: string) => {
    const reg = catalogs.regionales.find((x) => x.name === regional);
    const sub = reg ? catalogs.subdirectivas.find((s) => s.id === reg.subdirectivaId) : undefined;
    const city = sub ? catalogs.cities.find((c) => c.id === sub.cityId) : undefined;
    patch({
      regional,
      ...(sub ? { subdirectivaNumber: sub.name } : {}),
      ...(city ? { city: city.name } : {}),
    });
  };

  const editCamp = editing ? getCampById(editing.campId) : undefined;
  const editCourses = editing ? getCoursesForCamp(editing.campId) : [];
  const maxCourses = editCamp?.maxCoursesPerCamper || 0;

  const toggleCourse = (courseId: string) => {
    if (!form) return;
    const has = form.enrolledCourseIds.includes(courseId);
    patch({
      enrolledCourseIds: has
        ? form.enrolledCourseIds.filter((id) => id !== courseId)
        : [...form.enrolledCourseIds, courseId],
    });
  };

  const validateEdit = (f: EditForm): EditErrors => {
    const e: EditErrors = {};
    if (digitsOf(f.phone).length < 7) e.phone = 'Ingresa un número de WhatsApp válido (mínimo 7 dígitos).';
    if (f.email.trim() && !EMAIL_RE.test(f.email.trim())) e.email = 'El correo no tiene un formato válido.';
    if (f.emergencyPhone.trim() && digitsOf(f.emergencyPhone).length < 7)
      e.emergencyPhone = 'El teléfono de emergencia debe tener al menos 7 dígitos.';
    if (maxCourses > 0 && f.enrolledCourseIds.length > maxCourses)
      e.courses = `Este campamento permite como máximo ${maxCourses} ${maxCourses === 1 ? 'taller' : 'talleres'}.`;
    return e;
  };
  const editErrors: EditErrors = form && triedSave ? validateEdit(form) : {};
  const editErrorCount = Object.keys(editErrors).length;

  const handleSave = async (ev?: React.FormEvent) => {
    ev?.preventDefault();
    if (!editing || !form || saving || !canEdit) return;
    setTriedSave(true);
    if (Object.keys(validateEdit(form)).length > 0) return;

    // El servidor recalcula los cupos de los talleres, valida choques de horario y regenera el QR si cambia la tribu
    setSaving(true);
    const updated = await updateRegistration(editing.id, {
      phone: form.phone.trim(),
      email: form.email.trim(),
      city: form.city || undefined,
      regional: form.regional,
      subdirectivaNumber: form.subdirectivaNumber.trim() || undefined,
      churchCongregation: form.churchCongregation.trim() || undefined,
      serviceAreaOfInterest: form.serviceAreaOfInterest || undefined,
      emergencyContactName: form.emergencyContactName.trim() || undefined,
      emergencyPhone: form.emergencyPhone.trim() || undefined,
      tribeId: form.tribeId,
      enrolledCourseIds: form.enrolledCourseIds,
    }).finally(() => setSaving(false));
    if (!updated) return; // 403/409/422: el aviso ya se mostró y el formulario queda abierto
    setEditing(null);
    setForm(null);
    setTriedSave(false);
  };

  // ── Eliminación ─────────────────────────────────────
  const handleDelete = async (r: CamperRegistration) => {
    const camp = getCampById(r.campId);
    const rCourses = coursesOf(r);
    const paid = r.payment.status === 'completed';
    const details: React.ReactNode[] = [
      <>
        <span className="font-mono font-bold">{r.ticketCode}</span> · {camp?.name || 'Sin campamento'}
      </>,
      rCourses.length > 0
        ? `Se liberará 1 cupo en ${rCourses.length} ${rCourses.length === 1 ? 'taller' : 'talleres'}: ${rCourses
            .map((c) => c.title)
            .join(', ')}`
        : 'No está inscrito en ningún taller.',
    ];
    if (r.enrolledChampionshipIds.length > 0)
      details.push(
        `Saldrá de ${r.enrolledChampionshipIds.length} ${r.enrolledChampionshipIds.length === 1 ? 'campeonato' : 'campeonatos'}.`
      );
    if (paid)
      details.push(
        <span className="text-red-700 font-bold">
          Tiene un pago confirmado de {formatBs(r.payment.totalAmount)} (folio {r.payment.transactionFolio}); gestiona el
          reembolso por separado.
        </span>
      );
    details.push('Su credencial QR dejará de ser válida. Esta acción no se puede deshacer.');

    const ok = await confirm({
      tone: 'danger',
      title: `¿Eliminar la inscripción de ${r.fullName}?`,
      message: paid
        ? 'Esta inscripción ya está pagada. Para evitar borrados por error, confirma escribiendo su código de credencial.'
        : 'Se borrará la inscripción del joven en este campamento.',
      details,
      confirmText: 'Sí, eliminar inscripción',
      requireText: paid ? r.ticketCode : undefined,
    });
    if (!ok) return;
    setDeletingId(r.id);
    const deleted = await deleteRegistration(r.id).finally(() => setDeletingId(null));
    if (deleted && detailId === r.id) setDetailId(null);
  };

  const openBadge = (r: CamperRegistration) => {
    setDetailId(null);
    setSelectedCamperForBadge(r);
  };

  // ── Piezas de interfaz ──────────────────────────────
  const renderAvatar = (r: CamperRegistration, size = 'w-9 h-9 text-[11px]') => {
    const tribe = getTribeById(r.tribeId);
    return (
      <span
        className={`${size} rounded-full text-white font-black flex items-center justify-center shrink-0 shadow-sm`}
        style={{ backgroundColor: tribe?.colorHex || '#94A3B8' }}
      >
        {initials(r.fullName)}
      </span>
    );
  };

  const renderTribe = (tribeId: string) => {
    const tribe = getTribeById(tribeId);
    if (!tribe) return <span className="text-slate-400">Sin tribu</span>;
    return (
      <span className="inline-flex items-center gap-1.5 min-w-0 max-w-full">
        <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: tribe.colorHex }} />
        <span className="truncate font-semibold text-slate-700">{tribe.name}</span>
      </span>
    );
  };

  const renderPaymentBadge = (p: PaymentTransaction) => {
    const meta = PAYMENT_STATUS[p.status];
    return (
      <Badge className={meta.className}>
        <meta.icon className="w-3 h-3" /> {meta.label}
      </Badge>
    );
  };

  const renderPayment = (p: PaymentTransaction) => (
    <div className="space-y-0.5">
      {renderPaymentBadge(p)}
      <div className="text-[10px] text-slate-500 whitespace-nowrap">
        {PAYMENT_METHOD[p.paymentMethod]} · <span className="font-mono font-bold text-slate-700">{formatBs(p.totalAmount)}</span>
      </div>
    </div>
  );

  const renderActions = (r: CamperRegistration, compact = false) => (
    <div className={`flex gap-1.5 ${compact ? 'justify-end' : 'flex-wrap'}`}>
      <Button
        variant={compact ? 'secondary' : 'primary'}
        size="sm"
        icon={Eye}
        onClick={() => setDetailId(r.id)}
        title="Ver detalle"
        className={compact ? '' : 'flex-1'}
      >
        {compact ? <span className="sr-only">Ver detalle</span> : 'Ver detalle'}
      </Button>
      <Button
        variant="secondary"
        size="sm"
        icon={IdCard}
        onClick={() => openBadge(r)}
        title="Ver credencial"
        className={compact ? '' : 'flex-1'}
      >
        {compact ? <span className="sr-only">Credencial</span> : 'Credencial'}
      </Button>
      {canEdit && (
        <Button
          variant="secondary"
          size="sm"
          icon={Edit3}
          onClick={() => openEdit(r)}
          title="Editar inscripción"
          className={compact ? '' : 'flex-1'}
        >
          {compact ? <span className="sr-only">Editar</span> : 'Editar'}
        </Button>
      )}
      {canDelete && (
        <Button
          variant="danger"
          size="sm"
          icon={deletingId === r.id ? Loader2 : Trash2}
          disabled={!!deletingId}
          className={deletingId === r.id ? '[&>svg]:animate-spin' : ''}
          onClick={() => handleDelete(r)}
          title="Eliminar inscripción"
        >
          <span className="sr-only">Eliminar</span>
        </Button>
      )}
    </div>
  );

  const shown = filtered.slice(0, visible);

  // ── Detalle ─────────────────────────────────────────
  const detail = detailId ? registrations.find((r) => r.id === detailId) || null : null;

  const renderDetail = (r: CamperRegistration) => {
    const camp = getCampById(r.campId);
    const tribe = getTribeById(r.tribeId);
    const rCourses = coursesOf(r);
    const missingCourses = r.enrolledCourseIds.length - rCourses.length;
    /** Inscripciones a campeonatos donde participa (como capitán o integrante). */
    const champEntries = championshipEntries
      .filter((e) => e.captainRegistrationId === r.id || e.members.some((m) => m.registrationId === r.id))
      .sort((a, b) => (a.status === 'cancelled' ? 1 : 0) - (b.status === 'cancelled' ? 1 : 0) || b.createdAt.localeCompare(a.createdAt));
    const activeChampEntries = champEntries.filter((e) => e.status !== 'cancelled').length;
    const p = r.payment;
    const pay = PAYMENT_STATUS[p.status];

    type Event = { at: string; title: string; detail?: string; tone: 'sky' | 'emerald' | 'red' | 'amber' };
    const events: Event[] = [{ at: r.registeredAt, title: 'Inscripción registrada', detail: PAYMENT_METHOD[p.paymentMethod], tone: 'sky' }];
    (p.voucherHistory || []).forEach((v) =>
      events.push({
        at: v.uploadedAt,
        title: 'Comprobante enviado · rechazado',
        detail: [v.reference && `Ref. ${v.reference}`, v.reason && `Motivo: ${v.reason}`].filter(Boolean).join(' · '),
        tone: 'red',
      })
    );
    if (p.voucherUploadedAt)
      events.push({
        at: p.voucherUploadedAt,
        title: 'Comprobante enviado',
        detail: p.voucherReferenceNumber ? `Ref. ${p.voucherReferenceNumber}` : p.voucherFileName,
        tone: 'amber',
      });
    if (p.webhookReceivedAt) events.push({ at: p.webhookReceivedAt, title: 'Confirmación bancaria recibida', tone: 'sky' });
    if (p.rejectedAt)
      events.push({
        at: p.rejectedAt,
        title: `Comprobante rechazado${p.rejectedBy ? ` por ${p.rejectedBy}` : ''}`,
        detail: p.rejectionReason,
        tone: 'red',
      });
    if (p.verifiedAt)
      events.push({ at: p.verifiedAt, title: `Pago verificado${p.verifiedBy ? ` por ${p.verifiedBy}` : ''}`, tone: 'emerald' });
    if (p.cashierCollectedAt)
      events.push({
        at: p.cashierCollectedAt,
        title: `Cobrado en caja${p.cashierCollectedBy ? ` por ${p.cashierCollectedBy}` : ''}`,
        tone: 'emerald',
      });
    events.sort((a, b) => (a.at || '').localeCompare(b.at || ''));
    const dot: Record<Event['tone'], string> = {
      sky: 'bg-sky-500',
      emerald: 'bg-emerald-500',
      red: 'bg-red-500',
      amber: 'bg-amber-500',
    };

    const breakdown: { label: string; value: string; strong?: boolean; negative?: boolean }[] = [
      { label: 'Tarifa del campamento', value: formatBs(p.baseCampFee) },
      ...(p.coursesFees ? [{ label: 'Talleres', value: formatBs(p.coursesFees) }] : []),
      ...(p.championshipsFees ? [{ label: 'Campeonatos', value: formatBs(p.championshipsFees) }] : []),
      ...(p.discountAmount
        ? [
            {
              label: `Descuento${p.couponCodeApplied ? ` (cupón ${p.couponCodeApplied})` : ''}`,
              value: `− ${formatBs(p.discountAmount)}`,
              negative: true,
            },
          ]
        : []),
      { label: 'Total', value: formatBs(p.totalAmount), strong: true },
      ...(p.advanceAmount ? [{ label: 'Adelanto', value: formatBs(p.advanceAmount) }] : []),
      ...(p.remainingBalance ? [{ label: 'Saldo pendiente', value: formatBs(p.remainingBalance) }] : []),
    ];

    return (
      <div className="space-y-4">
        {/* Encabezado */}
        <div className="rounded-2xl overflow-hidden border border-slate-100">
          <div className="p-4 sm:p-5 text-white" style={{ backgroundColor: tribe?.colorHex || '#0284C7' }}>
            <div className="flex items-start gap-3 sm:gap-4">
              <span className="w-14 h-14 rounded-2xl bg-white/20 ring-1 ring-white/30 flex items-center justify-center text-lg font-black shrink-0">
                {initials(r.fullName)}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-black uppercase tracking-widest text-white/80">
                  {tribe ? tribe.name : 'Sin tribu asignada'}
                </p>
                <h4 className="text-lg sm:text-xl font-black font-display leading-tight break-words">{r.fullName}</h4>
                <p className="text-xs font-mono text-white/90 mt-0.5">{r.ticketCode}</p>
              </div>
            </div>
            <div className="flex flex-wrap gap-1.5 mt-3 text-[11px]">
              <span className="px-2 py-1 rounded-lg bg-black/15 inline-flex items-center gap-1">
                <IdCard className="w-3 h-3" /> CI {ciLabel(r)}
              </span>
              <span className="px-2 py-1 rounded-lg bg-black/15">{r.age} años</span>
              <span className="px-2 py-1 rounded-lg bg-black/15 inline-flex items-center gap-1 max-w-full">
                <Tent className="w-3 h-3 shrink-0" /> <span className="truncate">{camp?.name || 'Sin campamento'}</span>
              </span>
            </div>
          </div>
          <div className="px-4 sm:px-5 py-2.5 bg-slate-50 flex flex-wrap items-center gap-2">
            <Badge className={REG_STATUS[r.status].className}>{REG_STATUS[r.status].label}</Badge>
            {renderPaymentBadge(p)}
            {r.isDelegate && (
              <Badge className="bg-sky-50 text-sky-700 border-sky-200">
                <Crown className="w-3 h-3" /> {r.delegateRole || 'Delegado'}
              </Badge>
            )}
            <span className="text-[11px] text-slate-500 sm:ml-auto">Inscrito el {r.registeredAt}</span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormSection title="Datos personales" icon={UserRound}>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-3">
              <InfoItem label="Nombres" value={r.firstName} />
              <InfoItem label="Apellidos" value={[r.paternalLastName, r.maternalLastName].filter(Boolean).join(' ')} />
              <InfoItem label="Fecha de nacimiento" value={r.birthDate ? formatLongDate(r.birthDate) : ''} />
              <InfoItem label="Edad" value={`${r.age} años`} />
              <InfoItem label="Cédula de identidad" value={ciLabel(r)} mono />
              <InfoItem label="Expedido en" value={r.idExpedition} />
              <InfoItem
                label="WhatsApp"
                value={
                  r.phone && (
                    <a href={`tel:${r.phone.replace(/\s/g, '')}`} className="text-[#0284C7] hover:underline inline-flex items-center gap-1">
                      <Phone className="w-3 h-3" /> {r.phone}
                    </a>
                  )
                }
              />
              <InfoItem
                label="Correo"
                value={
                  r.email && (
                    <a href={`mailto:${r.email}`} className="text-[#0284C7] hover:underline break-all">
                      {r.email}
                    </a>
                  )
                }
              />
              <InfoItem
                label="Contacto de emergencia"
                className="col-span-2"
                value={
                  r.emergencyContactName || r.emergencyPhone ? (
                    <span className="inline-flex flex-wrap items-center gap-x-2">
                      <HeartPulse className="w-3 h-3 text-red-500" />
                      {r.emergencyContactName || 'Sin nombre'}
                      {r.emergencyPhone && (
                        <a href={`tel:${r.emergencyPhone.replace(/\s/g, '')}`} className="font-mono text-[#0284C7]">
                          {r.emergencyPhone}
                        </a>
                      )}
                    </span>
                  ) : (
                    ''
                  )
                }
              />
            </dl>
          </FormSection>

          <FormSection title="Ubicación y servicio" icon={MapPin}>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-3">
              <InfoItem label="Ciudad" value={r.city} />
              <InfoItem label="Regional" value={r.regional} />
              <InfoItem label="Sub-directiva" value={subdirectivaOf(r)} />
              <InfoItem label="Área de servicio" value={r.serviceAreaOfInterest} />
              <InfoItem label="Iglesia / congregación" value={r.churchCongregation} className="col-span-2" />
              {r.groupSize > 1 && <InfoItem label="Delegación" value={`Grupo de ${r.groupSize} personas`} />}
            </dl>
          </FormSection>
        </div>

        <FormSection title="Tribu" icon={Shield}>
          {tribe ? (
            <div className="flex items-center gap-3 p-3 rounded-xl" style={{ backgroundColor: tribe.accentBg || '#F0F9FF' }}>
              <span
                className="w-10 h-10 rounded-xl text-white flex items-center justify-center font-black font-mono shrink-0"
                style={{ backgroundColor: tribe.colorHex }}
              >
                {tribe.number}
              </span>
              <div className="min-w-0">
                <p className="text-sm font-black text-slate-900 truncate">{tribe.name}</p>
                <p className="text-[11px] text-slate-600 truncate">
                  {tribe.animalSymbol} · Líder: {tribe.leaderName}
                </p>
                {tribe.motto && <p className="text-[11px] italic text-slate-500 truncate">“{tribe.motto}”</p>}
              </div>
            </div>
          ) : (
            <p className="text-xs text-slate-400">No tiene tribu asignada.</p>
          )}
        </FormSection>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormSection
            title={`Talleres (${rCourses.length}${camp?.maxCoursesPerCamper ? ` de ${camp.maxCoursesPerCamper}` : ''})`}
            icon={BookOpen}
          >
            {rCourses.length === 0 ? (
              <p className="text-xs text-slate-400">No se inscribió a ningún taller.</p>
            ) : (
              <ul className="space-y-2">
                {rCourses.map((c) => (
                  <li key={c.id} className="p-2.5 rounded-xl border border-slate-100 bg-slate-50">
                    <p className="text-xs font-bold text-slate-800">{c.title}</p>
                    <p className="text-[11px] text-slate-500 flex items-center gap-1 mt-0.5">
                      <Clock className="w-3 h-3 shrink-0" /> {formatCourseSchedule(c)}
                    </p>
                    <p className="text-[11px] text-slate-400 flex items-center gap-1">
                      <MapPin className="w-3 h-3 shrink-0" /> {c.location || 'Lugar por definir'} · {c.instructor}
                    </p>
                  </li>
                ))}
              </ul>
            )}
            {missingCourses > 0 && (
              <p className="text-[11px] text-amber-600">
                {missingCourses} {missingCourses === 1 ? 'taller ya no existe' : 'talleres ya no existen'} en el catálogo.
              </p>
            )}
          </FormSection>

          <FormSection title={`Campeonatos (${activeChampEntries})`} icon={Trophy}>
            {champEntries.length === 0 ? (
              <p className="text-xs text-slate-400">No participa en campeonatos.</p>
            ) : (
              <ul className="space-y-2">
                {champEntries.map((e) => {
                  const champ = getChampionshipById(e.championshipId);
                  const role = e.members.find((m) => m.registrationId === r.id)?.role || (e.captainRegistrationId === r.id ? 'captain' : 'member');
                  const entryMeta = ENTRY_STATUS_META[e.status];
                  const free = e.payment.method === 'free' || e.payment.amount <= 0;
                  const payMeta = EXTRA_PAY_META[e.payment.status];
                  return (
                    <li
                      key={e.id}
                      className={`p-2.5 rounded-xl border border-slate-100 bg-slate-50 space-y-1.5 ${e.status === 'cancelled' ? 'opacity-60' : ''}`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-slate-800 truncate">{champ?.name || 'Campeonato eliminado'}</p>
                          <p className="text-[11px] text-slate-500 truncate">
                            {e.type === 'team' ? (
                              <>
                                Equipo <b className="text-slate-700">{e.teamName || '—'}</b> · {e.members.length}
                                {champ?.maxTeamSize ? `/${champ.maxTeamSize}` : ''} integrantes
                              </>
                            ) : (
                              'Individual'
                            )}
                            {champ ? ` · ${champ.sport || champ.genderCategory}` : ''}
                          </p>
                        </div>
                        {e.type === 'team' && (
                          <Badge
                            className={
                              role === 'captain'
                                ? 'bg-amber-50 text-amber-700 border-amber-200 shrink-0'
                                : 'bg-slate-100 text-slate-600 border-slate-200 shrink-0'
                            }
                          >
                            {role === 'captain' ? <Crown className="w-3 h-3" /> : <Users className="w-3 h-3" />}
                            {role === 'captain' ? 'Capitán' : 'Integrante'}
                          </Badge>
                        )}
                      </div>
                      <div className="flex flex-wrap items-center gap-1.5">
                        <Badge className={entryMeta.cls}>{entryMeta.label}</Badge>
                        {free ? (
                          <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200">Sin costo extra</Badge>
                        ) : (
                          <Badge className={payMeta.cls}>
                            Pago extra: {payMeta.label} · {formatBs(e.payment.amount)}
                          </Badge>
                        )}
                      </div>
                      {e.payment.status === 'rejected' && e.payment.rejectionReason && (
                        <p className="text-[10px] text-rose-600">{e.payment.rejectionReason}</p>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </FormSection>
        </div>

        <FormSection title="Pago" description={`${PAYMENT_METHOD[p.paymentMethod]} · folio ${p.transactionFolio || '—'}`} icon={Wallet}>
          {p.status === 'rejected' && (
            <div className="flex items-start gap-2 p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-800">
              <XCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
              <div className="min-w-0">
                <p className="font-black">Comprobante rechazado</p>
                <p className="break-words">{p.rejectionReason || 'Sin motivo registrado.'}</p>
                {(p.rejectedAt || p.rejectedBy) && (
                  <p className="text-[11px] text-red-600 mt-0.5">
                    {p.rejectedBy || 'Tesorería'}
                    {p.rejectedAt ? ` · ${p.rejectedAt}` : ''}
                  </p>
                )}
              </div>
            </div>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-3">
              <div className={`flex items-center gap-2 p-3 rounded-xl border ${pay.className}`}>
                <pay.icon className="w-4 h-4 shrink-0" />
                <span className="text-xs font-black">{pay.label}</span>
              </div>
              <dl className="space-y-1.5 text-xs">
                {breakdown.map((row) => (
                  <div
                    key={row.label}
                    className={`flex justify-between gap-3 ${row.strong ? 'pt-1.5 border-t border-slate-100 font-black text-slate-900' : 'text-slate-600'}`}
                  >
                    <dt className="min-w-0">{row.label}</dt>
                    <dd className={`font-mono tabular-nums shrink-0 ${row.negative ? 'text-emerald-600' : ''}`}>{row.value}</dd>
                  </div>
                ))}
              </dl>
              {p.voucherImageUrl && (
                <a
                  href={p.voucherImageUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-3 p-2 rounded-xl border border-slate-100 hover:border-sky-200 transition-colors"
                >
                  <img src={p.voucherImageUrl} alt="Comprobante" className="w-12 h-12 rounded-lg object-cover shrink-0" />
                  <span className="min-w-0 text-[11px]">
                    <span className="block font-bold text-slate-800">Ver comprobante</span>
                    <span className="block text-slate-500 truncate">
                      {p.voucherReferenceNumber ? `Ref. ${p.voucherReferenceNumber}` : p.voucherFileName || 'Imagen adjunta'}
                    </span>
                  </span>
                </a>
              )}
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2 flex items-center gap-1">
                <History className="w-3 h-3" /> Historial
              </p>
              <ol className="relative border-l border-slate-200 ml-1.5 space-y-3">
                {events.map((ev, i) => (
                  <li key={i} className="pl-4 relative">
                    <span className={`absolute -left-[5px] top-1 w-2.5 h-2.5 rounded-full ring-2 ring-white ${dot[ev.tone]}`} />
                    <p className="text-xs font-bold text-slate-800">{ev.title}</p>
                    {ev.detail && <p className="text-[11px] text-slate-500 break-words">{ev.detail}</p>}
                    <p className="text-[10px] font-mono text-slate-400">{ev.at}</p>
                  </li>
                ))}
              </ol>
            </div>
          </div>
        </FormSection>
      </div>
    );
  };

  // ── Opciones del formulario ─────────────────────────
  const regionalOptions = form ? withCurrent(regionalNames, form.regional) : regionalNames;
  const subdirectivaOptions = form ? withCurrent(subdirectivaNames, form.subdirectivaNumber) : subdirectivaNames;
  const cityOptions = form ? withCurrent(cityNames, form.city) : cityNames;
  const serviceAreaOptions = form ? withCurrent(serviceAreaNames, form.serviceAreaOfInterest) : serviceAreaNames;
  const formTribe = form ? getTribeById(form.tribeId) : undefined;
  const selectedEditCourses = form ? editCourses.filter((c) => form.enrolledCourseIds.includes(c.id)) : [];

  const stats = [
    { label: 'Inscritos', value: summary.total, icon: Users, cls: 'bg-sky-50 text-sky-600' },
    { label: 'Pagados', value: summary.paid, icon: CheckCircle2, cls: 'bg-emerald-50 text-emerald-600' },
    {
      label: summary.rejected > 0 ? 'Pendientes / rechazados' : 'Pendientes',
      value: summary.rejected > 0 ? `${summary.pending} / ${summary.rejected}` : summary.pending,
      icon: Clock,
      cls: 'bg-amber-50 text-amber-600',
    },
    { label: 'Recaudado', value: formatBs(summary.collected), icon: Wallet, cls: 'bg-violet-50 text-violet-600' },
  ];

  return (
    <AdminPage>
      <AdminPageHeader
        kicker="Inscritos"
        title="Jóvenes inscritos"
        description="Consulta, edita y gestiona las inscripciones de cada campamento."
        icon={Users}
        actions={
          <>
            {!canEdit && !canDelete && (
              <Badge className="bg-slate-100 text-slate-600 border-slate-200">
                <Lock className="w-3 h-3" /> Solo lectura
              </Badge>
            )}
            <CampFilterSelect className="w-full sm:w-72" />
          </>
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {stats.map((s) => (
          <Card key={s.label} className="p-3 sm:p-4 flex items-center gap-3 min-w-0">
            <span className={`p-2 rounded-xl shrink-0 ${s.cls}`}>
              <s.icon className="w-4 h-4" />
            </span>
            <span className="min-w-0">
              <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 truncate">{s.label}</span>
              <span className="block text-base sm:text-xl font-black text-slate-900 font-mono tabular-nums truncate">
                {s.value}
              </span>
            </span>
          </Card>
        ))}
      </div>

      <Card className="p-3 sm:p-4 space-y-2">
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-[1.5fr_1fr_1fr_1fr_1fr] gap-2">
          <SearchInput
            value={search}
            onChange={(v) => {
              setSearch(v);
              setVisible(PAGE_SIZE);
            }}
            placeholder="Nombre, CI, código o teléfono…"
            className="sm:col-span-2 xl:col-span-1"
          />
          <SelectInput value={regionalFilter} onChange={(e) => setRegionalFilter(e.target.value)} className="py-2 text-xs">
            <option value="ALL">Todas las regionales</option>
            {regionalNames.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </SelectInput>
          <SelectInput value={tribeFilter} onChange={(e) => setTribeFilter(e.target.value)} className="py-2 text-xs">
            <option value="ALL">Todas las tribus</option>
            {sortedTribes.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </SelectInput>
          <SelectInput
            value={paymentFilter}
            onChange={(e) => setPaymentFilter(e.target.value as PaymentFilter)}
            className="py-2 text-xs"
          >
            <option value="ALL">Cualquier estado de pago</option>
            <option value="completed">Pagado</option>
            <option value="pending">Pendiente (caja o verificación)</option>
            <option value="pending_cash">Pendiente en caja</option>
            <option value="pending_verification">Por verificar</option>
            <option value="rejected">Comprobante rechazado</option>
            <option value="refunded">Reembolsado</option>
          </SelectInput>
          <SelectInput
            value={effectiveCourseFilter}
            onChange={(e) => setCourseFilter(e.target.value)}
            className="py-2 text-xs"
          >
            <option value="ALL">Todos los talleres</option>
            {courseOptions.map((c) => (
              <option key={c.id} value={c.id}>
                {c.title}
                {isAllCamps ? ` · ${getCampById(c.campId)?.name || ''}` : ''}
              </option>
            ))}
          </SelectInput>
        </div>
        <div className="flex items-center justify-between gap-2 text-[11px] text-slate-500">
          <span>
            {filtered.length} de {campRegistrations.length} inscrito{campRegistrations.length === 1 ? '' : 's'}
          </span>
          {hasFilters && (
            <button type="button" onClick={clearFilters} className="font-bold text-[#0284C7] hover:underline cursor-pointer">
              Limpiar filtros
            </button>
          )}
        </div>
      </Card>

      {filtered.length === 0 ? (
        <Card>
          <EmptyState
            icon={Users}
            title={hasFilters ? 'Nadie coincide con los filtros' : 'Aún no hay inscritos'}
            description={
              hasFilters
                ? 'Prueba con otra búsqueda o limpia los filtros. El CI se busca solo por sus números.'
                : 'Las inscripciones aparecerán aquí a medida que los jóvenes se registren.'
            }
            action={
              hasFilters && (
                <Button variant="secondary" onClick={clearFilters}>
                  Limpiar filtros
                </Button>
              )
            }
          />
        </Card>
      ) : (
        <>
          {/* Pantallas grandes: tabla */}
          <div className="hidden xl:block">
            <Table
              head={
                <tr>
                  <th className="px-4 py-3">Joven</th>
                  {isAllCamps && <th className="px-4 py-3">Campamento</th>}
                  <th className="px-4 py-3">Regional / Sub-directiva</th>
                  <th className="px-4 py-3">Tribu</th>
                  <th className="px-4 py-3">Talleres</th>
                  <th className="px-4 py-3">Pago</th>
                  <th className="px-4 py-3 text-right">Acciones</th>
                </tr>
              }
            >
              {shown.map((r) => {
                const rCourses = coursesOf(r);
                return (
                  <tr key={r.id} className="hover:bg-sky-50/40 align-top">
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        onClick={() => setDetailId(r.id)}
                        className="flex items-center gap-3 min-w-52 text-left group cursor-pointer"
                      >
                        {renderAvatar(r)}
                        <span className="min-w-0">
                          <span className="block font-bold text-slate-900 truncate group-hover:text-[#0284C7]">
                            {r.fullName}
                          </span>
                          <span className="block text-[10px] text-slate-500">
                            CI {ciLabel(r)} · {r.age} años
                          </span>
                          <span className="block text-[10px] font-mono text-slate-400">{r.ticketCode}</span>
                        </span>
                      </button>
                    </td>
                    {isAllCamps && (
                      <td className="px-4 py-3 max-w-44">
                        <span className="block truncate font-semibold text-slate-700">
                          {getCampById(r.campId)?.name || 'Sin campamento'}
                        </span>
                      </td>
                    )}
                    <td className="px-4 py-3 max-w-48">
                      <p className="font-semibold text-slate-700 truncate">{r.regional || '—'}</p>
                      <p className="text-[10px] text-slate-400 truncate">{subdirectivaOf(r) || '—'}</p>
                    </td>
                    <td className="px-4 py-3 max-w-44">{renderTribe(r.tribeId)}</td>
                    <td className="px-4 py-3 max-w-56">
                      {rCourses.length > 0 ? (
                        <ul className="space-y-0.5">
                          {rCourses.map((c) => (
                            <li key={c.id} className="truncate text-slate-600" title={formatCourseSchedule(c)}>
                              {c.title}
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <span className="text-slate-400">Sin talleres</span>
                      )}
                    </td>
                    <td className="px-4 py-3">{renderPayment(r.payment)}</td>
                    <td className="px-4 py-3">{renderActions(r, true)}</td>
                  </tr>
                );
              })}
            </Table>
          </div>

          {/* Móvil y tablet: tarjetas */}
          <div className="xl:hidden grid grid-cols-1 md:grid-cols-2 gap-3">
            {shown.map((r) => {
              const rCourses = coursesOf(r);
              return (
                <Card key={r.id} className="p-4 flex flex-col gap-3 min-w-0">
                  <button type="button" onClick={() => setDetailId(r.id)} className="flex items-start gap-3 text-left cursor-pointer">
                    {renderAvatar(r, 'w-11 h-11 text-xs')}
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-black text-slate-900 leading-snug break-words">{r.fullName}</span>
                      <span className="block text-[11px] text-slate-500">
                        CI {ciLabel(r)} · {r.age} años
                      </span>
                      <span className="block text-[11px] font-mono text-slate-400">{r.ticketCode}</span>
                      {isAllCamps && (
                        <span className="block text-[11px] font-semibold text-[#0284C7] truncate mt-0.5">
                          {getCampById(r.campId)?.name || 'Sin campamento'}
                        </span>
                      )}
                    </span>
                  </button>
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div className="min-w-0">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Regional</p>
                      <p className="font-semibold text-slate-700 truncate">{r.regional || '—'}</p>
                      <p className="text-[10px] text-slate-400 truncate">{subdirectivaOf(r)}</p>
                    </div>
                    <div className="min-w-0">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Tribu</p>
                      {renderTribe(r.tribeId)}
                    </div>
                    <div className="min-w-0 col-span-2">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Talleres</p>
                      <p className="text-slate-600 break-words">
                        {rCourses.length > 0 ? rCourses.map((c) => c.title).join(' · ') : 'Sin talleres'}
                      </p>
                    </div>
                    <div className="col-span-2 flex flex-wrap items-center justify-between gap-2">
                      {renderPayment(r.payment)}
                      {r.phone && (
                        <a
                          href={`tel:${r.phone.replace(/\s/g, '')}`}
                          className="inline-flex items-center gap-1 text-[11px] font-bold text-[#0284C7]"
                        >
                          <Phone className="w-3.5 h-3.5" /> {r.phone}
                        </a>
                      )}
                    </div>
                  </div>
                  <div className="pt-3 mt-auto border-t border-slate-100">{renderActions(r)}</div>
                </Card>
              );
            })}
          </div>

          {filtered.length > visible && (
            <div className="flex justify-center">
              <Button variant="secondary" onClick={() => setVisible((v) => v + PAGE_SIZE)}>
                Mostrar más ({filtered.length - visible} restantes)
              </Button>
            </div>
          )}
        </>
      )}

      {/* ── Detalle de la inscripción ── */}
      <Modal
        open={!!detail}
        onClose={() => setDetailId(null)}
        size="xl"
        icon={Eye}
        title="Detalle de la inscripción"
        subtitle={detail ? `${detail.fullName} · ${getCampById(detail.campId)?.name || 'Sin campamento'}` : undefined}
        footer={
          detail && (
            <>
              <Button variant="ghost" onClick={() => setDetailId(null)}>
                Cerrar
              </Button>
              {canDelete && (
                <Button
                  variant="danger"
                  icon={deletingId === detail.id ? Loader2 : Trash2}
                  disabled={!!deletingId}
                  className={deletingId === detail.id ? '[&>svg]:animate-spin' : ''}
                  onClick={() => handleDelete(detail)}
                >
                  {deletingId === detail.id ? 'Eliminando…' : 'Eliminar'}
                </Button>
              )}
              <Button variant="secondary" icon={IdCard} onClick={() => openBadge(detail)}>
                Ver credencial
              </Button>
              {canEdit && (
                <Button icon={Edit3} onClick={() => openEdit(detail)}>
                  Editar
                </Button>
              )}
            </>
          )
        }
      >
        {detail && renderDetail(detail)}
      </Modal>

      {/* ── Editar inscripción ── */}
      <Modal
        open={!!editing && !!form}
        onClose={closeEdit}
        size="lg"
        icon={Edit3}
        title="Editar inscripción"
        subtitle={editing ? `Editando · ${editing.fullName}` : undefined}
        footer={
          <>
            <Button variant="ghost" onClick={closeEdit} disabled={saving}>
              Cancelar
            </Button>
            <Button
              icon={saving ? Loader2 : CheckCircle2}
              onClick={() => handleSave()}
              disabled={saving}
              className={saving ? '[&>svg]:animate-spin' : ''}
            >
              {saving ? 'Guardando…' : 'Guardar cambios'}
            </Button>
          </>
        }
      >
        {editing && form && (
          <form onSubmit={handleSave} noValidate className="space-y-4">
            {/* Ficha de solo lectura */}
            <div className="flex flex-col sm:flex-row sm:items-center gap-3 p-3.5 rounded-2xl border border-slate-100 bg-slate-50">
              <div className="flex items-center gap-3 min-w-0 flex-1">
                {renderAvatar(editing, 'w-12 h-12 text-sm')}
                <div className="min-w-0">
                  <p className="text-sm font-black text-slate-900 break-words">{editing.fullName}</p>
                  <p className="text-[11px] text-slate-500">
                    CI {ciLabel(editing)} · {editing.age} años ·{' '}
                    <span className="font-mono font-bold text-slate-700">{editing.ticketCode}</span>
                  </p>
                  <p className="text-[11px] text-[#0284C7] font-semibold truncate flex items-center gap-1">
                    <Tent className="w-3 h-3 shrink-0" />
                    {editCamp ? `${editCamp.name} · ${formatDateRange(editCamp.startDate, editCamp.endDate)}` : 'Sin campamento'}
                  </p>
                </div>
              </div>
              <div className="flex sm:flex-col items-start sm:items-end gap-1 shrink-0">
                {renderPaymentBadge(editing.payment)}
                <span className="text-[10px] text-slate-500 font-mono">{formatBs(editing.payment.totalAmount)}</span>
              </div>
            </div>
            <p className="text-[11px] text-slate-400 -mt-2 px-1">
              El nombre, el CI y el pago no se editan aquí: son parte de la credencial y del registro de tesorería.
            </p>

            {editErrorCount > 0 && (
              <div className="flex items-start gap-2 p-3 rounded-2xl bg-red-50 border border-red-200 text-xs text-red-700 font-semibold">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                Revisa {editErrorCount === 1 ? 'el campo marcado' : `los ${editErrorCount} campos marcados`} antes de guardar.
              </div>
            )}

            <FormSection title="Datos de contacto" description="Para avisos por WhatsApp y emergencias." icon={Phone}>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Field label="Teléfono (WhatsApp)" required error={editErrors.phone}>
                  <TextInput
                    type="tel"
                    inputMode="tel"
                    value={form.phone}
                    placeholder="Ej. 70012345"
                    onChange={(e) => patch({ phone: e.target.value })}
                  />
                </Field>
                <Field label="Correo electrónico" error={editErrors.email}>
                  <TextInput
                    type="email"
                    value={form.email}
                    placeholder="nombre@correo.com"
                    onChange={(e) => patch({ email: e.target.value })}
                  />
                </Field>
                <Field label="Contacto de emergencia">
                  <TextInput
                    value={form.emergencyContactName}
                    placeholder="Nombre completo"
                    onChange={(e) => patch({ emergencyContactName: e.target.value })}
                  />
                </Field>
                <Field label="Teléfono de emergencia" error={editErrors.emergencyPhone}>
                  <TextInput
                    type="tel"
                    inputMode="tel"
                    value={form.emergencyPhone}
                    onChange={(e) => patch({ emergencyPhone: e.target.value })}
                  />
                </Field>
              </div>
            </FormSection>

            <FormSection
              title="Ubicación"
              description="Al elegir la regional se completan la sub-directiva y la ciudad."
              icon={MapPin}
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Field label="Regional">
                  <SelectInput value={form.regional} onChange={(e) => changeRegional(e.target.value)}>
                    <option value="">Sin regional</option>
                    {regionalOptions.map((n) => (
                      <option key={n} value={n}>
                        {n}
                      </option>
                    ))}
                  </SelectInput>
                </Field>
                <Field label="Sub-directiva">
                  <SelectInput value={form.subdirectivaNumber} onChange={(e) => patch({ subdirectivaNumber: e.target.value })}>
                    <option value="">Sin sub-directiva</option>
                    {subdirectivaOptions.map((n) => (
                      <option key={n} value={n}>
                        {n}
                      </option>
                    ))}
                  </SelectInput>
                </Field>
                <Field label="Ciudad">
                  <SelectInput value={form.city} onChange={(e) => patch({ city: e.target.value })}>
                    <option value="">Sin ciudad</option>
                    {cityOptions.map((n) => (
                      <option key={n} value={n}>
                        {n}
                      </option>
                    ))}
                  </SelectInput>
                </Field>
                <Field label="Área de servicio">
                  <SelectInput
                    value={form.serviceAreaOfInterest}
                    onChange={(e) => patch({ serviceAreaOfInterest: e.target.value })}
                  >
                    <option value="">Sin área de servicio</option>
                    {serviceAreaOptions.map((n) => (
                      <option key={n} value={n}>
                        {n}
                      </option>
                    ))}
                  </SelectInput>
                </Field>
                <Field label="Iglesia / congregación" className="sm:col-span-2">
                  <div className="relative">
                    <Church className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <TextInput
                      value={form.churchCongregation}
                      className="pl-9"
                      placeholder="Ej. Iglesia Bautista Central"
                      onChange={(e) => patch({ churchCongregation: e.target.value })}
                    />
                  </div>
                </Field>
              </div>
            </FormSection>

            <FormSection
              title="Tribu y talleres"
              description="Al cambiar la tribu se actualiza el QR de la credencial."
              icon={Shield}
            >
              <Field label="Tribu" required>
                <div className="flex items-center gap-2">
                  <span
                    className="w-10 h-10 rounded-xl shrink-0 flex items-center justify-center text-white text-xs font-black font-mono"
                    style={{ backgroundColor: formTribe?.colorHex || '#CBD5E1' }}
                  >
                    {formTribe?.number ?? '?'}
                  </span>
                  <SelectInput value={form.tribeId} onChange={(e) => patch({ tribeId: e.target.value })}>
                    {!formTribe && <option value={form.tribeId}>Sin tribu</option>}
                    {sortedTribes.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                  </SelectInput>
                </div>
              </Field>
              {form.tribeId !== editing.tribeId && (
                <p className="flex items-start gap-1.5 text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded-xl p-2.5">
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-px" />
                  Cambiará de {getTribeById(editing.tribeId)?.name || 'sin tribu'} a {formTribe?.name || 'sin tribu'}. Se
                  generará un nuevo QR; pídele que vuelva a descargar su credencial.
                </p>
              )}

              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] font-bold text-slate-600 uppercase tracking-wider">Talleres</span>
                  <span
                    className={`text-[11px] font-bold ${
                      maxCourses > 0 && form.enrolledCourseIds.length >= maxCourses ? 'text-amber-600' : 'text-slate-500'
                    }`}
                  >
                    {form.enrolledCourseIds.length}
                    {maxCourses > 0 ? ` de ${maxCourses} permitidos` : ' seleccionados'}
                  </span>
                </div>
                {editErrors.courses && (
                  <p className="flex items-center gap-1 text-[11px] text-red-600 font-semibold">
                    <AlertCircle className="w-3 h-3" /> {editErrors.courses}
                  </p>
                )}
                {editCourses.length === 0 ? (
                  <p className="text-xs text-slate-400">Este campamento no tiene talleres registrados.</p>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {editCourses.map((c) => {
                      const checked = form.enrolledCourseIds.includes(c.id);
                      const wasEnrolled = editing.enrolledCourseIds.includes(c.id);
                      const full = !wasEnrolled && c.enrolledCount >= c.maxCapacity;
                      const limitReached = maxCourses > 0 && form.enrolledCourseIds.length >= maxCourses;
                      const disabled = !checked && (full || limitReached);
                      const clash = selectedEditCourses.find((o) => o.id !== c.id && coursesOverlap(c, o));
                      return (
                        <label
                          key={c.id}
                          className={`flex items-start gap-2.5 p-3 rounded-xl border transition-colors ${
                            checked
                              ? 'border-sky-300 bg-sky-50'
                              : disabled
                                ? 'border-slate-100 bg-slate-50 opacity-60 cursor-not-allowed'
                                : 'border-slate-200 bg-white hover:border-sky-200 cursor-pointer'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            disabled={disabled}
                            onChange={() => toggleCourse(c.id)}
                            className="mt-0.5 w-4 h-4 accent-[#0284C7] shrink-0"
                          />
                          <span className="min-w-0">
                            <span className="block text-xs font-bold text-slate-800">{c.title}</span>
                            <span className="block text-[10px] text-slate-500">{formatCourseSchedule(c)}</span>
                            <span className="block text-[10px] text-slate-400">
                              {c.enrolledCount}/{c.maxCapacity} cupos{full ? ' · lleno' : ''}
                            </span>
                            {clash && (
                              <span className="flex items-center gap-1 text-[10px] font-bold text-amber-600 mt-0.5">
                                <AlertTriangle className="w-3 h-3 shrink-0" /> Se cruza con «{clash.title}»
                              </span>
                            )}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                )}
              </div>
            </FormSection>
            <button type="submit" className="hidden" aria-hidden="true" />
          </form>
        )}
      </Modal>
    </AdminPage>
  );
};
