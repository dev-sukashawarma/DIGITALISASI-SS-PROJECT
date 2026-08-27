declare const gtag: (...args: unknown[]) => void;

// ─── SVG Icons ────────────────────────────────────────────────────────────────

const IconStore = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
    <polyline points="9 22 9 12 15 12 15 22"/>
  </svg>
);

const IconZap = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
  </svg>
);

const IconTrendingUp = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/>
    <polyline points="17 6 23 6 23 12"/>
  </svg>
);

const IconClock = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="12" cy="12" r="10"/>
    <polyline points="12 6 12 12 16 14"/>
  </svg>
);

const IconPhone = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.7 12a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.61 1h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.6a16 16 0 0 0 6 6l.96-.96a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 21.73 16c.109.307.164.628.16.92z"/>
  </svg>
);

const badges = [
  { Icon: IconStore,      text: "20+ Outlet Aktif" },
  { Icon: IconZap,        text: "100% Profit Sampai BEP" },
  { Icon: IconTrendingUp, text: "ROI hingga 456%" },
  { Icon: IconClock,      text: "BEP ~6 Bulan" },
];

export default function KemitraanCTA() {
  return (
    <section className="py-14 lg:py-28 bg-[#6E1A10] relative overflow-hidden">
      {/* Glow */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div className="w-[600px] h-[600px] rounded-full bg-[#FE7108]/10 blur-[120px]" />
      </div>

      <div className="max-w-4xl mx-auto px-6 lg:px-8 text-center relative">
        <h2 className="font-bold leading-[1.06] tracking-tight text-white mb-4" style={{ fontSize: "clamp(2rem, 5vw, 3.5rem)" }}>
          Siap Jadi Bagian dari{" "}
          <span className="text-[#FE7108]">SukaShawarma?</span>
        </h2>
        <p className="text-white/65 text-base leading-relaxed mb-10 max-w-xl mx-auto">
          Hubungi tim kami untuk konsultasi gratis — tanpa paksaan, tanpa DP dulu.
          Slot mitra sangat terbatas.
        </p>

        {/* Badge row */}
        <div className="flex flex-wrap justify-center gap-3 mb-10">
          {badges.map(({ Icon, text }) => (
            <div key={text} className="flex items-center gap-1.5 px-4 py-2 rounded-full bg-white/[0.08] border border-white/[0.12] text-white/75 text-xs font-medium">
              <Icon />
              {text}
            </div>
          ))}
        </div>

        {/* WhatsApp button */}
        <a
          href="https://wa.me/6282299325621"
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => { if (typeof gtag !== "undefined") gtag("event", "conversion", { send_to: "AW-11522229721/18NOCPO46eYcENmLnfYq", value: 1.0, currency: "IDR" }); }}
          className="inline-flex items-center justify-center gap-2.5 px-10 py-4 rounded-full
                     bg-[#25D366] text-white font-semibold text-base
                     min-h-[52px]
                     hover:bg-[#1ebe5d] transition-colors duration-200
                     shadow-[0_8px_32px_rgba(37,211,102,0.35)] mb-6"
        >
          <svg viewBox="0 0 24 24" className="w-5 h-5 fill-white shrink-0" aria-hidden="true">
            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/>
            <path d="M12 0C5.373 0 0 5.373 0 12c0 2.123.553 4.116 1.522 5.847L0 24l6.335-1.502A11.95 11.95 0 0 0 12 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.818a9.792 9.792 0 0 1-5.002-1.373l-.359-.213-3.72.882.939-3.618-.234-.372A9.792 9.792 0 0 1 2.182 12C2.182 6.57 6.57 2.182 12 2.182c5.43 0 9.818 4.388 9.818 9.818 0 5.43-4.388 9.818-9.818 9.818z"/>
          </svg>
          Chat WhatsApp Sekarang
        </a>

        <p className="flex items-center justify-center gap-2 text-white/40 text-sm">
          <IconPhone />
          +62 822-9932-5621
          <span className="opacity-50">|</span>
          kemitraan@sukashawarma.com
        </p>
      </div>
    </section>
  );
}
