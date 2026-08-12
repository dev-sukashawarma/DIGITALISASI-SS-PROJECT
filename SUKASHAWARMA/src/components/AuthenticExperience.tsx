"use client";

import { motion } from "motion/react";
import { Flame, Wallet, MapPin } from "lucide-react";

const features = [
  {
    icon: Flame,
    title: "Cita Rasa Otentik",
    description:
      "Nikmati sensasi kebab khas Timur Tengah dengan rempah otentik dan bahan premium. Sudah dibuktikan ribuan orang.",
  },
  {
    icon: Wallet,
    title: "Harga Merakyat",
    description:
      "Mulai dari 20 ribuan, kalian udah bisa nikmati kelezatan Suka Shawarma. Kenyang tanpa kantong jebol.",
  },
  {
    icon: MapPin,
    title: "20+ Cabang",
    description:
      "Sudah tersebar di 20+ titik di Jabodetabek. Makin mudah cari Suka Shawarma di dekatmu.",
  },
];

export default function AuthenticExperience() {
  return (
    <section
      className="relative bg-[#6E1A10] pt-0 pb-28 overflow-visible"
      style={{
        borderTopLeftRadius: "clamp(48px, 8vw, 112px)",
        borderTopRightRadius: "clamp(48px, 8vw, 112px)",
        zIndex: 9,
      }}
    >
      {/* Ambient glow */}
      <div className="absolute top-1/3 left-1/4 w-[90vw] max-w-[600px] h-[600px] rounded-full
                      bg-[#FE7108]/10 blur-[140px] pointer-events-none" />

      <div className="max-w-7xl mx-auto px-6 lg:px-10 relative">

        {/* Chef illustration + headline — centered hero block */}
        <div className="flex flex-col lg:flex-row items-center gap-10 lg:gap-20 mb-20">

          {/* Chef */}
          <motion.div
            initial={{ opacity: 0, x: -32 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
            className="relative flex-shrink-0"
          >
            <div className="absolute inset-0 rounded-full bg-[#FFC500]/10 blur-3xl" />
            <img
              src="/authenticexpreince.png"
              alt="Chef Suka Shawarma"
              className="relative w-72 lg:w-96 h-auto object-contain
                         drop-shadow-[0_24px_48px_rgba(0,0,0,0.35)]
                         hover:scale-[1.02] transition-transform duration-500"
            />
          </motion.div>

          {/* Headline block */}
          <motion.div
            initial={{ opacity: 0, x: 32 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8, delay: 0.15, ease: [0.16, 1, 0.3, 1] }}
          >
            <p className="text-xs font-semibold tracking-[0.22em] uppercase text-[#FE7108] mb-4">
              KENAPA KAMI SPESIAL
            </p>
            <h2
              className="font-heading text-4xl md:text-5xl lg:text-6xl font-bold
                         leading-[1.08] tracking-tight text-white"
              style={{ fontFamily: "var(--font-heading)" }}
            >
              Kenapa<br />
              Suka Shawarma<br />
              <span className="text-[#FE7108]">Spesial?</span>
            </h2>
          </motion.div>
        </div>

        {/* 3 feature cards — floating */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 lg:gap-6">
          {features.map((item, index) => (
            <motion.div
              key={item.title}
              initial={{ opacity: 0, y: 32 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{
                duration: 0.6,
                delay: index * 0.12,
                ease: [0.16, 1, 0.3, 1],
              }}
              whileHover={{ y: -6, transition: { duration: 0.3, ease: [0.16, 1, 0.3, 1] } }}
              className="group bg-white/[0.07] backdrop-blur-sm
                         rounded-[28px] p-7
                         border border-white/10
                         shadow-[0_8px_32px_rgba(0,0,0,0.20)]
                         hover:bg-white/[0.11] hover:border-white/20
                         hover:shadow-[0_20px_48px_rgba(0,0,0,0.30)]
                         transition-all duration-300 cursor-default"
            >
              {/* Icon */}
              <div className="w-12 h-12 rounded-2xl bg-[#FE7108] flex items-center justify-center mb-5
                              group-hover:scale-105 transition-transform duration-300
                              shadow-[0_4px_16px_rgba(254,113,8,0.4)]">
                <item.icon className="w-6 h-6 text-white" strokeWidth={2.5} />
              </div>

              <h3 className="font-semibold text-white text-lg mb-2 tracking-tight">
                {item.title}
              </h3>
              <p className="text-white/60 text-sm leading-relaxed">
                {item.description}
              </p>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Bottom curve — transition back to white/cream for Testimonials */}
      <div className="absolute bottom-0 left-0 right-0 h-24 overflow-hidden pointer-events-none">
        <svg
          viewBox="0 0 1440 96"
          preserveAspectRatio="none"
          className="absolute inset-0 w-full h-full"
          aria-hidden="true"
        >
          <path d="M0,96 C360,0 1080,0 1440,96 L1440,96 L0,96 Z" fill="#FAF7F2" />
        </svg>
      </div>
    </section>
  );
}
