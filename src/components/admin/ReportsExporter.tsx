import React, { useState } from 'react';
import { useCamp } from '../../context/CampContext';
import { 
  FileSpreadsheet, 
  Download, 
  Printer, 
  Palette, 
  AlertTriangle, 
  BookOpen, 
  DollarSign, 
  Users, 
  QrCode,
  CheckCircle2
} from 'lucide-react';

export const ReportsExporter: React.FC = () => {
  const { 
    registrations, 
    courses, 
    tribes, 
    checkIns, 
    getTribeById, 
    setSelectedCamperForBadge 
  } = useCamp();

  const [activeReportTab, setActiveReportTab] = useState<'tribes' | 'medical' | 'courses' | 'finance'>('tribes');
  const [selectedTribeFilter, setSelectedTribeFilter] = useState('ALL');

  // Export CSV Helper
  const handleExportCSV = () => {
    let csvContent = 'data:text/csv;charset=utf-8,';

    if (activeReportTab === 'tribes') {
      csvContent += 'ID_Campista,Nombre_Completo,Edad,Ciudad,Regional,Grupo_Sanguineo,Tribu,Color_HEX,Celular,Talleres_Inscritos,Campeonatos_Inscritos,Total_Bs,Estado_Pago\n';
      registrations.forEach((r) => {
        const tribe = getTribeById(r.tribeId);
        csvContent += `"${r.id}","${r.fullName}",${r.age},"${r.regional}","${r.regional}","${r.medical?.bloodType || 'N/A'}","${tribe?.name || 'General'}","${tribe?.colorHex || ''}","${r.phone}",${r.enrolledCourseIds.length},${r.enrolledChampionshipIds.length},${r.payment.totalAmount},"${r.payment.status}"\n`;
      });
    } else if (activeReportTab === 'medical') {
      csvContent += 'ID_Campista,Nombre,Alergias,Tiene_EpiPen,Grupo_Sanguineo,Medicamentos,Restriccion_Dietetica,Contacto_Urgencia_1,Telefono_Urgencia_1,Contacto_Urgencia_2,Telefono_Urgencia_2\n';
      registrations.forEach((r) => {
        csvContent += `"${r.id}","${r.fullName}","${(r.medical?.allergies || '').replace(/"/g, '""')}",${r.medical?.hasEpipen ? 'SI' : 'NO'},"${r.medical?.bloodType || 'N/A'}","${r.medical?.dailyMedications || 'Ninguno'}","${r.medical?.dietaryRestrictions || 'Ninguna'}","${r.medical?.emergencyContact1Name || ''}","${r.medical?.emergencyContact1Phone || ''}","${r.medical?.emergencyContact2Name || ''}","${r.medical?.emergencyContact2Phone || ''}"\n`;
      });
    } else if (activeReportTab === 'courses') {
      csvContent += 'ID_Curso,Titulo,Dia,Franja_Horaria,Lugar,Instructor,Cupo_Maximo,Inscritos,Ocupacion_Porcentaje,Tarifa_Materiales_Bs\n';
      courses.forEach((c) => {
        const percent = Math.round((c.enrolledCount / c.maxCapacity) * 100);
        csvContent += `"${c.id}","${c.title}","${c.day}","${c.timeSlot}","${c.location}","${c.instructor}",${c.maxCapacity},${c.enrolledCount},"${percent}%",${c.materialsFee}\n`;
      });
    } else {
      csvContent += 'Folio_Transaccion,ID_Registro,Campista,Monto_Bs,Metodo_Pago,Fecha,Estado\n';
      registrations.forEach((r) => {
        csvContent += `"${r.payment.transactionFolio}","${r.id}","${r.fullName}",${r.payment.totalAmount},"${r.payment.paymentMethod === 'cash_box' ? 'Caja Efectivo' : 'QR Simple'}","${r.payment.date}","${r.payment.status}"\n`;
      });
    }

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `reporte_campflow_${activeReportTab}_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8 animate-fade-in">
      
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-[#E6DEC8]">
        <div>
          <span className="text-xs font-bold text-emerald-800 uppercase tracking-widest">
            Auditoría, Exportación y Credenciales
          </span>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-[#1B4332] font-display mt-0.5">
            Informes Detallados con Colores Personalizables
          </h2>
          <p className="text-xs text-stone-600 mt-1">
            Genera listados clasificados por color de tribu, informes de alertas médicas y exportación en formato CSV.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleExportCSV}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-[#1B4332] hover:bg-[#2D6A4F] rounded-xl transition-all shadow-xs"
          >
            <Download className="w-4 h-4 text-emerald-300" />
            Descargar CSV
          </button>
          <button
            onClick={() => window.print()}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-stone-700 bg-white hover:bg-stone-50 border border-stone-200 rounded-xl transition-colors shadow-2xs"
          >
            <Printer className="w-3.5 h-3.5 text-stone-500" />
            Imprimir Reporte
          </button>
        </div>
      </div>

      {/* Report Category Navigation Bar */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 border-b border-stone-200">
        {[
          { id: 'tribes', label: 'Distribución por Tribu de Color', icon: Palette },
          { id: 'medical', label: 'Informe Clínico y Emergencias', icon: AlertTriangle },
          { id: 'courses', label: 'Matriz de Ocupación de Cupos', icon: BookOpen },
          { id: 'finance', label: 'Libro Contable de Matrículas', icon: DollarSign },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeReportTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveReportTab(tab.id as any)}
              className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap flex items-center gap-2 ${
                isActive
                  ? 'bg-[#1B4332] text-white shadow-xs'
                  : 'bg-white text-stone-700 hover:bg-[#F4EFE6] border border-stone-200'
              }`}
            >
              <Icon className={`w-4 h-4 ${isActive ? 'text-emerald-300' : 'text-stone-400'}`} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* REPORT 1: Tribus con Colores Personalizables */}
      {activeReportTab === 'tribes' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {tribes.map((tribe) => {
              const members = registrations.filter((r) => r.tribeId === tribe.id);

              return (
                <div
                  key={tribe.id}
                  className="bg-white rounded-2xl border border-stone-200 shadow-xs overflow-hidden"
                >
                  <div
                    style={{ backgroundColor: tribe.colorHex }}
                    className="p-4 text-white flex items-center justify-between"
                  >
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-white/80">
                        {tribe.animalSymbol} · {tribe.colorHex}
                      </span>
                      <h4 className="text-base font-bold font-display text-white">
                        {tribe.name}
                      </h4>
                    </div>
                    <span className="font-mono text-sm font-extrabold bg-black/25 px-2.5 py-1 rounded-lg">
                      {members.length} campistas
                    </span>
                  </div>

                  <div className="p-4 divide-y divide-stone-100 max-h-60 overflow-y-auto">
                    {members.map((m) => (
                      <div key={m.id} className="py-2.5 flex items-center justify-between text-xs">
                        <div>
                          <div className="font-bold text-stone-900">{m.fullName}</div>
                          <div className="text-[11px] text-stone-500 font-mono">
                            {m.id} · {m.age} años · {m.medical.bloodType}
                          </div>
                        </div>
                        <button
                          onClick={() => setSelectedCamperForBadge(m)}
                          className="px-2 py-1 text-[11px] font-semibold text-[#1B4332] bg-emerald-50 hover:bg-emerald-100 rounded-md border border-emerald-200"
                        >
                          Gafete
                        </button>
                      </div>
                    ))}

                    {members.length === 0 && (
                      <div className="py-4 text-center text-xs text-stone-400">
                        Sin miembros asignados
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* REPORT 2: Fichas Médicas de Emergencia */}
      {activeReportTab === 'medical' && (
        <div className="bg-white rounded-2xl border border-stone-200 shadow-xs overflow-hidden">
          <div className="p-5 border-b border-stone-100 bg-red-50/40 flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-red-900 font-display flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-red-600" />
                <span>Expediente de Alergias, EpiPen y Medicación de Urgencia</span>
              </h3>
              <p className="text-xs text-red-700 mt-0.5">
                Listado prioritario para monitores, enfermería y paramédicos del campamento.
              </p>
            </div>
            <span className="text-xs font-mono font-bold text-red-800 bg-red-100 px-3 py-1 rounded-lg">
              {registrations.filter((r) => r.medical?.hasEpipen || (r.medical?.allergies && r.medical.allergies.toLowerCase().includes('sever'))).length} Alertas Críticas
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-stone-50 border-b border-stone-200 text-stone-600 uppercase tracking-wider font-bold">
                <tr>
                  <th className="py-3 px-4">Campista & Sangre</th>
                  <th className="py-3 px-4">Alergias & Diagnóstico</th>
                  <th className="py-3 px-4 text-center">EpiPen</th>
                  <th className="py-3 px-4">Medicación Diaria</th>
                  <th className="py-3 px-4">Contacto de Emergencia</th>
                  <th className="py-3 px-4 text-right">Gafete</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100 font-medium text-stone-700">
                {registrations.map((camper) => {
                  const isSevere = Boolean(camper.medical?.hasEpipen || (camper.medical?.allergies && camper.medical.allergies.toLowerCase().includes('sever')));

                  return (
                    <tr
                      key={camper.id}
                      className={isSevere ? 'bg-red-50/40 hover:bg-red-50' : 'hover:bg-stone-50'}
                    >
                      <td className="py-3 px-4">
                        <div className="font-bold text-stone-900">{camper.fullName}</div>
                        <div className="text-[11px] font-mono text-stone-500">
                          {camper.id} · <span className="font-bold text-red-600">{camper.medical?.bloodType || 'N/A'}</span>
                        </div>
                      </td>

                      <td className="py-3 px-4 max-w-xs">
                        <div className="font-medium text-stone-900">
                          {camper.medical.allergies || 'Sin alergias'}
                        </div>
                        {camper.medical.dietaryRestrictions && (
                          <div className="text-[11px] text-stone-500">
                            Dieta: {camper.medical.dietaryRestrictions}
                          </div>
                        )}
                      </td>

                      <td className="py-3 px-4 text-center">
                        {camper.medical.hasEpipen ? (
                          <span className="px-2 py-0.5 rounded text-[10px] font-extrabold bg-red-600 text-white">
                            SI (PORTA)
                          </span>
                        ) : (
                          <span className="text-stone-400 font-mono">No</span>
                        )}
                      </td>

                      <td className="py-3 px-4 text-stone-800">
                        {camper.medical.dailyMedications || 'Ninguna'}
                      </td>

                      <td className="py-3 px-4">
                        <div className="font-bold text-stone-900">
                          {camper.medical.emergencyContact1Name} ({camper.medical.emergencyContact1Relation})
                        </div>
                        <div className="font-mono text-emerald-800 font-bold text-[11px]">
                          {camper.medical.emergencyContact1Phone}
                        </div>
                      </td>

                      <td className="py-3 px-4 text-right">
                        <button
                          onClick={() => setSelectedCamperForBadge(camper)}
                          className="px-2.5 py-1 text-xs font-semibold text-[#1B4332] bg-emerald-50 hover:bg-emerald-100 rounded-lg border border-emerald-200"
                        >
                          Ver QR
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* REPORT 3: Matriz de Ocupación de Cursos */}
      {activeReportTab === 'courses' && (
        <div className="bg-white rounded-2xl border border-stone-200 shadow-xs overflow-hidden">
          <div className="p-5 border-b border-stone-100 flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-stone-900 font-display">
                Ocupación y Capacidad por Taller
              </h3>
              <p className="text-xs text-stone-500">
                Monitoreo de talleres llenos (20/20, 25/25) y cupos remanentes
              </p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-stone-50 border-b border-stone-200 text-stone-600 uppercase tracking-wider font-bold">
                <tr>
                  <th className="py-3 px-4">Curso</th>
                  <th className="py-3 px-4">Día & Horario</th>
                  <th className="py-3 px-4">Instructor</th>
                  <th className="py-3 px-4 text-center">Cupo / Ocupación</th>
                  <th className="py-3 px-4 text-right">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100 font-medium text-stone-700">
                {courses.map((c) => {
                  const isFull = c.enrolledCount >= c.maxCapacity;
                  const percent = Math.round((c.enrolledCount / c.maxCapacity) * 100);

                  return (
                    <tr key={c.id} className="hover:bg-stone-50">
                      <td className="py-3 px-4 font-bold text-stone-900">
                        {c.title}
                        <div className="text-[11px] font-normal text-stone-500">
                          {c.category} · {c.location}
                        </div>
                      </td>

                      <td className="py-3 px-4 font-mono">
                        {c.day.split(' ')[0]} {c.timeSlot}
                      </td>

                      <td className="py-3 px-4 text-stone-800">
                        Prof. {c.instructor}
                      </td>

                      <td className="py-3 px-4 text-center">
                        <span className="font-mono font-bold tabular-nums">
                          {c.enrolledCount} / {c.maxCapacity} ({percent}%)
                        </span>
                      </td>

                      <td className="py-3 px-4 text-right">
                        {isFull ? (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-red-100 text-red-800">
                            LLENO (AGOTADO)
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">
                            {c.maxCapacity - c.enrolledCount} VACANTES
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* REPORT 4: Conciliación Financiera */}
      {activeReportTab === 'finance' && (
        <div className="bg-white rounded-2xl border border-stone-200 shadow-xs overflow-hidden">
          <div className="p-5 border-b border-stone-100 flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-stone-900 font-display">
                Libro Contable de Matrículas y Pagos Recibidos
              </h3>
              <p className="text-xs text-stone-500">
                Auditoría fiscal de folios de pago, pasarela digital y aranceles
              </p>
            </div>
            <div className="text-right">
              <span className="text-[10px] text-stone-400 block uppercase font-bold">Total Recaudado</span>
              <span className="text-xl font-extrabold font-mono text-[#1B4332]">
                {registrations.reduce((acc, r) => acc + r.payment.totalAmount, 0).toLocaleString()} Bs
              </span>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-stone-50 border-b border-stone-200 text-stone-600 uppercase tracking-wider font-bold">
                <tr>
                  <th className="py-3 px-4">Folio Transacción</th>
                  <th className="py-3 px-4">Campista & Registro</th>
                  <th className="py-3 px-4">Fecha y Hora</th>
                  <th className="py-3 px-4">Método de Pago</th>
                  <th className="py-3 px-4 text-right">Monto Total</th>
                  <th className="py-3 px-4 text-right">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100 font-medium text-stone-700">
                {registrations.map((r) => (
                  <tr key={r.payment.id} className="hover:bg-stone-50">
                    <td className="py-3 px-4 font-mono font-bold text-stone-900">
                      {r.payment.transactionFolio}
                    </td>

                    <td className="py-3 px-4">
                      <div className="font-bold text-stone-900">{r.fullName}</div>
                      <div className="text-[11px] font-mono text-stone-500">{r.id} · {r.regional}</div>
                    </td>

                    <td className="py-3 px-4 font-mono text-stone-600">
                      {r.payment.date}
                    </td>

                    <td className="py-3 px-4 text-stone-800 font-semibold">
                      {r.payment.paymentMethod === 'cash_box' ? 'Caja Efectivo' : 'QR Simple'}
                    </td>

                    <td className="py-3 px-4 text-right font-mono font-bold text-stone-900 tabular-nums">
                      {r.payment.totalAmount} Bs
                    </td>

                    <td className="py-3 px-4 text-right">
                      {r.payment.status === 'completed' ? (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded">
                          <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                          CONCILIADO
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-800 bg-amber-100 px-2 py-0.5 rounded">
                          PENDIENTE EN CAJA
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

    </div>
  );
};
