import React, { useEffect, useState } from 'react';
import { CamperRegistration } from '../../types/camp';
import { useCamp } from '../../context/CampContext';
import { generateQrDataUrl } from '../../utils/qrGenerator';
import { animalEmoji, colorName, formatCourseScheduleShort, formatDateRange, initials } from '../../utils/campUtils';
import { BookOpen, CalendarDays, CheckCircle2, Clock, MapPin, Trophy } from 'lucide-react';

/** Mezcla un color hex con blanco/negro (amount: -1 oscurece, 1 aclara). */
function shade(hex: string, amount: number): string {
  const n = parseInt(hex.replace('#', ''), 16);
  if (Number.isNaN(n)) return hex;
  const mix = (c: number) => Math.round(amount >= 0 ? c + (255 - c) * amount : c * (1 + amount));
  const r = mix((n >> 16) & 255);
  const g = mix((n >> 8) & 255);
  const b = mix(n & 255);
  return `#${((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1)}`;
}

interface CredentialProps {
  camper: CamperRegistration;
  id?: string;
}

/** Credencial / entrada del joven: color y tribu, campamento, talleres y QR de acceso. */
export const Credential: React.FC<CredentialProps> = ({ camper, id }) => {
  const { getTribeById, getCourseById, getChampionshipById, getCampById, championshipEntries } = useCamp();
  const [qrUrl, setQrUrl] = useState('');

  const tribe = getTribeById(camper.tribeId);
  const camp = getCampById(camper.campId);
  const color = tribe?.colorHex || '#0284C7';
  const dark = shade(color, -0.45);
  const light = shade(color, 0.88);
  const isPaid = camper.payment.status === 'completed';
  const courses = camper.enrolledCourseIds.map(getCourseById).filter(Boolean);
  const champs = camper.enrolledChampionshipIds.map(getChampionshipById).filter(Boolean);
  // Campeonatos confirmados (con el nombre del equipo); si no hay datos de inscripciones, se usan los ids de la inscripción
  const confirmedEntries = championshipEntries.filter(
    (e) => e.status === 'confirmed' && e.members.some((m) => m.registrationId === camper.id)
  );
  const champRows = confirmedEntries.length
    ? confirmedEntries.map((e) => {
        const ch = getChampionshipById(e.championshipId);
        return { id: e.id, name: ch?.name || 'Campeonato', sport: ch?.sport, team: e.type === 'team' ? e.teamName : undefined };
      })
    : champs.map((ch) => ({ id: ch!.id, name: ch!.name, sport: ch!.sport, team: undefined as string | undefined }));

  useEffect(() => {
    generateQrDataUrl(camper.qrPayload || camper.id, shade(color, -0.55)).then(setQrUrl);
  }, [camper.id, camper.qrPayload, color]);

  return (
    <div
      id={id}
      className="credential-card relative w-full max-w-[360px] mx-auto rounded-[28px] overflow-hidden shadow-2xl bg-white"
      style={{ boxShadow: `0 30px 60px -20px ${color}66` }}
    >
      {/* ── CABECERA CON COLOR DE TRIBU ─────────────────── */}
      <div
        className="relative px-6 pt-5 pb-16 text-white overflow-hidden"
        style={{ background: `linear-gradient(135deg, ${dark} 0%, ${color} 55%, ${shade(color, 0.25)} 100%)` }}
      >
        {camp?.imageUrl && (
          <img src={camp.imageUrl} alt="" className="absolute inset-0 w-full h-full object-cover opacity-20 mix-blend-luminosity" />
        )}
        <div className="absolute -right-10 -top-10 w-40 h-40 rounded-full bg-white/10" />
        <div className="absolute -left-8 bottom-0 w-28 h-28 rounded-full bg-white/10" />

        <div className="relative flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-[0.2em] text-white/85">
            <span className="w-5 h-1 rounded-full bg-white/80" />
            Credencial CJN
          </div>
          <span className="font-mono text-[10px] font-bold bg-white/20 backdrop-blur px-2 py-0.5 rounded-full">
            {camper.ticketCode}
          </span>
        </div>

        <div className="relative mt-3">
          <h3 className="text-lg font-black font-display leading-tight">{camp?.name || 'Campamento CJN'}</h3>
          {camp?.theme && <p className="text-[11px] text-white/80 font-semibold">“{camp.theme}”</p>}
        </div>
      </div>

      {/* ── AVATAR ──────────────────────────────────────── */}
      <div className="relative -mt-12 flex justify-center">
        <div className="relative">
          <div
            className="w-24 h-24 rounded-full flex items-center justify-center text-3xl font-black font-display text-white border-[5px] border-white shadow-xl"
            style={{ background: `linear-gradient(135deg, ${color}, ${dark})` }}
          >
            {initials(camper.fullName)}
          </div>
          <div className="absolute -bottom-1 -right-1 w-10 h-10 rounded-full bg-white shadow-lg flex items-center justify-center text-xl">
            {animalEmoji(tribe?.animalSymbol)}
          </div>
        </div>
      </div>

      <div className="px-6 pt-3 pb-5 text-center">
        <h2 className="text-xl font-black text-slate-900 font-display leading-tight">{camper.fullName}</h2>
        <p className="text-xs text-slate-500 font-semibold mt-0.5 flex items-center justify-center gap-1">
          <MapPin className="w-3 h-3" /> Regional {camper.regional}
          {camper.age ? <span>· {camper.age} años</span> : null}
        </p>

        {/* Tribu + color */}
        <div className="mt-4 grid grid-cols-2 gap-2 text-left">
          <div className="rounded-2xl p-3" style={{ backgroundColor: light }}>
            <span className="text-[9px] font-black uppercase tracking-wider" style={{ color: dark }}>
              Tu tribu
            </span>
            <p className="text-sm font-black text-slate-900 leading-tight mt-0.5">
              {tribe ? tribe.name.replace(/^Tribu \d+:\s*/, '') : 'Por asignar'}
            </p>
            {tribe && (
              <p className="text-[10px] font-bold mt-0.5" style={{ color: dark }}>
                Tribu N.º {tribe.number} · {tribe.animalSymbol}
              </p>
            )}
          </div>
          <div className="rounded-2xl p-3 border border-slate-100">
            <span className="text-[9px] font-black uppercase tracking-wider text-slate-400">Tu color</span>
            <div className="flex items-center gap-2 mt-1">
              <span className="w-7 h-7 rounded-lg shadow-inner border-2 border-white ring-1 ring-slate-200" style={{ backgroundColor: color }} />
              <div className="min-w-0">
                <p className="text-sm font-black text-slate-900 leading-tight">{colorName(color)}</p>
                <p className="text-[10px] font-mono text-slate-400 uppercase">{color}</p>
              </div>
            </div>
          </div>
        </div>

        {tribe?.motto && <p className="mt-2 text-[11px] italic text-slate-500">“{tribe.motto}”</p>}
        {tribe?.leaderName && <p className="text-[10px] text-slate-400 font-semibold">Líder: {tribe.leaderName}</p>}

        {/* Talleres */}
        {courses.length > 0 && (
          <div className="mt-4 text-left space-y-1.5">
            <span className="text-[9px] font-black uppercase tracking-wider text-slate-400 flex items-center gap-1">
              <BookOpen className="w-3 h-3" /> Mis talleres
            </span>
            {courses.map((c) => (
              <div key={c!.id} className="flex items-center justify-between gap-2 rounded-xl bg-slate-50 px-3 py-2">
                <span className="text-xs font-bold text-slate-800 truncate">{c!.title}</span>
                <span className="text-[10px] font-semibold text-slate-500 whitespace-nowrap flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {formatCourseScheduleShort(c!)}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Campeonatos */}
        {champRows.length > 0 && (
          <div className="mt-3 text-left space-y-1.5">
            <span className="text-[9px] font-black uppercase tracking-wider text-slate-400 flex items-center gap-1">
              <Trophy className="w-3 h-3" /> Campeonatos
            </span>
            {champRows.map((row) => (
              <div key={row.id} className="flex items-center justify-between gap-2 rounded-xl bg-amber-50 border border-amber-100 px-3 py-1.5">
                <span className="text-xs font-bold text-amber-900 truncate">{row.name}</span>
                <span className="text-[10px] font-semibold text-amber-700 whitespace-nowrap truncate max-w-[45%]">
                  {row.team ? `Equipo «${row.team}»` : row.sport || 'Individual'}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── LÍNEA PERFORADA TIPO ENTRADA ────────────────── */}
      <div className="relative h-6 flex items-center">
        <div className="absolute -left-3 w-6 h-6 rounded-full bg-slate-100 credential-notch" />
        <div className="absolute -right-3 w-6 h-6 rounded-full bg-slate-100 credential-notch" />
        <div className="w-full mx-5 border-t-2 border-dashed border-slate-200" />
      </div>

      {/* ── QR + ESTADO ─────────────────────────────────── */}
      <div className="px-6 pt-3 pb-6 flex items-center gap-4">
        <div className="relative shrink-0 p-2 rounded-2xl border-2" style={{ borderColor: light }}>
          {qrUrl ? (
            <img src={qrUrl} alt={`QR ${camper.ticketCode}`} className="w-28 h-28 rounded-lg" />
          ) : (
            <div className="w-28 h-28 rounded-lg bg-slate-100 animate-pulse" />
          )}
          {!isPaid && (
            <div className="absolute inset-0 rounded-2xl bg-white/70 backdrop-blur-[2px] flex items-center justify-center">
              <span className="text-[9px] font-black text-amber-700 bg-amber-100 px-2 py-1 rounded-md uppercase text-center leading-tight">
                Se activa al
                <br />
                confirmar pago
              </span>
            </div>
          )}
        </div>
        <div className="min-w-0 text-left space-y-1.5">
          {isPaid ? (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-black uppercase">
              <CheckCircle2 className="w-3 h-3" /> Acceso habilitado
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-100 text-amber-800 text-[10px] font-black uppercase">
              <Clock className="w-3 h-3" />
              {camper.payment.status === 'pending_verification'
                ? 'Pago en revisión'
                : camper.payment.status === 'rejected'
                ? 'Comprobante rechazado'
                : 'Pago pendiente'}
            </span>
          )}
          {camp && (
            <>
              <p className="text-[11px] font-bold text-slate-700 flex items-center gap-1">
                <CalendarDays className="w-3 h-3 text-slate-400" />
                {formatDateRange(camp.startDate, camp.endDate)}
              </p>
              <p className="text-[11px] font-semibold text-slate-500 flex items-center gap-1">
                <MapPin className="w-3 h-3 text-slate-400" /> {camp.location}
              </p>
            </>
          )}
          {!isPaid && camper.payment.remainingBalance ? (
            <p className="text-[10px] text-amber-700 font-bold">Saldo en caja: {camper.payment.remainingBalance} Bs</p>
          ) : null}
          <p className="text-[9px] text-slate-400 font-mono">Presenta este QR en el ingreso</p>
        </div>
      </div>

      <div className="h-2" style={{ background: `linear-gradient(90deg, ${dark}, ${color}, ${shade(color, 0.3)})` }} />
    </div>
  );
};
