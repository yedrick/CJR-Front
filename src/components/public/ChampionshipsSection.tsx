import React, { useState } from 'react';
import { useCamp } from '../../context/CampContext';
import { Championship } from '../../types/camp';
import { 
  Trophy, 
  Users, 
  Clock, 
  Sparkles, 
  ArrowRight, 
  Check, 
  Flame, 
  X,
  Medal,
  Award,
  BookOpen
} from 'lucide-react';

interface ChampionshipsSectionProps {
  onSelectChampionshipForEnrollment?: (champId: string) => void;
}

export const ChampionshipsSection: React.FC<ChampionshipsSectionProps> = ({
  onSelectChampionshipForEnrollment,
}) => {
  const { championships, setActiveTab } = useCamp();
  const [activeModalChamp, setActiveModalChamp] = useState<Championship | null>(null);

  const handleEnrollChampionship = (champId: string) => {
    if (onSelectChampionshipForEnrollment) {
      onSelectChampionshipForEnrollment(champId);
    } else {
      setActiveTab('enroll');
    }
  };

  return (
    <section id="championships-section" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 border-t border-sky-100 animate-fade-in">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-8">
        <div>
          <div className="flex items-center gap-2 text-xs font-extrabold text-[#0284C7] uppercase tracking-widest">
            <Trophy className="w-4 h-4 text-amber-500" />
            <span>Olimpiadas Bíblicas & Deportivas CJN</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 font-display mt-1">
            Campeonatos Oficiales y Competencias
          </h2>
          <p className="text-xs sm:text-sm text-slate-600 mt-1 max-w-2xl leading-relaxed">
            "Por los Siglos" (Romanos 11:33-36). Participa en fútbol, futsal damas, básquetbol, voleibol, natación, ajedrez, tenis de mesa, maratón y la gran Olimpiada Bíblica de Romanos con tu delegación regional.
          </p>
        </div>

        <button
          onClick={() => setActiveTab('enroll')}
          className="inline-flex items-center gap-2 px-5 py-2.5 text-xs font-bold text-white bg-[#0284C7] hover:bg-[#0369A1] rounded-xl transition-all shadow-md self-start md:self-auto shrink-0 hover:scale-105 active:scale-95 cursor-pointer"
        >
          <span>Inscribirme en Disciplinas</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Grid of Championships with High-Quality Action Sports Photos */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {championships.map((champ) => {
          const spotsLeft = champ.maxTeamsOrParticipants - champ.enrolledTeamsCount;
          const percent = Math.round((champ.enrolledTeamsCount / champ.maxTeamsOrParticipants) * 100);

          return (
            <div
              key={champ.id}
              className="bg-white rounded-3xl border border-sky-100 overflow-hidden shadow-xs hover:shadow-xl transition-all duration-300 flex flex-col justify-between group hover:-translate-y-1"
            >
              <div>
                {/* Visual Action Photo Banner */}
                <div className="relative h-44 w-full bg-slate-900 overflow-hidden">
                  <img
                    src={champ.imageUrl || 'https://images.unsplash.com/photo-1574629810360-7efbbe195018?q=80&w=800&auto=format&fit=crop'}
                    alt={champ.name}
                    className="w-full h-full object-cover group-hover:scale-108 transition-transform duration-500"
                    onError={(e) => {
                      e.currentTarget.style.display = 'none';
                    }}
                  />
                  {/* Subtle dark gradient overlay */}
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/40 to-transparent" />

                  {/* Top Gender & Sport Pill */}
                  <div className="absolute top-3 left-3 right-3 flex items-center justify-between z-10">
                    <span className="text-[10px] font-mono font-extrabold px-2.5 py-0.5 rounded-full bg-black/60 text-white backdrop-blur-md border border-white/20">
                      {champ.genderCategory}
                    </span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500 text-slate-950 font-mono shadow-xs">
                      +{champ.registrationFee} Bs
                    </span>
                  </div>

                  {/* Sport Discipline Title over Photo */}
                  <div className="absolute bottom-3 left-3 right-3 z-10">
                    <span className="text-[10px] font-bold text-amber-300 uppercase tracking-wider block">
                      {champ.sport}
                    </span>
                    <h3 className="text-sm font-extrabold text-white font-display truncate">
                      {champ.name}
                    </h3>
                  </div>
                </div>

                {/* Content Body */}
                <div className="p-4 space-y-3">
                  <p className="text-xs text-slate-600 line-clamp-2 leading-relaxed">
                    {champ.description}
                  </p>

                  <div className="space-y-1.5 text-xs text-slate-600 pt-1 border-t border-slate-100">
                    <div className="flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-[#0284C7] shrink-0" />
                      <span className="truncate text-[11px]">{champ.schedule}</span>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <Medal className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                      <span className="truncate text-[11px] font-medium text-slate-800">
                        {champ.prizeSummary}
                      </span>
                    </div>
                  </div>

                  {/* Capacity quota meter */}
                  <div className="p-2.5 rounded-xl bg-sky-50/70 border border-sky-100 text-xs">
                    <div className="flex items-center justify-between mb-1 text-[11px]">
                      <span className="text-slate-500 font-medium">Equipos Inscritos</span>
                      <span className="font-mono font-bold text-slate-900">
                        {champ.enrolledTeamsCount}/{champ.maxTeamsOrParticipants}
                      </span>
                    </div>
                    <div className="w-full bg-slate-200 rounded-full h-1.5 overflow-hidden">
                      <div
                        className="bg-gradient-to-r from-[#0284C7] to-amber-500 h-1.5 rounded-full transition-all duration-500"
                        style={{ width: `${percent}%` }}
                      />
                    </div>
                    <div className="flex justify-between items-center text-[10px] text-slate-500 mt-1">
                      <span>{spotsLeft} cupos libres</span>
                      <span className="font-bold text-[#0284C7]">Valida para Copa CJN</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Bottom Card Actions */}
              <div className="px-4 py-3 bg-slate-50 border-t border-slate-100 flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() => setActiveModalChamp(champ)}
                  className="text-xs font-bold text-slate-600 hover:text-[#0284C7] transition-colors cursor-pointer"
                >
                  Ver Reglas
                </button>

                <button
                  type="button"
                  onClick={() => handleEnrollChampionship(champ.id)}
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-extrabold text-white bg-[#0284C7] hover:bg-[#0369A1] transition-all shadow-xs cursor-pointer hover:scale-105 active:scale-95"
                >
                  <span>Inscribir</span>
                  <ArrowRight className="w-3 h-3" />
                </button>
              </div>

            </div>
          );
        })}
      </div>

      {/* Rules Modal */}
      {activeModalChamp && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs animate-fade-in"
          onClick={() => setActiveModalChamp(null)}
        >
          <div 
            className="bg-white rounded-3xl max-w-lg w-full overflow-hidden shadow-2xl border border-sky-100 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Image Header */}
            <div className="relative h-44 w-full bg-slate-900 overflow-hidden">
              <img
                src={activeModalChamp.imageUrl}
                alt={activeModalChamp.name}
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/40 to-transparent" />
              <button
                type="button"
                onClick={() => setActiveModalChamp(null)}
                className="absolute top-3 right-3 w-8 h-8 rounded-full bg-black/60 hover:bg-black/90 text-white flex items-center justify-center border border-white/20 transition-all cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
              <div className="absolute bottom-3 left-4 right-4 text-white">
                <span className="text-[10px] font-bold text-amber-300 uppercase tracking-wider">
                  {activeModalChamp.sport}
                </span>
                <h3 className="text-lg font-bold font-display">
                  {activeModalChamp.name}
                </h3>
              </div>
            </div>

            <div className="p-6 pt-0 space-y-4 text-xs">
              <p className="text-slate-600 leading-relaxed">
                {activeModalChamp.description}
              </p>

              <div className="p-3.5 rounded-2xl bg-sky-50 border border-sky-200 space-y-2">
                <div className="font-bold text-[#0284C7] uppercase tracking-wider text-[10px]">
                  Reglamento Oficial de las Olimpiadas CJN:
                </div>
                <ul className="space-y-1.5 text-slate-700">
                  <li className="flex items-start gap-2">
                    <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                    <span>Cada participante debe pertenecer a una de las 31 Regionales de la UCE.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                    <span>Conducta y testimonio cristiano intachable durante el encuentro.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                    <span>Los puntajes sumarán para la Gran Copa General de Regionales.</span>
                  </li>
                </ul>
              </div>

              <div className="flex items-center justify-between pt-2">
                <span className="text-sm font-extrabold text-[#0284C7] font-mono">
                  Tarifa: {activeModalChamp.registrationFee} Bs
                </span>

                <button
                  type="button"
                  onClick={() => {
                    handleEnrollChampionship(activeModalChamp.id);
                    setActiveModalChamp(null);
                  }}
                  className="px-5 py-2.5 bg-[#0284C7] hover:bg-[#0369A1] text-white font-bold rounded-xl shadow-md cursor-pointer transition-all"
                >
                  Inscribirse a esta Disciplina
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </section>
  );
};
