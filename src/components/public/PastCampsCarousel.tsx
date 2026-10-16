import React, { useState, useEffect, useRef } from 'react';
import { useCamp } from '../../context/CampContext';
import { 
  ChevronLeft, 
  ChevronRight, 
  Sparkles, 
  MapPin, 
  Users, 
  Image as ImageIcon, 
  Play, 
  Flame, 
  ArrowRight,
  BookOpen
} from 'lucide-react';

export const PastCampsCarousel: React.FC = () => {
  const { pastEditions, openGalleryWithEdition } = useCamp();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const touchStartX = useRef<number | null>(null);
  const touchEndX = useRef<number | null>(null);

  // Auto-advance every 5.5s unless paused by user interaction
  useEffect(() => {
    if (isPaused || pastEditions.length === 0) return;

    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % pastEditions.length);
    }, 5500);

    return () => clearInterval(interval);
  }, [isPaused, pastEditions.length]);

  const handlePrev = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    setCurrentIndex((prev) => (prev - 1 + pastEditions.length) % pastEditions.length);
  };

  const handleNext = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    setCurrentIndex((prev) => (prev + 1) % pastEditions.length);
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.targetTouches[0].clientX;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    touchEndX.current = e.targetTouches[0].clientX;
  };

  const handleTouchEnd = () => {
    if (!touchStartX.current || !touchEndX.current) return;
    const diff = touchStartX.current - touchEndX.current;
    if (diff > 45) {
      // Swiped left -> next
      handleNext();
    } else if (diff < -45) {
      // Swiped right -> prev
      handlePrev();
    }
    touchStartX.current = null;
    touchEndX.current = null;
  };

  const currentEdition = pastEditions[currentIndex];

  if (!currentEdition) return null;

  return (
    <div 
      className="relative w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 my-8"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
    >
      {/* Banner Header Tag */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-sky-100 text-[#0284C7] border border-sky-300 text-xs font-black tracking-wide">
            <Flame className="w-3.5 h-3.5 text-amber-500 animate-pulse" />
            Galería Destacada · Encuentros Anteriores CJN
          </span>
          <span className="text-[11px] font-medium text-slate-500 hidden md:inline">
            Toca o haz clic en cualquier imagen para abrir la galería completa
          </span>
        </div>

        {/* Action button to open full gallery */}
        <button
          onClick={() => openGalleryWithEdition(currentEdition)}
          className="inline-flex items-center gap-1.5 text-xs font-black text-[#0284C7] hover:text-[#0369A1] transition-colors group cursor-pointer self-start sm:self-auto"
        >
          <span>Explorar Galería Completa ({currentEdition.photoCount}+ fotos y video)</span>
          <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
        </button>
      </div>

      {/* Main Interactive Carousel Slide Card */}
      <div 
        onClick={() => openGalleryWithEdition(currentEdition)}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        className="relative group cursor-pointer overflow-hidden rounded-3xl shadow-xl border border-stone-200/80 bg-stone-900 select-none transition-all duration-300 hover:shadow-2xl hover:border-amber-400/50"
      >
        {/* Dynamic Image with Smooth Scale Zoom */}
        <div className="relative h-72 sm:h-96 md:h-[420px] w-full overflow-hidden">
          <img
            src={currentEdition.imageUrl || 'https://images.unsplash.com/photo-1517824806704-9040b037703b?q=80&w=1200&auto=format&fit=crop'}
            alt={currentEdition.name}
            className="w-full h-full object-cover object-center transition-transform duration-700 ease-out group-hover:scale-105"
            onError={(e) => {
              // Fail-safe graceful placeholder
              e.currentTarget.style.display = 'none';
            }}
          />

          {/* Deep Cinematic Gradient Overlay for Maximum Readability */}
          <div className="absolute inset-0 bg-gradient-to-t from-stone-950 via-stone-900/60 to-stone-950/20" />

          {/* Golden Spiritual Amber Glow at Bottom */}
          <div className="absolute -bottom-10 left-0 right-0 h-40 bg-gradient-to-t from-amber-950/40 via-transparent to-transparent pointer-events-none" />

          {/* Top Info Bar inside Image */}
          <div className="absolute top-4 left-4 right-4 sm:top-6 sm:left-6 sm:right-6 flex items-center justify-between z-10">
            <div className="flex items-center gap-2">
              <span className="px-3 py-1 rounded-full bg-emerald-950/80 backdrop-blur-md text-emerald-300 border border-emerald-400/30 text-xs font-mono font-extrabold shadow-sm">
                Año {currentEdition.year}
              </span>
              <span className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-black/60 backdrop-blur-md text-stone-200 text-xs font-semibold border border-white/10">
                <MapPin className="w-3.5 h-3.5 text-amber-400" />
                {currentEdition.location}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <span className="px-3 py-1 rounded-full bg-black/70 backdrop-blur-md text-amber-300 border border-amber-500/30 text-xs font-semibold flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5" />
                {currentEdition.participantsCount} Jóvenes
              </span>
            </div>
          </div>

          {/* Bottom Content Over Image */}
          <div className="absolute bottom-4 left-4 right-4 sm:bottom-6 sm:left-6 sm:right-6 z-10 space-y-2.5">
            {/* Biblical verse badge */}
            {currentEdition.scriptureVerse && (
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-amber-950/70 backdrop-blur-md border border-amber-400/30 text-amber-200 text-xs font-medium max-w-xl line-clamp-1">
                <BookOpen className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                <span>{currentEdition.scriptureVerse}</span>
              </div>
            )}

            <div>
              <h3 className="text-xl sm:text-2xl md:text-3xl font-extrabold font-display text-white tracking-tight drop-shadow-md">
                {currentEdition.name}
              </h3>
              <p className="text-xs sm:text-sm text-stone-200 line-clamp-2 max-w-3xl mt-1 leading-relaxed drop-shadow-xs">
                {currentEdition.quote}
              </p>
            </div>

            {/* Click CTA & Interactive Cue */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
              <div className="flex items-center gap-3 text-xs text-emerald-300 font-semibold">
                <span className="inline-flex items-center gap-1 bg-white/15 backdrop-blur-md px-2.5 py-1 rounded-lg border border-white/10 text-white">
                  <ImageIcon className="w-3.5 h-3.5 text-amber-300" />
                  {currentEdition.photoCount} Fotografías HD
                </span>
                <span className="inline-flex items-center gap-1 bg-white/15 backdrop-blur-md px-2.5 py-1 rounded-lg border border-white/10 text-white">
                  <Play className="w-3.5 h-3.5 text-emerald-400 fill-emerald-400" />
                  Video Oficial {currentEdition.videoDuration}
                </span>
              </div>

              {/* Click button */}
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-stone-950 text-xs font-extrabold shadow-lg transition-transform group-hover:scale-105">
                <Sparkles className="w-4 h-4 text-stone-950" />
                <span>Ver Galería Completa</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </div>
            </div>
          </div>
        </div>

        {/* Carousel Navigation Arrows */}
        <button
          type="button"
          onClick={handlePrev}
          aria-label="Campamento anterior"
          className="absolute left-2.5 sm:left-4 top-1/2 -translate-y-1/2 z-20 w-10 h-10 sm:w-11 sm:h-11 rounded-full bg-black/50 hover:bg-black/80 backdrop-blur-md text-white border border-white/20 flex items-center justify-center transition-all duration-200 hover:scale-110 active:scale-95"
        >
          <ChevronLeft className="w-6 h-6" />
        </button>

        <button
          type="button"
          onClick={handleNext}
          aria-label="Campamento siguiente"
          className="absolute right-2.5 sm:right-4 top-1/2 -translate-y-1/2 z-20 w-10 h-10 sm:w-11 sm:h-11 rounded-full bg-black/50 hover:bg-black/80 backdrop-blur-md text-white border border-white/20 flex items-center justify-center transition-all duration-200 hover:scale-110 active:scale-95"
        >
          <ChevronRight className="w-6 h-6" />
        </button>

        {/* Animated Progress Bar */}
        <div className="absolute bottom-0 left-0 right-0 h-1 bg-white/20 z-20">
          <div 
            key={currentIndex}
            className="h-full bg-gradient-to-r from-amber-500 to-emerald-400 animate-[progress_5.5s_linear]"
            style={{ width: isPaused ? '100%' : undefined }}
          />
        </div>
      </div>

      {/* Carousel Thumbnail Dots & Indicator */}
      <div className="flex items-center justify-center gap-2 mt-3">
        {pastEditions.map((edition, idx) => (
          <button
            key={edition.year}
            type="button"
            onClick={() => setCurrentIndex(idx)}
            className={`transition-all duration-300 rounded-full flex items-center justify-center ${
              idx === currentIndex
                ? 'w-8 h-2.5 bg-[#0284C7]'
                : 'w-2.5 h-2.5 bg-sky-200 hover:bg-sky-400'
            }`}
            aria-label={`Ir al campamento ${edition.year}`}
          />
        ))}
      </div>
    </div>
  );
};
