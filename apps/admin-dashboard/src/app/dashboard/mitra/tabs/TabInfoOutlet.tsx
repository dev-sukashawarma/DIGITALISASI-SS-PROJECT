import { Store, Tag, Activity, MapPin } from 'lucide-react'

export function TabInfoOutlet({ outlet }: { outlet: any }) {
  if (!outlet) return null

  return (
    <div className="flex flex-col space-y-10 py-2">
      {/* Informasi Umum Section */}
      <section>
        <h3 className="text-sm font-extrabold text-suka-brown uppercase tracking-widest mb-6 flex items-center">
          <Store className="w-4 h-4 mr-2 text-suka-orange" />
          Informasi Umum
        </h3>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="flex flex-col">
            <span className="text-xs font-bold text-suka-gray-400 uppercase tracking-wider mb-2">Nama Outlet</span>
            <span className="text-lg font-bold text-slate-800">{outlet.name}</span>
          </div>
          
          <div className="flex flex-col">
            <span className="text-xs font-bold text-suka-gray-400 uppercase tracking-wider mb-2 flex items-center">
              <Tag className="w-3.5 h-3.5 mr-1" /> Tipe
            </span>
            <span className="text-lg font-medium text-slate-700 capitalize">
              {outlet.type || 'Mitra'}
            </span>
          </div>
          
          <div className="flex flex-col">
            <span className="text-xs font-bold text-suka-gray-400 uppercase tracking-wider mb-2 flex items-center">
              <Activity className="w-3.5 h-3.5 mr-1" /> Status Operasional
            </span>
            <div>
              <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${
                outlet.is_active 
                  ? 'bg-green-50 text-suka-green border border-green-200' 
                  : 'bg-red-50 text-red-700 border border-red-200'
              }`}>
                {outlet.is_active ? 'Aktif' : 'Nonaktif'}
              </span>
            </div>
          </div>
        </div>
      </section>
      
      <hr className="border-t border-suka-gray-200 border-dashed" />

      {/* Lokasi Section */}
      <section>
        <h3 className="text-sm font-extrabold text-suka-brown uppercase tracking-widest mb-6 flex items-center">
          <MapPin className="w-4 h-4 mr-2 text-suka-orange" />
          Lokasi & Kontak
        </h3>
        
        <div className="flex flex-col">
          <span className="text-xs font-bold text-suka-gray-400 uppercase tracking-wider mb-2">Alamat Lengkap</span>
          <p className="text-base text-slate-700 leading-relaxed max-w-3xl">
            {outlet.address || 'Alamat belum diisi.'}
          </p>
        </div>
      </section>
    </div>
  )
}
