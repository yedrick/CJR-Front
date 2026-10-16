import React, { useState } from 'react';
import { useCamp } from '../../context/CampContext';
import { useAuth } from '../../context/AuthContext';
import { CamperRegistration } from '../../types/camp';
import { 
  Banknote, 
  CheckCircle2, 
  Clock, 
  AlertCircle, 
  QrCode, 
  Search, 
  User, 
  Printer, 
  X,
  CreditCard,
  Phone
} from 'lucide-react';

export const CashierPayments: React.FC = () => {
  const { registrations, collectCashPayment, getTribeById, setSelectedCamperForBadge } = useCamp();
  const { currentUser } = useAuth();
  
  const [filter, setFilter] = useState<'pending' | 'completed' | 'all'>('pending');
  const [search, setSearch] = useState('');
  const [camperToCollect, setCamperToCollect] = useState<CamperRegistration | null>(null);
  const [cashierName, setCashierName] = useState(currentUser?.firstName ? `${currentUser.firstName} (Caja)` : 'Administrador de Caja');
  const [receiptSuccessMessage, setReceiptSuccessMessage] = useState<string | null>(null);

  const pendingCount = registrations.filter((r) => r.payment.status === 'pending_cash' || r.status === 'pending_payment').length;

  const filteredCampers = registrations.filter((r) => {
    const isPending = r.payment.status === 'pending_cash' || r.status === 'pending_payment';
    const isCompleted = r.payment.status === 'completed';

    if (filter === 'pending' && !isPending) return false;
    if (filter === 'completed' && !isCompleted) return false;

    const matchesSearch =
      r.fullName.toLowerCase().includes(search.toLowerCase()) ||
      r.id.toLowerCase().includes(search.toLowerCase()) ||
      r.phone.includes(search) ||
      r.payment.transactionFolio.toLowerCase().includes(search.toLowerCase());

    return matchesSearch;
  });

  const handleConfirmCashPayment = () => {
    if (!camperToCollect) return;

    const updated = collectCashPayment(camperToCollect.id, cashierName);
    if (updated) {
      setReceiptSuccessMessage(
        `¡Pago en efectivo de ${updated.payment.totalAmount} Bs cobrado con éxito! Folio: ${updated.payment.transactionFolio}. Se ha activado la inscripción y su código QR de ingreso.`
      );
      setCamperToCollect(null);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8 animate-fade-in">
      
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-[#E6DEC8]">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold text-amber-800 uppercase tracking-widest">
            <Banknote className="w-4 h-4 text-amber-600" />
            <span>Módulo de Recepción y Tesorería</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-[#1B4332] font-display mt-0.5">
            Gestión de Verificación y Pagos en Caja (Efectivo)
          </h2>
          <p className="text-xs text-stone-600 mt-1">
            Visualiza a los campistas registrados pendientes de pago en línea y registra cobros directos en caja para validar su inscripción y acceso.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs font-mono font-bold text-amber-900 bg-amber-50 border border-amber-200 px-3 py-1.5 rounded-xl shadow-2xs">
            {pendingCount} Pendientes de Cobro en Caja
          </span>
        </div>
      </div>

      {receiptSuccessMessage && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl text-xs text-emerald-900 font-bold flex items-center justify-between animate-fade-in">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            <span>{receiptSuccessMessage}</span>
          </div>
          <button
            onClick={() => setReceiptSuccessMessage(null)}
            className="text-emerald-700 hover:text-emerald-900 font-normal text-xs"
          >
            ✕
          </button>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-stone-200 shadow-xs">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Buscar por estudiante, ID o WhatsApp..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-xs bg-stone-50 border border-stone-200 rounded-xl focus:ring-2 focus:ring-[#1B4332] text-stone-900"
          />
        </div>

        {/* Status Tabs */}
        <div className="flex items-center gap-1.5 p-1 bg-stone-100 rounded-xl text-xs font-semibold w-full sm:w-auto">
          <button
            type="button"
            onClick={() => setFilter('pending')}
            className={`px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 ${
              filter === 'pending'
                ? 'bg-amber-600 text-white shadow-xs'
                : 'text-stone-600 hover:text-stone-900'
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            <span>Pendientes ({pendingCount})</span>
          </button>
          <button
            type="button"
            onClick={() => setFilter('completed')}
            className={`px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 ${
              filter === 'completed'
                ? 'bg-[#1B4332] text-white shadow-xs'
                : 'text-stone-600 hover:text-stone-900'
            }`}
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Cobrados / Validados</span>
          </button>
          <button
            type="button"
            onClick={() => setFilter('all')}
            className={`px-3 py-1.5 rounded-lg transition-colors ${
              filter === 'all'
                ? 'bg-stone-800 text-white shadow-xs'
                : 'text-stone-600 hover:text-stone-900'
            }`}
          >
            Todos ({registrations.length})
          </button>
        </div>
      </div>

      {/* Campers Table for Cashier */}
      <div className="bg-white rounded-2xl border border-stone-200 overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-stone-50 border-b border-stone-200 text-stone-600 uppercase tracking-wider font-bold">
              <tr>
                <th className="py-3.5 px-4">Campamentista</th>
                <th className="py-3.5 px-4">Ciudad / Regional</th>
                <th className="py-3.5 px-4">Tribu Asignada</th>
                <th className="py-3.5 px-4 text-center">Estado del Pago</th>
                <th className="py-3.5 px-4 text-right">Monto a Cobrar</th>
                <th className="py-3.5 px-4 text-right">Acción de Caja</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100 font-medium text-stone-700">
              {filteredCampers.map((camper) => {
                const tribe = getTribeById(camper.tribeId);
                const isPending = camper.payment.status === 'pending_cash' || camper.status === 'pending_payment';

                return (
                  <tr
                    key={camper.id}
                    className={`hover:bg-stone-50/80 transition-colors ${
                      isPending ? 'bg-amber-50/30' : ''
                    }`}
                  >
                    {/* Name & ID */}
                    <td className="py-3.5 px-4">
                      <div className="font-bold text-stone-900 text-sm font-display">
                        {camper.fullName}
                      </div>
                      <div className="text-[11px] text-stone-500 font-mono mt-0.5 flex items-center gap-2">
                        <span>ID: {camper.id}</span>
                        <span>·</span>
                        <span className="flex items-center gap-1 text-emerald-800 font-bold">
                          <Phone className="w-2.5 h-2.5" />
                          {camper.phone}
                        </span>
                      </div>
                    </td>

                    {/* City & Regional */}
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <div className="font-semibold text-stone-900">{camper.regional}</div>
                      <div className="text-[10px] text-stone-400 font-medium">Regional CJN</div>
                    </td>

                    {/* Tribe */}
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <span
                          className="w-3.5 h-3.5 rounded-full shrink-0 shadow-xs"
                          style={{ backgroundColor: tribe?.colorHex || '#1B4332' }}
                        />
                        <span className="font-bold text-stone-800">
                          {tribe?.name || 'Tribu'}
                        </span>
                      </div>
                      <span className="text-[10px] text-stone-400 block mt-0.5">
                        {camper.enrolledCourseIds.length} talleres · {camper.enrolledChampionshipIds.length} campeonatos
                      </span>
                    </td>

                    {/* Payment status badge */}
                    <td className="py-3.5 px-4 text-center">
                      {isPending ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[10px] font-extrabold bg-amber-100 text-amber-900 border border-amber-300 uppercase">
                          <Clock className="w-3 h-3 text-amber-700" />
                          PENDIENTE EN CAJA
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[10px] font-bold bg-emerald-100 text-emerald-800 uppercase">
                          <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                          PAGADO ({camper.payment.paymentMethod === 'cash_box' ? 'EFECTIVO' : 'QR BANCO'})
                        </span>
                      )}
                    </td>

                    {/* Amount */}
                    <td className="py-3.5 px-4 text-right font-mono font-bold text-stone-900 text-sm tabular-nums">
                      {camper.payment.totalAmount} Bs
                    </td>

                    {/* Action */}
                    <td className="py-3.5 px-4 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-2">
                        {isPending ? (
                          <button
                            type="button"
                            onClick={() => setCamperToCollect(camper)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-white bg-amber-600 hover:bg-amber-700 rounded-lg shadow-xs transition-colors"
                          >
                            <Banknote className="w-3.5 h-3.5 text-amber-200" />
                            <span>Cobrar en Caja</span>
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setSelectedCamperForBadge(camper)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-[#1B4332] bg-emerald-50 hover:bg-emerald-100 rounded-lg border border-emerald-200"
                          >
                            <QrCode className="w-3.5 h-3.5" />
                            <span>Gafete QR</span>
                          </button>
                        )}
                      </div>
                    </td>

                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal for In-Person Cashier Payment Confirmation */}
      {camperToCollect && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-stone-200 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-stone-100">
              <div className="flex items-center gap-2">
                <Banknote className="w-5 h-5 text-amber-600" />
                <h3 className="text-lg font-bold text-stone-900 font-display">
                  Cobro de Inscripción en Caja (Efectivo / POS)
                </h3>
              </div>
              <button onClick={() => setCamperToCollect(null)} className="text-stone-400 hover:text-stone-700 p-1">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="p-4 bg-stone-50 rounded-xl border border-stone-200 space-y-1.5">
                <div className="text-stone-500 font-medium">Campamentista a Acreditar:</div>
                <div className="text-base font-extrabold text-stone-900 font-display">
                  {camperToCollect.fullName}
                </div>
                <div className="text-[11px] font-mono text-stone-500">
                  {camperToCollect.id} · Regional {camperToCollect.regional}
                </div>
              </div>

              {/* Breakdown */}
              <div className="space-y-1.5 p-3.5 bg-amber-50/50 border border-amber-200 rounded-xl text-stone-700">
                <div className="p-2 bg-amber-100/70 border border-amber-300 rounded-lg text-[11px] text-amber-900 font-bold mb-2">
                  ⚠️ REGLA OFICIAL: Al pagar en efectivo en la sede, NO APLICA NINGÚN DESCUENTO de delegación (Tarifa estándar completa).
                </div>
                <div className="flex justify-between">
                  <span>Pase de Campamento Base:</span>
                  <span className="font-mono font-semibold">450 Bs</span>
                </div>
                <div className="flex justify-between text-emerald-700">
                  <span>Talleres Bíblicos:</span>
                  <span className="font-mono font-semibold">0 Bs (Incluidos)</span>
                </div>
                {camperToCollect.payment.advanceAmount && camperToCollect.payment.advanceAmount > 0 ? (
                  <div className="flex justify-between text-indigo-700 font-bold bg-indigo-50 p-1.5 rounded-lg border border-indigo-200">
                    <span>Adelanto Registrado Previamente:</span>
                    <span className="font-mono">-{camperToCollect.payment.advanceAmount} Bs</span>
                  </div>
                ) : null}
                <div className="flex justify-between text-slate-500 line-through">
                  <span>Descuentos de Delegación:</span>
                  <span className="font-mono">0 Bs (No aplicable en puerta)</span>
                </div>
                <div className="pt-2 border-t border-amber-200 flex justify-between items-center text-sm font-extrabold text-[#1B4332]">
                  <span>Total Efectivo a Cobrar en Caja:</span>
                  <span className="text-base font-mono tabular-nums text-amber-900">
                    {camperToCollect.payment.advanceAmount && camperToCollect.payment.advanceAmount > 0
                      ? Math.max(0, 450 - camperToCollect.payment.advanceAmount)
                      : 450} Bs
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-stone-700 uppercase tracking-wider mb-1">
                  Nombre del Cajero / Responsable de Recepción *
                </label>
                <input
                  type="text"
                  required
                  value={cashierName}
                  onChange={(e) => setCashierName(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-stone-50 border border-stone-200 rounded-xl text-stone-900"
                />
              </div>
            </div>

            <div className="pt-3 border-t border-stone-100 flex items-center justify-between">
              <button
                type="button"
                onClick={() => setCamperToCollect(null)}
                className="px-4 py-2 text-xs font-semibold text-stone-600 hover:bg-stone-100 rounded-lg"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmCashPayment}
                className="inline-flex items-center gap-1.5 px-5 py-2.5 text-xs font-bold text-white bg-[#1B4332] hover:bg-[#2D6A4F] rounded-xl shadow-xs"
              >
                <CheckCircle2 className="w-4 h-4 text-emerald-300" />
                <span>Confirmar Pago de {camperToCollect.payment.totalAmount} Bs</span>
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
