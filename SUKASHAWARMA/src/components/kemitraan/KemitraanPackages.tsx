declare const gtag: (...args: unknown[]) => void;

export default function KemitraanPackages() {
  return (
    <section id="paket" className="py-14 lg:py-28 bg-[#FAF7F2]">
      <div className="max-w-7xl mx-auto px-6 lg:px-8">
        <div className="text-center mb-12">
          <p className="text-xs font-semibold tracking-[0.22em] uppercase text-[#FE7108] mb-3">
            Paket Kemitraan
          </p>
          <h2 className="font-bold text-3xl md:text-5xl tracking-tight text-[#111111] mb-4"
              style={{ fontFamily: "var(--font-heading)" }}>
            Investasi Transparan, Proyeksi Jelas
          </h2>
          <p className="text-[#111111]/60 max-w-xl mx-auto">
            Satu paket untuk semua mitra, sudah termasuk setup outlet, training staf,
            branding, dan dukungan operasional penuh.
          </p>
        </div>

        <div className="max-w-md mx-auto mb-4">
          <div className="bg-white rounded-2xl p-6 sm:p-8 border-2 border-[#6E1A10]
                          shadow-[0_4px_24px_rgba(110,26,16,0.12)]">
            <p className="text-xs font-semibold tracking-widest uppercase text-[#FE7108] mb-1">
              Paket Kemitraan
            </p>
            <p className="text-sm text-[#111111]/50 mb-4">Dengan Lokasi Maupun Tanpa Lokasi</p>
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
                <span className="font-semibold text-[#111111]">Rp 70 Jt</span>
              </li>
              <li className="flex justify-between">
                <span>Equipment + POS</span>
                <span className="font-semibold text-[#111111]">Rp 25 Jt</span>
              </li>
              <li className="flex justify-between">
                <span>Renovasi & Dekorasi</span>
                <span className="font-semibold text-[#111111]">Rp 30 Jt</span>
              </li>
            </ul>
          </div>
        </div>

        <div className="max-w-md mx-auto bg-white rounded-xl p-5 mb-8 text-sm text-[#111111]/70 leading-relaxed
                        border border-black/[0.06]">
          <p className="font-semibold text-[#111111] mb-1">Belum punya lokasi?</p>
          Tim SS bantu carikan dan survei lokasi. Estimasi sewa lokasi sekitar{" "}
          <span className="font-semibold text-[#111111]">Rp 30–40 Jt / tahun</span>, dibayar langsung
          ke pemilik tempat dan di luar investasi Rp 150 Jt.
        </div>

        <div className="max-w-4xl mx-auto bg-[#111111]/[0.04] rounded-xl p-5 mb-8 text-sm text-[#111111]/65 leading-relaxed">
          RSF (Revolving Stock Fund) Adalah Dana Stok Bahan Baku Yang Dikelola Sepenuhnya Oleh SS. Mitra
          Tidak Perlu Melakukan Pembelian Bahan Baku – Stok Dijaga Dan Direplenish Otomatis. Mitra Benar-Benar Tidak Perlu
          Terlibat Dalam Operasional Apapun.
        </div>

        <div className="flex justify-center max-w-md mx-auto mb-5">
          <a href="https://wa.me/6285283524708"
             target="_blank" rel="noopener noreferrer"
             onClick={() => { if(typeof gtag !== 'undefined') gtag('event', 'conversion', {'send_to': 'AW-11522229721/18NOCPO46eYcENmLnfYq','value': 1.0,'currency': 'IDR'}); }}
             className="flex-1 inline-flex items-center justify-center px-6 py-3.5 rounded-full
                        min-h-[48px]
                        bg-[#FE7108] text-white font-semibold text-sm
                        hover:bg-[#E86300] transition-colors duration-200 text-center">
            AMBIL PAKET — Rp 150 Jt
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
