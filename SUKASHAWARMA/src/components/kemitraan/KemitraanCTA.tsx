export default function KemitraanCTA() {
  return (
    <section className="py-14 lg:py-28 bg-[#6E1A10] relative overflow-hidden">
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div className="w-[600px] h-[600px] rounded-full bg-[#FE7108]/10 blur-[120px]" />
      </div>

      <div className="max-w-4xl mx-auto px-6 lg:px-8 text-center relative">
        <h2 className="font-bold text-3xl md:text-5xl lg:text-6xl leading-[1.08]
                       tracking-tight text-white mb-4"
            style={{ fontFamily: "var(--font-heading)" }}>
          Siap Jadi Bagian dari{" "}
          <span className="text-[#FE7108]">SukaShawarma?</span>
        </h2>
        <p className="text-white/70 text-lg leading-relaxed mb-8 max-w-xl mx-auto">
          Hubungi tim kami untuk konsultasi gratis — tanpa paksaan, tanpa DP dulu.
          Slot mitra sangat terbatas.
        </p>

        <div className="flex flex-wrap justify-center gap-3 mb-8 text-xs sm:text-sm text-white/80">
          <span>🏪 20+ Outlet Aktif</span>
          <span>⚡ 100% Profit Sampai BEP</span>
          <span>📈 ROI hingga 477%</span>
          <span>⏱️ BEP ~6 Bulan</span>
        </div>

        <a
          href="https://wa.me/6282299325621"
          target="_blank"
          rel="noopener noreferrer"
          className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-10 py-4
                     rounded-full bg-[#25D366] text-white font-semibold text-base
                     min-h-[52px]
                     hover:bg-[#1ebe5d] transition-colors duration-200
                     shadow-[0_8px_32px_rgba(37,211,102,0.35)] mb-5"
        >
          <svg viewBox="0 0 24 24" className="w-5 h-5 fill-white shrink-0" aria-hidden="true">
            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/>
            <path d="M12 0C5.373 0 0 5.373 0 12c0 2.123.553 4.116 1.522 5.847L0 24l6.335-1.502A11.95 11.95 0 0 0 12 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.818a9.792 9.792 0 0 1-5.002-1.373l-.359-.213-3.72.882.939-3.618-.234-.372A9.792 9.792 0 0 1 2.182 12C2.182 6.57 6.57 2.182 12 2.182c5.43 0 9.818 4.388 9.818 9.818 0 5.43-4.388 9.818-9.818 9.818z"/>
          </svg>
          Chat WhatsApp Sekarang
        </a>

        <p className="text-white/50 text-sm">
          📞 +62 822-9932-5621 &nbsp;|&nbsp; Email: kemitraan@sukashawarma.com
        </p>
      </div>
    </section>
  );
}
