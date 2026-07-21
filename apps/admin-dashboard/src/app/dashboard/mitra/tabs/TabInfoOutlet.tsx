import { Store, Tag, Activity, MapPin } from 'lucide-react'

export function TabInfoOutlet({ outlet }: { outlet: any }) {
  if (!outlet) return null

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      {/* Informasi Umum Card */}
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-suka-gray-200 hover:shadow-md transition-shadow">
        <h3 className="text-lg font-bold text-suka-brown mb-6 flex items-center">
          <Store className="w-5 h-5 mr-2 text-suka-orange" />
          Informasi Umum
        </h3>
        
        <div className="space-y-5">
          <div className="flex flex-col">
            <span className="text-xs font-bold text-suka-gray-400 uppercase tracking-wider mb-1">Nama Outlet</span>
            <span className="text-base font-bold text-suka-brown">{outlet.name}</span>
          </div>
          
          <div className="flex flex-col">
            <span className="text-xs font-bold text-suka-gray-400 uppercase tracking-wider mb-1 flex items-center">
              <Tag className="w-3.5 h-3.5 mr-1" /> Tipe
            </span>
            <span className="text-base font-medium text-slate-700 capitalize">
              {outlet.type || 'Mitra'}
            </span>
          </div>
          
          <div className="flex flex-col">
            <span className="text-xs font-bold text-suka-gray-400 uppercase tracking-wider mb-1 flex items-center">
              <Activity className="w-3.5 h-3.5 mr-1" /> Status Operasional
            </span>
            <div>
              <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${
                outlet.is_active 
                  ? 'bg-green-50 text-suka-green border border-green-200' 
                  : 'bg-red-50 text-red-700 border border-red-200'
              }`}>
                {outlet.is_active ? 'Aktif' : 'Nonaktif'}
              </span>
            </div>
          </div>
        </div>
      </div>
      
      {/* Lokasi Card */}
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-suka-gray-200 hover:shadow-md transition-shadow">
        <h3 className="text-lg font-bold text-suka-brown mb-6 flex items-center">
          <MapPin className="w-5 h-5 mr-2 text-suka-orange" />
          Lokasi & Kontak
        </h3>
        
        <div className="flex flex-col h-[calc(100%-3rem)]">
          <span className="text-xs font-bold text-suka-gray-400 uppercase tracking-wider mb-2">Alamat Lengkap</span>
          <p className="text-base text-slate-700 leading-relaxed bg-suka-gray-50/50 p-4 rounded-xl border border-suka-gray-100 flex-1">
            {outlet.address || 'Alamat belum diisi.'}
          </p>
        </div>
      </div>
    </div>
  )
}
