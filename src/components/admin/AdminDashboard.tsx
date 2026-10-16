import React from 'react';
import { useCamp } from '../../context/CampContext';
import { 
  Users, 
  DollarSign, 
  BookOpen, 
  AlertTriangle, 
  QrCode, 
  CheckCircle2, 
  Clock, 
  ChevronRight, 
  ShieldCheck, 
  Palette,
  FileSpreadsheet,
  Banknote
} from 'lucide-react';

export const AdminDashboard: React.FC = () => {
  const { 
    courses, 
    registrations, 
    tribes, 
    checkIns, 
    setActiveTab, 
    setSelectedCamperForBadge,
    getTribeById 
  } = useCamp();

  const totalRevenue = registrations.reduce((acc, r) => acc + (r.payment?.totalAmount || 0), 0);
  const totalCapacity = courses.reduce((acc, c) => acc + c.maxCapacity, 0);
  const totalEnrolledSpots = courses.reduce((acc, c) => acc + c.enrolledCount, 0);
  const occupancyRate = Math.round((totalEnrolledSpots / totalCapacity) * 100);

  // Critical medical alerts count (EpiPen or severe allergy reported)
  const medicalAlertsCount = registrations.filter(
    (r) => r.medical.hasEpipen || (r.medical.allergies && r.medical.allergies.toLowerCase().includes('sever'))
  ).length;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8 animate-fade-in">
      
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-[#E6DEC8]">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold text-emerald-800 uppercase tracking-widest">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <span>Mando y Control Operativo</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-[#1B4332] font-display mt-0.5">
            Panel de Administración del Campamento
          </h2>
          <p className="text-xs text-stone-600 mt-1">
            Supervisión en tiempo real de inscripciones, control de cupos, balance de tribus y validación de pases QR.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveTab('admin-scanner')}
            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-bold text-white bg-[#1B4332] hover:bg-[#2D6A4F] rounded-xl transition-all shadow-xs"
          >
            <QrCode className="w-4 h-4 text-emerald-300" />
            Abrir Escáner QR
          </button>
          <button
            onClick={() => setActiveTab('admin-reports')}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-stone-700 bg-white hover:bg-stone-50 border border-stone-200 rounded-xl transition-colors shadow-2xs"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-stone-500" />
            Reportes
          </button>
        </div>
      </div>

      {/* KPI Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* Total Campers */}
        <div className="bg-white p-5 rounded-2xl border border-stone-200 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-stone-500">
              Campistas Matriculados
            </span>
            <div className="p-2 rounded-xl bg-emerald-50 text-emerald-800">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="text-3xl font-extrabold text-[#1B4332] font-mono tabular-nums mt-2">
            {registrations.length}
          </div>
          <div className="text-xs text-stone-500 mt-1">
            Expedientes médicos completos
          </div>
        </div>

        {/* Total Revenue */}
        <div className="bg-white p-5 rounded-2xl border border-stone-200 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-stone-500">
              Ingresos Cobrados
            </span>
            <div className="p-2 rounded-xl bg-emerald-50 text-emerald-800">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <div className="text-3xl font-extrabold text-stone-900 font-mono tabular-nums mt-2">
            {totalRevenue.toLocaleString()} <span className="text-sm font-normal text-stone-500">Bs</span>
          </div>
          <div className="text-xs text-emerald-700 font-medium mt-1">
            Pasarela QR y Caja en efectivo
          </div>
        </div>

        {/* Course Occupancy */}
        <div className="bg-white p-5 rounded-2xl border border-stone-200 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-stone-500">
              Ocupación de Cupos
            </span>
            <div className="p-2 rounded-xl bg-amber-50 text-amber-800">
              <BookOpen className="w-4 h-4" />
            </div>
          </div>
          <div className="text-3xl font-extrabold text-[#1B4332] font-mono tabular-nums mt-2">
            {occupancyRate}%
          </div>
          <div className="text-xs text-stone-500 mt-1 font-mono">
            {totalEnrolledSpots} de {totalCapacity} plazas asignadas
          </div>
        </div>

        {/* Medical Alerts */}
        <div className="bg-white p-5 rounded-2xl border border-stone-200 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-stone-500">
              Alertas Médicas Críticas
            </span>
            <div className="p-2 rounded-xl bg-red-50 text-red-700">
              <AlertTriangle className="w-4 h-4" />
            </div>
          </div>
          <div className="text-3xl font-extrabold text-red-700 font-mono tabular-nums mt-2">
            {medicalAlertsCount}
          </div>
          <div className="text-xs text-red-600 font-medium mt-1">
            Campistas con EpiPen o alergias severas
          </div>
        </div>

      </div>

      {/* Quick Navigation Action Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        <div
          onClick={() => setActiveTab('admin-courses')}
          className="p-4 bg-white rounded-2xl border border-stone-200 hover:border-[#1B4332] transition-all cursor-pointer shadow-xs group"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-emerald-50 text-[#1B4332] group-hover:bg-[#1B4332] group-hover:text-white transition-colors">
                <BookOpen className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-stone-900 font-display">
                  Cursos & Cupos
                </h4>
                <p className="text-[11px] text-stone-500">
                  {courses.length} talleres en matriz
                </p>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-stone-400 group-hover:translate-x-1 transition-transform" />
          </div>
        </div>

        <div
          onClick={() => setActiveTab('admin-tribes')}
          className="p-4 bg-white rounded-2xl border border-stone-200 hover:border-[#1B4332] transition-all cursor-pointer shadow-xs group"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-amber-50 text-amber-800 group-hover:bg-amber-600 group-hover:text-white transition-colors">
                <Palette className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-stone-900 font-display">
                  12 Tribus Fijas
                </h4>
                <p className="text-[11px] text-stone-500">
                  Asignación automática
                </p>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-stone-400 group-hover:translate-x-1 transition-transform" />
          </div>
        </div>

        <div
          onClick={() => setActiveTab('admin-cashier')}
          className="p-4 bg-amber-50/50 rounded-2xl border border-amber-300 hover:border-amber-600 transition-all cursor-pointer shadow-xs group"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-amber-600 text-white group-hover:bg-amber-700 transition-colors">
                <Banknote className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-amber-950 font-display">
                  Pagos en Caja
                </h4>
                <p className="text-[11px] text-amber-800 font-semibold">
                  Cobros en recepción
                </p>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-amber-500 group-hover:translate-x-1 transition-transform" />
          </div>
        </div>

        <div
          onClick={() => setActiveTab('admin-roster')}
          className="p-4 bg-white rounded-2xl border border-stone-200 hover:border-[#1B4332] transition-all cursor-pointer shadow-xs group"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-blue-50 text-blue-800 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                <Users className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-stone-900 font-display">
                  Expedientes Médicos
                </h4>
                <p className="text-[11px] text-stone-500">
                  Fichas y autorizaciones
                </p>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-stone-400 group-hover:translate-x-1 transition-transform" />
          </div>
        </div>

      </div>

      {/* Two Column Layout: Recent Registrations & Live QR Check-in Feed */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left Column: Recent Registrations with QR Badge Trigger */}
        <div className="lg:col-span-7 bg-white rounded-2xl p-6 border border-stone-200 shadow-xs">
          <div className="flex items-center justify-between pb-4 border-b border-stone-100">
            <div>
              <h3 className="text-base font-bold text-stone-900 font-display">
                Últimas Inscripciones Registradas
              </h3>
              <p className="text-xs text-stone-500">
                Campistas acreditados con cobro y credencial QR generada
              </p>
            </div>
            <button
              onClick={() => setActiveTab('admin-roster')}
              className="text-xs font-bold text-[#1B4332] hover:underline"
            >
              Ver todos ({registrations.length})
            </button>
          </div>

          <div className="divide-y divide-stone-100 mt-2">
            {registrations.slice(0, 5).map((camper) => {
              const tribe = getTribeById(camper.tribeId);
              const hasAlert = Boolean(camper.medical?.hasEpipen || (camper.medical?.allergies && camper.medical.allergies.toLowerCase().includes('sever')));

              return (
                <div
                  key={camper.id}
                  className="py-3 flex items-center justify-between gap-3 hover:bg-stone-50 px-2 rounded-xl transition-colors"
                >
                  <div className="flex items-center gap-3">
                    {/* Tribe colored dot */}
                    <span
                      className="w-3.5 h-3.5 rounded-full shrink-0 shadow-xs"
                      style={{ backgroundColor: tribe?.colorHex || '#1B4332' }}
                      title={tribe?.name}
                    />

                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-stone-900">
                          {camper.fullName}
                        </span>
                        {hasAlert && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-red-700 bg-red-50 border border-red-200 px-1.5 py-0.2 rounded">
                            <AlertTriangle className="w-2.5 h-2.5" />
                            Alerta Médica
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-2 text-xs text-stone-500 mt-0.5">
                        <span className="font-mono">{camper.id}</span>
                        <span>·</span>
                        <span>{tribe?.name}</span>
                        <span>·</span>
                        <span>{camper.age} años</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-xs font-mono font-bold text-stone-800">
                      ${camper.payment.totalAmount} USD
                    </span>

                    <button
                      onClick={() => setSelectedCamperForBadge(camper)}
                      className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-[#1B4332] bg-emerald-50 hover:bg-emerald-100 rounded-lg transition-colors border border-emerald-200"
                    >
                      <QrCode className="w-3.5 h-3.5" />
                      Gafete
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Column: Live Check-in Feed */}
        <div className="lg:col-span-5 bg-white rounded-2xl p-6 border border-stone-200 shadow-xs">
          <div className="flex items-center justify-between pb-4 border-b border-stone-100">
            <div>
              <h3 className="text-base font-bold text-stone-900 font-display">
                Pase de Asistencia QR
              </h3>
              <p className="text-xs text-stone-500">
                Registros recientes en portería y talleres
              </p>
            </div>
            <button
              onClick={() => setActiveTab('admin-scanner')}
              className="text-xs font-bold text-emerald-700 hover:underline flex items-center gap-1"
            >
              <QrCode className="w-3 h-3" /> Escanear
            </button>
          </div>

          <div className="space-y-3 mt-4">
            {checkIns.slice(0, 5).map((log) => (
              <div
                key={log.id}
                className="p-3 bg-stone-50 rounded-xl border border-stone-200 text-xs space-y-1"
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-stone-900">{log.camperName}</span>
                  <span className="font-mono text-[10px] text-stone-500 flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {log.timestamp.split(' ')[1]}
                  </span>
                </div>

                <div className="text-stone-600 flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  <span className="font-medium text-stone-800 truncate">{log.courseTitle}</span>
                </div>

                <div className="text-[10px] text-stone-400">
                  Validado por: {log.verifiedBy}
                </div>
              </div>
            ))}

            {checkIns.length === 0 && (
              <div className="text-center py-8 text-xs text-stone-400">
                Sin registros de asistencia hoy todavía.
              </div>
            )}
          </div>
        </div>

      </div>

    </div>
  );
};
