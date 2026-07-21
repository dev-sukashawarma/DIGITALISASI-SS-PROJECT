'use client'

import { useState, useEffect } from 'react'
import { MitraOutletDetails } from './MitraOutletDetails'
import { PageHeader } from '@/components/ui'
import CountUp from 'react-countup'
import { TrendingUp, DollarSign, Store } from 'lucide-react'

export function MitraDashboardView({ mitra, outlets, investasiMap, omzetMap }: any) {
  const [selectedOutletId, setSelectedOutletId] = useState<string | null>(
    outlets.length > 0 ? outlets[0].id : null
  )
  
  useEffect(() => {
    if (outlets.length > 0 && !selectedOutletId) {
      setSelectedOutletId(outlets[0].id)
    }
  }, [outlets, selectedOutletId])
  
  const selectedOutlet = outlets.find((o: any) => o.id === selectedOutletId)
  
  const currentInvestasi = selectedOutletId ? (investasiMap[selectedOutletId] || 0) : 0
  const currentOmzet = selectedOutletId ? (omzetMap[selectedOutletId] || 0) : 0
  const currentRoi = currentInvestasi > 0 ? (currentOmzet / currentInvestasi) * 100 : 0
  
  return (
    <div className="space-y-6 animate-fade-in p-4 sm:p-6 pb-12 max-w-[1600px] mx-auto">
      <PageHeader 
        title="Portal Mitra" 
        description={`Selamat datang, ${mitra.nama_mitra}. Pantau performa harian outlet dan tingkatkan nilai investasi Anda.`}
      >
        {outlets.length > 0 && (
          <div className="flex flex-col sm:flex-row sm:items-center gap-2">
            <label className="text-xs font-bold text-suka-gray-500 uppercase tracking-wider">Outlet</label>
            <select
              value={selectedOutletId || ''}
              onChange={(e) => setSelectedOutletId(e.target.value)}
              className="w-full sm:w-auto px-4 py-2 border border-suka-gray-200 rounded-xl text-sm font-semibold bg-white text-suka-brown focus:ring-2 focus:ring-suka-orange focus:border-suka-orange outline-none cursor-pointer"
            >
              {outlets.map((outlet: any) => (
                <option key={outlet.id} value={outlet.id}>
                  {outlet.name}
                </option>
              ))}
            </select>
          </div>
        )}
      </PageHeader>
      
      {outlets.length === 0 ? (
        <div className="bg-white border border-suka-gray-200 border-dashed rounded-2xl p-12 text-center shadow-sm max-w-3xl mx-auto mt-6">
          <div className="bg-gray-50 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
            <Store className="w-8 h-8 text-suka-gray-400" />
          </div>
          <h3 className="text-lg font-extrabold text-suka-brown mb-1">Belum Ada Outlet</h3>
          <p className="text-suka-gray-500 max-w-sm mx-auto font-medium text-sm">
            Anda belum memiliki outlet yang ditugaskan. Hubungi admin pusat untuk proses penambahan profil investasi Anda.
          </p>
        </div>
      ) : (
        <>
          {/* KPI Cards styled exactly like Owner Dashboard */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* Omzet Card */}
            <div className="bg-white p-6 rounded-2xl border border-suka-gray-200 shadow-sm flex flex-col justify-between hover:-translate-y-1 transition duration-200 hover:shadow-md">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-xs font-bold text-suka-gray-500 uppercase tracking-wider">Omzet Bulan Ini</p>
                  <p className="text-[10px] text-suka-gray-400 font-semibold mt-0.5">Penjualan kotor kasir</p>
                </div>
                <div className="p-2 rounded-xl" style={{ backgroundColor: '#0a7d2c10' }}>
                  <TrendingUp className="w-5 h-5" style={{ color: '#0a7d2c' }} />
                </div>
              </div>
              <div className="mt-6 flex items-baseline justify-between gap-2">
                <div className="truncate">
                  <h3 className="text-2xl font-extrabold text-suka-brown tracking-tight tabular-nums truncate">
                    Rp <CountUp end={currentOmzet} duration={1} separator="." decimals={0} />
                  </h3>
                </div>
              </div>
            </div>

            {/* Investasi Card */}
            <div className="bg-white p-6 rounded-2xl border border-suka-gray-200 shadow-sm flex flex-col justify-between hover:-translate-y-1 transition duration-200 hover:shadow-md">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-xs font-bold text-suka-gray-500 uppercase tracking-wider">Nilai Investasi</p>
                  <p className="text-[10px] text-suka-gray-400 font-semibold mt-0.5">Total modal awal</p>
                </div>
                <div className="p-2 rounded-xl" style={{ backgroundColor: '#70160410' }}>
                  <DollarSign className="w-5 h-5" style={{ color: '#701604' }} />
                </div>
              </div>
              <div className="mt-6 flex items-baseline justify-between gap-2">
                <div className="truncate">
                  <h3 className="text-2xl font-extrabold text-suka-brown tracking-tight tabular-nums truncate">
                    Rp <CountUp end={currentInvestasi} duration={1} separator="." decimals={0} />
                  </h3>
                </div>
              </div>
            </div>

            {/* ROI Card */}
            <div className="bg-white p-6 rounded-2xl border border-suka-gray-200 shadow-sm flex flex-col justify-between hover:-translate-y-1 transition duration-200 hover:shadow-md">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-xs font-bold text-suka-gray-500 uppercase tracking-wider">ROI Bulan Ini</p>
                  <p className="text-[10px] text-suka-gray-400 font-semibold mt-0.5">Rasio omzet vs investasi</p>
                </div>
                <div className="p-2 rounded-xl" style={{ backgroundColor: '#f2974410' }}>
                  <TrendingUp className="w-5 h-5" style={{ color: '#f29744' }} />
                </div>
              </div>
              <div className="mt-6 flex items-baseline justify-between gap-2">
                <div className="truncate">
                  <h3 className="text-2xl font-extrabold text-suka-brown tracking-tight tabular-nums truncate">
                    <CountUp end={currentRoi} duration={1} separator="." decimals={2} decimal="," />%
                  </h3>
                </div>
              </div>
            </div>
          </div>

          {/* Details Wrapper */}
          {selectedOutlet && (
            <div className="mt-2">
              <MitraOutletDetails 
                outlet={selectedOutlet}
                userId={mitra.user_id}
              />
            </div>
          )}
        </>
      )}
    </div>
  )
}
