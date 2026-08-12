export default function KemitraanPackages() {
  return (
    <section id="paket" className="py-14 lg:py-28 bg-[#FAF7F2]">
      <div className="max-w-7xl mx-auto px-6 lg:px-8">
        <div className="text-center mb-12">
          <p className="text-xs font-semibold tracking-[0.22em] uppercase text-[#FE7108] mb-3">
            Pilih Paket Anda
          </p>
          <h2 className="font-bold text-3xl md:text-5xl tracking-tight text-[#111111] mb-4"
              style={{ fontFamily: "var(--font-heading)" }}>
            Investasi Transparan, Proyeksi Jelas
          </h2>
          <p className="text-[#111111]/60 max-w-xl mx-auto">
            Pilih paket sesuai kondisi lokasi — semua sudah termasuk setup outlet, training staf,
            branding, dan dukungan operasional penuh.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto mb-8">
          {/* Paket Standard */}
          <div className="bg-white rounded-2xl p-6 sm:p-8 border border-black/[0.06]
                          shadow-[0_4px_24px_rgba(0,0,0,0.08)]">
            <p className="text-xs font-semibold tracking-widest uppercase text-[#FE7108] mb-1">
              Paket Standard
            </p>
            <p className="text-sm text-[#111111]/50 mb-4">SS Sediakan Lokasi</p>
            <p className="font-bold text-2xl sm:text-3xl text-[#111111] mb-6"
               style={{ fontFamily: "var(--font-heading)" }}>
              Rp 150.000.000
            </p>
            <ul className="space-y-2.5 text-sm text-[#111111]/70">
              <li className="flex justify-between">
                <span>License Fee</span>
                <span className="font-semibold text-[#111111]">Rp 25 Jt</span>
              </li>
              <li className="flex justify-between">
                <span>RSF – Stok Bahan Baku</span>
                <span className="font-semibold text-[#111111]">Rp 50 Jt</span>
              </li>
              <li className="flex justify-between">
                <span>Equipment + POS</span>
                <span className="font-semibold text-[#111111]">Rp 25 Jt</span>
              </li>
              <li className="flex justify-between">
                <span>Renovasi & Dekorasi</span>
                <span className="font-semibold text-[#111111]">Rp 25 Jt</span>
              </li>
              <li className="flex justify-between">
                <span>Sewa Lokasi Tahun 1</span>
                <span className="font-semibold text-[#111111]">Rp 25 Jt (Included)</span>
              </li>
              <li className="flex justify-between border-t border-black/[0.06] pt-2.5 mt-2.5">
                <span>Sewa Bulanan (Tahun 2+)</span>
                <span className="font-semibold text-[#111111]">~Rp 2.500.000 / Bln</span>
              </li>
            </ul>
          </div>

          {/* Paket Own Location */}
          <div className="bg-white rounded-2xl p-6 sm:p-8 border-2 border-[#6E1A10]
                          shadow-[0_4px_24px_rgba(110,26,16,0.12)]">
            <p className="text-xs font-semibold tracking-widest uppercase text-[#FE7108] mb-1">
              Paket Own Location
            </p>
            <p className="text-sm text-[#111111]/50 mb-4">Mitra Punya Lokasi</p>
            <p className="font-bold text-2xl sm:text-3xl text-[#111111] mb-6"
               style={{ fontFamily: "var(--font-heading)" }}>
              Rp 125.000.000
            </p>
            <ul className="space-y-2.5 text-sm text-[#111111]/70">
              <li className="flex justify-between">
                <span>License Fee</span>
                <span className="font-semibold text-[#111111]">Rp 25 Jt</span>
              </li>
              <li className="flex justify-between">
                <span>RSF – Stok Bahan Baku</span>
                <span className="font-semibold text-[#111111]">Rp 50 Jt</span>
              </li>
              <li className="flex justify-between">
                <span>Equipment + POS</span>
                <span className="font-semibold text-[#111111]">Rp 25 Jt</span>
              </li>
              <li className="flex justify-between">
                <span>Renovasi & Dekorasi</span>
                <span className="font-semibold text-[#111111]">Rp 25 Jt</span>
              </li>
              <li className="flex justify-between">
                <span>Sewa Lokasi Tahun 1</span>
                <span className="font-semibold text-[#111111]">Tidak Berlaku</span>
              </li>
              <li className="flex justify-between border-t border-black/[0.06] pt-2.5 mt-2.5">
                <span>Sewa Bulanan</span>
                <span className="font-semibold text-emerald-600">Rp 0 – Gratis Selamanya</span>
              </li>
            </ul>
          </div>
        </div>

        <div className="max-w-4xl mx-auto bg-[#111111]/[0.04] rounded-xl p-5 mb-8 text-sm text-[#111111]/65 leading-relaxed">
          RSF (Revolving Stock Fund) Adalah Dana Stok Bahan Baku Yang Dikelola Sepenuhnya Oleh SS. Mitra
          Tidak Perlu Melakukan Pembelian Bahan Baku – Stok Dijaga Dan Direplenish Otomatis. Mitra Benar-Benar Tidak Perlu
          Terlibat Dalam Operasional Apapun.
        </div>

        <div className="flex flex-col sm:flex-row gap-4 justify-center max-w-4xl mx-auto mb-5">
          <a href="https://wa.me/6282299325621"
             target="_blank" rel="noopener noreferrer"
             className="flex-1 inline-flex items-center justify-center px-6 py-3.5 rounded-full
                        min-h-[48px]
                        bg-[#6E1A10] text-white font-semibold text-sm
                        hover:bg-[#5a1509] transition-colors duration-200 text-center">
            AMBIL PAKET STANDARD — Rp 150 Jt
          </a>
          <a href="https://wa.me/6282299325621"
             target="_blank" rel="noopener noreferrer"
             className="flex-1 inline-flex items-center justify-center px-6 py-3.5 rounded-full
                        min-h-[48px]
                        bg-[#FE7108] text-white font-semibold text-sm
                        hover:bg-[#E86300] transition-colors duration-200 text-center">
            AMBIL PAKET OWN LOCATION — Rp 125 Jt
          </a>
        </div>

        <p className="text-center text-xs text-[#111111]/40 max-w-xl mx-auto">
          *Proyeksi berdasarkan rata-rata performa outlet aktif. Hasil aktual dapat bervariasi
          tergantung lokasi dan kondisi pasar.
        </p>
      </div>
    </section>
  );
}
