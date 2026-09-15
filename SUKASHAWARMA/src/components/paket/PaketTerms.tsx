"use client";

import { useRef } from "react";
import { motion, useInView } from "motion/react";

const paymentTerms = [
  "Pemesanan H-3: DP 50% di awal, pelunasan H-1 sebelum acara",
  "Pemesanan H-1: pembayaran harus langsung lunas",
  "Pesanan diterima setiap hari pukul 13.00–20.00 WIB",
];

const cancellationTerms = [
  { when: "Pembatalan H-2", result: "DP dipotong 25%" },
  { when: "Pembatalan H-1", result: "DP hangus" },
  { when: "Tanggal acara", result: "Tidak bisa diubah setelah dikonfirmasi" },
];

const shippingFees = [
  { range: "5 – 10 km", fee: "Rp 50.000" },
  { range: "10 – 15 km", fee: "Rp 100.000" },
  { range: "15 – 20 km", fee: "Rp 150.000" },
];

export default function PaketTerms() {
  const ref = useRef<HTMLElement>(null);
  const isInView = useInView(ref, { once: true, amount: 0.15 });

  return (
    <section id="ketentuan" ref={ref} className="py-14 lg:py-24 bg-[#FAF7F2] scroll-mt-20">
      <div className="max-w-4xl mx-auto px-6 lg:px-8">
        <div className="text-center mb-12">
          <p className="text-xs font-semibold tracking-[0.22em] uppercase text-[#FE7108] mb-3">
            Perlu Diketahui
          </p>
          <h2 className="font-bold text-3xl md:text-4xl tracking-tight text-[#111111]">
            Ketentuan Pemesanan
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Pembayaran */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={isInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
            className="bg-white rounded-2xl p-6 sm:p-7 border border-black/[0.06]"
          >
            <h3 className="font-bold text-[#111111] mb-4">Pembayaran & Waktu Order</h3>
            <ul className="space-y-3 text-sm text-[#111111]/70">
              {paymentTerms.map((t) => (
                <li key={t} className="flex gap-2.5">
                  <span className="text-[#6E1A10] shrink-0">•</span>
                  <span>{t}</span>
                </li>
              ))}
            </ul>
          </motion.div>

          {/* Pembatalan */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={isInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.5, delay: 0.08, ease: [0.22, 1, 0.36, 1] }}
            className="bg-white rounded-2xl p-6 sm:p-7 border border-black/[0.06]"
          >
            <h3 className="font-bold text-[#111111] mb-4">Pembatalan</h3>
            <ul className="space-y-3 text-sm">
              {cancellationTerms.map((t) => (
                <li key={t.when} className="flex justify-between gap-3">
                  <span className="text-[#111111]/70">{t.when}</span>
                  <span className="font-semibold text-[#111111] text-right">{t.result}</span>
                </li>
              ))}
            </ul>
          </motion.div>

          {/* Ongkir */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={isInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.5, delay: 0.16, ease: [0.22, 1, 0.36, 1] }}
            className="bg-white rounded-2xl p-6 sm:p-7 border border-black/[0.06] md:col-span-2"
          >
            <h3 className="font-bold text-[#111111] mb-4">Biaya Pengiriman</h3>
            <div className="grid grid-cols-3 gap-3">
              {shippingFees.map((s) => (
                <div key={s.range} className="text-center rounded-xl bg-[#FAF7F2] py-4">
                  <p className="text-xs text-[#111111]/50 mb-1">{s.range}</p>
                  <p className="font-bold text-[#111111]">{s.fee}</p>
                </div>
              ))}
            </div>
            <p className="text-xs text-[#111111]/45 mt-4">
              Lebih dari 20 km? Hubungi kami langsung untuk cek estimasi ongkir dan waktu tempuh.
            </p>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
