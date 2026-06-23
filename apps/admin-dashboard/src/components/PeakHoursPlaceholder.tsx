import { Lock } from 'lucide-react'

export function PeakHoursPlaceholder() {
  return (
    <div className="bg-white rounded-2xl border border-suka-gray-200 shadow-sm overflow-hidden relative">
      <div className="p-6">
        <h3 className="font-extrabold text-suka-brown text-sm tracking-tight uppercase">Heatmap Jam Ramai (Peak Hours)</h3>
        <p className="text-xs text-suka-gray-400 font-semibold mt-0.5">Distribusi penjualan berdasarkan jam</p>
        
        {/* Dummy Chart blurred */}
        <div className="mt-6 h-40 flex items-end gap-1 opacity-20 blur-[2px] pointer-events-none">
          {[2, 3, 5, 8, 12, 15, 18, 14, 9, 5, 2, 1].map((h, i) => (
            <div key={i} className="flex-1 bg-suka-orange rounded-t-sm" style={{ height: `${h * 5}%` }}></div>
          ))}
        </div>
      </div>

      {/* Overlay overlay */}
      <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-white/60 backdrop-blur-sm p-4 text-center">
        <div className="w-12 h-12 bg-suka-cream rounded-full flex items-center justify-center mb-3 shadow-sm border border-suka-gray-200">
          <Lock className="w-5 h-5 text-suka-brown" />
        </div>
        <h4 className="font-bold text-suka-ink text-sm">Fitur Segera Hadir</h4>
        <p className="text-xs text-suka-gray-500 max-w-[200px] mt-1 font-medium">Data waktu transaksi (jam) sedang disinkronisasikan oleh tim IT pusat.</p>
      </div>
    </div>
  )
}
