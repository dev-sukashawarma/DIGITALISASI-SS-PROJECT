export default function AreaManagerDashboardPage() {
  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Area Manager Dashboard</h1>
        <p className="text-sm text-slate-500 mt-1">Ringkasan performa dan operasional cabang-cabang di wilayah Anda hari ini.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Simple KPI Cards */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <div className="text-sm font-medium text-slate-500 mb-1">Total Penjualan Area (Hari Ini)</div>
          <div className="text-2xl font-bold text-suka-ink">Rp 12.450.000</div>
          <div className="text-xs text-emerald-500 font-medium mt-1">+8.5% dari kemarin</div>
        </div>
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <div className="text-sm font-medium text-slate-500 mb-1">Pending Approval Petty Cash</div>
          <div className="text-2xl font-bold text-suka-ink">4</div>
          <div className="text-xs text-amber-500 font-medium mt-1">Cabang membutuhkan review</div>
        </div>
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <div className="text-sm font-medium text-slate-500 mb-1">Cabang Aktif</div>
          <div className="text-2xl font-bold text-suka-ink">8 / 8</div>
          <div className="text-xs text-emerald-500 font-medium mt-1">Semua cabang beroperasi</div>
        </div>
      </div>
    </div>
  )
}
