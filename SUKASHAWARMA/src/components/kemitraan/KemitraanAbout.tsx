export default function KemitraanAbout() {
  return (
    <section className="py-14 lg:py-28 bg-white">
      <div className="max-w-7xl mx-auto px-6 lg:px-8">
        <p className="text-xs font-semibold tracking-[0.22em] uppercase text-[#FE7108] mb-3">
          Tentang Kami
        </p>
        <h2 className="font-bold text-3xl md:text-5xl tracking-tight text-[#111111] mb-3 max-w-xl"
            style={{ fontFamily: "var(--font-heading)" }}>
          Sekilas Tentang{" "}
          <span className="text-[#6E1A10]">SUKA Shawarma</span>
        </h2>

        <div className="mt-8 max-w-3xl space-y-5 text-[#111111]/70 leading-relaxed text-base">
          <p>
            SUKA Shawarma adalah brand kuliner modern yang menyajikan shawarma autentik dengan cita rasa khas Timur
            Tengah, disesuaikan untuk selera lokal Indonesia.
          </p>
          <p>
            Didirikan pada Mei 2024 di Kota Bogor, SUKA Shawarma lahir dari satu semangat:
          </p>
          <blockquote className="border-l-4 border-[#FE7108] pl-4 sm:pl-5 italic text-[#111111]/80 font-medium">
            "Menghadirkan pengalaman kuliner Timur Tengah ke jalanan Indonesia dengan harga yang terjangkau, namun tetap
            menjaga kualitas yang tinggi."
          </blockquote>
          <p>
            Dalam waktu kurang dari dua tahun, SUKA Shawarma telah berkembang pesat menjadi gerakan rasa
            yang menawarkan pilihan baru yang kuat di tengah persaingan kuliner cepat saji yang semakin ketat.
          </p>
        </div>
      </div>
    </section>
  );
}
