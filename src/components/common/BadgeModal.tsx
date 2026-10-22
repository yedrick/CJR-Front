import React from 'react';
import { CamperRegistration } from '../../types/camp';
import { useCamp } from '../../context/CampContext';
import { useAuth } from '../../context/AuthContext';
import { Credential } from './Credential';
import { MessageCircle, Printer, QrCode, Ticket, X } from 'lucide-react';

interface BadgeModalProps {
  camper: CamperRegistration | null;
  onClose: () => void;
}

export const BadgeModal: React.FC<BadgeModalProps> = ({ camper, onClose }) => {
  const { setActiveTab, getCampById, getTribeById } = useCamp();
  const { currentUser } = useAuth();

  if (!camper) return null;

  const camp = getCampById(camper.campId);
  const tribe = getTribeById(camper.tribeId);
  const isAdmin = !!currentUser?.permissions.includes('checkins:create');

  const shareText = encodeURIComponent(
    `¡Ya tengo mi entrada para ${camp?.name || 'el campamento CJN'}! 🔥\nTribu: ${tribe?.name || '-'}\nCódigo: ${camper.ticketCode}`
  );

  return (
    <div
      className="fixed inset-0 z-50 flex items-start sm:items-center justify-center p-4 bg-slate-950/75 backdrop-blur-sm overflow-y-auto animate-fade-in print-modal-root"
      onClick={onClose}
    >
      <div className="relative w-full max-w-md my-6" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-3 text-white no-print">
          <div className="flex items-center gap-2 text-xs font-black uppercase tracking-widest">
            <Ticket className="w-4 h-4 text-amber-300" /> Mi entrada al campamento
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl bg-white/10 hover:bg-white/20 cursor-pointer"
            aria-label="Cerrar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="rounded-[32px] bg-slate-100 p-4 sm:p-6 animate-pop-in">
          <Credential camper={camper} id="printable-credential" />
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2 no-print">
          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex items-center justify-center gap-2 py-3 rounded-2xl bg-white text-slate-900 font-black text-xs shadow hover:bg-sky-50 cursor-pointer"
          >
            <Printer className="w-4 h-4" /> Imprimir / PDF
          </button>
          <a
            href={`https://wa.me/?text=${shareText}`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center justify-center gap-2 py-3 rounded-2xl bg-emerald-500 text-white font-black text-xs shadow hover:bg-emerald-600"
          >
            <MessageCircle className="w-4 h-4" /> Compartir
          </a>
          <button
            type="button"
            onClick={() => {
              onClose();
              setActiveTab('my-registrations');
            }}
            className="col-span-2 inline-flex items-center justify-center gap-2 py-3 rounded-2xl bg-white/10 text-white font-bold text-xs border border-white/20 hover:bg-white/20 cursor-pointer"
          >
            <Ticket className="w-4 h-4" /> Ver todas mis inscripciones
          </button>
          {isAdmin && (
            <button
              type="button"
              onClick={() => {
                onClose();
                setActiveTab('admin-scanner');
              }}
              className="col-span-2 inline-flex items-center justify-center gap-2 py-2.5 rounded-2xl text-sky-200 font-bold text-xs hover:text-white cursor-pointer"
            >
              <QrCode className="w-4 h-4" /> Probar en el escáner QR
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
