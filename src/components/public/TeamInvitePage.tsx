import React, { useCallback, useEffect, useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  Clock,
  Crown,
  Home,
  Link2Off,
  Loader2,
  LogIn,
  MapPin,
  RefreshCw,
  Tent,
  Trophy,
  UserPlus,
  Users,
} from 'lucide-react';
import type { TeamInvite } from '../../types/camp';
import { championshipEntriesApi } from '../../api/services';
import { errorMessage, isApiError } from '../../api/errors';
import { useCamp } from '../../context/CampContext';
import { useAuth } from '../../context/AuthContext';
import { formatDateRange, initials } from '../../utils/campUtils';

type LoadState = { kind: 'loading' } | { kind: 'not_found' } | { kind: 'error'; message: string } | { kind: 'ok'; invite: TeamInvite };

/** Página pública del enlace de invitación a un equipo: /equipo/:code */
export const TeamInvitePage: React.FC = () => {
  const { routeParams, registrations, championshipEntries, joinTeam, setActiveTab, setSelectedCampId } = useCamp();
  const { currentUser, isAuthenticated, isRestoring, requireLogin } = useAuth();
  const code = (routeParams.code || '').toUpperCase();
  const [state, setState] = useState<LoadState>({ kind: 'loading' });
  const [joining, setJoining] = useState(false);

  const load = useCallback(async () => {
    if (!code) {
      setState({ kind: 'not_found' });
      return;
    }
    setState((prev) => (prev.kind === 'ok' ? prev : { kind: 'loading' }));
    try {
      setState({ kind: 'ok', invite: await championshipEntriesApi.getInvite(code) });
    } catch (e) {
      if (isApiError(e) && (e.status === 404 || e.status === 400 || e.status === 422)) setState({ kind: 'not_found' });
      else setState({ kind: 'error', message: errorMessage(e) });
    }
  }, [code]);

  // Se vuelve a cargar al cambiar de código y al iniciar/cerrar sesión (cupos y estado actualizados)
  useEffect(() => {
    load();
  }, [load, currentUser?.id]);

  if (state.kind === 'loading') return <InviteSkeleton />;

  if (state.kind === 'not_found' || state.kind === 'error') {
    const notFound = state.kind === 'not_found';
    return (
      <div className="min-h-[70vh] bg-slate-50 flex items-center justify-center px-4 py-16">
        <div className="max-w-md w-full bg-white rounded-3xl border border-slate-100 shadow-sm p-8 text-center space-y-4 animate-fade-in-scale">
          <div
            className={`w-16 h-16 rounded-3xl flex items-center justify-center mx-auto ${
              notFound ? 'bg-sky-100 text-[#0284C7]' : 'bg-red-100 text-red-600'
            }`}
          >
            {notFound ? <Link2Off className="w-8 h-8" /> : <AlertTriangle className="w-8 h-8" />}
          </div>
          <div>
            <h2 className="text-2xl font-black text-slate-900 font-display">{notFound ? 'Enlace no válido' : 'No pudimos abrir la invitación'}</h2>
            <p className="text-sm text-slate-500 mt-2">
              {notFound
                ? 'Este enlace de invitación no existe o el equipo fue anulado. Pídele a tu capitán que te comparta el enlace nuevamente.'
                : state.message}
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-2 justify-center">
            {!notFound && (
              <button
                type="button"
                onClick={load}
                className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-2xl bg-[#0284C7] hover:bg-[#0369A1] text-white font-black text-sm shadow cursor-pointer"
              >
                <RefreshCw className="w-4 h-4" /> Reintentar
              </button>
            )}
            <button
              type="button"
              onClick={() => setActiveTab('championships')}
              className={`inline-flex items-center justify-center gap-2 px-5 py-3 rounded-2xl font-black text-sm cursor-pointer ${
                notFound ? 'bg-[#0284C7] hover:bg-[#0369A1] text-white shadow' : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
              }`}
            >
              <Trophy className="w-4 h-4" /> Ver campeonatos
            </button>
          </div>
        </div>
      </div>
    );
  }

  const invite = state.invite;
  const { championship: ch, camp } = invite;
  const max = ch.maxTeamSize || 0;
  const min = ch.minTeamSize || 1;
  const count = invite.members.length;

  // ── Estado del visitante ──────────────────────────────
  const myRegs = currentUser ? registrations.filter((r) => r.userId === currentUser.id && r.campId === camp.id && r.status !== 'cancelled') : [];
  const reg = myRegs.find((r) => r.payment.status === 'completed') || myRegs[0];
  const myEntry = reg
    ? championshipEntries.find((e) => e.inviteCode?.toUpperCase() === code && e.members.some((m) => m.registrationId === reg.id))
    : undefined;
  const otherEntry = reg
    ? championshipEntries.find(
        (e) =>
          e.championshipId === ch.id &&
          e.status !== 'cancelled' &&
          e.inviteCode?.toUpperCase() !== code &&
          e.members.some((m) => m.registrationId === reg.id)
      )
    : undefined;
  const genderMismatch =
    !!reg?.gender &&
    ((ch.genderCategory === 'Varonil' && reg.gender !== 'M') || (ch.genderCategory === 'Femenil' && reg.gender !== 'F'));

  const goEnroll = () => {
    setSelectedCampId(camp.id);
    setActiveTab('enroll');
  };

  const goHub = (id: string) => {
    setActiveTab('registration-detail', { id });
    try {
      window.history.replaceState(window.history.state, '', `${window.location.pathname}?seccion=equipos`);
    } catch {
      /* sin historial */
    }
  };

  const handleJoin = async () => {
    if (!reg || joining) return;
    setJoining(true);
    let ok = false;
    try {
      ok = !!(await joinTeam(code, reg.id));
    } finally {
      setJoining(false);
    }
    if (ok) goHub(reg.id);
    else load(); // refresca cupos/estado si el servidor rechazó (409)
  };

  let panel: React.ReactNode;
  if (isRestoring) {
    panel = <div className="h-24 rounded-2xl bg-slate-100 animate-pulse" />;
  } else if (!isAuthenticated) {
    panel = (
      <ActionPanel
        tone="sky"
        icon={UserPlus}
        title={`${invite.captainName || 'Tu capitán'} te invita a su equipo`}
        text={`Para unirte necesitas una cuenta y tu inscripción pagada en ${camp.name}. Si ya tienes cuenta, inicia sesión y vuelve a esta página.`}
      >
        <button type="button" onClick={() => requireLogin('login')} className={BTN_PRIMARY}>
          <LogIn className="w-4 h-4" /> Iniciar sesión
        </button>
        <button type="button" onClick={goEnroll} className={BTN_SECONDARY}>
          <Tent className="w-4 h-4" /> Crear cuenta e inscribirme al campamento
        </button>
      </ActionPanel>
    );
  } else if (myEntry) {
    panel = (
      <ActionPanel tone="emerald" icon={CheckCircle2} title="¡Ya eres parte de este equipo!" text="Revisa a tus compañeros y los detalles del campeonato en «Mi campamento».">
        <button type="button" onClick={() => goHub(reg!.id)} className={BTN_PRIMARY}>
          Ir a Mi campamento <ArrowRight className="w-4 h-4" />
        </button>
      </ActionPanel>
    );
  } else if (!reg) {
    panel = (
      <ActionPanel
        tone="amber"
        icon={Tent}
        title={`Primero inscríbete a ${camp.name}`}
        text="Solo pueden unirse jóvenes inscritos en este campamento y con el pago confirmado. Compra tu entrada y vuelve a abrir este enlace."
      >
        <button type="button" onClick={goEnroll} className={BTN_PRIMARY}>
          <Tent className="w-4 h-4" /> Inscribirme al campamento
        </button>
      </ActionPanel>
    );
  } else if (reg.payment.status !== 'completed') {
    panel = (
      <ActionPanel
        tone="amber"
        icon={Clock}
        title="Tu pago del campamento aún no está confirmado"
        text={
          reg.payment.status === 'rejected'
            ? 'Tesorería rechazó tu comprobante. Sube uno nuevo y, cuando se confirme tu pago, podrás unirte con este mismo enlace.'
            : 'Podrás unirte al equipo cuando tesorería confirme tu pago. Guarda este enlace y vuelve a abrirlo luego.'
        }
      >
        <button type="button" onClick={() => setActiveTab('registration-detail', { id: reg.id })} className={BTN_PRIMARY}>
          Ver mi pago <ArrowRight className="w-4 h-4" />
        </button>
      </ActionPanel>
    );
  } else if (invite.entryStatus !== 'confirmed') {
    panel = (
      <ActionPanel
        tone="amber"
        icon={Clock}
        title="El equipo aún no está confirmado"
        text="El enlace se activa cuando se confirme el pago de inscripción del equipo. Vuelve a intentarlo en un rato o avísale a tu capitán."
      >
        <button type="button" onClick={load} className={BTN_SECONDARY}>
          <RefreshCw className="w-4 h-4" /> Volver a comprobar
        </button>
      </ActionPanel>
    );
  } else if (genderMismatch) {
    panel = (
      <ActionPanel
        tone="amber"
        icon={AlertTriangle}
        title={`Este campeonato es de categoría ${ch.genderCategory.toLowerCase()}`}
        text="Según tu inscripción no puedes participar en esta categoría. Revisa los demás campeonatos de tu campamento."
      >
        <button type="button" onClick={() => goHub(reg.id)} className={BTN_SECONDARY}>
          Ir a Mi campamento <ArrowRight className="w-4 h-4" />
        </button>
      </ActionPanel>
    );
  } else if (otherEntry) {
    panel = (
      <ActionPanel
        tone="amber"
        icon={AlertTriangle}
        title="Ya participas en este campeonato"
        text={`Estás inscrito${otherEntry.teamName ? ` con el equipo «${otherEntry.teamName}»` : ''}. Para unirte a este equipo primero debes salir del otro.`}
      >
        <button type="button" onClick={() => goHub(reg.id)} className={BTN_SECONDARY}>
          Ver mis equipos <ArrowRight className="w-4 h-4" />
        </button>
      </ActionPanel>
    );
  } else if (max > 0 && invite.slotsLeft <= 0) {
    panel = (
      <ActionPanel tone="amber" icon={Users} title="El equipo ya está completo" text="Ya no quedan lugares en este equipo. Puedes crear tu propio equipo desde «Mi campamento».">
        <button type="button" onClick={() => goHub(reg.id)} className={BTN_SECONDARY}>
          Ir a Mi campamento <ArrowRight className="w-4 h-4" />
        </button>
      </ActionPanel>
    );
  } else {
    panel = (
      <ActionPanel
        tone="sky"
        icon={UserPlus}
        title={`¡Únete a «${invite.teamName}»!`}
        text={`Te unirás con tu inscripción ${reg.ticketCode}. ${invite.slotsLeft === 1 ? 'Queda 1 lugar' : `Quedan ${invite.slotsLeft} lugares`}.`}
      >
        <button type="button" onClick={handleJoin} disabled={joining} className={`${BTN_PRIMARY} disabled:opacity-60 disabled:cursor-wait`}>
          {joining ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
          {joining ? 'Uniéndote…' : 'Unirme al equipo'}
        </button>
      </ActionPanel>
    );
  }

  return (
    <div className="min-h-[70vh] bg-slate-50 pb-16">
      {/* ── CABECERA ─────────────────────────────────────── */}
      <div className="relative overflow-hidden bg-slate-900 text-white">
        {ch.imageUrl && <img src={ch.imageUrl} alt="" className="absolute inset-0 w-full h-full object-cover opacity-40" />}
        <div className="absolute inset-0 bg-gradient-to-br from-slate-950/95 via-sky-950/80 to-[#0284C7]/50" />
        <div className="relative max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-14 text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 border border-white/20 text-[11px] font-black uppercase tracking-widest text-sky-100">
            <Trophy className="w-3.5 h-3.5" /> Invitación a un equipo
          </div>
          <h1 className="mt-4 text-3xl sm:text-5xl font-black font-display leading-tight tracking-tight break-words">{invite.teamName}</h1>
          <p className="mt-2 text-sm sm:text-base text-sky-100 font-semibold">
            {ch.name} · {ch.sport} · {ch.genderCategory}
          </p>
          <p className="mt-1 text-xs text-sky-200 flex items-center justify-center gap-1.5">
            <Crown className="w-3.5 h-3.5 text-amber-300" /> Capitán: {invite.captainName || '—'}
          </p>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 -mt-6 relative space-y-5">
        <div className="bg-white rounded-3xl border border-slate-100 shadow-lg p-4 sm:p-6">{panel}</div>

        <div className="grid md:grid-cols-5 gap-5">
          {/* Integrantes */}
          <section className="md:col-span-3 bg-white rounded-3xl border border-slate-100 shadow-sm p-5 sm:p-6 space-y-4">
            <div className="flex items-baseline justify-between gap-3">
              <h2 className="text-base font-black text-slate-900 font-display flex items-center gap-2">
                <Users className="w-5 h-5 text-[#0284C7]" /> Integrantes
              </h2>
              <span className="text-xs font-bold text-slate-500">
                <span className="font-mono text-slate-900">
                  {count}/{max || '—'}
                </span>{' '}
                (mín. {min})
              </span>
            </div>
            <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
              <div
                className={`h-full rounded-full ${count >= min ? 'bg-emerald-500' : 'bg-amber-400'}`}
                style={{ width: `${max ? Math.min(100, (count / max) * 100) : 100}%` }}
              />
            </div>
            <ul className="grid sm:grid-cols-2 gap-2">
              {invite.members.map((m, i) => (
                <li key={`${m.fullName}-${i}`} className="flex items-center gap-3 rounded-2xl border border-slate-100 px-3 py-2.5">
                  <span
                    className={`w-9 h-9 rounded-xl flex items-center justify-center text-xs font-black shrink-0 ${
                      m.role === 'captain' ? 'bg-amber-100 text-amber-700' : 'bg-sky-100 text-sky-700'
                    }`}
                  >
                    {initials(m.fullName)}
                  </span>
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-slate-800 truncate">{m.fullName}</p>
                    <p className="text-[10px] text-slate-400 font-semibold">{m.role === 'captain' ? 'Capitán' : 'Integrante'}</p>
                  </div>
                  {m.role === 'captain' && <Crown className="w-4 h-4 text-amber-500 ml-auto shrink-0" />}
                </li>
              ))}
              {max > 0 &&
                Array.from({ length: Math.min(invite.slotsLeft, 4) }).map((_, i) => (
                  <li
                    key={`slot-${i}`}
                    className="flex items-center gap-3 rounded-2xl border-2 border-dashed border-slate-200 px-3 py-2.5 text-slate-400"
                  >
                    <span className="w-9 h-9 rounded-xl bg-slate-50 flex items-center justify-center shrink-0">
                      <UserPlus className="w-4 h-4" />
                    </span>
                    <span className="text-xs font-bold">Lugar disponible</span>
                  </li>
                ))}
            </ul>
            {invite.slotsLeft > 4 && <p className="text-[11px] text-slate-500 font-semibold">… y {invite.slotsLeft - 4} lugares más.</p>}
          </section>

          {/* Detalles */}
          <aside className="md:col-span-2 space-y-5">
            <section className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
              <div className="relative h-28 bg-gradient-to-br from-sky-500 to-indigo-600">
                {ch.imageUrl && <img src={ch.imageUrl} alt="" className="absolute inset-0 w-full h-full object-cover" />}
                <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 to-transparent" />
                <div className="absolute bottom-3 left-4 right-4 text-white">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-sky-200">{ch.sport}</div>
                  <h3 className="text-base font-black font-display leading-tight">{ch.name}</h3>
                </div>
              </div>
              <div className="p-4 space-y-1.5 text-xs text-slate-600 font-semibold">
                <p className="flex items-center gap-1.5">
                  <Trophy className="w-3.5 h-3.5 text-slate-400" /> Categoría {ch.genderCategory}
                </p>
                {ch.schedule && (
                  <p className="flex items-start gap-1.5">
                    <CalendarDays className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-px" /> {ch.schedule}
                  </p>
                )}
                <p className="flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5 text-slate-400" /> Equipos de {min} a {max || '—'} integrantes
                </p>
              </div>
            </section>

            <section className="bg-white rounded-3xl border border-slate-100 shadow-sm p-4 space-y-1.5">
              <div className="text-[10px] font-black uppercase tracking-widest text-[#0284C7] flex items-center gap-1.5">
                <Tent className="w-3.5 h-3.5" /> Campamento
              </div>
              <h3 className="text-sm font-black text-slate-900">{camp.name}</h3>
              <p className="text-xs text-slate-600 font-semibold flex items-center gap-1.5">
                <CalendarDays className="w-3.5 h-3.5 text-slate-400" /> {formatDateRange(camp.startDate, camp.endDate)}
              </p>
              <p className="text-xs text-slate-600 font-semibold flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-slate-400" /> {camp.location}
              </p>
            </section>

            <button
              type="button"
              onClick={() => setActiveTab('catalog')}
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-2xl bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 font-bold text-xs cursor-pointer"
            >
              <Home className="w-4 h-4" /> Ir al inicio
            </button>
          </aside>
        </div>
      </div>
    </div>
  );
};

const BTN_PRIMARY =
  'inline-flex items-center justify-center gap-2 px-5 py-3 rounded-2xl bg-[#0284C7] hover:bg-[#0369A1] text-white font-black text-sm shadow-md cursor-pointer transition-all active:scale-95';
const BTN_SECONDARY =
  'inline-flex items-center justify-center gap-2 px-5 py-3 rounded-2xl bg-white border border-sky-200 text-sky-700 hover:bg-sky-50 font-black text-sm cursor-pointer transition-all active:scale-95';

const TONES = {
  sky: 'bg-sky-100 text-[#0284C7]',
  emerald: 'bg-emerald-100 text-emerald-600',
  amber: 'bg-amber-100 text-amber-600',
} as const;

const ActionPanel: React.FC<{
  tone: keyof typeof TONES;
  icon: React.ElementType;
  title: string;
  text: string;
  children?: React.ReactNode;
}> = ({ tone, icon: Icon, title, text, children }) => (
  <div className="flex flex-col sm:flex-row sm:items-center gap-4 animate-fade-in">
    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${TONES[tone]}`}>
      <Icon className="w-6 h-6" />
    </div>
    <div className="flex-1 min-w-0">
      <h2 className="text-base sm:text-lg font-black text-slate-900 font-display leading-tight">{title}</h2>
      <p className="text-xs sm:text-sm text-slate-500 mt-1">{text}</p>
    </div>
    {children && <div className="flex flex-col sm:flex-row lg:flex-col xl:flex-row gap-2 sm:shrink-0 [&>button]:w-full sm:[&>button]:w-auto">{children}</div>}
  </div>
);

const InviteSkeleton: React.FC = () => (
  <div className="min-h-[70vh] bg-slate-50 pb-16" aria-busy="true" aria-label="Cargando invitación">
    <div className="bg-slate-800 h-52 sm:h-60 animate-pulse" />
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 -mt-6 relative space-y-5">
      <div className="bg-white rounded-3xl border border-slate-100 shadow-lg p-6 flex gap-4">
        <div className="w-12 h-12 rounded-2xl bg-slate-100 animate-pulse" />
        <div className="flex-1 space-y-2">
          <div className="h-4 w-1/2 rounded bg-slate-100 animate-pulse" />
          <div className="h-3 w-3/4 rounded bg-slate-100 animate-pulse" />
        </div>
      </div>
      <div className="grid md:grid-cols-5 gap-5">
        <div className="md:col-span-3 h-64 bg-white rounded-3xl border border-slate-100 animate-pulse" />
        <div className="md:col-span-2 h-64 bg-white rounded-3xl border border-slate-100 animate-pulse" />
      </div>
    </div>
  </div>
);
