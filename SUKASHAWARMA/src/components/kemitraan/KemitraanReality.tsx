"use client";

import { motion } from "motion/react";

export default function KemitraanReality() {
  return (
    <section className="py-20 lg:py-32 bg-white">
      <div className="max-w-7xl mx-auto px-6 lg:px-8">
        
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center"
        >
          <p className="text-sm font-semibold text-[#FE7108] mb-4 tracking-wider uppercase">
            Ternyata
          </p>
          <h2 className="text-3xl md:text-5xl font-bold text-[#111111] leading-tight mb-8">
            Outlet-outlet itu dipegang orang lain — bukan tim inti Suka Shawarma.
          </h2>
          
          <div className="max-w-4xl mx-auto">
            <p className="text-lg md:text-xl text-[#111111]/70 leading-relaxed">
              Di internal, ini yang biasa disebut kemitraan. Tapi praktiknya sederhana: kamu yang nitip modal dan nama di outletnya, tim kami yang jalanin operasional harian — dari rekrut staf, produksi, sampai laporan bulanan. Kamu yang berpotensi menikmati hasilnya, bukan pekerjaannya. Hasil operasional outlet sendiri tetap tergantung lokasi dan kondisi pasar — bukan sesuatu yang bisa dijamin di muka.
            </p>
          </div>
        </motion.div>

      </div>
    </section>
  );
}