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

// Desktop: semua slide
const desktopSlides: Slide[] = [
  {
    image: "/hero1.png",
    bg: "#FAF7F2",
    objectFit: "cover" as const,
    objectPosition: "center 30%",
  },
  {
    image: "/hero3.png",
    bg: "#FAFAFA",
    objectFit: "contain" as const,
    objectPosition: "center center",
  },
  {
    image: "/hero2.png",
    bg: "#F0EDEA",
    objectFit: "contain" as const,
    objectPosition: "center top",
  },
];

// Mobile: hanya hero4 dan hero1
// hero4 ditaruh duluan supaya jadi first slide di mobile
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
    const timer = setInterval(next, 3000);
    return () => clearInterval(timer);
  }, [isPaused, next]);

  return (
    <section
      className="relative w-full overflow-hidden"
      style={{
        /*
         * Desktop: height proporsional mengikuti lebar viewport, max 600px
         * Mobile: pakai aspect-ratio 1:1 supaya gambar portrait tidak terpotong
         * isMobile belum tersedia di SSR jadi pakai CSS media query via className
         */
        height: isMobile
          ? "auto"
          : "max(220px, min(56vw, 600px))",
        aspectRatio: isMobile ? "1 / 1" : undefined,
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
          className="absolute inset-0"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={activeSlide.image}
            alt={`Slide ${safeCurrent + 1}`}
            className="w-full h-full select-none pointer-events-none"
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
        className="absolute left-3 md:left-8 top-1/2 -translate-y-1/2 z-20
                   w-9 h-9 md:w-11 md:h-11 rounded-full
                   bg-white/20 backdrop-blur-md border border-white/30
                   flex items-center justify-center text-white
                   hover:bg-white/30 active:scale-95
                   transition-all duration-150 touch-manipulation"
        aria-label="Slide sebelumnya"
      >
        <ChevronLeft className="w-4 h-4 md:w-5 md:h-5" />
      </button>

      {/* Arrow kanan */}
      <button
        onClick={next}
        className="absolute right-3 md:right-8 top-1/2 -translate-y-1/2 z-20
                   w-9 h-9 md:w-11 md:h-11 rounded-full
                   bg-white/20 backdrop-blur-md border border-white/30
                   flex items-center justify-center text-white
                   hover:bg-white/30 active:scale-95
                   transition-all duration-150 touch-manipulation"
        aria-label="Slide berikutnya"
      >
        <ChevronRight className="w-4 h-4 md:w-5 md:h-5" />
      </button>

      {/* Dot indicators */}
      <div className="absolute bottom-5 md:bottom-8 left-1/2 -translate-x-1/2 z-20
                      flex items-center gap-2">
        {slides.map((_, i) => (
          <button
            key={i}
            onClick={() => setCurrent(i)}
            className={`rounded-full transition-all duration-300 touch-manipulation ${
              i === safeCurrent
                ? "w-6 h-2 bg-[#FE7108] shadow-[0_0_8px_rgba(254,113,8,0.6)]"
                : "w-2 h-2 bg-white/60 hover:bg-white"
            }`}
            aria-label={`Pergi ke slide ${i + 1}`}
          />
        ))}
      </div>
    </section>
  );
}
