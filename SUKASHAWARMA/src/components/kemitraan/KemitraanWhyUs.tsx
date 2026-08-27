"use client";

import { useRef } from "react";
import { motion, useInView } from "motion/react";

// ─── SVG Icons ────────────────────────────────────────────────────────────────

const IconHandshake = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M20.42 4.58a5.4 5.4 0 0 0-7.65 0l-.77.78-.77-.78a5.4 5.4 0 0 0-7.65 7.65l.77.78 7.65 7.65 7.65-7.65.78-.78a5.4 5.4 0 0 0 0-7.65z"/>
    <path d="m2 12 5 5"/>
    <path d="m17 7 5 5"/>
    <path d="M7 12h.01M17 12h.01"/>
    <path d="M9 9 7 11l5 5 5-5-2-2"/>
  </svg>
);

const IconSettings = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="12" cy="12" r="3"/>
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
  </svg>
);

const IconMapPin = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
    <circle cx="12" cy="10" r="3"/>
  </svg>
);

const IconUtensilsCrossed = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="m16 2-2.3 2.3a3 3 0 0 0 0 4.2l1.8 1.8a3 3 0 0 0 4.2 0L22 8"/>
    <path d="M15 15 3.3 3.3a4.2 4.2 0 0 0 0 6l7.3 7.3c.7.7 2 .7 2.8 0L15 15zm0 0 7 7"/>
    <path d="m2.1 21.8 6.4-6.3"/>
    <path d="m19 5-7 7"/>
  </svg>
);

// ─── Data ─────────────────────────────────────────────────────────────────────

const reasons = [
  {
    Icon: IconHandshake,
    title: "100% Profit Dulu, Baru Bagi Hasil",
    description:
      "Sampai kamu balik modal, 100% profit adalah hakmu. Setelah BEP tercapai, baru kami bagi hasil 50:50. Kami baru untung kalau kamu sudah untung.",
  },
  {
    Icon: IconSettings,
    title: "Terima Beres, Tanpa Drama",
    description:
      "Tim kami urus operasional harian, rekrut staf, hingga marketing digital. Kamu cukup pantau laporan dari rumah.",
  },
  {
    Icon: IconMapPin,
    title: "Brand Sudah Terbukti",
    description:
      "28.000+ followers Instagram, 20+ outlet aktif Jabodetabek. Bukan bisnis baru — sudah ada fanbase loyal.",
  },
  {
    Icon: IconUtensilsCrossed,
    title: "Produk Viral & Repeat Order",
    description:
      "Shawarma mulai 20 ribuan — harga entry-level dengan rasa premium khas Timur Tengah. Tinggi repeat buyer.",
  },
];

// ─── Component ────────────────────────────────────────────────────────────────

export default function KemitraanWhyUs() {
  const ref = useRef<HTMLElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.15 });

  return (
    <section ref={ref} className="py-14 lg:py-28 bg-[#FAF7F2]">
      <div className="max-w-7xl mx-auto px-6 lg:px-8">

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          className="mb-12"
        >
          <p className="text-[11px] font-semibold tracking-[0.22em] uppercase text-[#FE7108] mb-3">
            Kenapa SukaShawarma?
          </p>
          <h2 className="font-bold text-3xl md:text-5xl tracking-tight text-[#111111] mb-4 leading-[1.08]">
            Bukan Sekadar Franchise Biasa
          </h2>
          <p className="text-[#111111]/55 text-base max-w-xl leading-relaxed">
            Kami bangun sistem yang bikin kamu untung — bukan cuma nama brand yang bisa kamu pakai.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {reasons.map((item, i) => (
            <motion.div
              key={item.title}
              initial={{ opacity: 0, y: 24 }}
              animate={inView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.55, delay: 0.1 + i * 0.1, ease: [0.16, 1, 0.3, 1] }}
              className="group bg-white rounded-2xl p-6 border border-black/[0.05]
                         shadow-[0_2px_16px_rgba(0,0,0,0.05)]
                         hover:shadow-[0_8px_32px_rgba(110,26,16,0.10)]
                         hover:-translate-y-1 transition-all duration-300"
            >
              {/* Icon box */}
              <div className="w-11 h-11 rounded-xl bg-[#6E1A10]/[0.07] flex items-center justify-center mb-4 text-[#6E1A10] group-hover:bg-[#6E1A10] group-hover:text-white transition-colors duration-300">
                <item.Icon />
              </div>
              <h3 className="font-bold text-[#111111] text-sm leading-snug mb-2">
                {item.title}
              </h3>
              <p className="text-xs text-[#111111]/55 leading-relaxed">
                {item.description}
              </p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
