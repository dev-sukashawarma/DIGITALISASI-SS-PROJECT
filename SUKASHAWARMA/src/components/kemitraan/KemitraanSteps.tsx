"use client";

import { useRef } from "react";
import { motion, useInView } from "motion/react";

const steps = [
  {
    number: "01",
    title: "Konsultasi & Survey",
    description:
      "Tim kami akan berdiskusi mengenai rencana lokasi dan kelayakan bisnis bersama Anda.",
  },
  {
    number: "02",
    title: "Tanda Tangan MoU",
    description:
      "Setelah sepakat, proses dilanjutkan dengan penandatanganan perjanjian kerjasama resmi.",
  },
  {
    number: "03",
    title: "Setup & Training",
    description:
      "Kami mendampingi proses setup outlet dan memberikan pelatihan lengkap untuk tim Anda.",
  },
  {
    number: "04",
    title: "Buka & Pantau",
    description:
      "Outlet resmi dibuka dan tim kami terus memantau performa untuk memastikan kelancaran operasional.",
  },
];

// ─── Desktop: horizontal timeline ─────────────────────────────────────────────

function DesktopTimeline() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-15% 0px" });

  return (
    <div ref={ref} className="hidden md:block relative">
      {/* Connecting line */}
      <div className="absolute top-10 left-[calc(12.5%+20px)] right-[calc(12.5%+20px)] h-px bg-[#6E1A10]/10">
        <motion.div
          className="absolute inset-y-0 left-0 bg-[#6E1A10]/40 origin-left"
          initial={{ scaleX: 0 }}
          animate={inView ? { scaleX: 1 } : { scaleX: 0 }}
          transition={{ duration: 1.2, delay: 0.4, ease: [0.16, 1, 0.3, 1] }}
        />
      </div>

      <div className="grid grid-cols-4 gap-6">
        {steps.map((step, i) => (
          <motion.div
            key={step.number}
            initial={{ opacity: 0, y: 24, scale: 0.96 }}
            animate={inView ? { opacity: 1, y: 0, scale: 1 } : {}}
            transition={{
              duration: 0.55,
              delay: 0.2 + i * 0.12,
              ease: [0.16, 1, 0.3, 1],
            }}
            className="flex flex-col items-center text-center"
          >
            {/* Node */}
            <div className="relative z-10 mb-6">
              <motion.div
                initial={{ scale: 0.7, opacity: 0 }}
                animate={inView ? { scale: 1, opacity: 1 } : {}}
                transition={{
                  duration: 0.45,
                  delay: 0.3 + i * 0.12,
                  ease: [0.34, 1.56, 0.64, 1],
                }}
                className="w-20 h-20 rounded-full bg-white
                           border-2 border-[#6E1A10]/20
                           shadow-[0_4px_20px_rgba(110,26,16,0.12)]
                           flex items-center justify-center"
              >
                <span
                  className="font-bold text-2xl text-[#6E1A10]"
                  style={{ fontFamily: "var(--font-heading)", letterSpacing: "-0.02em" }}
                >
                  {step.number}
                </span>
              </motion.div>
            </div>

            <h3
              className="font-bold text-[#111111] text-base mb-2 leading-snug"
              style={{ fontFamily: "var(--font-heading)" }}
            >
              {step.title}
            </h3>
            <p className="text-sm text-[#111111]/55 leading-relaxed max-w-[200px]">
              {step.description}
            </p>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

// ─── Mobile: vertical timeline ─────────────────────────────────────────────────

function MobileTimeline() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-10% 0px" });

  return (
    <div ref={ref} className="md:hidden relative pl-10">
      {/* Vertical connecting line */}
      <div className="absolute left-4 top-5 bottom-5 w-px bg-[#6E1A10]/10">
        <motion.div
          className="absolute inset-x-0 top-0 bg-[#6E1A10]/40 origin-top"
          initial={{ scaleY: 0 }}
          animate={inView ? { scaleY: 1 } : { scaleY: 0 }}
          transition={{ duration: 1.4, delay: 0.3, ease: [0.16, 1, 0.3, 1] }}
        />
      </div>

      <div className="flex flex-col gap-8">
        {steps.map((step, i) => (
          <motion.div
            key={step.number}
            initial={{ opacity: 0, x: -16 }}
            animate={inView ? { opacity: 1, x: 0 } : {}}
            transition={{
              duration: 0.5,
              delay: 0.2 + i * 0.1,
              ease: [0.16, 1, 0.3, 1],
            }}
            className="flex gap-5 items-start"
          >
            {/* Node */}
            <motion.div
              initial={{ scale: 0.6, opacity: 0 }}
              animate={inView ? { scale: 1, opacity: 1 } : {}}
              transition={{
                duration: 0.4,
                delay: 0.3 + i * 0.1,
                ease: [0.34, 1.56, 0.64, 1],
              }}
              className="shrink-0 -ml-10 w-9 h-9 rounded-full
                         bg-white border-2 border-[#6E1A10]/30
                         shadow-[0_2px_12px_rgba(110,26,16,0.12)]
                         flex items-center justify-center z-10 relative"
            >
              <span
                className="font-bold text-xs text-[#6E1A10]"
                style={{ fontFamily: "var(--font-heading)" }}
              >
                {step.number}
              </span>
            </motion.div>

            <div className="pt-0.5">
              <h3
                className="font-bold text-[#111111] text-base mb-1 leading-snug"
                style={{ fontFamily: "var(--font-heading)" }}
              >
                {step.title}
              </h3>
              <p className="text-sm text-[#111111]/55 leading-relaxed">
                {step.description}
              </p>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

// ─── Section ───────────────────────────────────────────────────────────────────

export default function KemitraanSteps() {
  return (
    <section className="py-14 lg:py-28 bg-white">
      <div className="max-w-7xl mx-auto px-6 lg:px-8">

        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          className="text-center mb-16"
        >
          <p className="text-xs font-semibold tracking-[0.22em] uppercase text-[#FE7108] mb-3">
            Cara Kerja
          </p>
          <h2
            className="font-bold text-3xl md:text-5xl tracking-tight text-[#111111] mb-4"
            style={{ fontFamily: "var(--font-heading)" }}
          >
            4 Langkah Mulai Bisnis
          </h2>
          <p className="text-[#111111]/55 text-base max-w-md mx-auto leading-relaxed">
            Dari konsultasi hingga outlet berjalan — prosesnya jelas dan kami dampingi di setiap tahap.
          </p>
        </motion.div>

        <DesktopTimeline />
        <MobileTimeline />
      </div>
    </section>
  );
}
