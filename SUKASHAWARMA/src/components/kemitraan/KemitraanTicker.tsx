export default function KemitraanTicker() {
  const items = [
    "20+ Outlet Aktif",
    "100% Profit Untuk Mitra Sampai BEP",
    "Lanjut 50:50 Setelah Balik Modal",
    "0% Royalty & Potongan Omzet",
    "BEP ~6 Bulan",
    "ROI Hingga 456%",
    "100% Auto-Pilot",
    "Halal MUI Certified",
  ];

  return (
    <div className="bg-[#111111] py-3 overflow-hidden">
      <div className="flex gap-8 animate-[ticker_20s_linear_infinite] whitespace-nowrap">
        {[...items, ...items].map((item, i) => (
          <span key={i} className="text-white/70 text-sm font-medium shrink-0">
            <span className="text-[#FE7108] mr-2">✦</span>
            {item}
          </span>
        ))}
      </div>
      <style>{`
        @keyframes ticker {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
      `}</style>
    </div>
  );
}
