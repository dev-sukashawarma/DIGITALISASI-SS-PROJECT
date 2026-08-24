"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { motion, useSpring, useTransform } from "motion/react";

declare const gtag: (...args: unknown[]) => void;

// ─── Animated Number ──────────────────────────────────────────────────────────

function AnimatedNumber({
  value,
  format,
}: {
  value: number;
  format: (n: number) => string;
}) {
  const spring = useSpring(value, { stiffness: 180, damping: 28, mass: 0.8 });
  const display = useTransform(spring, (v) => format(Math.round(v)));

  useEffect(() => {
    spring.set(value);
  }, [value, spring]);

  return <motion.span>{display}</motion.span>;
}

// ─── Custom Slider ────────────────────────────────────────────────────────────

function PremiumSlider({
  id,
  min,
  max,
  step,
  value,
  onChange,
  formatLabel,
  ariaLabel,
}: {
  id: string;
  min: number;
  max: number;
  step: number;
  value: number;
  onChange: (v: number) => void;
  formatLabel: (v: number) => string;
  ariaLabel: string;
}) {
  const pct = ((value - min) / (max - min)) * 100;

  return (
    <div className="relative w-full py-2">
      {/* Track background */}
      <div className="relative h-2 rounded-full bg-black/[0.08]">
        {/* Filled track */}
        <div
          className="absolute left-0 top-0 h-full rounded-full
                     bg-gradient-to-r from-[#6E1A10] to-[#FE7108]
                     transition-all duration-150"
          style={{ width: `${pct}%` }}
        />
        {/* Thumb */}
        <div
          className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2
                     w-6 h-6 rounded-full bg-white
                     border-2 border-[#6E1A10]
                     shadow-[0_2px_8px_rgba(110,26,16,0.30)]
                     transition-transform duration-100
                     hover:scale-110 active:scale-95"
          style={{ left: `${pct}%` }}
        />
      </div>
      {/* Native range — positioned over everything, invisible */}
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        aria-label={ariaLabel}
        aria-valuenow={value}
        aria-valuetext={formatLabel(value)}
        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
        style={{ WebkitAppearance: "none" }}
      />
    </div>
  );
}

// ─── Discrete two-value slider (125 / 150 Jt) ─────────────────────────────────

function ModalSlider({
  value,
  onChange,
}: {
  value: number;
  onChange: (v: number) => void;
}) {
  const options = [125_000_000, 150_000_000];
  const idx = value === 125_000_000 ? 0 : 1;
  const pct = idx === 0 ? 0 : 100;

  return (
    <div className="relative w-full">
      {/* Labels */}
      <div className="flex justify-between mb-3">
        {options.map((opt, i) => (
          <button
            key={opt}
            onClick={() => onChange(opt)}
            className={`text-xs font-semibold px-3 py-1 rounded-full transition-all duration-200
                        ${idx === i
                          ? "bg-[#6E1A10] text-white"
                          : "bg-black/[0.06] text-[#111111]/50 hover:bg-black/10"
                        }`}
          >
            Rp {opt === 125_000_000 ? "125" : "150"} Juta
          </button>
        ))}
      </div>
      {/* Track */}
      <div className="relative h-2 rounded-full bg-black/[0.08]">
        <div
          className="absolute left-0 top-0 h-full rounded-full
                     bg-gradient-to-r from-[#6E1A10] to-[#FE7108]
                     transition-all duration-300"
          style={{ width: `${pct}%` }}
        />
        <motion.div
          animate={{ left: `${pct}%` }}
          transition={{ type: "spring", stiffness: 400, damping: 30 }}
          className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2
                     w-5 h-5 rounded-full bg-white
                     border-2 border-[#6E1A10]
                     shadow-[0_2px_8px_rgba(110,26,16,0.30)]"
        />
        <input
          type="range"
          min={0}
          max={1}
          step={1}
          value={idx}
          onChange={(e) => onChange(options[Number(e.target.value)])}
          aria-label="Modal Investasi"
          aria-valuetext={`Rp ${value === 125_000_000 ? "125" : "150"} Juta`}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
        />
      </div>
    </div>
  );
}

// ─── Calculations ─────────────────────────────────────────────────────────────

function calculate(modal: number, omzet: number, margin: number) {
  const monthlyProfit = omzet * (margin / 100);
  // BEP: months to recover full modal at 100% profit phase
  const bepMonths = Math.ceil(modal / monthlyProfit);
  // Post-BEP monthly share (50:50)
  const monthlyShare = monthlyProfit * 0.5;
  // ROI 5 years: total 5-year return / modal * 100
  // Phase 1: bepMonths × 100% profit. Phase 2: remaining months × 50% profit
  const totalMonths = 60;
  const phase1Months = Math.min(bepMonths, totalMonths);
  const phase2Months = Math.max(0, totalMonths - phase1Months);
  const totalReturn = phase1Months * monthlyProfit + phase2Months * monthlyShare;
  const roi = Math.round((totalReturn / modal) * 100);

  return { bepMonths, monthlyShare, roi };
}

// ─── Format helpers ───────────────────────────────────────────────────────────

function fmtRupiah(n: number) {
  if (n >= 1_000_000) {
    const jt = n / 1_000_000;
    return `Rp ${jt % 1 === 0 ? jt.toFixed(0) : jt.toFixed(1)} Jt`;
  }
  return `Rp ${n.toLocaleString("id-ID")}`;
}

function fmtOmzet(n: number) {
  return `Rp ${(n / 1_000_000).toFixed(0)} Juta`;
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function KemitraanCalculator() {
  const [modal, setModal] = useState(135_000_000);
  const [omzet, setOmzet] = useState(75_000_000);
  const [margin, setMargin] = useState(30);

  const { bepMonths, monthlyShare, roi } = calculate(modal, omzet, margin);

  const handleModalChange = useCallback((v: number) => setModal(v), []);
  const handleOmzetChange = useCallback((v: number) => setOmzet(v), []);
  const handleMarginChange = useCallback((v: number) => setMargin(v), []);

  const resultCards = [
    {
      label: "Estimasi BEP",
      sub: "Balik modal penuh",
      icon: "⏱️",
      value: bepMonths,
      format: (n: number) => `~${n} Bulan`,
      highlight: false,
    },
    {
      label: "Bagi Hasil / Bulan",
      sub: "Passive income (post-BEP)",
      icon: "💰",
      value: monthlyShare,
      format: (n: number) => fmtRupiah(n),
      highlight: true,
    },
    {
      label: "ROI 5 Tahun",
      sub: "Return on investment",
      icon: "📈",
      value: roi,
      format: (n: number) => `${n}%`,
      highlight: false,
    },
  ];

  return (
    <section className="py-14 lg:py-28 bg-[#FAF7F2]">
      <div className="max-w-7xl mx-auto px-6 lg:px-8">

        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          className="mb-12"
        >
          <p className="text-xs font-semibold tracking-[0.22em] uppercase text-[#FE7108] mb-3">
            Simulasi Investasi
          </p>
          <h2
            className="font-bold text-3xl md:text-5xl tracking-tight text-[#111111] mb-4"
            style={{ fontFamily: "var(--font-heading)" }}
          >
            Kalkulator Proyeksi Investasi
          </h2>
          <p className="text-[#111111]/55 text-base max-w-lg">
            Sesuaikan parameter investasi dan lihat proyeksi return secara instan
            berdasarkan data performa outlet aktif kami.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">

          {/* Left — sliders */}
          <motion.div
            initial={{ opacity: 0, x: -24 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.65, ease: [0.16, 1, 0.3, 1] }}
            className="bg-white rounded-3xl p-8
                       shadow-[0_4px_32px_rgba(0,0,0,0.08)]
                       border border-black/[0.05]
                       space-y-8"
          >
            {/* Slider 1 — Modal */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <label className="text-sm font-semibold text-[#111111]">
                  💰 Modal Investasi
                </label>
                <span className="text-sm font-bold text-[#6E1A10] bg-[#6E1A10]/[0.07]
                                 px-3 py-1 rounded-full">
                  Rp {modal === 125_000_000 ? "125" : "150"} Juta
                </span>
              </div>
              <ModalSlider value={modal} onChange={handleModalChange} />
              <p className="text-xs text-[#111111]/40 mt-2">
                Pilih paket: Rp 125 Jt (Own Location) atau Rp 150 Jt (Standard)
              </p>
            </div>

            {/* Slider 2 — Omzet */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <label
                  htmlFor="slider-omzet"
                  className="text-sm font-semibold text-[#111111]"
                >
                  📍 Estimasi Omzet / Bulan
                </label>
                <span className="text-sm font-bold text-[#6E1A10] bg-[#6E1A10]/[0.07]
                                 px-3 py-1 rounded-full">
                  {fmtOmzet(omzet)}
                </span>
              </div>
              <PremiumSlider
                id="slider-omzet"
                min={50_000_000}
                max={375_000_000}
                step={5_000_000}
                value={omzet}
                onChange={handleOmzetChange}
                formatLabel={fmtOmzet}
                ariaLabel="Estimasi Omzet per Bulan"
              />
              <div className="flex justify-between mt-1.5 text-xs text-[#111111]/35">
                <span>Rp 50 Jt</span>
                <span>Rp 375 Jt</span>
              </div>
            </div>

            {/* Slider 3 — Margin */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <label
                  htmlFor="slider-margin"
                  className="text-sm font-semibold text-[#111111]"
                >
                  📊 Margin Profit Bersih
                </label>
                <span className="text-sm font-bold text-[#6E1A10] bg-[#6E1A10]/[0.07]
                                 px-3 py-1 rounded-full">
                  {margin}%
                </span>
              </div>
              <PremiumSlider
                id="slider-margin"
                min={25}
                max={35}
                step={1}
                value={margin}
                onChange={handleMarginChange}
                formatLabel={(v) => `${v}%`}
                ariaLabel="Margin Profit Bersih"
              />
              <div className="flex justify-between mt-1.5 text-xs text-[#111111]/35">
                <span>25%</span>
                <span>35%</span>
              </div>
            </div>

            <p className="text-xs text-[#111111]/35 leading-relaxed pt-2 border-t border-black/[0.06]">
              *Proyeksi berdasarkan rata-rata performa outlet aktif. Hasil aktual
              dapat bervariasi tergantung lokasi dan kondisi pasar.
            </p>
          </motion.div>

          {/* Right — result cards */}
          <motion.div
            initial={{ opacity: 0, x: 24 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.65, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
            className="flex flex-col gap-5"
          >
            {resultCards.map((card, i) => (
              <motion.div
                key={card.label}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: 0.15 + i * 0.1, ease: [0.16, 1, 0.3, 1] }}
                className={`rounded-3xl p-5 sm:p-7 border
                            shadow-[0_4px_24px_rgba(0,0,0,0.08)]
                            transition-colors duration-300
                            ${card.highlight
                              ? "bg-[#6E1A10] border-[#6E1A10]"
                              : "bg-white border-black/[0.05]"
                            }`}
              >
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <p className={`text-xs font-semibold tracking-wide uppercase mb-0.5
                                   ${card.highlight ? "text-[#FFC500]" : "text-[#FE7108]"}`}>
                      {card.icon} {card.label}
                    </p>
                    <p className={`text-xs ${card.highlight ? "text-white/50" : "text-[#111111]/40"}`}>
                      {card.sub}
                    </p>
                  </div>
                </div>

                <p
                  className={`font-bold text-3xl sm:text-4xl tracking-tight
                               ${card.highlight ? "text-white" : "text-[#111111]"}`}
                  style={{ fontFamily: "var(--font-heading)" }}
                >
                  <AnimatedNumber value={card.value} format={card.format} />
                </p>
              </motion.div>
            ))}

            {/* WhatsApp CTA */}
            <a
              href="https://wa.me/6282299325621"
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => { if(typeof gtag !== 'undefined') gtag('event', 'conversion', {'send_to': 'AW-11522229721/18NOCPO46eYcENmLnfYq','value': 1.0,'currency': 'IDR'}); }}
              className="flex items-center justify-center gap-3 px-6 py-4 rounded-2xl
                         bg-[#25D366] text-white font-semibold text-sm
                         hover:bg-[#1ebe5d] transition-colors duration-200
                         shadow-[0_4px_20px_rgba(37,211,102,0.30)]"
            >
              <svg viewBox="0 0 24 24" className="w-5 h-5 fill-white shrink-0" aria-hidden="true">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/>
                <path d="M12 0C5.373 0 0 5.373 0 12c0 2.123.553 4.116 1.522 5.847L0 24l6.335-1.502A11.95 11.95 0 0 0 12 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.818a9.792 9.792 0 0 1-5.002-1.373l-.359-.213-3.72.882.939-3.618-.234-.372A9.792 9.792 0 0 1 2.182 12C2.182 6.57 6.57 2.182 12 2.182c5.43 0 9.818 4.388 9.818 9.818 0 5.43-4.388 9.818-9.818 9.818z"/>
              </svg>
              Diskusi Lebih Lanjut via WhatsApp
            </a>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
