import React, { useState } from 'react';
import { useCamp } from '../../context/CampContext';
import { CamperRegistration } from '../../types/camp';
import { 
  Users, 
  Search, 
  AlertTriangle, 
  Phone, 
  QrCode, 
  HeartPulse, 
  CheckCircle2, 
  FileText, 
  X,
  CreditCard
} from 'lucide-react';

export const CampersRoster: React.FC = () => {
  const { registrations, tribes, getTribeById, getCourseById, setSelectedCamperForBadge } = useCamp();
  const [search, setSearch] = useState('');
  const [selectedTribeFilter, setSelectedTribeFilter] = useState('ALL');
  const [onlyMedicalAlerts, setOnlyMedicalAlerts] = useState(false);
  const [selectedCamperDossier, setSelectedCamperDossier] = useState<CamperRegistration | null>(null);

  const filteredCampers = registrations.filter((c) => {
    const matchesSearch =
      c.fullName.toLowerCase().includes(search.toLowerCase()) ||
      c.id.toLowerCase().includes(search.toLowerCase()) ||
      c.regional.toLowerCase().includes(search.toLowerCase()) ||
      (c.delegateRole?.toLowerCase().includes(search.toLowerCase()) ?? false) ||
      (c.guardianName?.toLowerCase().includes(search.toLowerCase()) ?? false) ||
      (c.guardianPhone?.includes(search) ?? false) ||
      c.email.toLowerCase().includes(search.toLowerCase());
    const matchesTribe = selectedTribeFilter === 'ALL' || c.tribeId === selectedTribeFilter;
    const hasMedicalAlert = Boolean(c.medical?.hasEpipen || (c.medical?.allergies && c.medical.allergies.toLowerCase().includes('sever')));
    const matchesAlerts = !onlyMedicalAlerts || hasMedicalAlert;

    return matchesSearch && matchesTribe && matchesAlerts;
  });

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6 animate-fade-in">
      
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-[#E6DEC8]">
        <div>
          <span className="text-xs font-bold text-emerald-800 uppercase tracking-widest">
            Fichas Clínicas y Registro de Participantes
          </span>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-[#1B4332] font-display mt-0.5">
            Expedientes de Estudiantes y Documentación Médica
          </h2>
          <p className="text-xs text-stone-600 mt-1">
            Supervisión de alergias, medicamentos, autorizaciones legales, contactos de urgencia y gafetes QR.
          </p>
        </div>

        <div className="text-xs font-mono font-bold text-stone-600 bg-white px-3.5 py-2 rounded-xl border border-stone-200 shadow-2xs self-start sm:self-auto">
          {filteredCampers.length} de {registrations.length} estudiantes
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-3 bg-white p-4 rounded-2xl border border-stone-200 shadow-xs items-center">
        
        {/* Search */}
        <div className="md:col-span-5 relative">
          <Search className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Buscar por estudiante, ID, tutor o teléfono..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-3 py-2 text-xs bg-stone-50 border border-stone-200 rounded-xl focus:ring-2 focus:ring-[#1B4332] text-stone-900"
          />
        </div>

        {/* Tribe Filter */}
        <div className="md:col-span-4">
          <select
            value={selectedTribeFilter}
            onChange={(e) => setSelectedTribeFilter(e.target.value)}
            className="w-full px-3 py-2 text-xs bg-stone-50 border border-stone-200 rounded-xl focus:ring-2 focus:ring-[#1B4332] text-stone-800"
          >
            <option value="ALL">Todas las tribus de color ({tribes.length})</option>
            {tribes.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </div>

        {/* Medical Alert Filter Toggle */}
        <div className="md:col-span-3">
          <label className="flex items-center gap-2 text-xs font-semibold text-stone-700 cursor-pointer p-2 rounded-xl bg-stone-50 border border-stone-200 hover:bg-stone-100">
            <input
              type="checkbox"
              checked={onlyMedicalAlerts}
              onChange={(e) => setOnlyMedicalAlerts(e.target.checked)}
              className="w-4 h-4 accent-red-600 rounded"
            />
            <span className="flex items-center gap-1 text-red-700 font-bold">
              <AlertTriangle className="w-3.5 h-3.5" />
              Solo Alertas Médicas
            </span>
          </label>
        </div>

      </div>

      {/* Campers Table */}
      <div className="bg-white rounded-2xl border border-stone-200 overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-stone-50 border-b border-stone-200 text-stone-600 uppercase tracking-wider font-bold">
              <tr>
                <th className="py-3.5 px-4">Estudiante & ID</th>
                <th className="py-3.5 px-4">Tribu / Categoría</th>
                <th className="py-3.5 px-4">Ficha Médica & Alergias</th>
                <th className="py-3.5 px-4">Contacto de Emergencia</th>
                <th className="py-3.5 px-4">Cursos Matriculados</th>
                <th className="py-3.5 px-4 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100 font-medium text-stone-700">
              {filteredCampers.map((camper) => {
                const tribe = getTribeById(camper.tribeId);
                const hasAlert = camper.medical.hasEpipen || (camper.medical.allergies && camper.medical.allergies.toLowerCase().includes('sever'));

                return (
                  <tr key={camper.id} className="hover:bg-stone-50/80 transition-colors">
                    
                    {/* Student Profile */}
                    <td className="py-3.5 px-4">
                      <div className="font-bold text-stone-900 text-sm font-display">
                        {camper.fullName}
                      </div>
                      <div className="text-[11px] text-stone-500 font-mono mt-0.5">
                        {camper.id} · {camper.age} años · {camper.medical.bloodType}
                      </div>
                    </td>

                    {/* Tribe with color indicator */}
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <span
                          className="w-3.5 h-3.5 rounded-full shrink-0 shadow-xs"
                          style={{ backgroundColor: tribe?.colorHex || '#1B4332' }}
                        />
                        <span className="font-bold text-stone-800">
                          {tribe?.name || 'General'}
                        </span>
                      </div>
                      <div className="text-[10px] text-stone-400 mt-0.5">
                        Líder: {tribe?.leaderName}
                      </div>
                    </td>

                    {/* Medical Flags */}
                    <td className="py-3.5 px-4">
                      {hasAlert ? (
                        <div className="p-2 bg-red-50 border border-red-200 rounded-lg max-w-xs">
                          <div className="flex items-center gap-1 text-[11px] font-bold text-red-800">
                            <AlertTriangle className="w-3 h-3 text-red-600 shrink-0" />
                            <span>{camper.medical.hasEpipen ? 'REQUIERE EPIPÈN' : 'ALERGIA SEVERA'}</span>
                          </div>
                          <p className="text-[10px] text-red-700 line-clamp-1 mt-0.5">
                            {camper.medical.allergies}
                          </p>
                        </div>
                      ) : (
                        <div className="text-stone-600 text-xs">
                          <span className="line-clamp-1">{camper.medical.allergies || 'Sin alergias'}</span>
                          <span className="text-[10px] text-stone-400 block">
                            Dieta: {camper.medical.dietaryRestrictions || 'Estándar'}
                          </span>
                        </div>
                      )}
                    </td>

                    {/* Emergency Contacts */}
                    <td className="py-3.5 px-4">
                      <div className="font-semibold text-stone-900 truncate max-w-xs">
                        {camper.medical.emergencyContact1Name}
                      </div>
                      <a
                        href={`tel:${camper.medical.emergencyContact1Phone}`}
                        className="text-[11px] text-emerald-800 font-mono font-bold hover:underline flex items-center gap-1 mt-0.5"
                      >
                        <Phone className="w-3 h-3 text-emerald-600" />
                        {camper.medical.emergencyContact1Phone}
                      </a>
                    </td>

                    {/* Enrolled Courses count */}
                    <td className="py-3.5 px-4 font-mono font-semibold text-stone-800">
                      {camper.enrolledCourseIds.length} talleres
                    </td>

                    {/* Actions */}
                    <td className="py-3.5 px-4 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => setSelectedCamperDossier(camper)}
                          className="px-2.5 py-1 text-xs font-semibold text-stone-700 bg-stone-100 hover:bg-stone-200 rounded-lg transition-colors"
                          title="Ver expediente médico completo"
                        >
                          Ficha Médica
                        </button>

                        <button
                          onClick={() => setSelectedCamperForBadge(camper)}
                          className="px-2.5 py-1 text-xs font-bold text-white bg-[#1B4332] hover:bg-[#2D6A4F] rounded-lg transition-colors shadow-2xs flex items-center gap-1"
                          title="Ver y descargar gafete oficial con QR"
                        >
                          <QrCode className="w-3.5 h-3.5" />
                          Gafete QR
                        </button>
                      </div>
                    </td>

                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Full Medical Dossier Modal */}
      {selectedCamperDossier && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-xl w-full p-6 shadow-2xl border border-stone-200 overflow-y-auto max-h-[90vh]">
            <div className="flex items-center justify-between pb-4 border-b border-stone-100">
              <div className="flex items-center gap-2">
                <HeartPulse className="w-5 h-5 text-red-600" />
                <div>
                  <h3 className="text-lg font-bold text-stone-900 font-display">
                    Expediente Clínico y Legal del Campista
                  </h3>
                  <div className="text-xs text-stone-500 font-mono">
                    {selectedCamperDossier.fullName} · {selectedCamperDossier.id}
                  </div>
                </div>
              </div>
              <button onClick={() => setSelectedCamperDossier(null)} className="text-stone-400 hover:text-stone-700">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="py-4 space-y-4 text-xs">
              
              {/* Emergency Medical Alert Box */}
              {selectedCamperDossier.medical.hasEpipen && (
                <div className="p-3 bg-red-600 text-white rounded-xl flex items-center gap-3 font-bold">
                  <AlertTriangle className="w-6 h-6 shrink-0" />
                  <div>
                    <span className="block text-sm">PROTOCOLO DE EMERGENCIA: AUTOINYECTOR EPIPÈN</span>
                    <span className="text-[11px] font-normal opacity-90">
                      El estudiante porta epinefrina en su mochila. En caso de reacción anafiláctica, actuar de inmediato y llamar al 911 / tutor.
                    </span>
                  </div>
                </div>
              )}

              {/* Clinical Details Grid */}
              <div className="grid grid-cols-2 gap-3 p-4 bg-stone-50 rounded-xl border border-stone-200">
                <div>
                  <span className="text-stone-400 font-medium block">Alergias Registradas</span>
                  <span className="font-bold text-stone-900 block mt-0.5">
                    {selectedCamperDossier.medical.allergies || 'Ninguna'}
                  </span>
                </div>

                <div>
                  <span className="text-stone-400 font-medium block">Grupo Sanguíneo</span>
                  <span className="font-bold text-red-600 text-sm font-mono block mt-0.5">
                    {selectedCamperDossier.medical.bloodType}
                  </span>
                </div>

                <div>
                  <span className="text-stone-400 font-medium block">Medicación Habitual</span>
                  <span className="font-semibold text-stone-900 block mt-0.5">
                    {selectedCamperDossier.medical.dailyMedications || 'Sin medicación prescrita'}
                  </span>
                </div>

                <div>
                  <span className="text-stone-400 font-medium block">Restricciones Alimentarias</span>
                  <span className="font-semibold text-stone-900 block mt-0.5">
                    {selectedCamperDossier.medical.dietaryRestrictions || 'Estándar'}
                  </span>
                </div>
              </div>

              {/* Emergency Contacts */}
              <div className="p-4 bg-emerald-50 rounded-xl border border-emerald-200 space-y-2">
                <span className="font-bold text-emerald-950 uppercase tracking-wider block text-[11px]">
                  Protocolo de Contactos de Urgencia
                </span>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <span className="text-emerald-800 font-medium block">Contacto 1 (Principal)</span>
                    <span className="font-bold text-stone-900 block">
                      {selectedCamperDossier.medical.emergencyContact1Name} ({selectedCamperDossier.medical.emergencyContact1Relation})
                    </span>
                    <a
                      href={`tel:${selectedCamperDossier.medical.emergencyContact1Phone}`}
                      className="font-mono text-emerald-800 font-bold hover:underline block mt-0.5"
                    >
                      {selectedCamperDossier.medical.emergencyContact1Phone}
                    </a>
                  </div>

                  <div>
                    <span className="text-emerald-800 font-medium block">Contacto 2 (Alternativo)</span>
                    <span className="font-bold text-stone-900 block">
                      {selectedCamperDossier.medical.emergencyContact2Name || 'No registrado'} ({selectedCamperDossier.medical.emergencyContact2Relation})
                    </span>
                    <a
                      href={`tel:${selectedCamperDossier.medical.emergencyContact2Phone}`}
                      className="font-mono text-emerald-800 font-bold hover:underline block mt-0.5"
                    >
                      {selectedCamperDossier.medical.emergencyContact2Phone || '-'}
                    </a>
                  </div>
                </div>
              </div>

              {/* Legal Consents and Waivers */}
              <div className="p-3 bg-stone-50 rounded-xl border border-stone-200 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span className="font-semibold text-stone-800">
                    Autorización médica firmada por tutor: {selectedCamperDossier.guardianName}
                  </span>
                </div>
                <span className="font-mono text-stone-500 text-[10px]">
                  {selectedCamperDossier.registeredAt}
                </span>
              </div>

              {/* Payment Receipt */}
              <div className="p-3 bg-stone-50 rounded-xl border border-stone-200 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CreditCard className="w-4 h-4 text-[#1B4332]" />
                  <div>
                    <span className="font-bold text-stone-900 block">
                      Total: {selectedCamperDossier.payment.totalAmount} Bs ({selectedCamperDossier.payment.paymentMethod === 'cash_box' ? 'Efectivo / Caja' : 'QR Simple'})
                    </span>
                    <span className="text-[10px] text-stone-500 font-mono">
                      Folio: {selectedCamperDossier.payment.transactionFolio}
                    </span>
                  </div>
                </div>
                <span className={`font-bold uppercase text-[10px] px-2 py-0.5 rounded ${
                  selectedCamperDossier.payment.status === 'completed' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-900'
                }`}>
                  {selectedCamperDossier.payment.status === 'completed' ? 'PAGADO' : 'PENDIENTE CAJA'}
                </span>
              </div>

            </div>

            <div className="pt-4 border-t border-stone-100 flex items-center justify-between">
              <button
                onClick={() => {
                  const c = selectedCamperDossier;
                  setSelectedCamperDossier(null);
                  setSelectedCamperForBadge(c);
                }}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-[#1B4332] hover:bg-[#2D6A4F] rounded-lg shadow-xs"
              >
                <QrCode className="w-4 h-4" />
                Emitir Gafete con QR
              </button>
              
              <button
                onClick={() => setSelectedCamperDossier(null)}
                className="px-4 py-2 font-semibold text-stone-600 hover:bg-stone-100 rounded-lg text-xs"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
