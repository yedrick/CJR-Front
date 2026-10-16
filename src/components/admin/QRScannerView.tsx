import React, { useState } from 'react';
import { useCamp } from '../../context/CampContext';
import { CamperRegistration } from '../../types/camp';
import { parseCamperQrPayload } from '../../utils/qrGenerator';
import { 
  QrCode, 
  CheckCircle2, 
  AlertTriangle, 
  Search, 
  Phone, 
  Sparkles, 
  ShieldCheck, 
  Clock, 
  Camera,
  ArrowRight,
  ShieldAlert,
  Lock,
  Banknote
} from 'lucide-react';

export const QRScannerView: React.FC = () => {
  const { 
    registrations, 
    courses, 
    checkIns, 
    recordCheckIn, 
    getTribeById, 
    getCourseById, 
    setSelectedCamperForBadge,
    collectCashPayment 
  } = useCamp();
  
  const [scannedInput, setScannedInput] = useState('');
  const [validatedCamper, setValidatedCamper] = useState<CamperRegistration | null>(() => registrations[0] || null);
  const [selectedCourseForCheckIn, setSelectedCourseForCheckIn] = useState<string>('CAMP_GATE');
  const [checkInSuccessMessage, setCheckInSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleValidateCode = (code: string) => {
    setCheckInSuccessMessage(null);
    setErrorMessage(null);
    if (!code.trim()) return;

    // Check if it's direct ID or JSON payload
    const parsed = parseCamperQrPayload(code);
    const targetId = parsed?.id || code.trim();

    const match = registrations.find(
      (r) => r.id.toLowerCase() === targetId.toLowerCase() || r.fullName.toLowerCase().includes(targetId.toLowerCase())
    );

    if (match) {
      setValidatedCamper(match);
      if (match.payment.status !== 'completed') {
        setErrorMessage('¡ATENCIÓN! Este campista tiene pago PENDIENTE. Si paga en la sede, la tarifa es de 450 Bs (sin descuento). NO HAY INGRESO hasta que se registre el pago en Caja.');
      }
    } else {
      alert(`No se encontró ningún campista registrado con el código "${code}". Verifica el folio o utiliza uno de los botones de prueba rápida.`);
    }
  };

  const handlePerformCheckIn = () => {
    if (!validatedCamper) return;

    // REGLA ESTRICTA DEL CJN: ¡SI NO PAGA, NO HAY INGRESO!
    if (validatedCamper.payment.status !== 'completed') {
      setErrorMessage('⛔ ¡ACCESO BLOQUEADO! No se puede registrar ingreso. El campista debe pagar primero en Caja (sin descuento).');
      return;
    }

    const log = recordCheckIn(
      validatedCamper.id,
      selectedCourseForCheckIn,
      'Monitor de Control QR'
    );

    if (log) {
      setCheckInSuccessMessage(
        `¡Ingreso y asistencia confirmada para ${validatedCamper.fullName} en "${log.courseTitle}" a las ${log.timestamp.split(' ')[1]}!`
      );
    }
  };

  const handleQuickPayAtGate = () => {
    if (!validatedCamper) return;
    const updated = collectCashPayment(validatedCamper.id, 'Control de Puerta (Caja)');
    if (updated) {
      setValidatedCamper(updated);
      setErrorMessage(null);
      setCheckInSuccessMessage(`¡Pago de ${updated.payment.totalAmount} Bs registrado en efectivo! Ingreso DESBLOQUEADO.`);
    }
  };

  const tribe = validatedCamper ? getTribeById(validatedCamper.tribeId) : null;
  const tribeColor = tribe?.colorHex || '#1B4332';
  const hasMedicalAlert = validatedCamper && (validatedCamper.medical.hasEpipen || (validatedCamper.medical.allergies && validatedCamper.medical.allergies.toLowerCase().includes('sever')));

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8 animate-fade-in">
      
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-[#E6DEC8]">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold text-emerald-800 uppercase tracking-widest">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <span>Puesto de Control y Acceso Rápido</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-[#1B4332] font-display mt-0.5">
            Validador y Escáner de Credenciales QR
          </h2>
          <p className="text-xs text-stone-600 mt-1">
            Verifica la autenticidad del gafete, alertas médicas inmediatas y registra la asistencia a cada taller.
          </p>
        </div>

        <div className="text-xs font-mono font-bold text-stone-700 bg-white px-3 py-1.5 rounded-xl border border-stone-200 shadow-2xs self-start sm:self-auto flex items-center gap-2">
          <Clock className="w-3.5 h-3.5 text-emerald-700" />
          <span>{checkIns.length} Asistencias Auditadas</span>
        </div>
      </div>

      {/* Quick Test Demo Bar for Instant Review */}
      <div className="p-4 bg-emerald-900 text-white rounded-2xl shadow-sm space-y-2">
        <div className="flex items-center gap-2 text-xs font-bold text-emerald-300 uppercase tracking-wider">
          <Sparkles className="w-4 h-4" />
          <span>Prueba Rápida con Estudiantes Registrados (Haz 1 Clic para Probar):</span>
        </div>
        <div className="flex flex-wrap gap-2 pt-1">
          {registrations.map((camper) => {
            const camperTribe = getTribeById(camper.tribeId);
            return (
              <button
                key={camper.id}
                onClick={() => {
                  setScannedInput(camper.id);
                  setValidatedCamper(camper);
                  setCheckInSuccessMessage(null);
                }}
                className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-xs font-medium text-white transition-colors border border-white/15 flex items-center gap-2"
              >
                <span
                  className="w-2.5 h-2.5 rounded-full shrink-0"
                  style={{ backgroundColor: camperTribe?.colorHex || '#10B981' }}
                />
                <span className="font-semibold">{camper.fullName.split(' ')[0]}</span>
                <span className="font-mono text-[10px] text-emerald-200">({camper.id})</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Scanner Console Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        
        {/* Left Column: Code Input & Camera Viewport */}
        <div className="lg:col-span-5 bg-white rounded-2xl p-6 border border-stone-200 shadow-xs space-y-5">
          <h3 className="text-base font-bold text-stone-900 font-display">
            Lector de Código QR
          </h3>

          {/* Simulated Scanner Viewport */}
          <div className="relative aspect-4/3 bg-stone-900 rounded-xl overflow-hidden flex flex-col items-center justify-center p-6 text-center border-2 border-dashed border-emerald-500/50">
            {/* Viewfinder Target Reticle */}
            <div className="absolute inset-8 border-2 border-emerald-400/80 rounded-2xl pointer-events-none animate-pulse flex items-center justify-center">
              <div className="w-16 h-16 border border-emerald-300/40 rounded-lg" />
            </div>

            <Camera className="w-8 h-8 text-emerald-400 mb-2 relative z-10" />
            <span className="text-xs font-mono text-emerald-300 relative z-10">
              Sensor de Reconocimiento QR Activo
            </span>
            <span className="text-[11px] text-stone-400 max-w-xs mt-1 relative z-10">
              Apunta la credencial física o ingresa el ID abajo
            </span>
          </div>

          {/* Manual Input or Barcode Gun Input */}
          <div className="space-y-2">
            <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider">
              Ingresar Folio o Código QR Manual:
            </label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <QrCode className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Ej. CMP-2026-1042"
                  value={scannedInput}
                  onChange={(e) => setScannedInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      handleValidateCode(scannedInput);
                    }
                  }}
                  className="w-full pl-9 pr-3 py-2 text-xs bg-stone-50 border border-stone-200 rounded-xl focus:ring-2 focus:ring-[#1B4332] font-mono font-bold text-stone-900"
                />
              </div>
              <button
                type="button"
                onClick={() => handleValidateCode(scannedInput)}
                className="px-4 py-2 text-xs font-bold text-white bg-[#1B4332] hover:bg-[#2D6A4F] rounded-xl transition-all shadow-xs"
              >
                Validar
              </button>
            </div>
          </div>

          {/* Quick instructions */}
          <div className="p-3 bg-stone-50 rounded-xl border border-stone-200 text-[11px] text-stone-600 space-y-1">
            <span className="font-bold text-stone-800 block">Protocolo de Puerta:</span>
            <p>1. Escanea el carnet o selecciona el estudiante de la barra superior.</p>
            <p>2. Revisa alertas de alergias o EpiPen antes del ingreso.</p>
            <p>3. Elige si ingresa al campamento o a un taller específico y presiona "Registrar Check-In".</p>
          </div>
        </div>

        {/* Right Column: Validated Camper Profile Dossier & Check-in Control */}
        <div className="lg:col-span-7 bg-white rounded-2xl border border-stone-200 shadow-xs overflow-hidden">
          
          {validatedCamper ? (
            <div>
              {/* Dynamic Tribe Color Header */}
              <div
                style={{ backgroundColor: tribeColor }}
                className="p-5 text-white flex items-center justify-between transition-colors"
              >
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-white/80">
                    Credencial Validada · {tribe?.name}
                  </span>
                  <h3 className="text-xl font-bold font-display text-white mt-0.5">
                    {validatedCamper.fullName}
                  </h3>
                  <div className="text-xs text-white/90 font-mono mt-0.5">
                    ID Oficial: {validatedCamper.id} · {validatedCamper.age} años · Grupo Sanguíneo: {validatedCamper.medical.bloodType}
                  </div>
                </div>

                <button
                  onClick={() => setSelectedCamperForBadge(validatedCamper)}
                  className="px-3 py-1.5 rounded-lg bg-black/20 hover:bg-black/30 text-white text-xs font-semibold flex items-center gap-1.5"
                >
                  <QrCode className="w-3.5 h-3.5" />
                  Ver Gafete
                </button>
              </div>

              {/* Error Alert if Access Denied */}
              {errorMessage && (
                <div className="p-4 bg-red-100 border-b-2 border-red-300 text-xs text-red-900 font-bold flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <ShieldAlert className="w-5 h-5 text-red-600 shrink-0" />
                    <span>{errorMessage}</span>
                  </div>
                  <button
                    onClick={() => setErrorMessage(null)}
                    className="text-red-700 hover:text-red-900 text-xs font-normal"
                  >
                    ✕
                  </button>
                </div>
              )}

              {/* Success Notification if Check-in performed */}
              {checkInSuccessMessage && (
                <div className="p-4 bg-emerald-50 border-b border-emerald-200 text-xs text-emerald-900 font-bold flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>{checkInSuccessMessage}</span>
                </div>
              )}

              {/* PAYMENT ACCESS GATE CONTROL (SI NO PAGA, NO HAY INGRESO) */}
              {validatedCamper.payment.status !== 'completed' ? (
                <div className="p-5 bg-red-50 border-b-2 border-red-200 space-y-3">
                  <div className="flex items-center gap-2 text-red-800 font-black text-sm">
                    <ShieldAlert className="w-5 h-5 text-red-600 shrink-0" />
                    <span>⛔ ACCESO DENEGADO · NO HAY INGRESO AL PREDIO</span>
                  </div>
                  <p className="text-xs text-red-700 font-medium">
                    El participante registra pago pendiente ({validatedCamper.payment.totalAmount} Bs). <strong>Regla: Si paga allá en la sede, NO HAY DESCUENTO ni promociones</strong>.
                  </p>
                  <button
                    type="button"
                    onClick={handleQuickPayAtGate}
                    className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-extrabold text-xs rounded-xl shadow-md flex items-center gap-2 cursor-pointer transition-all active:scale-95"
                  >
                    <Banknote className="w-4 h-4" />
                    <span>Cobrar {validatedCamper.payment.totalAmount} Bs en Efectivo y Habilitar Ingreso</span>
                  </button>
                </div>
              ) : (
                <div className="p-3.5 bg-emerald-50 border-b border-emerald-200 text-xs text-emerald-800 font-bold flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>✅ INGRESO AUTORIZADO · PAGO REGISTRADO ({validatedCamper.payment.paymentMethod === 'qr_bank' ? 'QR Bancario' : 'Caja Efectivo'})</span>
                </div>
              )}

              <div className="p-6 space-y-5">
                
                {/* Critical Medical Warning if camper has allergies */}
                {hasMedicalAlert && (
                  <div className="p-4 bg-red-50 border-2 border-red-300 rounded-xl space-y-1">
                    <div className="flex items-center gap-2 text-xs font-bold text-red-900">
                      <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
                      <span>¡ATENCIÓN MONITOR! ALERTA MÉDICA REPORTADA</span>
                    </div>
                    <p className="text-xs text-red-800 font-medium">
                      {validatedCamper.medical.allergies}
                    </p>
                    {validatedCamper.medical.hasEpipen && (
                      <span className="inline-block mt-1 px-2 py-0.5 bg-red-600 text-white rounded text-[10px] font-extrabold">
                        PORTA AUTOINYECTOR EPIPÈN EN MOCHILA
                      </span>
                    )}
                  </div>
                )}

                {/* Emergency Phone Bar */}
                <div className="p-3 bg-stone-50 rounded-xl border border-stone-200 flex items-center justify-between text-xs">
                  <div>
                    <span className="text-stone-400 block font-medium">Contacto de Urgencia Principal</span>
                    <span className="font-bold text-stone-900">
                      {validatedCamper.medical.emergencyContact1Name} ({validatedCamper.medical.emergencyContact1Relation})
                    </span>
                  </div>
                  <a
                    href={`tel:${validatedCamper.medical.emergencyContact1Phone}`}
                    className="font-mono font-bold text-emerald-700 bg-emerald-50 px-3 py-1.5 rounded-lg border border-emerald-200 flex items-center gap-1.5 hover:bg-emerald-100"
                  >
                    <Phone className="w-3.5 h-3.5 text-emerald-600" />
                    {validatedCamper.medical.emergencyContact1Phone}
                  </a>
                </div>

                {/* Authorized Courses */}
                <div>
                  <span className="text-xs font-bold uppercase tracking-wider text-stone-500 block mb-2">
                    Talleres y Cursos Autorizados ({validatedCamper.enrolledCourseIds.length}):
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {validatedCamper.enrolledCourseIds.map((cId) => {
                      const course = getCourseById(cId);
                      if (!course) return null;
                      return (
                        <div
                          key={course.id}
                          className="p-2.5 rounded-xl bg-stone-50 border border-stone-200 text-xs space-y-0.5"
                        >
                          <span className="font-bold text-stone-900 block truncate">
                            {course.title}
                          </span>
                          <span className="text-[11px] text-emerald-800 font-mono font-medium block">
                            {course.day.split(' ')[0]} · {course.timeSlot}
                          </span>
                          <span className="text-[10px] text-stone-400 block">
                            {course.location}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Check-In Execution Bar */}
                <div className="p-4 bg-emerald-50/60 rounded-2xl border border-emerald-200 space-y-3">
                  <div className="text-xs font-bold text-[#1B4332] uppercase tracking-wider">
                    Registrar Asistencia en este Instante:
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-center">
                    <div className="sm:col-span-8">
                      <select
                        value={selectedCourseForCheckIn}
                        onChange={(e) => setSelectedCourseForCheckIn(e.target.value)}
                        className="w-full px-3 py-2 text-xs bg-white border border-stone-200 rounded-xl text-stone-900 font-medium"
                      >
                        <option value="CAMP_GATE">Acceso General Puerta Campamento</option>
                        {validatedCamper.enrolledCourseIds.map((cId) => {
                          const course = getCourseById(cId);
                          if (!course) return null;
                          return (
                            <option key={course.id} value={course.id}>
                              {course.title} ({course.day.split(' ')[0]} {course.timeSlot})
                            </option>
                          );
                        })}
                      </select>
                    </div>

                    <div className="sm:col-span-4">
                      <button
                        onClick={handlePerformCheckIn}
                        className="w-full inline-flex items-center justify-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-[#1B4332] hover:bg-[#2D6A4F] rounded-xl transition-all shadow-xs"
                      >
                        <CheckCircle2 className="w-4 h-4 text-emerald-300" />
                        <span>Confirmar Check-In</span>
                      </button>
                    </div>
                  </div>
                </div>

              </div>
            </div>
          ) : (
            <div className="p-16 text-center text-stone-400 space-y-2">
              <QrCode className="w-12 h-12 text-stone-300 mx-auto" />
              <p className="text-sm font-bold text-stone-600">
                Escanea o selecciona una credencial para ver el expediente
              </p>
              <p className="text-xs text-stone-400 max-w-sm mx-auto">
                Utiliza los botones de prueba rápida en la parte superior para cargar inmediatamente a cualquier campista con su ficha médica.
              </p>
            </div>
          )}

        </div>

      </div>

      {/* Check-ins Audit History Log */}
      <div className="bg-white rounded-2xl p-6 border border-stone-200 shadow-xs">
        <div className="flex items-center justify-between pb-4 border-b border-stone-100">
          <div>
            <h3 className="text-base font-bold text-stone-900 font-display">
              Bitácora de Asistencia Escaneada en Tiempo Real
            </h3>
            <p className="text-xs text-stone-500">
              Historial cronológico de accesos validados mediante código QR
            </p>
          </div>
          <span className="font-mono text-xs font-bold text-stone-600 bg-stone-100 px-3 py-1 rounded-lg">
            {checkIns.length} Registros
          </span>
        </div>

        <div className="divide-y divide-stone-100 mt-2">
          {checkIns.slice(0, 10).map((log) => (
            <div key={log.id} className="py-3 flex items-center justify-between gap-4 text-xs">
              <div className="flex items-center gap-3">
                <div className="p-1.5 rounded-lg bg-emerald-50 text-emerald-800">
                  <CheckCircle2 className="w-4 h-4" />
                </div>
                <div>
                  <span className="font-bold text-stone-900 text-sm block">
                    {log.camperName}
                  </span>
                  <span className="text-stone-500">
                    {log.courseTitle} · Monitor: {log.verifiedBy}
                  </span>
                </div>
              </div>

              <div className="text-right font-mono text-stone-500 text-[11px] whitespace-nowrap">
                {log.timestamp}
              </div>
            </div>
          ))}
        </div>
      </div>

    </div>
  );
};
