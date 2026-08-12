export default function KemitraanProfit() {
  return (
    <section className="py-14 lg:py-28 bg-white">
      <div className="max-w-7xl mx-auto px-6 lg:px-8">
        <div className="text-center mb-12">
          <p className="text-xs font-semibold tracking-[0.22em] uppercase text-[#FE7108] mb-3">
            Skema Bagi Hasil
          </p>
          <h2 className="font-bold text-3xl md:text-5xl tracking-tight text-[#111111] mb-4"
              style={{ fontFamily: "var(--font-heading)" }}>
            2 Fase, 1 Tujuan:{" "}
            <span className="text-[#6E1A10]">Mitra Untung Dulu</span>
          </h2>
          <p className="text-[#111111]/60 max-w-xl mx-auto">
            Sistem kami dirancang agar modal kamu kembali secepat mungkin — sebelum kami ikut
            menikmati hasilnya.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto">
          {/* Fase 1 */}
          <div className="rounded-2xl p-6 sm:p-8 bg-[#FAF7F2] border border-black/[0.05]">
            <p className="text-xs font-semibold tracking-widest uppercase text-[#FE7108] mb-3">
              ⚡ Fase 1 – Sebelum BEP (Modal Kembali)
            </p>
            <h3 className="font-bold text-2xl text-[#111111] mb-4"
                style={{ fontFamily: "var(--font-heading)" }}>
              100% Net Profit Untuk Mitra
            </h3>
            <p className="text-[#111111]/65 text-sm leading-relaxed mb-5">
              Seluruh Keuntungan Bersih Outlet Menjadi Hak Mitra. Tidak ada potongan royalty fee sama sekali.
            </p>
            <p className="text-sm font-semibold text-emerald-600">
              ✅ Mitra Menerima 100% Net Profit
            </p>
          </div>

          {/* Fase 2 */}
          <div className="rounded-2xl p-6 sm:p-8 bg-[#6E1A10] border border-[#6E1A10]">
            <p className="text-xs font-semibold tracking-widest uppercase text-[#FFC500] mb-3">
              💰 Fase 2 – Setelah BEP (Passive Income)
            </p>
            <h3 className="font-bold text-2xl text-white mb-4"
                style={{ fontFamily: "var(--font-heading)" }}>
              50% Mitra : 50% SS
            </h3>
            <p className="text-white/70 text-sm leading-relaxed mb-5">
              Setelah Modal Kembali Sepenuhnya, Net Profit Dibagi Rata Antara Mitra Dan SS. Mitra Menikmati Passive Income Tanpa Keterlibatan Apapun Hingga Akhir Kontrak. Tidak ada royalty fee.
            </p>
            <p className="text-sm font-semibold text-[#FFC500]">
              💼 Passive Income Hingga Akhir Kontrak
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
