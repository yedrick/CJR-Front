import React, { useEffect, useMemo, useState } from 'react';
import { useCamp } from '../../context/CampContext';
import { useAuth } from '../../context/AuthContext';
import { HERO_BACKGROUNDS } from '../../config/media';
import {
  daysUntil,
  formatDateRange,
  getCampPhase,
  isCampEnrollable,
  PHASE_META,
} from '../../utils/campUtils';
import {
  ArrowRight,
  BookOpen,
  CalendarDays,
  Check,
  Flame,
  MapPin,
  QrCode,
  Sparkles,
  Tent,
  Users,
} from 'lucide-react';

export const HeroBanner: React.FC = () => {
  const {
    setActiveTab,
    featuredCamp,
    camps,
    catalogs,
    tribes,
    registrations,
    setSelectedCampId,
    myRegistrations,
  } = useCamp();
  const { currentUser, isAuthenticated, requireLogin, can } = useAuth();
  // Solo el equipo recibe todas las inscripciones; a un campista solo le llegan las suyas
  const canSeeEnrollment = can('registrations:read');

  // Fondo: foto del campamento activo + fotos de jóvenes rotando
  const backgrounds = useMemo(
    () => Array.from(new Set([featuredCamp?.imageUrl, ...HERO_BACKGROUNDS].filter(Boolean) as string[])),
    [featuredCamp?.imageUrl]
  );
  const [bgIndex, setBgIndex] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setBgIndex((i) => (i + 1) % backgrounds.length), 6000);
    return () => clearInterval(t);
  }, [backgrounds.length]);

  const year = featuredCamp?.startDate.slice(0, 4) || String(new Date().getFullYear());
  const campsThisYear = camps.filter((c) => c.status !== 'borrador' && c.startDate.startsWith(year));
  const upcomingCount = campsThisYear.filter((c) => {
    const p = getCampPhase(c);
    return p === 'abierto' || p === 'en_curso';
  }).length;

  const phase = featuredCamp ? getCampPhase(featuredCamp) : null;
  const daysLeft = featuredCamp ? daysUntil(featuredCamp.startDate) : 0;
  const enrolledInFeatured = featuredCamp ? registrations.filter((r) => r.campId === featuredCamp.id).length : 0;
  const myFeaturedReg = featuredCamp
    ? myRegistrations.find((r) => r.campId === featuredCamp.id)
    : undefined;

  // La compra es en un solo paso: sin sesión también se va directo al formulario (crea la cuenta al pagar)
  const goEnroll = () => {
    if (featuredCamp) setSelectedCampId(featuredCamp.id);
    if (myFeaturedReg) setActiveTab('registration-detail', { id: myFeaturedReg.id });
    else setActiveTab('enroll');
  };

  const goCamps = () => {
    document.getElementById('camps-section')?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <section className="relative overflow-hidden min-h-[640px] lg:min-h-[700px] flex items-center bg-slate-950">
      {/* ── FONDO: FOTOS DE JÓVENES ─────────────────────── */}
      {backgrounds.map((src, i) => (
        <img
          key={src}
          src={src}
          alt=""
          aria-hidden
          className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-[1500ms] ${
            i === bgIndex ? 'opacity-100 animate-ken-burns' : 'opacity-0'
          }`}
        />
      ))}
      <div className="absolute inset-0 bg-gradient-to-r from-slate-950/95 via-slate-950/75 to-slate-950/30" />
      <div className="absolute inset-0 bg-gradient-to-t from-slate-950/90 via-transparent to-sky-950/40" />

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14 sm:py-20 w-full">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-14 items-center">
          {/* ── IZQUIERDA: MENSAJE ─────────────────────── */}
          <div className="lg:col-span-7 text-center lg:text-left space-y-6">
            <div className="animate-fade-in-up">
              <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/10 backdrop-blur-md border border-white/20 text-white text-[11px] font-black uppercase tracking-widest">
                <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                Comité Juvenil · Unión Cristiana Evangélica
              </span>
            </div>

            <div className="animate-fade-in-up delay-100 opacity-0" style={{ animationFillMode: 'forwards' }}>
              <h1 className="text-4xl sm:text-5xl lg:text-[4.2rem] font-black font-display text-white leading-[1.05] tracking-tight">
                Una generación
                <br />
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-sky-300 via-cyan-200 to-amber-200">
                  encendida por Cristo
                </span>
              </h1>
              <p className="text-slate-200 text-base sm:text-lg mt-4 max-w-xl mx-auto lg:mx-0 leading-relaxed">
                {campsThisYear.length} campamentos en {year} por toda Bolivia: talleres, tribus, olimpiadas y noches de
                adoración. Elige el tuyo, inscríbete en minutos y recibe tu credencial digital.
              </p>
            </div>

            <div
              className="animate-fade-in-up delay-200 opacity-0 flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-3"
              style={{ animationFillMode: 'forwards' }}
            >
              <button
                type="button"
                onClick={goEnroll}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-7 py-4 bg-gradient-to-r from-amber-400 to-orange-500 hover:from-amber-500 hover:to-orange-600 text-white font-black text-sm rounded-2xl shadow-2xl transition-all active:scale-95 animate-pulse-glow-amber cursor-pointer"
              >
                <Flame className="w-4 h-4" />
                {myFeaturedReg ? 'Ir a mi campamento' : 'Inscribirme al campamento activo'}
                <ArrowRight className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={goCamps}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-4 bg-white/10 hover:bg-white/20 backdrop-blur-md border border-white/25 text-white font-bold text-sm rounded-2xl transition-colors cursor-pointer"
              >
                <CalendarDays className="w-4 h-4 text-sky-200" />
                Ver los {campsThisYear.length} campamentos
              </button>
            </div>

            {isAuthenticated && (
              <p className="text-sm text-slate-300 animate-fade-in">
                Hola, <strong className="text-white">{currentUser?.firstName}</strong> 👋
                {myFeaturedReg ? ' ya tienes tu entrada para el campamento activo.' : ' tu lugar te está esperando.'}
              </p>
            )}

            {/* Cifras del año */}
            <div
              className="animate-fade-in-up delay-300 opacity-0 grid grid-cols-4 gap-2 sm:gap-3 max-w-xl mx-auto lg:mx-0 pt-2"
              style={{ animationFillMode: 'forwards' }}
            >
              {[
                { value: campsThisYear.length, label: 'Campamentos', icon: Tent },
                { value: upcomingCount, label: 'Por vivir', icon: CalendarDays },
                { value: catalogs.regionales.length, label: 'Regionales', icon: MapPin },
                { value: tribes.length, label: 'Tribus', icon: Users },
              ].map(({ value, label, icon: Icon }) => (
                <div
                  key={label}
                  className="rounded-2xl bg-white/10 backdrop-blur-md border border-white/15 px-2 py-3 text-center"
                >
                  <Icon className="w-4 h-4 text-sky-300 mx-auto" />
                  <div className="text-xl sm:text-2xl font-black text-white font-mono mt-1">{value}</div>
                  <div className="text-[10px] text-slate-300 font-semibold">{label}</div>
                </div>
              ))}
            </div>
          </div>

          {/* ── DERECHA: CAMPAMENTO ACTIVO ─────────────── */}
          <div className="lg:col-span-5 animate-fade-in-up delay-300 opacity-0" style={{ animationFillMode: 'forwards' }}>
            {featuredCamp ? (
              <div className="relative bg-white/10 backdrop-blur-xl rounded-[2rem] border border-white/20 shadow-2xl overflow-hidden">
                <div className="relative h-44 sm:h-52">
                  <img src={featuredCamp.imageUrl} alt={featuredCamp.name} className="w-full h-full object-cover" />
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/30 to-transparent" />
                  <div className="absolute top-3 left-3 right-3 flex items-center justify-between gap-2">
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-400 text-slate-950 text-[10px] font-black uppercase tracking-wider shadow">
                      <Sparkles className="w-3 h-3" /> Campamento activo
                    </span>
                    {phase && (
                      <span
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold border ${PHASE_META[phase].className}`}
                      >
                        <span className={`w-1.5 h-1.5 rounded-full ${PHASE_META[phase].dot}`} />
                        {PHASE_META[phase].label}
                      </span>
                    )}
                  </div>
                  <div className="absolute bottom-3 left-4 right-4">
                    {featuredCamp.theme && (
                      <div className="text-[11px] font-bold text-amber-300 uppercase tracking-widest">
                        “{featuredCamp.theme}” {featuredCamp.verse && <span className="text-white/70">· {featuredCamp.verse}</span>}
                      </div>
                    )}
                    <h2 className="text-xl sm:text-2xl font-black text-white font-display leading-tight mt-0.5">
                      {featuredCamp.name}
                    </h2>
                  </div>
                </div>

                <div className="p-5 space-y-4">
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="flex items-center gap-2 text-white/90">
                      <CalendarDays className="w-4 h-4 text-sky-300 shrink-0" />
                      <span className="font-semibold">{formatDateRange(featuredCamp.startDate, featuredCamp.endDate)}</span>
                    </div>
                    <div className="flex items-center gap-2 text-white/90 min-w-0">
                      <MapPin className="w-4 h-4 text-sky-300 shrink-0" />
                      <span className="font-semibold truncate">{featuredCamp.location}</span>
                    </div>
                  </div>

                  <p className="text-xs text-slate-200 leading-relaxed line-clamp-3">{featuredCamp.description}</p>

                  {featuredCamp.includes.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {featuredCamp.includes.slice(0, 6).map((inc) => (
                        <span
                          key={inc}
                          className="inline-flex items-center gap-1 text-[10px] px-2 py-1 rounded-lg bg-white/10 text-white/90 font-semibold border border-white/10"
                        >
                          <Check className="w-3 h-3 text-emerald-300" />
                          {inc}
                        </span>
                      ))}
                    </div>
                  )}

                  <div className="flex items-end justify-between gap-3 pt-3 border-t border-white/10">
                    <div>
                      <div className="text-[10px] text-slate-300 font-bold uppercase tracking-wider">Inversión</div>
                      <div className="text-3xl font-black text-white font-mono leading-none mt-1">
                        {featuredCamp.price}
                        <span className="text-sm text-slate-300 ml-1">Bs</span>
                      </div>
                      {featuredCamp.groupPrice && (
                        <div className="text-[10px] text-emerald-300 font-semibold mt-1">
                          {featuredCamp.groupPrice} Bs con cupón de delegación
                        </div>
                      )}
                    </div>
                    <div className="text-right">
                      {phase === 'en_curso' ? (
                        <div className="text-sm font-black text-sky-300">¡Está pasando ahora!</div>
                      ) : daysLeft > 0 ? (
                        <>
                          <div className="text-3xl font-black text-amber-300 font-mono leading-none">{daysLeft}</div>
                          <div className="text-[10px] text-slate-300 font-bold uppercase">días para empezar</div>
                        </>
                      ) : null}
                      {canSeeEnrollment && (
                        <div className="text-[10px] text-slate-400 mt-1">{enrolledInFeatured} jóvenes ya inscritos</div>
                      )}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={goEnroll}
                    disabled={!myFeaturedReg && !isCampEnrollable(featuredCamp)}
                    className="w-full py-3.5 bg-white text-sky-700 font-black text-sm rounded-2xl shadow-lg hover:bg-sky-50 transition-colors flex items-center justify-center gap-2 active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer"
                  >
                    {myFeaturedReg ? (
                      <>
                        <QrCode className="w-4 h-4" /> Ya estás inscrito · mi campamento
                      </>
                    ) : isCampEnrollable(featuredCamp) ? (
                      <>
                        <Flame className="w-4 h-4 text-orange-500" /> Asegurar mi lugar
                        <ArrowRight className="w-4 h-4" />
                      </>
                    ) : (
                      'Inscripciones no disponibles'
                    )}
                  </button>

                  {!isAuthenticated && (
                    <p className="text-center text-[11px] text-slate-300">
                      ¿Ya tienes cuenta?{' '}
                      <button
                        type="button"
                        onClick={() => requireLogin('login')}
                        className="text-sky-300 underline font-bold cursor-pointer"
                      >
                        Inicia sesión
                      </button>
                    </p>
                  )}
                </div>
              </div>
            ) : (
              <div className="rounded-[2rem] bg-white/10 backdrop-blur-xl border border-white/20 p-8 text-center text-white space-y-2">
                <BookOpen className="w-8 h-8 mx-auto text-sky-300" />
                <p className="font-bold">Pronto anunciaremos el próximo campamento.</p>
              </div>
            )}
          </div>
        </div>

        {/* Indicadores del carrusel de fondo */}
        <div className="flex justify-center lg:justify-start gap-1.5 mt-10">
          {backgrounds.map((_, i) => (
            <button
              key={i}
              type="button"
              aria-label={`Foto ${i + 1}`}
              onClick={() => setBgIndex(i)}
              className={`h-1.5 rounded-full transition-all cursor-pointer ${i === bgIndex ? 'w-8 bg-white' : 'w-3 bg-white/40'}`}
            />
          ))}
        </div>
      </div>
    </section>
  );
};
