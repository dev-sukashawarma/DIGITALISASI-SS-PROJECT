export default function AreaManagerMonitoringPage() {
  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Monitoring Cabang</h1>
        <p className="text-sm text-slate-500 mt-1">Pantau stok dan pencapaian target penjualan per cabang di wilayah Anda.</p>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
        <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
          <h2 className="font-semibold text-slate-700">Tabel Monitoring Cabang</h2>
        </div>
        <div className="p-8 text-center text-slate-500 text-sm">
          UI dummy untuk tabel monitoring performa dan stok per cabang (Aggregated View). 
        </div>
      </div>
    </div>
  )
}
