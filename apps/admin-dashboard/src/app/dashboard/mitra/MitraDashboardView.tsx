'use client'

import { useState } from 'react'
import { MitraOutletCard } from './MitraOutletCard'

import { MitraOutletDrawer } from './MitraOutletDrawer'

export function MitraDashboardView({ mitra, outlets, investasiMap, omzetMap }: any) {
  const [selectedOutletId, setSelectedOutletId] = useState<string | null>(null)
  
  const selectedOutlet = outlets.find((o: any) => o.id === selectedOutletId)
  
  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Selamat Datang, {mitra.nama_mitra}</h1>
        <p className="text-gray-500">Pantau performa outlet dan investasi Anda dari satu tempat.</p>
      </div>
      
      {outlets.length === 0 ? (
        <div className="bg-white border rounded-xl p-8 text-center text-gray-500">
          Anda belum memiliki outlet yang ditugaskan. Hubungi admin untuk info lebih lanjut.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {outlets.map((outlet: any) => (
            <MitraOutletCard 
              key={outlet.id}
              outlet={outlet}
              investasi={investasiMap[outlet.id] || 0}
              omzetBulanIni={omzetMap[outlet.id] || 0}
              onClick={() => setSelectedOutletId(outlet.id)}
            />
          ))}
        </div>
      )}
      
      {selectedOutlet && (
        <MitraOutletDrawer 
          outlet={selectedOutlet}
          userId={mitra.user_id}
          onClose={() => setSelectedOutletId(null)}
        />
      )}
    </div>
  )
}
