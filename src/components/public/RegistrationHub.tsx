import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  Ban,
  Banknote,
  BookOpen,
  Building2,
  CalendarDays,
  Check,
  CheckCircle2,
  Clock,
  Copy,
  Crown,
  CreditCard,
  Hourglass,
  Link2,
  Loader2,
  Lock,
  LogOut,
  MapPin,
  MessageCircle,
  Plus,
  QrCode,
  RefreshCw,
  Share2,
  ShieldCheck,
  Sparkles,
  Ticket,
  Timer,
  Trophy,
  Upload,
  UserMinus,
  Users,
  Wallet,
  X,
} from 'lucide-react';
import type {
  Camp,
  CampCourse,
  CamperRegistration,
  Championship,
  ChampionshipEntry,
  PaymentSettings,
} from '../../types/camp';
import type { ExtraPaymentPayload } from '../../api/services';
import { useCamp } from '../../context/CampContext';
import { useAuth } from '../../context/AuthContext';
import { useConfirm } from '../common/ConfirmDialog';
import { useToast } from '../common/Toast';
import { Badge, Button, Field, ImageInput, Modal, TextInput } from '../admin/ui';
import { generateQrDataUrl } from '../../utils/qrGenerator';
import {
  animalEmoji,
  coursesOverlap,
  daysUntil,
  formatDateRange,
  formatLongDate,
  formatShortDate,
  getCampPhase,
  PHASE_META,
  todayISO,
  nowLocalStamp,
  courseWindowState,
  type CourseWindowState,
} from '../../utils/campUtils';

// =========================================================
// Utilidades
// =========================================================

type SectionId = 'pago' | 'talleres' | 'campeonatos' | 'equipos';
const SECTIONS: SectionId[] = ['pago', 'talleres', 'campeonatos', 'equipos'];


/** '2026-10-17T14:00' → '17 oct, 14:00' */
const formatStamp = (v?: string) => {
  if (!v) return '';
  const [date, time] = v.split('T');
  return time ? `${formatShortDate(date)}, ${time}` : formatShortDate(date);
};

function courseWindow(c: CampCourse, now: string): { state: CourseWindowState; label: string } {
  const state = courseWindowState(c, now);
  if (state === 'soon') return { state, label: `Próximamente: abre el ${formatStamp(c.enrollmentOpensAt)}` };
  if (state === 'closed') return { state, label: 'Cerrado' };
  if (state === 'none') return { state, label: 'Sin límite' };
  return { state, label: c.enrollmentClosesAt ? `Abierto hasta ${formatStamp(c.enrollmentClosesAt)}` : 'Abierto' };
}

const WINDOW_STYLE: Record<CourseWindowState, string> = {
  none: 'bg-slate-50 text-slate-600 border-slate-200',
  soon: 'bg-violet-50 text-violet-700 border-violet-200',
  open: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  closed: 'bg-slate-100 text-slate-500 border-slate-200',
};

const championshipFeeLabel = (ch: Pick<Championship, 'registrationFee' | 'mode'>) =>
  ch.registrationFee > 0 ? `${ch.registrationFee} Bs ${ch.mode === 'team' ? 'por equipo' : 'por persona'}` : 'Gratis';

const ENTRY_STATUS: Record<ChampionshipEntry['status'], { label: string; cls: string }> = {
  confirmed: { label: 'Confirmado', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  pending_payment: { label: 'Pendiente de pago', cls: 'bg-amber-50 text-amber-700 border-amber-200' },
  cancelled: { label: 'Anulado', cls: 'bg-slate-100 text-slate-500 border-slate-200' },
};

const EXTRA_PAY_STATUS: Record<ChampionshipEntry['payment']['status'], { label: string; cls: string }> = {
  completed: { label: 'Pagado', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  pending_verification: { label: 'Comprobante en revisión', cls: 'bg-sky-50 text-sky-700 border-sky-200' },
  pending_cash: { label: 'Pagar en caja', cls: 'bg-amber-50 text-amber-700 border-amber-200' },
  rejected: { label: 'Comprobante rechazado', cls: 'bg-red-50 text-red-700 border-red-200' },
};

const METHOD_LABEL: Record<string, string> = {
  qr_bank: 'QR bancario',
  transfer: 'Transferencia',
  cash_box: 'Efectivo en caja',
  free: 'Sin costo',
};

const METHOD_STYLE = {
  qr_bank: { icon: QrCode, gradient: 'from-sky-500 to-blue-600' },
  transfer: { icon: Building2, gradient: 'from-indigo-500 to-violet-600' },
  cash_box: { icon: Banknote, gradient: 'from-emerald-500 to-teal-600' },
} as const;

type MethodId = keyof typeof METHOD_STYLE;

function genderBlock(ch: Championship, reg: CamperRegistration): string | null {
  if (ch.genderCategory === 'Mixto' || !reg.gender) return null;
  if (ch.genderCategory === 'Varonil' && reg.gender !== 'M') return 'Categoría varonil';
  if (ch.genderCategory === 'Femenil' && reg.gender !== 'F') return 'Categoría femenil';
  return null;
}

/** Copia texto al portapapeles (con alternativa para navegadores sin la API). */
async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    /* se intenta la alternativa */
  }
  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}

const inviteLink = (code: string) => `${window.location.origin}/equipo/${code}`;

// =========================================================
// Página "Mi campamento"
// =========================================================

export const RegistrationHub: React.FC = () => {
  const {
    routeParams,
    registrations,
    getCampById,
    getTribeById,
    setActiveTab,
    setSelectedCamperForBadge,
    championshipEntries,
    privateReady,
  } = useCamp();
  const { currentUser } = useAuth();

  const reg = registrations.find((r) => r.id === routeParams.id && (!currentUser || r.userId === currentUser.id));
  const camp = reg ? getCampById(reg.campId) : undefined;

  const isPaid = reg?.payment.status === 'completed';

  // Sección inicial: la de la URL (?seccion=) o la más útil según el estado del pago
  const [section, setSection] = useState<SectionId>(() => {
    const q = new URLSearchParams(window.location.search).get('seccion') as SectionId | null;
    if (q && SECTIONS.includes(q)) return q;
    return isPaid ? 'talleres' : 'pago';
  });

  // Al recargar la página la inscripción llega después: se elige la sección útil cuando ya se conoce el pago
  const sectionChosen = React.useRef(!!new URLSearchParams(window.location.search).get('seccion'));
  useEffect(() => {
    if (sectionChosen.current || !reg) return;
    sectionChosen.current = true;
    setSection(isPaid ? 'talleres' : 'pago');
  }, [reg, isPaid]);

  const goSection = (s: SectionId) => {
    setSection(s);
    try {
      window.history.replaceState(window.history.state, '', `${window.location.pathname}?seccion=${s}`);
    } catch {
      /* sin historial */
    }
  };

  // Reloj para las ventanas de inscripción de talleres
  const [now, setNow] = useState(nowLocalStamp);
  useEffect(() => {
    const t = window.setInterval(() => setNow(nowLocalStamp()), 30000);
    return () => window.clearInterval(t);
  }, []);

  // Todavía llegando los datos del usuario (p. ej. justo después de recargar la página)
  if (!privateReady && !reg) {
    return (
      <div className="min-h-[70vh] bg-slate-50" aria-busy="true">
        <div className="h-64 bg-gradient-to-r from-slate-200 via-slate-100 to-slate-200 animate-pulse" />
        <div className="max-w-5xl mx-auto px-4 -mt-8 space-y-4">
          <div className="h-14 rounded-2xl bg-white shadow-sm animate-pulse" />
          <div className="h-48 rounded-3xl bg-white shadow-sm animate-pulse" />
        </div>
      </div>
    );
  }

  if (!reg || !camp) {
    return (
      <div className="min-h-[70vh] bg-slate-50 flex items-center justify-center px-4 py-16">
        <div className="max-w-md w-full bg-white rounded-3xl border border-slate-100 shadow-sm p-8 text-center space-y-4 animate-fade-in-scale">
          <div className="w-16 h-16 rounded-3xl bg-sky-100 text-[#0284C7] flex items-center justify-center mx-auto">
            <Ticket className="w-8 h-8" />
          </div>
          <div>
            <div className="text-[11px] font-black uppercase tracking-widest text-[#0284C7]">Error 404</div>
            <h2 className="text-2xl font-black text-slate-900 font-display mt-1">No encontramos esta inscripción</h2>
            <p className="text-sm text-slate-500 mt-2">
              Puede que el enlace esté incompleto o que la inscripción pertenezca a otra cuenta. Revisa tus entradas en «Mis
              inscripciones».
            </p>
          </div>
          <button
            type="button"
            onClick={() => setActiveTab('my-registrations')}
            className="inline-flex items-center gap-2 px-6 py-3 rounded-2xl bg-[#0284C7] hover:bg-[#0369A1] text-white font-black text-sm shadow cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" /> Volver a mis inscripciones
          </button>
        </div>
      </div>
    );
  }

  const tribe = getTribeById(reg.tribeId);
  const color = tribe?.colorHex || '#0284C7';
  const phase = getCampPhase(camp);
  const days = daysUntil(camp.startDate);
  const myEntries = championshipEntries.filter(
    (e) => e.status !== 'cancelled' && (e.captainRegistrationId === reg.id || e.members.some((m) => m.registrationId === reg.id))
  );

  const tabs: { id: SectionId; label: string; short: string; icon: React.ElementType; count?: number; alert?: boolean }[] = [
    { id: 'pago', label: 'Estado del pago', short: 'Pago', icon: CreditCard, alert: !isPaid },
    { id: 'talleres', label: 'Mis talleres', short: 'Talleres', icon: BookOpen, count: reg.enrolledCourseIds.length },
    { id: 'campeonatos', label: 'Olimpiadas y campeonatos', short: 'Campeonatos', icon: Trophy },
    {
      id: 'equipos',
      label: 'Mis equipos',
      short: 'Equipos',
      icon: Users,
      count: myEntries.length,
      alert: myEntries.some((e) => e.payment.status === 'rejected'),
    },
  ];

  return (
    <div className="min-h-[70vh] bg-slate-50 pb-16">
      {/* ── CABECERA ─────────────────────────────────────── */}
      <div className="relative overflow-hidden bg-slate-900 text-white">
        {camp.imageUrl && <img src={camp.imageUrl} alt="" className="absolute inset-0 w-full h-full object-cover opacity-40" />}
        <div className="absolute inset-0 bg-gradient-to-br from-slate-950/95 via-sky-950/80 to-transparent" />
        <div className="absolute inset-0" style={{ background: `linear-gradient(120deg, transparent 40%, ${color}66)` }} />
        <div className="relative max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 pb-8 sm:pb-10">
          <button
            type="button"
            onClick={() => setActiveTab('my-registrations')}
            className="inline-flex items-center gap-1.5 text-xs font-bold text-sky-100 hover:text-white cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" /> Mis inscripciones
          </button>

          <div className="mt-4 flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6">
            <div className="min-w-0 space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold border ${PHASE_META[phase].className}`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${PHASE_META[phase].dot}`} />
                  {PHASE_META[phase].label}
                </span>
                <PaymentPill reg={reg} />
              </div>
              <h1 className="text-3xl sm:text-4xl font-black font-display leading-tight tracking-tight">{camp.name}</h1>
              {camp.theme && <p className="text-sm text-sky-100 font-semibold">“{camp.theme}”</p>}
              <div className="flex flex-wrap gap-x-5 gap-y-1.5 text-xs sm:text-sm text-sky-50 font-semibold">
                <span className="flex items-center gap-1.5">
                  <CalendarDays className="w-4 h-4 text-sky-300" /> {formatDateRange(camp.startDate, camp.endDate)}
                </span>
                <span className="flex items-center gap-1.5">
                  <MapPin className="w-4 h-4 text-sky-300" /> {camp.location}
                </span>
                <span className="flex items-center gap-1.5">
                  <Ticket className="w-4 h-4 text-sky-300" /> <span className="font-mono">{reg.ticketCode}</span>
                </span>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row lg:flex-col xl:flex-row gap-3 lg:items-end">
              <div className="flex items-center gap-3 rounded-2xl bg-white/10 border border-white/15 backdrop-blur px-4 py-3">
                <span className="w-10 h-10 rounded-xl flex items-center justify-center text-xl shadow-inner" style={{ backgroundColor: color }}>
                  {animalEmoji(tribe?.animalSymbol)}
                </span>
                <div className="min-w-0">
                  <div className="text-[10px] font-black uppercase tracking-widest text-sky-200">Tu tribu</div>
                  <div className="text-sm font-black leading-tight truncate">
                    {tribe ? tribe.name.replace(/^Tribu \d+:\s*/, '') : 'Por asignar'}
                  </div>
                </div>
                {phase !== 'finalizado' && days > 0 && (
                  <div className="ml-2 pl-3 border-l border-white/15 text-center">
                    <div className="text-xl font-black font-mono leading-none">{days}</div>
                    <div className="text-[9px] font-bold text-sky-200 uppercase">días</div>
                  </div>
                )}
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedCamperForBadge(reg)}
                  className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-5 py-3 rounded-2xl bg-white text-slate-900 hover:bg-sky-50 font-black text-sm shadow-lg cursor-pointer"
                >
                  <QrCode className="w-4 h-4" style={{ color }} /> Ver credencial
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('my-registrations')}
                  className="inline-flex items-center justify-center gap-2 px-4 py-3 rounded-2xl bg-white/10 hover:bg-white/20 border border-white/20 font-bold text-sm cursor-pointer"
                >
                  Volver
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 -mt-4 relative space-y-5">
        {!isPaid && (
          <div className="rounded-3xl bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 shadow-sm p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center gap-3 animate-fade-in">
            <div className="w-12 h-12 rounded-2xl bg-amber-500 text-white flex items-center justify-center shrink-0 shadow-md">
              <Lock className="w-6 h-6" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-sm sm:text-base font-black text-amber-900">
                Tus talleres y campeonatos se habilitan cuando se confirme tu pago
              </h3>
              <p className="text-xs text-amber-800 mt-0.5">
                Mientras tanto puedes revisar los talleres y campeonatos disponibles. Te avisaremos apenas tesorería confirme tu pago.
              </p>
            </div>
            {section !== 'pago' && (
              <Button variant="amber" icon={CreditCard} onClick={() => goSection('pago')}>
                Ver mi pago
              </Button>
            )}
          </div>
        )}

        {/* ── PESTAÑAS ───────────────────────────────────── */}
        <div className="sticky top-16 sm:top-20 z-20 -mx-4 sm:mx-0 px-4 sm:px-0">
          <div className="bg-white/95 backdrop-blur rounded-3xl border border-slate-100 shadow-sm p-1.5 flex gap-1 overflow-x-auto no-scrollbar" role="tablist">
            {tabs.map((t) => {
              const active = section === t.id;
              const Icon = t.icon;
              return (
                <button
                  key={t.id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => goSection(t.id)}
                  className={`relative flex-1 min-w-max inline-flex items-center justify-center gap-2 px-3.5 sm:px-4 py-2.5 rounded-2xl text-xs sm:text-sm font-black transition-all cursor-pointer ${
                    active ? 'bg-[#0284C7] text-white shadow-md' : 'text-slate-600 hover:bg-sky-50 hover:text-[#0284C7]'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span className="sm:hidden">{t.short}</span>
                  <span className="hidden sm:inline">{t.label}</span>
                  {typeof t.count === 'number' && t.count > 0 && (
                    <span
                      className={`min-w-5 h-5 px-1.5 rounded-full text-[10px] font-black flex items-center justify-center ${
                        active ? 'bg-white/25 text-white' : 'bg-sky-100 text-sky-700'
                      }`}
                    >
                      {t.count}
                    </span>
                  )}
                  {t.alert && <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-red-500 ring-2 ring-white" />}
                </button>
              );
            })}
          </div>
        </div>

        <div key={section} className="animate-fade-in">
          {section === 'pago' && <PaymentSection reg={reg} camp={camp} onGo={goSection} />}
          {section === 'talleres' && <CoursesSection reg={reg} camp={camp} now={now} locked={!isPaid} />}
          {section === 'campeonatos' && <ChampionshipsSection reg={reg} camp={camp} locked={!isPaid} onGo={goSection} />}
          {section === 'equipos' && <EntriesSection reg={reg} onGo={goSection} />}
        </div>
      </div>
    </div>
  );
};

// =========================================================
// Piezas compartidas
// =========================================================

const PaymentPill: React.FC<{ reg: CamperRegistration }> = ({ reg }) => {
  const s = reg.payment.status;
  if (s === 'completed') {
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-100">
        <CheckCircle2 className="w-3 h-3" /> Pago confirmado
      </span>
    );
  }
  if (s === 'rejected') {
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-red-50 text-red-700 border border-red-100">
        <AlertTriangle className="w-3 h-3" /> Comprobante rechazado
      </span>
    );
  }
  if (s === 'refunded') {
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600 border border-slate-200">
        <RefreshCw className="w-3 h-3" /> Reembolsado
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-100">
      <Clock className="w-3 h-3" /> {s === 'pending_verification' ? 'Pago en revisión' : 'Pago pendiente en caja'}
    </span>
  );
};

const SectionCard: React.FC<{
  title: string;
  description?: React.ReactNode;
  icon: React.ElementType;
  actions?: React.ReactNode;
  children: React.ReactNode;
}> = ({ title, description, icon: Icon, actions, children }) => (
  <section className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
    <div className="px-5 sm:px-6 py-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
      <div className="flex items-start gap-3 min-w-0">
        <div className="w-10 h-10 rounded-2xl bg-sky-50 text-[#0284C7] flex items-center justify-center shrink-0">
          <Icon className="w-5 h-5" />
        </div>
        <div className="min-w-0">
          <h2 className="text-base sm:text-lg font-black text-slate-900 font-display leading-tight">{title}</h2>
          {description && <div className="text-xs text-slate-500 mt-0.5">{description}</div>}
        </div>
      </div>
      {actions && <div className="shrink-0">{actions}</div>}
    </div>
    <div className="p-4 sm:p-6">{children}</div>
  </section>
);

/** Modal para reenviar un comprobante rechazado (del campamento o de un pago extra). */
/** Reenvío del comprobante tras un rechazo (pago del campamento o pago extra). */
export const ResubmitModal: React.FC<{
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  amount: number;
  reason?: string;
  onSubmit: (voucher: { imageUrl: string; reference: string }) => Promise<boolean>;
}> = ({ open, onClose, title, subtitle, amount, reason, onSubmit }) => {
  const { paymentSettings } = useCamp();
  const { notify } = useConfirm();
  const requireReference = paymentSettings?.transfer.requireReference ?? false;
  const [voucherUrl, setVoucherUrl] = useState('');
  const [voucherRef, setVoucherRef] = useState('');
  const [error, setError] = useState('');
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (open) {
      setVoucherUrl('');
      setVoucherRef('');
      setError('');
    }
  }, [open]);

  const close = () => {
    if (!sending) onClose();
  };

  const submit = async () => {
    if (sending) return;
    if (!voucherUrl) return setError('Sube la foto de tu nuevo comprobante.');
    if (requireReference && !voucherRef.trim()) return setError('Ingresa el número de referencia.');
    setError('');
    setSending(true);
    let ok = false;
    try {
      ok = await onSubmit({ imageUrl: voucherUrl, reference: voucherRef.trim() || Date.now().toString().slice(-6) });
    } finally {
      setSending(false);
    }
    // si falla, el aviso ya se mostró y el modal queda abierto para corregir
    if (!ok) return;
    onClose();
    const hours = paymentSettings?.transfer.verificationHours;
    await notify({
      title: 'Comprobante enviado',
      message: hours
        ? `Tesorería revisará tu nuevo comprobante en un máximo de ${hours} horas.`
        : 'Tesorería revisará tu nuevo comprobante en breve.',
      tone: 'success',
    });
  };

  return (
    <Modal
      open={open}
      onClose={close}
      title={title}
      subtitle={subtitle}
      icon={Upload}
      size="md"
      footer={
        <>
          <Button variant="secondary" onClick={close} disabled={sending}>
            Cancelar
          </Button>
          <Button icon={sending ? Loader2 : Upload} onClick={submit} disabled={sending} className={sending ? '[&>svg]:animate-spin' : ''}>
            {sending ? 'Enviando…' : 'Enviar comprobante'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="rounded-2xl bg-red-50 border border-red-100 p-3 text-xs text-red-800">
          <strong>Motivo del rechazo:</strong> {reason || 'No especificado'}
        </div>
        <div className="rounded-2xl bg-slate-50 border border-slate-100 p-3 text-xs text-slate-600 flex justify-between">
          <span>Monto a pagar</span>
          <strong className="font-mono text-slate-900">{amount} Bs</strong>
        </div>
        <Field label="Foto del comprobante" required>
          <ImageInput value={voucherUrl} onChange={setVoucherUrl} />
        </Field>
        <Field label="Número de referencia" required={requireReference}>
          <TextInput value={voucherRef} onChange={(e) => setVoucherRef(e.target.value)} placeholder="ej. 20261016-123456" />
        </Field>
        {error && <p className="text-xs font-bold text-red-600">{error}</p>}
      </div>
    </Modal>
  );
};

// =========================================================
// a) Estado del pago
// =========================================================

const PaymentSection: React.FC<{ reg: CamperRegistration; camp: Camp; onGo: (s: SectionId) => void }> = ({ reg, camp, onGo }) => {
  const { resubmitVoucher, paymentSettings } = useCamp();
  const [resubmitOpen, setResubmitOpen] = useState(false);
  const p = reg.payment;

  const tone =
    p.status === 'completed'
      ? { box: 'from-emerald-500 to-teal-600', icon: ShieldCheck, title: '¡Pago confirmado!', text: 'Tu entrada está activa. Ya puedes inscribirte a talleres y campeonatos.' }
      : p.status === 'rejected'
      ? { box: 'from-red-500 to-rose-600', icon: AlertTriangle, title: 'Tesorería rechazó tu comprobante', text: 'Sube un nuevo comprobante para que revisemos tu pago otra vez.' }
      : p.status === 'pending_verification'
      ? {
          box: 'from-sky-500 to-blue-600',
          icon: Hourglass,
          title: 'Estamos revisando tu comprobante',
          text: paymentSettings?.transfer.verificationHours
            ? `Tesorería lo verifica en un máximo de ${paymentSettings.transfer.verificationHours} horas.`
            : 'Tesorería lo verificará en breve.',
        }
      : p.status === 'refunded'
      ? { box: 'from-slate-500 to-slate-700', icon: RefreshCw, title: 'Pago reembolsado', text: 'Esta inscripción fue reembolsada.' }
      : {
          box: 'from-amber-500 to-orange-500',
          icon: Banknote,
          title: 'Paga en caja para activar tu entrada',
          text: paymentSettings?.cash.places ? `Dónde pagar: ${paymentSettings.cash.places}.` : 'Acércate a caja con tu código de entrada.',
        };
  const ToneIcon = tone.icon;

  const rows: { label: string; value: React.ReactNode; mono?: boolean }[] = [
    { label: 'Método', value: METHOD_LABEL[p.paymentMethod] || p.paymentMethod },
    { label: 'Folio', value: p.transactionFolio, mono: true },
    { label: 'Fecha', value: p.date },
    ...(p.couponCodeApplied ? [{ label: 'Cupón', value: p.couponCodeApplied, mono: true }] : []),
    ...(p.voucherReferenceNumber ? [{ label: 'Referencia', value: p.voucherReferenceNumber, mono: true }] : []),
    ...(p.verifiedAt ? [{ label: 'Verificado', value: `${p.verifiedAt}${p.verifiedBy ? ` · ${p.verifiedBy}` : ''}` }] : []),
    ...(p.cashierCollectedAt ? [{ label: 'Cobrado en caja', value: `${p.cashierCollectedAt}${p.cashierCollectedBy ? ` · ${p.cashierCollectedBy}` : ''}` }] : []),
  ];

  return (
    <div className="grid lg:grid-cols-5 gap-5">
      <div className="lg:col-span-3 space-y-5">
        <div className={`rounded-3xl bg-gradient-to-br ${tone.box} text-white p-5 sm:p-6 shadow-lg relative overflow-hidden`}>
          <div className="absolute -right-10 -top-10 w-40 h-40 rounded-full bg-white/10" />
          <div className="relative flex items-start gap-4">
            <div className="w-12 h-12 rounded-2xl bg-white/20 flex items-center justify-center shrink-0">
              <ToneIcon className="w-6 h-6" />
            </div>
            <div className="min-w-0">
              <h2 className="text-lg sm:text-xl font-black font-display leading-tight">{tone.title}</h2>
              <p className="text-sm text-white/90 mt-1">{tone.text}</p>
            </div>
          </div>
          <div className="relative mt-5 flex flex-wrap items-end justify-between gap-3">
            <div>
              <div className="text-[10px] font-black uppercase tracking-widest text-white/75">Total del campamento</div>
              <div className="text-3xl font-black font-mono">{p.totalAmount} Bs</div>
            </div>
            {p.status === 'completed' ? (
              <button
                type="button"
                onClick={() => onGo('talleres')}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-white text-emerald-700 font-black text-xs shadow cursor-pointer hover:bg-emerald-50"
              >
                <BookOpen className="w-4 h-4" /> Elegir mis talleres
              </button>
            ) : p.status === 'rejected' ? (
              <button
                type="button"
                onClick={() => setResubmitOpen(true)}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-white text-red-700 font-black text-xs shadow cursor-pointer hover:bg-red-50"
              >
                <Upload className="w-4 h-4" /> Subir nuevo comprobante
              </button>
            ) : null}
          </div>
        </div>

        {p.status === 'rejected' && (
          <div className="rounded-3xl bg-red-50 border border-red-100 p-4 text-sm text-red-800 flex gap-3">
            <AlertTriangle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
            <div>
              <strong className="block">Motivo del rechazo</strong>
              {p.rejectionReason || 'No especificado'}
              {p.rejectedAt && <span className="block text-[11px] text-red-600 mt-1">Rechazado el {p.rejectedAt}</span>}
            </div>
          </div>
        )}

        {p.status === 'pending_cash' && (
          <div className="grid sm:grid-cols-2 gap-3">
            {p.advanceAmount ? (
              <div className="rounded-3xl bg-amber-50 border border-amber-100 p-4">
                <div className="text-[10px] font-black uppercase tracking-wider text-amber-700">Adelanto</div>
                <div className="text-2xl font-black font-mono text-amber-800">{p.advanceAmount} Bs</div>
              </div>
            ) : null}
            <div className="rounded-3xl bg-white border border-slate-100 p-4">
              <div className="text-[10px] font-black uppercase tracking-wider text-slate-500">Saldo a pagar en caja</div>
              <div className="text-2xl font-black font-mono text-slate-800">{p.remainingBalance ?? p.totalAmount} Bs</div>
            </div>
            {paymentSettings?.cash.instructions && (
              <p className="sm:col-span-2 text-xs text-slate-600 bg-white rounded-2xl border border-slate-100 p-3">{paymentSettings.cash.instructions}</p>
            )}
          </div>
        )}
      </div>

      <div className="lg:col-span-2 bg-white rounded-3xl border border-slate-100 shadow-sm p-5 sm:p-6 space-y-4">
        <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
          <Wallet className="w-4 h-4 text-[#0284C7]" /> Detalle del pago
        </h3>
        <dl className="space-y-2.5">
          {rows.map((r) => (
            <div key={r.label} className="flex items-start justify-between gap-3 text-xs">
              <dt className="text-slate-500 font-semibold">{r.label}</dt>
              <dd className={`text-right font-bold text-slate-800 break-all ${r.mono ? 'font-mono' : ''}`}>{r.value}</dd>
            </div>
          ))}
        </dl>
        <div className="border-t border-dashed border-slate-200 pt-3 space-y-1.5 text-xs">
          <div className="flex justify-between text-slate-500">
            <span>Campamento</span>
            <span className="font-mono">{p.baseCampFee} Bs</span>
          </div>
          {p.discountAmount > 0 && (
            <div className="flex justify-between text-emerald-600">
              <span>Descuento</span>
              <span className="font-mono">−{p.discountAmount} Bs</span>
            </div>
          )}
          <div className="flex justify-between font-black text-slate-900 text-sm pt-1">
            <span>Total</span>
            <span className="font-mono">{p.totalAmount} Bs</span>
          </div>
        </div>
        {paymentSettings?.whatsappContact && (
          <a
            href={`https://wa.me/${paymentSettings.whatsappContact.replace(/\D/g, '')}?text=${encodeURIComponent(
              `Hola, tengo una consulta sobre mi pago de ${camp.name} (código ${reg.ticketCode}).`
            )}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 w-full px-4 py-2.5 rounded-2xl bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-100 font-bold text-xs"
          >
            <MessageCircle className="w-4 h-4" /> Consultar por WhatsApp
          </a>
        )}
      </div>

      <ResubmitModal
        open={resubmitOpen}
        onClose={() => setResubmitOpen(false)}
        title="Subir nuevo comprobante"
        subtitle={`${camp.name} · ${reg.ticketCode}`}
        amount={p.totalAmount}
        reason={p.rejectionReason}
        onSubmit={async (v) => !!(await resubmitVoucher(reg.id, v))}
      />
    </div>
  );
};

// =========================================================
// b) Mis talleres
// =========================================================

const CoursesSection: React.FC<{ reg: CamperRegistration; camp: Camp; now: string; locked: boolean }> = ({ reg, camp, now, locked }) => {
  const { getCoursesForCamp, enrollCourse, dropCourse } = useCamp();
  const { confirm } = useConfirm();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'mine'>('all');

  const courses = getCoursesForCamp(camp.id);
  const enrolledIds = reg.enrolledCourseIds;
  const enrolledCourses = courses.filter((c) => enrolledIds.includes(c.id));
  const max = camp.maxCoursesPerCamper;
  const limitReached = enrolledIds.length >= max;

  const groups = useMemo(() => {
    const visible = (filter === 'mine' ? courses.filter((c) => enrolledIds.includes(c.id)) : courses)
      .slice()
      .sort((a, b) => (a.fullDay === b.fullDay ? a.startTime.localeCompare(b.startTime) : a.fullDay ? -1 : 1));
    const map = new Map<string, CampCourse[]>();
    visible.forEach((c) => {
      const key = c.scheduleType === 'single_day' && c.date ? c.date : 'all';
      map.set(key, [...(map.get(key) || []), c]);
    });
    return Array.from(map.entries())
      .sort(([a], [b]) => (a === 'all' ? -1 : b === 'all' ? 1 : a.localeCompare(b)))
      .map(([key, list]) => ({ key, label: key === 'all' ? 'Todos los días del campamento' : formatLongDate(key), list }));
  }, [courses, enrolledIds, filter]);

  const handleEnroll = async (c: CampCourse) => {
    setBusyId(c.id);
    try {
      await enrollCourse(reg.id, c.id);
    } finally {
      setBusyId(null);
    }
  };

  const handleDrop = async (c: CampCourse) => {
    const ok = await confirm({
      title: `¿Salir de «${c.title}»?`,
      message: 'Liberarás tu cupo para otro joven. Podrás volver a inscribirte mientras la inscripción siga abierta y haya cupos.',
      confirmText: 'Sí, salir del taller',
      tone: 'warning',
    });
    if (!ok) return;
    setBusyId(c.id);
    try {
      await dropCourse(reg.id, c.id);
    } finally {
      setBusyId(null);
    }
  };

  const pct = max > 0 ? Math.min(100, Math.round((enrolledIds.length / max) * 100)) : 0;

  return (
    <SectionCard
      title="Mis talleres"
      icon={BookOpen}
      description={
        locked
          ? 'Podrás inscribirte cuando tu pago esté confirmado.'
          : 'Elige tus talleres dentro de la ventana de inscripción de cada uno. Los horarios no pueden cruzarse.'
      }
      actions={
        <div className="min-w-[180px]">
          <div className="flex items-baseline justify-between gap-3">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Inscrito en</span>
            <span className="text-sm font-black text-slate-900">
              <span className="font-mono text-[#0284C7]">{enrolledIds.length}</span> de {max} talleres
            </span>
          </div>
          <div className="mt-1.5 h-2 rounded-full bg-slate-100 overflow-hidden">
            <div className={`h-full rounded-full transition-all ${limitReached ? 'bg-emerald-500' : 'bg-[#0284C7]'}`} style={{ width: `${pct}%` }} />
          </div>
        </div>
      }
    >
      {courses.length === 0 ? (
        <div className="text-center py-12">
          <BookOpen className="w-10 h-10 text-slate-300 mx-auto" />
          <h4 className="mt-3 text-sm font-black text-slate-800">Aún no hay talleres publicados</h4>
          <p className="text-xs text-slate-500 mt-1">La organización publicará los talleres de este campamento pronto.</p>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="flex flex-wrap items-center gap-2">
            {(
              [
                { id: 'all', label: `Todos (${courses.length})` },
                { id: 'mine', label: `Mis talleres (${enrolledIds.length})` },
              ] as const
            ).map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => setFilter(f.id)}
                className={`px-3.5 py-1.5 rounded-full text-xs font-bold border cursor-pointer transition-colors ${
                  filter === f.id ? 'bg-sky-50 border-sky-300 text-sky-700' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                {f.label}
              </button>
            ))}
            {limitReached && !locked && (
              <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-100 px-2.5 py-1 rounded-full">
                Llegaste al máximo de talleres
              </span>
            )}
          </div>

          {groups.length === 0 && (
            <p className="text-center text-sm text-slate-500 py-8">Todavía no te inscribiste a ningún taller.</p>
          )}

          {groups.map((g) => (
            <div key={g.key} className="space-y-3">
              <h3 className="text-xs font-black text-slate-500 uppercase tracking-wider flex items-center gap-2">
                <CalendarDays className="w-4 h-4 text-[#0284C7]" /> {g.label}
              </h3>
              <div className="grid md:grid-cols-2 gap-3">
                {g.list.map((c) => {
                  const enrolled = enrolledIds.includes(c.id);
                  const win = courseWindow(c, now);
                  const spots = Math.max(0, c.maxCapacity - c.enrolledCount);
                  const ageOk = !reg.age || (reg.age >= c.minAge && reg.age <= c.maxAge);
                  const overlap = enrolled ? undefined : enrolledCourses.find((e) => coursesOverlap(c, e));
                  const windowOpen = win.state === 'open' || win.state === 'none';
                  const busy = busyId === c.id;

                  let reason = '';
                  if (!enrolled) {
                    if (locked) reason = 'Se habilita al confirmar tu pago';
                    else if (win.state === 'soon') reason = 'La inscripción aún no abre';
                    else if (win.state === 'closed') reason = 'La inscripción ya cerró';
                    else if (!ageOk) reason = `Es para ${c.minAge}–${c.maxAge} años`;
                    else if (spots <= 0) reason = 'Sin cupos';
                    else if (overlap) reason = `Se cruza con «${overlap.title}»`;
                    else if (limitReached) reason = `Máximo ${max} talleres`;
                  } else if (win.state === 'closed') {
                    reason = 'Inscripción cerrada: pide cambios a la coordinación';
                  }
                  const canEnroll = !enrolled && !reason;
                  const canDrop = enrolled && windowOpen && !locked;

                  return (
                    <article
                      key={c.id}
                      className={`rounded-3xl border p-4 flex flex-col gap-3 transition-all ${
                        enrolled ? 'border-emerald-200 bg-emerald-50/40 ring-1 ring-emerald-100' : 'border-slate-100 bg-white hover:shadow-md'
                      }`}
                    >
                      <div className="flex gap-3">
                        <div className="w-16 h-16 rounded-2xl overflow-hidden bg-sky-50 shrink-0 flex items-center justify-center">
                          {c.coverImageUrl ? (
                            <img src={c.coverImageUrl} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <BookOpen className="w-6 h-6 text-sky-400" />
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="text-[10px] font-bold text-[#0284C7] uppercase tracking-wider">{c.category}</span>
                            {enrolled && (
                              <span className="inline-flex items-center gap-1 text-[10px] font-black text-emerald-700">
                                <CheckCircle2 className="w-3 h-3" /> Inscrito
                              </span>
                            )}
                          </div>
                          <h4 className="text-sm font-black text-slate-900 leading-tight">{c.title}</h4>
                          <p className="text-[11px] text-slate-500 mt-0.5 truncate">
                            {c.instructor}
                            {c.instructorRole ? ` · ${c.instructorRole}` : ''}
                          </p>
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-slate-600 font-semibold">
                        <span className="flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5 text-slate-400" /> {c.fullDay ? 'Todo el día' : `${c.startTime} – ${c.endTime}`}
                        </span>
                        <span className="flex items-center gap-1">
                          <MapPin className="w-3.5 h-3.5 text-slate-400" /> {c.location}
                        </span>
                        <span className="flex items-center gap-1">
                          <Users className="w-3.5 h-3.5 text-slate-400" /> {c.minAge}–{c.maxAge} años
                        </span>
                      </div>

                      <div className="flex flex-wrap gap-1.5">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${WINDOW_STYLE[win.state]}`}>
                          <Timer className="w-3 h-3" /> {win.label}
                        </span>
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                            spots <= 0
                              ? 'bg-red-50 text-red-700 border-red-200'
                              : spots <= 5
                              ? 'bg-amber-50 text-amber-700 border-amber-200'
                              : 'bg-sky-50 text-sky-700 border-sky-200'
                          }`}
                        >
                          {spots <= 0 ? 'Sin cupos' : `${spots} ${spots === 1 ? 'cupo libre' : 'cupos libres'}`}
                        </span>
                        {!ageOk && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border bg-slate-100 text-slate-600 border-slate-200">
                            Solo {c.minAge}–{c.maxAge} años
                          </span>
                        )}
                      </div>

                      {overlap && !locked && (
                        <p className="text-[11px] text-amber-800 bg-amber-50 border border-amber-100 rounded-xl px-3 py-2 flex items-start gap-1.5">
                          <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" /> Se cruza en horario con «{overlap.title}», en el que ya estás
                          inscrito.
                        </p>
                      )}

                      <div className="mt-auto flex items-center justify-between gap-3 pt-1">
                        <span className="text-[11px] text-slate-500 font-semibold min-w-0">{reason}</span>
                        {enrolled ? (
                          <Button
                            variant="danger"
                            size="sm"
                            icon={busy ? Loader2 : LogOut}
                            className={`shrink-0 ${busy ? '[&>svg]:animate-spin' : ''}`}
                            disabled={!canDrop || busy}
                            onClick={() => handleDrop(c)}
                          >
                            Salir
                          </Button>
                        ) : (
                          <Button
                            size="sm"
                            icon={busy ? Loader2 : locked ? Lock : Plus}
                            className={`shrink-0 ${busy ? '[&>svg]:animate-spin' : ''}`}
                            disabled={!canEnroll || busy}
                            onClick={() => handleEnroll(c)}
                          >
                            Inscribirme
                          </Button>
                        )}
                      </div>
                    </article>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </SectionCard>
  );
};

// =========================================================
// c) Olimpiadas y campeonatos
// =========================================================

const ChampionshipsSection: React.FC<{ reg: CamperRegistration; camp: Camp; locked: boolean; onGo: (s: SectionId) => void }> = ({
  reg,
  camp,
  locked,
  onGo,
}) => {
  const { getChampionshipsForCamp, championshipEntries } = useCamp();
  const [selected, setSelected] = useState<Championship | null>(null);
  const today = todayISO();
  const champs = getChampionshipsForCamp(camp.id);

  return (
    <SectionCard
      title="Olimpiadas y campeonatos"
      icon={Trophy}
      description="Inscríbete solo o arma tu equipo e invita a tus amigos con un enlace."
    >
      {champs.length === 0 ? (
        <div className="text-center py-12">
          <Trophy className="w-10 h-10 text-slate-300 mx-auto" />
          <h4 className="mt-3 text-sm font-black text-slate-800">Aún no hay campeonatos en este campamento</h4>
          <p className="text-xs text-slate-500 mt-1">Vuelve pronto: la organización los publicará aquí.</p>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {champs.map((ch) => {
            const entry = championshipEntries.find(
              (e) => e.championshipId === ch.id && e.status !== 'cancelled' && e.members.some((m) => m.registrationId === reg.id)
            );
            const full = ch.enrolledTeamsCount >= ch.maxTeamsOrParticipants;
            const closed = !!ch.registrationClosesAt && today > ch.registrationClosesAt;
            const gender = genderBlock(ch, reg);
            const isTeam = ch.mode === 'team';
            let reason = '';
            if (!entry) {
              if (locked) reason = 'Se habilita al confirmar tu pago';
              else if (closed) reason = 'Inscripciones cerradas';
              else if (gender) reason = gender;
              else if (full) reason = isTeam ? 'Sin cupo para más equipos' : 'Sin cupos';
            }
            const pctFull = ch.maxTeamsOrParticipants > 0 ? Math.min(100, (ch.enrolledTeamsCount / ch.maxTeamsOrParticipants) * 100) : 0;

            return (
              <article key={ch.id} className="rounded-3xl border border-slate-100 bg-white overflow-hidden flex flex-col hover:shadow-lg transition-shadow">
                <div className="relative h-32 bg-gradient-to-br from-sky-600 to-indigo-700">
                  {ch.imageUrl && <img src={ch.imageUrl} alt="" className="absolute inset-0 w-full h-full object-cover" />}
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-slate-900/20 to-transparent" />
                  <div className="absolute top-3 left-3 flex flex-wrap gap-1.5">
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black bg-white/90 text-slate-800">
                      {isTeam ? <Users className="w-3 h-3" /> : <Sparkles className="w-3 h-3" />} {isTeam ? 'Por equipos' : 'Individual'}
                    </span>
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-black bg-white/90 text-slate-800">
                      {ch.genderCategory}
                    </span>
                  </div>
                  {entry && (
                    <span className="absolute top-3 right-3 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-500 text-white shadow">
                      <CheckCircle2 className="w-3 h-3" /> Inscrito
                    </span>
                  )}
                  <div className="absolute bottom-3 left-3 right-3 text-white">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-sky-200">{ch.sport}</div>
                    <h4 className="text-base font-black leading-tight font-display">{ch.name}</h4>
                  </div>
                </div>

                <div className="p-4 flex-1 flex flex-col gap-3">
                  <div className="space-y-1.5 text-[11px] text-slate-600 font-semibold">
                    {ch.schedule && (
                      <p className="flex items-start gap-1.5">
                        <CalendarDays className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-px" /> {ch.schedule}
                      </p>
                    )}
                    {isTeam && (
                      <p className="flex items-center gap-1.5">
                        <Users className="w-3.5 h-3.5 text-slate-400" /> Equipos de {ch.minTeamSize || 1} a {ch.maxTeamSize || '—'} integrantes
                      </p>
                    )}
                    {ch.registrationClosesAt && (
                      <p className={`flex items-center gap-1.5 ${closed ? 'text-red-600' : ''}`}>
                        <Timer className="w-3.5 h-3.5 text-slate-400" /> {closed ? 'Cerró' : 'Cierra'} el {formatShortDate(ch.registrationClosesAt)}
                      </p>
                    )}
                    {ch.prizeSummary && (
                      <p className="flex items-start gap-1.5">
                        <Trophy className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-px" /> {ch.prizeSummary}
                      </p>
                    )}
                  </div>

                  <div>
                    <div className="flex justify-between text-[10px] font-bold text-slate-500">
                      <span>{isTeam ? 'Equipos inscritos' : 'Participantes'}</span>
                      <span className="font-mono">
                        {ch.enrolledTeamsCount}/{ch.maxTeamsOrParticipants}
                      </span>
                    </div>
                    <div className="mt-1 h-1.5 rounded-full bg-slate-100 overflow-hidden">
                      <div className={`h-full rounded-full ${full ? 'bg-red-400' : 'bg-[#0284C7]'}`} style={{ width: `${pctFull}%` }} />
                    </div>
                  </div>

                  <div className="mt-auto flex items-center justify-between gap-2 pt-2 border-t border-dashed border-slate-200">
                    <div>
                      <div className="text-[9px] font-black uppercase tracking-wider text-slate-400">Costo extra</div>
                      <div className={`text-sm font-black ${ch.registrationFee > 0 ? 'text-slate-900' : 'text-emerald-600'}`}>
                        {championshipFeeLabel(ch)}
                      </div>
                    </div>
                    {entry ? (
                      <div className="flex flex-col items-end gap-1">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border ${ENTRY_STATUS[entry.status].cls}`}>
                          {ENTRY_STATUS[entry.status].label}
                        </span>
                        <button
                          type="button"
                          onClick={() => onGo('equipos')}
                          className="text-[11px] font-bold text-[#0284C7] hover:underline cursor-pointer"
                        >
                          {entry.type === 'team' ? `Ver equipo «${entry.teamName}»` : 'Ver mi inscripción'}
                        </button>
                      </div>
                    ) : (
                      <Button size="sm" icon={locked ? Lock : isTeam ? Users : Plus} disabled={!!reason} onClick={() => setSelected(ch)}>
                        {isTeam ? 'Crear equipo' : 'Inscribirme'}
                      </Button>
                    )}
                  </div>
                  {reason && !entry && <p className="text-[11px] text-slate-500 font-semibold text-right -mt-1">{reason}</p>}
                  {isTeam && !entry && !locked && (
                    <p className="text-[10px] text-slate-400">¿Te invitaron a un equipo? Abre el enlace que te compartió tu capitán.</p>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}

      <ExtraPaymentModal
        championship={selected}
        registration={reg}
        onClose={() => setSelected(null)}
        onDone={() => {
          setSelected(null);
          onGo('equipos');
        }}
      />
    </SectionCard>
  );
};

// =========================================================
// Modal de inscripción a campeonato + pago extra
// =========================================================

const ExtraPaymentModal: React.FC<{
  championship: Championship | null;
  registration: CamperRegistration;
  onClose: () => void;
  onDone: (entry: ChampionshipEntry) => void;
}> = ({ championship: ch, registration: reg, onClose, onDone }) => {
  const { paymentSettings, createChampionshipEntry } = useCamp();
  const { notify } = useConfirm();
  const open = !!ch;
  const isTeam = ch?.mode === 'team';
  const fee = ch?.registrationFee || 0;
  const isFree = fee <= 0;

  const methodOptions = useMemo(
    () =>
      paymentSettings
        ? (
            [
              { id: 'qr_bank' as const, cfg: paymentSettings.qr },
              { id: 'transfer' as const, cfg: paymentSettings.transfer },
              { id: 'cash_box' as const, cfg: paymentSettings.cash },
            ] as { id: MethodId; cfg: PaymentSettings['qr'] | PaymentSettings['transfer'] | PaymentSettings['cash'] }[]
          ).filter((m) => m.cfg.enabled)
        : [],
    [paymentSettings]
  );

  const [teamName, setTeamName] = useState('');
  const [method, setMethod] = useState<MethodId>('qr_bank');
  const [voucherUrl, setVoucherUrl] = useState('');
  const [reference, setReference] = useState('');
  const [gatewayConfirmed, setGatewayConfirmed] = useState(false);
  const [simulating, setSimulating] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    setTeamName('');
    setMethod(methodOptions[0]?.id || 'cash_box');
    setVoucherUrl('');
    setReference('');
    setGatewayConfirmed(false);
    setSimulating(false);
    setError('');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, ch?.id]);

  const qrAuto = !!paymentSettings?.qr.autoConfirm;
  const needsVoucher = method === 'transfer' || (method === 'qr_bank' && !qrAuto);
  const referenceRequired = method === 'transfer' && !!paymentSettings?.transfer.requireReference;
  const activeAccounts = paymentSettings?.transfer.accounts.filter((a) => a.isActive) ?? [];

  useEffect(() => {
    if (!open || isFree || method !== 'qr_bank' || paymentSettings?.qr.qrImageUrl || !ch) return;
    const payload = JSON.stringify({ app: 'CJN', type: 'extra', championship: ch.id, registration: reg.id, amount: fee, currency: 'BOB' });
    generateQrDataUrl(payload, '#0284C7').then(setQrDataUrl);
  }, [open, isFree, method, paymentSettings?.qr.qrImageUrl, ch, reg.id, fee]);

  const simulate = () => {
    setSimulating(true);
    window.setTimeout(() => {
      setSimulating(false);
      setGatewayConfirmed(true);
    }, 1200);
  };

  const close = () => {
    if (!submitting) onClose();
  };

  const submit = async () => {
    if (!ch || submitting) return;
    if (isTeam && teamName.trim().length < 3) return setError('Ponle un nombre a tu equipo (mínimo 3 letras).');
    let payment: ExtraPaymentPayload | undefined;
    if (!isFree) {
      if (methodOptions.length === 0) return setError('No hay métodos de pago habilitados. Comunícate con la organización.');
      if (method === 'qr_bank' && qrAuto && !gatewayConfirmed) return setError('Paga con el QR y espera la confirmación del banco.');
      if (needsVoucher && !voucherUrl) return setError('Sube la foto de tu comprobante.');
      if (referenceRequired && !reference.trim()) return setError('Ingresa el número de referencia.');
      payment = { method };
      if (needsVoucher) {
        payment.voucherImageUrl = voucherUrl;
        if (reference.trim()) payment.voucherReferenceNumber = reference.trim();
      }
      if (method === 'qr_bank' && qrAuto) payment.gatewayConfirmed = gatewayConfirmed;
    }
    setError('');
    setSubmitting(true);
    let entry: ChampionshipEntry | null = null;
    try {
      entry = await createChampionshipEntry({
        registrationId: reg.id,
        championshipId: ch.id,
        teamName: isTeam ? teamName.trim() : undefined,
        payment,
      });
    } finally {
      setSubmitting(false);
    }
    if (!entry) return;
    onDone(entry);
    const confirmed = entry.status === 'confirmed';
    await notify({
      title: confirmed ? (isTeam ? '¡Tu equipo está confirmado!' : '¡Estás inscrito!') : 'Inscripción registrada',
      message: confirmed
        ? isTeam
          ? 'Ya puedes compartir el enlace de invitación con tus compañeros desde «Mis equipos».'
          : `Ya participas en ${ch.name}.`
        : entry.payment.status === 'pending_cash'
        ? `Paga ${entry.payment.amount} Bs en caja para confirmar tu inscripción${isTeam ? ' y activar el enlace de invitación' : ''}.`
        : `Tesorería revisará tu comprobante. ${isTeam ? 'El enlace de invitación se activa cuando se confirme el pago.' : ''}`,
      tone: confirmed ? 'success' : 'info',
    });
  };

  const canSubmit =
    !submitting &&
    (!isTeam || teamName.trim().length >= 3) &&
    (isFree ||
      (methodOptions.length > 0 &&
        (method === 'qr_bank' && qrAuto ? gatewayConfirmed : true) &&
        (!needsVoucher || !!voucherUrl) &&
        (!referenceRequired || !!reference.trim())));

  const submitLabel = submitting
    ? 'Enviando…'
    : isFree
    ? isTeam
      ? 'Crear equipo'
      : 'Confirmar inscripción'
    : method === 'cash_box'
    ? 'Reservar y pagar en caja'
    : method === 'qr_bank' && qrAuto
    ? 'Confirmar inscripción'
    : 'Enviar comprobante';

  return (
    <Modal
      open={open}
      onClose={close}
      title={isTeam ? 'Crear equipo' : 'Inscribirme al campeonato'}
      subtitle={ch ? `${ch.name} · ${ch.genderCategory}` : ''}
      icon={isTeam ? Users : Trophy}
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={close} disabled={submitting}>
            Cancelar
          </Button>
          <Button
            icon={submitting ? Loader2 : Check}
            onClick={submit}
            disabled={!canSubmit}
            className={submitting ? '[&>svg]:animate-spin' : ''}
          >
            {submitLabel}
          </Button>
        </>
      }
    >
      {ch && (
        <div className="space-y-5">
          {/* Resumen */}
          <div className="flex gap-3 rounded-2xl bg-slate-50 border border-slate-100 p-3">
            <div className="w-16 h-16 rounded-xl overflow-hidden bg-gradient-to-br from-sky-500 to-indigo-600 shrink-0 flex items-center justify-center">
              {ch.imageUrl ? <img src={ch.imageUrl} alt="" className="w-full h-full object-cover" /> : <Trophy className="w-6 h-6 text-white" />}
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-[10px] font-bold text-[#0284C7] uppercase tracking-wider">
                {ch.sport} · {isTeam ? 'Por equipos' : 'Individual'}
              </div>
              <h4 className="text-sm font-black text-slate-900 leading-tight">{ch.name}</h4>
              {ch.schedule && <p className="text-[11px] text-slate-500 mt-0.5">{ch.schedule}</p>}
            </div>
            <div className="text-right shrink-0">
              <div className="text-[9px] font-black uppercase tracking-wider text-slate-400">A pagar</div>
              <div className={`text-xl font-black font-mono ${isFree ? 'text-emerald-600' : 'text-slate-900'}`}>{isFree ? 'Gratis' : `${fee} Bs`}</div>
              {!isFree && <div className="text-[10px] text-slate-400">{isTeam ? 'por equipo' : 'por persona'}</div>}
            </div>
          </div>

          {isTeam && (
            <div className="space-y-2">
              <Field label="Nombre del equipo" required hint="Entre 3 y 40 caracteres. Debe ser único en el campeonato.">
                <TextInput
                  value={teamName}
                  maxLength={40}
                  onChange={(e) => setTeamName(e.target.value)}
                  placeholder="ej. Leones de Judá"
                  autoFocus
                />
              </Field>
              <ul className="text-[11px] text-slate-600 space-y-1 bg-sky-50 border border-sky-100 rounded-2xl p-3">
                <li className="flex gap-1.5">
                  <Crown className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-px" /> Serás el capitán del equipo.
                </li>
                <li className="flex gap-1.5">
                  <Link2 className="w-3.5 h-3.5 text-[#0284C7] shrink-0 mt-px" /> Cuando se confirme el pago recibirás un enlace para invitar a tus
                  compañeros (hasta {ch.maxTeamSize || '—'} integrantes, mínimo {ch.minTeamSize || 1}).
                </li>
                <li className="flex gap-1.5">
                  <Users className="w-3.5 h-3.5 text-[#0284C7] shrink-0 mt-px" /> Tus compañeros deben estar inscritos y con pago confirmado en este
                  campamento.
                </li>
              </ul>
            </div>
          )}

          {isFree ? (
            <div className="rounded-2xl bg-emerald-50 border border-emerald-100 p-4 flex items-start gap-3">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
              <p className="text-xs text-emerald-800">
                <strong className="block text-sm">Este campeonato no tiene costo extra.</strong>
                Tu inscripción se confirma al instante.
              </p>
            </div>
          ) : !paymentSettings ? (
            <div className="h-24 rounded-2xl bg-slate-100 animate-pulse" />
          ) : (
            <>
              <div className="space-y-2">
                <span className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider">Método de pago</span>
                {methodOptions.length === 0 ? (
                  <p className="text-sm text-red-700 bg-red-50 border border-red-100 rounded-2xl p-4">
                    No hay métodos de pago habilitados. Comunícate con la organización.
                  </p>
                ) : (
                  <div className={`grid grid-cols-1 gap-2 ${methodOptions.length === 3 ? 'sm:grid-cols-3' : 'sm:grid-cols-2'}`}>
                    {methodOptions.map(({ id, cfg }) => {
                      const Icon = METHOD_STYLE[id].icon;
                      const active = method === id;
                      return (
                        <button
                          key={id}
                          type="button"
                          onClick={() => {
                            setMethod(id);
                            setError('');
                          }}
                          className={`p-3 rounded-2xl border-2 text-left cursor-pointer flex sm:flex-col items-center sm:items-start gap-3 sm:gap-2 transition-all ${
                            active ? 'border-sky-400 bg-sky-50 shadow-md ring-2 ring-sky-100' : 'border-slate-200 bg-white hover:shadow'
                          }`}
                        >
                          <span className={`w-9 h-9 rounded-xl bg-gradient-to-br ${METHOD_STYLE[id].gradient} flex items-center justify-center shadow shrink-0`}>
                            <Icon className="w-4 h-4 text-white" />
                          </span>
                          <span className="min-w-0">
                            <span className="block font-black text-xs text-slate-900">{cfg.label}</span>
                            <span className="block text-[10px] text-slate-500 leading-snug">{cfg.description}</span>
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {method === 'qr_bank' && methodOptions.some((m) => m.id === 'qr_bank') && (
                <div className="rounded-3xl border border-slate-100 p-4 sm:p-5 space-y-4">
                  <div className="text-center">
                    <h4 className="text-sm font-black text-slate-900">Escanea el código QR</h4>
                    <p className="text-xs text-slate-500">
                      Paga {fee} Bs con la app de tu banco · {paymentSettings.qr.bankName}
                    </p>
                  </div>
                  <div className="flex justify-center">
                    <div className={`relative p-3 rounded-3xl border-4 ${gatewayConfirmed ? 'border-emerald-400' : 'border-sky-200'}`}>
                      {paymentSettings.qr.qrImageUrl || qrDataUrl ? (
                        <img src={paymentSettings.qr.qrImageUrl || qrDataUrl} alt="Código QR de pago" className="w-44 h-44 rounded-2xl" />
                      ) : (
                        <div className="w-44 h-44 rounded-2xl bg-slate-100 flex items-center justify-center">
                          <RefreshCw className="w-7 h-7 text-slate-400 animate-spin" />
                        </div>
                      )}
                      {gatewayConfirmed && (
                        <span className="absolute -top-3 -right-3 w-9 h-9 bg-emerald-500 rounded-2xl flex items-center justify-center shadow-lg animate-pop-in">
                          <Check className="w-5 h-5 text-white" />
                        </span>
                      )}
                    </div>
                  </div>
                  {paymentSettings.qr.instructions && (
                    <p className="text-[11px] text-slate-600 text-center max-w-md mx-auto">{paymentSettings.qr.instructions}</p>
                  )}
                  {qrAuto ? (
                    gatewayConfirmed ? (
                      <p className="text-xs font-black text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-2xl p-3 flex items-center justify-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600" /> ¡Pago confirmado por el banco!
                      </p>
                    ) : (
                      <div className="bg-sky-50 rounded-2xl p-3 text-center space-y-1.5 border border-sky-100">
                        <p className="text-xs font-bold text-sky-800 flex items-center justify-center gap-2">
                          <span className="relative flex h-2.5 w-2.5">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-sky-400 opacity-75" />
                            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-sky-500" />
                          </span>
                          {simulating ? 'Recibiendo confirmación…' : 'Esperando confirmación bancaria…'}
                        </p>
                        <button
                          type="button"
                          onClick={simulate}
                          disabled={simulating}
                          className="text-xs text-sky-600 hover:text-sky-800 underline font-semibold cursor-pointer disabled:opacity-50"
                        >
                          Simular pago (demo)
                        </button>
                      </div>
                    )
                  ) : (
                    <div className="space-y-3 pt-3 border-t border-slate-100">
                      <Field label="Foto del comprobante del pago QR" required>
                        <ImageInput value={voucherUrl} onChange={setVoucherUrl} />
                      </Field>
                      <Field label="Número de referencia">
                        <TextInput value={reference} onChange={(e) => setReference(e.target.value)} placeholder="ej. 20261016-123456" />
                      </Field>
                    </div>
                  )}
                </div>
              )}

              {method === 'transfer' && methodOptions.some((m) => m.id === 'transfer') && (
                <div className="rounded-3xl border border-slate-100 p-4 sm:p-5 space-y-4">
                  <div>
                    <h4 className="text-sm font-black text-slate-900">Transfiere {fee} Bs a la cuenta oficial</h4>
                    {paymentSettings.transfer.instructions && (
                      <p className="text-[11px] text-slate-600 mt-0.5">{paymentSettings.transfer.instructions}</p>
                    )}
                  </div>
                  {activeAccounts.length === 0 ? (
                    <p className="text-xs text-amber-800 bg-amber-50 border border-amber-100 rounded-2xl p-3">
                      Aún no hay cuentas bancarias publicadas. Comunícate al {paymentSettings.whatsappContact}.
                    </p>
                  ) : (
                    <div className={`grid gap-2 ${activeAccounts.length > 1 ? 'sm:grid-cols-2' : ''}`}>
                      {activeAccounts.map((acc) => (
                        <AccountCard key={acc.id} bank={acc.bank} rows={[
                          { label: 'Número de cuenta', value: acc.accountNumber, mono: true },
                          { label: 'Titular', value: acc.holder },
                          ...(acc.holderDocument ? [{ label: 'CI / NIT', value: acc.holderDocument, mono: true }] : []),
                          { label: 'Tipo', value: `${acc.accountType} · ${acc.currency}` },
                          { label: 'Glosa', value: `CJN-EXT-${reg.ticketCode}`, mono: true },
                        ]} />
                      ))}
                    </div>
                  )}
                  <Field label="Foto del comprobante" required>
                    <ImageInput value={voucherUrl} onChange={setVoucherUrl} />
                  </Field>
                  <Field label="Número de referencia" required={referenceRequired}>
                    <TextInput value={reference} onChange={(e) => setReference(e.target.value)} placeholder="ej. 20261016-123456" />
                  </Field>
                  <p className="text-[11px] text-amber-800 bg-amber-50 border border-amber-100 rounded-xl p-2.5">
                    Tesorería revisará tu comprobante en un máximo de {paymentSettings.transfer.verificationHours} horas.
                    {isTeam && ' El enlace de invitación se activa cuando se apruebe.'}
                  </p>
                </div>
              )}

              {method === 'cash_box' && methodOptions.some((m) => m.id === 'cash_box') && (
                <div className="rounded-3xl border border-slate-100 p-4 sm:p-5 space-y-3">
                  <div className="flex items-center gap-3 rounded-2xl bg-emerald-50 border border-emerald-100 p-3">
                    <Banknote className="w-6 h-6 text-emerald-600 shrink-0" />
                    <div>
                      <div className="text-xl font-black font-mono text-emerald-800">{fee} Bs</div>
                      <div className="text-[11px] text-emerald-700 font-bold">A pagar en caja con tu código {reg.ticketCode}</div>
                    </div>
                  </div>
                  <ul className="space-y-1 text-xs text-slate-600">
                    {paymentSettings.cash.places && <li>• Dónde pagar: {paymentSettings.cash.places}.</li>}
                    {paymentSettings.cash.instructions && <li>• {paymentSettings.cash.instructions}</li>}
                    <li>
                      • Tu lugar queda reservado como «pendiente de pago»
                      {isTeam ? ' y el enlace de invitación se activa cuando caja registre tu pago.' : ' hasta que caja registre tu pago.'}
                    </li>
                  </ul>
                </div>
              )}
            </>
          )}

          {error && (
            <p className="text-xs font-bold text-red-600 flex items-center gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5" /> {error}
            </p>
          )}
        </div>
      )}
    </Modal>
  );
};

const AccountCard: React.FC<{ bank: string; rows: { label: string; value: string; mono?: boolean }[] }> = ({ bank, rows }) => {
  const [copied, setCopied] = useState('');
  const copy = async (label: string, value: string) => {
    if (await copyText(value)) {
      setCopied(label);
      window.setTimeout(() => setCopied(''), 1500);
    }
  };
  return (
    <div className="bg-indigo-50 rounded-2xl border border-indigo-100 p-3 space-y-2">
      <div className="flex items-center gap-2 text-xs font-black text-indigo-900">
        <Building2 className="w-4 h-4 text-indigo-500" /> {bank}
      </div>
      {rows.map((r) => (
        <div key={r.label} className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <span className="text-[9px] text-indigo-500 font-bold uppercase">{r.label}</span>
            <p className={`text-xs font-bold text-indigo-900 break-all ${r.mono ? 'font-mono' : ''}`}>{r.value}</p>
          </div>
          <button
            type="button"
            onClick={() => copy(r.label, r.value)}
            className="shrink-0 p-1.5 rounded-lg bg-white hover:bg-indigo-100 border border-indigo-100 cursor-pointer"
            title="Copiar"
            aria-label={`Copiar ${r.label}`}
          >
            {copied === r.label ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5 text-indigo-500" />}
          </button>
        </div>
      ))}
    </div>
  );
};

// =========================================================
// d) Mis equipos e inscripciones a campeonatos
// =========================================================

const EntriesSection: React.FC<{ reg: CamperRegistration; onGo: (s: SectionId) => void }> = ({ reg, onGo }) => {
  const { championshipEntries } = useCamp();
  const [showCancelled, setShowCancelled] = useState(false);

  const mine = championshipEntries
    .filter((e) => e.captainRegistrationId === reg.id || e.members.some((m) => m.registrationId === reg.id))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const active = mine.filter((e) => e.status !== 'cancelled');
  const cancelled = mine.filter((e) => e.status === 'cancelled');

  return (
    <SectionCard
      title="Mis equipos e inscripciones"
      icon={Users}
      description="Tus inscripciones a campeonatos, los pagos extra y los integrantes de tus equipos."
    >
      {active.length === 0 ? (
        <div className="text-center py-12">
          <Users className="w-10 h-10 text-slate-300 mx-auto" />
          <h4 className="mt-3 text-sm font-black text-slate-800">Todavía no participas en ningún campeonato</h4>
          <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
            Inscríbete a una disciplina o crea tu equipo. Si alguien te invitó, abre el enlace que te compartió.
          </p>
          <div className="mt-4 flex justify-center">
            <Button icon={Trophy} onClick={() => onGo('campeonatos')}>
              Ver campeonatos
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {active.map((e) => (
            <EntryCard key={e.id} entry={e} reg={reg} />
          ))}
        </div>
      )}

      {cancelled.length > 0 && (
        <div className="mt-6 pt-4 border-t border-slate-100">
          <button
            type="button"
            onClick={() => setShowCancelled((v) => !v)}
            className="text-xs font-bold text-slate-500 hover:text-slate-800 cursor-pointer"
          >
            {showCancelled ? 'Ocultar' : 'Ver'} inscripciones anuladas ({cancelled.length})
          </button>
          {showCancelled && (
            <div className="mt-3 space-y-3 opacity-70">
              {cancelled.map((e) => (
                <EntryCard key={e.id} entry={e} reg={reg} />
              ))}
            </div>
          )}
        </div>
      )}
    </SectionCard>
  );
};

const EntryCard: React.FC<{ entry: ChampionshipEntry; reg: CamperRegistration }> = ({ entry: e, reg }) => {
  const { getChampionshipById, getTribeById, cancelChampionshipEntry, removeTeamMember, resubmitEntryVoucher } = useCamp();
  const { confirm } = useConfirm();
  const { toast } = useToast();
  const ch = getChampionshipById(e.championshipId);
  const isTeam = e.type === 'team';
  const isCaptain = e.captainRegistrationId === reg.id;
  const cancelled = e.status === 'cancelled';
  const paid = e.payment.status === 'completed';
  const canCancel = isCaptain && !cancelled && !(paid && e.payment.amount > 0);
  const [busy, setBusy] = useState<string | null>(null);
  const [resubmitOpen, setResubmitOpen] = useState(false);
  const [showQr, setShowQr] = useState(false);
  const [qr, setQr] = useState('');
  const [copied, setCopied] = useState(false);

  const link = e.inviteCode ? inviteLink(e.inviteCode) : '';
  const inviteActive = isTeam && e.status === 'confirmed' && !!e.inviteCode;
  const max = ch?.maxTeamSize || 0;
  const min = ch?.minTeamSize || 1;
  const count = e.members.length;
  const full = max > 0 && count >= max;

  useEffect(() => {
    if (showQr && link && !qr) generateQrDataUrl(link, '#0C4A6E').then(setQr);
  }, [showQr, link, qr]);

  const doCopy = async () => {
    const ok = await copyText(link);
    if (ok) {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
      toast({ type: 'success', title: 'Enlace copiado', message: 'Pégalo en el chat de tu equipo.' });
    } else {
      toast({ type: 'warning', title: 'No se pudo copiar', message: 'Mantén presionado el enlace para copiarlo.' });
    }
  };

  const shareText = `¡Únete a mi equipo «${e.teamName}» en ${ch?.name || 'el campeonato'}! Entra aquí: ${link}`;

  const handleCancel = async () => {
    const ok = await confirm({
      title: isTeam ? `¿Anular el equipo «${e.teamName}»?` : `¿Anular tu inscripción a ${ch?.name || 'este campeonato'}?`,
      message: isTeam
        ? 'Se liberará el cupo del equipo y todos los integrantes saldrán del campeonato.'
        : 'Se liberará tu cupo en el campeonato.',
      confirmText: 'Sí, anular',
      tone: 'danger',
    });
    if (!ok) return;
    setBusy('cancel');
    try {
      await cancelChampionshipEntry(e.id);
    } finally {
      setBusy(null);
    }
  };

  const handleRemove = async (registrationId: string, fullName: string, self: boolean) => {
    const ok = await confirm({
      title: self ? `¿Salir del equipo «${e.teamName}»?` : `¿Quitar a ${fullName} del equipo?`,
      message: self
        ? 'Dejarás de participar en este campeonato. Podrás volver a unirte con el enlace si aún hay lugar.'
        : 'Se le notificará que ya no forma parte del equipo.',
      confirmText: self ? 'Sí, salir' : 'Sí, quitar',
      tone: 'warning',
    });
    if (!ok) return;
    setBusy(registrationId);
    try {
      await removeTeamMember(e.id, registrationId);
    } finally {
      setBusy(null);
    }
  };

  return (
    <article className="rounded-3xl border border-slate-100 bg-white overflow-hidden shadow-sm">
      {/* Cabecera */}
      <div className="flex gap-3 sm:gap-4 p-4 sm:p-5 bg-gradient-to-r from-sky-50/80 to-white border-b border-slate-100">
        <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl overflow-hidden bg-gradient-to-br from-sky-500 to-indigo-600 shrink-0 flex items-center justify-center">
          {ch?.imageUrl ? <img src={ch.imageUrl} alt="" className="w-full h-full object-cover" /> : <Trophy className="w-6 h-6 text-white" />}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border ${ENTRY_STATUS[e.status].cls}`}>
              {ENTRY_STATUS[e.status].label}
            </span>
            {!cancelled && (
              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border ${EXTRA_PAY_STATUS[e.payment.status].cls}`}>
                {e.payment.method === 'free' ? 'Sin costo' : EXTRA_PAY_STATUS[e.payment.status].label}
              </span>
            )}
            {isTeam && isCaptain && (
              <Badge className="bg-amber-50 text-amber-700 border-amber-200">
                <Crown className="w-3 h-3" /> Capitán
              </Badge>
            )}
          </div>
          <h3 className="text-base sm:text-lg font-black text-slate-900 font-display leading-tight mt-1">
            {isTeam ? e.teamName : ch?.name || 'Campeonato'}
          </h3>
          <p className="text-xs text-slate-500 font-semibold">
            {isTeam ? `${ch?.name || 'Campeonato'} · ` : ''}
            {ch ? `${ch.sport} · ${ch.genderCategory}` : ''}
          </p>
        </div>
        <div className="hidden sm:block text-right shrink-0">
          <div className="text-[9px] font-black uppercase tracking-wider text-slate-400">Pago extra</div>
          <div className="text-lg font-black font-mono text-slate-900">{e.payment.amount > 0 ? `${e.payment.amount} Bs` : 'Gratis'}</div>
          {e.payment.method !== 'free' && <div className="text-[10px] text-slate-400">{METHOD_LABEL[e.payment.method]}</div>}
        </div>
      </div>

      <div className="p-4 sm:p-5 space-y-4">
        <div className="sm:hidden flex justify-between text-xs">
          <span className="text-slate-500 font-semibold">Pago extra</span>
          <span className="font-black font-mono text-slate-900">
            {e.payment.amount > 0 ? `${e.payment.amount} Bs · ${METHOD_LABEL[e.payment.method]}` : 'Gratis'}
          </span>
        </div>

        {/* Estado del pago extra */}
        {!cancelled && e.payment.status === 'rejected' && (
          <div className="rounded-2xl bg-red-50 border border-red-100 p-3 flex flex-col sm:flex-row sm:items-center gap-2.5">
            <AlertTriangle className="w-5 h-5 text-red-500 shrink-0" />
            <div className="flex-1 text-xs text-red-800">
              <strong className="block">Tesorería rechazó el comprobante</strong>
              Motivo: {e.payment.rejectionReason || 'No especificado'}
            </div>
            {isCaptain && (
              <button
                type="button"
                onClick={() => setResubmitOpen(true)}
                className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white text-[11px] font-black cursor-pointer"
              >
                <Upload className="w-3.5 h-3.5" /> Subir nuevo comprobante
              </button>
            )}
          </div>
        )}
        {!cancelled && e.payment.status === 'pending_cash' && (
          <p className="text-xs text-amber-800 bg-amber-50 border border-amber-100 rounded-2xl p-3 flex items-start gap-2">
            <Banknote className="w-4 h-4 shrink-0 mt-px" />
            {isCaptain
              ? `Paga ${e.payment.amount} Bs en caja con tu código ${reg.ticketCode} para confirmar la inscripción.`
              : `El capitán debe pagar ${e.payment.amount} Bs en caja para confirmar la inscripción.`}
          </p>
        )}
        {!cancelled && e.payment.status === 'pending_verification' && (
          <p className="text-xs text-sky-800 bg-sky-50 border border-sky-100 rounded-2xl p-3 flex items-start gap-2">
            <Hourglass className="w-4 h-4 shrink-0 mt-px" /> Tesorería está revisando el comprobante del pago extra.
          </p>
        )}

        {/* Equipo */}
        {isTeam && (
          <div className="grid lg:grid-cols-2 gap-4">
            <div className="space-y-3">
              <div>
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-xs font-black text-slate-800">Integrantes</span>
                  <span className="text-xs font-bold text-slate-500">
                    <span className="font-mono text-slate-900">
                      {count}/{max || '—'}
                    </span>{' '}
                    integrantes (mín. {min})
                  </span>
                </div>
                <div className="mt-1.5 h-2 rounded-full bg-slate-100 overflow-hidden relative">
                  <div
                    className={`h-full rounded-full ${count >= min ? 'bg-emerald-500' : 'bg-amber-400'}`}
                    style={{ width: `${max ? Math.min(100, (count / max) * 100) : 100}%` }}
                  />
                  {max > 0 && min > 1 && (
                    <span className="absolute top-0 bottom-0 w-0.5 bg-slate-400" style={{ left: `${Math.min(100, (min / max) * 100)}%` }} />
                  )}
                </div>
                {!cancelled && count < min && (
                  <p className="text-[11px] text-amber-700 font-semibold mt-1">
                    Faltan {min - count} {min - count === 1 ? 'integrante' : 'integrantes'} para el mínimo.
                  </p>
                )}
              </div>
              <ul className="divide-y divide-slate-100 rounded-2xl border border-slate-100">
                {e.members.map((m) => {
                  const tribe = m.tribeId ? getTribeById(m.tribeId) : undefined;
                  const self = m.registrationId === reg.id;
                  return (
                    <li key={m.registrationId} className="flex items-center gap-3 px-3 py-2.5">
                      <span
                        className="w-2.5 h-2.5 rounded-full shrink-0 ring-2 ring-white shadow"
                        style={{ backgroundColor: tribe?.colorHex || '#CBD5E1' }}
                        title={tribe?.name || 'Sin tribu'}
                      />
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-bold text-slate-800 truncate">
                          {m.fullName} {self && <span className="text-slate-400 font-semibold">(tú)</span>}
                        </p>
                        {tribe && <p className="text-[10px] text-slate-400 truncate">{tribe.name.replace(/^Tribu \d+:\s*/, '')}</p>}
                      </div>
                      {m.role === 'captain' ? (
                        <Badge className="bg-amber-50 text-amber-700 border-amber-200">
                          <Crown className="w-3 h-3" /> Capitán
                        </Badge>
                      ) : (
                        !cancelled &&
                        isCaptain && (
                          <button
                            type="button"
                            onClick={() => handleRemove(m.registrationId, m.fullName, false)}
                            disabled={busy === m.registrationId}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 cursor-pointer disabled:opacity-50"
                            aria-label={`Quitar a ${m.fullName}`}
                            title="Quitar del equipo"
                          >
                            {busy === m.registrationId ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserMinus className="w-4 h-4" />}
                          </button>
                        )
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>

            {/* Invitación */}
            {!cancelled && (
              <div>
                {inviteActive ? (
                  <div className="rounded-3xl bg-gradient-to-br from-sky-600 to-[#0369A1] text-white p-4 sm:p-5 space-y-3 h-full">
                    <div className="flex items-center gap-2">
                      <Link2 className="w-4 h-4" />
                      <h4 className="text-sm font-black">Invita a tu equipo</h4>
                    </div>
                    {full ? (
                      <p className="text-xs text-sky-100">¡El equipo está completo! Ya no se pueden sumar más integrantes.</p>
                    ) : (
                      <p className="text-xs text-sky-100">
                        Comparte este enlace. Quedan {max ? max - count : '—'} {max - count === 1 ? 'lugar' : 'lugares'}; deben estar inscritos y con pago
                        confirmado en este campamento.
                      </p>
                    )}
                    <div className="rounded-2xl bg-white/10 border border-white/20 px-3 py-2 font-mono text-[11px] break-all select-all">{link}</div>
                    <div className="grid grid-cols-3 gap-2">
                      <button
                        type="button"
                        onClick={doCopy}
                        className="inline-flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-1.5 px-2 py-2 rounded-xl bg-white text-sky-800 font-black text-[11px] cursor-pointer hover:bg-sky-50"
                      >
                        {copied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />} {copied ? 'Copiado' : 'Copiar'}
                      </button>
                      <a
                        href={`https://wa.me/?text=${encodeURIComponent(shareText)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-1.5 px-2 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-black text-[11px]"
                      >
                        <MessageCircle className="w-4 h-4" /> WhatsApp
                      </a>
                      <button
                        type="button"
                        onClick={() => setShowQr((v) => !v)}
                        className="inline-flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-1.5 px-2 py-2 rounded-xl bg-white/15 hover:bg-white/25 border border-white/20 font-black text-[11px] cursor-pointer"
                      >
                        {showQr ? <X className="w-4 h-4" /> : <QrCode className="w-4 h-4" />} {showQr ? 'Ocultar' : 'QR'}
                      </button>
                    </div>
                    {typeof navigator !== 'undefined' && 'share' in navigator && (
                      <button
                        type="button"
                        onClick={() => navigator.share({ title: `Equipo ${e.teamName}`, text: shareText, url: link }).catch(() => undefined)}
                        className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-white/10 hover:bg-white/20 border border-white/15 text-[11px] font-bold cursor-pointer"
                      >
                        <Share2 className="w-3.5 h-3.5" /> Más opciones para compartir
                      </button>
                    )}
                    {showQr && (
                      <div className="bg-white rounded-2xl p-3 flex flex-col items-center gap-1.5 animate-fade-in-scale">
                        {qr ? (
                          <img src={qr} alt={`QR de invitación al equipo ${e.teamName}`} className="w-44 h-44" />
                        ) : (
                          <div className="w-44 h-44 rounded-xl bg-slate-100 animate-pulse" />
                        )}
                        <p className="text-[10px] text-slate-500 font-semibold text-center">Muéstralo en persona para que lo escaneen</p>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="rounded-3xl border-2 border-dashed border-slate-200 bg-slate-50 p-5 h-full flex flex-col items-center justify-center text-center gap-2">
                    <Lock className="w-7 h-7 text-slate-400" />
                    <h4 className="text-sm font-black text-slate-700">Enlace de invitación</h4>
                    <p className="text-xs text-slate-500 max-w-xs">El enlace se activa cuando se confirme el pago.</p>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Acciones */}
        {!cancelled && (canCancel || (isTeam && !isCaptain)) && (
          <div className="flex flex-wrap justify-end gap-2 pt-3 border-t border-dashed border-slate-200">
            {isTeam && !isCaptain && (
              <Button
                variant="danger"
                size="sm"
                icon={busy === reg.id ? Loader2 : LogOut}
                className={busy === reg.id ? '[&>svg]:animate-spin' : ''}
                disabled={busy === reg.id}
                onClick={() => handleRemove(reg.id, reg.fullName, true)}
              >
                Salir del equipo
              </Button>
            )}
            {canCancel && (
              <Button
                variant="danger"
                size="sm"
                icon={busy === 'cancel' ? Loader2 : Ban}
                className={busy === 'cancel' ? '[&>svg]:animate-spin' : ''}
                disabled={busy === 'cancel'}
                onClick={handleCancel}
              >
                {isTeam ? 'Anular equipo' : 'Anular inscripción'}
              </Button>
            )}
          </div>
        )}
      </div>

      <ResubmitModal
        open={resubmitOpen}
        onClose={() => setResubmitOpen(false)}
        title="Subir nuevo comprobante"
        subtitle={`${ch?.name || 'Campeonato'}${isTeam ? ` · ${e.teamName}` : ''}`}
        amount={e.payment.amount}
        reason={e.payment.rejectionReason}
        onSubmit={async (v) => !!(await resubmitEntryVoucher(e.id, v))}
      />
    </article>
  );
};
