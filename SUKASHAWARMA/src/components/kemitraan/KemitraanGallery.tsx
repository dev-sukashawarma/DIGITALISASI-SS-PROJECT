const galleryPhotos = [
  { src: "/kemitraan/FOTO OUTLET SS/CIBINONG/CIBINONG (2).JPG",   alt: "Outlet Suka Shawarma Cibinong",  outlet: "Cibinong"  },
  { src: "/kemitraan/FOTO OUTLET SS/CIMANGGU/CIMANGGU (1).JPG",   alt: "Outlet Suka Shawarma Cimanggu",  outlet: "Cimanggu"  },
  { src: "/kemitraan/FOTO OUTLET SS/TEBET/TEBET (2).JPG",         alt: "Outlet Suka Shawarma Tebet",     outlet: "Tebet"     },
  { src: "/kemitraan/FOTO OUTLET SS/BATU AMPAR/BATU AMPAR (2).JPG", alt: "Outlet Suka Shawarma Batu Ampar", outlet: "Batu Ampar" },
  { src: "/kemitraan/FOTO OUTLET SS/TEBET/TEBET (1).JPG",         alt: "Outlet Suka Shawarma Tebet",     outlet: "Tebet"     },
  { src: "/kemitraan/FOTO OUTLET SS/PEKAYON/PEKAYON (1).JPG",     alt: "Outlet Suka Shawarma Pekayon",   outlet: "Pekayon"   },
  { src: "/kemitraan/FOTO OUTLET SS/SUKMAJAYA/SUKMAJAYA (2).JPG", alt: "Outlet Suka Shawarma Sukmajaya", outlet: "Sukmajaya" },
  { src: "/kemitraan/FOTO OUTLET SS/JAGAKARSA/JAGAKARSA (1).JPG", alt: "Outlet Suka Shawarma Jagakarsa", outlet: "Jagakarsa" },
  { src: "/kemitraan/FOTO OUTLET SS/BEJI/BEJI (1).JPG",           alt: "Outlet Suka Shawarma Beji",      outlet: "Beji"      },
  { src: "/kemitraan/FOTO OUTLET SS/CITAYAM/CITAYAM (2).JPG",     alt: "Outlet Suka Shawarma Citayam",   outlet: "Citayam"   },
  { src: "/kemitraan/FOTO OUTLET SS/JATIASIH/JATIASIH (3).JPG",   alt: "Outlet Suka Shawarma Jatiasih",  outlet: "Jatiasih"  },
  { src: "/kemitraan/FOTO OUTLET SS/KALISARI/KALISARI (1).JPG",   alt: "Outlet Suka Shawarma Kalisari",  outlet: "Kalisari"  },
  { src: "/kemitraan/FOTO OUTLET SS/SAWANGAN/SAWANGAN (2).JPG",   alt: "Outlet Suka Shawarma Sawangan",  outlet: "Sawangan"  },
  { src: "/kemitraan/FOTO OUTLET SS/CIRENDEU/CIRENDEU (1).JPG",   alt: "Outlet Suka Shawarma Cirendeu",  outlet: "Cirendeu"  },
  { src: "/kemitraan/FOTO OUTLET SS/EMPANG/EMPANG (1).jpg",       alt: "Outlet Suka Shawarma Empang",    outlet: "Empang"    },
];

const IconMapPin = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
    <circle cx="12" cy="10" r="3"/>
  </svg>
);

const IconTrendingUp = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/>
    <polyline points="17 6 23 6 23 12"/>
  </svg>
);

export default function KemitraanGallery() {
  return (
    <section className="py-14 lg:py-28 bg-white">
      <div className="max-w-7xl mx-auto px-6 lg:px-8">

        <div className="mb-10 lg:mb-12">
          <p className="text-[11px] font-semibold tracking-[0.22em] uppercase text-[#FE7108] mb-3">
            Outlet Kami
          </p>
          <h2 className="font-bold text-3xl md:text-5xl tracking-tight text-[#111111] mb-3 leading-[1.08]">
            Nyata, Ramai &amp; Proven
          </h2>
          <p className="text-[#111111]/55 text-base lg:text-lg leading-relaxed">
            Dari Bogor hingga Depok — setiap outlet terbukti selalu penuh antrian
          </p>
        </div>

        {/* Photo grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-6">
          {galleryPhotos.map((photo, i) => (
            <div key={i} className="group relative aspect-square rounded-xl overflow-hidden bg-[#FAF7F2]">
              <img
                src={photo.src}
                alt={photo.alt}
                className="w-full h-full object-cover group-hover:scale-[1.05] transition-transform duration-500 ease-out"
                loading={i < 6 ? "eager" : "lazy"}
              />
              <div className="absolute bottom-0 inset-x-0 px-2.5 py-2 bg-gradient-to-t from-black/65 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                <p className="text-white text-[10px] font-semibold truncate">{photo.outlet}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-[#111111]/55">
          <span className="flex items-center gap-1.5 text-[#111111]/55">
            <IconMapPin />
            20+ outlet aktif se-Jabodetabek (Empang, Cimanggu, Paledang, Pajajaran, Cibinong, Cibubur, Sukmajaya, Beji, Sawangan, Citayam, Pekayon, Tebet, dll)
          </span>
          <span className="flex items-center gap-1 text-[#FE7108] font-semibold shrink-0">
            <IconTrendingUp />
            Terus Bertambah
          </span>
        </div>

      </div>
    </section>
  );
}
