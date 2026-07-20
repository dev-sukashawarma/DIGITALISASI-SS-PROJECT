export function TabInfoOutlet({ outlet }: { outlet: any }) {
  if (!outlet) return null

  return (
    <div className="space-y-4">
      <div className="bg-gray-50 p-4 rounded-lg border">
        <h3 className="font-semibold text-gray-700 mb-3">Informasi Umum</h3>
        <div className="space-y-2 text-sm">
          <div className="grid grid-cols-3">
            <span className="text-gray-500">Nama</span>
            <span className="col-span-2 font-medium">{outlet.name}</span>
          </div>
          <div className="grid grid-cols-3">
            <span className="text-gray-500">Tipe</span>
            <span className="col-span-2 capitalize">{outlet.type || '-'}</span>
          </div>
          <div className="grid grid-cols-3">
            <span className="text-gray-500">Status</span>
            <span className={`col-span-2 ${outlet.is_active ? 'text-green-600 font-medium' : 'text-gray-500'}`}>
              {outlet.is_active ? 'Aktif' : 'Nonaktif'}
            </span>
          </div>
        </div>
      </div>
      
      <div className="bg-gray-50 p-4 rounded-lg border">
        <h3 className="font-semibold text-gray-700 mb-3">Lokasi & Kontak</h3>
        <div className="space-y-2 text-sm">
          <div className="grid grid-cols-3">
            <span className="text-gray-500">Alamat</span>
            <span className="col-span-2">{outlet.address || '-'}</span>
          </div>
        </div>
      </div>
    </div>
  )
}
