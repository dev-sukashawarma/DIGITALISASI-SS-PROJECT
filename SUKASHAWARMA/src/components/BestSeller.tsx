import { ArrowRight } from "lucide-react";

// Best Seller items — source of truth in src/data/menu.ts
const bestSellers = [
  {
    id: "ori-ayam-besar",
    name: "ORIGINAL AYAM BESAR",
    description: "Shawarma ayam ukuran besar, lebih banyak lebih puas",
    image: "/menus/SS_ORI_AYAM.png",
  },
  {
    id: "ori-sapi-besar",
    name: "ORIGINAL SAPI BESAR",
    description: "Shawarma daging sapi pilihan ukuran besar",
    image: "/menus/ORI SAPI.png",
  },
  {
    id: "suka-chicken",
    name: "SUKA CHICKEN",
    description: "Shawarma ayam spesial dengan saus SUKA signature",
    image: "/menus/SS_SUKA_CHICKEN.png",
  },
];

export default function BestSeller() {
  return (
    <section id="menu" className="relative py-20 lg:py-24 bg-white overflow-hidden">
      {/* Layer 1 (z-[10]): Ambient background glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[300px] rounded-full bg-[#FE7108]/5 blur-3xl pointer-events-none z-[10]" />

      <div className="max-w-6xl mx-auto px-6 lg:px-8 relative z-[20]">

        {/* Section header (Layer 4) */}
        <div className="text-center mb-14 relative z-[40]">
          <p className="text-xs font-semibold tracking-[0.2em] uppercase text-[#FE7108] mb-3">
            Menu Pilihan
          </p>
          <h2 className="text-4xl md:text-5xl font-bold tracking-tight text-[#111111] mb-4">
            Best Seller Kami
          </h2>
        </div>

        {/* Product grid — 3 kolom (Layer 5) */}
        <div
          className="grid grid-cols-1 md:grid-cols-3 gap-8 lg:gap-10 relative z-[50] reveal-on-scroll"
        >
          {bestSellers.map((item, index) => (
            <div
              key={item.id}
              className={`group flex flex-col transform-gpu reveal-on-scroll ${index === 1 ? 'delay-100' : index === 2 ? 'delay-200' : ''}`}
            >
              {/* Foto (Layer 2) & Badge (Layer 3) */}
              <div className="relative rounded-2xl overflow-hidden aspect-[4/3] mb-5 shadow-layered-md group-hover:shadow-layered-lg transition-all duration-300 transform-gpu z-[20]">
                <img
                  src={item.image}
                  alt={item.name}
                  className="w-full h-full object-cover
                             group-hover:scale-[1.04]
                             transition-transform duration-500 ease-out transform-gpu"
                />
                {/* Floating badge on Layer 3 */}
                <div className="absolute top-3 left-3 z-[30] bg-[#FFC500] text-[#111111]
                                text-[10px] font-bold tracking-wider uppercase
                                px-2.5 py-1 rounded-full shadow-sm backdrop-blur-sm">
                  Best Seller
                </div>
              </div>

              {/* Nama (Layer 4) */}
              <h3 className="font-bold text-[#111111] text-base tracking-wide uppercase mb-2 relative z-[40]">
                {item.name}
              </h3>

              {/* Deskripsi */}
              <p className="text-sm text-[#111111]/60 leading-relaxed mb-5">
                {item.description}
              </p>

              {/* CTA (Layer 6) */}
              <a
                href="/menu"
                className="inline-flex items-center gap-1 text-sm font-semibold
                           text-[#FE7108] hover:gap-2 transition-all duration-200 group/link mt-auto relative z-[60]"
              >
                Lihat Menu Lengkap
                <ArrowRight className="w-3.5 h-3.5 group-hover/link:translate-x-0.5 transition-transform duration-200 transform-gpu" />
              </a>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
