"use client";

import { useState, useRef, useEffect } from "react";
import { ChevronDown } from "lucide-react";

const faqs = [
  {
    q: "Apakah saya perlu pengalaman di bisnis makanan?",
    a: "Tidak perlu sama sekali. Tim operasional SukaShawarma yang mengelola seluruh aspek harian outlet — dari SDM, produksi, hingga pelayanan pelanggan. Kamu cukup hadir sebagai investor.",
  },
  {
    q: "Bagaimana mekanisme bagi hasil 50:50-nya?",
    a: "Sistem kami berjalan dalam 2 fase: Fase 1 — dari bulan pertama hingga BEP tercapai (~6 bulan), 100% net profit menjadi hak mitra untuk mempercepat balik modal. Fase 2 — setelah BEP, net profit dibagi 50:50 antara mitra dan SukaShawarma setiap bulan. Sama sekali tidak ada potongan omzet atau royalty fee.",
  },
  {
    q: "Apakah ada royalty fee atau biaya tahunan?",
    a: "SukaShawarma tidak memungut royalty fee ataupun management fee. Tidak ada potongan dari omzet sama sekali. Di Fase 1 kamu tetap mendapat 100% net profit agar investasi cepat kembali, dan di Fase 2 laba bersih dibagi 50:50.",
  },
  {
    q: "Berapa lama proses dari daftar sampai outlet buka?",
    a: "Rata-rata 4–8 minggu dari penandatanganan MoU hingga grand opening, tergantung kesiapan lokasi dan proses perizinan di daerah setempat.",
  },
  {
    q: "Apa perbedaan Paket Standard vs Paket Own Location?",
    a: "Paket Standard (Rp 150 Jt): SS menyediakan lokasi, sudah termasuk sewa tahun 1. Setelah tahun pertama, ada sewa bulanan ~Rp 2.500.000. Paket Own Location (Rp 125 Jt): Cocok jika kamu sudah punya lokasi sendiri — tidak ada biaya sewa tambahan. Keduanya menggunakan sistem BEP-First (100% net profit mitra s/d BEP, lalu 50:50).",
  },
  {
    q: "Apakah mitra bisa memilih lokasi outletnya sendiri?",
    a: "Bisa, namun tim kami akan melakukan survey dan analisis kelayakan lokasi terlebih dahulu untuk memastikan potensi bisnis yang optimal sebelum dieksekusi.",
  },
  {
    q: "Apa yang terjadi setelah kontrak 5 tahun habis?",
    a: "Kontrak dapat diperpanjang dengan kesepakatan bersama. Aset fisik (peralatan, renovasi) tetap menjadi milik Anda sesuai perjanjian awal.",
  },
];

function FAQItem({ q, a, index }: { q: string; a: string; index: number }) {
  const [open, setOpen] = useState(false);
  return (
    <div
      className={`border-b border-black/[0.07] last:border-0 reveal-on-scroll delay-${(index % 4) * 100}`}
    >
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between gap-4 py-5 text-left group"
        aria-expanded={open}
      >
        <span className="font-semibold text-[#111111] text-sm md:text-base
                         group-hover:text-[#6E1A10] transition-colors duration-200">
          {q}
        </span>
        <ChevronDown
          className={`w-5 h-5 shrink-0 text-[#6E1A10]/60 transition-transform duration-300
                      ${open ? "rotate-180" : ""}`}
        />
      </button>
      <div
        className={`grid transition-all duration-300 ease-in-out ${open ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'}`}
      >
        <div className="overflow-hidden">
          <p className="pb-5 text-sm text-[#111111]/60 leading-relaxed pr-8">{a}</p>
        </div>
      </div>
    </div>
  );
}

export default function KemitraanFAQ() {
  return (
    <section className="py-14 lg:py-28 bg-white">
      <div className="max-w-7xl mx-auto px-6 lg:px-8">
        <div className="text-center mb-12">
          <p className="text-xs font-semibold tracking-[0.22em] uppercase text-[#FE7108] mb-3">
            FAQ
          </p>
          <h2 className="font-bold text-3xl md:text-5xl tracking-tight text-[#111111]"
              style={{ fontFamily: "var(--font-heading)" }}>
            Pertanyaan yang Sering Ditanya
          </h2>
        </div>
        <div className="max-w-3xl mx-auto bg-[#FAF7F2] rounded-2xl p-5 md:p-10
                        border border-black/[0.05]">
          {faqs.map((faq, i) => (
            <FAQItem key={faq.q} q={faq.q} a={faq.a} index={i} />
          ))}
        </div>
      </div>
    </section>
  );
}
