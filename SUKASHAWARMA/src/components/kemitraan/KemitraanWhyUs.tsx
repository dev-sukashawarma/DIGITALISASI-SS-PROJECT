export default function KemitraanWhyUs() {
  const reasons = [
    {
      icon: "🤝",
      title: "100% Profit Dulu, Baru Bagi Hasil",
      description:
        "Sampai kamu balik modal, 100% profit adalah hakmu. Setelah BEP tercapai, baru kami bagi hasil 50:50. Kami baru untung kalau kamu sudah untung.",
    },
    {
      icon: "⚙️",
      title: "Terima Beres, Tanpa Drama",
      description:
        "Tim kami urus operasional harian, rekrut staf, hingga marketing digital. Kamu cukup pantau laporan dari rumah.",
    },
    {
      icon: "📍",
      title: "Brand Sudah Terbukti",
      description:
        "28.000+ followers Instagram, 20+ outlet aktif Jabodetabek. Bukan bisnis baru — sudah ada fanbase loyal.",
    },
    {
      icon: "🌯",
      title: "Produk Viral & Repeat Order",
      description:
        "Shawarma mulai 20 ribuan — harga entry-level dengan rasa premium khas Timur Tengah. Tinggi repeat buyer.",
    },
  ];

  return (
    <section className="py-14 lg:py-28 bg-[#FAF7F2]">
      <div className="max-w-7xl mx-auto px-6 lg:px-8">
        <div className="mb-12">
          <p className="text-xs font-semibold tracking-[0.22em] uppercase text-[#FE7108] mb-3">
            Kenapa SukaShawarma?
          </p>
          <h2 className="font-bold text-3xl md:text-5xl tracking-tight text-[#111111] mb-4"
              style={{ fontFamily: "var(--font-heading)" }}>
            Bukan Sekadar Franchise Biasa
          </h2>
          <p className="text-[#111111]/60 text-lg max-w-xl">
            Kami bangun sistem yang bikin kamu untung — bukan cuma nama brand yang bisa kamu pakai.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {reasons.map((item) => (
            <div
              key={item.title}
              className="bg-white rounded-2xl p-6 border border-black/[0.05]
                         shadow-[0_2px_12px_rgba(0,0,0,0.06)]"
            >
              <div className="text-3xl mb-4">{item.icon}</div>
              <h3 className="font-bold text-[#111111] text-base mb-2 leading-snug"
                  style={{ fontFamily: "var(--font-heading)" }}>
                {item.title}
              </h3>
              <p className="text-sm text-[#111111]/60 leading-relaxed">
                {item.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
