import React, { useState } from 'react';
import { useCamp } from '../../context/CampContext';
import { TribeGroup } from '../../types/camp';
import { Palette, Users, Edit2, Shield, Sparkles, Check, X, Award } from 'lucide-react';

const PRESET_COLORS = [
  '#DC2626',
  '#2563EB',
  '#EA580C',
  '#D97706',
  '#059669',
  '#1E293B',
  '#0891B2',
  '#7C3AED',
  '#4F46E5',
  '#92400E',
  '#DB2777',
  '#0D9488',
];

export const TribesManager: React.FC = () => {
  const { tribes, registrations, updateTribe, setSelectedCamperForBadge } = useCamp();
  const [editingTribe, setEditingTribe] = useState<TribeGroup | null>(null);

  // Form states
  const [name, setName] = useState('');
  const [colorHex, setColorHex] = useState('#DC2626');
  const [animalSymbol, setAnimalSymbol] = useState('');
  const [leaderName, setLeaderName] = useState('');
  const [motto, setMotto] = useState('');

  const handleOpenEdit = (t: TribeGroup) => {
    setEditingTribe(t);
    setName(t.name);
    setColorHex(t.colorHex);
    setAnimalSymbol(t.animalSymbol);
    setLeaderName(t.leaderName);
    setMotto(t.motto);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !editingTribe) return;

    updateTribe(editingTribe.id, {
      name,
      colorHex,
      animalSymbol: animalSymbol || 'Emblema',
      leaderName: leaderName || 'Monitor Designado',
      motto: motto || 'Espíritu de campamento',
    });

    setEditingTribe(null);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8 animate-fade-in">
      
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-[#E6DEC8]">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold text-emerald-800 uppercase tracking-widest">
            <Award className="w-4 h-4 text-emerald-600" />
            <span>Distribución de Campamentistas</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-[#1B4332] font-display mt-0.5">
            Las 12 Tribus Fijas del Campamento (Asignación Automática)
          </h2>
          <p className="text-xs text-stone-600 mt-1">
            El sistema asigna automáticamente cada nuevo campamentista a una de las 12 tribus fijas de forma balanceada. Puedes ajustar los colores y datos de cada tribu.
          </p>
        </div>

        <div className="text-xs font-mono font-bold text-stone-700 bg-white px-3.5 py-2 rounded-xl border border-stone-200 shadow-2xs self-start sm:self-auto flex items-center gap-2">
          <Users className="w-4 h-4 text-[#1B4332]" />
          <span>{registrations.length} Campistas en 12 Tribus</span>
        </div>
      </div>

      {/* Auto-Assignment Notification Banner */}
      <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-center justify-between text-xs text-emerald-900">
        <div className="flex items-center gap-2.5">
          <Sparkles className="w-5 h-5 text-emerald-700 shrink-0" />
          <span>
            <strong>Algoritmo de Balance Automático Activo:</strong> Al matricularse un nuevo campamentista, se evalúa la ocupación de las 12 tribus y se le asigna de forma automática a la tribu con menor número de integrantes.
          </span>
        </div>
      </div>

      {/* 12 Fixed Tribes Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
        {tribes.map((tribe) => {
          const members = registrations.filter((r) => r.tribeId === tribe.id);

          return (
            <div
              key={tribe.id}
              className="bg-white rounded-2xl border border-stone-200 overflow-hidden shadow-xs hover:shadow-md transition-shadow flex flex-col justify-between"
            >
              <div>
                {/* Header in Custom Color */}
                <div
                  style={{ backgroundColor: tribe.colorHex }}
                  className="p-4 text-white relative transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-mono font-extrabold uppercase tracking-wider bg-black/25 px-2 py-0.5 rounded text-white">
                      Tribu #{tribe.number || tribe.id.replace('t-', '')}
                    </span>
                    <button
                      onClick={() => handleOpenEdit(tribe)}
                      className="p-1 rounded-lg bg-black/20 hover:bg-black/30 text-white transition-colors"
                      title="Personalizar color o lema"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <h3 className="text-base font-bold font-display mt-2 text-white">
                    {tribe.name}
                  </h3>

                  <p className="text-[11px] text-white/90 italic font-medium truncate mt-0.5">
                    "{tribe.motto}"
                  </p>

                  <div className="mt-2.5 flex items-center justify-between text-[11px] text-white/90 pt-2 border-t border-white/20">
                    <span className="truncate">Líder: {tribe.leaderName}</span>
                    <span className="font-mono font-bold bg-black/20 px-1.5 py-0.2 rounded text-[10px]">
                      {tribe.colorHex}
                    </span>
                  </div>
                </div>

                {/* Member Roster */}
                <div className="p-4">
                  <div className="flex items-center justify-between text-xs font-bold text-stone-700 pb-2 border-b border-stone-100">
                    <div className="flex items-center gap-1.5">
                      <Users className="w-3.5 h-3.5 text-stone-400" />
                      <span>Integrantes ({members.length})</span>
                    </div>
                  </div>

                  <div className="mt-2.5 space-y-1.5 max-h-36 overflow-y-auto">
                    {members.map((camper) => (
                      <div
                        key={camper.id}
                        className="p-2 rounded-xl bg-stone-50 border border-stone-200/70 text-xs flex items-center justify-between"
                      >
                        <div className="truncate pr-2">
                          <span className="font-bold text-stone-900 block truncate">
                            {camper.fullName}
                          </span>
                          <span className="text-[10px] text-stone-400 font-mono">
                            {camper.id} · {camper.regional}
                          </span>
                        </div>

                        <button
                          onClick={() => setSelectedCamperForBadge(camper)}
                          className="px-2 py-0.5 text-[10px] font-bold text-[#1B4332] bg-emerald-50 hover:bg-emerald-100 rounded border border-emerald-200 shrink-0"
                        >
                          Gafete
                        </button>
                      </div>
                    ))}

                    {members.length === 0 && (
                      <div className="text-center py-4 text-[11px] text-stone-400">
                        Lista para recibir asignaciones automáticas.
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Bottom Quick Swatch Ribbon */}
              <div className="px-4 py-2 bg-stone-50 border-t border-stone-100 flex items-center justify-between text-[11px]">
                <span className="text-stone-500 font-medium">Símbolo: {tribe.animalSymbol}</span>
                <div className="flex items-center gap-1">
                  <span
                    className="w-3.5 h-3.5 rounded-full border border-stone-300"
                    style={{ backgroundColor: tribe.colorHex }}
                  />
                  <span className="font-mono text-stone-600 font-bold">
                    {tribe.colorHex}
                  </span>
                </div>
              </div>

            </div>
          );
        })}
      </div>

      {/* Edit Tribe Modal */}
      {editingTribe && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-stone-200">
            <div className="flex items-center justify-between pb-3 border-b border-stone-100">
              <h3 className="text-lg font-bold text-stone-900 font-display">
                Personalizar {editingTribe.name}
              </h3>
              <button onClick={() => setEditingTribe(null)} className="text-stone-400 hover:text-stone-700">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSave} className="py-4 space-y-4 text-xs">
              <div>
                <label className="block font-bold text-stone-700 uppercase tracking-wider mb-1">
                  Nombre de la Tribu *
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-stone-50 border border-stone-200 rounded-xl text-stone-900"
                />
              </div>

              {/* Color Customizer */}
              <div>
                <label className="block font-bold text-stone-700 uppercase tracking-wider mb-1">
                  Color Parametrizable (Paleta y Código HEX) *
                </label>
                
                {/* Preset Swatches */}
                <div className="flex flex-wrap gap-2 mb-2">
                  {PRESET_COLORS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setColorHex(c)}
                      className={`w-6 h-6 rounded-full border-2 transition-transform ${
                        colorHex.toLowerCase() === c.toLowerCase()
                          ? 'scale-110 border-stone-900 shadow-xs'
                          : 'border-transparent hover:scale-105'
                      }`}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={colorHex}
                    onChange={(e) => setColorHex(e.target.value)}
                    className="w-9 h-9 rounded-xl border border-stone-200 cursor-pointer p-0.5 bg-white"
                  />
                  <input
                    type="text"
                    value={colorHex}
                    onChange={(e) => setColorHex(e.target.value)}
                    className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl font-mono text-stone-900 uppercase font-bold"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-stone-700 uppercase tracking-wider mb-1">
                  Líder / Monitor de la Tribu
                </label>
                <input
                  type="text"
                  value={leaderName}
                  onChange={(e) => setLeaderName(e.target.value)}
                  className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl text-stone-900"
                />
              </div>

              <div>
                <label className="block font-bold text-stone-700 uppercase tracking-wider mb-1">
                  Lema de la Tribu
                </label>
                <input
                  type="text"
                  value={motto}
                  onChange={(e) => setMotto(e.target.value)}
                  className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl text-stone-900"
                />
              </div>

              <div className="pt-3 border-t border-stone-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setEditingTribe(null)}
                  className="px-4 py-2 text-stone-600 hover:bg-stone-100 rounded-lg"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 font-bold text-white bg-[#1B4332] hover:bg-[#2D6A4F] rounded-lg shadow-xs"
                >
                  Guardar Cambios
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
