'use client'

import CountUp from 'react-countup'
import { TrendingUp, DollarSign, Store, Activity, ShoppingBag, Clock, CheckCircle } from 'lucide-react'
import { deltaPct } from '@/lib/format'
import dynamic from 'next/dynamic'
// @ts-ignore
import { TopMenus } from '@/components/TopMenus'
import OrderSourceBadge from '@/components/OrderSourceBadge'

import { useRouter } from 'next/navigation'
import type { PeriodFilterValue } from '@/lib/types'
import { PeriodFilter } from '@/components/PeriodFilter'

import { useMitraOutlet } from './MitraOutletContext'
import { TabInfoOutlet } from './MitraOutletInfo'

const RevenueTrendChart = dynamic(
  () => import('@/components/RevenueTrendChart').then((m) => m.RevenueTrendChart),
  { ssr: false, loading: () => <div className="h-64 bg-white rounded-2xl border border-suka-gray-200 animate-pulse" /> }
)

const ProfitLoss = dynamic(
  () => import('./MitraProfitLossMockup').then((m) => m.MitraProfitLossMockup),
  { ssr: false }
)


export function MitraDashboardView({ 
  mitra, 
  outlets,
  investasiMap,
  curKpiRows,
  prevKpiRows,
  hppMap,
  expenses,
  currentFilter,
  topMenus = [],
  recentOrders = []
}: any) {
  const router = useRouter()
  const { selectedOutlet, selectedOutletId, setSelectedOutletId } = useMitraOutlet()
  
  const handleFilterChange = (newFilter: PeriodFilterValue) => {
    const params = new URLSearchParams()
    if (newFilter.from) params.set('from', newFilter.from)
    if (newFilter.to) params.set('to', newFilter.to)
    // We ignore newFilter.outletId because we have our own dropdown in Context
    router.push(`?${params.toString()}`)
  }
  
  // Hitung Nilai Investasi
  const currentInvestasi = selectedOutletId && selectedOutletId !== 'all' ? (investasiMap[selectedOutletId] || 0) : 0
  
  // Filter baris performa hanya untuk outlet yang dipilih
  const curOutletKpi = selectedOutletId === 'all' ? curKpiRows : curKpiRows.filter((r: any) => r.outlet_id === selectedOutletId)
  const currentOmzet = curOutletKpi.reduce((sum: number, r: any) => sum + r.omzet, 0)
  
  const prevOutletKpi = selectedOutletId === 'all' ? prevKpiRows : prevKpiRows.filter((r: any) => r.outlet_id === selectedOutletId)
  const prevOmzet = prevOutletKpi.reduce((sum: number, r: any) => sum + r.omzet, 0)
  
  const currentRoi = currentInvestasi > 0 ? (currentOmzet / currentInvestasi) * 100 : 0
  const prevRoi = currentInvestasi > 0 ? (prevOmzet / currentInvestasi) * 100 : 0
  
  const dOmzet = deltaPct(currentOmzet, prevOmzet)
  const dRoi = deltaPct(currentRoi, prevRoi)
  
  const bepPercentage = Math.min(currentRoi, 100)
  
  const renderDelta = (delta: number | null) => {
    if (delta === null) return null
    const isUp = delta > 0
    return (
      <span className={`inline-flex items-center text-xs font-bold ${isUp ? 'text-green-500' : 'text-red-500'}`}>
        {isUp ? <TrendingUp className="w-3 h-3 mr-1" /> : <TrendingUp className="w-3 h-3 mr-1 rotate-180" />}
        {Math.abs(delta).toFixed(1)}% vs lalu
      </span>
    )
  }

  return (
    <div className="min-h-screen bg-[#fafafa]">
      {/* Premium Glassmorphic Background Elements */}
      <div className="fixed top-0 left-0 w-full h-[500px] bg-gradient-to-br from-suka-orange/10 via-suka-brown/5 to-transparent pointer-events-none" />
      <div className="fixed top-[-20%] left-[-10%] w-[50%] h-[50%] rounded-full bg-suka-orange/20 blur-[120px] pointer-events-none" />
      <div className="fixed top-[20%] right-[-10%] w-[40%] h-[40%] rounded-full bg-suka-brown/10 blur-[120px] pointer-events-none" />

      <div className="max-w-7xl mx-auto space-y-8 p-4 sm:p-6 lg:p-8 relative z-10 animate-fade-in">
        
        {/* Hero Section with Glassmorphism */}
        <div className="bg-white/70 backdrop-blur-xl border border-white p-8 rounded-[32px] shadow-xl shadow-suka-orange/5 flex flex-col md:flex-row justify-between items-start md:items-center gap-6 relative">
          <div className="absolute inset-0 rounded-[32px] overflow-hidden pointer-events-none -z-10">
            <div className="absolute top-0 right-0 w-64 h-64 bg-suka-orange/10 rounded-full blur-[60px] translate-x-1/2 -translate-y-1/2"></div>
          </div>
          
          <div className="space-y-2">
            <div className="flex items-center gap-3 mb-2">
              <span className="inline-flex items-center justify-center px-3 py-1 rounded-full bg-suka-orange/10 text-suka-orange text-xs font-black uppercase tracking-widest border border-suka-orange/20">
                <span className="w-1.5 h-1.5 rounded-full bg-suka-orange mr-2 animate-pulse"></span>
                Portal Kemitraan
              </span>
            </div>
            <h1 className="text-3xl md:text-4xl font-black text-suka-brown tracking-tighter">
              Halo, <span className="text-suka-orange drop-shadow-sm">
                {(() => {
                  const nameStr = (mitra.nama_lengkap || '').toLowerCase()
                  if (nameStr.includes('cibinong')) return 'Ibu Sofie'
                  if (nameStr.includes('sentul')) return 'Bapak Safiq'
                  if (nameStr.includes('paledang')) return 'Bapak Anis'
                  if (nameStr.includes('ciseeng')) return 'Bapak Ali'
                  if (nameStr.includes('pekayon')) return 'Bapak Cesar'
                  if (nameStr.includes('kalisari')) return 'Ibu Yana'
                  if (nameStr.includes('cibubur')) return 'Bapak Abidzar'
                  if (nameStr.includes('cicurug')) return 'Ibu Surayah'
                  if (nameStr.includes('cileungsi')) return 'Ibu Wati'
                  
                  return `Ibu/Bapak ${mitra.nama_lengkap || 'Mitra'}`
                })()}
              </span> 👋
            </h1>
            <p className="text-suka-gray-500 font-medium">
              Pantau performa dan ringkasan investasi outlet Anda secara real-time.
            </p>
          </div>
          
          {/* Outlet Selector (Floating Glass Button Style) */}
          {outlets && outlets.length > 0 && (
            <div className="w-full md:w-auto relative group">
              <div className="absolute -inset-1 bg-gradient-to-r from-suka-orange to-suka-brown rounded-2xl blur opacity-20 group-hover:opacity-40 transition duration-500"></div>
              <div className="relative bg-white/80 backdrop-blur-md rounded-2xl border border-white shadow-sm p-2 flex items-center">
                <div className="p-2 bg-suka-orange/10 rounded-xl mr-3">
                  <Store className="w-5 h-5 text-suka-orange" />
                </div>
                <select 
                  className="bg-transparent text-sm font-extrabold text-suka-brown outline-none cursor-pointer pr-8 appearance-none"
                  value={selectedOutletId || ''}
                  onChange={(e) => setSelectedOutletId(e.target.value)}
                >
                  <option value="all">Semua Outlet</option>
                  {outlets.map((o: any) => (
                    <option key={o.id} value={o.id} className="font-medium text-slate-700">
                      Outlet: {o.name}
                    </option>
                  ))}
                </select>
                <div className="absolute right-3 pointer-events-none">
                  <svg className="w-4 h-4 text-suka-orange" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M19 9l-7 7-7-7"></path></svg>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Global Filter Date Section */}
        <div className="flex flex-col sm:flex-row items-center gap-2 justify-end mb-4 relative z-50">
          <PeriodFilter 
            value={currentFilter} 
            onChange={handleFilterChange} 
            outlets={[]} // We disable the builtin outlet dropdown
            lockedOutletId="all" // lock outlet logic since we use a custom one
            hideSource 
          />
        </div>

        {!outlets || outlets.length === 0 ? (
          <div className="bg-white/70 backdrop-blur-md rounded-[32px] p-12 text-center border border-white shadow-xl shadow-suka-orange/5 animate-fade-in">
             <div className="bg-suka-orange/10 w-24 h-24 rounded-full flex items-center justify-center mx-auto mb-6 shadow-inner">
              <Store className="w-12 h-12 text-suka-orange" />
            </div>
            <h3 className="text-2xl font-extrabold text-suka-brown mb-3">Belum Ada Outlet Aktif</h3>
            <p className="text-suka-gray-500 max-w-md mx-auto font-medium text-base leading-relaxed">
              Profil investasi Anda saat ini belum dikaitkan dengan outlet mana pun. Silakan hubungi admin pusat untuk proses setup awal.
            </p>
          </div>
        ) : (
          <div className="space-y-8">
            
            {/* Info Cards Moved to Top */}
            {selectedOutlet && (
              <TabInfoOutlet outlet={selectedOutlet} />
            )}

            {/* KPI Cards - Glassmorphism Style */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              
              {/* Omzet Card */}
              <div className="group bg-white/70 backdrop-blur-md p-6 sm:p-8 rounded-[32px] border border-white shadow-xl shadow-suka-orange/5 flex flex-col justify-between hover:-translate-y-2 transition-all duration-300 hover:shadow-2xl hover:shadow-suka-orange/10 hover:bg-white/90 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-green-100/30 rounded-bl-full -z-10 group-hover:scale-125 transition-transform duration-500"></div>
                <div className="flex justify-between items-start mb-6">
                  <div>
                    <p className="text-xs font-extrabold text-suka-gray-400 uppercase tracking-widest">Omzet Bulan Ini</p>
                    <p className="text-[10px] text-suka-gray-400 font-semibold mt-1">Penjualan kotor keseluruhan</p>
                  </div>
                  <div className="p-3 rounded-2xl bg-gradient-to-br from-green-50 to-green-100/50 border border-green-100 shadow-sm group-hover:rotate-12 transition-transform duration-300">
                    <TrendingUp className="w-6 h-6 text-suka-green" />
                  </div>
                </div>
                <div className="mt-auto flex flex-col gap-3">
                  <h3 className="text-3xl lg:text-[2rem] font-black text-suka-brown tracking-tighter tabular-nums drop-shadow-sm break-all leading-none">
                    Rp <CountUp end={currentOmzet} duration={1.5} separator="." decimals={0} />
                  </h3>
                  <div className="mt-1">
                    {renderDelta(dOmzet)}
                  </div>
                </div>
              </div>

              {/* Investasi Card */}
              <div className="group bg-white/70 backdrop-blur-md p-6 sm:p-8 rounded-[32px] border border-white shadow-xl shadow-suka-orange/5 flex flex-col justify-between hover:-translate-y-2 transition-all duration-300 hover:shadow-2xl hover:shadow-suka-orange/10 hover:bg-white/90 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-red-100/30 rounded-bl-full -z-10 group-hover:scale-125 transition-transform duration-500"></div>
                <div className="flex justify-between items-start mb-6">
                  <div>
                    <p className="text-xs font-extrabold text-suka-gray-400 uppercase tracking-widest">Nilai Investasi</p>
                    <p className="text-[10px] text-suka-gray-400 font-semibold mt-1">Total modal disetor</p>
                  </div>
                  <div className="p-3 rounded-2xl bg-gradient-to-br from-red-50 to-red-100/50 border border-red-100 shadow-sm group-hover:scale-110 transition-transform duration-300">
                    <DollarSign className="w-6 h-6 text-suka-brown" />
                  </div>
                </div>
                <div className="mt-auto flex flex-col gap-4">
                  <h3 className="text-3xl lg:text-[2rem] font-black text-suka-brown tracking-tighter tabular-nums drop-shadow-sm break-all leading-none">
                    Rp <CountUp end={currentInvestasi} duration={1.5} separator="." decimals={0} />
                  </h3>
                  
                  {/* Visual Indicator of BEP Progress */}
                  <div className="w-full relative group/bep">
                    <div className="flex justify-between items-end text-[10px] font-extrabold text-suka-gray-500 mb-2 uppercase tracking-wider">
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
                <div className="flex justify-between items-start mb-6">
                  <div>
                    <p className="text-xs font-extrabold text-suka-gray-400 uppercase tracking-widest">ROI Aktual</p>
                    <p className="text-[10px] text-suka-gray-400 font-semibold mt-1">Rasio pengembalian modal</p>
                  </div>
                  <div className="p-3 rounded-2xl bg-gradient-to-br from-orange-50 to-orange-100/50 border border-orange-100 shadow-sm group-hover:rotate-12 transition-transform duration-300">
                    <Activity className="w-6 h-6 text-suka-orange" />
                  </div>
                </div>
                <div className="mt-auto flex flex-col gap-3">
                  <h3 className="text-3xl lg:text-[2rem] font-black text-suka-brown tracking-tighter tabular-nums drop-shadow-sm break-all leading-none">
                    <CountUp end={currentRoi} duration={1.5} separator="." decimals={2} decimal="," />%
                  </h3>
                  <div className="mt-1">
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


            {/* Laporan Laba Rugi Section */}
            <ProfitLoss realData={{
              outletName: selectedOutlet?.name || 'Semua Outlet',
              curOutletKpi,
              hppRate: hppMap ? (hppMap[selectedOutletId] || 45) : 45,
              expenses: expenses ? (selectedOutletId === 'all' ? expenses : expenses.filter((e: any) => e.outlet_id === selectedOutletId)) : [],
              currentFilter // Pass current filter down to check the date
            }} />
          </div>
        )}
      </div>
    </div>
  )
}
