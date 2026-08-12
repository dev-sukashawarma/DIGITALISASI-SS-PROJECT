export default function KemitraanROI() {
  return (
    <section id="roi" className="py-14 lg:py-28 bg-[#FAF7F2]">
      <div className="max-w-7xl mx-auto px-6 lg:px-8">
        <div className="text-center mb-12">
          <p className="text-xs font-semibold tracking-[0.22em] uppercase text-[#FE7108] mb-3">
            Simulasi ROI
          </p>
          <h2 className="font-bold text-3xl md:text-5xl tracking-tight text-[#111111] mb-4"
              style={{ fontFamily: "var(--font-heading)" }}>
            Hitung Potensi Cuan Kamu
          </h2>
          <p className="text-[#111111]/60 max-w-md mx-auto">
            Geser slider untuk simulasi return berdasarkan data proyeksi outlet aktif kami.
          </p>
        </div>

        <div className="max-w-4xl mx-auto">
          {/* Input summary */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
            {[
              { icon: "💰", label: "Modal Investasi", value: "Rp 135 Juta" },
              { icon: "📍", label: "Estimasi Omzet / Bulan", value: "Rp 75 Juta" },
              { icon: "📊", label: "Margin Profit Bersih", value: "30% margin" },
              {
                icon: "🤝",
                label: "Model Bagi Hasil",
                value: "100% s.d. BEP → 50:50 selamanya",
              },
            ].map((item) => (
              <div key={item.label}
                   className="bg-white rounded-xl p-5 border border-black/[0.05] flex items-start gap-3">
                <span className="text-xl">{item.icon}</span>
                <div>
                  <p className="text-xs text-[#111111]/50 mb-0.5">{item.label}</p>
                  <p className="font-semibold text-[#111111] text-sm">{item.value}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Output */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-10">
            {[
              { value: "~6 Bln", label: "Estimasi BEP", sub: "(100% profit fase 1)" },
              { value: "Rp 11,4 Jt", label: "Bagi Hasil / Bulan", sub: "(50:50 post-BEP)" },
              { value: "456%", label: "ROI dalam 5 Tahun", sub: "" },
            ].map((item) => (
              <div key={item.label}
                   className="bg-[#6E1A10] rounded-2xl p-6 text-center">
                <p className="font-bold text-2xl sm:text-3xl text-white mb-1"
                   style={{ fontFamily: "var(--font-heading)" }}>
                  {item.value}
                </p>
                <p className="text-white/80 text-sm font-medium">{item.label}</p>
                {item.sub && <p className="text-white/50 text-xs mt-0.5">{item.sub}</p>}
              </div>
            ))}
          </div>

          {/* Document CTA */}
          <div className="bg-white rounded-2xl p-6 sm:p-7 border border-black/[0.06]
                          shadow-[0_4px_24px_rgba(0,0,0,0.06)] flex flex-col gap-6 items-start md:items-center md:flex-row">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <span>📊</span>
                <p className="font-bold text-[#111111] text-base"
                   style={{ fontFamily: "var(--font-heading)" }}>
                  Data Perhitungan Lengkap
                </p>
              </div>
              <p className="text-sm text-[#111111]/60 mb-1">
                Mau lihat breakdown angka yang lebih detail?
              </p>
              <p className="text-sm text-[#111111]/60">
                Dapatkan Dokumen Mitra lengkap — proyeksi omzet, biaya operasional,
                simulasi BEP &amp; cashflow 5 tahun — gratis via WhatsApp.
              </p>
            </div>
            <a
              href="https://wa.me/6282299325621"
              target="_blank"
              rel="noopener noreferrer"
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
