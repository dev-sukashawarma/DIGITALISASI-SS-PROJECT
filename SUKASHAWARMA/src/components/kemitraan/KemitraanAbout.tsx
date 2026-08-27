export default function KemitraanAbout() {
  const stats = [
    { value: "Mei 2024", label: "Berdiri di Bogor" },
    { value: "20+",      label: "Outlet Aktif" },
    { value: "28K+",     label: "Followers IG" },
    { value: "Halal",    label: "Sertifikasi MUI" },
  ];

  return (
    <section className="py-14 lg:py-24 bg-white overflow-hidden">
      <div className="max-w-7xl mx-auto px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-center">

          {/* ── Left: text + stats ── */}
          <div>
            <p className="text-[11px] font-semibold tracking-[0.22em] uppercase text-[#FE7108] mb-3">
              Tentang Kami
            </p>
            <h2 className="font-bold text-3xl md:text-4xl tracking-tight text-[#111111] mb-4 leading-[1.08]">
              Sekilas Tentang{" "}
              <span className="text-[#6E1A10]">SUKA Shawarma</span>
            </h2>
            <p className="text-[#111111]/55 text-base leading-relaxed mb-10 max-w-md">
              Brand shawarma autentik khas Timur Tengah, lahir di Bogor dan kini tersebar di 20+ outlet Jabodetabek.
            </p>
            <div className="grid grid-cols-2 gap-3">
              {stats.map((s) => (
                <div key={s.label} className="rounded-2xl border border-black/[0.06] p-5 bg-[#FAF7F2]">
                  <p className="font-bold text-2xl text-[#6E1A10] mb-1 leading-none">{s.value}</p>
                  <p className="text-[#111111]/50 text-sm">{s.label}</p>
                </div>
              ))}
            </div>
          </div>

          {/* ── Right: 4-photo mosaic ── */}
          {/*
            Layout (like reference):
            [ foto besar kiri ] [ foto kanan atas   ]
            [ foto besar kiri ] [ foto kanan tengah ]
            [ foto besar kiri ] [ foto kanan bawah  ]
            → pakai CSS grid dengan rows + cols explicit via inline style
          */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gridTemplateRows: "1fr 1fr 1fr",
              gap: "10px",
              height: "480px",
            }}
          >
            {/* Foto besar kiri — full height */}
            <div style={{ gridRow: "1 / 4", gridColumn: "1" }} className="rounded-2xl overflow-hidden">
              <img
                src="/founderstory/Artboard 1.jpg"
                alt="Outlet Suka Shawarma ramai"
                className="w-full h-full object-cover object-center"
                loading="lazy"
              />
            </div>

            {/* Kanan atas */}
            <div style={{ gridRow: "1", gridColumn: "2" }} className="rounded-2xl overflow-hidden">
              <img
                src="/kemitraan/FOTO OUTLET SS/JAGAKARSA/JAGAKARSA (1).JPG"
                alt="Outlet Jagakarsa"
                className="w-full h-full object-cover object-center"
                loading="lazy"
              />
            </div>

            {/* Kanan tengah */}
            <div style={{ gridRow: "2", gridColumn: "2" }} className="rounded-2xl overflow-hidden">
              <img
                src="/kemitraan/FOTO OUTLET SS/SAWANGAN/SAWANGAN (2).JPG"
                alt="Outlet Sawangan"
                className="w-full h-full object-cover object-center"
                loading="lazy"
              />
            </div>

            {/* Kanan bawah */}
            <div style={{ gridRow: "3", gridColumn: "2" }} className="rounded-2xl overflow-hidden">
              <img
                src="/kemitraan/FOTO OUTLET SS/SUKMAJAYA/SUKMAJAYA (2).JPG"
                alt="Outlet Sukmajaya"
                className="w-full h-full object-cover object-center"
                loading="lazy"
              />
            </div>
          </div>

        </div>
      </div>
    </section>
  );
}
