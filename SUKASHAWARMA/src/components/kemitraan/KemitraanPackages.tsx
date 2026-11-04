declare const gtag: (...args: unknown[]) => void;

const BREAKDOWN = [
  { label: "License Fee", value: 25, bar: "bg-[#6E1A10]" },
  { label: "RSF – Stok Bahan Baku", value: 70, bar: "bg-[#FE7108]" },
  { label: "Equipment + POS", value: 25, bar: "bg-[#FFC500]" },
  { label: "Renovasi & Dekorasi", value: 30, bar: "bg-[#111111]/25" },
];
const TOTAL = BREAKDOWN.reduce((sum, item) => sum + item.value, 0);

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

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto mb-8 items-stretch">
          <div className="bg-white rounded-2xl p-6 sm:p-8 border-2 border-[#6E1A10] flex flex-col
                          shadow-[0_4px_24px_rgba(110,26,16,0.12)]">
            <p className="text-xs font-semibold tracking-widest uppercase text-[#FE7108] mb-1">
              Paket Kemitraan
            </p>
            <p className="text-sm text-[#111111]/50 mb-4">Dengan Lokasi Maupun Tanpa Lokasi</p>
            <p className="font-bold text-3xl sm:text-4xl text-[#111111] mb-6"
               style={{ fontFamily: "var(--font-heading)" }}>
              Rp 150.000.000
            </p>

            <div className="flex h-2.5 w-full overflow-hidden rounded-full mb-6" aria-hidden="true">
              {BREAKDOWN.map((item) => (
                <div key={item.label} className={item.bar} style={{ width: `${(item.value / TOTAL) * 100}%` }} />
              ))}
            </div>

            <ul className="flex-1 flex flex-col justify-between gap-3 text-sm text-[#111111]/70">
              {BREAKDOWN.map((item) => (
                <li key={item.label} className="flex items-center justify-between gap-3">
                  <span className="flex items-center gap-2.5">
                    <span className={`inline-block w-2.5 h-2.5 rounded-full shrink-0 ${item.bar}`} aria-hidden="true" />
                    {item.label}
                  </span>
                  <span className="font-semibold text-[#111111]">Rp {item.value} Jt</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="flex flex-col gap-4">
            <div className="bg-white rounded-2xl p-6 border border-black/[0.06] text-sm text-[#111111]/70 leading-relaxed">
              <p className="font-semibold text-[#111111] mb-1.5">Belum punya lokasi?</p>
              Tim SS bantu carikan dan survei lokasi. Estimasi sewa lokasi sekitar{" "}
              <span className="font-semibold text-[#111111]">Rp 30–40 Jt / tahun</span>, dibayar langsung
              ke pemilik tempat dan di luar investasi Rp 150 Jt.
            </div>

            <div className="bg-white rounded-2xl p-6 border border-black/[0.06] text-sm text-[#111111]/70 leading-relaxed flex-1">
              <p className="font-semibold text-[#111111] mb-1.5">Apa itu RSF?</p>
              RSF (Revolving Stock Fund) adalah dana stok bahan baku yang dikelola sepenuhnya oleh SS.
              Mitra tidak perlu melakukan pembelian bahan baku — stok dijaga dan direplenish otomatis.
              Mitra benar-benar tidak perlu terlibat dalam operasional apapun.
            </div>

            <a href="https://wa.me/6285283524708"
               target="_blank" rel="noopener noreferrer"
               onClick={() => { if(typeof gtag !== 'undefined') gtag('event', 'conversion', {'send_to': 'AW-11522229721/18NOCPO46eYcENmLnfYq','value': 1.0,'currency': 'IDR'}); }}
               className="inline-flex items-center justify-center px-6 py-3.5 rounded-full
                          min-h-[48px]
                          bg-[#FE7108] text-white font-semibold text-sm
                          hover:bg-[#E86300] transition-colors duration-200 text-center">
              AMBIL PAKET — Rp 150 Jt
            </a>
          </div>
        </div>

        <p className="text-center text-xs text-[#111111]/40 max-w-xl mx-auto">
          *Proyeksi berdasarkan rata-rata performa outlet aktif. Hasil aktual dapat bervariasi
          tergantung lokasi dan kondisi pasar.
        </p>
      </div>
    </section>
  );
}
