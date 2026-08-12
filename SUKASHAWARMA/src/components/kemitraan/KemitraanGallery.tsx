// Gallery menggunakan foto outlet asli dari /public/kemitraan/FOTO OUTLET SS/
// Dipilih dari berbagai outlet berbeda untuk menunjukkan skala jaringan

const galleryPhotos = [
  {
    src: "/kemitraan/FOTO OUTLET SS/CIBINONG/CIBINONG (2).JPG",
    alt: "Outlet Suka Shawarma Cibinong — ramai pengunjung",
    outlet: "Cibinong",
  },
  {
    src: "/kemitraan/FOTO OUTLET SS/CIMANGGU/CIMANGGU (1).JPG",
    alt: "Outlet Suka Shawarma Cimanggu",
    outlet: "Cimanggu",
  },
  {
    src: "/kemitraan/FOTO OUTLET SS/TEBET/TEBET (2).JPG",
    alt: "Outlet Suka Shawarma Tebet",
    outlet: "Tebet",
  },
  {
    src: "/kemitraan/FOTO OUTLET SS/BATU AMPAR/BATU AMPAR (2).JPG",
    alt: "Outlet Suka Shawarma Batu Ampar",
    outlet: "Batu Ampar",
  },
  {
    src: "/kemitraan/FOTO OUTLET SS/TEBET/TEBET (1).JPG",
    alt: "Outlet Suka Shawarma Tebet — suasana ramai",
    outlet: "Tebet",
  },
  {
    src: "/kemitraan/FOTO OUTLET SS/PEKAYON/PEKAYON (1).JPG",
    alt: "Outlet Suka Shawarma Pekayon",
    outlet: "Pekayon",
  },
  {
    src: "/kemitraan/FOTO OUTLET SS/SUKMAJAYA/SUKMAJAYA (2).JPG",
    alt: "Outlet Suka Shawarma Sukmajaya",
    outlet: "Sukmajaya",
  },
  {
    src: "/kemitraan/FOTO OUTLET SS/JAGAKARSA/JAGAKARSA (1).JPG",
    alt: "Outlet Suka Shawarma Jagakarsa",
    outlet: "Jagakarsa",
  },
  {
    src: "/kemitraan/FOTO OUTLET SS/BEJI/BEJI (1).JPG",
    alt: "Outlet Suka Shawarma Beji",
    outlet: "Beji",
  },
  {
    src: "/kemitraan/FOTO OUTLET SS/CITAYAM/CITAYAM (2).JPG",
    alt: "Outlet Suka Shawarma Citayam",
    outlet: "Citayam",
  },
  {
    src: "/kemitraan/FOTO OUTLET SS/JATIASIH/JATIASIH (3).JPG",
    alt: "Outlet Suka Shawarma Jatiasih",
    outlet: "Jatiasih",
  },
  {
    src: "/kemitraan/FOTO OUTLET SS/KALISARI/KALISARI (1).JPG",
    alt: "Outlet Suka Shawarma Kalisari",
    outlet: "Kalisari",
  },
  {
    src: "/kemitraan/FOTO OUTLET SS/SAWANGAN/SAWANGAN (2).JPG",
    alt: "Outlet Suka Shawarma Sawangan",
    outlet: "Sawangan",
  },
  {
    src: "/kemitraan/FOTO OUTLET SS/CIRENDEU/CIRENDEU (1).JPG",
    alt: "Outlet Suka Shawarma Cirendeu",
    outlet: "Cirendeu",
  },
  {
    src: "/kemitraan/FOTO OUTLET SS/EMPANG/EMPANG (1).jpg",
    alt: "Outlet Suka Shawarma Empang — outlet pertama",
    outlet: "Empang",
  },
];

export default function KemitraanGallery() {
  return (
    <section className="py-14 lg:py-28 bg-white">
      <div className="max-w-7xl mx-auto px-6 lg:px-8">
        <div className="mb-10 lg:mb-12">
          <p className="text-xs font-semibold tracking-[0.22em] uppercase text-[#FE7108] mb-3">
            Outlet Kami
          </p>
          <h2
            className="font-bold text-3xl md:text-5xl tracking-tight text-[#111111] mb-3"
            style={{ fontFamily: "var(--font-heading)" }}
          >
            Nyata, Ramai & Proven 🔥
          </h2>
          <p className="text-[#111111]/60 text-base lg:text-lg">
            Dari Bogor hingga Depok — setiap outlet terbukti selalu penuh antrian
          </p>
        </div>

        {/* Grid foto — 2 kolom mobile, 3 tablet, 5 desktop */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-6">
          {galleryPhotos.map((photo, i) => (
            <div
              key={i}
              className="group relative aspect-square rounded-xl overflow-hidden bg-[#FAF7F2]"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={photo.src}
                alt={photo.alt}
                className="w-full h-full object-cover
                           group-hover:scale-[1.04]
                           transition-transform duration-500 ease-out"
                loading={i < 6 ? "eager" : "lazy"}
              />
              {/* Outlet name on hover */}
              <div className="absolute bottom-0 inset-x-0 px-2 py-1.5
                              bg-gradient-to-t from-black/60 to-transparent
                              opacity-0 group-hover:opacity-100
                              transition-opacity duration-300">
                <p className="text-white text-[10px] font-semibold truncate">
                  {photo.outlet}
                </p>
              </div>
            </div>
          ))}
        </div>

        <p className="text-sm text-[#111111]/60 leading-relaxed">
          <span className="mr-1">📍</span>
          Dan masih banyak lagi — 20+ outlet aktif se-Jabodetabek (Empang, Cimanggu, Paledang, Pajajaran, Cibinong, Ciseeng, Cibubur, Sukmajaya, Beji, Sawangan, Citayam, Dramaga, Pekayon, Tebet, dll)
          <span className="ml-2 text-[#FE7108] font-semibold">🔥 Terus Bertambah</span>
        </p>
      </div>
    </section>
  );
}
