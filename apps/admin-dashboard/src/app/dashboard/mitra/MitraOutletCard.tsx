import { MapPin, TrendingUp, DollarSign, ArrowRight } from 'lucide-react'

export function MitraOutletCard({ outlet, investasi, omzetBulanIni, onClick }: any) {
  const roi = investasi > 0 ? (omzetBulanIni / investasi) * 100 : 0
  
  return (
    <div 
      onClick={onClick}
      className="group relative bg-white border border-slate-200/60 rounded-3xl p-6 shadow-[0_2px_12px_rgba(0,0,0,0.03)] hover:shadow-[0_8px_30px_rgba(0,0,0,0.06)] hover:border-amber-200 hover:-translate-y-1 transition-all duration-300 cursor-pointer overflow-hidden"
    >
      {/* Decorative gradient blob */}
      <div className="absolute -top-12 -right-12 w-32 h-32 bg-gradient-to-br from-amber-100 to-orange-50 rounded-full blur-2xl opacity-50 group-hover:opacity-80 transition-opacity"></div>

      <div className="relative z-10 flex justify-between items-start mb-6">
        <div>
          <h3 className="font-bold text-xl text-slate-900 group-hover:text-amber-700 transition-colors leading-tight">{outlet.name}</h3>
          <div className="flex items-center text-sm text-slate-500 mt-2">
            <div className="bg-slate-100 p-1 rounded-md mr-2">
              <MapPin className="w-3.5 h-3.5 text-slate-400" />
            </div>
            <span className="truncate max-w-[200px]">{outlet.address || 'Alamat belum diatur'}</span>
          </div>
        </div>
        <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${
          outlet.is_active 
            ? 'bg-emerald-100/50 text-emerald-700 border border-emerald-200/50' 
            : 'bg-slate-100 text-slate-500 border border-slate-200'
        }`}>
          {outlet.is_active ? 'Aktif' : 'Nonaktif'}
        </span>
      </div>
      
      <div className="relative z-10 grid grid-cols-2 gap-3 mb-6">
        <div className="bg-gradient-to-br from-slate-50 to-slate-100/50 p-4 rounded-2xl border border-slate-100">
          <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-2 flex items-center">
            <DollarSign className="w-3.5 h-3.5 mr-1 text-slate-400" /> 
            Nilai Investasi
          </div>
          <div className="font-bold text-slate-800 text-base">
            {Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(investasi)}
          </div>
        </div>
        <div className="bg-gradient-to-br from-emerald-50 to-teal-50 p-4 rounded-2xl border border-emerald-100/50">
          <div className="text-[11px] font-semibold text-emerald-700 uppercase tracking-wider mb-2 flex items-center">
            <TrendingUp className="w-3.5 h-3.5 mr-1" /> 
            ROI Bulan Ini
          </div>
          <div className="font-bold text-emerald-700 text-lg">
            {roi.toFixed(2)}%
          </div>
        </div>
      </div>
      
      <div className="relative z-10 flex items-center justify-center w-full py-3 bg-amber-50 text-amber-700 group-hover:bg-amber-100 group-hover:text-amber-800 font-semibold rounded-xl transition-colors">
        <span>Lihat Detail Lengkap</span>
        <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
      </div>
    </div>
  )
}
