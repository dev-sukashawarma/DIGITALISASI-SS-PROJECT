"use client";

import { lazy, Suspense, useState, useEffect } from "react";
import { motion } from "motion/react";
import { outlets } from "@/data/outlets";

// Lazy load — Leaflet is client-only and heavy
const OutletMap = lazy(() => import("./OutletMap"));

const MapFallback = () => (
  <div className="w-full h-[400px] md:h-[600px] lg:h-[780px] rounded-[28px] bg-[#e8e3dc] animate-pulse flex items-center justify-center">
    <p className="text-[#6E1A10]/40 text-sm font-medium">Memuat peta...</p>
  </div>
);

export default function Locations() {
  const [isMounted, setIsMounted] = useState(false);
  useEffect(() => setIsMounted(true), []);

  return (
    <section id="locations" className="relative py-20 lg:py-28 bg-white overflow-hidden">
      {/* Layer 1 (z-[10]): Ambient warmth backdrop glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[450px] rounded-full bg-[#6E1A10]/5 blur-3xl pointer-events-none z-[10]" />

      <div className="max-w-7xl mx-auto px-6 lg:px-8 relative z-[20]">

        {/* Section header (Layer 4) */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
          className="mb-10 relative z-[40]"
        >
          <p className="text-xs font-semibold tracking-[0.22em] uppercase text-[#FE7108] mb-3">
            Temukan Kami
          </p>
          <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
            <h2 className="text-4xl md:text-5xl font-bold tracking-tight text-[#111111] leading-[1.1]">
              Temukan Kami<br />
              <span className="text-[#6E1A10]">di Sekitar Kamu</span>
            </h2>
            <p className="text-[#111111]/50 text-sm max-w-xs md:text-right leading-relaxed">
              Klik marker di peta untuk melihat detail outlet, jam buka, dan cara pemesanan.
            </p>
          </div>
        </motion.div>

        {/* Map Container (Layer 5) with Floating Pill (Layer 3) */}
        <motion.div
          initial={{ opacity: 0, y: 32 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          className="relative w-full h-[400px] md:h-[600px] lg:h-[780px] rounded-[28px] overflow-hidden
                     shadow-layered-lg
                     border border-black/[0.04] z-[50] transform-gpu"
        >
          {/* Floating Outlet Count Pill (Layer 3) */}
          <div className="absolute top-5 right-5 z-[30] bg-white/95 backdrop-blur-md px-4 py-2 rounded-full shadow-layered-md border border-black/[0.06] text-xs font-semibold text-[#111111] flex items-center gap-2 pointer-events-none transform-gpu">
            <span className="w-2 h-2 rounded-full bg-[#FE7108] animate-pulse" />
            20+ Outlet Active
          </div>

          {isMounted ? (
            <Suspense fallback={<MapFallback />}>
              <OutletMap outlets={outlets} />
            </Suspense>
          ) : (
            <MapFallback />
          )}
        </motion.div>

        {/* Footer note */}
        <motion.p
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.3 }}
          className="text-center text-xs text-[#111111]/40 mt-5 relative z-[40]"
        >
          Klik marker untuk detail outlet · Gunakan scroll untuk zoom · Geser untuk jelajahi
        </motion.p>
      </div>
    </section>
  );
}
