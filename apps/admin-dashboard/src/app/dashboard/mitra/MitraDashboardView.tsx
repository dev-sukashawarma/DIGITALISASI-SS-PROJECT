'use client'

import { useState, useEffect } from 'react'
import { MitraOutletDetails } from './MitraOutletDetails'
import { PageHeader } from '@/components/ui'
import CountUp from 'react-countup'
import { TrendingUp, DollarSign, Store } from 'lucide-react'
import { deltaPct } from '@/lib/format'
import dynamic from 'next/dynamic'

const RevenueTrendChart = dynamic(
  () => import('@/components/RevenueTrendChart').then((m) => m.RevenueTrendChart),
  { ssr: false, loading: () => <div className="h-64 bg-white rounded-2xl border border-suka-gray-200 animate-pulse" /> }
)

export function MitraDashboardView({ 
  mitra, 
  outlets, 
  investasiMap,
  curKpiRows,
  prevKpiRows
}: any) {
  const [selectedOutletId, setSelectedOutletId] = useState<string | null>(
    outlets.length > 0 ? outlets[0].id : null
  )
  
  useEffect(() => {
    if (outlets.length > 0 && !selectedOutletId) {
      setSelectedOutletId(outlets[0].id)
    }
  }, [outlets, selectedOutletId])
  
  const selectedOutlet = outlets.find((o: any) => o.id === selectedOutletId)
  
  // Hitung Nilai Investasi
  const currentInvestasi = selectedOutletId ? (investasiMap[selectedOutletId] || 0) : 0
  
  // Filter baris performa hanya untuk outlet yang dipilih
  const curOutletKpi = curKpiRows.filter((r: any) => r.outlet_id === selectedOutletId)
  const currentOmzet = curOutletKpi.reduce((sum: number, r: any) => sum + r.omzet, 0)
  
  const prevOutletKpi = prevKpiRows.filter((r: any) => r.outlet_id === selectedOutletId)
  const prevOmzet = prevOutletKpi.reduce((sum: number, r: any) => sum + r.omzet, 0)
  
  const currentRoi = currentInvestasi > 0 ? (currentOmzet / currentInvestasi) * 100 : 0
  const prevRoi = currentInvestasi > 0 ? (prevOmzet / currentInvestasi) * 100 : 0
  
  const dOmzet = deltaPct(currentOmzet, prevOmzet)
  const dRoi = deltaPct(currentRoi, prevRoi)
  
  // BEP Progress Bar (Maksimal 100% untuk visual bar, tapi ROI bisa > 100)
  const bepPercentage = Math.min(currentRoi, 100)
  
  const renderDelta = (delta: number | null) => {
    if (delta === null || delta === 0 || delta === undefined) return null
    const isPositive = delta > 0
    return (
      <span 
        className={`text-xs px-2.5 py-0.5 rounded-full font-bold flex items-center gap-1 ${
          isPositive ? 'text-suka-green bg-green-50' : 'text-red-700 bg-red-50'
        }`}
      >
        {isPositive ? '-' : '-'} {Math.abs(delta).toLocaleString('id-ID', { maximumFractionDigits: 1 })}%
      </span>
    )
  }

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
          {/* KPI Cards */}
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
                {renderDelta(dOmzet)}
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
              <div className="mt-6 flex flex-col gap-3">
                <h3 className="text-2xl font-extrabold text-suka-brown tracking-tight tabular-nums truncate">
                  Rp <CountUp end={currentInvestasi} duration={1} separator="." decimals={0} />
                </h3>
                
                {/* Visual Indicator of BEP Progress */}
                <div className="w-full">
                  <div className="flex justify-between text-[10px] font-bold text-suka-gray-500 mb-1">
                    <span>Progres BEP</span>
                    <span>{bepPercentage.toFixed(1)}%</span>
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-1.5 overflow-hidden">
                    <div 
                      className={`h-1.5 rounded-full transition-all duration-1000 ease-out ${
                        bepPercentage >= 100 ? 'bg-suka-green' : 'bg-suka-orange'
                      }`}
                      style={{ width: `${bepPercentage}%` }}
                    ></div>
                  </div>
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
                {renderDelta(dRoi)}
              </div>
            </div>
          </div>
          
          {/* Chart Section */}
          <div className="mt-4">
             <RevenueTrendChart 
                rows={curOutletKpi} 
                isHourly={false} 
             />
          </div>

          {/* Details Tabs */}
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
