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
  
  const bepPercentage = Math.min(currentRoi, 100)
  
  const renderDelta = (delta: number | null) => {
    if (delta === null || delta === 0 || delta === undefined) return null
    const isPositive = delta > 0
    return (
      <span 
        className={`text-xs px-2.5 py-1 rounded-full font-bold flex items-center gap-1 shadow-sm backdrop-blur-md ${
          isPositive ? 'text-suka-green bg-green-100/80 border border-green-200' : 'text-red-700 bg-red-100/80 border border-red-200'
        }`}
      >
        {isPositive ? '↑' : '↓'} {Math.abs(delta).toLocaleString('id-ID', { maximumFractionDigits: 1 })}%
      </span>
    )
  }

  return (
    <div className="relative min-h-screen pb-12 w-full max-w-[1600px] mx-auto animate-fade-in">
      
      {/* Decorative Premium Background Elements */}
      <div className="absolute top-0 inset-x-0 h-[400px] bg-gradient-to-br from-suka-orange/10 via-suka-orange/5 to-transparent rounded-b-[40px] pointer-events-none -z-10" />
      <div className="absolute top-[-10%] left-[-10%] w-[500px] h-[500px] bg-suka-orange/10 rounded-full blur-3xl pointer-events-none -z-10" />
      <div className="absolute top-[10%] right-[-5%] w-[400px] h-[400px] bg-suka-brown/5 rounded-full blur-3xl pointer-events-none -z-10" />

      <div className="p-4 sm:p-6 lg:p-8 space-y-8">
        
        {/* Header Section (Re-layout) */}
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 relative z-10">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/60 backdrop-blur-md border border-white shadow-sm mb-4">
              <span className="w-2 h-2 rounded-full bg-suka-green animate-pulse"></span>
              <span className="text-xs font-bold text-suka-gray-500 uppercase tracking-wider">Mitra Investor Portal</span>
            </div>
            <h1 className="text-3xl sm:text-4xl font-extrabold text-suka-brown tracking-tight mb-2">
              Selamat datang, <span className="text-suka-orange">{mitra.nama_mitra}</span>.
            </h1>
            <p className="text-sm sm:text-base text-suka-gray-500 max-w-2xl font-medium">
              Pantau performa harian outlet Anda, analisis tren penjualan, dan tingkatkan nilai pengembalian investasi (ROI) secara *real-time*.
            </p>
          </div>

          {outlets.length > 0 && (
            <div className="flex flex-col gap-1.5 bg-white/40 backdrop-blur-md p-2 rounded-2xl border border-white/60 shadow-sm shrink-0">
              <label className="text-[10px] font-extrabold text-suka-gray-500 uppercase tracking-wider px-2">Outlet Terpilih</label>
              <div className="relative">
                <select
                  value={selectedOutletId || ''}
                  onChange={(e) => setSelectedOutletId(e.target.value)}
                  className="w-full sm:w-64 appearance-none pl-4 pr-10 py-3 bg-white/80 backdrop-blur-lg border border-white/60 rounded-xl text-sm font-extrabold text-suka-brown focus:ring-2 focus:ring-suka-orange focus:border-suka-orange outline-none cursor-pointer transition-all hover:bg-white hover:shadow-md"
                >
                  {outlets.map((outlet: any) => (
                    <option key={outlet.id} value={outlet.id}>
                      {outlet.name}
                    </option>
                  ))}
                </select>
                <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
                  <Store className="w-4 h-4 text-suka-orange" />
                </div>
              </div>
            </div>
          )}
        </div>
        
        {outlets.length === 0 ? (
          <div className="bg-white/70 backdrop-blur-md border border-white/80 rounded-[32px] p-16 text-center shadow-xl shadow-suka-orange/5 max-w-3xl mx-auto mt-12 relative z-10">
            <div className="bg-gradient-to-br from-suka-orange/20 to-suka-orange/5 w-24 h-24 rounded-full flex items-center justify-center mx-auto mb-6 shadow-inner">
              <Store className="w-12 h-12 text-suka-orange" />
            </div>
            <h3 className="text-2xl font-extrabold text-suka-brown mb-3">Belum Ada Outlet Aktif</h3>
            <p className="text-suka-gray-500 max-w-md mx-auto font-medium text-base leading-relaxed">
              Profil investasi Anda saat ini belum dikaitkan dengan outlet mana pun. Silakan hubungi admin pusat untuk proses setup awal.
            </p>
          </div>
        ) : (
          <div className="space-y-8 relative z-10">
            {/* KPI Cards - Glassmorphism Style */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              
              {/* Omzet Card */}
              <div className="group bg-white/70 backdrop-blur-md p-6 sm:p-8 rounded-[32px] border border-white shadow-xl shadow-suka-orange/5 flex flex-col justify-between hover:-translate-y-2 transition-all duration-300 hover:shadow-2xl hover:shadow-suka-orange/10 hover:bg-white/90 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-green-100/30 rounded-bl-full -z-10 group-hover:scale-125 transition-transform duration-500"></div>
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-xs font-extrabold text-suka-gray-400 uppercase tracking-widest">Omzet Bulan Ini</p>
                    <p className="text-[10px] text-suka-gray-400 font-semibold mt-1">Penjualan kotor keseluruhan</p>
                  </div>
                  <div className="p-3 rounded-2xl bg-gradient-to-br from-green-50 to-green-100/50 border border-green-100 shadow-sm group-hover:rotate-12 transition-transform duration-300">
                    <TrendingUp className="w-6 h-6 text-suka-green" />
                  </div>
                </div>
                <div className="mt-8 flex items-end justify-between gap-3">
                  <div className="truncate">
                    <h3 className="text-3xl lg:text-4xl font-black text-suka-brown tracking-tighter tabular-nums truncate drop-shadow-sm">
                      Rp <CountUp end={currentOmzet} duration={1.5} separator="." decimals={0} />
                    </h3>
                  </div>
                  <div className="shrink-0 mb-1">
                    {renderDelta(dOmzet)}
                  </div>
                </div>
              </div>

              {/* Investasi Card */}
              <div className="group bg-white/70 backdrop-blur-md p-6 sm:p-8 rounded-[32px] border border-white shadow-xl shadow-suka-orange/5 flex flex-col justify-between hover:-translate-y-2 transition-all duration-300 hover:shadow-2xl hover:shadow-suka-orange/10 hover:bg-white/90 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-red-100/30 rounded-bl-full -z-10 group-hover:scale-125 transition-transform duration-500"></div>
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-xs font-extrabold text-suka-gray-400 uppercase tracking-widest">Nilai Investasi</p>
                    <p className="text-[10px] text-suka-gray-400 font-semibold mt-1">Total modal disetor</p>
                  </div>
                  <div className="p-3 rounded-2xl bg-gradient-to-br from-red-50 to-red-100/50 border border-red-100 shadow-sm group-hover:scale-110 transition-transform duration-300">
                    <DollarSign className="w-6 h-6 text-suka-brown" />
                  </div>
                </div>
                <div className="mt-8 flex flex-col gap-4">
                  <h3 className="text-3xl lg:text-4xl font-black text-suka-brown tracking-tighter tabular-nums truncate drop-shadow-sm">
                    Rp <CountUp end={currentInvestasi} duration={1.5} separator="." decimals={0} />
                  </h3>
                  
                  {/* Visual Indicator of BEP Progress */}
                  <div className="w-full relative group/bep">
                    <div className="flex justify-between text-[10px] font-extrabold text-suka-gray-500 mb-2 uppercase tracking-wider">
                      <span>Progres Balik Modal</span>
                      <span className="text-suka-orange">{bepPercentage.toFixed(1)}%</span>
                    </div>
                    <div className="w-full bg-suka-gray-100/80 rounded-full h-2.5 overflow-hidden shadow-inner backdrop-blur-sm relative">
                      <div className="absolute inset-0 bg-white/20"></div>
                      <div 
                        className={`h-full rounded-full transition-all duration-[2000ms] ease-out shadow-sm ${
                          bepPercentage >= 100 ? 'bg-gradient-to-r from-suka-green/80 to-suka-green' : 'bg-gradient-to-r from-suka-orange/80 to-suka-orange'
                        }`}
                        style={{ width: `${bepPercentage}%` }}
                      >
                         <div className="w-full h-full bg-white/20 animate-pulse"></div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* ROI Card */}
              <div className="group bg-white/70 backdrop-blur-md p-6 sm:p-8 rounded-[32px] border border-white shadow-xl shadow-suka-orange/5 flex flex-col justify-between hover:-translate-y-2 transition-all duration-300 hover:shadow-2xl hover:shadow-suka-orange/10 hover:bg-white/90 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-orange-100/30 rounded-bl-full -z-10 group-hover:scale-125 transition-transform duration-500"></div>
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-xs font-extrabold text-suka-gray-400 uppercase tracking-widest">ROI Aktual</p>
                    <p className="text-[10px] text-suka-gray-400 font-semibold mt-1">Rasio pengembalian modal</p>
                  </div>
                  <div className="p-3 rounded-2xl bg-gradient-to-br from-orange-50 to-orange-100/50 border border-orange-100 shadow-sm group-hover:rotate-12 transition-transform duration-300">
                    <Activity className="w-6 h-6 text-suka-orange" />
                  </div>
                </div>
                <div className="mt-8 flex items-end justify-between gap-3">
                  <div className="truncate">
                    <h3 className="text-3xl lg:text-4xl font-black text-suka-brown tracking-tighter tabular-nums truncate drop-shadow-sm">
                      <CountUp end={currentRoi} duration={1.5} separator="." decimals={2} decimal="," />%
                    </h3>
                  </div>
                  <div className="shrink-0 mb-1">
                    {renderDelta(dRoi)}
                  </div>
                </div>
              </div>
            </div>
            
            {/* Chart Section */}
            <div className="bg-white/70 backdrop-blur-md border border-white rounded-[32px] p-6 sm:p-8 shadow-xl shadow-suka-orange/5 hover:bg-white/90 transition-colors duration-500">
               <div className="flex items-center gap-3 mb-6">
                 <div className="w-2 h-8 rounded-full bg-suka-orange"></div>
                 <h2 className="text-xl font-extrabold text-suka-brown tracking-tight">Tren Pendapatan Harian</h2>
               </div>
               <RevenueTrendChart 
                  rows={curOutletKpi} 
                  isHourly={false} 
                  className="w-full"
               />
            </div>

            {/* Details Tabs */}
            {selectedOutlet && (
              <div className="pt-4">
                <MitraOutletDetails 
                  outlet={selectedOutlet}
                  userId={mitra.user_id}
                />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
