"use client";

import { useRef } from "react";
import { motion, useInView } from "motion/react";

const BADGES = [
  { label: "Min. 50 Pcs" },
  { label: "Diskon 15%" },
  { label: "Bebas Pilih Menu" },
  { label: "DP 50%" },
];

export default function PaketHero() {
  const ref = useRef<HTMLElement>(null);
  const isInView = useInView(ref, { once: true, amount: 0.2 });

  return (
    <section ref={ref} className="relative bg-[#6E1A10] overflow-hidden pt-32 pb-16 lg:pt-40 lg:pb-24">
      <div className="relative z-10 max-w-4xl mx-auto px-6 lg:px-8 text-center">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          className="mb-6"
        >
          <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-[#FFC500]/30 bg-[#FFC500]/10 text-[#FFC500] text-[11px] font-semibold tracking-[0.18em] uppercase">
            Untuk Acara & Rombongan
          </span>
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6, delay: 0.08, ease: [0.22, 1, 0.36, 1] }}
          className="text-white font-bold leading-[1.08] tracking-tight mb-4"
          style={{ fontSize: "clamp(2rem, 5vw, 3.5rem)" }}
        >
          Shawarma Buat Rame-Rame,{" "}
          <span className="text-[#FE7108]">Nggak Ribet</span>
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6, delay: 0.16, ease: [0.22, 1, 0.36, 1] }}
          className="text-white/65 leading-relaxed mb-9 max-w-xl mx-auto"
          style={{ fontSize: "clamp(0.95rem, 1.5vw, 1.05rem)" }}
        >
          Pesan Suka Shawarma untuk acara kantor, sekolah, atau komunitas.
          Bebas pilih menu sendiri, minimal 50 pcs langsung dapat diskon 15%.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6, delay: 0.24, ease: [0.22, 1, 0.36, 1] }}
          className="flex flex-col sm:flex-row gap-3 justify-center mb-10"
        >
          <a
            href="#menu-paket"
            className="inline-flex items-center justify-center px-8 py-3.5 rounded-full
                       bg-[#FE7108] text-white font-semibold text-sm tracking-wide
                       shadow-[0_8px_24px_-4px_rgba(254,113,8,0.5)]
                       hover:bg-[#e86300] transition-colors duration-200"
          >
            Mulai Pilih Menu
          </a>
          <a
            href="#ketentuan"
            className="inline-flex items-center justify-center px-8 py-3.5 rounded-full
                       border border-white/30 text-white font-semibold text-sm tracking-wide
                       hover:border-white/60 transition-colors duration-200"
          >
            Lihat Ketentuan
          </a>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6, delay: 0.32, ease: [0.22, 1, 0.36, 1] }}
          className="flex flex-wrap justify-center gap-3"
        >
          {BADGES.map((b) => (
            <span
              key={b.label}
              className="px-4 py-2 rounded-full bg-white/[0.08] border border-white/[0.12] text-white/80 text-xs font-medium"
            >
              {b.label}
            </span>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
