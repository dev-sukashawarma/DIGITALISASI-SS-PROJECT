"use client";

import { motion } from "motion/react";

const ROW_H = 164;
const GAP = 6;

function Photo({
  src,
  alt,
  rowSpan = 1,
  delay = 0,
}: {
  src: string;
  alt: string;
  rowSpan?: number;
  delay?: number;
}) {
  const height = ROW_H * rowSpan + GAP * (rowSpan - 1);
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-40px" }}
      transition={{ duration: 0.6, delay, ease: [0.16, 1, 0.3, 1] }}
      style={{ height }}
      className="group relative overflow-hidden bg-[#d6cfc6] shrink-0"
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={alt}
        className="absolute inset-0 w-full h-full object-cover
                   transition-transform duration-500 ease-out group-hover:scale-[1.04]"
      />
      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors duration-500" />
    </motion.div>
  );
}

export default function FounderStory() {
  const totalH = ROW_H * 3 + GAP * 2;

  return (
    <section
      id="about"
      className="relative bg-[#FAF7F2] pt-20 pb-16 lg:pt-24 lg:pb-0 overflow-hidden"
      style={{
        borderTopLeftRadius: "clamp(32px, 6vw, 112px)",
        borderTopRightRadius: "clamp(32px, 6vw, 112px)",
        marginTop: "-48px",
        zIndex: 10,
        position: "relative",
      }}
    >
      {/* Ambient glow */}
      <div className="absolute top-0 left-0 w-[90vw] max-w-[500px] h-[500px] rounded-full
                      bg-[#FE7108]/[0.04] blur-[120px] pointer-events-none" />

      <div className="max-w-7xl mx-auto px-5 md:px-8 lg:px-10 relative">

        {/* ── MOBILE LAYOUT ── */}
        <div className="lg:hidden">
          {/* Teks dulu di mobile */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
            className="mb-8"
          >
            <p className="text-xs font-semibold tracking-[0.2em] uppercase text-[#FE7108] mb-3">
              FOUNDER &amp; OUR BEGINNING
            </p>
            <h2 className="font-heading text-[1.75rem] font-bold leading-[1.15] tracking-tight text-[#111111] mb-4"
              style={{ fontFamily: "var(--font-heading)" }}
            >
              <span style={{ textDecoration: "underline", textDecorationColor: "#FE7108", textUnderlineOffset: "4px" }}>Akbar Alatas</span>{" "}
              memulai perjalanan Suka Shawarma dari satu outlet sederhana
            </h2>
            <div className="space-y-3 text-[#111111]/70 leading-relaxed text-sm">
              <p>
                Pada <strong className="text-[#111111]">12 Mei 2024</strong>,{" "}
                <strong className="text-[#111111]">Akbar Alatas</strong> mendirikan Suka Shawarma
                dengan visi menghadirkan shawarma berkualitas yang autentik, modern, dan
                terjangkau untuk semua kalangan.
              </p>
              <p>
                Berbekal komitmen terhadap kualitas bahan baku dan cita rasa yang konsisten,
                Suka Shawarma terus berkembang hingga puluhan outlet di Jabodetabek.
              </p>
            </div>
          </motion.div>

          {/* Foto founder — di mobile: satu foto besar + dua foto kecil di kanan */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.7, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
            className="grid grid-cols-[1.1fr_1fr] gap-2 rounded-2xl overflow-hidden
                       shadow-[0_12px_32px_rgba(0,0,0,0.10)]"
          >
            {/* Foto founder besar di kiri */}
            <div className="relative aspect-[3/4] overflow-hidden bg-[#d6cfc6]">
              <img
                src="/founderstory/Artboard 4.jpg"
                alt="Founder Akbar Alatas"
                className="absolute inset-0 w-full h-full object-cover"
              />
            </div>
            {/* 2 foto kecil di kanan */}
            <div className="flex flex-col gap-2">
              <div className="relative flex-1 overflow-hidden bg-[#d6cfc6]">
                <img
                  src="/founderstory/Artboard 1.jpg"
                  alt="Outlet"
                  className="absolute inset-0 w-full h-full object-cover"
                />
              </div>
              <div className="relative flex-1 overflow-hidden bg-[#d6cfc6]">
                <img
                  src="/founderstory/Artboard 2.jpg"
                  alt="Suasana"
                  className="absolute inset-0 w-full h-full object-cover"
                />
              </div>
            </div>
          </motion.div>
        </div>

        {/* ── DESKTOP LAYOUT (lg+) ── */}
        <div className="hidden lg:grid grid-cols-2 gap-20 items-center">

          {/* Kiri — photo grid */}
          <motion.div
            initial={{ opacity: 0, x: -32 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
            className="relative"
          >
            <div
              style={{ height: totalH, gap: GAP }}
              className="grid grid-cols-3 rounded-2xl overflow-hidden
                         shadow-[0_16px_48px_rgba(0,0,0,0.12)]"
            >
              <div style={{ gap: GAP }} className="flex flex-col">
                <Photo src="/founderstory/Artboard 1.jpg" alt="Outlet" rowSpan={1} delay={0} />
                <Photo src="/founderstory/Artboard 2.jpg" alt="Suasana" rowSpan={1} delay={0.08} />
                <Photo src="/founderstory/Artboard 3.jpg" alt="Detail" rowSpan={1} delay={0.16} />
              </div>
              <div style={{ gap: GAP }} className="flex flex-col">
                <Photo src="/founderstory/Artboard 4.jpg" alt="Founder" rowSpan={2} delay={0.04} />
                <Photo src="/founderstory/Artboard 5.jpg" alt="Proses" rowSpan={1} delay={0.12} />
              </div>
              <div style={{ gap: GAP }} className="flex flex-col">
                <Photo src="/founderstory/Artboard 6.jpg" alt="Opening" rowSpan={1} delay={0.08} />
                <Photo src="/founderstory/Artboard 7.jpg" alt="Bahan segar" rowSpan={2} delay={0.16} />
              </div>
            </div>
          </motion.div>

          {/* Kanan — teks */}
          <motion.div
            initial={{ opacity: 0, x: 32 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8, delay: 0.15, ease: [0.16, 1, 0.3, 1] }}
            className="flex flex-col justify-center pt-12"
          >
            <p className="text-xs font-semibold tracking-[0.2em] uppercase text-[#FE7108] mb-4">
              FOUNDER &amp; OUR BEGINNING
            </p>
            <h2
              className="font-heading text-4xl md:text-5xl font-bold
                         leading-[1.1] tracking-tight text-[#111111] mb-6"
              style={{ fontFamily: "var(--font-heading)" }}
            >
              <span style={{ textDecoration: "underline", textDecorationColor: "#FE7108", textUnderlineOffset: "4px" }}>Akbar Alatas</span>{" "}
              memulai perjalanan Suka Shawarma dari satu outlet sederhana
            </h2>
            <div className="space-y-4 text-[#111111]/70 leading-relaxed text-base">
              <p>
                Pada <strong className="text-[#111111]">12 Mei 2024</strong>,{" "}
                <strong className="text-[#111111]">Akbar Alatas</strong>{" "}
                mendirikan Suka Shawarma dengan visi menghadirkan shawarma berkualitas
                yang autentik, modern, dan terjangkau untuk semua kalangan.
              </p>
              <p>
                Saat ini kami telah mengembangkan lebih dari <strong className="text-[#111111]">20 outlet</strong> dan membuka program kemitraan dengan keuntungan yang menarik bagi para mitra.
              </p>
              <p>
                Berbekal komitmen terhadap kualitas bahan baku, cita rasa yang konsisten,
                serta pelayanan yang ramah, Suka Shawarma terus berkembang hingga memiliki
                puluhan outlet di seluruh Jabodetabek, tanpa meninggalkan nilai-nilai
                yang menjadi fondasi sejak hari pertama.
              </p>
            </div>
          </motion.div>
        </div>

      </div>
    </section>
  );
}
