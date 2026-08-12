// Static component (Framer motion removed for performance)

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

  return (
    <div className="hidden md:block relative">
      {/* Connecting line */}
      <div className="absolute top-10 left-[calc(12.5%+20px)] right-[calc(12.5%+20px)] h-px bg-[#6E1A10]/10">
        <div
          className="absolute inset-y-0 left-0 bg-[#6E1A10]/40 w-full"
        />
      </div>

      <div className="grid grid-cols-4 gap-6">
        {steps.map((step, i) => (
          <div
            key={step.number}
            className={`flex flex-col items-center text-center reveal-on-scroll delay-${(i % 4) * 100}`}
          >
            {/* Node */}
            <div className="relative z-10 mb-6">
              <div
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
              </div>
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
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Mobile: vertical timeline ─────────────────────────────────────────────────

function MobileTimeline() {

  return (
    <div className="md:hidden relative pl-10">
      {/* Vertical connecting line */}
      <div className="absolute left-4 top-5 bottom-5 w-px bg-[#6E1A10]/10">
        <div
          className="absolute inset-x-0 top-0 bg-[#6E1A10]/40 h-full"
        />
      </div>

      <div className="flex flex-col gap-8">
        {steps.map((step, i) => (
          <div
            key={step.number}
            className={`flex gap-5 items-start reveal-on-scroll reveal-left delay-${(i % 4) * 100}`}
          >
            {/* Node */}
            <div
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
            </div>

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
          </div>
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
        <div
          className="text-center mb-16 reveal-on-scroll"
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
        </div>

        <DesktopTimeline />
        <MobileTimeline />
      </div>
    </section>
  );
}
