import { MapPin, TrendingUp, DollarSign } from 'lucide-react'

export function MitraOutletCard({ outlet, investasi, omzetBulanIni, onClick }: any) {
  const roi = investasi > 0 ? (omzetBulanIni / investasi) * 100 : 0
  
  return (
    <div className="bg-white border rounded-xl p-5 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex justify-between items-start mb-4">
        <div>
          <h3 className="font-semibold text-lg">{outlet.name}</h3>
          <div className="flex items-center text-sm text-gray-500 mt-1">
            <MapPin className="w-4 h-4 mr-1" />
            <span className="truncate max-w-[200px]">{outlet.address || '-'}</span>
          </div>
        </div>
        <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${outlet.is_active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
          {outlet.is_active ? 'Aktif' : 'Nonaktif'}
        </span>
      </div>
      
      <div className="grid grid-cols-2 gap-4 mb-4">
        <div className="bg-gray-50 p-3 rounded-lg">
          <div className="text-xs text-gray-500 mb-1 flex items-center">
            <DollarSign className="w-3 h-3 mr-1" /> Nilai Investasi
          </div>
          <div className="font-semibold text-sm">
            {Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(investasi)}
          </div>
        </div>
        <div className="bg-green-50 p-3 rounded-lg">
          <div className="text-xs text-green-700 mb-1 flex items-center">
            <TrendingUp className="w-3 h-3 mr-1" /> ROI Bulan Ini
          </div>
          <div className="font-semibold text-green-700">
            {roi.toFixed(2)}%
          </div>
        </div>
      </div>
      
      <button 
        onClick={onClick}
        className="w-full py-2 bg-blue-50 text-blue-600 hover:bg-blue-100 font-medium rounded-lg transition-colors"
      >
        Lihat Detail
      </button>
    </div>
  )
}
