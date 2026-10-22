import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useCamp } from '../../context/CampContext';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../common/Toast';
import { CamperRegistration, CampCourse, Championship, Gender } from '../../types/camp';
import { registrationsApi, type NewRegistrationPayload } from '../../api/services';
import { errorMessage, isApiError } from '../../api/errors';
import { generateQrDataUrl } from '../../utils/qrGenerator';
import { formatCourseScheduleShort, formatDateRange, getCampPhase, isCampEnrollable, PHASE_META } from '../../utils/campUtils';
import { Credential } from '../common/Credential';
import { PasswordChecklist, PasswordInput, passwordProblem } from '../auth/PasswordPolicy';
import confetti from 'canvas-confetti';
import {
  AlertCircle,
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Banknote,
  BookOpen,
  Building2,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Church,
  Clock,
  Copy,
  CreditCard,
  Flame,
  Hourglass,
  Info,
  KeyRound,
  Loader2,
  LogIn,
  Mail,
  MapPin,
  PartyPopper,
  Phone,
  QrCode,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Sun,
  Tag,
  Tent,
  Ticket,
  Trophy,
  Upload,
  User,
  UserCheck,
  Users,
  Wallet,
  X,
} from 'lucide-react';
import { EMAIL_RE, PHONE_RE, localPhone } from '../../utils/validation';

interface EnrollmentWizardProps {
  /** Taller que el joven estaba mirando: solo se resalta en la vista previa (se elige después de pagar). */
  initialCourseId?: string;
  /** Campeonato que el joven estaba mirando: solo se resalta en la vista previa. */
  initialChampionshipId?: string;
  onEnrollmentComplete?: () => void;
}

const CI_EXPEDICIONES = [
  { code: 'LP', name: 'La Paz' },
  { code: 'CB', name: 'Cochabamba' },
  { code: 'SC', name: 'Santa Cruz' },
  { code: 'PT', name: 'Potosí' },
  { code: 'OR', name: 'Oruro' },
  { code: 'CH', name: 'Chuquisaca' },
  { code: 'TJ', name: 'Tarija' },
  { code: 'BE', name: 'Beni' },
  { code: 'PA', name: 'Pando' },
];

type PaymentMethodId = 'qr_bank' | 'transfer' | 'cash_box';

const METHOD_STYLE: Record<PaymentMethodId, { icon: React.ElementType; gradient: string }> = {
  qr_bank: { icon: QrCode, gradient: 'from-sky-500 to-blue-600' },
  transfer: { icon: Building2, gradient: 'from-indigo-500 to-violet-600' },
  cash_box: { icon: Banknote, gradient: 'from-emerald-500 to-teal-600' },
};

const STEPS = [
  { num: 1, label: 'Campamento', icon: Tent },
  { num: 2, label: 'Tus datos', icon: User },
  { num: 3, label: 'Pago', icon: CreditCard },
  { num: 4, label: '¡Listo!', icon: PartyPopper },
];

/** Mismas reglas que el servidor (las vuelve a validar siempre). */
const MAX_VOUCHER_BYTES = 1.5 * 1024 * 1024;

/** Orden de los campos del paso 2 (para enfocar el primer error). */
const STEP2_FIELDS = [
  'firstName',
  'paternalLastName',
  'documentId',
  'birthDate',
  'gender',
  'phone',
  'regional',
  'email',
  'password',
  'confirmPassword',
  'acceptTerms',
] as const;

function computeAge(iso: string): number {
  if (!iso) return 0;
  const birth = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(birth.getTime())) return 0;
  const today = new Date();
  let a = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) a--;
  return a > 0 && a < 120 ? a : 0;
}

function champModeLabel(ch: Championship): string {
  if (ch.mode !== 'team') return 'Individual';
  const { minTeamSize: min, maxTeamSize: max } = ch;
  if (min && max && min !== max) return `Equipos de ${min}–${max}`;
  if (min || max) return `Equipos de ${min || max}`;
  return 'Por equipos';
}

function champFeeLabel(ch: Championship): string {
  if (!ch.registrationFee) return 'Gratis';
  return `${ch.registrationFee} Bs ${ch.mode === 'team' ? 'por equipo' : 'por persona'}`;
}

// =========================================================
// PIEZAS DE UI
// =========================================================
function StepIndicator({ currentStep }: { currentStep: number }) {
  return (
    <ol className="flex items-center justify-center py-4" aria-label="Pasos de la inscripción">
      {STEPS.map((step, idx) => {
        const Icon = step.icon;
        const isDone = currentStep > step.num;
        const isActive = currentStep === step.num;
        return (
          <React.Fragment key={step.num}>
            <li className="flex flex-col items-center gap-1" aria-current={isActive ? 'step' : undefined}>
              <div
                className={`w-10 h-10 sm:w-11 sm:h-11 rounded-2xl flex items-center justify-center transition-all duration-500 ${
                  isDone
                    ? 'bg-emerald-500 text-white shadow'
                    : isActive
                    ? 'bg-gradient-to-br from-sky-500 to-blue-600 text-white shadow-xl scale-110'
                    : 'bg-white text-slate-400 border border-slate-200'
                }`}
              >
                {isDone ? <Check className="w-5 h-5 animate-check-pop" /> : <Icon className="w-5 h-5" />}
              </div>
              <span
                className={`text-[10px] font-bold ${isActive ? 'text-sky-700' : isDone ? 'text-emerald-600' : 'text-slate-400'} ${
                  isActive ? '' : 'hidden sm:block'
                }`}
              >
                {step.label}
              </span>
            </li>
            {idx < STEPS.length - 1 && (
              <li aria-hidden className="flex-1 max-w-20 mx-1 sm:mx-2 h-1 rounded-full overflow-hidden bg-slate-200 -mt-4">
                <div
                  className="h-full rounded-full transition-all duration-700 bg-gradient-to-r from-emerald-400 to-sky-500"
                  style={{ width: currentStep > step.num ? '100%' : '0%' }}
                />
              </li>
            )}
          </React.Fragment>
        );
      })}
    </ol>
  );
}

function Field({
  label,
  error,
  required,
  htmlFor,
  hint,
  children,
}: {
  label: string;
  error?: string;
  required?: boolean;
  htmlFor?: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1 min-w-0">
      <label htmlFor={htmlFor} className="block text-xs sm:text-sm font-bold text-slate-700">
        {label}
        {required && <span className="text-sky-500 ml-0.5">*</span>}
      </label>
      {children}
      {error ? (
        <p id={htmlFor ? `${htmlFor}-error` : undefined} className="text-[11px] text-red-600 font-semibold flex items-start gap-1 animate-fade-in">
          <AlertCircle className="w-3 h-3 shrink-0 mt-px" /> {error}
        </p>
      ) : hint ? (
        <p className="text-[11px] text-slate-400">{hint}</p>
      ) : null}
    </div>
  );
}

const controlCls = (error?: string) =>
  `w-full px-4 py-3 rounded-2xl border text-sm font-medium outline-none transition-all ${
    error
      ? 'border-red-300 bg-red-50/40 focus:ring-2 focus:ring-red-300 text-red-900'
      : 'border-slate-200 bg-slate-50 focus:bg-white focus:border-sky-400 focus:ring-2 focus:ring-sky-100 text-slate-900'
  }`;

function Input({ error, className = '', ...props }: React.InputHTMLAttributes<HTMLInputElement> & { error?: string }) {
  return (
    <input
      {...props}
      aria-invalid={error ? true : undefined}
      aria-describedby={error && props.id ? `${props.id}-error` : undefined}
      className={`${controlCls(error)} ${className}`}
    />
  );
}

function Select({ error, className = '', ...props }: React.SelectHTMLAttributes<HTMLSelectElement> & { error?: string }) {
  return (
    <select
      {...props}
      aria-invalid={error ? true : undefined}
      className={`${controlCls(error)} appearance-none cursor-pointer ${className}`}
    />
  );
}

function SectionTitle({ icon: Icon, title, subtitle, tone = 'sky' }: { icon: React.ElementType; title: string; subtitle?: string; tone?: 'sky' | 'violet' | 'amber' | 'emerald' }) {
  const toneCls = {
    sky: 'bg-sky-100 text-sky-600',
    violet: 'bg-violet-100 text-violet-600',
    amber: 'bg-amber-100 text-amber-600',
    emerald: 'bg-emerald-100 text-emerald-600',
  }[tone];
  return (
    <div className="flex items-center gap-2.5">
      <span className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${toneCls}`}>
        <Icon className="w-4 h-4" />
      </span>
      <div className="min-w-0">
        <h3 className="text-sm font-black text-slate-900 font-display leading-tight">{title}</h3>
        {subtitle && <p className="text-[11px] text-slate-500 leading-snug">{subtitle}</p>}
      </div>
    </div>
  );
}

function StepCard({
  title,
  subtitle,
  icon: Icon,
  gradient,
  onBack,
  children,
}: {
  title: string;
  subtitle: string;
  icon: React.ElementType;
  gradient: string;
  onBack?: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-white rounded-3xl shadow-xl border border-slate-100 overflow-hidden animate-fade-in-scale mt-4">
      <div className={`bg-gradient-to-r ${gradient} p-5 sm:p-6`}>
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 bg-white/20 rounded-2xl flex items-center justify-center shrink-0">
              <Icon className="w-5 h-5 text-white" />
            </div>
            <div className="min-w-0">
              <h2 className="text-lg font-black text-white font-display">{title}</h2>
              <p className="text-white/80 text-xs truncate">{subtitle}</p>
            </div>
          </div>
          {onBack && (
            <button
              type="button"
              onClick={onBack}
              className="text-white/85 hover:text-white flex items-center gap-1 text-xs font-bold cursor-pointer shrink-0"
            >
              <ArrowLeft className="w-4 h-4" /> Volver
            </button>
          )}
        </div>
      </div>
      <div className="p-5 sm:p-8 space-y-6">{children}</div>
    </div>
  );
}

// =========================================================
// COMPONENTE PRINCIPAL
// =========================================================
export const EnrollmentWizard: React.FC<EnrollmentWizardProps> = ({ initialCourseId, initialChampionshipId, onEnrollmentComplete }) => {
  const {
    camps,
    catalogs,
    courses,
    championships,
    selectedCamp,
    setSelectedCampId,
    getCoursesForCamp,
    validateGroupCoupon,
    setSelectedCamperForBadge,
    myRegistrations,
    setActiveTab,
    paymentSettings,
    refreshData,
  } = useCamp();
  const { currentUser, isAuthenticated, requireLogin, applySession } = useAuth();
  const { toast, toastError } = useToast();

  const camp = selectedCamp;
  const [step, setStep] = useState(1);
  const goTo = (n: number) => {
    setStep(n);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const enrollableCamps = camps.filter(isCampEnrollable).sort((a, b) => a.startDate.localeCompare(b.startDate));
  const existingReg = camp ? myRegistrations.find((r) => r.campId === camp.id) : undefined;
  const phase = camp ? getCampPhase(camp) : null;

  // ── PASO 1: VISTA PREVIA (solo lectura) ────────────────
  const campCourses = useMemo(
    () =>
      [...getCoursesForCamp(camp?.id)].sort((a, b) =>
        a.scheduleType === b.scheduleType
          ? (a.date || '').localeCompare(b.date || '') || a.startTime.localeCompare(b.startTime)
          : a.scheduleType === 'all_days'
          ? -1
          : 1
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [courses, camp?.id]
  );
  const campChamps = useMemo(() => championships.filter((ch) => ch.campId === camp?.id), [championships, camp?.id]);
  const [showAllCourses, setShowAllCourses] = useState(false);
  const [showAllChamps, setShowAllChamps] = useState(false);
  // El taller/campeonato que el joven estaba mirando se muestra primero y resaltado
  const coursesPreview = useMemo(() => {
    const list = [...campCourses];
    const i = list.findIndex((c) => c.id === initialCourseId);
    if (i > 0) list.unshift(...list.splice(i, 1));
    return list;
  }, [campCourses, initialCourseId]);
  const champsPreview = useMemo(() => {
    const list = [...campChamps];
    const i = list.findIndex((c) => c.id === initialChampionshipId);
    if (i > 0) list.unshift(...list.splice(i, 1));
    return list;
  }, [campChamps, initialChampionshipId]);

  // ── PASO 2: DATOS ──────────────────────────────────────
  const [firstName, setFirstName] = useState(currentUser?.firstName || '');
  const [paternalLastName, setPaternalLastName] = useState(currentUser?.paternalLastName || '');
  const [maternalLastName, setMaternalLastName] = useState(currentUser?.maternalLastName || '');
  const [documentNumber, setDocumentNumber] = useState(currentUser?.documentId?.split('-')[0] || '');
  const [idExpedition, setIdExpedition] = useState(currentUser?.idExpedition || 'CB');
  const [birthDate, setBirthDate] = useState(currentUser?.birthDate || '');
  const [gender, setGender] = useState<Gender | ''>(currentUser?.gender || '');
  const [phone, setPhone] = useState(localPhone(currentUser?.phone));
  const [churchCongregation, setChurchCongregation] = useState(currentUser?.churchCongregation || '');
  const [serviceAreaOfInterest, setServiceAreaOfInterest] = useState(
    currentUser?.serviceAreaOfInterest || catalogs.serviceAreas[0]?.name || ''
  );
  const [emergencyContactName, setEmergencyContactName] = useState('');
  const [emergencyPhone, setEmergencyPhone] = useState('');
  const age = computeAge(birthDate);

  // Cuenta nueva (solo sin sesión): se crea junto con la inscripción
  const [accountEmail, setAccountEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [emailExists, setEmailExists] = useState(false);

  const [errors, setErrors] = useState<Record<string, string>>({});
  const clearErr = (...keys: string[]) =>
    setErrors((prev) => {
      if (!keys.some((k) => prev[k])) return prev;
      const next = { ...prev };
      keys.forEach((k) => delete next[k]);
      return next;
    });

  // Ubicación desde los catálogos: ciudad → sub-directiva → regional
  const regionalFor = (name?: string) => {
    const reg = catalogs.regionales.find((r) => r.name === name);
    const sub = catalogs.subdirectivas.find((s) => s.id === reg?.subdirectivaId);
    return { reg, sub };
  };
  const initialLoc = regionalFor(currentUser?.regional);
  const [cityId, setCityId] = useState(initialLoc.sub?.cityId || catalogs.cities[0]?.id || '');
  const [subId, setSubId] = useState(initialLoc.sub?.id || '');
  const [regionalId, setRegionalId] = useState(initialLoc.reg?.id || '');
  const locationTouched = useRef(false);

  const subsForCity = catalogs.subdirectivas.filter((s) => s.cityId === cityId);
  const regsForSub = catalogs.regionales.filter((r) => r.subdirectivaId === subId);

  useEffect(() => {
    if (!subsForCity.some((s) => s.id === subId)) setSubId(subsForCity[0]?.id || '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cityId]);
  useEffect(() => {
    if (!regsForSub.some((r) => r.id === regionalId)) setRegionalId(regsForSub[0]?.id || '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subId]);

  const cityName = catalogs.cities.find((c) => c.id === cityId)?.name || '';
  const subName = catalogs.subdirectivas.find((s) => s.id === subId)?.name || '';
  const regionalName = catalogs.regionales.find((r) => r.id === regionalId)?.name || '';

  // Si inicia sesión a mitad del formulario: se conserva lo escrito y se completan solo los campos vacíos
  const justEnrolled = useRef(false);
  const prevUserId = useRef(currentUser?.id);
  useEffect(() => {
    const prev = prevUserId.current;
    prevUserId.current = currentUser?.id;
    if (!currentUser || prev === currentUser.id || justEnrolled.current) return;
    const keep = (v: string, fallback?: string) => (v.trim() ? v : fallback || '');
    setFirstName((v) => keep(v, currentUser.firstName));
    setPaternalLastName((v) => keep(v, currentUser.paternalLastName));
    setMaternalLastName((v) => keep(v, currentUser.maternalLastName));
    setBirthDate((v) => keep(v, currentUser.birthDate));
    setPhone((v) => keep(v, localPhone(currentUser.phone)));
    setDocumentNumber((v) => keep(v, currentUser.documentId?.split('-')[0]));
    setChurchCongregation((v) => keep(v, currentUser.churchCongregation));
    setGender((g) => g || currentUser.gender || '');
    if (!locationTouched.current) {
      const loc = regionalFor(currentUser.regional);
      if (loc.reg && loc.sub) {
        setCityId(loc.sub.cityId);
        setSubId(loc.sub.id);
        setRegionalId(loc.reg.id);
      }
    }
    setEmailExists(false);
    setPassword('');
    setConfirmPassword('');
    clearErr('email', 'password', 'confirmPassword', 'acceptTerms');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser?.id]);

  const focusField = (key: string) => {
    window.setTimeout(() => {
      const el = document.getElementById(`enr-${key}`);
      if (!el) return;
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      el.focus({ preventScroll: true });
    }, 120);
  };

  const validateData = (): boolean => {
    const e: Record<string, string> = {};
    if (firstName.trim().length < 2) e.firstName = 'Ingresa tus nombres.';
    if (paternalLastName.trim().length < 2) e.paternalLastName = 'Ingresa tu apellido paterno.';
    if (documentNumber.replace(/\D/g, '').length < 5) e.documentId = 'Ingresa un número de CI válido (mínimo 5 dígitos).';
    if (!birthDate || !age) e.birthDate = 'Ingresa tu fecha de nacimiento.';
    else if (camp && (age < camp.minAge || age > camp.maxAge)) {
      e.birthDate = `Este campamento es para jóvenes de ${camp.minAge} a ${camp.maxAge} años (tienes ${age}).`;
    }
    if (!gender) e.gender = 'Indica si eres varón o mujer.';
    if (!PHONE_RE.test(phone)) e.phone = 'Número de WhatsApp boliviano de 8 dígitos (empieza con 6 o 7).';
    if (!regionalName) e.regional = 'Selecciona tu regional.';
    if (!isAuthenticated) {
      const mail = accountEmail.trim();
      if (!EMAIL_RE.test(mail)) e.email = 'Ingresa un correo electrónico válido.';
      const pwd = passwordProblem(password, mail);
      if (pwd) e.password = pwd;
      if (!confirmPassword) e.confirmPassword = 'Repite tu contraseña.';
      else if (confirmPassword !== password) e.confirmPassword = 'Las contraseñas no coinciden.';
      if (!acceptTerms) e.acceptTerms = 'Debes aceptar los términos y el uso de tus datos.';
    }
    setErrors(e);
    const first = STEP2_FIELDS.find((k) => e[k]);
    if (first) focusField(first);
    return !first;
  };

  // ── CUPÓN ──────────────────────────────────────────────
  const [couponCodeInput, setCouponCodeInput] = useState('');
  const [couponStatus, setCouponStatus] = useState<{ applied: boolean; discountedPrice?: number; error?: string }>({ applied: false });
  const [couponLoading, setCouponLoading] = useState(false);

  // Al cambiar de campamento se limpian el cupón y los avisos
  useEffect(() => {
    setCouponStatus({ applied: false });
    setShowAllCourses(false);
    setShowAllChamps(false);
    clearErr('birthDate');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [camp?.id]);

  const handleApplyCoupon = async (codeToTest?: string) => {
    if (couponLoading) return;
    const code = (codeToTest ?? couponCodeInput).trim().toUpperCase();
    if (codeToTest !== undefined) setCouponCodeInput(code);
    if (!code) {
      setCouponStatus({ applied: false, error: 'Ingresa un código de cupón.' });
      return;
    }
    setCouponLoading(true);
    setCouponStatus({ applied: false });
    try {
      // La validación la hace el servidor (precio, regional y tamaño de delegación)
      const result = await validateGroupCoupon(code, 35, regionalName, camp);
      setCouponStatus(
        result.valid
          ? { applied: true, discountedPrice: result.discountedPricePerPerson }
          : { applied: false, error: result.error || 'Cupón no válido.' }
      );
    } finally {
      setCouponLoading(false);
    }
  };

  // ── PASO 3: PAGO ───────────────────────────────────────
  // paymentSettings llega de la API: mientras es null se muestra un esqueleto en el paso de pago
  const methodOptions = paymentSettings
    ? (
        [
          { id: 'qr_bank' as const, cfg: paymentSettings.qr },
          { id: 'transfer' as const, cfg: paymentSettings.transfer },
          { id: 'cash_box' as const, cfg: paymentSettings.cash },
        ] as const
      ).filter((m) => m.cfg.enabled)
    : [];
  const activeAccounts = paymentSettings?.transfer.accounts.filter((a) => a.isActive) ?? [];
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethodId>(methodOptions[0]?.id || 'cash_box');
  useEffect(() => {
    if (!methodOptions.some((m) => m.id === paymentMethod) && methodOptions[0]) setPaymentMethod(methodOptions[0].id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paymentSettings]);
  // QR sin pasarela automática: el joven sube su comprobante y tesorería lo verifica
  const qrManual = !paymentSettings?.qr.autoConfirm;
  const needsVoucher = paymentMethod === 'transfer' || (paymentMethod === 'qr_bank' && qrManual);
  const voucherRequired = paymentMethod === 'transfer' ? paymentSettings?.transfer.requireVoucher ?? true : true;
  const referenceRequired = paymentMethod === 'transfer' ? paymentSettings?.transfer.requireReference ?? false : false;
  const [paymentQrDataUrl, setPaymentQrDataUrl] = useState('');
  const [webhookReceived, setWebhookReceived] = useState(false);
  const [webhookPayloadData, setWebhookPayloadData] = useState<{
    banco: string;
    transaccionId: string;
    monto: number;
    hora: string;
    authCode: string;
  } | null>(null);
  const [transferVoucherFile, setTransferVoucherFile] = useState<File | null>(null);
  const [transferVoucherPreview, setTransferVoucherPreview] = useState('');
  const [transferReference, setTransferReference] = useState('');
  const [copiedField, setCopiedField] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const regularFee = camp?.price || 0;
  const couponFee = couponStatus.applied ? couponStatus.discountedPrice ?? regularFee : regularFee;
  // En caja no aplica ningún descuento
  const totalToPay = paymentMethod === 'cash_box' ? regularFee : couponFee;
  const cashAdvanceAmount = paymentSettings?.cash.allowAdvance ? Math.ceil((regularFee * (camp?.cashAdvancePercent ?? 30)) / 100) : 0;
  const cashRemainingAmount = regularFee - cashAdvanceAmount;

  const simulateWebhook = () => {
    setWebhookPayloadData({
      banco: 'Banco Nacional de Bolivia · QR Simple',
      transaccionId: `TRX-${Date.now().toString().slice(-6)}`,
      monto: totalToPay,
      hora: new Date().toLocaleTimeString(),
      authCode: `AUTH-BNB-${Math.floor(100000 + Math.random() * 900000)}`,
    });
    setWebhookReceived(true);
    confetti({ particleCount: 80, spread: 70, origin: { y: 0.5 }, colors: ['#0284C7', '#10B981', '#F59E0B'] });
  };

  useEffect(() => {
    if (step === 3 && paymentMethod === 'qr_bank') {
      const fullName = `${firstName} ${paternalLastName} ${maternalLastName}`.trim();
      const payload = `CJN-PAGO|CAMP:${camp?.id}|REGIONAL:${regionalName}|MONTO:${totalToPay}BS|PAGADOR:${fullName}|FOLIO:${Date.now()}`;
      generateQrDataUrl(payload, '#0284C7').then(setPaymentQrDataUrl);
      setWebhookReceived(false);
      setWebhookPayloadData(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, paymentMethod, totalToPay, camp?.id]);

  useEffect(() => {
    if (step === 3 && paymentMethod === 'qr_bank' && !qrManual && !webhookReceived) {
      const timer = setTimeout(simulateWebhook, 9000);
      return () => clearTimeout(timer);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, paymentMethod, webhookReceived]);

  const copyToClipboard = (text: string, field: string) => {
    navigator.clipboard?.writeText(text).then(() => {
      setCopiedField(field);
      setTimeout(() => setCopiedField(''), 2000);
    });
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setErrors((prev) => ({ ...prev, voucher: 'El comprobante debe ser una imagen (JPG o PNG).' }));
      return;
    }
    if (file.size > MAX_VOUCHER_BYTES) {
      setErrors((prev) => ({ ...prev, voucher: 'La imagen supera 1,5 MB. Comprímela o toma una captura más liviana.' }));
      return;
    }
    clearErr('voucher');
    setTransferVoucherFile(file);
    const reader = new FileReader();
    reader.onload = (ev) => setTransferVoucherPreview(ev.target?.result as string);
    reader.readAsDataURL(file);
  };

  const canProceedPayment = () => {
    if (!paymentSettings || !methodOptions.some((m) => m.id === paymentMethod)) return false;
    if (needsVoucher) {
      return (!voucherRequired || !!transferVoucherFile) && (!referenceRequired || !!transferReference.trim());
    }
    if (paymentMethod === 'qr_bank') return webhookReceived;
    return true;
  };

  // ── ENVÍO: cuenta + inscripción en un solo paso ────────
  const [completedCamper, setCompletedCamper] = useState<CamperRegistration | null>(null);
  const [createdAccountEmail, setCreatedAccountEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');

  const handleSubmitError = (e: unknown) => {
    if (!isApiError(e)) {
      setSubmitError(errorMessage(e));
      toastError(e);
      return;
    }
    const mapped: Record<string, string> = {};
    Object.entries(e.errors || {}).forEach(([k, v]) => {
      mapped[k === 'age' ? 'birthDate' : k === 'confirm' ? 'confirmPassword' : k] = v;
    });
    // Errores del cupón (422 con { code })
    if (mapped.code) {
      setCouponStatus({ applied: false, error: mapped.code });
      delete mapped.code;
    }
    const emailTaken = e.status === 409 && !!mapped.email;
    if (emailTaken) setEmailExists(true);
    setErrors((prev) => ({ ...prev, ...mapped }));

    const step2Key = STEP2_FIELDS.find((k) => mapped[k]);
    if (step2Key) {
      setSubmitError('');
      goTo(2);
      focusField(emailTaken ? 'email-exists' : step2Key);
      toast({
        type: 'warning',
        title: emailTaken ? 'Ya tienes una cuenta' : 'Revisa tus datos',
        message: emailTaken ? 'Inicia sesión con ese correo y continúa: lo que escribiste se mantiene.' : e.message,
      });
      return;
    }
    // Errores del pago (voucher / reference / paymentMethod) o generales (409 ya inscrito, 413, 429…)
    setSubmitError(errorMessage(e));
    if (e.status === 409) refreshData().catch(() => undefined);
  };

  const handleCompleteRegistration = async () => {
    if (!camp || !canProceedPayment() || isSubmitting || existingReg) return;
    if (!validateData()) {
      goTo(2);
      return;
    }
    const isCash = paymentMethod === 'cash_box';
    // Montos, tribu, código de entrada y estado los calcula el servidor: solo se envían los datos y el método
    const payment: NewRegistrationPayload['payment'] = { method: paymentMethod };
    if (!isCash && couponStatus.applied && couponCodeInput.trim()) payment.couponCode = couponCodeInput.trim().toUpperCase();
    if (needsVoucher) {
      if (transferVoucherPreview) {
        payment.voucherImageUrl = transferVoucherPreview;
        payment.voucherFileName = transferVoucherFile?.name;
      }
      if (transferReference.trim()) payment.voucherReferenceNumber = transferReference.trim();
    }
    if (paymentMethod === 'qr_bank' && !qrManual && webhookReceived) payment.gatewayConfirmed = true;

    const docDigits = documentNumber.trim();
    const payload: NewRegistrationPayload = {
      campId: camp.id,
      firstName: firstName.trim(),
      paternalLastName: paternalLastName.trim(),
      maternalLastName: maternalLastName.trim(),
      birthDate,
      age,
      gender: gender as Gender,
      documentId: `${docDigits}-${idExpedition}`,
      idExpedition,
      phone: `+591 ${phone}`,
      city: cityName,
      regional: regionalName,
      subdirectivaNumber: subName,
      churchCongregation: churchCongregation.trim(),
      serviceAreaOfInterest,
      emergencyContactName: emergencyContactName.trim(),
      emergencyPhone: emergencyPhone.trim(),
      // Talleres y campeonatos NO se eligen al comprar: se habilitan cuando el pago está confirmado
      enrolledCourseIds: [],
      enrolledChampionshipIds: [],
      payment,
    };
    if (!isAuthenticated) {
      payload.account = { email: accountEmail.trim().toLowerCase(), password, acceptTerms };
    }

    setSubmitError('');
    setIsSubmitting(true);
    try {
      // Se llama al servicio directamente para recibir los errores por campo (422 / 409) y marcarlos en el formulario
      const res = await registrationsApi.enroll(payload);
      justEnrolled.current = true;
      setCompletedCamper(res.registration);
      if (res.user && res.tokens) {
        // Compra sin sesión: el servidor creó la cuenta → se abre la sesión (las inscripciones se recargan solas)
        setCreatedAccountEmail(res.user.email);
        applySession(res.user, res.tokens);
      } else {
        refreshData().catch(() => undefined);
      }
      setPassword('');
      setConfirmPassword('');
      goTo(4);
      const end = Date.now() + 900;
      const colors = ['#0284C7', '#10B981', '#F59E0B', '#8B5CF6', '#EC4899'];
      (function frame() {
        confetti({ particleCount: 6, angle: 60, spread: 60, origin: { x: 0 }, colors });
        confetti({ particleCount: 6, angle: 120, spread: 60, origin: { x: 1 }, colors });
        if (Date.now() < end) requestAnimationFrame(frame);
      })();
    } catch (e) {
      handleSubmitError(e);
    } finally {
      setIsSubmitting(false);
    }
  };

  const goToMyCamp = (reg: CamperRegistration) => setActiveTab('registration-detail', { id: reg.id });

  // =========================================================
  // RENDER
  // =========================================================
  const voucherBlock = (
    <div className="space-y-4">
      <button
        type="button"
        id="enr-voucher"
        onClick={() => fileInputRef.current?.click()}
        className={`w-full rounded-2xl border-2 border-dashed p-6 text-center cursor-pointer transition-all ${
          errors.voucher
            ? 'border-red-300 bg-red-50/50'
            : transferVoucherPreview
            ? 'border-indigo-400 bg-indigo-50'
            : 'border-slate-200 hover:border-indigo-300 hover:bg-indigo-50/50'
        }`}
      >
        {transferVoucherPreview ? (
          <span className="block space-y-2">
            <img src={transferVoucherPreview} alt="Comprobante" className="max-h-32 mx-auto rounded-xl object-contain" />
            <span className="block text-xs text-indigo-700 font-bold break-all">{transferVoucherFile?.name}</span>
            <span className="block text-[11px] text-indigo-500">Toca para cambiar la imagen</span>
          </span>
        ) : (
          <span className="block space-y-2">
            <Upload className="w-7 h-7 text-slate-400 mx-auto" />
            <span className="block text-sm font-bold text-slate-600">
              Sube la foto de tu comprobante{voucherRequired ? '' : ' (opcional)'}
            </span>
            <span className="block text-xs text-slate-400">JPG o PNG · máx. 1,5 MB</span>
          </span>
        )}
      </button>
      {errors.voucher && (
        <p className="text-[11px] text-red-600 font-semibold flex items-center gap-1 -mt-2">
          <AlertCircle className="w-3 h-3 shrink-0" /> {errors.voucher}
        </p>
      )}
      <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileChange} className="hidden" />
      <Field label="Número de referencia de la transacción" required={referenceRequired} htmlFor="enr-reference" error={errors.reference}>
        <Input
          id="enr-reference"
          value={transferReference}
          onChange={(e) => {
            setTransferReference(e.target.value);
            clearErr('reference');
          }}
          error={errors.reference}
          placeholder="ej. 20261016-123456"
        />
      </Field>
    </div>
  );

  const existingRegBanner = existingReg && step < 4 && (
    <div className="mt-4 p-4 rounded-2xl bg-emerald-50 border border-emerald-200 flex flex-col sm:flex-row sm:items-center gap-3 animate-fade-in">
      <CheckCircle2 className="w-6 h-6 text-emerald-600 shrink-0" />
      <div className="flex-1 text-sm text-emerald-900">
        <strong className="block">Ya estás inscrito en este campamento.</strong>
        Tu código de entrada es <span className="font-mono font-bold">{existingReg.ticketCode}</span>. Desde «Mi campamento» eliges tus
        talleres y campeonatos.
      </div>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setSelectedCamperForBadge(existingReg)}
          className="px-3.5 py-2.5 rounded-xl bg-white border border-emerald-200 text-emerald-700 text-xs font-black cursor-pointer"
        >
          Credencial
        </button>
        <button
          type="button"
          onClick={() => goToMyCamp(existingReg)}
          className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black cursor-pointer inline-flex items-center gap-1.5"
        >
          Mi campamento <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );

  const buyerBanner = isAuthenticated ? (
    <div className="flex items-center gap-3 p-3 rounded-2xl bg-sky-50 border border-sky-100">
      <span className="w-9 h-9 rounded-xl bg-sky-600 text-white flex items-center justify-center shrink-0">
        <UserCheck className="w-4 h-4" />
      </span>
      <div className="min-w-0 text-xs text-sky-900">
        <span className="block text-[10px] font-black uppercase tracking-wider text-sky-500">Comprando como</span>
        <span className="font-bold break-all">{currentUser?.email}</span>
      </div>
    </div>
  ) : null;

  const renderCoursePreview = (course: CampCourse) => {
    const highlighted = course.id === initialCourseId;
    const full = course.enrolledCount >= course.maxCapacity;
    return (
      <li
        key={course.id}
        className={`flex items-center gap-3 p-2.5 rounded-2xl border ${
          highlighted ? 'border-violet-300 bg-violet-50 ring-2 ring-violet-100' : 'border-slate-100 bg-white'
        }`}
      >
        {course.coverImageUrl ? (
          <img src={course.coverImageUrl} alt="" className="w-11 h-11 rounded-xl object-cover shrink-0" />
        ) : (
          <span className="w-11 h-11 rounded-xl bg-violet-100 text-violet-600 flex items-center justify-center shrink-0">
            <BookOpen className="w-5 h-5" />
          </span>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-black text-slate-900 truncate">{course.title}</span>
            {highlighted && (
              <span className="shrink-0 px-1.5 py-0.5 rounded-md bg-violet-600 text-white text-[9px] font-black uppercase">Te interesa</span>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[10px] text-slate-500 font-semibold mt-0.5">
            <span className="inline-flex items-center gap-1">
              {course.fullDay ? <Sun className="w-3 h-3 text-amber-500" /> : <Clock className="w-3 h-3" />}
              {formatCourseScheduleShort(course)}
            </span>
            <span className="truncate">{course.instructor}</span>
            {full && <span className="text-red-600 font-bold">Completo</span>}
          </div>
        </div>
      </li>
    );
  };

  const renderChampPreview = (ch: Championship) => {
    const highlighted = ch.id === initialChampionshipId;
    return (
      <li
        key={ch.id}
        className={`flex items-center gap-3 p-2.5 rounded-2xl border ${
          highlighted ? 'border-amber-300 bg-amber-50 ring-2 ring-amber-100' : 'border-slate-100 bg-white'
        }`}
      >
        <span className="w-11 h-11 rounded-xl bg-amber-100 text-amber-600 flex items-center justify-center shrink-0">
          {ch.mode === 'team' ? <Users className="w-5 h-5" /> : <Trophy className="w-5 h-5" />}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-black text-slate-900 truncate">{ch.name}</span>
            {highlighted && (
              <span className="shrink-0 px-1.5 py-0.5 rounded-md bg-amber-500 text-white text-[9px] font-black uppercase">Te interesa</span>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[10px] text-slate-500 font-semibold mt-0.5">
            <span>{ch.genderCategory}</span>
            <span>· {champModeLabel(ch)}</span>
            <span className={ch.registrationFee ? 'text-amber-700' : 'text-emerald-700'}>· {champFeeLabel(ch)}</span>
          </div>
        </div>
      </li>
    );
  };

  const PREVIEW_LIMIT = 4;

  return (
    <div className="min-h-screen bg-gradient-to-b from-sky-50 via-white to-slate-50 px-4 sm:px-6 lg:px-8 py-8">
      <div className="max-w-3xl mx-auto">
        <div className="text-center mb-2 animate-fade-in-up">
          <span className="text-[11px] font-black uppercase tracking-widest text-[#0284C7]">Inscripción en línea</span>
          <h1 className="text-2xl sm:text-3xl font-black font-display text-slate-900 mt-1">{camp ? camp.name : 'Elige tu campamento'}</h1>
        </div>

        <StepIndicator currentStep={step} />

        {existingRegBanner}

        {/* ── PASO 1: CAMPAMENTO ─────────────────────────── */}
        {step === 1 && (
          <StepCard title="Paso 1: Tu campamento" subtitle="Confirma a qué campamento te inscribes" icon={Tent} gradient="from-sky-500 to-blue-600">
            {camp ? (
              <div className="rounded-3xl overflow-hidden border border-slate-100">
                <div className="relative h-44 sm:h-52">
                  <img src={camp.imageUrl} alt={camp.name} className="w-full h-full object-cover" />
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-950/90 via-slate-950/20 to-transparent" />
                  {phase && (
                    <span
                      className={`absolute top-3 right-3 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold border ${PHASE_META[phase].className}`}
                    >
                      <span className={`w-1.5 h-1.5 rounded-full ${PHASE_META[phase].dot}`} />
                      {PHASE_META[phase].label}
                    </span>
                  )}
                  <div className="absolute bottom-4 left-5 right-5 text-white">
                    {camp.theme && <div className="text-[11px] font-bold text-amber-300 uppercase tracking-widest">“{camp.theme}”</div>}
                    <h3 className="text-xl font-black font-display leading-tight">{camp.name}</h3>
                  </div>
                </div>
                <div className="p-5 grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                  <div className="flex items-center gap-2 text-slate-700 font-semibold">
                    <CalendarDays className="w-4 h-4 text-[#0284C7] shrink-0" />
                    {formatDateRange(camp.startDate, camp.endDate)}
                  </div>
                  <div className="flex items-center gap-2 text-slate-700 font-semibold min-w-0">
                    <MapPin className="w-4 h-4 text-[#0284C7] shrink-0" />
                    <span className="truncate">{camp.location}</span>
                  </div>
                  <div className="flex items-center gap-2 text-slate-700 font-semibold">
                    <User className="w-4 h-4 text-[#0284C7] shrink-0" />
                    {camp.minAge} a {camp.maxAge} años
                  </div>
                  <p className="sm:col-span-3 text-slate-600 leading-relaxed">{camp.description}</p>
                  {camp.includes.length > 0 && (
                    <div className="sm:col-span-3 flex flex-wrap gap-1.5">
                      {camp.includes.map((inc) => (
                        <span
                          key={inc}
                          className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-emerald-50 text-emerald-800 font-semibold border border-emerald-100"
                        >
                          <Check className="w-3 h-3" /> {inc}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <p className="text-sm text-slate-500">No hay un campamento seleccionado.</p>
            )}

            {enrollableCamps.length > 1 && (
              <Field label="¿Quieres inscribirte a otro campamento?" htmlFor="enr-camp">
                <div className="relative">
                  <Tent className="w-4 h-4 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <Select id="enr-camp" value={camp?.id || ''} onChange={(e) => setSelectedCampId(e.target.value)} className="pl-11">
                    {camp && !enrollableCamps.some((c) => c.id === camp.id) && <option value={camp.id}>{camp.name}</option>}
                    {enrollableCamps.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.isFeatured ? '★ ' : ''}
                        {c.name} · {formatDateRange(c.startDate, c.endDate)} · {c.price} Bs
                      </option>
                    ))}
                  </Select>
                </div>
              </Field>
            )}

            {/* Vista previa de talleres y campeonatos (solo lectura) */}
            {camp && (campCourses.length > 0 || campChamps.length > 0) && (
              <div className="space-y-4">
                <div className="flex items-start gap-2.5 p-3.5 rounded-2xl bg-violet-50 border border-violet-100 text-xs text-violet-900">
                  <Info className="w-4 h-4 text-violet-600 shrink-0 mt-px" />
                  <p className="leading-relaxed">
                    <strong>Los talleres y campeonatos los eliges después de confirmar tu pago, desde Mi campamento.</strong> Aquí
                    puedes ver lo que te espera.
                  </p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  {campCourses.length > 0 && (
                    <div className="space-y-2.5">
                      <SectionTitle
                        icon={BookOpen}
                        tone="violet"
                        title={`Talleres (${campCourses.length})`}
                        subtitle={`Hasta ${camp.maxCoursesPerCamper} por joven · incluidos`}
                      />
                      <ul className="space-y-2">
                        {(showAllCourses ? coursesPreview : coursesPreview.slice(0, PREVIEW_LIMIT)).map(renderCoursePreview)}
                      </ul>
                      {campCourses.length > PREVIEW_LIMIT && (
                        <button
                          type="button"
                          onClick={() => setShowAllCourses((v) => !v)}
                          className="text-[11px] font-black text-violet-700 hover:underline inline-flex items-center gap-1 cursor-pointer"
                        >
                          {showAllCourses ? (
                            <>
                              Ver menos <ChevronUp className="w-3.5 h-3.5" />
                            </>
                          ) : (
                            <>
                              Ver los {campCourses.length} talleres <ChevronDown className="w-3.5 h-3.5" />
                            </>
                          )}
                        </button>
                      )}
                    </div>
                  )}
                  {campChamps.length > 0 && (
                    <div className="space-y-2.5">
                      <SectionTitle
                        icon={Trophy}
                        tone="amber"
                        title={`Campeonatos (${campChamps.length})`}
                        subtitle="Opcionales · algunos tienen un costo extra"
                      />
                      <ul className="space-y-2">
                        {(showAllChamps ? champsPreview : champsPreview.slice(0, PREVIEW_LIMIT)).map(renderChampPreview)}
                      </ul>
                      {campChamps.length > PREVIEW_LIMIT && (
                        <button
                          type="button"
                          onClick={() => setShowAllChamps((v) => !v)}
                          className="text-[11px] font-black text-amber-700 hover:underline inline-flex items-center gap-1 cursor-pointer"
                        >
                          {showAllChamps ? (
                            <>
                              Ver menos <ChevronUp className="w-3.5 h-3.5" />
                            </>
                          ) : (
                            <>
                              Ver los {campChamps.length} campeonatos <ChevronDown className="w-3.5 h-3.5" />
                            </>
                          )}
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}

            {!existingReg && camp && !isCampEnrollable(camp) && (
              <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-sm text-amber-900 flex items-start gap-2">
                <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
                Las inscripciones para este campamento no están disponibles. Elige otro campamento abierto.
              </div>
            )}

            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t border-slate-100">
              <div className="text-center sm:text-left">
                <span className="text-xs text-slate-500">Inversión</span>
                <div className="text-3xl font-black font-mono text-sky-600">{regularFee} Bs</div>
                {camp?.groupPrice !== undefined && (
                  <span className="text-[11px] text-amber-700 font-semibold">{camp.groupPrice} Bs con cupón de delegación</span>
                )}
              </div>
              <button
                type="button"
                disabled={!camp || !!existingReg || !isCampEnrollable(camp)}
                onClick={() => goTo(2)}
                className="w-full sm:w-auto px-8 py-4 bg-gradient-to-r from-sky-500 to-blue-600 text-white font-black text-sm rounded-2xl shadow-lg flex items-center justify-center gap-2 active:scale-95 cursor-pointer disabled:from-slate-200 disabled:to-slate-200 disabled:text-slate-400 disabled:shadow-none disabled:cursor-not-allowed"
              >
                Continuar <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </StepCard>
        )}

        {/* ── PASO 2: DATOS ──────────────────────────────── */}
        {step === 2 && (
          <StepCard
            title="Paso 2: Tus datos"
            subtitle={isAuthenticated ? 'Revisa y completa tu información' : 'Tus datos y tu cuenta, en un solo paso'}
            icon={User}
            gradient="from-sky-500 to-blue-600"
            onBack={() => goTo(1)}
          >
            {isAuthenticated ? (
              buyerBanner
            ) : (
              <div className="flex flex-col sm:flex-row sm:items-center gap-3 p-3.5 rounded-2xl bg-sky-50 border border-sky-100 text-xs text-sky-900">
                <Sparkles className="w-5 h-5 text-sky-600 shrink-0" />
                <p className="flex-1 leading-relaxed">
                  <strong>No necesitas registrarte antes.</strong> Con estos datos creamos tu cuenta al confirmar la inscripción.
                </p>
                <button
                  type="button"
                  onClick={() => requireLogin('login')}
                  className="self-start sm:self-auto inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white border border-sky-200 text-sky-700 font-black cursor-pointer hover:bg-sky-100"
                >
                  <LogIn className="w-3.5 h-3.5" /> Ya tengo cuenta
                </button>
              </div>
            )}

            {/* Datos personales */}
            <div className="space-y-4">
              <SectionTitle icon={User} title="Datos personales" subtitle="Tal como figuran en tu carnet" />
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <Field label="Nombres" required error={errors.firstName} htmlFor="enr-firstName">
                  <Input
                    id="enr-firstName"
                    autoComplete="given-name"
                    value={firstName}
                    onChange={(e) => {
                      setFirstName(e.target.value);
                      clearErr('firstName');
                    }}
                    error={errors.firstName}
                    placeholder="Carlos Daniel"
                  />
                </Field>
                <Field label="Apellido paterno" required error={errors.paternalLastName} htmlFor="enr-paternalLastName">
                  <Input
                    id="enr-paternalLastName"
                    autoComplete="family-name"
                    value={paternalLastName}
                    onChange={(e) => {
                      setPaternalLastName(e.target.value);
                      clearErr('paternalLastName');
                    }}
                    error={errors.paternalLastName}
                    placeholder="Condori"
                  />
                </Field>
                <Field label="Apellido materno" htmlFor="enr-maternalLastName">
                  <Input
                    id="enr-maternalLastName"
                    value={maternalLastName}
                    onChange={(e) => setMaternalLastName(e.target.value)}
                    placeholder="Flores"
                  />
                </Field>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="sm:col-span-2">
                  <Field label="Cédula de identidad (CI)" required error={errors.documentId} htmlFor="enr-documentId">
                    <Input
                      id="enr-documentId"
                      inputMode="numeric"
                      value={documentNumber}
                      onChange={(e) => {
                        setDocumentNumber(e.target.value.replace(/[^\dA-Za-z]/g, '').slice(0, 15));
                        clearErr('documentId');
                      }}
                      error={errors.documentId}
                      placeholder="ej. 7182904"
                    />
                  </Field>
                </div>
                <Field label="Expedido en" htmlFor="enr-idExpedition">
                  <Select id="enr-idExpedition" value={idExpedition} onChange={(e) => setIdExpedition(e.target.value)}>
                    {CI_EXPEDICIONES.map((d) => (
                      <option key={d.code} value={d.code}>
                        {d.code} — {d.name}
                      </option>
                    ))}
                  </Select>
                </Field>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field
                  label="Fecha de nacimiento"
                  required
                  error={errors.birthDate}
                  htmlFor="enr-birthDate"
                  hint={age ? `Tienes ${age} años` : camp ? `Para jóvenes de ${camp.minAge} a ${camp.maxAge} años` : undefined}
                >
                  <Input
                    id="enr-birthDate"
                    type="date"
                    autoComplete="bday"
                    value={birthDate}
                    max={new Date().toISOString().slice(0, 10)}
                    onChange={(e) => {
                      setBirthDate(e.target.value);
                      clearErr('birthDate');
                    }}
                    error={errors.birthDate}
                  />
                </Field>
                <Field
                  label="Sexo"
                  required
                  error={errors.gender}
                  htmlFor="enr-gender"
                  hint="Para las categorías Varonil y Femenil de los campeonatos"
                >
                  <div
                    id="enr-gender"
                    role="radiogroup"
                    aria-label="Sexo"
                    aria-invalid={errors.gender ? true : undefined}
                    tabIndex={-1}
                    className={`grid grid-cols-2 gap-1 p-1 rounded-2xl border outline-none ${
                      errors.gender ? 'border-red-300 bg-red-50/40' : 'border-slate-200 bg-slate-50'
                    }`}
                  >
                    {(
                      [
                        { v: 'M', label: 'Varón', active: 'bg-sky-600 text-white shadow' },
                        { v: 'F', label: 'Mujer', active: 'bg-pink-500 text-white shadow' },
                      ] as const
                    ).map((o) => (
                      <button
                        key={o.v}
                        type="button"
                        role="radio"
                        aria-checked={gender === o.v}
                        onClick={() => {
                          setGender(o.v);
                          clearErr('gender');
                        }}
                        className={`py-2.5 rounded-xl text-sm font-black transition-all cursor-pointer ${
                          gender === o.v ? o.active : 'text-slate-600 hover:bg-white'
                        }`}
                      >
                        {o.label}
                      </button>
                    ))}
                  </div>
                </Field>
              </div>

              <Field label="WhatsApp" required error={errors.phone} htmlFor="enr-phone" hint="Te avisaremos aquí cuando se confirme tu pago">
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-mono text-xs font-bold pointer-events-none">+591</span>
                  <Input
                    id="enr-phone"
                    type="tel"
                    inputMode="numeric"
                    autoComplete="tel-national"
                    value={phone}
                    onChange={(e) => {
                      setPhone(localPhone(e.target.value));
                      clearErr('phone');
                    }}
                    error={errors.phone}
                    className="pl-14"
                    placeholder="76249155"
                  />
                </div>
              </Field>
            </div>

            {/* Ubicación */}
            <div className="bg-gradient-to-br from-sky-50 to-blue-50 rounded-3xl border border-sky-100 p-4 sm:p-5 space-y-4">
              <SectionTitle icon={MapPin} title="Ciudad, sub-directiva y regional" />
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <Field label="Ciudad" required htmlFor="enr-city">
                  <Select
                    id="enr-city"
                    value={cityId}
                    onChange={(e) => {
                      locationTouched.current = true;
                      setCityId(e.target.value);
                      clearErr('regional');
                    }}
                  >
                    {catalogs.cities.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="Sub-directiva" required htmlFor="enr-sub">
                  <Select
                    id="enr-sub"
                    value={subId}
                    onChange={(e) => {
                      locationTouched.current = true;
                      setSubId(e.target.value);
                      clearErr('regional');
                    }}
                  >
                    {subsForCity.length === 0 && <option value="">Sin sub-directivas</option>}
                    {subsForCity.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="Regional" required error={errors.regional} htmlFor="enr-regional">
                  <Select
                    id="enr-regional"
                    value={regionalId}
                    onChange={(e) => {
                      locationTouched.current = true;
                      setRegionalId(e.target.value);
                      clearErr('regional');
                    }}
                    error={errors.regional}
                  >
                    {regsForSub.length === 0 && <option value="">Sin regionales</option>}
                    {regsForSub.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.name}
                      </option>
                    ))}
                  </Select>
                </Field>
              </div>
            </div>

            {/* Iglesia y área */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Iglesia / congregación" htmlFor="enr-church">
                <div className="relative">
                  <Church className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                  <Input
                    id="enr-church"
                    value={churchCongregation}
                    onChange={(e) => setChurchCongregation(e.target.value)}
                    className="pl-10"
                    placeholder="Iglesia Central UCE"
                  />
                </div>
              </Field>
              <Field label="Área de servicio" htmlFor="enr-area">
                <Select id="enr-area" value={serviceAreaOfInterest} onChange={(e) => setServiceAreaOfInterest(e.target.value)}>
                  {catalogs.serviceAreas.map((a) => (
                    <option key={a.id} value={a.name}>
                      {a.name}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>

            {/* Emergencia */}
            <div className="space-y-4">
              <SectionTitle icon={Phone} tone="amber" title="Contacto de emergencia" subtitle="Alguien a quien llamar si lo necesitas" />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field label="Nombre del contacto" htmlFor="enr-emergencyName">
                  <Input
                    id="enr-emergencyName"
                    value={emergencyContactName}
                    onChange={(e) => setEmergencyContactName(e.target.value)}
                    placeholder="ej. María Flores (mamá)"
                  />
                </Field>
                <Field label="WhatsApp de emergencia" htmlFor="enr-emergencyPhone">
                  <Input
                    id="enr-emergencyPhone"
                    type="tel"
                    inputMode="numeric"
                    value={emergencyPhone}
                    onChange={(e) => setEmergencyPhone(e.target.value.replace(/[^\d+ ]/g, '').slice(0, 16))}
                    placeholder="76249155"
                  />
                </Field>
              </div>
            </div>

            {/* Cuenta nueva (solo sin sesión) */}
            {!isAuthenticated && (
              <div className="rounded-3xl border border-violet-100 bg-gradient-to-br from-violet-50/80 to-white p-4 sm:p-5 space-y-4">
                <SectionTitle
                  icon={KeyRound}
                  tone="violet"
                  title="Tu cuenta"
                  subtitle="Con ella entras a «Mi campamento» para elegir talleres, campeonatos y ver tu credencial"
                />

                {emailExists && (
                  <div
                    id="enr-email-exists"
                    tabIndex={-1}
                    role="alert"
                    className="p-3.5 rounded-2xl bg-amber-50 border border-amber-200 flex flex-col sm:flex-row sm:items-center gap-3 outline-none animate-fade-in"
                  >
                    <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
                    <p className="flex-1 text-xs text-amber-900 leading-relaxed">
                      <strong className="block">Ya existe una cuenta con {accountEmail.trim() || 'este correo'}.</strong>
                      Inicia sesión y continúa con tu inscripción: lo que escribiste se mantiene.
                    </p>
                    <button
                      type="button"
                      onClick={() => requireLogin('login')}
                      className="self-start sm:self-auto inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-xs font-black cursor-pointer"
                    >
                      <LogIn className="w-3.5 h-3.5" /> Iniciar sesión
                    </button>
                  </div>
                )}

                <Field label="Correo electrónico" required error={errors.email} htmlFor="enr-email">
                  <div className="relative">
                    <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <Input
                      id="enr-email"
                      type="email"
                      autoComplete="email"
                      value={accountEmail}
                      onChange={(e) => {
                        setAccountEmail(e.target.value);
                        setEmailExists(false);
                        clearErr('email');
                      }}
                      error={errors.email}
                      className="pl-10"
                      placeholder="tucorreo@ejemplo.com"
                    />
                  </div>
                </Field>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Field label="Contraseña" required error={errors.password} htmlFor="enr-password">
                    <PasswordInput
                      id="enr-password"
                      autoComplete="new-password"
                      value={password}
                      invalid={!!errors.password}
                      onChange={(e) => {
                        setPassword(e.target.value);
                        clearErr('password');
                      }}
                      placeholder="Mínimo 8 caracteres"
                    />
                  </Field>
                  <Field label="Confirmar contraseña" required error={errors.confirmPassword} htmlFor="enr-confirmPassword">
                    <PasswordInput
                      id="enr-confirmPassword"
                      autoComplete="new-password"
                      value={confirmPassword}
                      invalid={!!errors.confirmPassword}
                      onChange={(e) => {
                        setConfirmPassword(e.target.value);
                        clearErr('confirmPassword');
                      }}
                      placeholder="Repite tu contraseña"
                    />
                  </Field>
                </div>
                {(password || errors.password) && (
                  <PasswordChecklist password={password} email={accountEmail} confirm={confirmPassword} showConfirm />
                )}

                <div className="space-y-1">
                  <label
                    htmlFor="enr-acceptTerms"
                    className={`flex items-start gap-3 p-3 rounded-2xl border cursor-pointer transition-colors ${
                      errors.acceptTerms ? 'border-red-300 bg-red-50/50' : acceptTerms ? 'border-emerald-200 bg-emerald-50/60' : 'border-slate-200 bg-white'
                    }`}
                  >
                    <input
                      id="enr-acceptTerms"
                      type="checkbox"
                      checked={acceptTerms}
                      onChange={(e) => {
                        setAcceptTerms(e.target.checked);
                        clearErr('acceptTerms');
                      }}
                      className="mt-0.5 w-4 h-4 accent-sky-600 cursor-pointer shrink-0"
                    />
                    <span className="text-xs text-slate-700 leading-relaxed">
                      Acepto los términos del campamento y el uso de mis datos por el Comité Juvenil para organizar mi inscripción y
                      comunicarme novedades.
                    </span>
                  </label>
                  {errors.acceptTerms && (
                    <p className="text-[11px] text-red-600 font-semibold flex items-center gap-1">
                      <AlertCircle className="w-3 h-3 shrink-0" /> {errors.acceptTerms}
                    </p>
                  )}
                </div>

                <p className="text-xs text-slate-500 text-center">
                  ¿Ya tienes cuenta?{' '}
                  <button type="button" onClick={() => requireLogin('login')} className="font-black text-[#0284C7] hover:underline cursor-pointer">
                    Inicia sesión
                  </button>
                </p>
              </div>
            )}

            <div className="flex flex-col-reverse sm:flex-row sm:items-center justify-between gap-3 pt-4 border-t border-slate-100">
              <button
                type="button"
                onClick={() => goTo(1)}
                className="w-full sm:w-auto px-5 py-3 rounded-2xl text-sm font-bold text-slate-600 hover:bg-slate-100 cursor-pointer inline-flex items-center justify-center gap-1.5"
              >
                <ArrowLeft className="w-4 h-4" /> Volver
              </button>
              <button
                type="button"
                disabled={!!existingReg}
                onClick={() => validateData() && goTo(3)}
                className="w-full sm:w-auto px-8 py-4 bg-gradient-to-r from-sky-500 to-blue-600 text-white font-black text-sm rounded-2xl shadow-lg flex items-center justify-center gap-2 active:scale-95 cursor-pointer disabled:from-slate-200 disabled:to-slate-200 disabled:text-slate-400 disabled:shadow-none disabled:cursor-not-allowed"
              >
                Ir al pago <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </StepCard>
        )}

        {/* ── PASO 3: PAGO ───────────────────────────────── */}
        {step === 3 && camp && !paymentSettings && (
          <div className="mt-4 bg-white rounded-3xl shadow-xl border border-slate-100 p-5 sm:p-8 space-y-4 animate-pulse" aria-busy="true">
            <div className="h-6 w-40 rounded-lg bg-slate-200" />
            <div className="h-24 rounded-2xl bg-slate-100" />
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {[0, 1, 2].map((i) => (
                <div key={i} className="h-28 rounded-2xl bg-slate-100" />
              ))}
            </div>
            <p className="text-xs text-slate-400 text-center">Cargando métodos de pago…</p>
          </div>
        )}

        {step === 3 && camp && paymentSettings && (
          <div className="space-y-4 animate-fade-in-scale mt-4">
            <StepCard title="Paso 3: Pago" subtitle={`Total a pagar: ${totalToPay} Bs`} icon={CreditCard} gradient="from-emerald-500 to-teal-600" onBack={() => goTo(2)}>
              {buyerBanner}

              {/* Resumen */}
              <div className="rounded-2xl bg-slate-50 border border-slate-100 p-4 space-y-2 text-sm">
                <div className="flex justify-between gap-3">
                  <span className="text-slate-600 min-w-0 truncate">{camp.name}</span>
                  <span className="font-mono font-bold shrink-0">{regularFee} Bs</span>
                </div>
                <div className="flex justify-between gap-3 text-xs text-slate-500">
                  <span className="min-w-0 truncate">
                    {`${firstName} ${paternalLastName}`.trim()} · {gender === 'M' ? 'Varón' : gender === 'F' ? 'Mujer' : ''} · {regionalName}
                  </span>
                  <button type="button" onClick={() => goTo(2)} className="shrink-0 font-bold text-[#0284C7] hover:underline cursor-pointer">
                    Editar
                  </button>
                </div>
                {!isAuthenticated && (
                  <div className="flex justify-between gap-3 text-xs text-violet-700">
                    <span className="inline-flex items-center gap-1 min-w-0">
                      <KeyRound className="w-3.5 h-3.5 shrink-0" />
                      <span className="truncate">Cuenta nueva: {accountEmail.trim()}</span>
                    </span>
                    <span className="font-bold shrink-0">Gratis</span>
                  </div>
                )}
                {paymentMethod !== 'cash_box' && couponStatus.applied && (
                  <div className="flex justify-between text-xs text-emerald-700 font-bold">
                    <span>Cupón {couponCodeInput}</span>
                    <span>−{regularFee - couponFee} Bs</span>
                  </div>
                )}
                <div className="flex justify-between pt-2 border-t border-slate-200 font-black">
                  <span>Total</span>
                  <span className="font-mono text-sky-700 text-lg">{totalToPay} Bs</span>
                </div>
                <p className="text-[11px] text-slate-500 flex items-start gap-1.5 pt-1">
                  <Info className="w-3.5 h-3.5 shrink-0 mt-px text-violet-500" />
                  Talleres incluidos: los eliges después de confirmar tu pago. Los campeonatos pueden tener un costo extra.
                </p>
              </div>

              {/* Cupón */}
              {camp.groupPrice !== undefined && (
                <div className="rounded-2xl border border-amber-200 bg-amber-50/60 p-4 space-y-2">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                    <Tag className="w-4 h-4 text-amber-600" />
                    <h3 className="text-sm font-black text-amber-900">Cupón de delegación</h3>
                    <span className="text-[10px] text-amber-700">({camp.groupPrice} Bs por persona · grupos de 35)</span>
                  </div>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      aria-label="Código de cupón"
                      value={couponCodeInput}
                      onChange={(e) => {
                        setCouponCodeInput(e.target.value.toUpperCase());
                        if (couponStatus.applied || couponStatus.error) setCouponStatus({ applied: false });
                      }}
                      placeholder="GRUPO35-NACIONAL"
                      className={`flex-1 min-w-0 px-4 py-2.5 rounded-xl border font-mono text-sm font-bold uppercase outline-none ${
                        couponStatus.applied
                          ? 'border-emerald-400 bg-emerald-50 text-emerald-900'
                          : couponStatus.error
                          ? 'border-red-300 bg-red-50 text-red-900'
                          : 'border-amber-200 bg-white'
                      }`}
                    />
                    <button
                      type="button"
                      onClick={() => handleApplyCoupon()}
                      disabled={couponLoading}
                      className="px-4 py-2.5 bg-amber-500 hover:bg-amber-600 text-white font-black text-xs rounded-xl cursor-pointer inline-flex items-center gap-1.5 disabled:opacity-60 disabled:cursor-wait"
                    >
                      {couponLoading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                      {couponLoading ? 'Validando…' : 'Validar'}
                    </button>
                    {couponStatus.applied && (
                      <button
                        type="button"
                        aria-label="Quitar cupón"
                        onClick={() => setCouponStatus({ applied: false })}
                        className="px-3 rounded-xl bg-white border border-slate-200 cursor-pointer"
                      >
                        <X className="w-4 h-4 text-slate-500" />
                      </button>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-1.5 text-[10px]">
                    <span className="text-amber-700 font-semibold self-center">Probar:</span>
                    {['GRUPO35-NACIONAL', 'GRUPO35-POTOSI'].map((code) => (
                      <button
                        key={code}
                        type="button"
                        onClick={() => handleApplyCoupon(code)}
                        disabled={couponLoading}
                        className="disabled:opacity-50 px-2 py-1 rounded-lg bg-amber-100 hover:bg-amber-200 text-amber-800 font-mono font-bold cursor-pointer"
                      >
                        {code}
                      </button>
                    ))}
                  </div>
                  {couponStatus.applied && (
                    <p className="text-xs text-emerald-700 font-bold flex items-center gap-1">
                      <CheckCircle2 className="w-4 h-4 shrink-0" /> ¡Cupón aplicado! Pagas {couponFee} Bs en lugar de {regularFee} Bs.
                      {paymentMethod === 'cash_box' && ' (No aplica en efectivo)'}
                    </p>
                  )}
                  {couponStatus.error && <p className="text-xs text-red-700">{couponStatus.error}</p>}
                </div>
              )}

              {/* Métodos */}
              <div className="space-y-2">
                <div className={`grid grid-cols-1 gap-3 ${methodOptions.length === 3 ? 'sm:grid-cols-3' : 'sm:grid-cols-2'}`}>
                  {methodOptions.length === 0 && (
                    <p className="sm:col-span-3 text-sm text-red-700 bg-red-50 border border-red-100 rounded-2xl p-4">
                      No hay métodos de pago habilitados. Comunícate con la organización.
                    </p>
                  )}
                  {methodOptions.map(({ id, cfg }) => {
                    const Icon = METHOD_STYLE[id].icon;
                    const isActive = paymentMethod === id;
                    return (
                      <button
                        key={id}
                        type="button"
                        aria-pressed={isActive}
                        onClick={() => {
                          setPaymentMethod(id);
                          clearErr('paymentMethod', 'voucher', 'reference');
                          setSubmitError('');
                        }}
                        className={`payment-card p-4 rounded-2xl border-2 text-left cursor-pointer ${
                          isActive ? 'border-sky-400 bg-sky-50 shadow-lg ring-2 ring-sky-100' : 'border-slate-200 bg-white hover:shadow-md'
                        }`}
                      >
                        <div className={`w-10 h-10 rounded-2xl bg-gradient-to-br ${METHOD_STYLE[id].gradient} flex items-center justify-center mb-3 shadow-md`}>
                          <Icon className="w-5 h-5 text-white" />
                        </div>
                        <div className="font-black text-sm text-slate-900">{cfg.label}</div>
                        <div className="text-[11px] text-slate-500 mt-0.5">{cfg.description}</div>
                      </button>
                    );
                  })}
                </div>
                {errors.paymentMethod && (
                  <p className="text-[11px] text-red-600 font-semibold flex items-center gap-1">
                    <AlertCircle className="w-3 h-3 shrink-0" /> {errors.paymentMethod}
                  </p>
                )}
              </div>
            </StepCard>

            {paymentMethod === 'qr_bank' && (
              <div className="bg-white rounded-3xl shadow-xl border border-slate-100 p-5 sm:p-8 animate-fade-in-scale space-y-5">
                <div className="text-center space-y-1">
                  <h3 className="text-lg font-black text-slate-900 font-display">Escanea el código QR</h3>
                  <p className="text-sm text-slate-500">Usa la app de tu banco para pagar {totalToPay} Bs</p>
                  <p className="text-xs text-slate-400">{paymentSettings.qr.bankName}</p>
                </div>
                <div className="flex justify-center">
                  <div className={`relative p-4 rounded-3xl border-4 shadow-2xl ${webhookReceived ? 'border-emerald-400' : 'border-sky-200 animate-pulse-glow'}`}>
                    {paymentSettings.qr.qrImageUrl || paymentQrDataUrl ? (
                      <img
                        src={paymentSettings.qr.qrImageUrl || paymentQrDataUrl}
                        alt="Código QR de pago"
                        className="w-48 h-48 sm:w-56 sm:h-56 rounded-2xl"
                      />
                    ) : (
                      <div className="w-48 h-48 sm:w-56 sm:h-56 bg-slate-100 rounded-2xl flex items-center justify-center">
                        <RefreshCw className="w-8 h-8 text-slate-400 animate-spin" />
                      </div>
                    )}
                    {webhookReceived && (
                      <div className="absolute -top-3 -right-3 w-10 h-10 bg-emerald-500 rounded-2xl flex items-center justify-center shadow-lg animate-pop-in">
                        <Check className="w-6 h-6 text-white" />
                      </div>
                    )}
                  </div>
                </div>
                {paymentSettings.qr.instructions && (
                  <p className="text-xs text-slate-600 text-center max-w-md mx-auto">{paymentSettings.qr.instructions}</p>
                )}
                {qrManual ? (
                  <div className="space-y-3 pt-2 border-t border-slate-100">
                    <h4 className="text-sm font-black text-slate-900">Sube tu comprobante del pago QR</h4>
                    {voucherBlock}
                  </div>
                ) : !webhookReceived ? (
                  <div className="bg-sky-50 rounded-2xl p-4 text-center space-y-2 border border-sky-100">
                    <p className="text-sm font-bold text-sky-800 flex items-center justify-center gap-2">
                      <span className="relative flex h-2.5 w-2.5">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-sky-400 opacity-75" />
                        <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-sky-500" />
                      </span>
                      Esperando confirmación bancaria…
                    </p>
                    <button type="button" onClick={simulateWebhook} className="text-xs text-sky-600 hover:text-sky-800 underline font-semibold cursor-pointer">
                      Simular pago (demo)
                    </button>
                  </div>
                ) : (
                  webhookPayloadData && (
                    <div className="bg-emerald-50 rounded-2xl p-4 border border-emerald-200 space-y-2 animate-fade-in-scale">
                      <div className="flex items-center gap-2 font-black text-emerald-800 text-sm">
                        <CheckCircle2 className="w-5 h-5 text-emerald-600" /> ¡Pago confirmado por el banco!
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-xs text-emerald-700">
                        <div>
                          <span className="font-bold block">Monto</span>
                          {webhookPayloadData.monto} Bs
                        </div>
                        <div>
                          <span className="font-bold block">Transacción</span>
                          <span className="font-mono">{webhookPayloadData.transaccionId}</span>
                        </div>
                      </div>
                    </div>
                  )
                )}
              </div>
            )}

            {paymentMethod === 'transfer' && (
              <div className="bg-white rounded-3xl shadow-xl border border-slate-100 p-5 sm:p-8 animate-fade-in-scale space-y-5">
                <div className="text-center space-y-1">
                  <h3 className="text-lg font-black text-slate-900 font-display">Datos de la cuenta oficial</h3>
                  <p className="text-sm text-slate-500">Transfiere {totalToPay} Bs y sube tu comprobante</p>
                </div>
                {activeAccounts.length === 0 && (
                  <p className="text-sm text-amber-800 bg-amber-50 border border-amber-100 rounded-2xl p-4">
                    Aún no hay cuentas bancarias publicadas. Comunícate al {paymentSettings.whatsappContact}.
                  </p>
                )}
                <div className={`grid gap-3 ${activeAccounts.length > 1 ? 'md:grid-cols-2' : ''}`}>
                  {activeAccounts.map((acc) => (
                    <div key={acc.id} className="bg-indigo-50 rounded-2xl border border-indigo-100 p-4 space-y-2.5">
                      <div className="flex items-center gap-2 text-sm font-black text-indigo-900">
                        <Building2 className="w-4 h-4 text-indigo-500" /> {acc.bank}
                      </div>
                      {[
                        { label: 'Número de cuenta', value: acc.accountNumber, mono: true },
                        { label: 'Titular', value: acc.holder },
                        ...(acc.holderDocument ? [{ label: 'CI / NIT', value: acc.holderDocument, mono: true }] : []),
                        { label: 'Tipo', value: `${acc.accountType} · ${acc.currency}` },
                        { label: 'Glosa', value: `CJN-${camp.id.toUpperCase()}`, mono: true },
                      ].map((item) => (
                        <div key={item.label} className="flex items-center justify-between gap-3">
                          <div className="min-w-0">
                            <span className="text-[10px] text-indigo-500 font-bold uppercase">{item.label}</span>
                            <p className={`text-sm font-bold text-indigo-900 break-all ${item.mono ? 'font-mono' : ''}`}>{item.value}</p>
                          </div>
                          <button
                            type="button"
                            onClick={() => copyToClipboard(item.value, `${acc.id}-${item.label}`)}
                            className="shrink-0 p-2 rounded-xl bg-white hover:bg-indigo-100 border border-indigo-100 cursor-pointer"
                            title="Copiar"
                            aria-label={`Copiar ${item.label.toLowerCase()}`}
                          >
                            {copiedField === `${acc.id}-${item.label}` ? (
                              <Check className="w-4 h-4 text-emerald-600" />
                            ) : (
                              <Copy className="w-4 h-4 text-indigo-500" />
                            )}
                          </button>
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
                {paymentSettings.transfer.instructions && <p className="text-xs text-slate-600">{paymentSettings.transfer.instructions}</p>}
                {voucherBlock}
                <p className="text-xs text-amber-800 bg-amber-50 border border-amber-100 rounded-xl p-3">
                  Revisaremos tu comprobante en un máximo de {paymentSettings.transfer.verificationHours} horas. Tu credencial se genera
                  ahora; tus talleres y campeonatos se habilitan cuando tesorería apruebe el pago.
                </p>
              </div>
            )}

            {paymentMethod === 'cash_box' && (
              <div className="bg-white rounded-3xl shadow-xl border border-slate-100 p-5 sm:p-8 animate-fade-in-scale space-y-4">
                <div className={`grid gap-3 ${cashAdvanceAmount > 0 ? 'grid-cols-2' : 'grid-cols-1'}`}>
                  {cashAdvanceAmount > 0 && (
                    <div className="p-4 rounded-2xl bg-amber-50 border border-amber-100 text-center">
                      <Banknote className="w-6 h-6 text-amber-600 mx-auto" />
                      <div className="text-2xl font-black font-mono text-amber-700 mt-1">{cashAdvanceAmount} Bs</div>
                      <div className="text-xs text-amber-700 font-bold">Adelanto ({camp.cashAdvancePercent}%)</div>
                    </div>
                  )}
                  <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100 text-center">
                    <Wallet className="w-6 h-6 text-slate-500 mx-auto" />
                    <div className="text-2xl font-black font-mono text-slate-700 mt-1">{cashRemainingAmount} Bs</div>
                    <div className="text-xs text-slate-600 font-bold">{cashAdvanceAmount > 0 ? 'Resto al llegar' : 'Total a pagar en caja'}</div>
                  </div>
                </div>
                <ul className="space-y-1.5 text-xs text-slate-600">
                  <li>• El pago en efectivo no aplica cupones ni descuentos ({regularFee} Bs).</li>
                  <li>• Dónde pagar: {paymentSettings.cash.places}.</li>
                  {paymentSettings.cash.instructions && <li>• {paymentSettings.cash.instructions}</li>}
                  <li>• Tus talleres y campeonatos se habilitan cuando caja registre tu pago.</li>
                </ul>
              </div>
            )}

            {submitError && (
              <div role="alert" className="p-4 rounded-2xl bg-red-50 border border-red-200 flex items-start gap-2.5 text-sm text-red-800 animate-fade-in">
                <AlertTriangle className="w-5 h-5 text-red-500 shrink-0" />
                <div className="flex-1">
                  <strong className="block">No pudimos completar tu inscripción</strong>
                  {submitError}
                </div>
                <button type="button" onClick={() => setSubmitError('')} aria-label="Cerrar aviso" className="p-1 rounded-lg hover:bg-red-100 cursor-pointer">
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}

            <button
              type="button"
              onClick={handleCompleteRegistration}
              disabled={!canProceedPayment() || isSubmitting || !!existingReg}
              aria-busy={isSubmitting}
              className={`w-full py-4 px-4 text-sm font-black rounded-3xl shadow-xl flex items-center justify-center gap-2 transition-all active:scale-95 cursor-pointer ${
                isSubmitting
                  ? 'bg-gradient-to-r from-emerald-500 to-teal-600 text-white opacity-80 cursor-wait'
                  : canProceedPayment() && !existingReg
                  ? 'bg-gradient-to-r from-emerald-500 to-teal-600 text-white animate-pulse-glow-green'
                  : 'bg-slate-200 text-slate-400 cursor-not-allowed'
              }`}
            >
              {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <ShieldCheck className="w-5 h-5" />}
              {isSubmitting
                ? isAuthenticated
                  ? 'Registrando tu inscripción…'
                  : 'Creando tu cuenta e inscripción…'
                : paymentMethod === 'qr_bank' && !qrManual && !webhookReceived
                ? 'Esperando confirmación de pago…'
                : isAuthenticated
                ? 'Completar inscripción'
                : 'Crear mi cuenta y completar inscripción'}
            </button>
            {!canProceedPayment() && needsVoucher && !isSubmitting && (
              <p className="text-center text-[11px] text-slate-500 -mt-2">
                {voucherRequired && !transferVoucherFile ? 'Sube tu comprobante para continuar.' : 'Ingresa el número de referencia para continuar.'}
              </p>
            )}
          </div>
        )}

        {/* ── PASO 4: ¡LISTO! ────────────────────────────── */}
        {step === 4 && completedCamper && (
          <div className="mt-4 space-y-6 animate-pop-in">
            <div className="text-center space-y-2">
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-emerald-100 text-emerald-800 text-xs font-black">
                <Sparkles className="w-4 h-4" /> ¡Inscripción completada!
              </div>
              <h2 className="text-2xl sm:text-3xl font-black text-slate-900 font-display">
                Bienvenido/a a tu tribu, {completedCamper.firstName} <Flame className="inline w-7 h-7 text-orange-500 -mt-1" />
              </h2>
              <p className="text-sm text-slate-500 max-w-md mx-auto">
                Tu credencial quedó guardada en <strong>Mis inscripciones</strong>. Preséntala (impresa o en tu celular) al llegar.
              </p>
              {createdAccountEmail && (
                <p className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-violet-50 border border-violet-100 text-xs text-violet-800 font-semibold">
                  <KeyRound className="w-3.5 h-3.5" /> Tu cuenta quedó creada: <span className="font-black break-all">{createdAccountEmail}</span>
                </p>
              )}
            </div>

            {(() => {
              const paid = completedCamper.payment.status === 'completed';
              return (
                <div
                  className={`rounded-3xl p-5 sm:p-6 border space-y-4 ${
                    paid ? 'bg-gradient-to-br from-violet-600 to-indigo-700 border-violet-500 text-white' : 'bg-white border-amber-200'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <span
                      className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 ${
                        paid ? 'bg-white/20 text-white' : 'bg-amber-100 text-amber-600'
                      }`}
                    >
                      {paid ? <Sparkles className="w-5 h-5" /> : <Hourglass className="w-5 h-5" />}
                    </span>
                    <div className="min-w-0">
                      <h3 className={`text-base font-black font-display ${paid ? 'text-white' : 'text-slate-900'}`}>
                        {paid ? '¡Tu pago está confirmado! Ya puedes elegir' : 'Tus talleres y campeonatos se desbloquean al confirmar tu pago'}
                      </h3>
                      <p className={`text-xs mt-1 leading-relaxed ${paid ? 'text-violet-100' : 'text-slate-600'}`}>
                        {paid
                          ? 'Entra a «Mi campamento» para inscribirte a tus talleres (dentro del horario de inscripción de cada uno) y a los campeonatos.'
                          : completedCamper.payment.status === 'pending_cash'
                          ? 'Cuando pagues en caja, entra a «Mi campamento» para elegir tus talleres y campeonatos.'
                          : 'Tesorería revisará tu comprobante. Te avisaremos cuando esté aprobado y podrás elegir tus talleres y campeonatos desde «Mi campamento».'}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => goToMyCamp(completedCamper)}
                    className={`w-full py-4 rounded-2xl font-black text-sm shadow-lg flex items-center justify-center gap-2 active:scale-95 cursor-pointer ${
                      paid ? 'bg-white text-violet-700 hover:bg-violet-50' : 'bg-gradient-to-r from-violet-600 to-indigo-600 text-white'
                    }`}
                  >
                    <BookOpen className="w-4 h-4" /> Elegir mis talleres y campeonatos <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              );
            })()}

            <div className="rounded-[32px] bg-slate-100 p-4 sm:p-8">
              <Credential camper={completedCamper} />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setSelectedCamperForBadge(completedCamper)}
                className="py-3.5 rounded-2xl bg-[#0284C7] text-white font-black text-sm shadow flex items-center justify-center gap-2 cursor-pointer"
              >
                <QrCode className="w-4 h-4" /> Abrir credencial
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('my-registrations')}
                className="py-3.5 rounded-2xl bg-white border border-sky-200 text-sky-700 font-black text-sm flex items-center justify-center gap-2 cursor-pointer"
              >
                <Ticket className="w-4 h-4" /> Mis inscripciones
              </button>
              <button
                type="button"
                onClick={() => onEnrollmentComplete?.()}
                className="py-3.5 rounded-2xl text-slate-500 font-bold text-sm hover:bg-slate-100 cursor-pointer"
              >
                Volver al inicio
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
