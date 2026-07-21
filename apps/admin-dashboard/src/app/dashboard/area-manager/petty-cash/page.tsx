export default function AreaManagerPettyCashPage() {
  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Approval Petty Cash</h1>
        <p className="text-sm text-slate-500 mt-1">Review dan setujui pengajuan dana dari cabang-cabang di wilayah Anda.</p>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
        <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
          <h2 className="font-semibold text-slate-700">Daftar Pengajuan Menunggu Review</h2>
        </div>
        <div className="p-8 text-center text-slate-500 text-sm">
          UI dummy untuk tabel pengajuan petty cash area manager. 
          Nantinya data akan di-load dari Supabase dengan status 'forwarded_to_area_manager'.
        </div>
      </div>
    </div>
  )
}
