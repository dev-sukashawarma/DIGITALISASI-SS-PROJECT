import { Store, Tag, Activity, MapPin } from 'lucide-react'

export function TabInfoOutlet({ outlet }: { outlet: any }) {
  if (!outlet) return null

  return (
    <div className="bg-white/70 backdrop-blur-md rounded-[32px] p-6 sm:p-8 shadow-xl shadow-suka-orange/5 border border-white hover:bg-white/90 transition-all duration-300 animate-fade-in">
      <div className="flex items-center mb-8">
        <div className="p-2 bg-gradient-to-br from-suka-orange/20 to-suka-orange/5 rounded-xl mr-3 border border-suka-orange/10 shadow-sm">
          <Store className="w-5 h-5 text-suka-orange" />
        </div>
        <h3 className="text-sm font-extrabold text-suka-brown uppercase tracking-widest">
          Informasi & Lokasi Outlet
        </h3>
      </div>
      
      <div className="flex flex-wrap gap-4 sm:gap-6">
        <div className="flex-1 min-w-[200px] flex flex-col bg-white/50 backdrop-blur-sm p-4 sm:p-5 rounded-2xl border border-white/60 shadow-sm">
          <span className="text-[10px] font-bold text-suka-gray-400 uppercase tracking-wider mb-1">Nama Outlet</span>
          <span className="text-base sm:text-lg font-black text-suka-brown drop-shadow-sm leading-tight mt-auto">{outlet.name}</span>
        </div>
        
        <div className="flex-1 min-w-[140px] flex flex-col bg-white/50 backdrop-blur-sm p-4 sm:p-5 rounded-2xl border border-white/60 shadow-sm">
          <span className="text-[10px] font-bold text-suka-gray-400 uppercase tracking-wider mb-1 flex items-center">
            <Tag className="w-3 h-3 mr-1 text-suka-orange" /> Tipe
          </span>
          <span className="text-sm font-bold text-slate-700 capitalize mt-auto">
            {outlet.type || 'Mitra'}
          </span>
        </div>
        
        <div className="flex-1 min-w-[150px] flex flex-col bg-white/50 backdrop-blur-sm p-4 sm:p-5 rounded-2xl border border-white/60 shadow-sm">
          <span className="text-[10px] font-bold text-suka-gray-400 uppercase tracking-wider mb-2 flex items-center">
            <Activity className="w-3 h-3 mr-1 text-suka-green" /> Status
          </span>
          <div className="mt-auto">
            <span className={`inline-flex items-center px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest shadow-sm ${
              outlet.is_active 
                ? 'bg-gradient-to-r from-green-400 to-suka-green text-white shadow-green-500/30' 
                : 'bg-gradient-to-r from-red-500 to-red-600 text-white shadow-red-500/30'
            }`}>
              {outlet.is_active ? 'Aktif Beroperasi' : 'Nonaktif'}
            </span>
          </div>
        </div>

        <div className="w-full lg:flex-[2] min-w-[250px] flex flex-col bg-white/50 backdrop-blur-sm p-4 sm:p-5 rounded-2xl border border-white/60 shadow-sm">
          <span className="text-[10px] font-bold text-suka-gray-400 uppercase tracking-wider mb-1 flex items-center">
            <MapPin className="w-3 h-3 mr-1 text-suka-orange" /> Alamat Lengkap
          </span>
          <p className="text-xs sm:text-sm text-suka-brown font-medium leading-relaxed mt-auto">
            {outlet.address || 'Alamat belum diisi.'}
          </p>
        </div>
      </div>
    </div>
  )
}
