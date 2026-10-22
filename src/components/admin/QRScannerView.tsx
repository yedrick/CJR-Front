import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Banknote,
  BookOpen,
  Camera,
  CheckCircle2,
  Clock,
  DoorOpen,
  IdCard,
  Loader2,
  Lock,
  MapPin,
  Phone,
  QrCode,
  ScanLine,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Tent,
  UserCheck,
  X,
} from 'lucide-react';
import { useCamp } from '../../context/CampContext';
import { useAuth } from '../../context/AuthContext';
import { useConfirm } from '../common/ConfirmDialog';
import { CamperRegistration } from '../../types/camp';
import { parseCamperQrPayload } from '../../utils/qrGenerator';
import { formatCourseScheduleShort, formatDateRange, initials, todayISO, formatBs } from '../../utils/campUtils';
import {
  AdminPage,
  AdminPageHeader,
  Badge,
  Button,
  CampFilterSelect,
  Card,
  EmptyState,
  Field,
  SelectInput,
} from './ui';

const GATE = 'CAMP_GATE';
type Issue = { level: 'block' | 'warn'; title: string; detail: string };

export const QRScannerView: React.FC = () => {
  const {
    registrations,
    courses,
    checkIns,
    adminCampFilter,
    featuredCamp,
    getCampById,
    getTribeById,
    getCourseById,
    recordCheckIn,
    collectCashPayment,
    setSelectedCamperForBadge,
  } = useCamp();
  const { currentUser, can } = useAuth();
  const { confirm } = useConfirm();
  const canCheckIn = can('checkins:create');
  const canCollect = can('payments:collect');
  const [busy, setBusy] = useState<'checkin' | 'collect' | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);

  const scanCampId = adminCampFilter !== 'ALL' ? adminCampFilter : featuredCamp?.id || '';
  const scanCamp = getCampById(scanCampId);
  const campCourses = useMemo(
    () => courses.filter((c) => c.campId === scanCampId).sort((a, b) => a.title.localeCompare(b.title)),
    [courses, scanCampId]
  );

  const operatorName = currentUser
    ? `${currentUser.firstName} ${currentUser.paternalLastName}`.trim()
    : 'Monitor de Control QR';

  const [scannedInput, setScannedInput] = useState('');
  const [validatedId, setValidatedId] = useState<string | null>(null);
  const [checkpoint, setCheckpoint] = useState<string>(GATE);
  const [notFound, setNotFound] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    if (checkpoint !== GATE && !campCourses.some((c) => c.id === checkpoint)) setCheckpoint(GATE);
  }, [campCourses, checkpoint]);

  const validatedCamper = validatedId ? registrations.find((r) => r.id === validatedId) || null : null;

  const resolveRegistration = (raw: string): CamperRegistration | undefined => {
    const text = raw.trim();
    if (!text) return undefined;
    const parsed = parseCamperQrPayload(text);
    const key = (parsed?.id || text).toLowerCase();
    return (
      registrations.find((r) => r.id.toLowerCase() === key) ||
      registrations.find((r) => (r.ticketCode || '').toLowerCase() === key) ||
      registrations.find((r) => (r.documentId || '').toLowerCase() === key)
    );
  };

  const handleValidate = (code: string) => {
    setSuccessMessage(null);
    setServerError(null);
    setNotFound(null);
    if (!code.trim()) return;
    const match = resolveRegistration(code);
    if (match) {
      setValidatedId(match.id);
    } else {
      setValidatedId(null);
      setNotFound(code.trim());
    }
  };

  const camperCamp = validatedCamper ? getCampById(validatedCamper.campId) : undefined;
  const cashDue = validatedCamper
    ? Math.max(
        0,
        (camperCamp?.price ?? validatedCamper.payment.baseCampFee) +
          (validatedCamper.payment.championshipsFees || 0) -
          (validatedCamper.payment.advanceAmount || 0)
      )
    : 0;

  const lastCheckInHere = validatedCamper
    ? checkIns.find(
        (c) =>
          c.registrationId === validatedCamper.id && c.courseId === checkpoint && c.timestamp.startsWith(todayISO())
      )
    : undefined;

  const issues: Issue[] = useMemo(() => {
    if (!validatedCamper) return [];
    const list: Issue[] = [];
    if (validatedCamper.campId !== scanCampId) {
      list.push({
        level: 'block',
        title: `Esta credencial es del campamento ${camperCamp?.name || 'otro campamento'}`,
        detail: `El puesto de control está configurado para ${scanCamp?.name || 'otro campamento'}. Cambia el filtro si corresponde.`,
      });
    }
    if (validatedCamper.status === 'cancelled') {
      list.push({ level: 'block', title: 'Inscripción cancelada', detail: 'Esta credencial ya no es válida.' });
    }
    if (validatedCamper.payment.status !== 'completed') {
      const cashText = `Debe pagar en caja ${formatBs(cashDue)} (tarifa de ${formatBs(
        camperCamp?.price ?? validatedCamper.payment.baseCampFee
      )}, sin descuento).`;
      const status = validatedCamper.payment.status;
      if (status === 'rejected') {
        list.push({
          level: 'block',
          title: 'Comprobante rechazado · no hay ingreso',
          detail: `${
            validatedCamper.payment.rejectionReason
              ? `Motivo: ${validatedCamper.payment.rejectionReason}. `
              : ''
          }Puede reenviar el comprobante o pagar en caja: ${formatBs(cashDue)}.`,
        });
      } else {
        list.push({
          level: 'block',
          title: 'Pago pendiente · no hay ingreso',
          detail:
            status === 'pending_verification'
              ? 'El comprobante aún no fue verificado por tesorería.'
              : status === 'refunded'
                ? 'El pago fue reembolsado; la credencial no habilita el ingreso.'
                : cashText,
        });
      }
    }
    if (checkpoint !== GATE && !validatedCamper.enrolledCourseIds.includes(checkpoint)) {
      list.push({
        level: 'block',
        title: 'No está inscrito en este taller',
        detail: `${validatedCamper.firstName} no figura en la lista de "${getCourseById(checkpoint)?.title || 'este taller'}".`,
      });
    }
    if (lastCheckInHere) {
      list.push({
        level: 'warn',
        title: 'Ya registró ingreso hoy',
        detail: `Último registro en este punto a las ${lastCheckInHere.timestamp.split(' ')[1]?.slice(0, 5)}.`,
      });
    }
    return list;
  }, [validatedCamper, scanCampId, scanCamp, camperCamp, cashDue, checkpoint, getCourseById, lastCheckInHere]);

  const blocked = issues.some((i) => i.level === 'block');
  const onlyPaymentBlock =
    blocked &&
    issues.filter((i) => i.level === 'block').length === 1 &&
    (validatedCamper?.payment.status === 'pending_cash' || validatedCamper?.payment.status === 'rejected');

  const handleCheckIn = async () => {
    if (!validatedCamper || blocked || busy || !canCheckIn) return;
    setSuccessMessage(null);
    setServerError(null);
    setBusy('checkin');
    try {
      // El servidor vuelve a validar pago, campamento e inscripción al taller (409) y que exista (404)
      const log = await recordCheckIn(validatedCamper.id, checkpoint, scanCampId || undefined);
      if (log) {
        setSuccessMessage(`Ingreso registrado en "${log.courseTitle}" a las ${log.timestamp.split(' ')[1]?.slice(0, 5)}.`);
      } else {
        setServerError('El servidor no autorizó el ingreso. Revisa el detalle en el aviso.');
      }
    } finally {
      setBusy(null);
    }
  };

  const handleQuickPay = async () => {
    if (!validatedCamper || !canCollect || busy) return;
    const camper = validatedCamper;
    const ok = await confirm({
      tone: 'warning',
      title: `¿Recibiste ${formatBs(cashDue)} en efectivo?`,
      message: 'Se registrará el pago completo en caja y se habilitará el ingreso del joven.',
      details: [
        <>
          <span className="font-bold">{camper.fullName}</span> ·{' '}
          <span className="font-mono">{camper.ticketCode}</span>
        </>,
        `Monto a cobrar: ${formatBs(cashDue)} (tarifa sin descuento${
          camper.payment.advanceAmount ? `, descontando el adelanto de ${formatBs(camper.payment.advanceAmount)}` : ''
        })`,
        `Cobrado por: ${operatorName}`,
        ...(camper.payment.status === 'rejected' ? ['Reemplaza al comprobante rechazado.'] : []),
      ],
      confirmText: `Sí, cobrar ${formatBs(cashDue)}`,
    });
    if (!ok || busy) return;
    setServerError(null);
    setBusy('collect');
    try {
      const updated = await collectCashPayment(camper.id);
      if (updated) {
        setSuccessMessage(`Pago de ${formatBs(updated.payment.totalAmount)} registrado en efectivo. Ingreso habilitado.`);
      } else {
        setServerError('No se pudo registrar el cobro. Revisa el detalle en el aviso.');
      }
    } finally {
      setBusy(null);
    }
  };

  const quickTestCampers = useMemo(() => {
    const own = registrations.filter((r) => r.campId === scanCampId);
    const others = registrations.filter((r) => r.campId !== scanCampId);
    return [...own.slice(0, 8), ...others.slice(0, 2)];
  }, [registrations, scanCampId]);

  const recentCheckIns = checkIns
    .filter((c) => c.campId === scanCampId)
    .sort((a, b) => b.timestamp.localeCompare(a.timestamp))
    .slice(0, 10);
  const todayCount = checkIns.filter((c) => c.campId === scanCampId && c.timestamp.startsWith(todayISO())).length;

  const tribe = validatedCamper ? getTribeById(validatedCamper.tribeId) : undefined;
  const tribeColor = tribe?.colorHex || '#0284C7';
  const checkpointCourse = checkpoint !== GATE ? getCourseById(checkpoint) : undefined;

  return (
    <AdminPage>
      <AdminPageHeader
        kicker="Control de acceso"
        title="Escáner de credenciales"
        description="Valida la credencial QR, el pago y la inscripción al taller antes de registrar el ingreso."
        icon={ScanLine}
        actions={
          <>
            <CampFilterSelect className="w-full sm:w-72" />
            <Badge className="bg-sky-50 text-sky-700 border-sky-200 py-1.5 px-3">
              <Clock className="w-3.5 h-3.5" /> {todayCount} ingresos hoy
            </Badge>
          </>
        }
      />

      {!scanCamp ? (
        <Card>
          <EmptyState
            icon={Tent}
            title="Selecciona un campamento"
            description="Elige en el filtro el campamento donde está funcionando este puesto de control."
          />
        </Card>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600">
            <Tent className="w-4 h-4 text-[#0284C7]" />
            <span>
              Puesto de control de <strong className="text-slate-900">{scanCamp.name}</strong> ·{' '}
              {formatDateRange(scanCamp.startDate, scanCamp.endDate)}
            </span>
            {adminCampFilter === 'ALL' && (
              <Badge className="bg-amber-50 text-amber-700 border-amber-200">Usando el campamento activo</Badge>
            )}
          </div>

          {/* Prueba rápida */}
          {quickTestCampers.length > 0 && (
            <Card className="p-4 bg-linear-to-r from-[#0284C7] to-[#0369A1] border-sky-700 text-white">
              <div className="flex items-center gap-2 text-[11px] font-black uppercase tracking-wider text-sky-100">
                <Sparkles className="w-4 h-4" />
                Prueba rápida · toca una credencial para simular el escaneo
              </div>
              <div className="flex gap-2 pt-3 overflow-x-auto pb-1 -mx-1 px-1 no-scrollbar">
                {quickTestCampers.map((c) => {
                  const t = getTribeById(c.tribeId);
                  const foreign = c.campId !== scanCampId;
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => {
                        setScannedInput(c.ticketCode || c.id);
                        handleValidate(c.ticketCode || c.id);
                      }}
                      className="shrink-0 px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 border border-white/20 text-xs flex items-center gap-2 transition-colors cursor-pointer"
                    >
                      <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: t?.colorHex || '#fff' }} />
                      <span className="font-bold">{c.firstName}</span>
                      <span className="font-mono text-[10px] text-sky-100">{c.ticketCode}</span>
                      {foreign && <span className="text-[9px] font-black uppercase text-amber-200">otro camp.</span>}
                    </button>
                  );
                })}
              </div>
            </Card>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Lector */}
            <Card className="lg:col-span-5 p-5 space-y-5">
              <div className="relative aspect-4/3 bg-slate-900 rounded-2xl overflow-hidden flex flex-col items-center justify-center p-6 text-center">
                <div className="absolute inset-8 rounded-2xl border-2 border-sky-400/70 animate-pulse pointer-events-none" />
                <div className="absolute left-8 right-8 top-1/2 h-0.5 bg-sky-400/70 shadow-[0_0_12px_#38BDF8]" />
                <Camera className="w-8 h-8 text-sky-300 mb-2 relative z-10" />
                <span className="text-xs font-mono font-bold text-sky-200 relative z-10">Lector QR activo</span>
                <span className="text-[11px] text-slate-400 mt-1 max-w-xs relative z-10">
                  Usa una pistola lectora o escribe el código de la credencial abajo
                </span>
              </div>

              <Field label="Punto de control">
                <SelectInput value={checkpoint} onChange={(e) => setCheckpoint(e.target.value)}>
                  <option value={GATE}>Puerta general del campamento</option>
                  {campCourses.map((c) => (
                    <option key={c.id} value={c.id}>
                      Taller · {c.title} ({formatCourseScheduleShort(c)})
                    </option>
                  ))}
                </SelectInput>
              </Field>

              <form
                className="space-y-1"
                onSubmit={(e) => {
                  e.preventDefault();
                  handleValidate(scannedInput);
                }}
              >
                <span className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                  Código de credencial
                </span>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <QrCode className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      autoFocus
                      value={scannedInput}
                      onChange={(e) => setScannedInput(e.target.value)}
                      placeholder="Ej. CJN26-CNC-0042"
                      className="w-full pl-9 pr-3 py-2.5 text-sm font-mono font-bold rounded-xl border border-slate-200 bg-slate-50 text-slate-900 outline-none focus:bg-white focus:border-sky-400 focus:ring-2 focus:ring-sky-100"
                    />
                  </div>
                  <Button type="submit" icon={ScanLine}>
                    Validar
                  </Button>
                </div>
                <span className="block text-[10px] text-slate-400">
                  Acepta el código de credencial, el ID de inscripción, el CI o el contenido del QR.
                </span>
              </form>

              {notFound && (
                <div className="p-3 rounded-2xl bg-red-50 border border-red-200 text-xs text-red-800 flex items-start gap-2">
                  <ShieldAlert className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                  <div className="min-w-0">
                    <div className="font-black">Credencial no encontrada</div>
                    <div className="break-all">No existe ninguna inscripción con «{notFound}».</div>
                  </div>
                </div>
              )}
            </Card>

            {/* Resultado */}
            <Card className="lg:col-span-7 overflow-hidden">
              {validatedCamper ? (
                <div>
                  <div className="p-5 text-white" style={{ backgroundColor: tribeColor }}>
                    <div className="flex items-start gap-4">
                      <div className="w-14 h-14 rounded-2xl bg-white/20 border border-white/30 flex items-center justify-center text-lg font-black shrink-0">
                        {initials(validatedCamper.fullName)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-[10px] font-black uppercase tracking-wider text-white/80">
                          {tribe ? `Tribu ${tribe.name}` : 'Sin tribu'}
                        </div>
                        <h3 className="text-lg sm:text-xl font-black font-display leading-tight">{validatedCamper.fullName}</h3>
                        <div className="text-xs font-mono text-white/90 mt-0.5">{validatedCamper.ticketCode}</div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setValidatedId(null)}
                        className="p-1.5 rounded-lg hover:bg-black/20 text-white/80 cursor-pointer"
                        aria-label="Limpiar"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                    <div className="flex flex-wrap gap-2 mt-4 text-[11px]">
                      <span className="px-2 py-1 rounded-lg bg-black/15 flex items-center gap-1">
                        <Tent className="w-3 h-3" /> {camperCamp?.name || 'Campamento desconocido'}
                      </span>
                      <span className="px-2 py-1 rounded-lg bg-black/15 flex items-center gap-1">
                        <IdCard className="w-3 h-3" /> CI {validatedCamper.documentId}
                      </span>
                      <span className="px-2 py-1 rounded-lg bg-black/15">{validatedCamper.age} años</span>
                      {validatedCamper.regional && (
                        <span className="px-2 py-1 rounded-lg bg-black/15 flex items-center gap-1">
                          <MapPin className="w-3 h-3" /> {validatedCamper.regional}
                        </span>
                      )}
                    </div>
                  </div>

                  {serverError && (
                    <div className="px-5 py-3 bg-red-50 border-b border-red-200 text-xs text-red-800 font-bold flex items-center gap-2" role="alert">
                      <ShieldAlert className="w-4 h-4 text-red-600 shrink-0" />
                      {serverError}
                    </div>
                  )}

                  {successMessage && (
                    <div className="px-5 py-3 bg-emerald-50 border-b border-emerald-200 text-xs text-emerald-800 font-bold flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                      {successMessage}
                    </div>
                  )}

                  {issues.length === 0 ? (
                    <div className="px-5 py-3 bg-emerald-50 border-b border-emerald-200 text-xs text-emerald-800 font-black flex items-center gap-2">
                      <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                      Ingreso autorizado · pago confirmado
                      {checkpointCourse ? ' · inscrito en el taller' : ''}
                    </div>
                  ) : (
                    <div className="divide-y divide-slate-100 border-b border-slate-100">
                      {issues.map((issue) => (
                        <div
                          key={issue.title}
                          className={`px-5 py-3 text-xs flex items-start gap-2 ${
                            issue.level === 'block' ? 'bg-red-50 text-red-800' : 'bg-amber-50 text-amber-800'
                          }`}
                        >
                          {issue.level === 'block' ? (
                            <ShieldAlert className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                          ) : (
                            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                          )}
                          <div>
                            <div className="font-black">{issue.title}</div>
                            <div className="font-medium opacity-90">{issue.detail}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="p-5 space-y-5">
                    <div>
                      <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-2">
                        Talleres inscritos ({validatedCamper.enrolledCourseIds.length})
                      </div>
                      {validatedCamper.enrolledCourseIds.length === 0 ? (
                        <p className="text-xs text-slate-400">No se inscribió a ningún taller.</p>
                      ) : (
                        <div className="space-y-1.5">
                          {validatedCamper.enrolledCourseIds.map((cid) => {
                            const course = getCourseById(cid);
                            const here = cid === checkpoint;
                            return (
                              <div
                                key={cid}
                                className={`flex items-center gap-2 p-2.5 rounded-xl border text-xs ${
                                  here ? 'border-sky-300 bg-sky-50' : 'border-slate-100 bg-slate-50'
                                }`}
                              >
                                <BookOpen className={`w-4 h-4 shrink-0 ${here ? 'text-[#0284C7]' : 'text-slate-400'}`} />
                                <span className="font-bold text-slate-800 truncate flex-1">{course?.title || cid}</span>
                                {course && (
                                  <span className="text-[10px] text-slate-500 font-mono shrink-0">
                                    {formatCourseScheduleShort(course)}
                                  </span>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    {(validatedCamper.emergencyContactName || validatedCamper.emergencyPhone) && (
                      <div className="flex items-center gap-3 p-3 rounded-xl border border-slate-100 bg-slate-50">
                        <div className="p-2 rounded-xl bg-white text-slate-500 border border-slate-100">
                          <Phone className="w-4 h-4" />
                        </div>
                        <div className="min-w-0">
                          <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                            Contacto de emergencia
                          </div>
                          <div className="text-xs font-bold text-slate-800 truncate">
                            {validatedCamper.emergencyContactName || 'Sin nombre'}
                            {validatedCamper.emergencyPhone && (
                              <a href={`tel:${validatedCamper.emergencyPhone}`} className="ml-2 font-mono text-[#0284C7]">
                                {validatedCamper.emergencyPhone}
                              </a>
                            )}
                          </div>
                        </div>
                      </div>
                    )}

                    {onlyPaymentBlock && (
                      <div className="p-3 rounded-2xl border border-amber-200 bg-amber-50 space-y-2">
                        <p className="text-[11px] text-amber-900 font-semibold text-center">
                          {validatedCamper.payment.status === 'rejected'
                            ? 'Su comprobante fue rechazado. Puede pagar ahora en efectivo para ingresar.'
                            : canCollect
                              ? 'Tiene el pago pendiente en caja. Cóbralo aquí para habilitar el ingreso.'
                              : 'Tiene el pago pendiente en caja. Envíalo a tesorería para que realice el cobro.'}
                        </p>
                        {canCollect ? (
                          <Button
                            variant="amber"
                            icon={busy === 'collect' ? Loader2 : Banknote}
                            className={`w-full ${busy === 'collect' ? '[&>svg]:animate-spin' : ''}`}
                            disabled={!!busy}
                            onClick={handleQuickPay}
                          >
                            {busy === 'collect' ? 'Registrando cobro…' : `Cobrar ${formatBs(cashDue)} en efectivo`}
                          </Button>
                        ) : (
                          <p className="text-[10px] text-amber-800 text-center inline-flex items-center justify-center gap-1 w-full">
                            <Lock className="w-3 h-3" /> Cobrar en caja requiere el permiso de tesorería.
                          </p>
                        )}
                      </div>
                    )}

                    <div className="flex flex-col sm:flex-row gap-2">
                      <Button
                        variant="secondary"
                        icon={QrCode}
                        className="sm:flex-1"
                        onClick={() => setSelectedCamperForBadge(validatedCamper)}
                      >
                        Ver credencial
                      </Button>
                      <Button
                        icon={busy === 'checkin' ? Loader2 : !canCheckIn ? Lock : checkpointCourse ? BookOpen : DoorOpen}
                        className={`sm:flex-[2] py-3 ${busy === 'checkin' ? '[&>svg]:animate-spin' : ''}`}
                        disabled={blocked || !canCheckIn || !!busy}
                        onClick={handleCheckIn}
                      >
                        {busy === 'checkin'
                          ? 'Registrando…'
                          : !canCheckIn
                          ? 'Sin permiso para registrar ingresos'
                          : blocked
                          ? 'Ingreso bloqueado'
                          : checkpointCourse
                            ? `Registrar asistencia · ${checkpointCourse.title}`
                            : 'Registrar ingreso por puerta general'}
                      </Button>
                    </div>
                  </div>
                </div>
              ) : (
                <EmptyState
                  icon={ScanLine}
                  title="Esperando credencial"
                  description="Escanea el QR de la credencial o escribe su código para validar el ingreso."
                />
              )}
            </Card>
          </div>

          {/* Historial */}
          <Card className="p-5">
            <div className="flex items-center gap-2 mb-4">
              <div className="p-2 rounded-xl bg-sky-50 text-[#0284C7]">
                <UserCheck className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-black text-slate-900 font-display">Ingresos recientes</h3>
                <p className="text-[11px] text-slate-500">{scanCamp.name}</p>
              </div>
            </div>
            {recentCheckIns.length === 0 ? (
              <EmptyState icon={ScanLine} title="Sin registros todavía" />
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {recentCheckIns.map((log) => {
                  const camper = registrations.find((r) => r.id === log.registrationId);
                  const t = camper ? getTribeById(camper.tribeId) : undefined;
                  const [date, time] = log.timestamp.split(' ');
                  return (
                    <div key={log.id} className="flex items-center gap-3 p-2.5 rounded-xl border border-slate-100">
                      <span className="w-1.5 self-stretch rounded-full" style={{ backgroundColor: t?.colorHex || '#CBD5E1' }} />
                      <div className="min-w-0 flex-1">
                        <div className="text-xs font-bold text-slate-900 truncate">{log.camperName}</div>
                        <div className="text-[10px] text-slate-500 truncate flex items-center gap-1">
                          {log.type === 'GATE_ENTRY' ? <DoorOpen className="w-3 h-3" /> : <BookOpen className="w-3 h-3" />}
                          {log.courseTitle}
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="text-[11px] font-mono font-bold text-slate-700">{time?.slice(0, 5)}</div>
                        <div className="text-[10px] font-mono text-slate-400">{date === todayISO() ? 'Hoy' : date}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
        </>
      )}
    </AdminPage>
  );
};
