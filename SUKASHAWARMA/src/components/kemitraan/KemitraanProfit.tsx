// ─── SVG Icons ────────────────────────────────────────────────────────────────

const IconZap = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
  </svg>
);

const IconCoins = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="8" cy="8" r="6"/>
    <path d="M18.09 10.37A6 6 0 1 1 10.34 18"/>
    <path d="M7 6h1v4"/>
    <path d="m16.71 13.88.7.71-2.82 2.82"/>
  </svg>
);

const IconCheckCircle = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
    <polyline points="22 4 12 14.01 9 11.01"/>
  </svg>
);

const IconBriefcase = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="2" y="7" width="20" height="14" rx="2" ry="2"/>
    <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/>
  </svg>
);

// ─── Component ────────────────────────────────────────────────────────────────

export default function KemitraanProfit() {
  return (
    <section className="py-14 lg:py-28 bg-white">
      <div className="max-w-7xl mx-auto px-6 lg:px-8">

        <div className="text-center mb-12">
          <p className="text-[11px] font-semibold tracking-[0.22em] uppercase text-[#FE7108] mb-3">
            Skema Bagi Hasil
          </p>
          <h2 className="font-bold text-3xl md:text-5xl tracking-tight text-[#111111] mb-4 leading-[1.08]">
            2 Fase, 1 Tujuan:{" "}
            <span className="text-[#6E1A10]">Mitra Untung Dulu</span>
          </h2>
          <p className="text-[#111111]/55 max-w-xl mx-auto text-base leading-relaxed">
            Sistem kami dirancang agar modal kamu kembali secepat mungkin — sebelum kami ikut menikmati hasilnya.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto">

          {/* Fase 1 */}
          <div className="rounded-2xl p-7 bg-[#FAF7F2] border border-black/[0.05]">
            <div className="flex items-center gap-2 mb-4">
              <span className="flex items-center justify-center w-7 h-7 rounded-full bg-[#FE7108]/10 text-[#FE7108]">
                <IconZap />
              </span>
              <p className="text-[11px] font-bold tracking-[0.18em] uppercase text-[#FE7108]">
                Fase 1 — Sebelum BEP
              </p>
            </div>
            <h3 className="font-bold text-2xl text-[#111111] mb-3 leading-tight">
              100% Net Profit<br />Untuk Mitra
            </h3>
            <p className="text-[#111111]/60 text-sm leading-relaxed mb-6">
              Seluruh keuntungan bersih outlet menjadi hak mitra. Tidak ada potongan royalty fee sama sekali.
            </p>
            <div className="flex items-center gap-2 text-emerald-600 font-semibold text-sm">
              <IconCheckCircle />
              <span>Mitra menerima 100% Net Profit</span>
            </div>
          </div>

          {/* Fase 2 */}
          <div className="rounded-2xl p-7 bg-[#6E1A10]">
            <div className="flex items-center gap-2 mb-4">
              <span className="flex items-center justify-center w-7 h-7 rounded-full bg-[#FFC500]/15 text-[#FFC500]">
                <IconCoins />
              </span>
              <p className="text-[11px] font-bold tracking-[0.18em] uppercase text-[#FFC500]">
                Fase 2 — Setelah BEP
              </p>
            </div>
            <h3 className="font-bold text-2xl text-white mb-3 leading-tight">
              50% Mitra<br />50% SS
            </h3>
            <p className="text-white/65 text-sm leading-relaxed mb-6">
              Setelah modal kembali sepenuhnya, net profit dibagi rata antara mitra dan SS. Mitra menikmati passive income tanpa keterlibatan apapun hingga akhir kontrak. Tidak ada royalty fee.
            </p>
            <div className="flex items-center gap-2 text-[#FFC500] font-semibold text-sm">
              <IconBriefcase />
              <span>Passive Income Hingga Akhir Kontrak</span>
            </div>
          </div>

        </div>
      </div>
    </section>
  );
}
