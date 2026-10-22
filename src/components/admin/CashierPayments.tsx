import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  Loader2,
  Lock,
  ArrowDownUp,
  Banknote,
  Ban,
  Calculator,
  CheckCircle2,
  CheckSquare,
  ChevronDown,
  Clock,
  Eye,
  FileImage,
  Filter,
  Hash,
  History,
  IdCard,
  Inbox,
  Landmark,
  ListChecks,
  Printer,
  QrCode,
  Receipt,
  ShieldCheck,
  Square,
  Tent,
  Trophy,
  Users,
  Wallet,
  X,
  XCircle,
  ZoomIn,
} from 'lucide-react';
import { useCamp } from '../../context/CampContext';
import { useAuth } from '../../context/AuthContext';
import { useConfirm } from '../common/ConfirmDialog';
import { CamperRegistration, ChampionshipEntry, ExtraPayment, PaymentTransaction } from '../../types/camp';
import { formatShortDate, openImageInNewTab, formatBs, digitsOf, normalizeText, isPaymentPending } from '../../utils/campUtils';
import {
  AdminPage,
  AdminPageHeader,
  Badge,
  Button,
  CampFilterSelect,
  Card,
  EmptyState,
  Field,
  Modal,
  SelectInput,
  StatCard,
  Table,
  TextArea,
  TextInput,
} from './ui';

// =========================================================
// Helpers
// =========================================================

type PayStatus = PaymentTransaction['status'];
type PayMethod = PaymentTransaction['paymentMethod'];
type TabId = 'verify' | 'cash' | 'rejected' | 'paid' | 'all';
type SortId = 'recent' | 'oldest' | 'amount';

const PAGE_SIZE = 25;

const METHOD: Record<PayMethod, { label: string; icon: React.ElementType; cls: string }> = {
  qr_bank: { label: 'QR', icon: QrCode, cls: 'bg-sky-50 text-sky-700 border-sky-200' },
  transfer: { label: 'Transferencia', icon: Landmark, cls: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
  cash_box: { label: 'Efectivo', icon: Banknote, cls: 'bg-amber-50 text-amber-700 border-amber-200' },
};

const STATUS: Record<PayStatus, { label: string; icon: React.ElementType; cls: string }> = {
  pending_verification: { label: 'Por verificar', icon: FileImage, cls: 'bg-violet-50 text-violet-700 border-violet-200' },
  pending_cash: { label: 'En caja', icon: Clock, cls: 'bg-amber-50 text-amber-700 border-amber-200' },
  rejected: { label: 'Rechazado', icon: XCircle, cls: 'bg-rose-50 text-rose-700 border-rose-200' },
  completed: { label: 'Pagado', icon: CheckCircle2, cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  refunded: { label: 'Reembolsado', icon: History, cls: 'bg-slate-100 text-slate-600 border-slate-200' },
};

const TAB_STATUS: Record<Exclude<TabId, 'all'>, PayStatus> = {
  verify: 'pending_verification',
  cash: 'pending_cash',
  rejected: 'rejected',
  paid: 'completed',
};

const REJECT_REASONS = [
  'Monto incorrecto',
  'Comprobante ilegible',
  'Referencia no encontrada',
  'Comprobante duplicado',
  'Otro',
];

const CHECKLIST = ['El monto coincide', 'La referencia es válida', 'El depósito aparece en el extracto'];


/** Fecha de referencia de la transacción: envío del comprobante, fecha del pago o de inscripción. */
const dateOf = (r: CamperRegistration) => r.payment.voucherUploadedAt || r.payment.date || r.registeredAt || '';

const paidAt = (r: CamperRegistration) =>
  r.payment.cashierCollectedAt || r.payment.verifiedAt || r.payment.date || r.registeredAt || '';

const fmtStamp = (stamp?: string) => {
  if (!stamp) return '—';
  const [day, time] = stamp.split(' ');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return stamp;
  const short = `${formatShortDate(day)} ${day.slice(0, 4)}`;
  return time ? `${short} · ${time.slice(0, 5)}` : short;
};

const initials = (r: CamperRegistration) =>
  `${(r.firstName || r.fullName || '?').charAt(0)}${(r.paternalLastName || '').charAt(0)}`.toUpperCase();

// =========================================================
// Componente principal
// =========================================================

export const CashierPayments: React.FC = () => {
  const {
    registrations,
    adminCampFilter,
    getCampById,
    getTribeById,
    collectCashPayment,
    approveQrVoucherPayment,
    rejectPayment,
    setSelectedCamperForBadge,
    championshipEntries,
  } = useCamp();
  const { currentUser, can } = useAuth();
  /** Origen de los pagos: tarifa del campamento o pagos extra de campeonatos. */
  const [source, setSource] = useState<'camp' | 'extras'>('camp');
  const { confirm, notify } = useConfirm();
  const canVerify = can('payments:verify');
  const canCollect = can('payments:collect');
  const readOnly = !canVerify && !canCollect;
  /** acción en curso: 'approve' | 'reject' | 'collect' (evita dobles envíos) */
  const [busy, setBusy] = useState<string | null>(null);
  const spin = (key: string) => (busy === key ? '[&>svg]:animate-spin' : '');

  const staffName = currentUser
    ? `${currentUser.firstName} ${currentUser.paternalLastName}`.trim()
    : 'Tesorería CJN';

  const [tab, setTab] = useState<TabId>('verify');
  const [query, setQuery] = useState('');
  const [method, setMethod] = useState<'ALL' | PayMethod>('ALL');
  const [sort, setSort] = useState<SortId>('recent');
  const [limit, setLimit] = useState(PAGE_SIZE);

  // Modales
  const [reviewId, setReviewId] = useState<string | null>(null);
  const [checks, setChecks] = useState<boolean[]>([false, false, false]);
  const [rejecting, setRejecting] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [rejectNote, setRejectNote] = useState('');
  const [rejectError, setRejectError] = useState('');

  const [cashId, setCashId] = useState<string | null>(null);
  const [received, setReceived] = useState('');
  const [cashDone, setCashDone] = useState<CamperRegistration | null>(null);

  const [receiptId, setReceiptId] = useState<string | null>(null);

  const campFiltered = adminCampFilter !== 'ALL';
  const findReg = (id: string | null) => (id ? registrations.find((r) => r.id === id) : undefined);
  const reviewReg = findReg(reviewId);
  const cashReg = findReg(cashId);
  const receiptReg = findReg(receiptId);

  // ── Datos ────────────────────────────────────────────
  const scoped = useMemo(
    () =>
      registrations.filter(
        (r) => (adminCampFilter === 'ALL' || r.campId === adminCampFilter) && r.status !== 'cancelled'
      ),
    [registrations, adminCampFilter]
  );

  /** En caja no hay descuento: se cobra la tarifa del campamento (+ campeonatos) menos el adelanto. */
  const cashBreakdown = (r: CamperRegistration) => {
    const camp = getCampById(r.campId);
    const campPrice = camp?.price ?? r.payment.baseCampFee;
    const championships = r.payment.championshipsFees || 0;
    const total = campPrice + championships;
    const advance = r.payment.advanceAmount || 0;
    return { camp, campPrice, championships, total, advance, remaining: Math.max(0, total - advance) };
  };

  const byStatus = (s: PayStatus) => scoped.filter((r) => r.payment.status === s);
  const kpiVerify = byStatus('pending_verification');
  const kpiCash = byStatus('pending_cash');
  const kpiPaid = byStatus('completed');
  const kpiRejected = byStatus('rejected');
  const verifyAmount = kpiVerify.reduce((acc, r) => acc + r.payment.totalAmount, 0);
  const cashAmount = kpiCash.reduce((acc, r) => acc + cashBreakdown(r).remaining, 0);
  const paidAmount = kpiPaid.reduce((acc, r) => acc + r.payment.totalAmount, 0);

  const matchesQuery = (r: CamperRegistration) => {
    const raw = query.trim();
    if (!raw) return true;
    const q = normalizeText(raw);
    const qDigits = digitsOf(raw);
    // CI: se comparan solo los dígitos (ignora la extensión "-PT", "LP", espacios, etc.)
    if (qDigits.length >= 3 && (digitsOf(r.documentId).includes(qDigits) || digitsOf(r.phone).includes(qDigits))) {
      return true;
    }
    return (
      normalizeText(r.fullName).includes(q) ||
      normalizeText(r.documentId).includes(q) ||
      normalizeText(r.ticketCode).includes(q) ||
      normalizeText(r.id).includes(q) ||
      normalizeText(r.payment.voucherReferenceNumber).includes(q) ||
      normalizeText(r.payment.transactionFolio).includes(q)
    );
  };

  const filtered = scoped.filter((r) => (method === 'ALL' || r.payment.paymentMethod === method) && matchesQuery(r));

  const countFor = (t: TabId) => (t === 'all' ? filtered.length : filtered.filter((r) => r.payment.status === TAB_STATUS[t]).length);

  const list = (() => {
    const base = tab === 'all' ? filtered : filtered.filter((r) => r.payment.status === TAB_STATUS[tab]);
    const amountOf = (r: CamperRegistration) =>
      r.payment.status === 'pending_cash' ? cashBreakdown(r).total : r.payment.totalAmount;
    return [...base].sort((a, b) => {
      if (sort === 'amount') return amountOf(b) - amountOf(a);
      const cmp = dateOf(a).localeCompare(dateOf(b));
      return sort === 'oldest' ? cmp : -cmp;
    });
  })();

  const visible = list.slice(0, limit);

  const changeTab = (t: TabId) => {
    setTab(t);
    setLimit(PAGE_SIZE);
  };
  const changeQuery = (v: string) => {
    setQuery(v);
    setLimit(PAGE_SIZE);
  };

  // ── Acciones ─────────────────────────────────────────
  const openReview = (r: CamperRegistration) => {
    setReviewId(r.id);
    setChecks([false, false, false]);
    setRejecting(false);
    setRejectReason('');
    setRejectNote('');
    setRejectError('');
  };
  const closeReview = () => {
    if (!busy) setReviewId(null);
  };

  const openCash = (r: CamperRegistration) => {
    setCashId(r.id);
    setReceived('');
    setCashDone(null);
  };
  const closeCash = () => {
    if (busy) return;
    setCashId(null);
    setCashDone(null);
  };

  const showApprovedSuccess = async (updated: CamperRegistration) => {
    const go = await confirm({
      title: 'Pago aprobado',
      message: (
        <>
          La inscripción de <b>{updated.fullName}</b> quedó confirmada y su credencial ya está habilitada.
        </>
      ),
      details: [
        <>
          Monto: <b className="font-mono">{formatBs(updated.payment.totalAmount)}</b>
        </>,
        <>
          Folio: <span className="font-mono">{updated.payment.transactionFolio}</span>
        </>,
        <>Verificado por: {updated.payment.verifiedBy}</>,
      ],
      tone: 'success',
      confirmText: 'Ver credencial',
      cancelText: 'Cerrar',
    });
    if (go) setSelectedCamperForBadge(updated);
  };

  /** Ejecuta una acción de pago marcando el estado "en curso". */
  const withBusy = async <T,>(key: string, fn: () => Promise<T>): Promise<T> => {
    setBusy(key);
    try {
      return await fn();
    } finally {
      setBusy(null);
    }
  };

  const handleApprove = async () => {
    if (!reviewReg || busy) return;
    const updated = await withBusy('approve', () => approveQrVoucherPayment(reviewReg.id));
    if (!updated) return; // el aviso de error ya se mostró; el modal queda abierto
    setReviewId(null);
    await showApprovedSuccess(updated);
  };

  const handleApproveAnyway = async (r: CamperRegistration) => {
    const ok = await confirm({
      title: '¿Aprobar este pago de todos modos?',
      message: 'El pago fue rechazado anteriormente. Aprobarlo habilitará la credencial del joven.',
      details: [
        <>
          Joven: <b>{r.fullName}</b> · CI {r.documentId}
        </>,
        <>
          Motivo del rechazo: <b>{r.payment.rejectionReason || 'Sin motivo registrado'}</b>
        </>,
        <>
          Monto: <b className="font-mono">{formatBs(r.payment.totalAmount)}</b>
        </>,
      ],
      tone: 'warning',
      confirmText: 'Sí, aprobar',
    });
    if (!ok || busy) return;
    const updated = await withBusy('approve', () => approveQrVoucherPayment(r.id));
    if (!updated) return;
    setReviewId(null);
    await showApprovedSuccess(updated);
  };

  const handleReject = async () => {
    if (!reviewReg) return;
    if (!rejectReason) {
      setRejectError('Selecciona el motivo del rechazo.');
      return;
    }
    if (rejectReason === 'Otro' && !rejectNote.trim()) {
      setRejectError('Describe el motivo en la nota.');
      return;
    }
    const reason = rejectNote.trim()
      ? rejectReason === 'Otro'
        ? rejectNote.trim()
        : `${rejectReason}: ${rejectNote.trim()}`
      : rejectReason;
    if (busy) return;
    const updated = await withBusy('reject', () => rejectPayment(reviewReg.id, reason));
    if (updated) {
      setReviewId(null);
      await notify({
        title: 'Comprobante rechazado',
        message: (
          <>
            Se notificó a <b>{updated.fullName}</b>. Verá el motivo en «Mis entradas» y podrá reenviar su comprobante.
          </>
        ),
        details: [<>Motivo: {reason}</>],
        tone: 'info',
      });
    }
  };

  const handleCollect = async () => {
    if (!cashReg || busy) return;
    const updated = await withBusy('collect', () => collectCashPayment(cashReg.id));
    if (updated) setCashDone(updated);
  };

  // ── Piezas de UI ─────────────────────────────────────
  const renderAvatar = (r: CamperRegistration, size: 'sm' | 'lg' = 'sm') => {
    const tribe = getTribeById(r.tribeId);
    const color = tribe?.colorHex || '#0284C7';
    return (
      <span
        className={`${size === 'lg' ? 'w-12 h-12 text-sm' : 'w-9 h-9 text-[11px]'} rounded-2xl flex items-center justify-center font-black text-white shrink-0 shadow-sm`}
        style={{ backgroundColor: color }}
        title={tribe ? `Tribu ${tribe.name}` : undefined}
      >
        {initials(r)}
      </span>
    );
  };

  const renderMethod = (m: PayMethod) => {
    const cfg = METHOD[m];
    const Icon = cfg.icon;
    return (
      <Badge className={cfg.cls}>
        <Icon className="w-3 h-3" />
        {cfg.label}
      </Badge>
    );
  };

  const renderStatus = (s: PayStatus) => {
    const cfg = STATUS[s];
    const Icon = cfg.icon;
    return (
      <Badge className={cfg.cls}>
        <Icon className="w-3 h-3" />
        {cfg.label}
      </Badge>
    );
  };

  const renderAmount = (r: CamperRegistration, align: 'left' | 'right' = 'right') => {
    if (r.payment.status === 'pending_cash') {
      const b = cashBreakdown(r);
      return (
        <div className={align === 'right' ? 'text-right' : ''}>
          <div className="font-mono font-black text-slate-900 whitespace-nowrap">{formatBs(b.total)}</div>
          <div className="text-[10px] text-slate-500 whitespace-nowrap">
            {b.advance > 0 && <span className="text-emerald-600">Adelanto {formatBs(b.advance)} · </span>}
            <span className="font-bold text-amber-700">Saldo {formatBs(b.remaining)}</span>
          </div>
        </div>
      );
    }
    return (
      <div className={align === 'right' ? 'text-right' : ''}>
        <div className="font-mono font-black text-slate-900 whitespace-nowrap">{formatBs(r.payment.totalAmount)}</div>
        {r.payment.couponCodeApplied && (
          <div className="text-[10px] text-sky-700 font-mono whitespace-nowrap">{r.payment.couponCodeApplied}</div>
        )}
      </div>
    );
  };

  const renderActions = (r: CamperRegistration, full = false) => {
    const w = full ? 'flex-1' : '';
    switch (r.payment.status) {
      case 'pending_verification':
        return canVerify ? (
          <Button size="sm" icon={ListChecks} className={w} onClick={() => openReview(r)}>
            Revisar
          </Button>
        ) : (
          <Button size="sm" variant="secondary" icon={Eye} className={w} onClick={() => openReview(r)}>
            Ver comprobante
          </Button>
        );
      case 'pending_cash':
        return canCollect ? (
          <Button size="sm" variant="amber" icon={Banknote} className={w} onClick={() => openCash(r)}>
            Cobrar
          </Button>
        ) : (
          <span className="text-[10px] font-bold text-slate-400 inline-flex items-center gap-1" title="Requiere el permiso «Cobrar en caja»">
            <Lock className="w-3 h-3" /> Cobro en caja
          </span>
        );
      case 'rejected':
        return (
          <>
            <Button size="sm" variant="secondary" icon={Eye} className={w} onClick={() => openReview(r)}>
              Ver
            </Button>
            {canVerify && (
              <Button
                size="sm"
                variant="secondary"
                icon={CheckCircle2}
                className={w}
                disabled={!!busy}
                onClick={() => handleApproveAnyway(r)}
              >
                Aprobar de todos modos
              </Button>
            )}
          </>
        );
      case 'completed':
        return (
          <>
            <Button size="sm" variant="secondary" icon={QrCode} className={w} onClick={() => setSelectedCamperForBadge(r)}>
              Ver credencial
            </Button>
            <Button size="sm" variant="ghost" icon={Receipt} className={w} onClick={() => setReceiptId(r.id)}>
              Recibo
            </Button>
          </>
        );
      default:
        return <span className="text-[11px] text-slate-400">—</span>;
    }
  };

  const tabs: { id: TabId; label: string; icon: React.ElementType; activeCls: string }[] = [
    { id: 'verify', label: 'Por verificar', icon: FileImage, activeCls: 'bg-violet-600 text-white' },
    { id: 'cash', label: 'Pendientes en caja', icon: Banknote, activeCls: 'bg-amber-500 text-white' },
    { id: 'rejected', label: 'Rechazados', icon: XCircle, activeCls: 'bg-rose-600 text-white' },
    { id: 'paid', label: 'Pagados', icon: CheckCircle2, activeCls: 'bg-emerald-600 text-white' },
    { id: 'all', label: 'Todos', icon: Inbox, activeCls: 'bg-slate-900 text-white' },
  ];

  const EMPTY: Record<TabId, { icon: React.ElementType; title: string; description: string }> = {
    verify: {
      icon: ShieldCheck,
      title: 'No hay comprobantes por verificar',
      description: 'Cuando un joven pague por QR o transferencia y suba su comprobante, aparecerá aquí para revisarlo.',
    },
    cash: {
      icon: Banknote,
      title: 'No hay cobros pendientes en caja',
      description: 'Las inscripciones con pago en efectivo pendiente aparecerán aquí.',
    },
    rejected: {
      icon: XCircle,
      title: 'No hay pagos rechazados',
      description: 'Los comprobantes rechazados quedan aquí hasta que el joven reenvíe uno nuevo.',
    },
    paid: {
      icon: Receipt,
      title: 'Todavía no hay pagos confirmados',
      description: 'Los pagos aprobados o cobrados en caja aparecerán en esta lista.',
    },
    all: {
      icon: Inbox,
      title: 'No hay transacciones',
      description: 'Aún no hay inscripciones registradas para este filtro.',
    },
  };

  const hasFilters = !!query.trim() || method !== 'ALL';
  const empty = EMPTY[tab];

  // ── Datos del modal de verificación ─────────────────
  const reviewCamp = reviewReg ? getCampById(reviewReg.campId) : undefined;
  const allChecked = checks.every(Boolean);
  const reviewIsRejected = reviewReg?.payment.status === 'rejected';
  const reviewIsPending = reviewReg?.payment.status === 'pending_verification';

  // ── Datos del modal de caja ─────────────────────────
  const cashB = cashReg ? cashBreakdown(cashReg) : null;
  const receivedNum = Number(received.replace(',', '.')) || 0;
  const change = cashB ? receivedNum - cashB.remaining : 0;
  const quickAmounts = cashB
    ? Array.from(
        new Set([cashB.remaining, ...[50, 100, 200].map((step) => Math.ceil(cashB.remaining / step) * step)])
      )
        .filter((v) => v > 0)
        .sort((a, b) => a - b)
        .slice(0, 4)
    : [];

  return (
    <AdminPage>
      <AdminPageHeader
        kicker="Tesorería"
        title="Pagos y caja"
        description="Busca por CI, verifica y aprueba transferencias o pagos QR, y cobra en efectivo la tarifa del campamento y los pagos extra de campeonatos."
        icon={Wallet}
        actions={
          <>
            {readOnly && (
              <Badge className="bg-slate-100 text-slate-600 border-slate-200">
                <Lock className="w-3 h-3" /> Solo lectura
              </Badge>
            )}
            <CampFilterSelect className="w-full sm:w-72" />
          </>
        }
      />

      {/* Origen de los pagos */}
      <SourceSwitch
        value={source}
        onChange={setSource}
        campPending={kpiVerify.length + kpiCash.length}
        extrasPending={
          championshipEntries.filter(
            (e) =>
              (adminCampFilter === 'ALL' || e.campId === adminCampFilter) &&
              e.status !== 'cancelled' &&
              isPaymentPending(e.payment.status)
          ).length
        }
      />

      {source === 'extras' ? (
        <ExtraPaymentsPanel />
      ) : (
      <>
      {/* KPIs */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3 sm:gap-4">
        <StatCard
          label="Por verificar"
          value={kpiVerify.length}
          hint={`${formatBs(verifyAmount)} en revisión`}
          icon={FileImage}
          tone="violet"
        />
        <StatCard
          label="Pendientes en caja"
          value={kpiCash.length}
          hint={`${formatBs(cashAmount)} de saldo`}
          icon={Banknote}
          tone="amber"
        />
        <StatCard
          label="Cobrado"
          value={<span className="text-xl sm:text-3xl">{formatBs(paidAmount)}</span>}
          hint={`${kpiPaid.length} pagos confirmados`}
          icon={ShieldCheck}
          tone="emerald"
        />
        <StatCard
          label="Rechazados"
          value={kpiRejected.length}
          hint="Esperando nuevo comprobante"
          icon={XCircle}
          tone="rose"
        />
      </div>

      {/* Pestañas */}
      <div className="-mx-4 px-4 sm:mx-0 sm:px-0 overflow-x-auto no-scrollbar">
        <div className="flex gap-2 w-max sm:w-auto sm:flex-wrap">
          {tabs.map((t) => {
            const Icon = t.icon;
            const active = tab === t.id;
            const count = countFor(t.id);
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => changeTab(t.id)}
                className={`flex items-center gap-2 pl-3 pr-2 py-2 rounded-full text-xs font-bold whitespace-nowrap transition-all cursor-pointer border ${
                  active
                    ? `${t.activeCls} border-transparent shadow-md`
                    : 'bg-white text-slate-600 border-slate-200 hover:border-sky-300 hover:text-slate-900'
                }`}
              >
                <Icon className="w-4 h-4" />
                {t.label}
                <span
                  className={`min-w-6 px-1.5 py-0.5 rounded-full text-[10px] font-mono font-black text-center ${
                    active ? 'bg-white/25 text-white' : 'bg-slate-100 text-slate-600'
                  }`}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Barra de búsqueda y filtros */}
      <Card className="p-3 sm:p-4">
        <div className="flex flex-col lg:flex-row gap-3">
          <div className="relative flex-1 min-w-0">
            <IdCard className="w-5 h-5 text-[#0284C7] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              value={query}
              onChange={(e) => changeQuery(e.target.value)}
              placeholder="Buscar por CI, nombre o código de entrada"
              aria-label="Buscar por CI, nombre o código de entrada"
              className="w-full pl-11 pr-10 py-3 text-sm rounded-2xl border-2 border-sky-100 bg-sky-50/50 text-slate-900 font-semibold outline-none transition-all placeholder:font-normal placeholder:text-slate-400 focus:bg-white focus:border-sky-400 focus:ring-4 focus:ring-sky-100"
            />
            {query && (
              <button
                type="button"
                onClick={() => changeQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer"
                aria-label="Limpiar búsqueda"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
          <div className="grid grid-cols-2 gap-2 lg:w-[22rem] shrink-0">
            <div className="relative">
              <Filter className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <SelectInput
                value={method}
                onChange={(e) => {
                  setMethod(e.target.value as 'ALL' | PayMethod);
                  setLimit(PAGE_SIZE);
                }}
                className="pl-8 py-3 text-xs font-bold rounded-2xl"
                aria-label="Filtrar por método"
              >
                <option value="ALL">Todo método</option>
                <option value="qr_bank">QR</option>
                <option value="transfer">Transferencia</option>
                <option value="cash_box">Efectivo</option>
              </SelectInput>
            </div>
            <div className="relative">
              <ArrowDownUp className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <SelectInput
                value={sort}
                onChange={(e) => setSort(e.target.value as SortId)}
                className="pl-8 py-3 text-xs font-bold rounded-2xl"
                aria-label="Ordenar"
              >
                <option value="recent">Más recientes</option>
                <option value="oldest">Más antiguos</option>
                <option value="amount">Mayor monto</option>
              </SelectInput>
            </div>
          </div>
        </div>
        {hasFilters && (
          <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
            <span>
              <b className="text-slate-800">{list.length}</b> resultado{list.length === 1 ? '' : 's'} en esta pestaña ·{' '}
              <b className="text-slate-800">{filtered.length}</b> en total
            </span>
            <button
              type="button"
              onClick={() => {
                changeQuery('');
                setMethod('ALL');
              }}
              className="font-bold text-[#0284C7] hover:underline cursor-pointer"
            >
              Limpiar filtros
            </button>
          </div>
        )}
      </Card>

      {/* Lista */}
      {list.length === 0 ? (
        <Card>
          {hasFilters ? (
            <EmptyState
              icon={IdCard}
              title="Sin resultados"
              description={`No encontramos pagos que coincidan con «${query.trim() || 'el filtro'}» en esta pestaña. Revisa el CI o prueba en «Todos».`}
              action={
                tab !== 'all' ? (
                  <Button variant="secondary" size="sm" onClick={() => changeTab('all')}>
                    Buscar en todos
                  </Button>
                ) : undefined
              }
            />
          ) : (
            <EmptyState icon={empty.icon} title={empty.title} description={empty.description} />
          )}
        </Card>
      ) : (
        <>
          {/* Escritorio: tabla */}
          <div className="hidden md:block">
            <Table
              head={
                <tr>
                  <th className="px-4 py-3">Joven</th>
                  <th className="px-4 py-3">Entrada</th>
                  {!campFiltered && <th className="px-4 py-3 hidden lg:table-cell">Campamento</th>}
                  <th className="px-4 py-3">Método</th>
                  <th className="px-4 py-3 text-right">Monto</th>
                  <th className="px-4 py-3 hidden xl:table-cell">Fecha</th>
                  <th className="px-4 py-3">Estado</th>
                  <th className="px-4 py-3 text-right">Acciones</th>
                </tr>
              }
            >
              {visible.map((r) => {
                const camp = getCampById(r.campId);
                return (
                  <tr key={r.id} className="hover:bg-sky-50/40 align-middle">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3 min-w-[11rem]">
                        {renderAvatar(r)}
                        <div className="min-w-0">
                          <div className="font-bold text-slate-900 truncate max-w-[14rem]">{r.fullName}</div>
                          <div className="text-[10px] text-slate-500 font-mono">CI {r.documentId || '—'}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 font-mono text-[11px] text-slate-700 whitespace-nowrap">{r.ticketCode}</td>
                    {!campFiltered && (
                      <td className="px-4 py-3 hidden lg:table-cell text-slate-600">
                        <span className="line-clamp-2 max-w-[11rem]">{camp?.name || '—'}</span>
                      </td>
                    )}
                    <td className="px-4 py-3">
                      {renderMethod(r.payment.paymentMethod)}
                    </td>
                    <td className="px-4 py-3">
                      {renderAmount(r)}
                    </td>
                    <td className="px-4 py-3 hidden xl:table-cell font-mono text-[11px] text-slate-500 whitespace-nowrap">
                      {fmtStamp(dateOf(r))}
                    </td>
                    <td className="px-4 py-3">
                      {renderStatus(r.payment.status)}
                      {r.payment.status === 'rejected' && r.payment.rejectionReason && (
                        <div className="text-[10px] text-rose-600 mt-1 max-w-[10rem] line-clamp-2" title={r.payment.rejectionReason}>
                          {r.payment.rejectionReason}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1.5 flex-wrap">
                        {renderActions(r)}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </Table>
          </div>

          {/* Celular: tarjetas */}
          <div className="md:hidden space-y-3">
            {visible.map((r) => {
              const camp = getCampById(r.campId);
              return (
                <Card key={r.id} className="p-4 space-y-3">
                  <div className="flex items-start gap-3">
                    {renderAvatar(r)}
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-black text-slate-900 truncate">{r.fullName}</div>
                      <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-slate-500 mt-0.5">
                        <span className="font-mono">CI {r.documentId || '—'}</span>
                        <span className="font-mono">{r.ticketCode}</span>
                      </div>
                    </div>
                    {renderStatus(r.payment.status)}
                  </div>
                  {!campFiltered && camp && (
                    <div className="flex items-center gap-1.5 text-[11px] text-slate-600">
                      <Tent className="w-3.5 h-3.5 text-[#0284C7] shrink-0" />
                      <span className="truncate">{camp.name}</span>
                    </div>
                  )}
                  <div className="flex items-end justify-between gap-3 rounded-2xl bg-slate-50 border border-slate-100 p-3">
                    <div className="space-y-1">
                      {renderMethod(r.payment.paymentMethod)}
                      <div className="text-[10px] text-slate-500 font-mono">{fmtStamp(dateOf(r))}</div>
                    </div>
                    {renderAmount(r)}
                  </div>
                  {r.payment.status === 'rejected' && r.payment.rejectionReason && (
                    <div className="flex gap-2 text-[11px] text-rose-700 bg-rose-50 border border-rose-100 rounded-xl p-2.5">
                      <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                      <span>{r.payment.rejectionReason}</span>
                    </div>
                  )}
                  <div className="flex gap-2">
                    {renderActions(r, true)}
                  </div>
                </Card>
              );
            })}
          </div>

          {/* Paginación */}
          <div className="flex flex-col items-center gap-2 pt-1">
            <span className="text-[11px] text-slate-500">
              Mostrando <b className="text-slate-800">{visible.length}</b> de <b className="text-slate-800">{list.length}</b>
            </span>
            {visible.length < list.length && (
              <Button variant="secondary" icon={ChevronDown} onClick={() => setLimit((l) => l + PAGE_SIZE)}>
                Mostrar más
              </Button>
            )}
          </div>
        </>
      )}
      </>
      )}

      {/* ════════ Modal: verificación de comprobante ════════ */}
      <Modal
        open={!!reviewReg}
        onClose={closeReview}
        title={reviewIsRejected ? 'Pago rechazado' : 'Verificar comprobante'}
        subtitle={
          reviewReg
            ? `${reviewReg.fullName} · ${METHOD[reviewReg.payment.paymentMethod].label} · ${reviewReg.ticketCode}`
            : undefined
        }
        icon={reviewIsRejected ? XCircle : ShieldCheck}
        size="xl"
        footer={
          reviewReg && (
            <>
              {reviewIsPending && !canVerify && (
                <>
                  <span className="text-[11px] text-slate-500 inline-flex items-center gap-1 sm:mr-auto">
                    <Lock className="w-3.5 h-3.5" /> No tienes permiso para aprobar o rechazar comprobantes.
                  </span>
                  <Button variant="secondary" onClick={closeReview}>
                    Cerrar
                  </Button>
                </>
              )}
              {reviewIsPending && canVerify && !rejecting && (
                <>
                  <Button variant="secondary" onClick={closeReview} disabled={!!busy}>
                    Cancelar
                  </Button>
                  <Button variant="danger" icon={Ban} disabled={!!busy} onClick={() => setRejecting(true)}>
                    Rechazar
                  </Button>
                  <Button
                    icon={busy === 'approve' ? Loader2 : CheckCircle2}
                    disabled={!allChecked || !!busy}
                    onClick={handleApprove}
                    title={allChecked ? undefined : 'Marca los 3 puntos de la lista de verificación'}
                    className={`!bg-emerald-600 hover:!bg-emerald-700 ${spin('approve')}`}
                  >
                    {busy === 'approve' ? 'Aprobando…' : 'Aprobar pago'}
                  </Button>
                </>
              )}
              {reviewIsPending && canVerify && rejecting && (
                <>
                  <Button variant="secondary" onClick={() => setRejecting(false)} disabled={!!busy}>
                    Volver
                  </Button>
                  <Button
                    icon={busy === 'reject' ? Loader2 : Ban}
                    disabled={!!busy}
                    className={`!bg-red-600 hover:!bg-red-700 ${spin('reject')}`}
                    onClick={handleReject}
                  >
                    {busy === 'reject' ? 'Rechazando…' : 'Confirmar rechazo'}
                  </Button>
                </>
              )}
              {!reviewIsPending && (
                <>
                  <Button variant="secondary" onClick={closeReview} disabled={!!busy}>
                    Cerrar
                  </Button>
                  {reviewIsRejected && canVerify && (
                    <Button
                      variant="amber"
                      icon={busy === 'approve' ? Loader2 : CheckCircle2}
                      disabled={!!busy}
                      className={spin('approve')}
                      onClick={() => handleApproveAnyway(reviewReg)}
                    >
                      {busy === 'approve' ? 'Aprobando…' : 'Aprobar de todos modos'}
                    </Button>
                  )}
                </>
              )}
            </>
          )
        }
      >
        {reviewReg && (
          <div className="grid grid-cols-1 md:grid-cols-5 gap-5">
            {/* Comprobante */}
            <div className="md:col-span-2 space-y-2">
              {reviewReg.payment.voucherImageUrl ? (
                <button
                  type="button"
                  onClick={() => openImageInNewTab(reviewReg.payment.voucherImageUrl!)}
                  className="relative block w-full aspect-[3/4] max-h-[60vh] rounded-2xl overflow-hidden border border-slate-200 bg-slate-100 group cursor-zoom-in"
                  title="Abrir en tamaño completo"
                >
                  <img
                    src={reviewReg.payment.voucherImageUrl}
                    alt="Comprobante de pago"
                    className="w-full h-full object-contain"
                  />
                  <span className="absolute bottom-2 right-2 inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-slate-950/70 text-white text-[10px] font-bold opacity-90 group-hover:opacity-100">
                    <ZoomIn className="w-3.5 h-3.5" /> Tamaño completo
                  </span>
                </button>
              ) : (
                <div className="w-full aspect-[3/4] max-h-[60vh] rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50 flex flex-col items-center justify-center text-center p-6 text-slate-400">
                  <FileImage className="w-10 h-10 mb-2" />
                  <span className="text-xs font-bold text-slate-500">Sin imagen del comprobante</span>
                  <span className="text-[11px] mt-1">
                    {reviewReg.payment.paymentMethod === 'qr_bank'
                      ? 'Pago QR: verifica con la referencia en el extracto bancario.'
                      : 'Solicita al joven que reenvíe la foto si es necesario.'}
                  </span>
                </div>
              )}
              {reviewReg.payment.voucherFileName && (
                <p className="text-[11px] text-slate-500 truncate">
                  <FileImage className="w-3 h-3 inline mr-1" />
                  {reviewReg.payment.voucherFileName}
                </p>
              )}
            </div>

            {/* Detalles */}
            <div className="md:col-span-3 space-y-4 min-w-0">
              <div className="flex items-center gap-3">
                {renderAvatar(reviewReg, 'lg')}
                <div className="min-w-0">
                  <div className="text-base font-black text-slate-900 truncate">{reviewReg.fullName}</div>
                  <div className="text-[11px] text-slate-500 font-mono">
                    CI {reviewReg.documentId || '—'} · {reviewReg.phone}
                  </div>
                </div>
              </div>

              {reviewIsRejected && (
                <div className="rounded-2xl bg-rose-50 border border-rose-100 p-3.5 text-xs text-rose-800 space-y-1">
                  <div className="flex items-center gap-1.5 font-black">
                    <XCircle className="w-4 h-4" /> Rechazado
                  </div>
                  <p>{reviewReg.payment.rejectionReason || 'Sin motivo registrado.'}</p>
                  <p className="text-[10px] text-rose-600">
                    {reviewReg.payment.rejectedBy || 'Tesorería'} · {fmtStamp(reviewReg.payment.rejectedAt)}
                  </p>
                </div>
              )}

              <dl className="rounded-2xl border border-slate-100 divide-y divide-slate-100 text-xs">
                {[
                  { k: 'Campamento', v: reviewCamp?.name || '—', icon: Tent },
                  { k: 'Método', v: METHOD[reviewReg.payment.paymentMethod].label, icon: Wallet },
                  {
                    k: 'Referencia',
                    v: <span className="font-mono font-black">{reviewReg.payment.voucherReferenceNumber || '—'}</span>,
                    icon: Hash,
                  },
                  { k: 'Archivo', v: reviewReg.payment.voucherFileName || '—', icon: FileImage },
                  { k: 'Fecha de envío', v: fmtStamp(reviewReg.payment.voucherUploadedAt || reviewReg.payment.date), icon: Clock },
                ].map(({ k, v, icon: Icon }) => (
                  <div key={k} className="flex items-center justify-between gap-3 px-3.5 py-2.5">
                    <dt className="flex items-center gap-1.5 text-slate-500 shrink-0">
                      <Icon className="w-3.5 h-3.5" /> {k}
                    </dt>
                    <dd className="text-slate-800 font-semibold text-right truncate min-w-0">{v}</dd>
                  </div>
                ))}
              </dl>

              <div className="rounded-2xl bg-sky-50 border border-sky-100 p-3.5 space-y-1.5 text-xs">
                <div className="flex justify-between text-slate-600">
                  <span>Tarifa del campamento</span>
                  <span className="font-mono font-bold">{formatBs(reviewCamp?.price ?? reviewReg.payment.baseCampFee)}</span>
                </div>
                {reviewReg.payment.discountAmount > 0 && (
                  <div className="flex justify-between text-emerald-700">
                    <span>Descuento {reviewReg.payment.couponCodeApplied ? `(${reviewReg.payment.couponCodeApplied})` : ''}</span>
                    <span className="font-mono font-bold">− {formatBs(reviewReg.payment.discountAmount)}</span>
                  </div>
                )}
                {(reviewReg.payment.championshipsFees || 0) > 0 && (
                  <div className="flex justify-between text-slate-600">
                    <span>Campeonatos</span>
                    <span className="font-mono font-bold">{formatBs(reviewReg.payment.championshipsFees)}</span>
                  </div>
                )}
                <div className="flex justify-between items-baseline pt-1.5 border-t border-sky-200">
                  <span className="font-black text-slate-900">Monto esperado</span>
                  <span className="font-mono font-black text-2xl text-[#0284C7]">{formatBs(reviewReg.payment.totalAmount)}</span>
                </div>
              </div>

              {(reviewReg.payment.voucherHistory?.length || 0) > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center gap-1.5 text-[11px] font-black uppercase tracking-wider text-slate-500">
                    <History className="w-3.5 h-3.5" /> Comprobantes rechazados anteriormente
                  </div>
                  <ul className="space-y-2">
                    {reviewReg.payment.voucherHistory!.map((h, i) => (
                      <li key={i} className="flex gap-3 rounded-xl border border-rose-100 bg-rose-50/50 p-2.5">
                        {h.imageUrl ? (
                          <button
                            type="button"
                            onClick={() => openImageInNewTab(h.imageUrl!)}
                            className="w-12 h-14 rounded-lg overflow-hidden border border-rose-100 bg-white shrink-0 cursor-zoom-in"
                          >
                            <img src={h.imageUrl} alt="" className="w-full h-full object-cover" />
                          </button>
                        ) : (
                          <div className="w-12 h-14 rounded-lg border border-dashed border-rose-200 bg-white shrink-0 flex items-center justify-center text-rose-300">
                            <FileImage className="w-4 h-4" />
                          </div>
                        )}
                        <div className="min-w-0 text-[11px]">
                          <div className="font-bold text-rose-800">{h.reason || 'Sin motivo registrado'}</div>
                          <div className="text-slate-500 font-mono truncate">Ref. {h.reference || '—'}</div>
                          <div className="text-slate-400 font-mono">{fmtStamp(h.uploadedAt)}</div>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Lista de verificación / rechazo */}
              {reviewIsPending && !rejecting && (
                <div className="rounded-2xl border border-slate-200 p-3.5 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-black uppercase tracking-wider text-slate-600">
                      Lista de verificación
                    </span>
                    <span className={`text-[11px] font-mono font-black ${allChecked ? 'text-emerald-600' : 'text-slate-400'}`}>
                      {checks.filter(Boolean).length}/3
                    </span>
                  </div>
                  {CHECKLIST.map((label, i) => {
                    const on = checks[i];
                    return (
                      <button
                        key={label}
                        type="button"
                        onClick={() => setChecks((prev) => prev.map((c, j) => (j === i ? !c : c)))}
                        className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl border text-left text-xs font-bold transition-colors cursor-pointer ${
                          on
                            ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                            : 'border-slate-200 bg-slate-50 text-slate-700 hover:border-sky-300'
                        }`}
                        aria-pressed={on}
                      >
                        {on ? (
                          <CheckSquare className="w-4 h-4 text-emerald-600 shrink-0" />
                        ) : (
                          <Square className="w-4 h-4 text-slate-400 shrink-0" />
                        )}
                        {label}
                      </button>
                    );
                  })}
                  {!allChecked && (
                    <p className="text-[10px] text-slate-500">Marca los 3 puntos para habilitar «Aprobar pago».</p>
                  )}
                  <p className="text-[10px] text-slate-400">
                    Verificador: <b className="text-slate-600">{staffName}</b>
                  </p>
                </div>
              )}

              {reviewIsPending && rejecting && (
                <div className="rounded-2xl border-2 border-red-100 bg-red-50/40 p-3.5 space-y-3">
                  <div className="flex items-center gap-1.5 text-xs font-black text-red-700">
                    <Ban className="w-4 h-4" /> Rechazar comprobante
                  </div>
                  <Field label="Motivo" required error={rejectError && !rejectReason ? rejectError : undefined}>
                    <SelectInput
                      value={rejectReason}
                      onChange={(e) => {
                        setRejectReason(e.target.value);
                        setRejectError('');
                      }}
                    >
                      <option value="">Selecciona un motivo…</option>
                      {REJECT_REASONS.map((r) => (
                        <option key={r} value={r}>
                          {r}
                        </option>
                      ))}
                    </SelectInput>
                  </Field>
                  <Field
                    label={rejectReason === 'Otro' ? 'Describe el motivo' : 'Nota para el joven (opcional)'}
                    required={rejectReason === 'Otro'}
                    error={rejectError && rejectReason ? rejectError : undefined}
                  >
                    <TextArea
                      value={rejectNote}
                      onChange={(e) => {
                        setRejectNote(e.target.value);
                        setRejectError('');
                      }}
                      placeholder="Ej.: El monto depositado es 300 Bs y la inscripción es de 350 Bs."
                    />
                  </Field>
                  <p className="text-[10px] text-slate-500">
                    El joven verá este motivo y podrá subir un nuevo comprobante.
                  </p>
                </div>
              )}

              {reviewReg.payment.status === 'completed' && (
                <div className="rounded-2xl bg-emerald-50 border border-emerald-100 p-3.5 text-xs text-emerald-800">
                  Pago aprobado por <b>{reviewReg.payment.verifiedBy || reviewReg.payment.cashierCollectedBy}</b> ·{' '}
                  {fmtStamp(paidAt(reviewReg))}
                </div>
              )}
            </div>
          </div>
        )}
      </Modal>

      {/* ════════ Modal: cobro en caja ════════ */}
      <Modal
        open={!!cashReg}
        onClose={closeCash}
        title={cashDone ? 'Cobro registrado' : 'Cobrar en caja'}
        subtitle={cashDone ? undefined : 'En caja se cobra la tarifa completa del campamento, sin descuentos.'}
        icon={cashDone ? CheckCircle2 : Calculator}
        size="md"
        footer={
          cashDone ? (
            <>
              <Button variant="secondary" onClick={closeCash}>
                Cerrar
              </Button>
              <Button variant="secondary" icon={Receipt} onClick={() => {
                setReceiptId(cashDone.id);
                closeCash();
              }}>
                Recibo
              </Button>
              <Button
                icon={QrCode}
                onClick={() => {
                  setSelectedCamperForBadge(cashDone);
                  closeCash();
                }}
              >
                Ver credencial
              </Button>
            </>
          ) : (
            <>
              <Button variant="secondary" onClick={closeCash} disabled={!!busy}>
                Cancelar
              </Button>
              <Button
                icon={busy === 'collect' ? Loader2 : Banknote}
                onClick={handleCollect}
                className={spin('collect')}
                disabled={!canCollect || !!busy || (!!cashB && cashB.remaining > 0 && receivedNum < cashB.remaining)}
              >
                {busy === 'collect' ? 'Registrando…' : 'Confirmar cobro'}
              </Button>
            </>
          )
        }
      >
        {cashReg && cashB && !cashDone && (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              {renderAvatar(cashReg, 'lg')}
              <div className="min-w-0">
                <div className="text-sm font-black text-slate-900 truncate">{cashReg.fullName}</div>
                <div className="text-[11px] text-slate-500 font-mono">
                  CI {cashReg.documentId} · {cashReg.ticketCode}
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4 space-y-2 text-sm">
              <div className="flex justify-between gap-3 text-slate-600">
                <span className="truncate">Tarifa {cashB.camp ? `· ${cashB.camp.name}` : ''}</span>
                <span className="font-mono font-bold shrink-0">{formatBs(cashB.campPrice)}</span>
              </div>
              {cashB.championships > 0 && (
                <div className="flex justify-between text-slate-600">
                  <span>Campeonatos</span>
                  <span className="font-mono font-bold">{formatBs(cashB.championships)}</span>
                </div>
              )}
              <div className="flex justify-between text-emerald-700">
                <span>Adelanto pagado</span>
                <span className="font-mono font-bold">− {formatBs(cashB.advance)}</span>
              </div>
              <div className="flex justify-between items-baseline pt-2 border-t border-slate-200">
                <span className="font-black text-slate-900">Saldo a cobrar</span>
                <span className="font-mono font-black text-2xl text-[#0284C7]">{formatBs(cashB.remaining)}</span>
              </div>
            </div>

            <Field label="Monto recibido (Bs)" required>
              <TextInput
                type="number"
                inputMode="decimal"
                min={0}
                autoFocus
                value={received}
                onChange={(e) => setReceived(e.target.value)}
                placeholder={String(cashB.remaining)}
                className="text-lg font-mono font-black"
              />
            </Field>
            <div className="flex flex-wrap gap-2">
              {quickAmounts.map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setReceived(String(v))}
                  className={`px-3 py-1.5 rounded-xl text-[11px] font-mono font-bold border cursor-pointer transition-colors ${
                    receivedNum === v
                      ? 'bg-sky-600 text-white border-sky-600'
                      : 'bg-white text-slate-700 border-slate-200 hover:border-sky-300'
                  }`}
                >
                  {v === cashB.remaining ? `Exacto · ${formatBs(v)}` : formatBs(v)}
                </button>
              ))}
            </div>

            <div
              className={`rounded-2xl p-4 flex items-center justify-between gap-3 border ${
                !received
                  ? 'bg-slate-50 border-slate-100 text-slate-500'
                  : change >= 0
                  ? 'bg-emerald-50 border-emerald-100 text-emerald-800'
                  : 'bg-rose-50 border-rose-100 text-rose-700'
              }`}
            >
              <span className="text-xs font-black uppercase tracking-wider">
                {received && change < 0 ? 'Falta' : 'Cambio'}
              </span>
              <span className="font-mono font-black text-2xl">{received ? formatBs(Math.abs(change)) : '—'}</span>
            </div>

            <p className="text-[11px] text-slate-500">
              Cajero responsable: <span className="font-bold text-slate-700">{staffName}</span>
            </p>
          </div>
        )}
        {cashDone && (
          <div className="text-center py-2 space-y-3">
            <div className="w-16 h-16 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-9 h-9" />
            </div>
            <div>
              <div className="text-base font-black text-slate-900">{cashDone.fullName}</div>
              <div className="text-xs text-slate-500 font-mono">{cashDone.ticketCode}</div>
            </div>
            <div className="inline-flex flex-col items-center rounded-2xl bg-slate-50 border border-slate-100 px-6 py-3">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Folio</span>
              <span className="text-lg font-black font-mono text-slate-900">{cashDone.payment.transactionFolio}</span>
              <span className="text-xs text-emerald-600 font-bold mt-1">
                Total pagado {formatBs(cashDone.payment.totalAmount)}
              </span>
              {received && change > 0 && (
                <span className="text-[11px] text-slate-500 mt-0.5">Cambio entregado: {formatBs(change)}</span>
              )}
            </div>
            <p className="text-xs text-slate-500">La credencial ya está habilitada para el ingreso al campamento.</p>
          </div>
        )}
      </Modal>

      {/* ════════ Modal: recibo ════════ */}
      <Modal
        open={!!receiptReg}
        onClose={() => setReceiptId(null)}
        title="Recibo de pago"
        icon={Receipt}
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setReceiptId(null)}>
              Cerrar
            </Button>
            <Button icon={Printer} onClick={() => window.print()}>
              Imprimir
            </Button>
          </>
        }
      >
        {receiptReg && (
          <>
            <style>{`@media print {
  #cjn-receipt, #cjn-receipt * { visibility: visible !important; }
  #cjn-receipt { position: fixed; left: 0; top: 0; width: 100%; max-width: 420px; border: none !important; }
}`}</style>
            <div id="cjn-receipt" className="rounded-2xl border border-dashed border-slate-300 p-5 space-y-4 bg-white">
              <div className="text-center space-y-0.5">
                <div className="text-[10px] font-black uppercase tracking-widest text-[#0284C7]">
                  Comité Juvenil · UCE Bolivia
                </div>
                <div className="text-sm font-black text-slate-900">Comprobante de pago</div>
                <div className="text-xs font-mono font-bold text-slate-600">{receiptReg.payment.transactionFolio}</div>
              </div>
              <dl className="text-xs divide-y divide-dashed divide-slate-200">
                {[
                  ['Joven', receiptReg.fullName],
                  ['CI', receiptReg.documentId || '—'],
                  ['Entrada', receiptReg.ticketCode],
                  ['Campamento', getCampById(receiptReg.campId)?.name || '—'],
                  ['Método', METHOD[receiptReg.payment.paymentMethod].label],
                  ['Fecha', fmtStamp(paidAt(receiptReg))],
                  [
                    receiptReg.payment.cashierCollectedBy ? 'Cajero' : 'Verificado por',
                    receiptReg.payment.cashierCollectedBy || receiptReg.payment.verifiedBy || '—',
                  ],
                ].map(([k, v]) => (
                  <div key={k} className="flex justify-between gap-3 py-1.5">
                    <dt className="text-slate-500 shrink-0">{k}</dt>
                    <dd className="font-semibold text-slate-800 text-right min-w-0 break-words">{v}</dd>
                  </div>
                ))}
              </dl>
              <div className="flex justify-between items-baseline pt-2 border-t-2 border-slate-900">
                <span className="text-sm font-black text-slate-900">Total pagado</span>
                <span className="font-mono font-black text-xl text-slate-900">{formatBs(receiptReg.payment.totalAmount)}</span>
              </div>
              <p className="text-[10px] text-center text-slate-400">¡Gracias! Presenta tu credencial QR al ingresar.</p>
            </div>
          </>
        )}
      </Modal>
    </AdminPage>
  );
};

// =========================================================
// Selector de origen: campamento / campeonatos (pagos extra)
// =========================================================

const SourceSwitch: React.FC<{
  value: 'camp' | 'extras';
  onChange: (v: 'camp' | 'extras') => void;
  campPending: number;
  extrasPending: number;
}> = ({ value, onChange, campPending, extrasPending }) => {
  const options = [
    { id: 'camp' as const, label: 'Campamento', hint: 'Tarifa de inscripción', icon: Tent, pending: campPending },
    { id: 'extras' as const, label: 'Campeonatos', hint: 'Pagos extra de equipos e individuales', icon: Trophy, pending: extrasPending },
  ];
  return (
    <div className="grid grid-cols-2 gap-2 sm:gap-3 p-1.5 rounded-3xl bg-slate-100/80 border border-slate-200/60" role="tablist">
      {options.map((o) => {
        const active = value === o.id;
        const Icon = o.icon;
        return (
          <button
            key={o.id}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(o.id)}
            className={`flex items-center gap-2.5 sm:gap-3 px-3 sm:px-4 py-2.5 sm:py-3 rounded-2xl text-left transition-all cursor-pointer ${
              active ? 'bg-white shadow-md ring-1 ring-sky-100' : 'hover:bg-white/60'
            }`}
          >
            <span
              className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                active ? 'bg-[#0284C7] text-white' : 'bg-white text-slate-500'
              }`}
            >
              <Icon className="w-4 h-4" />
            </span>
            <span className="min-w-0 flex-1">
              <span className={`block text-xs sm:text-sm font-black truncate ${active ? 'text-slate-900' : 'text-slate-600'}`}>
                {o.label}
              </span>
              <span className="hidden sm:block text-[10px] text-slate-500 truncate">{o.hint}</span>
            </span>
            {o.pending > 0 && (
              <span
                className="min-w-6 px-1.5 py-0.5 rounded-full text-[10px] font-mono font-black text-center bg-violet-600 text-white shrink-0"
                title={`${o.pending} pendientes de verificar o cobrar`}
              >
                {o.pending}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
};

// =========================================================
// Pagos extra de campeonatos
// =========================================================

type ExtraStatus = ExtraPayment['status'];

const EXTRA_TAB_STATUS: Record<Exclude<TabId, 'all'>, ExtraStatus> = {
  verify: 'pending_verification',
  cash: 'pending_cash',
  rejected: 'rejected',
  paid: 'completed',
};

const EXTRA_METHOD: Record<ExtraPayment['method'], { label: string; icon: React.ElementType; cls: string }> = {
  ...METHOD,
  free: { label: 'Sin costo', icon: CheckCircle2, cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
};

const extraDateOf = (e: ChampionshipEntry) => e.payment.voucherUploadedAt || e.createdAt || '';
const extraPaidAt = (e: ChampionshipEntry) => e.payment.collectedAt || e.payment.verifiedAt || e.createdAt || '';

const ExtraPaymentsPanel: React.FC = () => {
  const {
    championshipEntries,
    registrations,
    adminCampFilter,
    getCampById,
    getChampionshipById,
    getTribeById,
    approveEntryPayment,
    rejectEntryPayment,
    collectEntryPayment,
  } = useCamp();
  const { currentUser, can } = useAuth();
  const { confirm } = useConfirm();
  const canVerify = can('payments:verify');
  const canCollect = can('payments:collect');
  const staffName = currentUser ? `${currentUser.firstName} ${currentUser.paternalLastName}`.trim() : 'Tesorería CJN';
  const campFiltered = adminCampFilter !== 'ALL';

  const [busy, setBusy] = useState<string | null>(null);
  const spin = (key: string) => (busy === key ? '[&>svg]:animate-spin' : '');
  const [tab, setTab] = useState<TabId>('verify');
  const [query, setQuery] = useState('');
  const [method, setMethod] = useState<'ALL' | PayMethod>('ALL');
  const [sort, setSort] = useState<SortId>('recent');
  const [limit, setLimit] = useState(PAGE_SIZE);

  const [reviewId, setReviewId] = useState<string | null>(null);
  const [checks, setChecks] = useState<boolean[]>([false, false, false]);
  const [rejecting, setRejecting] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [rejectNote, setRejectNote] = useState('');
  const [rejectError, setRejectError] = useState('');

  const [cashId, setCashId] = useState<string | null>(null);
  const [received, setReceived] = useState('');
  const [cashDone, setCashDone] = useState<ChampionshipEntry | null>(null);

  const findEntry = (id: string | null) => (id ? championshipEntries.find((e) => e.id === id) : undefined);
  const reviewEntry = findEntry(reviewId);
  const cashEntry = findEntry(cashId);
  const captainOf = (e: ChampionshipEntry) => registrations.find((r) => r.id === e.captainRegistrationId);
  const captainName = (e: ChampionshipEntry) =>
    captainOf(e)?.fullName || e.members.find((m) => m.role === 'captain')?.fullName || e.members[0]?.fullName || '—';

  /** Solo pagos con monto; las inscripciones anuladas se muestran solo si ya se había cobrado. */
  const scoped = useMemo(
    () =>
      championshipEntries.filter(
        (e) =>
          (adminCampFilter === 'ALL' || e.campId === adminCampFilter) &&
          e.payment.method !== 'free' &&
          e.payment.amount > 0 &&
          (e.status !== 'cancelled' || e.payment.status === 'completed')
      ),
    [championshipEntries, adminCampFilter]
  );

  const live = scoped.filter((e) => e.status !== 'cancelled');
  const byStatus = (s: ExtraStatus) => live.filter((e) => e.payment.status === s);
  const kVerify = byStatus('pending_verification');
  const kCash = byStatus('pending_cash');
  const kRejected = byStatus('rejected');
  const kPaid = scoped.filter((e) => e.payment.status === 'completed');
  const sum = (list: ChampionshipEntry[]) => list.reduce((acc, e) => acc + (e.payment.amount || 0), 0);

  const matchesQuery = (e: ChampionshipEntry) => {
    const raw = query.trim();
    if (!raw) return true;
    const q = normalizeText(raw);
    const qDigits = digitsOf(raw);
    const cap = captainOf(e);
    if (qDigits.length >= 3 && (digitsOf(cap?.documentId).includes(qDigits) || digitsOf(cap?.phone).includes(qDigits))) return true;
    const ch = getChampionshipById(e.championshipId);
    return (
      normalizeText(captainName(e)).includes(q) ||
      e.members.some((m) => normalizeText(m.fullName).includes(q)) ||
      normalizeText(e.teamName).includes(q) ||
      normalizeText(e.inviteCode).includes(q) ||
      normalizeText(cap?.documentId).includes(q) ||
      normalizeText(cap?.ticketCode).includes(q) ||
      normalizeText(ch?.name).includes(q) ||
      normalizeText(e.payment.folio).includes(q) ||
      normalizeText(e.payment.voucherReferenceNumber).includes(q)
    );
  };

  const filtered = scoped.filter((e) => (method === 'ALL' || e.payment.method === method) && matchesQuery(e));
  const inTab = (e: ChampionshipEntry, t: TabId) =>
    t === 'all' ? true : e.payment.status === EXTRA_TAB_STATUS[t] && (t === 'paid' || e.status !== 'cancelled');
  const countFor = (t: TabId) => filtered.filter((e) => inTab(e, t)).length;
  const list = filtered
    .filter((e) => inTab(e, tab))
    .sort((a, b) => {
      if (sort === 'amount') return b.payment.amount - a.payment.amount;
      const cmp = extraDateOf(a).localeCompare(extraDateOf(b));
      return sort === 'oldest' ? cmp : -cmp;
    });
  const visible = list.slice(0, limit);
  const hasFilters = !!query.trim() || method !== 'ALL';

  const changeTab = (t: TabId) => {
    setTab(t);
    setLimit(PAGE_SIZE);
  };

  // ── Acciones ─────────────────────────────────────────
  const withBusy = async <T,>(key: string, fn: () => Promise<T>): Promise<T> => {
    setBusy(key);
    try {
      return await fn();
    } finally {
      setBusy(null);
    }
  };

  const openReview = (e: ChampionshipEntry) => {
    setReviewId(e.id);
    setChecks([false, false, false]);
    setRejecting(false);
    setRejectReason('');
    setRejectNote('');
    setRejectError('');
  };
  const closeReview = () => !busy && setReviewId(null);

  const openCash = (e: ChampionshipEntry) => {
    setCashId(e.id);
    setReceived('');
    setCashDone(null);
  };
  const closeCash = () => {
    if (busy) return;
    setCashId(null);
    setCashDone(null);
  };

  const handleApprove = async (e: ChampionshipEntry, warn = false) => {
    if (busy) return;
    if (warn) {
      const ok = await confirm({
        title: '¿Aprobar este pago extra de todos modos?',
        message: 'El comprobante fue rechazado anteriormente. Aprobarlo confirmará la inscripción al campeonato.',
        details: [
          <>Motivo del rechazo: <b>{e.payment.rejectionReason || 'Sin motivo registrado'}</b></>,
          <>Monto: <b className="font-mono">{formatBs(e.payment.amount)}</b></>,
        ],
        tone: 'warning',
        confirmText: 'Sí, aprobar',
      });
      if (!ok) return;
    }
    const updated = await withBusy('approve', () => approveEntryPayment(e.id));
    if (updated) setReviewId(null);
  };

  const handleReject = async () => {
    if (!reviewEntry || busy) return;
    if (!rejectReason) return setRejectError('Selecciona el motivo del rechazo.');
    if (rejectReason === 'Otro' && rejectNote.trim().length < 5) return setRejectError('Describe el motivo en la nota.');
    const reason = rejectNote.trim()
      ? rejectReason === 'Otro'
        ? rejectNote.trim()
        : `${rejectReason}: ${rejectNote.trim()}`
      : rejectReason;
    const updated = await withBusy('reject', () => rejectEntryPayment(reviewEntry.id, reason));
    if (updated) setReviewId(null);
  };

  const handleCollect = async () => {
    if (!cashEntry || busy) return;
    const updated = await withBusy('collect', () => collectEntryPayment(cashEntry.id));
    if (updated) setCashDone(updated);
  };

  // ── Piezas ───────────────────────────────────────────
  const renderMethod = (m: ExtraPayment['method']) => {
    const cfg = EXTRA_METHOD[m];
    const Icon = cfg.icon;
    return (
      <Badge className={cfg.cls}>
        <Icon className="w-3 h-3" />
        {cfg.label}
      </Badge>
    );
  };

  const renderStatus = (e: ChampionshipEntry) => {
    const cfg = STATUS[e.payment.status];
    const Icon = cfg.icon;
    return (
      <div className="flex flex-col items-start gap-1">
        <Badge className={cfg.cls}>
          <Icon className="w-3 h-3" />
          {cfg.label}
        </Badge>
        {e.status === 'cancelled' && (
          <Badge className="bg-slate-100 text-slate-500 border-slate-200">
            <Ban className="w-3 h-3" /> Inscripción anulada
          </Badge>
        )}
      </div>
    );
  };

  const renderConcept = (e: ChampionshipEntry) => {
    const ch = getChampionshipById(e.championshipId);
    return (
      <div className="flex items-center gap-3 min-w-[12rem]">
        <span
          className={`w-9 h-9 rounded-2xl flex items-center justify-center shrink-0 ${
            e.type === 'team' ? 'bg-indigo-50 text-indigo-600' : 'bg-amber-50 text-amber-600'
          }`}
        >
          {e.type === 'team' ? <Users className="w-4 h-4" /> : <Trophy className="w-4 h-4" />}
        </span>
        <div className="min-w-0">
          <div className="font-bold text-slate-900 truncate max-w-[14rem]">{ch?.name || 'Campeonato eliminado'}</div>
          <div className="text-[10px] text-slate-500 truncate max-w-[14rem]">
            {e.type === 'team' ? (
              <>
                Equipo <b className="text-slate-700">{e.teamName}</b> · {e.members.length} integrantes
              </>
            ) : (
              'Inscripción individual'
            )}
          </div>
        </div>
      </div>
    );
  };

  const renderPayer = (e: ChampionshipEntry) => {
    const cap = captainOf(e);
    const tribe = cap ? getTribeById(cap.tribeId) : undefined;
    return (
      <div className="flex items-center gap-2 min-w-[9rem]">
        <span
          className="w-2.5 h-2.5 rounded-full shrink-0"
          style={{ backgroundColor: tribe?.colorHex || '#CBD5E1' }}
          title={tribe ? `Tribu ${tribe.name}` : undefined}
        />
        <div className="min-w-0">
          <div className="font-semibold text-slate-800 truncate max-w-[12rem]">{captainName(e)}</div>
          <div className="text-[10px] text-slate-500 font-mono">
            CI {cap?.documentId || '—'}
            {e.type === 'team' && <span className="font-sans"> · capitán</span>}
          </div>
        </div>
      </div>
    );
  };

  const renderActions = (e: ChampionshipEntry, full = false) => {
    const w = full ? 'flex-1' : '';
    switch (e.payment.status) {
      case 'pending_verification':
        return canVerify ? (
          <Button size="sm" icon={ListChecks} className={w} onClick={() => openReview(e)}>
            Revisar
          </Button>
        ) : (
          <Button size="sm" variant="secondary" icon={Eye} className={w} onClick={() => openReview(e)}>
            Ver comprobante
          </Button>
        );
      case 'pending_cash':
        return canCollect ? (
          <Button size="sm" variant="amber" icon={Banknote} className={w} onClick={() => openCash(e)}>
            Cobrar
          </Button>
        ) : (
          <span className="text-[10px] font-bold text-slate-400 inline-flex items-center gap-1" title="Requiere el permiso «Cobrar en caja»">
            <Lock className="w-3 h-3" /> Cobro en caja
          </span>
        );
      case 'rejected':
        return (
          <>
            <Button size="sm" variant="secondary" icon={Eye} className={w} onClick={() => openReview(e)}>
              Ver
            </Button>
            {canCollect && (
              <Button size="sm" variant="secondary" icon={Banknote} className={w} onClick={() => openCash(e)}>
                Cobrar
              </Button>
            )}
          </>
        );
      case 'completed':
        return (
          <Button size="sm" variant="ghost" icon={Receipt} className={w} onClick={() => openReview(e)}>
            Detalle
          </Button>
        );
      default:
        return null;
    }
  };

  const tabs: { id: TabId; label: string; icon: React.ElementType; activeCls: string }[] = [
    { id: 'verify', label: 'Por verificar', icon: FileImage, activeCls: 'bg-violet-600 text-white' },
    { id: 'cash', label: 'Pendientes en caja', icon: Banknote, activeCls: 'bg-amber-500 text-white' },
    { id: 'rejected', label: 'Rechazados', icon: XCircle, activeCls: 'bg-rose-600 text-white' },
    { id: 'paid', label: 'Pagados', icon: CheckCircle2, activeCls: 'bg-emerald-600 text-white' },
    { id: 'all', label: 'Todos', icon: Inbox, activeCls: 'bg-slate-900 text-white' },
  ];

  const EMPTY: Record<TabId, string> = {
    verify: 'No hay comprobantes extra por verificar.',
    cash: 'No hay pagos extra pendientes en caja.',
    rejected: 'No hay comprobantes extra rechazados.',
    paid: 'Todavía no hay pagos extra confirmados.',
    all: 'Aún no hay pagos extra de campeonatos.',
  };

  // Modal de revisión
  const reviewChamp = reviewEntry ? getChampionshipById(reviewEntry.championshipId) : undefined;
  const reviewCap = reviewEntry ? captainOf(reviewEntry) : undefined;
  const reviewPending = reviewEntry?.payment.status === 'pending_verification' && reviewEntry.status !== 'cancelled';
  const reviewRejected = reviewEntry?.payment.status === 'rejected';
  const allChecked = checks.every(Boolean);

  // Modal de caja
  const cashAmount = cashEntry?.payment.amount || 0;
  const receivedNum = Number(received.replace(',', '.')) || 0;
  const change = receivedNum - cashAmount;

  return (
    <>
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3 sm:gap-4">
        <StatCard label="Extras por verificar" value={kVerify.length} hint={`${formatBs(sum(kVerify))} en revisión`} icon={FileImage} tone="violet" />
        <StatCard label="Extras en caja" value={kCash.length} hint={`${formatBs(sum(kCash))} por cobrar`} icon={Banknote} tone="amber" />
        <StatCard
          label="Extras cobrados"
          value={<span className="text-xl sm:text-3xl">{formatBs(sum(kPaid))}</span>}
          hint={`${kPaid.length} pagos confirmados`}
          icon={ShieldCheck}
          tone="emerald"
        />
        <StatCard label="Rechazados" value={kRejected.length} hint="Esperando nuevo comprobante" icon={XCircle} tone="rose" />
      </div>

      <div className="-mx-4 px-4 sm:mx-0 sm:px-0 overflow-x-auto no-scrollbar">
        <div className="flex gap-2 w-max sm:w-auto sm:flex-wrap">
          {tabs.map((t) => {
            const Icon = t.icon;
            const active = tab === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => changeTab(t.id)}
                className={`flex items-center gap-2 pl-3 pr-2 py-2 rounded-full text-xs font-bold whitespace-nowrap transition-all cursor-pointer border ${
                  active ? `${t.activeCls} border-transparent shadow-md` : 'bg-white text-slate-600 border-slate-200 hover:border-sky-300 hover:text-slate-900'
                }`}
              >
                <Icon className="w-4 h-4" />
                {t.label}
                <span
                  className={`min-w-6 px-1.5 py-0.5 rounded-full text-[10px] font-mono font-black text-center ${
                    active ? 'bg-white/25 text-white' : 'bg-slate-100 text-slate-600'
                  }`}
                >
                  {countFor(t.id)}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <Card className="p-3 sm:p-4">
        <div className="flex flex-col lg:flex-row gap-3">
          <div className="relative flex-1 min-w-0">
            <IdCard className="w-5 h-5 text-[#0284C7] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setLimit(PAGE_SIZE);
              }}
              placeholder="Buscar por CI, nombre, equipo o código de entrada"
              aria-label="Buscar por CI, nombre, equipo o código de entrada"
              className="w-full pl-11 pr-10 py-3 text-sm rounded-2xl border-2 border-sky-100 bg-sky-50/50 text-slate-900 font-semibold outline-none transition-all placeholder:font-normal placeholder:text-slate-400 focus:bg-white focus:border-sky-400 focus:ring-4 focus:ring-sky-100"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer"
                aria-label="Limpiar búsqueda"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
          <div className="grid grid-cols-2 gap-2 lg:w-[22rem] shrink-0">
            <div className="relative">
              <Filter className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <SelectInput
                value={method}
                onChange={(e) => {
                  setMethod(e.target.value as 'ALL' | PayMethod);
                  setLimit(PAGE_SIZE);
                }}
                className="pl-8 py-3 text-xs font-bold rounded-2xl"
                aria-label="Filtrar por método"
              >
                <option value="ALL">Todo método</option>
                <option value="qr_bank">QR</option>
                <option value="transfer">Transferencia</option>
                <option value="cash_box">Efectivo</option>
              </SelectInput>
            </div>
            <div className="relative">
              <ArrowDownUp className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <SelectInput
                value={sort}
                onChange={(e) => setSort(e.target.value as SortId)}
                className="pl-8 py-3 text-xs font-bold rounded-2xl"
                aria-label="Ordenar"
              >
                <option value="recent">Más recientes</option>
                <option value="oldest">Más antiguos</option>
                <option value="amount">Mayor monto</option>
              </SelectInput>
            </div>
          </div>
        </div>
        {hasFilters && (
          <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
            <span>
              <b className="text-slate-800">{list.length}</b> resultado{list.length === 1 ? '' : 's'} en esta pestaña ·{' '}
              <b className="text-slate-800">{filtered.length}</b> en total
            </span>
            <button
              type="button"
              onClick={() => {
                setQuery('');
                setMethod('ALL');
              }}
              className="font-bold text-[#0284C7] hover:underline cursor-pointer"
            >
              Limpiar filtros
            </button>
          </div>
        )}
      </Card>

      {list.length === 0 ? (
        <Card>
          <EmptyState
            icon={hasFilters ? IdCard : Trophy}
            title={hasFilters ? 'Sin resultados' : EMPTY[tab]}
            description={
              hasFilters
                ? 'No encontramos pagos extra que coincidan en esta pestaña. Revisa el CI o prueba en «Todos».'
                : 'Los pagos extra se generan cuando un joven se inscribe a un campeonato con costo o un capitán registra a su equipo.'
            }
            action={
              hasFilters && tab !== 'all' ? (
                <Button variant="secondary" size="sm" onClick={() => changeTab('all')}>
                  Buscar en todos
                </Button>
              ) : undefined
            }
          />
        </Card>
      ) : (
        <>
          <div className="hidden md:block">
            <Table
              head={
                <tr>
                  <th className="px-4 py-3">Concepto</th>
                  <th className="px-4 py-3">Pagador</th>
                  {!campFiltered && <th className="px-4 py-3 hidden lg:table-cell">Campamento</th>}
                  <th className="px-4 py-3">Método</th>
                  <th className="px-4 py-3 text-right">Monto</th>
                  <th className="px-4 py-3 hidden xl:table-cell">Fecha</th>
                  <th className="px-4 py-3">Estado</th>
                  <th className="px-4 py-3 text-right">Acciones</th>
                </tr>
              }
            >
              {visible.map((e) => (
                <tr key={e.id} className="hover:bg-sky-50/40 align-middle">
                  <td className="px-4 py-3">{renderConcept(e)}</td>
                  <td className="px-4 py-3">{renderPayer(e)}</td>
                  {!campFiltered && (
                    <td className="px-4 py-3 hidden lg:table-cell text-slate-600">
                      <span className="line-clamp-2 max-w-[11rem]">{getCampById(e.campId)?.name || '—'}</span>
                    </td>
                  )}
                  <td className="px-4 py-3">{renderMethod(e.payment.method)}</td>
                  <td className="px-4 py-3 text-right font-mono font-black text-slate-900 whitespace-nowrap">{formatBs(e.payment.amount)}</td>
                  <td className="px-4 py-3 hidden xl:table-cell font-mono text-[11px] text-slate-500 whitespace-nowrap">
                    {fmtStamp(extraDateOf(e))}
                  </td>
                  <td className="px-4 py-3">
                    {renderStatus(e)}
                    {e.payment.status === 'rejected' && e.payment.rejectionReason && (
                      <div className="text-[10px] text-rose-600 mt-1 max-w-[10rem] line-clamp-2" title={e.payment.rejectionReason}>
                        {e.payment.rejectionReason}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-1.5 flex-wrap">{renderActions(e)}</div>
                  </td>
                </tr>
              ))}
            </Table>
          </div>

          <div className="md:hidden space-y-3">
            {visible.map((e) => (
              <Card key={e.id} className="p-4 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  {renderConcept(e)}
                  {renderStatus(e)}
                </div>
                {renderPayer(e)}
                {!campFiltered && (
                  <div className="flex items-center gap-1.5 text-[11px] text-slate-600">
                    <Tent className="w-3.5 h-3.5 text-[#0284C7] shrink-0" />
                    <span className="truncate">{getCampById(e.campId)?.name || '—'}</span>
                  </div>
                )}
                <div className="flex items-end justify-between gap-3 rounded-2xl bg-slate-50 border border-slate-100 p-3">
                  <div className="space-y-1">
                    {renderMethod(e.payment.method)}
                    <div className="text-[10px] text-slate-500 font-mono">{fmtStamp(extraDateOf(e))}</div>
                  </div>
                  <div className="font-mono font-black text-slate-900">{formatBs(e.payment.amount)}</div>
                </div>
                {e.payment.status === 'rejected' && e.payment.rejectionReason && (
                  <div className="flex gap-2 text-[11px] text-rose-700 bg-rose-50 border border-rose-100 rounded-xl p-2.5">
                    <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                    <span>{e.payment.rejectionReason}</span>
                  </div>
                )}
                <div className="flex gap-2">{renderActions(e, true)}</div>
              </Card>
            ))}
          </div>

          <div className="flex flex-col items-center gap-2 pt-1">
            <span className="text-[11px] text-slate-500">
              Mostrando <b className="text-slate-800">{visible.length}</b> de <b className="text-slate-800">{list.length}</b>
            </span>
            {visible.length < list.length && (
              <Button variant="secondary" icon={ChevronDown} onClick={() => setLimit((l) => l + PAGE_SIZE)}>
                Mostrar más
              </Button>
            )}
          </div>
        </>
      )}

      {/* ════════ Modal: revisión de pago extra ════════ */}
      <Modal
        open={!!reviewEntry}
        onClose={closeReview}
        title={reviewRejected ? 'Pago extra rechazado' : reviewPending ? 'Verificar pago extra' : 'Detalle del pago extra'}
        subtitle={
          reviewEntry
            ? `${reviewChamp?.name || 'Campeonato'}${reviewEntry.teamName ? ` · ${reviewEntry.teamName}` : ''} · ${captainName(reviewEntry)}`
            : undefined
        }
        icon={reviewRejected ? XCircle : ShieldCheck}
        size="xl"
        footer={
          reviewEntry && (
            <>
              {reviewPending && !canVerify && (
                <>
                  <span className="text-[11px] text-slate-500 inline-flex items-center gap-1 sm:mr-auto">
                    <Lock className="w-3.5 h-3.5" /> No tienes permiso para aprobar o rechazar comprobantes.
                  </span>
                  <Button variant="secondary" onClick={closeReview}>
                    Cerrar
                  </Button>
                </>
              )}
              {reviewPending && canVerify && !rejecting && (
                <>
                  <Button variant="secondary" onClick={closeReview} disabled={!!busy}>
                    Cancelar
                  </Button>
                  <Button variant="danger" icon={Ban} disabled={!!busy} onClick={() => setRejecting(true)}>
                    Rechazar
                  </Button>
                  <Button
                    icon={busy === 'approve' ? Loader2 : CheckCircle2}
                    disabled={!allChecked || !!busy}
                    onClick={() => handleApprove(reviewEntry)}
                    title={allChecked ? undefined : 'Marca los 3 puntos de la lista de verificación'}
                    className={`!bg-emerald-600 hover:!bg-emerald-700 ${spin('approve')}`}
                  >
                    {busy === 'approve' ? 'Aprobando…' : 'Aprobar pago'}
                  </Button>
                </>
              )}
              {reviewPending && canVerify && rejecting && (
                <>
                  <Button variant="secondary" onClick={() => setRejecting(false)} disabled={!!busy}>
                    Volver
                  </Button>
                  <Button
                    icon={busy === 'reject' ? Loader2 : Ban}
                    disabled={!!busy}
                    className={`!bg-red-600 hover:!bg-red-700 ${spin('reject')}`}
                    onClick={handleReject}
                  >
                    {busy === 'reject' ? 'Rechazando…' : 'Confirmar rechazo'}
                  </Button>
                </>
              )}
              {!reviewPending && (
                <>
                  <Button variant="secondary" onClick={closeReview} disabled={!!busy}>
                    Cerrar
                  </Button>
                  {reviewRejected && reviewEntry.status !== 'cancelled' && canVerify && (
                    <Button
                      variant="amber"
                      icon={busy === 'approve' ? Loader2 : CheckCircle2}
                      disabled={!!busy}
                      className={spin('approve')}
                      onClick={() => handleApprove(reviewEntry, true)}
                    >
                      {busy === 'approve' ? 'Aprobando…' : 'Aprobar de todos modos'}
                    </Button>
                  )}
                </>
              )}
            </>
          )
        }
      >
        {reviewEntry && (
          <div className="grid grid-cols-1 md:grid-cols-5 gap-5">
            <div className="md:col-span-2 space-y-2">
              {reviewEntry.payment.voucherImageUrl ? (
                <button
                  type="button"
                  onClick={() => openImageInNewTab(reviewEntry.payment.voucherImageUrl!)}
                  className="relative block w-full aspect-[3/4] max-h-[60vh] rounded-2xl overflow-hidden border border-slate-200 bg-slate-100 group cursor-zoom-in"
                  title="Abrir en tamaño completo"
                >
                  <img src={reviewEntry.payment.voucherImageUrl} alt="Comprobante de pago" className="w-full h-full object-contain" />
                  <span className="absolute bottom-2 right-2 inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-slate-950/70 text-white text-[10px] font-bold opacity-90 group-hover:opacity-100">
                    <ZoomIn className="w-3.5 h-3.5" /> Tamaño completo
                  </span>
                </button>
              ) : (
                <div className="w-full aspect-[3/4] max-h-[60vh] rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50 flex flex-col items-center justify-center text-center p-6 text-slate-400">
                  <FileImage className="w-10 h-10 mb-2" />
                  <span className="text-xs font-bold text-slate-500">Sin imagen del comprobante</span>
                  <span className="text-[11px] mt-1">
                    {reviewEntry.payment.method === 'qr_bank'
                      ? 'Pago QR: verifica con la referencia en el extracto bancario.'
                      : reviewEntry.payment.method === 'cash_box'
                      ? 'Pago en efectivo registrado en caja.'
                      : 'Solicita al capitán que reenvíe la foto si es necesario.'}
                  </span>
                </div>
              )}
            </div>

            <div className="md:col-span-3 space-y-4 min-w-0">
              {reviewRejected && (
                <div className="rounded-2xl bg-rose-50 border border-rose-100 p-3.5 text-xs text-rose-800 space-y-1">
                  <div className="flex items-center gap-1.5 font-black">
                    <XCircle className="w-4 h-4" /> Rechazado
                  </div>
                  <p>{reviewEntry.payment.rejectionReason || 'Sin motivo registrado.'}</p>
                </div>
              )}

              <dl className="rounded-2xl border border-slate-100 divide-y divide-slate-100 text-xs">
                {[
                  { k: 'Campeonato', v: reviewChamp?.name || '—', icon: Trophy },
                  ...(reviewEntry.type === 'team'
                    ? [{ k: 'Equipo', v: `${reviewEntry.teamName} (${reviewEntry.members.length} integrantes)`, icon: Users }]
                    : []),
                  {
                    k: reviewEntry.type === 'team' ? 'Capitán' : 'Joven',
                    v: `${captainName(reviewEntry)} · CI ${reviewCap?.documentId || '—'}`,
                    icon: IdCard,
                  },
                  { k: 'Campamento', v: getCampById(reviewEntry.campId)?.name || '—', icon: Tent },
                  { k: 'Método', v: EXTRA_METHOD[reviewEntry.payment.method].label, icon: Wallet },
                  {
                    k: 'Referencia',
                    v: <span className="font-mono font-black">{reviewEntry.payment.voucherReferenceNumber || '—'}</span>,
                    icon: Hash,
                  },
                  { k: 'Folio', v: <span className="font-mono">{reviewEntry.payment.folio}</span>, icon: Receipt },
                  { k: 'Fecha de envío', v: fmtStamp(extraDateOf(reviewEntry)), icon: Clock },
                ].map(({ k, v, icon: Icon }) => (
                  <div key={k} className="flex items-center justify-between gap-3 px-3.5 py-2.5">
                    <dt className="flex items-center gap-1.5 text-slate-500 shrink-0">
                      <Icon className="w-3.5 h-3.5" /> {k}
                    </dt>
                    <dd className="text-slate-800 font-semibold text-right truncate min-w-0">{v}</dd>
                  </div>
                ))}
              </dl>

              <div className="rounded-2xl bg-sky-50 border border-sky-100 p-3.5 space-y-1.5 text-xs">
                {reviewChamp && (
                  <div className="flex justify-between text-slate-600">
                    <span>Costo extra {reviewChamp.mode === 'team' ? 'por equipo' : 'por persona'}</span>
                    <span className="font-mono font-bold">{formatBs(reviewChamp.registrationFee)}</span>
                  </div>
                )}
                <div className="flex justify-between items-baseline pt-1.5 border-t border-sky-200">
                  <span className="font-black text-slate-900">Monto esperado</span>
                  <span className="font-mono font-black text-2xl text-[#0284C7]">{formatBs(reviewEntry.payment.amount)}</span>
                </div>
              </div>

              {reviewPending && !rejecting && (
                <div className="rounded-2xl border border-slate-200 p-3.5 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-black uppercase tracking-wider text-slate-600">Lista de verificación</span>
                    <span className={`text-[11px] font-mono font-black ${allChecked ? 'text-emerald-600' : 'text-slate-400'}`}>
                      {checks.filter(Boolean).length}/3
                    </span>
                  </div>
                  {CHECKLIST.map((label, i) => {
                    const on = checks[i];
                    return (
                      <button
                        key={label}
                        type="button"
                        onClick={() => setChecks((prev) => prev.map((c, j) => (j === i ? !c : c)))}
                        className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl border text-left text-xs font-bold transition-colors cursor-pointer ${
                          on ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-slate-200 bg-slate-50 text-slate-700 hover:border-sky-300'
                        }`}
                        aria-pressed={on}
                      >
                        {on ? <CheckSquare className="w-4 h-4 text-emerald-600 shrink-0" /> : <Square className="w-4 h-4 text-slate-400 shrink-0" />}
                        {label}
                      </button>
                    );
                  })}
                  <p className="text-[10px] text-slate-400">
                    Verificador: <b className="text-slate-600">{staffName}</b>
                  </p>
                </div>
              )}

              {reviewPending && rejecting && (
                <div className="rounded-2xl border-2 border-red-100 bg-red-50/40 p-3.5 space-y-3">
                  <div className="flex items-center gap-1.5 text-xs font-black text-red-700">
                    <Ban className="w-4 h-4" /> Rechazar comprobante
                  </div>
                  <Field label="Motivo" required error={rejectError && !rejectReason ? rejectError : undefined}>
                    <SelectInput
                      value={rejectReason}
                      onChange={(ev) => {
                        setRejectReason(ev.target.value);
                        setRejectError('');
                      }}
                    >
                      <option value="">Selecciona un motivo…</option>
                      {REJECT_REASONS.map((r) => (
                        <option key={r} value={r}>
                          {r}
                        </option>
                      ))}
                    </SelectInput>
                  </Field>
                  <Field
                    label={rejectReason === 'Otro' ? 'Describe el motivo' : 'Nota para el capitán (opcional)'}
                    required={rejectReason === 'Otro'}
                    error={rejectError && rejectReason ? rejectError : undefined}
                  >
                    <TextArea
                      value={rejectNote}
                      onChange={(ev) => {
                        setRejectNote(ev.target.value);
                        setRejectError('');
                      }}
                      placeholder="Ej.: El monto depositado no coincide con el costo del equipo."
                    />
                  </Field>
                  <p className="text-[10px] text-slate-500">Verá este motivo en «Mis inscripciones» y podrá reenviar su comprobante.</p>
                </div>
              )}

              {reviewEntry.payment.status === 'completed' && (
                <div className="rounded-2xl bg-emerald-50 border border-emerald-100 p-3.5 text-xs text-emerald-800">
                  {reviewEntry.payment.collectedBy ? 'Cobrado en caja por ' : 'Aprobado por '}
                  <b>{reviewEntry.payment.collectedBy || reviewEntry.payment.verifiedBy || '—'}</b> · {fmtStamp(extraPaidAt(reviewEntry))}
                </div>
              )}
            </div>
          </div>
        )}
      </Modal>

      {/* ════════ Modal: cobro en caja (pago extra) ════════ */}
      <Modal
        open={!!cashEntry}
        onClose={closeCash}
        title={cashDone ? 'Cobro registrado' : 'Cobrar pago extra'}
        subtitle={cashDone ? undefined : 'Inscripción a campeonato · pago en efectivo.'}
        icon={cashDone ? CheckCircle2 : Calculator}
        size="md"
        footer={
          cashDone ? (
            <Button variant="secondary" onClick={closeCash}>
              Cerrar
            </Button>
          ) : (
            <>
              <Button variant="secondary" onClick={closeCash} disabled={!!busy}>
                Cancelar
              </Button>
              <Button
                icon={busy === 'collect' ? Loader2 : Banknote}
                onClick={handleCollect}
                className={spin('collect')}
                disabled={!canCollect || !!busy || receivedNum < cashAmount}
              >
                {busy === 'collect' ? 'Registrando…' : 'Confirmar cobro'}
              </Button>
            </>
          )
        }
      >
        {cashEntry && !cashDone && (
          <div className="space-y-4">
            <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4 space-y-2 text-sm">
              <div className="text-xs">{renderConcept(cashEntry)}</div>
              <div className="text-xs">{renderPayer(cashEntry)}</div>
              <div className="flex justify-between items-baseline pt-2 border-t border-slate-200">
                <span className="font-black text-slate-900">Monto a cobrar</span>
                <span className="font-mono font-black text-2xl text-[#0284C7]">{formatBs(cashAmount)}</span>
              </div>
            </div>
            <Field label="Monto recibido (Bs)" required>
              <TextInput
                type="number"
                inputMode="decimal"
                min={0}
                autoFocus
                value={received}
                onChange={(ev) => setReceived(ev.target.value)}
                placeholder={String(cashAmount)}
                className="text-lg font-mono font-black"
              />
            </Field>
            <div className="flex flex-wrap gap-2">
              {Array.from(new Set([cashAmount, ...[50, 100, 200].map((s) => Math.ceil(cashAmount / s) * s)]))
                .filter((v) => v > 0)
                .sort((a, b) => a - b)
                .slice(0, 4)
                .map((v) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => setReceived(String(v))}
                    className={`px-3 py-1.5 rounded-xl text-[11px] font-mono font-bold border cursor-pointer transition-colors ${
                      receivedNum === v ? 'bg-sky-600 text-white border-sky-600' : 'bg-white text-slate-700 border-slate-200 hover:border-sky-300'
                    }`}
                  >
                    {v === cashAmount ? `Exacto · ${formatBs(v)}` : formatBs(v)}
                  </button>
                ))}
            </div>
            <div
              className={`rounded-2xl p-4 flex items-center justify-between gap-3 border ${
                !received
                  ? 'bg-slate-50 border-slate-100 text-slate-500'
                  : change >= 0
                  ? 'bg-emerald-50 border-emerald-100 text-emerald-800'
                  : 'bg-rose-50 border-rose-100 text-rose-700'
              }`}
            >
              <span className="text-xs font-black uppercase tracking-wider">{received && change < 0 ? 'Falta' : 'Cambio'}</span>
              <span className="font-mono font-black text-2xl">{received ? formatBs(Math.abs(change)) : '—'}</span>
            </div>
            <p className="text-[11px] text-slate-500">
              Cajero responsable: <span className="font-bold text-slate-700">{staffName}</span>
            </p>
          </div>
        )}
        {cashDone && (
          <div className="text-center py-2 space-y-3">
            <div className="w-16 h-16 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-9 h-9" />
            </div>
            <div>
              <div className="text-base font-black text-slate-900">{getChampionshipById(cashDone.championshipId)?.name}</div>
              <div className="text-xs text-slate-500">
                {cashDone.teamName ? `Equipo ${cashDone.teamName} · ` : ''}
                {captainName(cashDone)}
              </div>
            </div>
            <div className="inline-flex flex-col items-center rounded-2xl bg-slate-50 border border-slate-100 px-6 py-3">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Folio</span>
              <span className="text-lg font-black font-mono text-slate-900">{cashDone.payment.folio}</span>
              <span className="text-xs text-emerald-600 font-bold mt-1">Total pagado {formatBs(cashDone.payment.amount)}</span>
              {received && change > 0 && <span className="text-[11px] text-slate-500 mt-0.5">Cambio entregado: {formatBs(change)}</span>}
            </div>
            <p className="text-xs text-slate-500">La inscripción al campeonato quedó confirmada.</p>
          </div>
        )}
      </Modal>
    </>
  );
};
