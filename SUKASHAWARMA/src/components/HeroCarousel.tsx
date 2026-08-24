"use client";

import { useState, useEffect, useCallback } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

type Slide = {
  image: string;
  bg: string;
  objectFit: "cover" | "contain";
  objectPosition: string;
};

// Desktop: hero1, hero2, hero3
const desktopSlides: Slide[] = [
  {
    image: "/hero1.png",
    bg: "#FAF7F2",
    objectFit: "contain" as const,
    objectPosition: "center center",
  },
  {
    image: "/hero2.png",
    bg: "#F0EDEA",
    objectFit: "contain" as const,
    objectPosition: "center center",
  },
  {
    image: "/hero3.png",
    bg: "#FAFAFA",
    objectFit: "contain" as const,
    objectPosition: "center center",
  },
];

// Mobile: semua gambar hero termasuk hero4
const mobileSlides: Slide[] = [
  {
    image: "/hero4.jpeg",
    bg: "#FAF7F2",
    objectFit: "contain" as const,
    objectPosition: "center center",
  },
  {
    image: "/hero1.png",
    bg: "#FAF7F2",
    objectFit: "contain" as const,
    objectPosition: "center center",
  },
  {
    image: "/hero2.png",
    bg: "#F0EDEA",
    objectFit: "contain" as const,
    objectPosition: "center center",
  },
  {
    image: "/hero3.png",
    bg: "#FAFAFA",
    objectFit: "contain" as const,
    objectPosition: "center center",
  },
];

export default function HeroCarousel() {
  const [current, setCurrent] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [slides, setSlides] = useState<Slide[]>(mobileSlides);
  const [isMobile, setIsMobile] = useState(true);

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 768px)");

    const update = (matches: boolean) => {
      const next = matches ? desktopSlides : mobileSlides;
      setIsMobile(!matches);
      setSlides(next);
      setCurrent(0);
    };

    update(mq.matches);

    const handler = (e: MediaQueryListEvent) => update(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  const safeCurrent = current % slides.length;
  const activeSlide = slides[safeCurrent] ?? slides[0];

  const next = useCallback(() => {
    setCurrent((c) => (c + 1) % slides.length);
  }, [slides.length]);

  const prev = () =>
    setCurrent((c) => (c - 1 + slides.length) % slides.length);

  useEffect(() => {
    if (isPaused) return;
    const timer = setInterval(next, 2500); // Dipercepat dari 3000ms ke 2500ms
    return () => clearInterval(timer);
  }, [isPaused, next]);

  return (
    <section
      className={`relative w-full overflow-hidden ${
        isMobile 
          ? 'aspect-[4/3] min-h-[280px]' 
          : 'min-h-[320px] max-h-[720px]'
      }`}
      style={{
        /*
         * Desktop: tinggi yang lebih proporsional
         * Mobile: rasio 4:3 untuk tampilan yang lebih baik
         */
        height: isMobile
          ? undefined
          : `clamp(320px, 65vw, 720px)`,
        backgroundColor: activeSlide.bg,
        transition: "background-color 0.7s ease",
      }}
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      onTouchStart={() => setIsPaused(true)}
      onTouchEnd={() => setIsPaused(false)}
      aria-label="Hero carousel"
    >
      <AnimatePresence mode="wait">
        <motion.div
          key={`${safeCurrent}-${isMobile}`}
          initial={{ opacity: 0, scale: 1.01 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.99 }}
          transition={{ duration: 0.6, ease: [0.25, 0.46, 0.45, 0.94] }}
          className="absolute inset-0 p-2 md:p-4"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={activeSlide.image}
            alt={`Slide ${safeCurrent + 1}`}
            className="w-full h-full select-none pointer-events-none rounded-lg"
            style={{
              objectFit: activeSlide.objectFit,
              objectPosition: activeSlide.objectPosition,
            }}
            fetchPriority={safeCurrent === 0 ? "high" : "low"}
            decoding={safeCurrent === 0 ? "sync" : "async"}
            draggable={false}
            aria-hidden="true"
          />
        </motion.div>
      </AnimatePresence>

      {/* Preload slide berikutnya */}
      {slides.map((slide, i) =>
        i !== safeCurrent ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={slide.image}
            src={slide.image}
            alt=""
            aria-hidden="true"
            className="absolute opacity-0 pointer-events-none w-0 h-0"
            fetchPriority="low"
            decoding="async"
          />
        ) : null
      )}

      {/* Arrow kiri */}
      <button
        onClick={prev}
        className="absolute left-2 md:left-6 top-1/2 -translate-y-1/2 z-30
                   w-10 h-10 md:w-12 md:h-12 rounded-full
                   bg-white/90 backdrop-blur-md border border-white/50
                   shadow-lg hover:shadow-xl
                   flex items-center justify-center text-gray-800
                   hover:bg-white active:scale-95
                   transition-all duration-200 touch-manipulation"
        aria-label="Slide sebelumnya"
      >
        <ChevronLeft className="w-5 h-5 md:w-6 md:h-6" />
      </button>

      {/* Arrow kanan */}
      <button
        onClick={next}
        className="absolute right-2 md:right-6 top-1/2 -translate-y-1/2 z-30
                   w-10 h-10 md:w-12 md:h-12 rounded-full
                   bg-white/90 backdrop-blur-md border border-white/50
                   shadow-lg hover:shadow-xl
                   flex items-center justify-center text-gray-800
                   hover:bg-white active:scale-95
                   transition-all duration-200 touch-manipulation"
        aria-label="Slide berikutnya"
      >
        <ChevronRight className="w-5 h-5 md:w-6 md:h-6" />
      </button>

      {/* Dot indicators */}
      <div className="absolute bottom-3 md:bottom-6 left-1/2 -translate-x-1/2 z-30
                      flex items-center gap-2.5 px-3 py-2 rounded-full
                      bg-white/20 backdrop-blur-md border border-white/30">
        {slides.map((_, i) => (
          <button
            key={i}
            onClick={() => setCurrent(i)}
            className={`rounded-full transition-all duration-300 touch-manipulation ${
              i === safeCurrent
                ? "w-7 h-2.5 bg-[#FE7108] shadow-[0_0_12px_rgba(254,113,8,0.8)]"
                : "w-2.5 h-2.5 bg-white/70 hover:bg-white/90"
            }`}
            aria-label={`Pergi ke slide ${i + 1}`}
          />
        ))}
      </div>
    </section>
  );
}
