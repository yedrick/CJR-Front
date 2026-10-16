import React, { useState, useEffect } from 'react';
import { useCamp } from '../../context/CampContext';
import { useAuth } from '../../context/AuthContext';
import { CampCourse, CJRRegional } from '../../types/camp';
import { CJR_REGIONALES, INITIAL_CHAMPIONSHIPS } from '../../data/initialData';
import { buildCamperQrPayload, generateQrDataUrl } from '../../utils/qrGenerator';
import { CJNLogo } from '../common/CJNLogo';
import confetti from 'canvas-confetti';
import { 
  User, 
  BookOpen, 
  CreditCard, 
  CheckCircle2, 
  AlertTriangle, 
  ArrowRight, 
  ArrowLeft, 
  QrCode, 
  Tag, 
  MapPin, 
  RefreshCw, 
  Banknote, 
  Sparkles, 
  Phone, 
  Check, 
  X, 
  ShieldAlert, 
  ShieldCheck, 
  Lock, 
  Church, 
  HeartHandshake,
  Download,
  AlertCircle,
  Trophy,
  Radio,
  Zap,
  Activity,
  Layers,
  CheckSquare,
  Square
} from 'lucide-react';

interface EnrollmentWizardProps {
  initialCourseId?: string;
  initialChampionshipId?: string;
  onEnrollmentComplete?: () => void;
}

// 9 Departamentos para expedición de CI en Bolivia
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

// Áreas de Servicio / Ministerio de Interés
export const AREAS_DE_SERVICIO = [
  'Alabanza y Adoración Musical (Voz / Instrumentos)',
  'Medios Audiovisuales, Fotografía y Transmisión en Vivo',
  'Protocolo, Ujieres y Recepción de Delegaciones',
  'Cocina, Comedor y Preparación de Refrigerios',
  'Primeros Auxilios y Brigada de Salud / Emergencias',
  'Logística, Montaje de Escenario y Mantenimiento',
  'Oración, Intercesión y Consejería Espiritual',
  'Deportes, Árbitros y Dinámicas de Recreación',
  'Participante General (Capacitación y Discipulado)',
];

export const EnrollmentWizard: React.FC<EnrollmentWizardProps> = ({ 
  initialCourseId, 
  initialChampionshipId,
  onEnrollmentComplete 
}) => {
  const { 
    courses, 
    addRegistration, 
    validateGroupCoupon,
    setSelectedCamperForBadge,
    getTribeById 
  } = useCamp();

  const { currentUser } = useAuth();

  // Flujo en 4 pasos claros: 1. Datos & Delegado -> 2. Talleres (Precio Fijo) -> 3. Pago (Webhook QR / Efectivo con Adelanto) -> 4. Gafete
  const [step, setStep] = useState<number>(1);

  // Paso 1: Datos de Registro y Validación
  const [firstName, setFirstName] = useState(currentUser?.firstName || 'Carlos Daniel');
  const [paternalLastName, setPaternalLastName] = useState(currentUser?.paternalLastName || 'Condori');
  const [maternalLastName, setMaternalLastName] = useState(currentUser?.maternalLastName || 'Flores');
  const [documentNumber, setDocumentNumber] = useState('718290');
  const [idExpedition, setIdExpedition] = useState('PT');
  const [birthDate, setBirthDate] = useState(currentUser?.birthDate || '2006-08-15');
  const [age, setAge] = useState<number>(currentUser?.age || 20);
  const [phone, setPhone] = useState(currentUser?.phone || '76249155');
  const [email, setEmail] = useState(currentUser?.email || 'carlos.condori@cjn.bo');
  const [regional, setRegional] = useState<CJRRegional>(currentUser?.regional || 'POTOSI');
  const [churchCongregation, setChurchCongregation] = useState('Iglesia Central UCE Potosí');
  const [serviceAreaOfInterest, setServiceAreaOfInterest] = useState<string>(AREAS_DE_SERVICIO[0]);
  const [emergencyContactName, setEmergencyContactName] = useState('Pr. Pedro Flores (Líder Delegación)');
  const [emergencyPhone, setEmergencyPhone] = useState('71890123');

  // Rol de Delegado & Competencias Deportivas/Olimpiadas
  const [isDelegate, setIsDelegate] = useState<boolean>(false);
  const [selectedChampionshipIds, setSelectedChampionshipIds] = useState<string[]>(() => {
    return initialChampionshipId ? [initialChampionshipId] : [];
  });

  // Estado de validación con errores
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Sincronizar si usuario cambia
  useEffect(() => {
    if (currentUser) {
      setFirstName(currentUser.firstName);
      setPaternalLastName(currentUser.paternalLastName);
      setMaternalLastName(currentUser.maternalLastName || '');
      setAge(currentUser.age);
      setPhone(currentUser.phone.replace('+591 ', ''));
      setEmail(currentUser.email);
      setRegional(currentUser.regional);
      if (currentUser.churchCongregation) setChurchCongregation(currentUser.churchCongregation);
      if (currentUser.serviceAreaOfInterest) setServiceAreaOfInterest(currentUser.serviceAreaOfInterest);
    }
  }, [currentUser]);

  // Calcular edad automáticamente cuando cambia la fecha de nacimiento
  const handleBirthDateChange = (val: string) => {
    setBirthDate(val);
    if (val) {
      const birth = new Date(val);
      const today = new Date();
      let calculatedAge = today.getFullYear() - birth.getFullYear();
      const monthDiff = today.getMonth() - birth.getMonth();
      if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
        calculatedAge--;
      }
      if (!isNaN(calculatedAge) && calculatedAge > 0) {
        setAge(calculatedAge);
      }
    }
  };

  // Toggle de Competencia para Delegado
  const toggleChampionshipSelection = (champId: string) => {
    setSelectedChampionshipIds((prev) => 
      prev.includes(champId) ? prev.filter((id) => id !== champId) : [...prev, champId]
    );
  };

  // Validación de Paso 1
  const validateStep1 = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!firstName.trim()) {
      newErrors.firstName = 'Ingresa tus nombres de pila.';
    }
    if (!paternalLastName.trim()) {
      newErrors.paternalLastName = 'Ingresa tu apellido paterno.';
    }
    if (!documentNumber.trim() || documentNumber.trim().length < 4) {
      newErrors.documentNumber = 'Ingresa el número de tu Cédula de Identidad (CI).';
    }
    if (!phone.trim() || phone.trim().length < 7) {
      newErrors.phone = 'Ingresa un número de celular o WhatsApp válido (al menos 7 u 8 dígitos).';
    }
    if (!age || age < 12 || age > 45) {
      newErrors.age = 'La edad debe estar comprendida entre 12 y 45 años.';
    }
    if (!regional) {
      newErrors.regional = 'Selecciona tu Regional Oficial del CJN.';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Paso 2: Selección de Talleres (Sin precio individual - 100% Incluidos)
  const [selectedCourseIds, setSelectedCourseIds] = useState<string[]>(() => {
    return [initialCourseId || 'c-101'];
  });

  const toggleCourseSelection = (courseId: string) => {
    setSelectedCourseIds((prev) => {
      if (prev.includes(courseId)) {
        // Evitar deseleccionar todos (mantener al menos 1 taller elegido)
        if (prev.length <= 1) return prev;
        return prev.filter((id) => id !== courseId);
      } else {
        // Permite elegir talleres de su preferencia (hasta 2)
        if (prev.length >= 2) {
          return [prev[1], courseId];
        }
        return [...prev, courseId];
      }
    });
  };

  // Regla de Cupón de Delegación (Pre-validación en Registro)
  const [couponCodeInput, setCouponCodeInput] = useState('');
  const [groupSizeInput] = useState(35); // Requisito estricto oficial de 35
  const [couponStatus, setCouponStatus] = useState<{
    applied: boolean;
    discountedPrice?: number;
    error?: string;
  }>({ applied: false });

  // Paso 3: Método de Pago (QR con Webhook en Tiempo Real o Efectivo con Adelanto)
  const [paymentOption, setPaymentOption] = useState<'qr_bank' | 'cash_box'>('qr_bank');
  const [paymentQrDataUrl, setPaymentQrDataUrl] = useState<string>('');
  
  // Webhook en Tiempo Real para Pago QR
  const [isListeningWebhook, setIsListeningWebhook] = useState<boolean>(true);
  const [webhookReceived, setWebhookReceived] = useState<boolean>(false);
  const [webhookPayloadData, setWebhookPayloadData] = useState<{
    banco: string;
    transaccionId: string;
    monto: number;
    hora: string;
    authCode: string;
  } | null>(null);

  // Pago en Efectivo con Adelanto / Anticipo en Sede
  const [cashAdvanceOption, setCashAdvanceOption] = useState<'with_advance' | 'at_door'>('with_advance');
  const [cashAdvanceAmount, setCashAdvanceAmount] = useState<number>(100); // 100 Bs de anticipo para reserva de cupón

  // Paso 4: Finalización
  const [completedCamper, setCompletedCamper] = useState<any>(null);

  // TARIFAS OFICIALES: PRECIO FIJO ÚNICO (Talleres incluidos con costo 0 Bs)
  const STANDARD_BASE_CAMP_FEE = 450; // Bs
  // Si paga en caja: "SI PAGA ALLÁ NO HAY DESCUENTO NI NADA"
  const isCashAtDoor = paymentOption === 'cash_box';
  const effectiveBaseCampFee = (!isCashAtDoor && couponStatus.applied && couponStatus.discountedPrice)
    ? couponStatus.discountedPrice
    : STANDARD_BASE_CAMP_FEE;

  // Los talleres NO TIENEN PRECIO EXTRA (costo fijo único)
  const courseMaterialsFee = 0; 
  const discountAmount = (!isCashAtDoor && couponStatus.applied) 
    ? (STANDARD_BASE_CAMP_FEE - effectiveBaseCampFee) 
    : 0;
  const finalTotalAmount = effectiveBaseCampFee + courseMaterialsFee;

  // Validar Cupón de Delegación
  const handleApplyCoupon = (codeToTest?: string) => {
    const code = (codeToTest !== undefined ? codeToTest : couponCodeInput).trim().toUpperCase();
    if (codeToTest !== undefined) {
      setCouponCodeInput(code);
    }

    if (!code) {
      setCouponStatus({ applied: false, error: 'Ingresa un código de cupón de delegación.' });
      return;
    }

    const result = validateGroupCoupon(code, groupSizeInput, regional);
    if (result.valid) {
      setCouponStatus({
        applied: true,
        discountedPrice: result.discountedPricePerPerson,
        error: undefined,
      });
    } else {
      setCouponStatus({
        applied: false,
        error: result.error || 'Cupón no válido para las reglas del campamento.',
      });
    }
  };

  const handleRemoveCoupon = () => {
    setCouponCodeInput('');
    setCouponStatus({ applied: false, error: undefined });
  };

  // Generar código QR bancario al abrir el paso de pago
  useEffect(() => {
    if (step === 3 && paymentOption === 'qr_bank') {
      const fullParticipantName = `${firstName.trim()} ${paternalLastName.trim()} ${maternalLastName.trim()}`.trim();
      const qrPayload = `CJN-PAGO-BNB|REGIONAL:${regional}|MONTO:${finalTotalAmount}BS|PAGADOR:${fullParticipantName}|FOLIO:${Date.now()}`;
      generateQrDataUrl(qrPayload, '#0284C7').then((url) => {
        setPaymentQrDataUrl(url);
      });
      setIsListeningWebhook(true);
    }
  }, [step, paymentOption, finalTotalAmount, regional, firstName, paternalLastName, maternalLastName]);

  // Simulación del Webhook Bancario en Tiempo Real
  const triggerBankingWebhook = (instant = true) => {
    const fakeAuth = `AUTH-BNB-${Math.floor(100000 + Math.random() * 900000)}`;
    const payload = {
      banco: 'Banco Nacional de Bolivia · Red QR Simple Interbancario',
      transaccionId: `TRX-${Date.now().toString().slice(-6)}`,
      monto: finalTotalAmount,
      hora: new Date().toLocaleTimeString(),
      authCode: fakeAuth,
    };

    setWebhookPayloadData(payload);
    setWebhookReceived(true);
    setIsListeningWebhook(false);

    confetti({
      particleCount: 80,
      spread: 60,
      origin: { y: 0.6 },
      colors: ['#0284C7', '#10B981', '#F59E0B'],
    });
  };

  // Escucha automática simulada tras 8 segundos de visualización del QR
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (step === 3 && paymentOption === 'qr_bank' && !webhookReceived) {
      timer = setTimeout(() => {
        // Notificación automática si el usuario espera
        triggerBankingWebhook(false);
      }, 9000);
    }
    return () => clearTimeout(timer);
  }, [step, paymentOption, webhookReceived, finalTotalAmount]);

  // Completar inscripción formal
  const handleCompleteRegistration = async () => {
    // Si eligió QR pero el webhook no se ha disparado aún:
    if (paymentOption === 'qr_bank' && !webhookReceived) {
      alert('Esperando la confirmación del Webhook bancario. Puedes presionar "Simular Webhook Inmediato" para acreditar en tiempo real.');
      return;
    }

    const fullCamperName = `${firstName.trim()} ${paternalLastName.trim()} ${maternalLastName.trim()}`.trim();
    const tempId = `CMP-2026-${Math.floor(1000 + Math.random() * 9000)}`;
    const qrPayload = buildCamperQrPayload(tempId, fullCamperName, 't-01');

    // Regla de ingreso y competencias:
    // Si pagó por QR validado en tiempo real -> status: active, payment completed, competencias confirmadas!
    // Si es pago en caja -> status: pending_payment, competencias pendientes hasta liquidar en caja.
    const isVerifiedPaid = paymentOption === 'qr_bank' && webhookReceived;

    const actualAdvance = (isCashAtDoor && cashAdvanceOption === 'with_advance') ? Number(cashAdvanceAmount) : 0;
    const actualRemaining = isCashAtDoor ? Math.max(0, STANDARD_BASE_CAMP_FEE - actualAdvance) : 0;

    const paymentTx = {
      id: `PAY-${Date.now().toString().slice(-6)}`,
      registrationId: tempId,
      camperName: fullCamperName,
      baseCampFee: effectiveBaseCampFee,
      coursesFees: 0, // Talleres 100% gratuitos incluidos
      championshipsFees: 0,
      discountAmount: isCashAtDoor ? 0 : discountAmount,
      couponCodeApplied: (!isCashAtDoor && couponStatus.applied) ? couponCodeInput.toUpperCase() : undefined,
      totalAmount: isCashAtDoor ? STANDARD_BASE_CAMP_FEE : finalTotalAmount,
      advanceAmount: actualAdvance,
      remainingBalance: actualRemaining,
      currency: 'Bs' as const,
      date: new Date().toISOString(),
      status: isVerifiedPaid ? ('completed' as const) : ('pending_cash' as const),
      paymentMethod: paymentOption,
      webhookReceivedAt: webhookPayloadData ? new Date().toISOString() : undefined,
      webhookPayload: webhookPayloadData || undefined,
      verifiedAt: isVerifiedPaid ? new Date().toISOString() : undefined,
      verifiedBy: isVerifiedPaid ? 'Pasarela Bancaria Webhook Real-Time' : undefined,
      transactionFolio: isVerifiedPaid
        ? `BNB-WH-${Math.floor(100000 + Math.random() * 900000)}`
        : `CAJA-SEDE-${Math.floor(1000 + Math.random() * 9000)}`,
    };

    const newCamper = await addRegistration({
      userId: currentUser?.id || `usr-${Date.now()}`,
      qrPayload,
      fullName: fullCamperName,
      firstName: firstName.trim(),
      paternalLastName: paternalLastName.trim(),
      maternalLastName: maternalLastName.trim(),
      birthDate,
      age: Number(age) || 19,
      documentId: `${documentNumber.trim()}-${idExpedition}`,
      idExpedition,
      phone: phone.trim(),
      email: email.trim(),
      regional,
      churchCongregation: churchCongregation.trim(),
      subdirectivaNumber: 'SUBDIRECTIVA 01',
      serviceAreaOfInterest: serviceAreaOfInterest || 'Campamentista General',
      delegateRole: isDelegate ? 'DELEGADO' : 'CAMPAMENTISTA',
      isDelegate,
      championshipsStatus: isVerifiedPaid ? 'confirmed' : 'pending_payment',
      emergencyContactName: emergencyContactName.trim() || 'Titular',
      emergencyPhone: emergencyPhone.trim() || phone.trim(),
      enrolledCourseIds: selectedCourseIds,
      enrolledChampionshipIds: isDelegate ? selectedChampionshipIds : [],
      groupSize: groupSizeInput,
      medical: {},
      payment: paymentTx,
      status: isVerifiedPaid ? 'active' : 'pending_payment',
    });

    setCompletedCamper(newCamper);
    setStep(4);
  };

  const assignedTribe = completedCamper ? getTribeById(completedCamper.tribeId) : null;

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-10 animate-fade-in">
      
      {/* Header Compacto y Visual */}
      <div className="text-center space-y-2 pb-5 border-b border-sky-100">
        <CJNLogo size="sm" />
        <h1 className="text-2xl sm:text-3xl font-black text-slate-900 font-display">
          Inscripción Oficial · Campamento CJN 2026
        </h1>
        <p className="text-xs sm:text-sm text-slate-600 max-w-lg mx-auto">
          Comité Juvenil Nacional · Unión Cristiana Evangélica de Bolivia.
        </p>

        {/* Barra de 3 Pasos Visual */}
        <div className="max-w-xs sm:max-w-md mx-auto pt-3">
          <div className="grid grid-cols-3 gap-2 text-center text-xs font-bold">
            <div className={`py-2 px-1 rounded-xl transition-all ${
              step === 1 ? 'bg-[#0284C7] text-white shadow-sm' : step > 1 ? 'bg-sky-100 text-[#0284C7]' : 'bg-slate-100 text-slate-400'
            }`}>
              1. Datos & Delegado
            </div>
            <div className={`py-2 px-1 rounded-xl transition-all ${
              step === 2 ? 'bg-[#0284C7] text-white shadow-sm' : step > 2 ? 'bg-sky-100 text-[#0284C7]' : 'bg-slate-100 text-slate-400'
            }`}>
              2. Mis Talleres (Fijo)
            </div>
            <div className={`py-2 px-1 rounded-xl transition-all ${
              step >= 3 ? 'bg-[#0284C7] text-white shadow-sm' : 'bg-slate-100 text-slate-400'
            }`}>
              3. Pago & Webhook QR
            </div>
          </div>
        </div>
      </div>

      {/* ================= PASO 1: DATOS COMPLETOS + ROL DE DELEGADO & COMPETENCIAS + CUPÓN ================= */}
      {step === 1 && (
        <div className="bg-white rounded-3xl p-5 sm:p-8 shadow-xl border border-sky-100 mt-6 space-y-6">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <User className="w-5 h-5 text-[#0284C7]" />
              <h2 className="text-base sm:text-lg font-bold text-slate-900 font-display">
                Paso 1: Ficha de Registro y Delegación
              </h2>
            </div>
            <span className="text-xs font-bold text-sky-700 bg-sky-50 px-2.5 py-1 rounded-lg border border-sky-200">
              Campos Obligatorios (*)
            </span>
          </div>

          <div className="space-y-4 text-xs sm:text-sm">
            {/* Nombres y Apellidos */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="font-bold text-slate-800 block mb-1">
                  Nombres de Pila *
                </label>
                <input
                  type="text"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  className={`w-full px-3.5 py-2.5 rounded-xl border bg-slate-50 focus:bg-white focus:ring-2 text-slate-900 text-sm ${
                    errors.firstName ? 'border-red-400 focus:ring-red-400 bg-red-50/40' : 'border-slate-200 focus:ring-[#0284C7]'
                  }`}
                  placeholder="Ej. Carlos Daniel"
                />
                {errors.firstName && (
                  <p className="text-[11px] text-red-600 font-bold mt-1 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" /> {errors.firstName}
                  </p>
                )}
              </div>

              <div>
                <label className="font-bold text-slate-800 block mb-1">
                  Apellido Paterno *
                </label>
                <input
                  type="text"
                  value={paternalLastName}
                  onChange={(e) => setPaternalLastName(e.target.value)}
                  className={`w-full px-3.5 py-2.5 rounded-xl border bg-slate-50 focus:bg-white focus:ring-2 text-slate-900 text-sm ${
                    errors.paternalLastName ? 'border-red-400 focus:ring-red-400 bg-red-50/40' : 'border-slate-200 focus:ring-[#0284C7]'
                  }`}
                  placeholder="Ej. Condori"
                />
                {errors.paternalLastName && (
                  <p className="text-[11px] text-red-600 font-bold mt-1 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" /> {errors.paternalLastName}
                  </p>
                )}
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">
                  Apellido Materno
                </label>
                <input
                  type="text"
                  value={maternalLastName}
                  onChange={(e) => setMaternalLastName(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-[#0284C7] text-slate-900 text-sm"
                  placeholder="Ej. Flores"
                />
              </div>
            </div>

            {/* Cédula de Identidad (CI) con Expedición */}
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
              <div className="sm:col-span-8">
                <label className="font-bold text-slate-800 block mb-1">
                  Cédula de Identidad (CI) *
                </label>
                <input
                  type="text"
                  value={documentNumber}
                  onChange={(e) => setDocumentNumber(e.target.value)}
                  className={`w-full px-3.5 py-2.5 rounded-xl border bg-slate-50 focus:bg-white focus:ring-2 text-slate-900 text-sm ${
                    errors.documentNumber ? 'border-red-400 focus:ring-red-400 bg-red-50/40' : 'border-slate-200 focus:ring-[#0284C7]'
                  }`}
                  placeholder="Ej. 718290"
                />
                {errors.documentNumber && (
                  <p className="text-[11px] text-red-600 font-bold mt-1 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" /> {errors.documentNumber}
                  </p>
                )}
              </div>

              <div className="sm:col-span-4">
                <label className="font-bold text-slate-800 block mb-1">
                  Expedido en *
                </label>
                <select
                  value={idExpedition}
                  onChange={(e) => setIdExpedition(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-[#0284C7] text-slate-900 text-sm font-bold"
                >
                  {CI_EXPEDICIONES.map((dep) => (
                    <option key={dep.code} value={dep.code}>
                      {dep.code} - {dep.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Fecha Nacimiento, Edad y Celular WhatsApp */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="font-bold text-slate-800 block mb-1">
                  Fecha de Nacimiento *
                </label>
                <input
                  type="date"
                  value={birthDate}
                  onChange={(e) => handleBirthDateChange(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-[#0284C7] text-slate-900 text-sm"
                />
              </div>

              <div>
                <label className="font-bold text-slate-800 block mb-1">
                  Edad (12 a 45 años) *
                </label>
                <input
                  type="number"
                  min="12"
                  max="45"
                  value={age}
                  onChange={(e) => setAge(Number(e.target.value))}
                  className={`w-full px-3.5 py-2.5 rounded-xl border bg-slate-50 focus:bg-white focus:ring-2 text-slate-900 text-sm ${
                    errors.age ? 'border-red-400 focus:ring-red-400 bg-red-50/40' : 'border-slate-200 focus:ring-[#0284C7]'
                  }`}
                />
                {errors.age && (
                  <p className="text-[11px] text-red-600 font-bold mt-1 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" /> {errors.age}
                  </p>
                )}
              </div>

              <div>
                <label className="font-bold text-slate-800 block mb-1">
                  Celular / WhatsApp *
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-mono text-xs">
                    +591
                  </span>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value.replace(/[^0-9]/g, ''))}
                    className={`w-full pl-13 pr-3.5 py-2.5 rounded-xl border bg-slate-50 focus:bg-white focus:ring-2 text-slate-900 text-sm font-mono ${
                      errors.phone ? 'border-red-400 focus:ring-red-400 bg-red-50/40' : 'border-slate-200 focus:ring-[#0284C7]'
                    }`}
                    placeholder="76249155"
                  />
                </div>
                {errors.phone && (
                  <p className="text-[11px] text-red-600 font-bold mt-1 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" /> {errors.phone}
                  </p>
                )}
              </div>
            </div>

            {/* Regional Oficial de las 31 de Bolivia */}
            <div className="p-4 rounded-2xl bg-sky-50 border border-sky-200 space-y-2">
              <label className="font-extrabold text-[#0284C7] flex items-center gap-1.5 text-xs sm:text-sm">
                <MapPin className="w-4 h-4 text-[#0284C7]" />
                Selecciona tu Regional Oficial (31 Regionales del CJN) *
              </label>
              <select
                value={regional}
                onChange={(e) => setRegional(e.target.value as CJRRegional)}
                className="w-full px-3.5 py-3 rounded-xl border border-sky-300 bg-white text-slate-900 font-bold text-sm focus:ring-2 focus:ring-[#0284C7]"
              >
                {CJR_REGIONALES.map((reg, idx) => (
                  <option key={reg} value={reg}>
                    {idx + 1}. {reg}
                  </option>
                ))}
              </select>
            </div>

            {/* Congregación / Iglesia Local */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="font-bold text-slate-800 flex items-center gap-1 mb-1">
                  <Church className="w-3.5 h-3.5 text-slate-500" />
                  Iglesia Local / Congregación
                </label>
                <input
                  type="text"
                  value={churchCongregation}
                  onChange={(e) => setChurchCongregation(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-[#0284C7] text-sm text-slate-900"
                  placeholder="Ej. Iglesia Central UCE Potosí"
                />
              </div>

              <div>
                <label className="font-bold text-slate-800 block mb-1">
                  Correo Electrónico (Opcional)
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-[#0284C7] text-sm text-slate-900"
                  placeholder="carlos.condori@cjn.bo"
                />
              </div>
            </div>


            {/* ================= SECCIÓN CRÍTICA: ¿ERES DELEGADO? HABILITACIÓN DE COMPETENCIAS ================= */}
            <div className="p-5 rounded-2xl bg-gradient-to-br from-indigo-50/70 via-white to-sky-50 border-2 border-indigo-200 shadow-xs space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                    <Trophy className="w-5 h-5 text-amber-300" />
                  </div>
                  <div>
                    <h3 className="text-sm sm:text-base font-extrabold text-slate-900">
                      ¿Eres Delegado(a) Oficial de tu Iglesia o Regional?
                    </h3>
                    <p className="text-[11px] text-slate-600">
                      Si eres delegado, se te habilitará la selección de competencias en las que participará tu delegación.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setIsDelegate(false)}
                    className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                      !isDelegate
                        ? 'bg-slate-800 text-white shadow-xs'
                        : 'bg-white border border-slate-300 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    No, Campamentista
                  </button>

                  <button
                    type="button"
                    onClick={() => setIsDelegate(true)}
                    className={`px-4 py-2 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center gap-1.5 ${
                      isDelegate
                        ? 'bg-indigo-600 text-white shadow-md ring-2 ring-indigo-300'
                        : 'bg-white border border-indigo-300 text-indigo-700 hover:bg-indigo-50'
                    }`}
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>Sí, Soy Delegado</span>
                  </button>
                </div>
              </div>

              {/* LISTA DE COMPETENCIAS QUE SE HABILITAN AL ELEGIR DELEGADO */}
              {isDelegate && (
                <div className="pt-3 border-t border-indigo-100 space-y-3 animate-fade-in">
                  <div className="bg-amber-50/80 border border-amber-300 rounded-xl p-3 flex items-start gap-2.5">
                    <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                    <div className="text-xs text-amber-900 leading-relaxed">
                      <strong className="block font-black">Regla Oficial de Competencias y Olimpiadas:</strong>
                      Selecciona a continuación las disciplinas en las que participará tu delegación. 
                      <span className="font-black text-indigo-900 block mt-0.5">
                        ⚠️ En el sistema, la inscripción formal y acreditación de los equipos SE HABILITA AUTOMÁTICAMENTE TRAS CONFIRMAR EL PAGO.
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
                    {INITIAL_CHAMPIONSHIPS.map((champ) => {
                      const isSelected = selectedChampionshipIds.includes(champ.id);
                      return (
                        <div
                          key={champ.id}
                          onClick={() => toggleChampionshipSelection(champ.id)}
                          className={`p-3 rounded-xl border text-left cursor-pointer transition-all flex items-start gap-3 ${
                            isSelected
                              ? 'bg-indigo-50/90 border-indigo-500 ring-1 ring-indigo-300'
                              : 'bg-white border-slate-200 hover:border-slate-300'
                          }`}
                        >
                          <div className="mt-0.5 text-indigo-600">
                            {isSelected ? (
                              <CheckSquare className="w-5 h-5 text-indigo-600" />
                            ) : (
                              <Square className="w-5 h-5 text-slate-300" />
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                            <span className="font-extrabold text-xs text-slate-900 block truncate">
                              {champ.sport}
                            </span>
                            <span className="text-[11px] text-slate-500 block truncate">
                              {champ.genderCategory} · {champ.schedule}
                            </span>
                            <span className="text-[10px] font-bold text-indigo-700 bg-indigo-100/70 px-1.5 py-0.5 rounded-md inline-block mt-1">
                              {isSelected ? '✓ Inscripción pendiente de pago' : 'Clic para inscribir equipo'}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <div className="text-[11px] text-slate-500 text-right">
                    Disciplinas seleccionadas por el delegado: <strong>{selectedChampionshipIds.length}</strong>
                  </div>
                </div>
              )}
            </div>


            {/* SECCIÓN PRINCIPAL: VALIDACIÓN DE CUPÓN DE DELEGACIÓN EN REGISTRO */}
            <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-br from-sky-50/90 via-white to-amber-50/50 border border-sky-200 shadow-xs space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-sky-100">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-[#0284C7] text-white flex items-center justify-center shrink-0 shadow-xs">
                    <Tag className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-xs sm:text-sm font-extrabold text-slate-900">
                      Cupón de Descuento de Delegación (Validar antes de continuar)
                    </h3>
                    <p className="text-[11px] text-slate-500">
                      Válido para delegaciones oficiales de 35 jóvenes inscritos con pago por QR Simple (360 Bs).
                    </p>
                  </div>
                </div>

                {couponStatus.applied ? (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-emerald-100 text-emerald-800 border border-emerald-300">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                    Cupón Validado
                  </span>
                ) : (
                  <span className="text-[11px] font-bold text-slate-500 bg-slate-100 px-2.5 py-0.5 rounded-full">
                    Opcional
                  </span>
                )}
              </div>

              {/* Formulario de Cupón */}
              <div className="space-y-3 pt-1">
                <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
                  <div className="sm:col-span-7">
                    <label className="text-xs font-bold text-slate-700 block mb-1">
                      Código de Cupón de Delegación
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        placeholder="Ej. GRUPO35-POTOSI o GRUPO35-NACIONAL"
                        value={couponCodeInput}
                        onChange={(e) => {
                          setCouponCodeInput(e.target.value.toUpperCase());
                          if (couponStatus.applied || couponStatus.error) {
                            setCouponStatus({ applied: false, error: undefined });
                          }
                        }}
                        className={`w-full px-3.5 py-2.5 rounded-xl border bg-white font-mono uppercase text-xs sm:text-sm font-bold tracking-wider ${
                          couponStatus.applied
                            ? 'border-emerald-500 bg-emerald-50/30 text-emerald-900 ring-2 ring-emerald-200'
                            : couponStatus.error
                            ? 'border-red-400 bg-red-50/30 text-red-900 ring-2 ring-red-200'
                            : 'border-slate-300 focus:ring-2 focus:ring-[#0284C7] text-slate-900'
                        }`}
                      />
                      {couponStatus.applied && (
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-emerald-600">
                          <Check className="w-4 h-4 stroke-[3]" />
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="sm:col-span-5 flex gap-2">
                    <button
                      type="button"
                      onClick={() => handleApplyCoupon()}
                      className="flex-1 px-4 py-2.5 bg-[#0284C7] hover:bg-[#0369A1] text-white font-black text-xs rounded-xl shadow-xs flex items-center justify-center gap-1.5 cursor-pointer transition-all active:scale-95 min-h-[42px]"
                    >
                      <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                      <span>Validar Cupón</span>
                    </button>

                    {couponStatus.applied && (
                      <button
                        type="button"
                        onClick={handleRemoveCoupon}
                        className="px-3 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl cursor-pointer transition-colors min-h-[42px]"
                        title="Quitar cupón"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Botones de sugerencias rápidas de cupones válidos */}
                <div className="flex flex-wrap items-center gap-1.5 pt-1 text-[11px]">
                  <span className="text-slate-500 font-semibold">Probar cupones oficiales:</span>
                  <button
                    type="button"
                    onClick={() => handleApplyCoupon('GRUPO35-NACIONAL')}
                    className="px-2 py-0.5 rounded-lg bg-sky-100 hover:bg-sky-200 text-sky-800 font-mono font-bold cursor-pointer transition-colors"
                  >
                    GRUPO35-NACIONAL
                  </button>
                  <button
                    type="button"
                    onClick={() => handleApplyCoupon('GRUPO35-POTOSI')}
                    className="px-2 py-0.5 rounded-lg bg-sky-100 hover:bg-sky-200 text-sky-800 font-mono font-bold cursor-pointer transition-colors"
                  >
                    GRUPO35-POTOSI
                  </button>
                  <button
                    type="button"
                    onClick={() => handleApplyCoupon('GRUPO35-COCHABAMBA')}
                    className="px-2 py-0.5 rounded-lg bg-sky-100 hover:bg-sky-200 text-sky-800 font-mono font-bold cursor-pointer transition-colors"
                  >
                    GRUPO35-COCHABAMBA
                  </button>
                  <button
                    type="button"
                    onClick={() => handleApplyCoupon('GRUPO35-SANTACRUZ')}
                    className="px-2 py-0.5 rounded-lg bg-sky-100 hover:bg-sky-200 text-sky-800 font-mono font-bold cursor-pointer transition-colors"
                  >
                    GRUPO35-SANTACRUZ
                  </button>
                </div>

                {/* Estado de validación del cupón */}
                {couponStatus.applied && (
                  <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-300 text-emerald-900 space-y-1 animate-fade-in">
                    <div className="flex items-center gap-2 font-black text-xs">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                      <span>¡CUPÓN VALIDADO! Descuento habilitado para tu inscripción</span>
                    </div>
                    <div className="text-[11px] text-emerald-800 pl-6 leading-relaxed">
                      Tu tarifa base se reduce de <strong>450 Bs</strong> a <strong className="text-emerald-950 font-mono text-xs">360 Bs</strong> (Ahorras <strong>90 Bs</strong>). 
                      <span className="block mt-0.5 text-emerald-700 italic">
                        * Recuerda que el descuento aplica al realizar tu pago previo mediante transferencia o QR Simple.
                      </span>
                    </div>
                  </div>
                )}

                {couponStatus.error && (
                  <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-800 text-xs font-medium flex items-start gap-2 animate-fade-in">
                    <AlertTriangle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-bold block">No se pudo aplicar el cupón:</span>
                      <span className="text-[11px] text-red-700">{couponStatus.error}</span>
                    </div>
                  </div>
                )}
              </div>
            </div>

          </div>

          {/* Barra de Tarifa y Botón de Validación de Datos */}
          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-4 pt-3">
            <div>
              <span className="text-xs text-slate-500 font-semibold block">Tarifa Campamento (Paso 1):</span>
              <div className="flex items-center gap-2">
                <span className="text-2xl font-black font-mono text-[#0284C7]">
                  {couponStatus.applied ? (couponStatus.discountedPrice || 360) : STANDARD_BASE_CAMP_FEE} Bs
                </span>
                {couponStatus.applied ? (
                  <span className="text-xs font-bold text-emerald-700 bg-emerald-100 px-2.5 py-0.5 rounded-full border border-emerald-300">
                    Cupón Validado (-90 Bs)
                  </span>
                ) : (
                  <span className="text-xs text-slate-500">
                    Tarifa Oficial Regular
                  </span>
                )}
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                if (couponCodeInput.trim() && !couponStatus.applied && !couponStatus.error) {
                  handleApplyCoupon();
                }
                if (validateStep1()) {
                  setStep(2);
                  window.scrollTo({ top: 80, behavior: 'smooth' });
                }
              }}
              className="w-full sm:w-auto px-7 py-3.5 bg-[#0284C7] hover:bg-[#0369A1] text-white font-black text-sm rounded-2xl shadow-md flex items-center justify-center gap-2 cursor-pointer transition-all active:scale-95 min-h-[48px]"
            >
              <span>Validar Datos y Elegir Talleres</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* ================= PASO 2: ELEGIR TALLERES (SIN PRECIO INDIVIDUAL - PRECIO FIJO) ================= */}
      {step === 2 && (
        <div className="bg-white rounded-3xl p-5 sm:p-8 shadow-xl border border-sky-100 mt-6 space-y-6 animate-fade-in">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div>
              <div className="flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-[#0284C7]" />
                <h2 className="text-base sm:text-lg font-bold text-slate-900 font-display">
                  Paso 2: Elige los Talleres que más te gusten
                </h2>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Lunes a Viernes · 08:30 a 10:30 (Todos los talleres están 100% INCLUIDOS · Precio Fijo)
              </p>
            </div>

            <button
              type="button"
              onClick={() => setStep(1)}
              className="text-xs font-bold text-slate-500 hover:text-slate-800 flex items-center gap-1 cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" /> Volver a Mis Datos
            </button>
          </div>

          {/* Banner de Precio Fijo: Los Talleres no tienen costo extra */}
          <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2 text-emerald-900">
              <Sparkles className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>
                <strong>Talleres 100% Incluidos:</strong> No tienen precio adicional (0 Bs). Puedes elegir el taller o talleres que prefieras dentro de la tarifa fija de tu inscripción.
              </span>
            </div>
            <span className="font-mono font-black text-xs bg-emerald-600 text-white px-2.5 py-1 rounded-lg shrink-0">
              0 Bs Adicional
            </span>
          </div>

          {/* Grid de los 6 Talleres Oficiales */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {courses.map((course) => {
              const isSelected = selectedCourseIds.includes(course.id);
              const spotsLeft = Math.max(0, course.maxCapacity - course.enrolledCount);
              const isFull = spotsLeft <= 0;

              return (
                <div
                  key={course.id}
                  onClick={() => !isFull && toggleCourseSelection(course.id)}
                  className={`p-4 rounded-2xl border-2 transition-all cursor-pointer flex flex-col justify-between ${
                    isSelected
                      ? 'border-[#0284C7] bg-sky-50/70 shadow-sm ring-1 ring-sky-300'
                      : isFull
                      ? 'border-slate-200 bg-slate-50 opacity-60 cursor-not-allowed'
                      : 'border-slate-200 bg-white hover:border-sky-300 hover:bg-slate-50/50'
                  }`}
                >
                  <div className="space-y-3">
                    {/* Facilitador Header */}
                    <div className="flex items-center gap-3">
                      <img
                        src={course.instructorPhotoUrl}
                        alt={course.instructor}
                        className="w-12 h-12 rounded-full object-cover border-2 border-[#0284C7] shadow-xs shrink-0"
                        onError={(e) => {
                          e.currentTarget.style.display = 'none';
                        }}
                      />
                      <div className="min-w-0">
                        <span className="text-xs font-extrabold text-slate-900 block truncate">
                          {course.instructor}
                        </span>
                        <span className="text-[11px] text-[#0284C7] font-bold block truncate">
                          {course.instructorRole}
                        </span>
                        <span className="text-[10px] text-slate-500 block truncate">
                          {course.location}
                        </span>
                      </div>
                    </div>

                    {/* Titulo y Descripción */}
                    <div>
                      <h4 className="text-xs sm:text-sm font-black text-slate-900 leading-snug">
                        {course.title}
                      </h4>
                      <p className="text-[11px] text-slate-600 line-clamp-2 mt-1 leading-relaxed">
                        {course.description}
                      </p>
                    </div>
                  </div>

                  {/* Pie de Taller */}
                  <div className="pt-3 border-t border-slate-100 mt-3 flex items-center justify-between text-xs">
                    <span className={`font-mono font-bold text-[11px] px-2.5 py-0.5 rounded-full ${
                      isFull ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-800'
                    }`}>
                      {isFull ? 'Cupo Lleno' : `${spotsLeft} cupos libres`}
                    </span>

                    <div className={`px-3 py-1 rounded-xl text-xs font-black flex items-center gap-1.5 ${
                      isSelected 
                        ? 'bg-[#0284C7] text-white shadow-xs' 
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}>
                      {isSelected ? (
                        <>
                          <Check className="w-3.5 h-3.5 stroke-[3]" />
                          <span>Elegido (Incluido)</span>
                        </>
                      ) : (
                        <span>Seleccionar</span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Estado de Cupón de Delegación en Paso 2 */}
          <div className="p-4 rounded-2xl bg-sky-50/70 border border-sky-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-[#0284C7] text-white flex items-center justify-center shrink-0">
                <Tag className="w-4 h-4" />
              </div>
              <div>
                {couponStatus.applied ? (
                  <>
                    <span className="font-extrabold text-slate-900 block text-xs sm:text-sm">
                      Cupón Validado en tu Registro: <span className="font-mono text-[#0284C7] bg-white px-2 py-0.5 rounded-md border border-sky-300">{couponCodeInput}</span>
                    </span>
                    <span className="text-[11px] text-emerald-700 font-bold block mt-0.5">
                      ✓ Descuento de delegación aplicado: 360 Bs (Ahorro de 90 Bs en pago anticipado QR)
                    </span>
                  </>
                ) : (
                  <>
                    <span className="font-bold text-slate-800 block">
                      Tarifa Estándar Fija de Campamento: 450 Bs
                    </span>
                    <span className="text-[11px] text-slate-500 block">
                      Sin cupón de delegación de 35 personas. Los talleres no tienen precio adicional.
                    </span>
                  </>
                )}
              </div>
            </div>

            {couponStatus.applied ? (
              <div className="flex items-center gap-2">
                <span className="px-3 py-1 bg-emerald-100 text-emerald-800 font-bold rounded-xl text-xs border border-emerald-300 shrink-0">
                  Descuento Activo
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setStep(1);
                    window.scrollTo({ top: 500, behavior: 'smooth' });
                  }}
                  className="text-[11px] text-slate-500 hover:text-slate-800 underline font-semibold cursor-pointer"
                >
                  Cambiar en Paso 1
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setStep(1);
                  window.scrollTo({ top: 500, behavior: 'smooth' });
                }}
                className="px-3.5 py-2 bg-white hover:bg-slate-100 text-[#0284C7] border border-sky-300 rounded-xl font-bold text-xs cursor-pointer shrink-0 transition-colors shadow-xs"
              >
                Ingresar Cupón en Registro
              </button>
            )}
          </div>

          {/* Resumen Total y Botón */}
          <div className="p-4 rounded-2xl bg-sky-50 border border-sky-200 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div>
              <span className="text-xs text-slate-500 block">Tarifa Fija Única (Talleres Incluidos):</span>
              <div className="text-2xl font-black text-[#0284C7] font-mono">
                {finalTotalAmount} Bs
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                setStep(3);
                window.scrollTo({ top: 80, behavior: 'smooth' });
              }}
              className="w-full sm:w-auto px-7 py-3.5 bg-[#0284C7] hover:bg-[#0369A1] text-white font-black text-sm rounded-2xl shadow-md flex items-center justify-center gap-2 cursor-pointer transition-all active:scale-95 min-h-[48px]"
            >
              <span>Continuar al Pago y Acreditación</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* ================= PASO 3: PAGO QR CON WEBHOOK EN TIEMPO REAL O EFECTIVO CON ADELANTO ================= */}
      {step === 3 && (
        <div className="bg-white rounded-3xl p-5 sm:p-8 shadow-xl border border-sky-100 mt-6 space-y-6 animate-fade-in">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <CreditCard className="w-5 h-5 text-[#0284C7]" />
              <h2 className="text-base sm:text-lg font-bold text-slate-900 font-display">
                Paso 3: Método de Pago y Validación en Tiempo Real
              </h2>
            </div>
            <button
              type="button"
              onClick={() => setStep(2)}
              className="text-xs font-bold text-slate-500 hover:text-slate-800 flex items-center gap-1 cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" /> Cambiar talleres
            </button>
          </div>

          {/* Selector de Método de Pago */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setPaymentOption('qr_bank')}
              className={`p-4 rounded-2xl border-2 text-left transition-all cursor-pointer flex items-center gap-3 ${
                paymentOption === 'qr_bank'
                  ? 'border-[#0284C7] bg-sky-50/80 ring-2 ring-sky-300'
                  : 'border-slate-200 bg-white hover:bg-slate-50'
              }`}
            >
              <div className="w-10 h-10 rounded-xl bg-[#0284C7] text-white flex items-center justify-center shrink-0">
                <QrCode className="w-5 h-5" />
              </div>
              <div>
                <span className="text-xs sm:text-sm font-bold text-slate-900 block">
                  Pago por QR Simple (Webhook en Tiempo Real)
                </span>
                <span className="text-[11px] text-[#0284C7] font-semibold block">
                  Sin subir fotos · Conciliación automática instantánea
                </span>
              </div>
            </button>

            <button
              type="button"
              onClick={() => setPaymentOption('cash_box')}
              className={`p-4 rounded-2xl border-2 text-left transition-all cursor-pointer flex items-center gap-3 ${
                paymentOption === 'cash_box'
                  ? 'border-amber-500 bg-amber-50/80 ring-2 ring-amber-300'
                  : 'border-slate-200 bg-white hover:bg-slate-50'
              }`}
            >
              <div className="w-10 h-10 rounded-xl bg-amber-500 text-white flex items-center justify-center shrink-0">
                <Banknote className="w-5 h-5" />
              </div>
              <div>
                <span className="text-xs sm:text-sm font-bold text-slate-900 block">
                  Pago en Efectivo (Caja en Sede con Adelanto)
                </span>
                <span className="text-[11px] text-amber-800 font-semibold block">
                  Sin descuento · Competencias se activan al liquidar
                </span>
              </div>
            </button>
          </div>

          {/* ================= VISTA A: PAGO CON QR Y WEBHOOK BANCARIO EN TIEMPO REAL ================= */}
          {paymentOption === 'qr_bank' ? (
            <div className="space-y-6">
              
              {/* Tarjeta del QR Oficial */}
              <div className="p-5 sm:p-6 rounded-3xl bg-slate-50 border border-slate-200 flex flex-col md:flex-row items-center justify-between gap-6">
                <div className="text-center md:text-left space-y-2">
                  <span className="text-[11px] font-black uppercase text-[#0284C7] tracking-wider">
                    QR Oficial de Pago Bancario
                  </span>
                  <h3 className="text-lg sm:text-xl font-black text-slate-900 font-display">
                    Escanea desde cualquier banca móvil
                  </h3>
                  <div className="text-xs text-slate-600 max-w-sm">
                    <span>Monto a transferir: </span>
                    <strong className="text-lg text-[#0284C7] font-mono">{finalTotalAmount} Bs</strong>
                    {couponStatus.applied && (
                      <span className="block text-[11px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md mt-1">
                        ✓ Descuento de Delegación ({couponCodeInput}): 360 Bs (-90 Bs ahorro)
                      </span>
                    )}
                  </div>
                  <div className="text-[11px] text-slate-500 space-y-0.5 pt-1">
                    <div>Banco: <strong>Banco Nacional de Bolivia (BNB)</strong></div>
                    <div>Cuenta Corriente: <strong>150-1289301-CJN</strong></div>
                    <div>Titular: <strong>Comité Juvenil Nacional · UCE Bolivia</strong></div>
                  </div>
                </div>

                <div className="flex flex-col items-center gap-2 shrink-0">
                  <div className="p-3 bg-white rounded-2xl shadow-md border border-slate-200">
                    {paymentQrDataUrl ? (
                      <img src={paymentQrDataUrl} alt="QR Pago" className="w-40 h-40 rounded-lg" />
                    ) : (
                      <div className="w-40 h-40 bg-slate-100 flex items-center justify-center text-xs text-slate-400">
                        Generando QR...
                      </div>
                    )}
                  </div>
                  <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">
                    QR Simple Interbancario
                  </span>
                </div>
              </div>

              {/* SECCIÓN CRÍTICA: WEBHOOK EN TIEMPO REAL (SIN SUBIR COMPROBANTES) */}
              <div className={`p-5 sm:p-6 rounded-3xl border-2 shadow-sm space-y-4 transition-all ${
                webhookReceived 
                  ? 'bg-emerald-50/70 border-emerald-300' 
                  : 'bg-gradient-to-r from-sky-50 via-white to-sky-50 border-sky-300'
              }`}>
                <div className="flex items-center justify-between pb-3 border-b border-sky-200">
                  <div className="flex items-center gap-2.5">
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${
                      webhookReceived ? 'bg-emerald-600 text-white' : 'bg-[#0284C7] text-white'
                    }`}>
                      {webhookReceived ? <CheckCircle2 className="w-5 h-5" /> : <Radio className="w-5 h-5 animate-pulse" />}
                    </div>
                    <div>
                      <h4 className="text-sm sm:text-base font-extrabold text-slate-900 font-display">
                        {webhookReceived ? '¡Pago Acreditado en Tiempo Real por Webhook!' : 'Pasarela Bancaria con Webhook en Tiempo Real'}
                      </h4>
                      <p className="text-[11px] text-slate-500">
                        {webhookReceived
                          ? 'El banco notificó la transferencia exitosa. Tu ingreso y tus competencias están habilitados.'
                          : 'No necesitas subir fotos ni comprobantes. El sistema escucha el webhook del banco y valida al instante.'}
                      </p>
                    </div>
                  </div>

                  {webhookReceived ? (
                    <span className="px-3 py-1 bg-emerald-600 text-white font-mono text-xs font-bold rounded-full shadow-xs">
                      200 OK · CONCILIADO
                    </span>
                  ) : (
                    <div className="flex items-center gap-1.5 px-3 py-1 bg-sky-100 text-[#0284C7] font-bold text-xs rounded-full">
                      <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping"></span>
                      <span>Escuchando Webhook...</span>
                    </div>
                  )}
                </div>

                {/* Si no ha recibido el webhook todavía: Radar y botón para simulación inmediata */}
                {!webhookReceived ? (
                  <div className="space-y-4 pt-1">
                    <div className="p-4 rounded-2xl bg-white border border-sky-100 flex flex-col sm:flex-row items-center justify-between gap-4">
                      <div className="flex items-center gap-3">
                        <div className="relative flex h-3 w-3">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-sky-400 opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-3 w-3 bg-[#0284C7]"></span>
                        </div>
                        <div className="text-xs text-slate-700">
                          <strong className="block text-slate-900">Esperando confirmación interbancaria automática...</strong>
                          <span>El webhook conciliará automáticamente tu pago en cuanto realices la transferencia.</span>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => triggerBankingWebhook(true)}
                        className="w-full sm:w-auto px-5 py-2.5 bg-[#0284C7] hover:bg-[#0369A1] text-white font-black text-xs rounded-xl shadow-md flex items-center justify-center gap-1.5 transition-all cursor-pointer active:scale-95 shrink-0"
                      >
                        <Zap className="w-4 h-4 text-amber-300" />
                        <span>Simular Webhook Bancario Inmediato</span>
                      </button>
                    </div>
                    <p className="text-[11px] text-slate-400 text-center">
                      * Modo Prototipo: El webhook se dispara automáticamente en pocos segundos o puedes pulsar el botón para probarlo al instante.
                    </p>
                  </div>
                ) : (
                  /* Webhook Recibido con Éxito */
                  <div className="space-y-3 pt-1 animate-fade-in">
                    <div className="p-4 bg-white rounded-2xl border border-emerald-200 text-xs space-y-2">
                      <div className="flex items-center justify-between border-b border-emerald-100 pb-2">
                        <span className="font-bold text-emerald-900">Comprobante de Notificación Webhook:</span>
                        <span className="font-mono text-emerald-800 font-bold">{webhookPayloadData?.authCode}</span>
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px] text-slate-600">
                        <div>
                          <span className="text-slate-400 block">Banco Emisor:</span>
                          <strong className="text-slate-800">BNB / QR Simple</strong>
                        </div>
                        <div>
                          <span className="text-slate-400 block">Monto Acreditado:</span>
                          <strong className="text-emerald-700 font-mono text-xs">{webhookPayloadData?.monto} Bs</strong>
                        </div>
                        <div>
                          <span className="text-slate-400 block">Hora de Notificación:</span>
                          <strong className="text-slate-800">{webhookPayloadData?.hora}</strong>
                        </div>
                        <div>
                          <span className="text-slate-400 block">Estado Ingreso:</span>
                          <strong className="text-emerald-700">AUTORIZADO</strong>
                        </div>
                      </div>
                    </div>

                    {isDelegate && (
                      <div className="p-3 bg-indigo-50 border border-indigo-200 rounded-xl text-xs text-indigo-900 flex items-center gap-2">
                        <Trophy className="w-4 h-4 text-amber-500 shrink-0" />
                        <span>
                          <strong>Competencias de Delegación Habilitadas:</strong> Al haberse conciliado el pago por webhook, tus <strong>{selectedChampionshipIds.length}</strong> disciplinas quedan formalmente inscritas y autorizadas en el sistema.
                        </span>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Botón Finalizar Inscripción (Habilitado tras Webhook) */}
              <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-4">
                <div>
                  <span className="text-xs text-slate-500 block">Estado de acreditación:</span>
                  <div className="text-sm font-black flex items-center gap-2">
                    {webhookReceived ? (
                      <span className="text-emerald-700 flex items-center gap-1">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                        Pago Conciliado · Ingreso y Competencias Desbloqueados
                      </span>
                    ) : (
                      <span className="text-amber-700 flex items-center gap-1">
                        <AlertTriangle className="w-4 h-4 text-amber-600" />
                        Esperando Webhook Bancario
                      </span>
                    )}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleCompleteRegistration}
                  disabled={!webhookReceived}
                  className={`w-full sm:w-auto px-8 py-3.5 rounded-2xl font-black text-sm flex items-center justify-center gap-2 transition-all shadow-lg min-h-[48px] ${
                    webhookReceived
                      ? 'bg-[#0284C7] hover:bg-[#0369A1] text-white cursor-pointer active:scale-95'
                      : 'bg-slate-300 text-slate-500 cursor-not-allowed'
                  }`}
                >
                  <span>Finalizar y Obtener Gafete Oficial</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>

            </div>
          ) : (
            /* ================= VISTA B: PAGO EN EFECTIVO ALLÁ (EN SEDE CON ADELANTO) ================= */
            <div className="space-y-6">
              
              {/* Alerta Oficial de Regla de Pago en Efectivo */}
              <div className="p-4 bg-amber-50 border-2 border-amber-300 rounded-2xl space-y-2">
                <div className="flex items-center gap-2 text-amber-900 font-extrabold text-sm">
                  <ShieldAlert className="w-5 h-5 text-amber-600" />
                  <span>Regla Oficial: Pago en Efectivo en Sede</span>
                </div>
                <div className="text-xs text-amber-800 space-y-1 pl-7 leading-relaxed">
                  <p>
                    1. <strong>Sin descuento ni cupón:</strong> Al pagar en caja presencial no aplica tarifa de grupo de 360 Bs (se cobra la tarifa estándar de <strong>450 Bs</strong>).
                  </p>
                  <p>
                    2. <strong>Habilitación en el Sistema:</strong> Tu ingreso al campamento y la acreditación de las competencias de delegación permanecerán <span className="underline font-bold">bloqueados</span> hasta que te acerques a la mesa de Caja en el campamento a liquidar el pago.
                  </p>
                </div>
              </div>

              {/* OPCIONES DE PAGO EN EFECTIVO: CON ADELANTO O EN PUERTA */}
              <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-4">
                <h4 className="text-sm font-extrabold text-slate-900">
                  Modalidad de Pago en Sede (¿Deseas registrar un adelanto para asegurar tu cupo?):
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div
                    onClick={() => setCashAdvanceOption('with_advance')}
                    className={`p-4 rounded-xl border-2 cursor-pointer transition-all ${
                      cashAdvanceOption === 'with_advance'
                        ? 'border-[#0284C7] bg-sky-50/70 ring-1 ring-sky-300'
                        : 'border-slate-200 bg-white hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-extrabold text-xs sm:text-sm text-slate-900">
                        Registrar con Adelanto / Anticipo
                      </span>
                      <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-1.5 py-0.5 rounded-md">
                        Recomendado
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500">
                      Reserva de cupón de taller con anticipo. Saldo a pagar al llegar a Caja.
                    </p>
                  </div>

                  <div
                    onClick={() => setCashAdvanceOption('at_door')}
                    className={`p-4 rounded-xl border-2 cursor-pointer transition-all ${
                      cashAdvanceOption === 'at_door'
                        ? 'border-amber-500 bg-amber-50/70 ring-1 ring-amber-300'
                        : 'border-slate-200 bg-white hover:bg-slate-50'
                    }`}
                  >
                    <div className="font-extrabold text-xs sm:text-sm text-slate-900 mb-1">
                      Pago Total en Puerta (450 Bs)
                    </div>
                    <p className="text-[11px] text-slate-500">
                      Cancela los 450 Bs completos en la mesa de Caja al arribar al campamento.
                    </p>
                  </div>
                </div>

                {/* Input de monto de adelanto si eligió with_advance */}
                {cashAdvanceOption === 'with_advance' && (
                  <div className="p-4 bg-sky-50/80 rounded-xl border border-sky-200 space-y-2 animate-fade-in">
                    <label className="text-xs font-bold text-slate-800 block">
                      Monto de Adelanto / Anticipo Registrado (en Bs):
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        min="50"
                        max="400"
                        step="10"
                        value={cashAdvanceAmount}
                        onChange={(e) => setCashAdvanceAmount(Number(e.target.value))}
                        className="w-32 px-3 py-2 bg-white border border-slate-300 rounded-xl font-mono font-bold text-sm text-[#0284C7]"
                      />
                      <span className="text-xs text-slate-600 font-semibold">
                        Bs de adelanto
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-xs pt-1 border-t border-sky-200 text-slate-700">
                      <span>Saldo pendiente a liquidar en Caja en el campamento:</span>
                      <strong className="text-sm font-mono text-amber-900">
                        {Math.max(0, STANDARD_BASE_CAMP_FEE - cashAdvanceAmount)} Bs
                      </strong>
                    </div>
                  </div>
                )}
              </div>

              {/* Botón de Confirmación para Pago en Caja */}
              <div className="p-5 rounded-2xl bg-amber-50/70 border border-amber-200 flex flex-col sm:flex-row items-center justify-between gap-4">
                <div>
                  <span className="text-xs text-amber-800 block">Total oficial a cancelar:</span>
                  <div className="text-xl font-black text-amber-950 font-mono">
                    {STANDARD_BASE_CAMP_FEE} Bs (Tarifa Puerta Sin Descuento)
                  </div>
                  {cashAdvanceOption === 'with_advance' && (
                    <span className="text-[11px] text-amber-700 font-semibold block">
                      Adelanto: {cashAdvanceAmount} Bs · Saldo en sede: {STANDARD_BASE_CAMP_FEE - cashAdvanceAmount} Bs
                    </span>
                  )}
                </div>

                <button
                  type="button"
                  onClick={handleCompleteRegistration}
                  className="w-full sm:w-auto px-7 py-3.5 bg-amber-600 hover:bg-amber-700 text-white font-black text-sm rounded-2xl shadow-md flex items-center justify-center gap-2 cursor-pointer transition-all active:scale-95 min-h-[48px]"
                >
                  <span>Registrar Pre-Inscripción en Caja</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>

            </div>
          )}

        </div>
      )}

      {/* ================= PASO 4: CREDENCIAL / GAFETE FINAL ================= */}
      {step === 4 && completedCamper && (
        <div className="bg-white rounded-3xl p-5 sm:p-8 shadow-xl border border-sky-100 mt-6 space-y-6 animate-fade-in text-center">
          
          <div className="max-w-md mx-auto space-y-3">
            {completedCamper.payment.status === 'completed' ? (
              <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-emerald-100 text-emerald-800 text-xs font-black uppercase tracking-wider border border-emerald-300">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>Ingreso Autorizado · Conciliación Webhook QR 200 OK</span>
              </div>
            ) : (
              <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-amber-100 text-amber-900 text-xs font-black uppercase tracking-wider border border-amber-300">
                <AlertTriangle className="w-4 h-4 text-amber-600" />
                <span>Ingreso Pendiente de Pago en Caja (Sede)</span>
              </div>
            )}

            <h2 className="text-xl sm:text-2xl font-black text-slate-900 font-display">
              {completedCamper.payment.status === 'completed'
                ? '¡Inscripción Exitosa y Validada en Tiempo Real!'
                : 'Pre-Inscripción Registrada para Pago en Caja'}
            </h2>

            <p className="text-xs sm:text-sm text-slate-600">
              {completedCamper.payment.status === 'completed'
                ? 'Tu pago interbancario ha sido acreditado. Tu credencial QR está lista para el control de acceso.'
                : 'Debes pasar por la mesa de Caja al llegar al campamento para liquidar el saldo total y habilitar tu ingreso.'}
            </p>
          </div>

          {/* Tarjeta de Resumen */}
          <div className="max-w-lg mx-auto bg-slate-50 border border-slate-200 rounded-3xl p-5 text-left space-y-3 text-xs">
            <div className="flex justify-between items-center pb-2 border-b border-slate-200">
              <span className="font-bold text-slate-500">Campamentista:</span>
              <strong className="text-slate-900 text-sm">{completedCamper.fullName}</strong>
            </div>

            <div className="flex justify-between items-center pb-2 border-b border-slate-200">
              <span className="font-bold text-slate-500">Regional / Iglesia:</span>
              <span className="text-slate-800 font-bold">{completedCamper.regional} · {completedCamper.churchCongregation}</span>
            </div>

            <div className="flex justify-between items-center pb-2 border-b border-slate-200">
              <span className="font-bold text-slate-500">Rol Oficial:</span>
              <span className={`font-mono font-bold px-2 py-0.5 rounded-md ${
                completedCamper.isDelegate ? 'bg-indigo-100 text-indigo-900' : 'bg-sky-100 text-sky-900'
              }`}>
                {completedCamper.isDelegate ? '★ DELEGADO OFICIAL' : 'CAMPAMENTISTA'}
              </span>
            </div>


            {/* Talleres Elegidos */}
            <div className="pb-2 border-b border-slate-200">
              <span className="font-bold text-slate-500 block mb-1">Talleres Seleccionados (Incluidos):</span>
              <div className="space-y-1">
                {completedCamper.enrolledCourseIds.map((cId: string) => {
                  const course = courses.find((c) => c.id === cId);
                  return (
                    <div key={cId} className="p-2 bg-white rounded-xl border border-sky-100 text-[11px] font-bold text-slate-800 flex justify-between">
                      <span>📖 {course?.title || cId}</span>
                      <span className="text-emerald-700 font-mono">0 Bs (Incluido)</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Competencias Deportivas si es Delegado */}
            {completedCamper.isDelegate && (
              <div className="pb-2 border-b border-slate-200">
                <div className="flex items-center justify-between mb-1">
                  <span className="font-bold text-indigo-900">
                    Competencias de la Delegación:
                  </span>
                  <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-md ${
                    completedCamper.payment.status === 'completed'
                      ? 'bg-emerald-100 text-emerald-800'
                      : 'bg-amber-100 text-amber-800'
                  }`}>
                    {completedCamper.payment.status === 'completed'
                      ? '✓ Habilitadas en el Sistema'
                      : '⏳ Pendientes de Pago en Caja'}
                  </span>
                </div>

                <div className="space-y-1">
                  {completedCamper.enrolledChampionshipIds.length > 0 ? (
                    completedCamper.enrolledChampionshipIds.map((chId: string) => {
                      const champ = INITIAL_CHAMPIONSHIPS.find((c) => c.id === chId);
                      return (
                        <div key={chId} className="p-1.5 bg-white rounded-lg border border-indigo-100 text-[11px] text-slate-800 flex items-center gap-1.5">
                          <Trophy className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                          <span className="font-bold">{champ?.sport || chId}</span>
                        </div>
                      );
                    })
                  ) : (
                    <span className="text-[11px] text-slate-400 italic">No registró disciplinas adicionales.</span>
                  )}
                </div>
              </div>
            )}

            {/* Estado de Pago y Folio */}
            <div className="flex justify-between items-center pt-1 text-xs">
              <span className="font-bold text-slate-500">Monto & Folio:</span>
              <div className="text-right">
                <span className="font-black text-[#0284C7] font-mono text-sm block">
                  {completedCamper.payment.totalAmount} Bs
                </span>
                <span className="font-mono text-[10px] text-slate-400">
                  {completedCamper.payment.transactionFolio}
                </span>
              </div>
            </div>
          </div>

          {/* Botones de Acción */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-3">
            <button
              type="button"
              onClick={() => setSelectedCamperForBadge(completedCamper)}
              className="w-full sm:w-auto px-6 py-3 bg-[#0284C7] hover:bg-[#0369A1] text-white font-black text-xs rounded-xl shadow-md flex items-center justify-center gap-2 cursor-pointer transition-all active:scale-95"
            >
              <QrCode className="w-4 h-4" />
              <span>Ver Gafete & Credencial QR</span>
            </button>

            {onEnrollmentComplete && (
              <button
                type="button"
                onClick={onEnrollmentComplete}
                className="w-full sm:w-auto px-6 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl cursor-pointer transition-colors"
              >
                Volver al Inicio
              </button>
            )}
          </div>

        </div>
      )}

    </div>
  );
};
