import React, { useEffect, useState } from 'react';
import { CamperRegistration } from '../../types/camp';
import { useCamp } from '../../context/CampContext';
import { generateQrDataUrl } from '../../utils/qrGenerator';
import { CJNLogo } from './CJNLogo';
import { 
  X, 
  Printer, 
  Phone, 
  CheckCircle2, 
  Shield, 
  QrCode, 
  Trophy, 
  MapPin, 
  Award,
  ShieldAlert,
  Lock,
  HeartHandshake,
  BookOpen
} from 'lucide-react';

interface BadgeModalProps {
  camper: CamperRegistration | null;
  onClose: () => void;
}

export const BadgeModal: React.FC<BadgeModalProps> = ({ camper, onClose }) => {
  const { getTribeById, getCourseById, getChampionshipById, setActiveTab } = useCamp();
  const [qrUrl, setQrUrl] = useState<string>('');

  useEffect(() => {
    if (camper) {
      generateQrDataUrl(camper.id, '#0284C7').then((url) => setQrUrl(url));
    }
  }, [camper]);

  if (!camper) return null;

  const tribe = getTribeById(camper.tribeId);
  const tribeColor = tribe?.colorHex || '#0284C7';

  const handlePrint = () => {
    window.print();
  };

  const handleTestInScanner = () => {
    onClose();
    setActiveTab('admin-scanner');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs overflow-y-auto animate-fade-in">
      <div className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl border border-sky-100 overflow-hidden my-8">
        
        {/* Modal Top Actions */}
        <div className="flex items-center justify-between px-5 py-3.5 bg-sky-50 border-b border-sky-100">
          <div className="flex items-center gap-2">
            <CJNLogo size="sm" showSubtitle={false} />
            <span className="text-xs font-black text-[#0284C7] uppercase tracking-wider pl-2 border-l border-sky-200">
              Gafete Oficial Olimpiadas CJN
            </span>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-xl text-slate-500 hover:text-slate-900 hover:bg-slate-200 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* PRINTABLE BADGE SECTION */}
        <div id="printable-badge" className="p-6 bg-[#F8FAFC]">
          
          {/* Card Container mimicking a physical lanyard badge */}
          <div className="bg-white rounded-3xl border-2 border-sky-200 shadow-lg overflow-hidden relative">
            
            {/* Lanyard Clip Slot */}
            <div className="flex justify-center pt-2.5 pb-1 bg-slate-100 border-b border-slate-200">
              <div className="w-12 h-2.5 rounded-full bg-slate-300 border border-slate-400/50" />
            </div>

            {/* Header Banner */}
            <div
              style={{ backgroundColor: tribeColor }}
              className="text-white px-5 py-4 text-center transition-colors relative"
            >
              <div className="text-[10px] font-black uppercase tracking-widest text-white/90">
                Olimpiadas Bíblicas & Deportivas · CJN
              </div>
              <h3 className="text-lg font-black font-display tracking-tight text-white mt-0.5">
                {tribe?.name || 'Tribu Oficial'}
              </h3>
              <p className="text-[11px] text-white/90 italic font-medium">
                "{tribe?.motto || 'Por los Siglos (Rom 11:36)'}"
              </p>
            </div>

            {/* Camper Core Profile */}
            <div className="p-5 text-center">
              {/* Photo Avatar / Initials */}
              <div className="relative inline-block mx-auto mb-2">
                <div
                  style={{ borderColor: tribeColor }}
                  className="w-20 h-20 rounded-full border-4 bg-sky-50 text-[#0284C7] font-display font-black text-2xl flex items-center justify-center shadow-inner"
                >
                  {camper.fullName
                    .split(' ')
                    .map((n) => n[0])
                    .slice(0, 2)
                    .join('')}
                </div>
                {camper.payment.status === 'completed' ? (
                  <div className="absolute -bottom-1 -right-1 bg-emerald-500 text-white p-1 rounded-full shadow-xs" title="Ingreso Autorizado">
                    <CheckCircle2 className="w-4 h-4" />
                  </div>
                ) : (
                  <div className="absolute -bottom-1 -right-1 bg-red-600 text-white p-1 rounded-full shadow-xs" title="Ingreso Bloqueado">
                    <Lock className="w-4 h-4" />
                  </div>
                )}
              </div>

              {/* Status de Ingreso (Autorizado vs Bloqueado) */}
              <div className="mb-2">
                {camper.payment.status === 'completed' ? (
                  <span className="inline-flex items-center gap-1 px-3 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-black tracking-wider uppercase border border-emerald-300">
                    <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                    INGRESO AUTORIZADO · PAGO CONFIRMADO
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-3 py-0.5 rounded-full bg-red-100 text-red-800 text-[10px] font-black tracking-wider uppercase border border-red-300">
                    <ShieldAlert className="w-3 h-3 text-red-600" />
                    INGRESO BLOQUEADO · PAGO EN CAJA (SIN DESCUENTO)
                  </span>
                )}
              </div>

              <h2 className="text-xl font-black text-slate-900 font-display">
                {camper.fullName}
              </h2>

              <div className="flex flex-wrap items-center justify-center gap-1.5 text-xs text-slate-600 font-medium mt-1">
                <span className="font-mono font-bold text-[#0284C7]">{camper.id}</span>
                <span>·</span>
                <span>{camper.age} años</span>
                <span>·</span>
                <span className="flex items-center gap-1 text-[#0284C7] font-bold">
                  <MapPin className="w-3 h-3 text-[#0284C7]" />
                  {camper.regional}
                </span>
              </div>


              {/* Taller Oficial Asignado */}
              {camper.enrolledCourseIds && camper.enrolledCourseIds.length > 0 && (
                <div className="mt-2 text-left bg-sky-50/70 p-2.5 rounded-xl border border-sky-100 text-xs">
                  <span className="text-[10px] font-black text-[#0284C7] uppercase tracking-wider block">
                    Taller Matutino Oficial:
                  </span>
                  <span className="font-extrabold text-slate-900 block truncate">
                    {getCourseById(camper.enrolledCourseIds[0])?.title || 'Taller Bíblico Seleccionado'}
                  </span>
                </div>
              )}

              {/* QR Code */}
              <div className="mt-4 p-3 bg-white inline-block rounded-2xl border border-sky-100 shadow-sm relative">
                {camper.payment.status !== 'completed' && (
                  <div className="absolute inset-0 bg-red-950/20 backdrop-blur-[1px] rounded-2xl flex items-center justify-center pointer-events-none">
                    <span className="bg-red-600 text-white font-mono font-black text-[10px] px-2 py-1 rounded-lg shadow-md uppercase tracking-wider">
                      Sin Pago · No hay ingreso
                    </span>
                  </div>
                )}
                {qrUrl ? (
                  <img
                    src={qrUrl}
                    alt={`QR Credencial ${camper.id}`}
                    className="w-36 h-36 mx-auto rounded-xl"
                  />
                ) : (
                  <div className="w-36 h-36 bg-slate-100 rounded-xl flex items-center justify-center">
                    <QrCode className="w-8 h-8 text-slate-400 animate-spin" />
                  </div>
                )}
                <div className={`text-[10px] font-mono mt-1.5 uppercase font-bold ${
                  camper.payment.status === 'completed' ? 'text-emerald-700' : 'text-red-700'
                }`}>
                  {camper.payment.status === 'completed'
                    ? 'Acceso Acreditado · Puerta CJN'
                    : 'Pagar en Recepción (Sin Descuento)'}
                </div>
              </div>

              {/* Disciplinas Deportivas / Competencias de Delegación */}
              {camper.enrolledChampionshipIds && camper.enrolledChampionshipIds.length > 0 && (
                <div className="mt-4 pt-3 border-t border-slate-100 text-left">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[10px] font-extrabold text-slate-700 uppercase tracking-wider">
                      {camper.isDelegate ? '★ Delegación: Competencias' : 'Disciplinas en Competencia:'}
                    </span>
                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${
                      camper.payment.status === 'completed'
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-amber-100 text-amber-800'
                    }`}>
                      {camper.payment.status === 'completed' ? '✓ Habilitadas' : '⏳ Pendiente Pago'}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {camper.enrolledChampionshipIds.map((cId) => {
                      const ch = getChampionshipById(cId);
                      if (!ch) return null;
                      return (
                        <span key={ch.id} className="text-[10px] px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-900 border border-indigo-200 font-bold">
                          🏆 {ch.sport}
                        </span>
                      );
                    })}
                  </div>
                  {camper.payment.status !== 'completed' && (
                    <p className="text-[9px] text-amber-750 text-slate-500 mt-1 italic">
                      * Las competencias se habilitan en el sistema tras liquidar el saldo en Caja.
                    </p>
                  )}
                </div>
              )}

              {/* Detalle de Adelanto en Efectivo si aplica */}
              {camper.payment.paymentMethod === 'cash_box' && camper.payment.advanceAmount ? (
                <div className="mt-2 text-left bg-amber-50/80 p-2 rounded-xl border border-amber-200 text-[10px] text-amber-900">
                  <span>Adelanto en Sede: <strong>{camper.payment.advanceAmount} Bs</strong> · Saldo por Pagar en Caja: <strong>{camper.payment.remainingBalance || (450 - camper.payment.advanceAmount)} Bs</strong></span>
                </div>
              ) : null}

              {/* Contacto Personal */}
              <div className="mt-4 pt-3 border-t border-slate-100 text-xs text-slate-500 text-left">
                <div className="flex items-center gap-1.5 text-slate-700">
                  <Phone className="w-3 h-3 text-[#0284C7]" />
                  <span>Celular / WhatsApp: <strong className="text-slate-900">{camper.phone}</strong></span>
                </div>
              </div>

            </div>
          </div>
        </div>

        {/* Modal Bottom Print Actions */}
        <div className="px-6 py-4 bg-white border-t border-sky-100 flex flex-col sm:flex-row items-center justify-between gap-3">
          <button
            type="button"
            onClick={handleTestInScanner}
            className="w-full sm:w-auto text-xs font-bold text-[#0284C7] hover:underline flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <QrCode className="w-4 h-4" />
            <span>Probar en Escáner QR</span>
          </button>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button
              type="button"
              onClick={handlePrint}
              className="flex-1 sm:flex-initial px-5 py-2.5 bg-[#0284C7] hover:bg-[#0369A1] text-white text-xs font-black rounded-xl shadow-md flex items-center justify-center gap-1.5 transition-all cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              <span>Imprimir Gafete</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl cursor-pointer"
            >
              Cerrar
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
