'use client'

import { useState } from 'react'
import { MitraOutletCard } from './MitraOutletCard'

export function MitraDashboardView({ mitra, outlets, investasiMap, omzetMap }: any) {
  const [selectedOutletId, setSelectedOutletId] = useState<string | null>(null)
  
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
      
      {/* Drawer placeholder */}
      {selectedOutletId && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setSelectedOutletId(null)} />
          <div className="relative w-full max-w-md bg-white h-full shadow-2xl p-6 overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold">Detail Outlet</h2>
              <button onClick={() => setSelectedOutletId(null)} className="text-gray-500 hover:bg-gray-100 p-2 rounded-full transition-colors">
                ✕
              </button>
            </div>
            <div className="p-4 bg-blue-50 text-blue-800 rounded-lg border border-blue-100 text-center">
              Detail outlet akan ditampilkan di sini. (Task 5: Drawer Detail)
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
