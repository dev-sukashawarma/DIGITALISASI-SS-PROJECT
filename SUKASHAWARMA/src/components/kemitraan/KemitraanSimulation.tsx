"use client";

import { motion } from "motion/react";

export default function KemitraanSimulation() {
  return (
    <section className="py-20 lg:py-32 bg-[#FAF7F2]">
      <div className="max-w-7xl mx-auto px-6 lg:px-8">
        
        {/* Section Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <p className="text-sm font-semibold text-[#FE7108] mb-4 tracking-wider uppercase">
            Menu Utama
          </p>
          <h2 className="text-3xl md:text-5xl font-bold text-[#111111] leading-tight mb-6">
            Angkanya, biar nggak cuma cerita
          </h2>
          <p className="text-lg text-[#111111]/70 max-w-3xl mx-auto">
            Ini simulasi berdasarkan performa rata-rata outlet aktif kami — bukan proyeksi optimis di atas kertas.
          </p>
        </motion.div>

        <div className="grid lg:grid-cols-2 gap-16 items-center">
          
          {/* Left Content */}
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8 }}
            className="space-y-6"
          >
            <p className="text-lg text-[#111111]/70 leading-relaxed mb-8">
              Struk di samping ini simulasi satu outlet paket Own Location — kamu sudah punya lokasi, tim kami yang setup dan jalanin sisanya.
            </p>
            
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <div className="w-2 h-2 bg-[#6E1A10] rounded-full mt-2 shrink-0"></div>
                <p className="text-[#111111]/70">
                  <strong>Fase 1:</strong> 100% net profit jadi hak kamu sampai modal balik — nggak ada potongan royalty.
                </p>
              </div>
              
              <div className="flex items-start gap-3">
                <div className="w-2 h-2 bg-[#6E1A10] rounded-full mt-2 shrink-0"></div>
                <p className="text-[#111111]/70">
                  <strong>Fase 2:</strong> setelah BEP, laba bersih dibagi 50:50 tiap bulan, tanpa keterlibatan operasional dari kamu.
                </p>
              </div>
              
              <div className="flex items-start gap-3">
                <div className="w-2 h-2 bg-[#6E1A10] rounded-full mt-2 shrink-0"></div>
                <p className="text-[#111111]/70">
                  <strong>Nol persen</strong> royalty fee dan nol potongan omzet di kedua fase.
                </p>
              </div>
            </div>
          </motion.div>

          {/* Right Content - Struk Simulasi */}
          <motion.div
            initial={{ opacity: 0, x: 30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8 }}
            className="bg-white rounded-2xl shadow-xl overflow-hidden"
          >
            {/* Header Struk */}
            <div className="bg-[#6E1A10] text-white p-6 text-center">
              <h3 className="font-bold text-xl mb-1">SUKA SHAWARMA</h3>
              <p className="text-sm opacity-90">Struk Simulasi — Paket Own Location</p>
            </div>
            
            {/* Content Struk */}
            <div className="p-6 space-y-4">
              {[
                { label: "Modal Investasi", value: "Rp 125.000.000" },
                { label: "Estimasi Omzet / Bulan", value: "Rp 75.000.000" },
                { label: "Margin Profit Bersih", value: "30%" },
                { label: "Estimasi BEP", value: "~6 Bulan" },
                { label: "Bagi Hasil / Bulan (Fase 2)", value: "Rp 11,4 Jt" },
                { label: "Estimasi ROI 5 Tahun*", value: "~456%" }
              ].map((item, index) => (
                <div key={index} className="flex justify-between items-center py-2 border-b border-gray-100 last:border-b-0">
                  <span className="text-[#111111]/70 text-sm">{item.label}</span>
                  <span className="font-semibold text-[#111111]">{item.value}</span>
                </div>
              ))}
            </div>
            
            {/* Footer Disclaimer */}
            <div className="bg-gray-50 p-4 text-xs text-[#111111]/60 leading-relaxed">
              *Simulasi, bukan jaminan hasil. Berdasarkan rata-rata performa outlet aktif — hasil aktual bervariasi per lokasi, dan performa masa lalu tidak menjamin hasil di masa depan.
            </div>
          </motion.div>

        </div>
      </div>
    </section>
  );
}