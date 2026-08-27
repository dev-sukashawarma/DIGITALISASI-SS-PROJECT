"use client";

import { useRef, useState } from "react";
import { motion, useInView } from "motion/react";

// ─── SVG Icons ────────────────────────────────────────────────────────────────

const IconCheck = () => (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
    <path d="M2.5 7.5L5.5 10.5L11.5 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

const IconInstagram = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="2" y="2" width="20" height="20" rx="5"/>
    <circle cx="12" cy="12" r="4.5"/>
    <circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none"/>
  </svg>
);

const IconBan = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="12" cy="12" r="9"/>
    <line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/>
  </svg>
);

const IconRocket = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z"/>
    <path d="m12 15-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z"/>
    <path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0"/>
    <path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5"/>
  </svg>
);

// ─── Data ─────────────────────────────────────────────────────────────────────

const STATS = [
  { value: "20+", label: "Outlet Aktif", sub: "Jabodetabek" },
  { value: "100%", label: "Profit Mitra", sub: "Sampai BEP" },
  { value: "~6 bln", label: "Balik Modal", sub: "Rata-rata" },
  { value: "456%", label: "ROI", sub: "Dalam 5 Tahun" },
];

const TRUST_BADGES = [
  { Icon: IconCheck, text: "Halal MUI" },
  { Icon: IconInstagram, text: "28K+ Followers IG" },
  { Icon: IconBan, text: "0% Royalty Fee" },
];

// ─── Motion variants ──────────────────────────────────────────────────────────

const containerVariants = {
  hidden: {},
  visible: {
    transition: { staggerChildren: 0.11, delayChildren: 0.08 },
  },
};

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  visible: {
    opacity: 1, y: 0,
    transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] },
  },
};

const slideRight = {
  hidden: { opacity: 0, x: 56 },
  visible: {
    opacity: 1, x: 0,
    transition: { duration: 0.9, ease: [0.22, 1, 0.36, 1] },
  },
};

// ─── Component ────────────────────────────────────────────────────────────────

export default function KemitraanHero() {
  const ref = useRef<HTMLElement>(null);
  const isInView = useInView(ref, { once: true, amount: 0.15 });
  const [hoveredStat, setHoveredStat] = useState<number | null>(null);

  return (
    <section
      ref={ref}
      className="relative min-h-screen bg-[#6E1A10] overflow-hidden flex items-center"
    >
      {/* ── Photo panel (right) ── */}
      <motion.div
        variants={slideRight}
        initial="hidden"
        animate={isInView ? "visible" : "hidden"}
        className="absolute inset-y-0 right-0 w-full lg:w-[55%] pointer-events-none"
      >
        <img
          src="/kemitraan/FOTO OUTLET SS/TEBET/TEBET (1).JPG"
          alt="Outlet Suka Shawarma"
          className="absolute inset-0 w-full h-full object-cover object-center"
          loading="eager"
        />
        <div
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(to right, #6E1A10 0%, #6E1A10 4%, rgba(110,26,16,0.88) 26%, rgba(110,26,16,0.42) 58%, rgba(110,26,16,0.08) 100%)",
          }}
        />
        <div
          className="absolute inset-0"
          style={{ background: "linear-gradient(to top, #6E1A10 0%, transparent 38%)" }}
        />
      </motion.div>

      {/* ── Content ── */}
      <div className="relative z-10 w-full max-w-7xl mx-auto px-6 lg:px-12 py-24 lg:py-32">
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate={isInView ? "visible" : "hidden"}
          className="max-w-xl"
        >
          {/* Pill badge */}
          <motion.div variants={fadeUp} className="mb-7">
            <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-[#FFC500]/30 bg-[#FFC500]/10 text-[#FFC500] text-[11px] font-semibold tracking-[0.18em] uppercase">
              <span className="w-1.5 h-1.5 rounded-full bg-[#FFC500] animate-pulse shrink-0" />
              Slot Mitra Terbatas — Daftar Sekarang
            </span>
          </motion.div>

          {/* Headings */}
          <motion.h1
            variants={fadeUp}
            className="text-white font-bold leading-[1.05] tracking-tight mb-3"
            style={{ fontSize: "clamp(2.4rem, 5.5vw, 4rem)" }}
          >
            100% Profit Untukmu
          </motion.h1>
          <motion.h2
            variants={fadeUp}
            className="text-white font-bold leading-[1.1] tracking-tight mb-1"
            style={{ fontSize: "clamp(1.45rem, 3vw, 2.2rem)" }}
          >
            Sampai Balik Modal,
          </motion.h2>
          <motion.h2
            variants={fadeUp}
            className="font-bold leading-[1.1] tracking-tight mb-7 text-[#FE7108]"
            style={{ fontSize: "clamp(1.45rem, 3vw, 2.2rem)" }}
          >
            Lanjut 50:50 Selamanya
          </motion.h2>

          {/* Body */}
          <motion.p
            variants={fadeUp}
            className="text-white/65 leading-relaxed mb-4 max-w-md"
            style={{ fontSize: "clamp(0.93rem, 1.5vw, 1.05rem)" }}
          >
            Kami mau kamu balik modal dulu — baru kami ikut untung. Sistem 2 fase ini
            yang bikin mitra kami BEP 2× lebih cepat dari franchise biasa.
          </motion.p>

          <motion.div variants={fadeUp} className="flex items-center gap-2 mb-9">
            <span className="text-[#FFC500]"><IconRocket /></span>
            <p className="text-[#FFC500] font-semibold text-xs tracking-[0.16em] uppercase">
              Balik Modal Dulu, Baru Bagi Hasil
            </p>
          </motion.div>

          {/* CTA buttons */}
          <motion.div variants={fadeUp} className="flex flex-col sm:flex-row gap-3 mb-10">
            <motion.a
              href="#paket"
              whileHover={{ scale: 1.04 }}
              whileTap={{ scale: 0.97 }}
              transition={{ type: "spring", stiffness: 300, damping: 20 }}
              className="inline-flex items-center justify-center px-8 py-3.5 rounded-full
                         bg-[#FE7108] text-white font-semibold text-sm tracking-wide
                         shadow-[0_8px_24px_-4px_rgba(254,113,8,0.5)]
                         hover:bg-[#e86300] transition-colors duration-200"
            >
              Lihat Paket Investasi
            </motion.a>
            <motion.a
              href="#roi"
              whileHover={{ scale: 1.04, backgroundColor: "rgba(255,255,255,0.08)" }}
              whileTap={{ scale: 0.97 }}
              transition={{ type: "spring", stiffness: 300, damping: 20 }}
              className="inline-flex items-center justify-center gap-1.5 px-8 py-3.5 rounded-full
                         border border-white/30 text-white font-semibold text-sm tracking-wide
                         hover:border-white/60 transition-colors duration-200"
            >
              Hitung ROI Saya
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
            </motion.a>
          </motion.div>

          {/* Trust badges */}
          <motion.div variants={fadeUp} className="flex flex-wrap items-center gap-5 mb-12">
            {TRUST_BADGES.map(({ Icon, text }) => (
              <div key={text} className="flex items-center gap-1.5 text-white/60 text-sm">
                <span className="text-white/50"><Icon /></span>
                <span>{text}</span>
              </div>
            ))}
          </motion.div>

          {/* Stats */}
          <motion.div variants={fadeUp} className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {STATS.map((s, i) => (
              <motion.div
                key={s.label}
                onHoverStart={() => setHoveredStat(i)}
                onHoverEnd={() => setHoveredStat(null)}
                animate={
                  hoveredStat === i
                    ? { y: -4, backgroundColor: "rgba(254,113,8,0.18)" }
                    : { y: 0, backgroundColor: "rgba(255,255,255,0.07)" }
                }
                transition={{ type: "spring", stiffness: 280, damping: 22 }}
                className="rounded-2xl p-4 text-center cursor-default border border-white/[0.12]"
              >
                <p className="font-bold text-white leading-none mb-1" style={{ fontSize: "clamp(1.25rem, 2.4vw, 1.6rem)" }}>
                  {s.value}
                </p>
                <p className="text-white/60 text-[11px] font-medium">{s.label}</p>
                <p className="text-white/35 text-[10px] mt-0.5">{s.sub}</p>
              </motion.div>
            ))}
          </motion.div>
        </motion.div>
      </div>

      {/* Grain overlay */}
      <div
        className="absolute inset-0 pointer-events-none opacity-[0.02]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
          backgroundSize: "180px 180px",
        }}
      />
    </section>
  );
}
