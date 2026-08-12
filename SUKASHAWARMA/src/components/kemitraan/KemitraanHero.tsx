export default function KemitraanHero() {
  return (
    <section className="relative bg-[#6E1A10] overflow-hidden py-16 lg:py-36">
      <div className="max-w-7xl mx-auto px-6 lg:px-8">
        <div className="max-w-3xl">
          <p className="text-xs font-semibold tracking-[0.22em] uppercase text-[#FFC500] mb-4">
            🔥 Slot Mitra Terbatas — Daftar Sekarang
          </p>

          <h1 className="font-bold text-3xl md:text-5xl lg:text-6xl leading-[1.08] tracking-tight text-white mb-2">
            100% Profit Untukmu
          </h1>
          <h2 className="font-bold text-2xl md:text-4xl leading-[1.1] tracking-tight text-white mb-2">
            Sampai Balik Modal,
          </h2>
          <h2 className="font-bold text-2xl md:text-4xl leading-[1.1] tracking-tight text-[#FE7108] mb-6">
            Lanjut 50:50 Selamanya
          </h2>

          <p className="text-white/75 text-lg leading-relaxed mb-6 max-w-xl">
            Kami mau kamu balik modal dulu — baru kami ikut untung. Sistem 2 fase ini yang bikin mitra
            kami BEP 2x lebih cepat dari franchise biasa.
          </p>

          <p className="font-bold text-[#FFC500] text-sm tracking-wide mb-8">
            🚀 BALIK MODAL DULU, BARU BAGI HASIL
          </p>

          <div className="flex flex-col sm:flex-row gap-4 mb-12">
            <a
              href="#paket"
              className="inline-flex items-center justify-center px-8 py-3.5 rounded-full
                         min-h-[48px] w-full sm:w-auto
                         bg-[#FE7108] text-white font-semibold text-sm
                         hover:bg-[#E86300] transition-colors duration-200"
            >
              Lihat Paket Investasi
            </a>
            <a
              href="#roi"
              className="inline-flex items-center justify-center px-8 py-3.5 rounded-full
                         min-h-[48px] w-full sm:w-auto
                         border-2 border-white text-white font-semibold text-sm
                         hover:bg-white hover:text-[#6E1A10] transition-colors duration-200"
            >
              Hitung ROI Saya →
            </a>
          </div>

          {/* Trust badges row */}
          <div className="flex flex-wrap items-center gap-6 mb-10">
            <div className="flex items-center gap-2 text-white/80 text-sm">
              <span>✅</span>
              <span>Halal MUI</span>
            </div>
            <div className="text-white/80 text-sm">
              <span className="font-bold text-white">28K+</span> Followers IG
            </div>
            <div className="text-white/80 text-sm">
              <span className="font-bold text-white">0%</span> Royalty Fee
            </div>
          </div>

          {/* Stats grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[
              { value: "20+", label: "Outlet Aktif", sub: "Jabodetabek" },
              { value: "100%", label: "Profit Mitra", sub: "Sampai BEP" },
              { value: "~6", label: "Bulan", sub: "Balik Modal" },
              { value: "456%", label: "ROI dalam", sub: "5 Tahun" },
            ].map((s) => (
              <div key={s.label} className="bg-white/10 rounded-2xl p-4 text-center">
                <p className="font-bold text-2xl text-white">{s.value}</p>
                <p className="text-white/70 text-xs mt-0.5">{s.label}</p>
                <p className="text-white/50 text-xs">{s.sub}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
