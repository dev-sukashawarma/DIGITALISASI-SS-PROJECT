"use client";

import { useRef, useState } from "react";
import { motion, useInView, AnimatePresence } from "motion/react";

// ─── Data ─────────────────────────────────────────────────────────────────────
// Data berdasarkan outlet-outlet aktif yang ada di gallery

const testimonials = [
  {
    name: "Bapak Arief S.",
    outlet: "Outlet Cibinong",
    location: "Cibinong, Bogor",
    bep: "5 bulan",
    joined: "Mitra sejak 2024",
    photo: "/kemitraan/FOTO OUTLET SS/CIBINONG/CIBINONG (2).JPG",
    quote:
      "Saya awalnya ragu karena baru pertama invest di bisnis kuliner. Tapi sistemnya beneran autopilot — tim SS yang urus semuanya, saya tinggal terima laporan tiap bulan.",
    stars: 5,
  },
  {
    name: "Ibu Dewi R.",
    outlet: "Outlet Tebet",
    location: "Tebet, Jakarta Selatan",
    bep: "6 bulan",
    joined: "Mitra sejak 2024",
    photo: "/kemitraan/FOTO OUTLET SS/TEBET/TEBET (2).JPG",
    quote:
      "Yang bikin yakin itu sistem 100% profit dulu sampai BEP. Bukan janji kosong — memang begitu praktiknya. Bulan ke-6 modal sudah kembali, sekarang tinggal nikmati bagi hasil.",
    stars: 5,
  },
  {
    name: "Pak Rendi W.",
    outlet: "Outlet Pekayon",
    location: "Pekayon, Bekasi",
    bep: "7 bulan",
    joined: "Mitra sejak 2024",
    photo: "/kemitraan/FOTO OUTLET SS/PEKAYON/PEKAYON (1).JPG",
    quote:
      "Saya pilih paket Own Location karena punya ruko nganggur. Keputusan terbaik — nggak ada biaya sewa selamanya, BEP lebih cepat, dan outletnya selalu ramai.",
    stars: 5,
  },
  {
    name: "Bapak Hendra K.",
    outlet: "Outlet Jagakarsa",
    location: "Jagakarsa, Jakarta Selatan",
    bep: "6 bulan",
    joined: "Mitra sejak 2024",
    photo: "/kemitraan/FOTO OUTLET SS/JAGAKARSA/JAGAKARSA (1).JPG",
    quote:
      "Produknya memang viral. Antrian hampir setiap hari — anak muda suka banget. Tim operasional SS responsif kalau ada masalah, nggak dibiarkan sendiri.",
    stars: 5,
  },
  {
    name: "Ibu Sari M.",
    outlet: "Outlet Sukmajaya",
    location: "Sukmajaya, Depok",
    bep: "5 bulan",
    joined: "Mitra sejak 2024",
    photo: "/kemitraan/FOTO OUTLET SS/SUKMAJAYA/SUKMAJAYA (2).JPG",
    quote:
      "Transparan banget dari awal — semua biaya, proyeksi, sampai skema bagi hasilnya dijelaskan detail. Tidak ada biaya tersembunyi sama sekali.",
    stars: 5,
  },
];

// ─── Star Icon ────────────────────────────────────────────────────────────────

const IconStar = ({ filled }: { filled: boolean }) => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill={filled ? "currentColor" : "none"}
    stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
  </svg>
);

const IconQuote = () => (
  <svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M3 21c3 0 7-1 7-8V5c0-1.25-.756-2.017-2-2H4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2 1 0 1 0 1 1v1c0 1-1 2-2 2s-1 .008-1 1.031V20c0 1 0 1 1 1z"/>
    <path d="M15 21c3 0 7-1 7-8V5c0-1.25-.757-2.017-2-2h-4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2h.75c0 2.25.25 4-2.75 4v3c0 1 0 1 1 1z"/>
  </svg>
);

const IconChevron = ({ dir }: { dir: "left" | "right" }) => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
    strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {dir === "left" ? <polyline points="15 18 9 12 15 6"/> : <polyline points="9 18 15 12 9 6"/>}
  </svg>
);

// ─── Component ────────────────────────────────────────────────────────────────

export default function KemitraanTestimonials() {
  const ref = useRef<HTMLElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.1 });
  const [active, setActive] = useState(0);
  const [direction, setDirection] = useState<1 | -1>(1);

  const go = (idx: number) => {
    setDirection(idx > active ? 1 : -1);
    setActive(idx);
  };
  const prev = () => go((active - 1 + testimonials.length) % testimonials.length);
  const next = () => go((active + 1) % testimonials.length);

  const t = testimonials[active];

  const variants = {
    enter: (d: number) => ({ opacity: 0, x: d * 40 }),
    center: { opacity: 1, x: 0 },
    exit: (d: number) => ({ opacity: 0, x: d * -40 }),
  };

  return (
    <section ref={ref} className="py-14 lg:py-28 bg-[#FAF7F2]">
      <div className="max-w-7xl mx-auto px-6 lg:px-8">

        {/* Header */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }} className="mb-12">
          <p className="text-[11px] font-semibold tracking-[0.22em] uppercase text-[#FE7108] mb-3">
            Kata Mitra Kami
          </p>
          <h2 className="font-bold text-3xl md:text-5xl tracking-tight text-[#111111] leading-[1.08]">
            Mereka Sudah Buktikan
          </h2>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 24 }} animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.65, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
          className="grid grid-cols-1 lg:grid-cols-5 gap-6 items-stretch">

          {/* ── Left: photo strip ── */}
          <div className="lg:col-span-2 flex flex-row lg:flex-col gap-2 overflow-x-auto lg:overflow-visible pb-2 lg:pb-0">
            {testimonials.map((item, i) => (
              <button key={i} onClick={() => go(i)}
                className={`shrink-0 relative rounded-xl overflow-hidden transition-all duration-300
                            ${i === active
                              ? "ring-2 ring-[#FE7108] ring-offset-2 opacity-100"
                              : "opacity-50 hover:opacity-75"
                            }
                            w-16 h-16 lg:w-full lg:h-20`}
                aria-label={item.outlet}
              >
                <img src={item.photo} alt={item.outlet}
                  className="w-full h-full object-cover" loading="lazy" />
                {i === active && (
                  <div className="absolute inset-0 bg-[#FE7108]/20" />
                )}
                <div className="absolute bottom-0 inset-x-0 px-2 py-1.5 bg-gradient-to-t from-black/70 to-transparent hidden lg:block">
                  <p className="text-white text-[10px] font-semibold truncate">{item.outlet}</p>
                </div>
              </button>
            ))}
          </div>

          {/* ── Right: testimonial card ── */}
          <div className="lg:col-span-3 relative bg-white rounded-2xl border border-black/[0.05] shadow-[0_4px_32px_rgba(0,0,0,0.07)] overflow-hidden flex flex-col">

            <AnimatePresence mode="wait" custom={direction}>
              <motion.div key={active} custom={direction} variants={variants}
                initial="enter" animate="center" exit="exit"
                transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
                className="flex flex-col p-7 sm:p-8">

                {/* Quote mark */}
                <div className="text-[#6E1A10]/10 mb-4">
                  <IconQuote />
                </div>

                {/* Quote text */}
                <p className="text-[#111111]/75 text-base leading-relaxed mb-6">
                  "{t.quote}"
                </p>

                {/* Stars */}
                <div className="flex items-center gap-0.5 text-[#FE7108] mb-5">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <IconStar key={i} filled={i < t.stars} />
                  ))}
                </div>

                {/* Author */}
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="font-bold text-[#111111] text-sm">{t.name}</p>
                    <p className="text-[#111111]/50 text-xs mt-0.5">{t.outlet} · {t.location}</p>
                  </div>
                  {/* BEP badge */}
                  <div className="shrink-0 text-right">
                    <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-50 border border-emerald-200">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                      <span className="text-emerald-700 text-xs font-semibold">BEP {t.bep}</span>
                    </div>
                    <p className="text-[#111111]/35 text-[11px] mt-1">{t.joined}</p>
                  </div>
                </div>
              </motion.div>
            </AnimatePresence>

            {/* Nav arrows */}
            <div className="flex items-center justify-between px-7 pb-5 pt-0">
              <button onClick={prev} aria-label="Sebelumnya"
                className="w-9 h-9 rounded-full border border-black/[0.1] flex items-center justify-center text-[#111111]/50 hover:text-[#6E1A10] hover:border-[#6E1A10]/30 transition-colors duration-200">
                <IconChevron dir="left" />
              </button>

              {/* Dots */}
              <div className="flex items-center gap-1.5">
                {testimonials.map((_, i) => (
                  <button key={i} onClick={() => go(i)} aria-label={`Testimonial ${i + 1}`}
                    className={`rounded-full transition-all duration-300 ${i === active ? "w-5 h-2 bg-[#FE7108]" : "w-2 h-2 bg-black/[0.12] hover:bg-black/25"}`} />
                ))}
              </div>

              <button onClick={next} aria-label="Berikutnya"
                className="w-9 h-9 rounded-full border border-black/[0.1] flex items-center justify-center text-[#111111]/50 hover:text-[#6E1A10] hover:border-[#6E1A10]/30 transition-colors duration-200">
                <IconChevron dir="right" />
              </button>
            </div>
          </div>
        </motion.div>

        {/* Bottom trust note */}
        <motion.p initial={{ opacity: 0 }} animate={inView ? { opacity: 1 } : {}}
          transition={{ duration: 0.5, delay: 0.4 }}
          className="text-center text-[#111111]/35 text-xs mt-8">
          20+ mitra aktif se-Jabodetabek — bergabung sejak Mei 2024
        </motion.p>

      </div>
    </section>
  );
}
