import { Store, Tag, Activity, MapPin } from 'lucide-react'

export function TabInfoOutlet({ outlet }: { outlet: any }) {
  if (!outlet) return null

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-fade-in">
      
      {/* Card Informasi Umum */}
      <div className="bg-white/70 backdrop-blur-md rounded-[32px] p-6 sm:p-8 shadow-xl shadow-suka-orange/5 border border-white hover:bg-white/90 hover:-translate-y-1 transition-all duration-300">
        <h3 className="text-sm font-extrabold text-suka-brown uppercase tracking-widest mb-6 flex items-center">
          <div className="p-2 bg-gradient-to-br from-suka-orange/20 to-suka-orange/5 rounded-xl mr-3 border border-suka-orange/10 shadow-sm">
            <Store className="w-5 h-5 text-suka-orange" />
          </div>
          Informasi Umum
        </h3>
        
        <div className="flex flex-col space-y-6">
          <div className="flex flex-col">
            <span className="text-xs font-bold text-suka-gray-400 uppercase tracking-wider mb-1">Nama Outlet</span>
            <span className="text-lg font-black text-suka-brown drop-shadow-sm">{outlet.name}</span>
          </div>
          
          <div className="flex flex-col">
            <span className="text-xs font-bold text-suka-gray-400 uppercase tracking-wider mb-1 flex items-center">
              <Tag className="w-3.5 h-3.5 mr-1 text-suka-orange" /> Tipe Kemitraan
            </span>
            <span className="text-base font-bold text-slate-700 capitalize">
              {outlet.type || 'Mitra'}
            </span>
          </div>
          
          <div className="flex flex-col">
            <span className="text-xs font-bold text-suka-gray-400 uppercase tracking-wider mb-2 flex items-center">
              <Activity className="w-3.5 h-3.5 mr-1 text-suka-green" /> Status Operasional
            </span>
            <div>
              <span className={`inline-flex items-center px-4 py-1.5 rounded-full text-xs font-black uppercase tracking-widest shadow-sm ${
                outlet.is_active 
                  ? 'bg-gradient-to-r from-green-400 to-suka-green text-white shadow-green-500/30' 
                  : 'bg-gradient-to-r from-red-500 to-red-600 text-white shadow-red-500/30'
              }`}>
                {outlet.is_active ? 'Aktif Beroperasi' : 'Nonaktif'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Card Lokasi */}
      <div className="bg-white/70 backdrop-blur-md rounded-[32px] p-6 sm:p-8 shadow-xl shadow-suka-orange/5 border border-white hover:bg-white/90 hover:-translate-y-1 transition-all duration-300">
        <h3 className="text-sm font-extrabold text-suka-brown uppercase tracking-widest mb-6 flex items-center">
          <div className="p-2 bg-gradient-to-br from-suka-orange/20 to-suka-orange/5 rounded-xl mr-3 border border-suka-orange/10 shadow-sm">
            <MapPin className="w-5 h-5 text-suka-orange" />
          </div>
          Lokasi & Kontak
        </h3>
        
        <div className="flex flex-col h-[calc(100%-4rem)]">
          <span className="text-xs font-bold text-suka-gray-400 uppercase tracking-wider mb-2">Alamat Lengkap</span>
          <p className="text-sm text-suka-brown font-medium leading-relaxed bg-white/50 backdrop-blur-sm p-5 rounded-2xl border border-white/60 shadow-inner flex-1">
            {outlet.address || 'Alamat belum diisi.'}
          </p>
        </div>
      </div>

    </div>
  )
}
