import React, { useState, useEffect } from 'react';
import { useCamp } from '../../context/CampContext';
import { PastCampEdition, EditionPhoto } from '../../types/camp';
import { 
  History, 
  MapPin, 
  Users, 
  Play, 
  Image as ImageIcon, 
  Sparkles, 
  CheckCircle2, 
  X, 
  Trophy, 
  Flame, 
  ArrowRight,
  BookOpen,
  Filter,
  Maximize2,
  Share2,
  Calendar,
  Volume2
} from 'lucide-react';

export const PastEditionsGallery: React.FC = () => {
  const { pastEditions, setActiveTab, selectedEditionForGallery, setSelectedEditionForGallery } = useCamp();
  const [selectedEdition, setSelectedEdition] = useState<PastCampEdition | null>(null);
  const [activeVideoModal, setActiveVideoModal] = useState<PastCampEdition | null>(null);
  const [activeCategoryFilter, setActiveCategoryFilter] = useState<string>('TODAS');
  const [activePhotoModal, setActivePhotoModal] = useState<{ photo: EditionPhoto; edition: PastCampEdition } | null>(null);

  // If CampContext set selectedEditionForGallery (e.g. from Carousel click), select it automatically!
  useEffect(() => {
    if (selectedEditionForGallery) {
      setSelectedEdition(selectedEditionForGallery);
    }
  }, [selectedEditionForGallery]);

  const categories = [
    'TODAS',
    'Adoración y Fogata',
    'Talleres y Liderazgo',
    'Desafíos de Tribus',
    'Campeonatos',
    'Comunión y Paisajes',
  ];

  return (
    <section id="past-camps-section" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 border-t border-[#E6DEC8] animate-fade-in">
      
      {/* Section Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-8">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold text-amber-800 uppercase tracking-widest">
            <Flame className="w-4 h-4 text-amber-600" />
            <span>Memoria Viva, Fe y Trayectoria Cristiana</span>
          </div>
          <h2 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-[#1B4332] font-display mt-1">
            Galería Completa de Fotos, Videos y Recuerdos
          </h2>
          <p className="text-xs sm:text-sm text-stone-600 mt-1 max-w-2xl leading-relaxed">
            Revive las vigilias de adoración al aire libre, los desafíos de cuerdas en montaña, las finales de campeonatos y la comunión fraternal de las delegaciones en cada campamento cristiano.
          </p>
        </div>

        <button
          onClick={() => setActiveTab('enroll')}
          className="inline-flex items-center gap-2 px-5 py-3 text-xs font-bold text-white bg-[#1B4332] hover:bg-[#2D6A4F] rounded-xl transition-all shadow-md self-start md:self-auto shrink-0 hover:scale-[1.02] active:scale-98"
        >
          <span>Inscribirme para la Edición 2026</span>
          <ArrowRight className="w-4 h-4 text-emerald-300" />
        </button>
      </div>

      {/* Editions Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
        {pastEditions.map((edition) => {
          const isSelected = selectedEdition?.year === edition.year;
          return (
            <div
              key={edition.year}
              className={`bg-white rounded-3xl border transition-all flex flex-col justify-between group overflow-hidden shadow-sm hover:shadow-xl ${
                isSelected 
                  ? 'border-amber-500 ring-2 ring-amber-400/50 -translate-y-1' 
                  : 'border-stone-200/90 hover:border-emerald-600/40'
              }`}
            >
              {/* Photo Banner with Fallback */}
              <div className="relative h-48 w-full overflow-hidden bg-stone-900">
                <img
                  src={edition.imageUrl}
                  alt={edition.name}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  onError={(e) => {
                    e.currentTarget.style.display = 'none';
                  }}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-stone-950 via-stone-950/40 to-transparent" />

                <div className="absolute top-3 left-3 right-3 flex items-center justify-between z-10">
                  <span className="text-xs font-mono font-extrabold px-3 py-1 rounded-full bg-emerald-950/80 text-emerald-300 border border-emerald-400/30 backdrop-blur-md">
                    {edition.year}
                  </span>
                  <span className="flex items-center gap-1 text-[11px] font-bold text-amber-300 bg-black/60 px-2.5 py-1 rounded-full backdrop-blur-md">
                    <Users className="w-3.5 h-3.5" />
                    {edition.participantsCount} Jóvenes
                  </span>
                </div>

                <div className="absolute bottom-3 left-3 right-3 z-10">
                  <h3 className="text-lg font-extrabold font-display text-white">
                    {edition.name}
                  </h3>
                  <div className="flex items-center gap-1 text-[11px] text-stone-300">
                    <MapPin className="w-3 h-3 text-amber-400 shrink-0" />
                    <span className="truncate">{edition.location}</span>
                  </div>
                </div>
              </div>

              {/* Content Card Body */}
              <div className="p-5 space-y-4 flex-1 flex flex-col justify-between">
                <div className="space-y-3">
                  {edition.scriptureVerse && (
                    <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-stone-800 text-[11px] flex items-start gap-2">
                      <BookOpen className="w-3.5 h-3.5 text-amber-700 shrink-0 mt-0.5" />
                      <p className="font-medium italic leading-relaxed line-clamp-2">
                        {edition.scriptureVerse}
                      </p>
                    </div>
                  )}

                  <p className="text-xs text-stone-600 line-clamp-2 leading-relaxed">
                    "{edition.quote}"
                  </p>

                  <div className="space-y-1 pt-1">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-stone-400 block">
                      Momentos Destacados:
                    </span>
                    <ul className="space-y-1 text-xs text-stone-700">
                      {edition.highlights.slice(0, 2).map((h, i) => (
                        <li key={i} className="flex items-start gap-1.5">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700 shrink-0 mt-0.5" />
                          <span className="line-clamp-1">{h}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                {/* Interactive Action Row */}
                <div className="pt-3 border-t border-stone-100 flex items-center justify-between gap-2 text-xs">
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedEdition(edition);
                      setSelectedEditionForGallery(edition);
                    }}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-bold transition-all ${
                      isSelected
                        ? 'bg-amber-600 text-white shadow-xs'
                        : 'bg-stone-100 hover:bg-stone-200 text-stone-800'
                    }`}
                  >
                    <ImageIcon className="w-3.5 h-3.5" />
                    <span>Ver {edition.photoCount} Fotos</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveVideoModal(edition)}
                    className="inline-flex items-center gap-1 font-bold text-[#1B4332] hover:text-[#2D6A4F] px-2 py-1.5"
                  >
                    <Play className="w-3.5 h-3.5 text-emerald-600 fill-emerald-600" />
                    <span>Video ({edition.videoDuration})</span>
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Selected Edition Expanded Gallery Section */}
      {selectedEdition && (
        <div className="bg-stone-50 border border-stone-200/90 rounded-3xl p-6 sm:p-8 space-y-6 shadow-sm animate-fade-in">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-stone-200">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono font-bold px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300">
                  {selectedEdition.year}
                </span>
                <span className="text-xs font-semibold text-stone-500">
                  {selectedEdition.location}
                </span>
              </div>
              <h3 className="text-xl sm:text-2xl font-extrabold font-display text-stone-900 mt-1">
                Álbum de Recuerdos: {selectedEdition.name}
              </h3>
              <p className="text-xs text-stone-600 mt-0.5">
                {selectedEdition.summary}
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setActiveVideoModal(selectedEdition)}
                className="px-4 py-2 text-xs font-bold text-white bg-emerald-800 hover:bg-emerald-700 rounded-xl flex items-center gap-1.5 shadow-xs transition-colors"
              >
                <Play className="w-3.5 h-3.5 fill-white" />
                <span>Ver Video Resumen</span>
              </button>
            </div>
          </div>

          {/* Category Filter Pills */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-bold text-stone-500 flex items-center gap-1 mr-1">
              <Filter className="w-3.5 h-3.5" />
              Filtrar por:
            </span>
            {categories.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setActiveCategoryFilter(cat)}
                className={`px-3 py-1.5 text-xs font-semibold rounded-xl transition-all ${
                  activeCategoryFilter === cat
                    ? 'bg-[#1B4332] text-white shadow-xs'
                    : 'bg-white text-stone-600 hover:bg-stone-200 border border-stone-200'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          {/* Photos Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {(selectedEdition.photoGallery || []).filter(
              (p) => activeCategoryFilter === 'TODAS' || p.category === activeCategoryFilter
            ).map((photo) => (
              <div
                key={photo.id}
                onClick={() => setActivePhotoModal({ photo, edition: selectedEdition })}
                className="group relative h-64 rounded-2xl overflow-hidden cursor-pointer shadow-xs border border-stone-200 bg-stone-900 hover:shadow-xl transition-all"
              >
                <img
                  src={photo.url}
                  alt={photo.title}
                  className="w-full h-full object-cover group-hover:scale-108 transition-transform duration-500"
                  onError={(e) => {
                    e.currentTarget.style.display = 'none';
                  }}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-90 group-hover:opacity-100 transition-opacity" />

                <div className="absolute top-3 right-3 z-10 w-8 h-8 rounded-full bg-black/50 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity backdrop-blur-md">
                  <Maximize2 className="w-4 h-4" />
                </div>

                <div className="absolute bottom-3 left-3 right-3 z-10 text-white">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-amber-300 block">
                    {photo.category}
                  </span>
                  <span className="text-xs sm:text-sm font-bold block truncate mt-0.5">
                    {photo.title}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Photo Lightbox Modal */}
      {activePhotoModal && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm animate-fade-in"
          onClick={() => setActivePhotoModal(null)}
        >
          <div 
            className="bg-stone-900 rounded-3xl max-w-3xl w-full overflow-hidden text-white border border-stone-700 shadow-2xl space-y-3"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="relative max-h-[65vh] w-full overflow-hidden bg-black flex items-center justify-center">
              <img
                src={activePhotoModal.photo.url}
                alt={activePhotoModal.photo.title}
                className="max-h-[65vh] w-full object-contain"
              />
              <button
                type="button"
                onClick={() => setActivePhotoModal(null)}
                className="absolute top-4 right-4 w-9 h-9 rounded-full bg-black/60 hover:bg-black/90 text-white flex items-center justify-center border border-white/20 transition-transform active:scale-90"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-2">
              <div className="flex items-center justify-between text-xs text-amber-400">
                <span className="font-mono uppercase font-bold">
                  {activePhotoModal.photo.category} · {activePhotoModal.edition.name}
                </span>
                <span className="text-stone-400">
                  {activePhotoModal.edition.location}
                </span>
              </div>
              <h4 className="text-xl font-bold font-display text-white">
                {activePhotoModal.photo.title}
              </h4>
              {activePhotoModal.edition.scriptureVerse && (
                <p className="text-xs text-stone-300 italic">
                  {activePhotoModal.edition.scriptureVerse}
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Video Documentary Modal */}
      {activeVideoModal && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm animate-fade-in"
          onClick={() => setActiveVideoModal(null)}
        >
          <div 
            className="bg-stone-900 rounded-3xl max-w-2xl w-full p-6 text-white border border-stone-700 shadow-2xl space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-stone-800">
              <div>
                <span className="text-xs font-mono text-emerald-400">
                  Video Documental Oficial · {activeVideoModal.year}
                </span>
                <h3 className="text-lg font-bold font-display text-white">
                  {activeVideoModal.name}
                </h3>
              </div>
              <button
                onClick={() => setActiveVideoModal(null)}
                className="text-stone-400 hover:text-white p-1 rounded-full hover:bg-stone-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Video Player Display */}
            <div className="aspect-video bg-stone-950 rounded-2xl overflow-hidden relative flex flex-col items-center justify-center border border-stone-800 group shadow-inner">
              <img
                src={activeVideoModal.imageUrl}
                alt="Miniatura de video"
                className="absolute inset-0 w-full h-full object-cover opacity-40 group-hover:scale-105 transition-transform duration-700"
              />
              <div className="relative z-10 w-16 h-16 rounded-full bg-emerald-600 text-white flex items-center justify-center shadow-xl group-hover:scale-110 transition-transform">
                <Play className="w-8 h-8 fill-white ml-1" />
              </div>
              <span className="relative z-10 text-xs font-mono text-stone-200 mt-3 font-bold bg-black/60 px-3 py-1 rounded-full backdrop-blur-xs">
                Reproduciendo Documental ({activeVideoModal.videoDuration})
              </span>
              <span className="relative z-10 text-[11px] text-amber-300 mt-1">
                Grabado en 4K en {activeVideoModal.location}
              </span>
            </div>

            <div className="text-xs text-stone-300 leading-relaxed bg-stone-800/50 p-3 rounded-xl border border-stone-700/50">
              {activeVideoModal.summary}
            </div>

            <div className="pt-2 flex justify-end">
              <button
                onClick={() => setActiveVideoModal(null)}
                className="px-5 py-2 text-xs font-bold bg-stone-800 hover:bg-stone-700 text-white rounded-xl transition-colors"
              >
                Cerrar Reproductor
              </button>
            </div>
          </div>
        </div>
      )}

    </section>
  );
};
