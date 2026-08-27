"use client";

import { useState, useCallback, useEffect } from "react";
import { motion, useSpring, useTransform } from "motion/react";

declare const gtag: (...args: unknown[]) => void;

// ─── SVG Icons ────────────────────────────────────────────────────────────────

const IconWallet = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M21 12V7H5a2 2 0 0 1 0-4h14v4"/><path d="M3 5v14a2 2 0 0 0 2 2h16v-5"/><path d="M18 12a2 2 0 0 0 0 4h4v-4Z"/>
  </svg>
);
const IconMapPin = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>
  </svg>
);
const IconBarChart = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/>
  </svg>
);
const IconClock = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
  </svg>
);
const IconCoins = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="8" cy="8" r="6"/><path d="M18.09 10.37A6 6 0 1 1 10.34 18"/><path d="M7 6h1v4"/><path d="m16.71 13.88.7.71-2.82 2.82"/>
  </svg>
);
const IconTrendingUp = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/>
  </svg>
);
const IconSplit = () => (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M16 3h5v5"/><path d="M8 3H3v5"/><path d="M12 22v-8.3a4 4 0 0 0-1.172-2.872L3 3"/><path d="m15 9 6-6"/>
  </svg>
);
const IconFileText = () => (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>
    <line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>
  </svg>
);

// ─── Animated Number ──────────────────────────────────────────────────────────

function AnimatedNumber({ value, format }: { value: number; format: (n: number) => string }) {
  const spring = useSpring(value, { stiffness: 180, damping: 28, mass: 0.8 });
  const display = useTransform(spring, (v) => format(Math.round(v)));
  useEffect(() => { spring.set(value); }, [value, spring]);
  return <motion.span>{display}</motion.span>;
}

// ─── Custom Slider ────────────────────────────────────────────────────────────

function PremiumSlider({ id, min, max, step, value, onChange, formatLabel, ariaLabel }: {
  id: string; min: number; max: number; step: number; value: number;
  onChange: (v: number) => void; formatLabel: (v: number) => string; ariaLabel: string;
}) {
  const pct = ((value - min) / (max - min)) * 100;
  return (
    <div className="relative w-full py-2">
      <div className="relative h-2 rounded-full bg-black/[0.07]">
        <div className="absolute left-0 top-0 h-full rounded-full bg-gradient-to-r from-[#6E1A10] to-[#FE7108] transition-all duration-150" style={{ width: `${pct}%` }} />
        <div className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-5 h-5 rounded-full bg-white border-2 border-[#6E1A10] shadow-[0_2px_8px_rgba(110,26,16,0.25)] hover:scale-110 active:scale-95 transition-transform duration-100" style={{ left: `${pct}%` }} />
      </div>
      <input id={id} type="range" min={min} max={max} step={step} value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        aria-label={ariaLabel} aria-valuenow={value} aria-valuetext={formatLabel(value)}
        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" style={{ WebkitAppearance: "none" }} />
    </div>
  );
}

function ModalSlider({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const options = [125_000_000, 150_000_000];
  const idx = value === 125_000_000 ? 0 : 1;
  const pct = idx === 0 ? 0 : 100;
  return (
    <div className="relative w-full">
      <div className="flex justify-between mb-3">
        {options.map((opt, i) => (
          <button key={opt} onClick={() => onChange(opt)}
            className={`text-xs font-semibold px-3 py-1 rounded-full transition-all duration-200 ${idx === i ? "bg-[#6E1A10] text-white" : "bg-black/[0.06] text-[#111111]/45 hover:bg-black/10"}`}>
            Rp {opt === 125_000_000 ? "125" : "150"} Juta
          </button>
        ))}
      </div>
      <div className="relative h-2 rounded-full bg-black/[0.07]">
        <div className="absolute left-0 top-0 h-full rounded-full bg-gradient-to-r from-[#6E1A10] to-[#FE7108] transition-all duration-300" style={{ width: `${pct}%` }} />
        <motion.div animate={{ left: `${pct}%` }} transition={{ type: "spring", stiffness: 400, damping: 30 }}
          className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-5 h-5 rounded-full bg-white border-2 border-[#6E1A10] shadow-[0_2px_8px_rgba(110,26,16,0.25)]" />
        <input type="range" min={0} max={1} step={1} value={idx}
          onChange={(e) => onChange(options[Number(e.target.value)])}
          aria-label="Modal Investasi" className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
      </div>
    </div>
  );
}

// ─── Calculations ─────────────────────────────────────────────────────────────

function calculate(modal: number, omzet: number, margin: number) {
  const monthlyProfit = omzet * (margin / 100);
  const bepMonths = Math.ceil(modal / monthlyProfit);
  const monthlyShare = monthlyProfit * 0.5;
  const totalMonths = 60;
  const phase1Months = Math.min(bepMonths, totalMonths);
  const phase2Months = Math.max(0, totalMonths - phase1Months);
  const totalReturn = phase1Months * monthlyProfit + phase2Months * monthlyShare;
  const roi = Math.round((totalReturn / modal) * 100);
  return { bepMonths, monthlyShare, roi };
}

function fmtRupiah(n: number) {
  if (n >= 1_000_000) { const jt = n / 1_000_000; return `Rp ${jt % 1 === 0 ? jt.toFixed(0) : jt.toFixed(1)} Jt`; }
  return `Rp ${n.toLocaleString("id-ID")}`;
}
function fmtOmzet(n: number) { return `Rp ${(n / 1_000_000).toFixed(0)} Juta`; }

// ─── Component ────────────────────────────────────────────────────────────────

export default function KemitraanCalculator() {
  const [modal, setModal] = useState(125_000_000);
  const [omzet, setOmzet] = useState(75_000_000);
  const [margin, setMargin] = useState(30);

  const { bepMonths, monthlyShare, roi } = calculate(modal, omzet, margin);
  const handleModalChange = useCallback((v: number) => setModal(v), []);
  const handleOmzetChange = useCallback((v: number) => setOmzet(v), []);
  const handleMarginChange = useCallback((v: number) => setMargin(v), []);

  const resultCards = [
    { label: "Estimasi BEP", sub: "Balik modal penuh", Icon: IconClock, value: bepMonths, format: (n: number) => `~${n} Bulan`, highlight: false },
    { label: "Bagi Hasil / Bulan", sub: "Passive income (post-BEP)", Icon: IconCoins, value: monthlyShare, format: fmtRupiah, highlight: true },
    { label: "ROI 5 Tahun", sub: "Return on investment", Icon: IconTrendingUp, value: roi, format: (n: number) => `${n}%`, highlight: false },
  ];

  return (
    <section id="roi" className="py-14 lg:py-28 bg-[#FAF7F2]">
      <div className="max-w-7xl mx-auto px-6 lg:px-8">

        {/* ── Header ── */}
        <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }} className="mb-14">
          <p className="text-[11px] font-semibold tracking-[0.22em] uppercase text-[#FE7108] mb-3">
            Simulasi Investasi
          </p>
          <h2 className="font-bold text-3xl md:text-5xl tracking-tight text-[#111111] mb-4 leading-[1.08]">
            Hitung Potensi Cuan Kamu
          </h2>
          <p className="text-[#111111]/55 text-base max-w-lg leading-relaxed">
            Geser slider untuk proyeksi return berdasarkan data performa outlet aktif kami — bukan angka di atas kertas.
          </p>
        </motion.div>

        {/* ── Static overview cards ── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-12">
          {[
            { Icon: IconWallet,   label: "Modal Investasi",        value: "Rp 125–150 Juta" },
            { Icon: IconMapPin,   label: "Estimasi Omzet / Bulan", value: "Rp 75 Juta" },
            { Icon: IconBarChart, label: "Margin Profit Bersih",   value: "30% rata-rata" },
            { Icon: IconSplit,    label: "Model Bagi Hasil",        value: "100% → 50:50" },
          ].map(({ Icon, label, value }) => (
            <motion.div key={label}
              initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }} transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
              className="bg-white rounded-xl p-4 border border-black/[0.05] flex items-center gap-3">
              <span className="flex items-center justify-center w-10 h-10 rounded-lg bg-[#6E1A10]/[0.07] text-[#6E1A10] shrink-0">
                <Icon />
              </span>
              <div>
                <p className="text-[11px] text-[#111111]/40 mb-0.5">{label}</p>
                <p className="font-semibold text-[#111111] text-sm">{value}</p>
              </div>
            </motion.div>
          ))}
        </div>

        {/* ── Calculator + results ── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start mb-10">

          {/* Sliders */}
          <motion.div initial={{ opacity: 0, x: -24 }} whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }} transition={{ duration: 0.65, ease: [0.16, 1, 0.3, 1] }}
            className="bg-white rounded-3xl p-8 shadow-[0_4px_32px_rgba(0,0,0,0.07)] border border-black/[0.05] space-y-8">

            <div>
              <div className="flex items-center justify-between mb-4">
                <label className="flex items-center gap-2 text-sm font-semibold text-[#111111]">
                  <span className="flex items-center justify-center w-7 h-7 rounded-lg bg-[#6E1A10]/[0.07] text-[#6E1A10]"><IconWallet /></span>
                  Modal Investasi
                </label>
                <span className="text-sm font-bold text-[#6E1A10] bg-[#6E1A10]/[0.07] px-3 py-1 rounded-full">
                  Rp {modal === 125_000_000 ? "125" : "150"} Juta
                </span>
              </div>
              <ModalSlider value={modal} onChange={handleModalChange} />
              <p className="text-[11px] text-[#111111]/35 mt-2">Rp 125 Jt (Own Location) atau Rp 150 Jt (Standard)</p>
            </div>

            <div>
              <div className="flex items-center justify-between mb-4">
                <label htmlFor="slider-omzet" className="flex items-center gap-2 text-sm font-semibold text-[#111111]">
                  <span className="flex items-center justify-center w-7 h-7 rounded-lg bg-[#6E1A10]/[0.07] text-[#6E1A10]"><IconMapPin /></span>
                  Estimasi Omzet / Bulan
                </label>
                <span className="text-sm font-bold text-[#6E1A10] bg-[#6E1A10]/[0.07] px-3 py-1 rounded-full">{fmtOmzet(omzet)}</span>
              </div>
              <PremiumSlider id="slider-omzet" min={50_000_000} max={375_000_000} step={5_000_000}
                value={omzet} onChange={handleOmzetChange} formatLabel={fmtOmzet} ariaLabel="Estimasi Omzet per Bulan" />
              <div className="flex justify-between mt-1.5 text-[11px] text-[#111111]/30"><span>Rp 50 Jt</span><span>Rp 375 Jt</span></div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-4">
                <label htmlFor="slider-margin" className="flex items-center gap-2 text-sm font-semibold text-[#111111]">
                  <span className="flex items-center justify-center w-7 h-7 rounded-lg bg-[#6E1A10]/[0.07] text-[#6E1A10]"><IconBarChart /></span>
                  Margin Profit Bersih
                </label>
                <span className="text-sm font-bold text-[#6E1A10] bg-[#6E1A10]/[0.07] px-3 py-1 rounded-full">{margin}%</span>
              </div>
              <PremiumSlider id="slider-margin" min={25} max={35} step={1}
                value={margin} onChange={handleMarginChange} formatLabel={(v) => `${v}%`} ariaLabel="Margin Profit Bersih" />
              <div className="flex justify-between mt-1.5 text-[11px] text-[#111111]/30"><span>25%</span><span>35%</span></div>
            </div>

            <p className="text-[11px] text-[#111111]/30 leading-relaxed pt-2 border-t border-black/[0.06]">
              *Proyeksi berdasarkan rata-rata performa outlet aktif. Hasil aktual dapat bervariasi tergantung lokasi dan kondisi pasar.
            </p>
          </motion.div>

          {/* Result cards */}
          <motion.div initial={{ opacity: 0, x: 24 }} whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }} transition={{ duration: 0.65, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
            className="flex flex-col gap-4">
            {resultCards.map((card, i) => (
              <motion.div key={card.label}
                initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }} transition={{ duration: 0.5, delay: 0.15 + i * 0.1, ease: [0.16, 1, 0.3, 1] }}
                className={`rounded-3xl p-5 sm:p-6 border shadow-[0_4px_24px_rgba(0,0,0,0.07)] ${card.highlight ? "bg-[#6E1A10] border-[#6E1A10]" : "bg-white border-black/[0.05]"}`}>
                <div className="flex items-center gap-2.5 mb-4">
                  <span className={`flex items-center justify-center w-8 h-8 rounded-lg ${card.highlight ? "bg-[#FFC500]/15 text-[#FFC500]" : "bg-[#6E1A10]/[0.07] text-[#6E1A10]"}`}>
                    <card.Icon />
                  </span>
                  <div>
                    <p className={`text-[11px] font-semibold tracking-wide uppercase ${card.highlight ? "text-[#FFC500]" : "text-[#FE7108]"}`}>{card.label}</p>
                    <p className={`text-[11px] ${card.highlight ? "text-white/45" : "text-[#111111]/35"}`}>{card.sub}</p>
                  </div>
                </div>
                <p className={`font-bold tracking-tight leading-none ${card.highlight ? "text-white" : "text-[#111111]"}`}
                  style={{ fontSize: "clamp(1.9rem, 3.5vw, 2.4rem)" }}>
                  <AnimatedNumber value={card.value} format={card.format} />
                </p>
              </motion.div>
            ))}

            <a href="https://wa.me/6282299325621" target="_blank" rel="noopener noreferrer"
              onClick={() => { if (typeof gtag !== "undefined") gtag("event", "conversion", { send_to: "AW-11522229721/18NOCPO46eYcENmLnfYq", value: 1.0, currency: "IDR" }); }}
              className="flex items-center justify-center gap-3 px-6 py-4 rounded-2xl bg-[#25D366] text-white font-semibold text-sm hover:bg-[#1ebe5d] transition-colors duration-200 shadow-[0_4px_20px_rgba(37,211,102,0.28)]">
              <svg viewBox="0 0 24 24" className="w-5 h-5 fill-white shrink-0" aria-hidden="true">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/>
                <path d="M12 0C5.373 0 0 5.373 0 12c0 2.123.553 4.116 1.522 5.847L0 24l6.335-1.502A11.95 11.95 0 0 0 12 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.818a9.792 9.792 0 0 1-5.002-1.373l-.359-.213-3.72.882.939-3.618-.234-.372A9.792 9.792 0 0 1 2.182 12C2.182 6.57 6.57 2.182 12 2.182c5.43 0 9.818 4.388 9.818 9.818 0 5.43-4.388 9.818-9.818 9.818z"/>
              </svg>
              Diskusi Lebih Lanjut via WhatsApp
            </a>
          </motion.div>
        </div>

        {/* ── Document CTA banner ── */}
        <motion.div initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }} transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
          className="bg-white rounded-2xl p-6 sm:p-7 border border-black/[0.06] shadow-[0_4px_24px_rgba(0,0,0,0.06)] flex flex-col gap-5 items-start md:items-center md:flex-row">
          <div className="flex-1">
            <div className="flex items-center gap-2.5 mb-2">
              <span className="flex items-center justify-center w-8 h-8 rounded-lg bg-[#6E1A10]/[0.08] text-[#6E1A10] shrink-0">
                <IconFileText />
              </span>
              <p className="font-bold text-[#111111] text-base">Mau angka yang lebih detail?</p>
            </div>
            <p className="text-sm text-[#111111]/55 leading-relaxed">
              Dapatkan Dokumen Mitra lengkap — proyeksi omzet, biaya operasional, simulasi BEP &amp; cashflow 5 tahun — gratis via WhatsApp.
            </p>
          </div>
          <a href="https://wa.me/6282299325621" target="_blank" rel="noopener noreferrer"
            onClick={() => { if (typeof gtag !== "undefined") gtag("event", "conversion", { send_to: "AW-11522229721/18NOCPO46eYcENmLnfYq", value: 1.0, currency: "IDR" }); }}
            className="shrink-0 w-full md:w-auto inline-flex items-center justify-center gap-2 px-6 py-3 rounded-full bg-[#25D366] text-white font-semibold text-sm hover:bg-[#1ebe5d] transition-colors duration-200">
            Minta Dokumen Lengkap
          </a>
        </motion.div>

      </div>
    </section>
  );
}
