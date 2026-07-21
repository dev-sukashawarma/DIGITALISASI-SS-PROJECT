'use client'

import { useState } from 'react'
import { MitraOutletCard } from './MitraOutletCard'
import { MitraOutletDrawer } from './MitraOutletDrawer'
import { Store, TrendingUp } from 'lucide-react'

export function MitraDashboardView({ mitra, outlets, investasiMap, omzetMap }: any) {
  const [selectedOutletId, setSelectedOutletId] = useState<string | null>(null)
  
  const selectedOutlet = outlets.find((o: any) => o.id === selectedOutletId)
  
  const totalInvestasi = Object.values(investasiMap).reduce((sum: any, val: any) => sum + val, 0) as number
  const totalOmzet = Object.values(omzetMap).reduce((sum: any, val: any) => sum + val, 0) as number
  const avgRoi = totalInvestasi > 0 ? (totalOmzet / totalInvestasi) * 100 : 0
  
  return (
    <div className="min-h-screen bg-slate-50/50 pb-12">
      {/* Premium Hero Section */}
      <div className="bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-6 py-10 lg:py-14">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
            <div>
              <div className="inline-flex items-center space-x-2 bg-amber-50 text-amber-700 px-3 py-1 rounded-full text-sm font-semibold tracking-wide uppercase mb-4 shadow-sm border border-amber-100/50">
                <Store className="w-4 h-4" />
                <span>Portal Mitra Resmi</span>
              </div>
              <h1 className="text-3xl md:text-4xl font-extrabold text-slate-900 tracking-tight">
                Halo, <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-600 to-orange-500">{mitra.nama_mitra}</span>
              </h1>
              <p className="text-slate-500 mt-2 text-lg max-w-xl leading-relaxed">
                Pantau performa harian outlet dan tingkatkan nilai investasi Anda dari satu dashboard terpadu.
              </p>
            </div>
            
            {outlets.length > 0 && (
              <div className="flex gap-4">
                <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4 shadow-sm min-w[140px]">
                  <div className="text-slate-500 text-xs font-medium mb-1">Total Outlet</div>
                  <div className="text-2xl font-bold text-slate-800">{outlets.length} <span className="text-sm font-normal text-slate-500">Aktif</span></div>
                </div>
                <div className="bg-gradient-to-br from-emerald-50 to-teal-50 border border-emerald-100 rounded-2xl p-4 shadow-sm min-w[140px]">
                  <div className="text-emerald-700 text-xs font-medium mb-1 flex items-center">
                    <TrendingUp className="w-3 h-3 mr-1" /> ROI Rata-rata
                  </div>
                  <div className="text-2xl font-bold text-emerald-700">{avgRoi.toFixed(2)}%</div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-6 py-10">
        <div className="flex items-center justify-between mb-8">
          <h2 className="text-xl font-bold text-slate-800">Daftar Outlet Anda</h2>
        </div>
        
        {outlets.length === 0 ? (
          <div className="bg-white border border-slate-200 border-dashed rounded-3xl p-12 text-center shadow-sm">
            <div className="bg-slate-50 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
              <Store className="w-8 h-8 text-slate-400" />
            </div>
            <h3 className="text-lg font-semibold text-slate-900 mb-1">Belum Ada Outlet</h3>
            <p className="text-slate-500 max-w-sm mx-auto">
              Anda belum memiliki outlet yang ditugaskan. Hubungi admin pusat untuk proses penambahan profil investasi Anda.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 xl:gap-8">
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
      </div>
      
      {/* Drawer */}
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
