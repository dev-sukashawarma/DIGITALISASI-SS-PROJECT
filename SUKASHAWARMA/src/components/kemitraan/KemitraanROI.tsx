declare const gtag: (...args: unknown[]) => void;

// ─── SVG Icons ────────────────────────────────────────────────────────────────

const IconWallet = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M21 12V7H5a2 2 0 0 1 0-4h14v4"/>
    <path d="M3 5v14a2 2 0 0 0 2 2h16v-5"/>
    <path d="M18 12a2 2 0 0 0 0 4h4v-4Z"/>
  </svg>
);

const IconMapPin = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
    <circle cx="12" cy="10" r="3"/>
  </svg>
);

const IconBarChart = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <line x1="18" y1="20" x2="18" y2="10"/>
    <line x1="12" y1="20" x2="12" y2="4"/>
    <line x1="6" y1="20" x2="6" y2="14"/>
  </svg>
);

const IconSplit = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M16 3h5v5"/>
    <path d="M8 3H3v5"/>
    <path d="M12 22v-8.3a4 4 0 0 0-1.172-2.872L3 3"/>
    <path d="m15 9 6-6"/>
  </svg>
);

const IconFileText = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
    <polyline points="14 2 14 8 20 8"/>
    <line x1="16" y1="13" x2="8" y2="13"/>
    <line x1="16" y1="17" x2="8" y2="17"/>
    <polyline points="10 9 9 9 8 9"/>
  </svg>
);

// ─── Component ────────────────────────────────────────────────────────────────

export default function KemitraanROI() {
  return (
    <section id="roi" className="py-14 lg:py-28 bg-[#FAF7F2]">
      <div className="max-w-7xl mx-auto px-6 lg:px-8">

        <div className="text-center mb-12">
          <p className="text-[11px] font-semibold tracking-[0.22em] uppercase text-[#FE7108] mb-3">
            Simulasi ROI
          </p>
          <h2 className="font-bold text-3xl md:text-5xl tracking-tight text-[#111111] mb-4 leading-[1.08]">
            Hitung Potensi Cuan Kamu
          </h2>
          <p className="text-[#111111]/55 max-w-md mx-auto text-base leading-relaxed">
            Proyeksi return berdasarkan data performa outlet aktif kami.
          </p>
        </div>

        <div className="max-w-4xl mx-auto">

          {/* Input summary */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
            {[
              { Icon: IconWallet,  label: "Modal Investasi",       value: "Rp 135 Juta" },
              { Icon: IconMapPin,  label: "Estimasi Omzet / Bulan", value: "Rp 75 Juta" },
              { Icon: IconBarChart,label: "Margin Profit Bersih",   value: "30% margin" },
              { Icon: IconSplit,   label: "Model Bagi Hasil",       value: "100% s.d. BEP → 50:50 selamanya" },
            ].map(({ Icon, label, value }) => (
              <div key={label} className="bg-white rounded-xl p-5 border border-black/[0.05] flex items-start gap-3">
                <span className="flex items-center justify-center w-9 h-9 rounded-lg bg-[#6E1A10]/[0.07] text-[#6E1A10] shrink-0 mt-0.5">
                  <Icon />
                </span>
                <div>
                  <p className="text-[11px] text-[#111111]/45 mb-0.5 tracking-wide">{label}</p>
                  <p className="font-semibold text-[#111111] text-sm leading-snug">{value}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Output */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-10">
            {[
              { value: "~6 Bln",     label: "Estimasi BEP",      sub: "(100% profit fase 1)" },
              { value: "Rp 11,4 Jt", label: "Bagi Hasil / Bulan", sub: "(50:50 post-BEP)" },
              { value: "456%",       label: "ROI dalam 5 Tahun",  sub: "" },
            ].map((item) => (
              <div key={item.label} className="bg-[#6E1A10] rounded-2xl p-6 text-center">
                <p className="font-bold text-white mb-1 leading-none" style={{ fontSize: "clamp(1.6rem, 3vw, 2rem)" }}>
                  {item.value}
                </p>
                <p className="text-white/75 text-sm font-medium">{item.label}</p>
                {item.sub && <p className="text-white/45 text-xs mt-0.5">{item.sub}</p>}
              </div>
            ))}
          </div>

          {/* Document CTA */}
          <div className="bg-white rounded-2xl p-6 sm:p-7 border border-black/[0.06]
                          shadow-[0_4px_24px_rgba(0,0,0,0.06)]
                          flex flex-col gap-6 items-start md:items-center md:flex-row">
            <div className="flex-1">
              <div className="flex items-center gap-2.5 mb-2">
                <span className="flex items-center justify-center w-8 h-8 rounded-lg bg-[#6E1A10]/[0.08] text-[#6E1A10] shrink-0">
                  <IconFileText />
                </span>
                <p className="font-bold text-[#111111] text-base">Data Perhitungan Lengkap</p>
              </div>
              <p className="text-sm text-[#111111]/55 mb-1">Mau lihat breakdown angka yang lebih detail?</p>
              <p className="text-sm text-[#111111]/55 leading-relaxed">
                Dapatkan Dokumen Mitra lengkap — proyeksi omzet, biaya operasional,
                simulasi BEP &amp; cashflow 5 tahun — gratis via WhatsApp.
              </p>
            </div>
            <a
              href="https://wa.me/6282299325621"
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => { if (typeof gtag !== "undefined") gtag("event", "conversion", { send_to: "AW-11522229721/18NOCPO46eYcENmLnfYq", value: 1.0, currency: "IDR" }); }}
              className="shrink-0 w-full md:w-auto inline-flex items-center justify-center gap-2 px-6 py-3 rounded-full
                         bg-[#25D366] text-white font-semibold text-sm
                         hover:bg-[#1ebe5d] transition-colors duration-200"
            >
              Minta Dokumen Lengkap
            </a>
          </div>

        </div>
      </div>
    </section>
  );
}
