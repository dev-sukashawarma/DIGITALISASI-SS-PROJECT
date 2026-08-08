'use client'

import { useState } from 'react'
import { Store, Smartphone, Music, ChevronRight, X, TrendingDown, TrendingUp, Briefcase } from 'lucide-react'

const formatRp = (num: number) => {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0
  }).format(num)
}

const formatDate = (dateStr?: string) => {
  if (!dateStr) return ''
  try {
    return new Intl.DateTimeFormat('id-ID', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    }).format(new Date(dateStr))
  } catch (e) {
    return dateStr
  }
}

const MANUAL_OVERRIDES: Record<string, any> = {
  'cibinong': {
    modal: 125000000,
    profitSebelumnya: 170547411,
    pengeluaran: [
      { name: 'Pengeluaran Outlet', amount: 2088008 },
      { name: 'Gaji Crew Outlet', amount: 6926414 },
      { name: 'Bonus Korlap', amount: 478000 },
      { name: 'Lembur', amount: 520905 },
      { name: 'Endorsement', amount: 1155150 },
      { name: 'PDAM', amount: 52100 },
      { name: 'PLN', amount: 395994 },
      { name: 'Internet', amount: 407850 }
    ]
  },
  'ciseeng': {
    modal: 200000000,
    profitSebelumnya: 44765786,
    pengeluaran: [
      { name: 'Pengeluaran Outlet', amount: 1075494 },
      { name: 'Gaji Crew Outlet', amount: 4036414 },
      { name: 'Bonus Korlap', amount: 198800 },
      { name: 'Lembur', amount: 31905 },
      { name: 'PLN', amount: 511300 },
      { name: 'Internet', amount: 395940 }
    ]
  },
  'citayam': {
    modal: 200000000,
    profitSebelumnya: 40153955,
    pengeluaran: [
      { name: 'Pengeluaran Outlet', amount: 1722864 },
      { name: 'Gaji Crew Outlet', amount: 2657568 },
      { name: 'Bonus Korlap', amount: 167400 },
      { name: 'Lembur', amount: 413810 },
      { name: 'Promo', amount: 704000 }
    ]
  },
  'kalisari': {
    modal: 150000000,
    profitSebelumnya: 24310366,
    pengeluaran: [
      { name: 'Pengeluaran Outlet', amount: 1109125 },
      { name: 'Gaji Crew Outlet', amount: 419271 },
      { name: 'Bonus Korlap', amount: 169600 },
      { name: 'Lembur', amount: 31905 },
      { name: 'Endorsement', amount: 598090 },
      { name: 'PLN', amount: 307000 },
      { name: 'Internet', amount: 263000 }
    ]
  },
  'kotwis': {
    modal: 125000000,
    profitSebelumnya: 0,
    pengeluaran: [
      { name: 'Pengeluaran Outlet', amount: 283121 },
      { name: 'Gaji Crew Outlet', amount: 4136538 },
      { name: 'Bonus Korlap', amount: 176400 },
      { name: 'Lembur', amount: 31905 },
      { name: 'PLN', amount: 103500 }
    ]
  },
  'pekayon': {
    modal: 220000000,
    profitSebelumnya: 64174953,
    pengeluaran: [
      { name: 'Pengeluaran Outlet', amount: 1479559 },
      { name: 'Gaji Crew Outlet', amount: 4019271 },
      { name: 'Bonus Korlap', amount: 196800 },
      { name: 'Lembur', amount: 31905 },
      { name: 'Endorsement', amount: 723090 },
      { name: 'PDAM', amount: 100000 },
      { name: 'PLN', amount: 407900 },
      { name: 'Internet', amount: 263850 }
    ]
  },
  'tebet': {
    modal: 250000000,
    profitSebelumnya: 43899003,
    pengeluaran: [
      { name: 'Pengeluaran Outlet', amount: 1244295 },
      { name: 'Gaji Crew Outlet', amount: 4019271 },
      { name: 'Bonus Korlap', amount: 197600 },
      { name: 'Lembur', amount: 31905 },
      { name: 'Endorsement', amount: 1405345 },
      { name: 'PDAM', amount: 103000 },
      { name: 'PLN', amount: 416000 },
      { name: 'Internet', amount: 263850 }
    ]
  }
}

export function MitraProfitLossMockup({ realData }: any) {
  const [activeDrilldown, setActiveDrilldown] = useState<string | null>(null)

  const { curOutletKpi = [], hppRate = 0, expenses = [], outletName = '', currentFilter = {} } = realData || {}

  let filterText = 'Semua Waktu'
  if (currentFilter.from && currentFilter.to) {
    filterText = `${formatDate(currentFilter.from)} - ${formatDate(currentFilter.to)}`
  } else if (currentFilter.from) {
    filterText = `Sejak ${formatDate(currentFilter.from)}`
  }


  const isLegacyOutlet = [
    'dramaga', 'paledang', 'ciseeng', 'pekayon', 'pajajaran', 'cibinong', 
    'sukmajaya', 'citayam', 'kalisari', 'empang', 'jatiasih', 'jatiwaringin',
    'cirendeu', 'beji', 'sawangan', 'jagakarsa', 'bnr', 'cimanggu',
    // (fallback nama lama)
    'sindang', 'yasmin', 'cikaret', 'ciomas', 'air mancur', 'bangbarung', 'tajur', 'pomad', 'semua'
  ].some(legacy => outletName.toLowerCase().includes(legacy))

  // Hanya Cibubur, Cicurug, Sentul dan setelahnya yang kena 50:50 & management fee
  const isProfitSharing = !isLegacyOutlet && outletName.toLowerCase() !== 'semua outlet'

  // Cari apakah ada data sinkronisasi manual untuk outlet ini
  const overrideKey = Object.keys(MANUAL_OVERRIDES).find(key => outletName.toLowerCase().includes(key))
  // Hanya terapkan override jika filternya adalah bulan Juni 2026 (atau tidak ada filter, untuk default, tapi lebih aman filter spesifik)
  const isJune2026 = realData.currentFilter?.from?.startsWith('2026-06')
  const overrideData = (overrideKey && isJune2026) ? MANUAL_OVERRIDES[overrideKey] : null

  // 1. Omzet (Net Revenue) & Deductions (Discounts)
  const posOmzet = curOutletKpi.filter((r: any) => r.sales_source === 'pos').reduce((sum: number, r: any) => sum + Number(r.omzet), 0)
  const posDeductions = curOutletKpi.filter((r: any) => r.sales_source === 'pos').reduce((sum: number, r: any) => sum + Number(r.total_deductions || 0), 0)
  
  const faOmzet = curOutletKpi.filter((r: any) => ['grabfood', 'gofood', 'shopeefood'].includes(r.sales_source)).reduce((sum: number, r: any) => sum + Number(r.omzet), 0)
  const faDeductions = curOutletKpi.filter((r: any) => ['grabfood', 'gofood', 'shopeefood'].includes(r.sales_source)).reduce((sum: number, r: any) => sum + Number(r.total_deductions || 0), 0)
  
  const tkOmzet = curOutletKpi.filter((r: any) => r.sales_source === 'tiktok').reduce((sum: number, r: any) => sum + Number(r.omzet), 0)
  const tkDeductions = curOutletKpi.filter((r: any) => r.sales_source === 'tiktok').reduce((sum: number, r: any) => sum + Number(r.total_deductions || 0), 0)

  // 2. Gross Revenue Per Channel (Net Revenue + Discounts)
  const outletRev = posOmzet + posDeductions
  const faRev = faOmzet + faDeductions
  const tkRev = tkOmzet + tkDeductions
  const totalRev = outletRev + faRev + tkRev

  // 3. COGS (HPP) Calculation
  // User explicitly wants to use HPP override percentage. hppRate is a percentage (e.g. 45 for 45%).
  // Default to 40% if for some reason it's 0 or missing.
  const hppPercentage = Number(hppRate) > 0 ? Number(hppRate) : 40
  const totalHppValue = totalRev * (hppPercentage / 100)

  const outletCogs = totalRev > 0 ? (outletRev / totalRev) * totalHppValue : 0
  const faCogs = totalRev > 0 ? (faRev / totalRev) * totalHppValue : 0
  const tkCogs = totalRev > 0 ? (tkRev / totalRev) * totalHppValue : 0

  // 4. Admin Fees
  // Admin fees will be uploaded manually via expenses with category 'admin'
  const adminFeeTotal = expenses.filter((e: any) => ['Admin Fee', 'admin_fee', 'Platform Fee', 'admin'].includes(e.category)).reduce((s: number, e: any) => s + Number(e.amount), 0)
  // We'll assign it to FoodApps for now since that's where most admin fees come from
  const faAdminFee = adminFeeTotal
  const tkAdminFee = 0

  // 5. Gross Profit = Net Revenue (Omzet) - COGS - Admin Fee
  const outletGross = posOmzet - outletCogs
  const faGross = faOmzet - faCogs - faAdminFee
  const tkGross = tkOmzet - tkCogs - tkAdminFee

  // Settlement (What goes to Bank Account)
  const tkSettlement = tkOmzet - tkAdminFee

  // 6. Expenses (OPEX)
  // Exclude admin fees (already in Gross Profit) and incomes
  const opexItems = expenses.filter((e: any) => !['Admin Fee', 'admin_fee', 'Platform Fee', 'admin', 'income', 'cash_in'].includes(e.category))
  
  const opexGrouped = opexItems.reduce((acc: any, e: any) => {
    let cat = e.category || 'Lainnya'
    // Normalize some categories
    if (['bb', 'bahan baku'].includes(cat.toLowerCase())) cat = 'Bahan Baku'
    if (['utilities', 'operasional'].includes(cat.toLowerCase())) cat = 'Operasional'
    if (['ads', 'marketing'].includes(cat.toLowerCase())) cat = 'Marketing'
    
    acc[cat] = (acc[cat] || 0) + Number(e.amount)
    return acc
  }, {})

  const opexCategories = overrideData
    ? overrideData.pengeluaran.map((p: any) => ({ name: p.name, amount: p.amount }))
    : Object.keys(opexGrouped)
        .map(cat => ({ name: cat, amount: opexGrouped[cat] }))
        .filter(c => c.amount > 0)
        .sort((a, b) => b.amount - a.amount)

  const expTotal = opexCategories.reduce((s: number, c: any) => s + c.amount, 0)
  
  // Management Fee (Misal: 3% dari Omzet Kotor)
  const managementFee = totalRev * 0.03
  
  const finalExpTotal = expTotal + (overrideData ? 0 : managementFee)

  // 7. Summaries
  const totalCogs = outletCogs + faCogs + tkCogs
  // @ts-ignore
const totalAdmin = faAdminFee + tkAdminFee
  const totalGrossProfit = outletGross + faGross + tkGross
  
  const totalNetProfit = totalGrossProfit - finalExpTotal
  
  // Kalau ada manual override, kita pake profit sementara dari override (kalo ada) 
  // atau biarkan 0 untuk outlet lama, karena 50:50 sudah kita hide
  const profitMitra = isProfitSharing ? (totalNetProfit > 0 ? totalNetProfit * 0.5 : 0) : 0 

  const data = {
    revenue: {
      outlet: { revenue: outletRev, cogs: outletCogs, grossProfit: outletGross },
      foodApps: { revenue: faRev, cogs: faCogs, discountMerchant: faDeductions, adminFee: faAdminFee, grossProfit: faGross },
      tiktokGo: { revenue: tkRev, cogs: tkCogs, adminFee: tkAdminFee, settlement: tkSettlement, grossProfit: tkGross, discountMerchant: tkDeductions },
      total: { revenue: totalRev, cogs: totalCogs, grossProfit: totalGrossProfit, netProfit: totalNetProfit }
    },
    expenses: {
      categories: opexCategories,
      total: expTotal,
      managementFee: overrideData ? 0 : managementFee,
      finalTotal: finalExpTotal
    },
    investment: overrideData ? {
      totalModal: overrideData.modal,
      profitSebelumnya: overrideData.profitSebelumnya,
      totalProfitSementara: profitMitra || (overrideData.profitSementara || 0),
      roi: (overrideData.profitSebelumnya / overrideData.modal) * 100
    } : {
      totalModal: 150000000,
      profitSebelumnya: 45000000,
      totalProfitSementara: profitMitra,
      roi: 32.5 // Hardcoded for mockup representation
    }
  }

  return (
    <div className="bg-white/70 backdrop-blur-xl border border-white p-6 sm:p-8 rounded-[32px] shadow-xl shadow-suka-orange/5 relative overflow-hidden mt-8 animate-fade-in">
      <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-gradient-to-br from-suka-orange/10 via-suka-brown/5 to-transparent rounded-full blur-[80px] -z-10 translate-x-1/2 -translate-y-1/2 pointer-events-none"></div>
      
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-8 gap-4">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-suka-brown/5 rounded-full mb-3 border border-suka-brown/10">
            <TrendingDown className="w-4 h-4 text-suka-orange" />
            <span className="text-xs font-bold text-suka-brown tracking-widest uppercase">Laporan Keuangan</span>
          </div>
          <h2 className="text-3xl font-black text-suka-brown tracking-tighter">Laba Rugi</h2>
          <div className="flex flex-col sm:flex-row sm:items-center gap-2 mt-2">
            <p className="text-suka-gray-500 font-medium text-sm">Estimasi perhitungan bagi hasil secara real-time</p>
            <span className="hidden sm:inline text-suka-gray-300">•</span>
            <div className="inline-flex items-center gap-1.5 bg-white border border-suka-gray-100 text-suka-gray-500 text-xs px-2.5 py-1 rounded-lg font-bold shadow-sm w-fit">
              <Store className="w-3.5 h-3.5 text-suka-orange" /> 
              {filterText}
            </div>
          </div>
        </div>
      </div>

      {/* SUMMARY ROW */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8 relative z-10">
        
        {/* Gross Profit */}
        <div className="bg-white border border-suka-gray-100 p-5 rounded-[24px] shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow">
          <div className="flex items-center gap-3 mb-4">
             <div className="w-10 h-10 rounded-[12px] bg-suka-orange/10 flex items-center justify-center text-suka-orange">
               <TrendingUp className="w-5 h-5" />
             </div>
             <h4 className="text-xs font-extrabold text-suka-gray-400 uppercase tracking-widest">Gross Profit</h4>
          </div>
          <h3 className="text-2xl font-black text-suka-brown">{formatRp(data.revenue.total.grossProfit)}</h3>
        </div>

        {/* OPEX */}
        <div className="bg-white border border-suka-gray-100 p-5 rounded-[24px] shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow">
          <div className="flex items-center gap-3 mb-4">
             <div className="w-10 h-10 rounded-[12px] bg-red-50 flex items-center justify-center text-red-500">
               <TrendingDown className="w-5 h-5" />
             </div>
             <h4 className="text-xs font-extrabold text-suka-gray-400 uppercase tracking-widest">Total OPEX</h4>
          </div>
          <h3 className="text-2xl font-black text-red-500">-{formatRp(data.expenses.total)}</h3>
        </div>

        {/* Management Fee */}
        <div className="bg-white border border-suka-gray-100 p-5 rounded-[24px] shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow">
          <div className="flex items-center gap-3 mb-4">
             <div className="w-10 h-10 rounded-[12px] bg-suka-brown/5 flex items-center justify-center text-suka-brown">
               <Briefcase className="w-5 h-5" />
             </div>
             <h4 className="text-xs font-extrabold text-suka-gray-400 uppercase tracking-widest">Mgmt Fee</h4>
          </div>
          <h3 className={`text-2xl font-black ${data.expenses.managementFee > 0 ? 'text-red-500' : 'text-suka-gray-400'}`}>
             {data.expenses.managementFee > 0 ? `-${formatRp(data.expenses.managementFee)}` : formatRp(0)}
          </h3>
        </div>

        {/* Net Profit - Highlighted */}
        <div 
          onClick={() => setActiveDrilldown('net profit')}
          className="group cursor-pointer bg-gradient-to-br from-suka-brown to-suka-ink text-white p-5 rounded-[24px] shadow-lg relative overflow-hidden flex flex-col justify-between hover:shadow-xl hover:shadow-suka-orange/20 transition-all duration-300"
        >
          <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-bl-full pointer-events-none transition-transform duration-700 group-hover:scale-110"></div>
          <div className="absolute -bottom-8 -left-8 w-24 h-24 bg-suka-orange/20 blur-xl rounded-full pointer-events-none"></div>
          
          <div className="relative z-10">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                 <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center">
                   <Store className="w-4 h-4 text-white" />
                 </div>
                 <h4 className="text-[10px] font-bold text-white/60 uppercase tracking-widest">Net Profit</h4>
              </div>
              <div className="flex items-center gap-1 text-white/50 group-hover:text-white transition-colors bg-white/5 px-2 py-1 rounded-full border border-white/5">
                <span className="text-[9px] font-bold uppercase tracking-wider">Detail</span>
                <ChevronRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
              </div>
            </div>
            <h3 className="text-3xl font-black tracking-tight drop-shadow-sm">{formatRp(data.revenue.total.netProfit)}</h3>
          </div>
        </div>

      </div>

      {/* CHANNEL BREAKDOWN ROW */}
      <div className="relative z-10 border-t border-suka-gray-100 pt-8 mt-4">
        <h3 className="text-sm font-extrabold text-suka-gray-400 uppercase tracking-widest mb-4">Gross Profit per Channel</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          
          {/* Outlet POS */}
          <div 
            onClick={() => setActiveDrilldown('outlet')}
            className="group cursor-pointer bg-gradient-to-br from-white to-suka-gray-50 border border-suka-gray-100 p-5 rounded-[24px] hover:shadow-lg hover:shadow-suka-orange/10 transition-all duration-300 flex flex-col justify-between h-full"
          >
             <div className="flex items-center gap-4 mb-4">
               <div className="w-12 h-12 rounded-[16px] bg-suka-orange/10 flex items-center justify-center text-suka-orange group-hover:scale-110 group-hover:rotate-6 transition-transform shrink-0">
                 <Store className="w-6 h-6" />
               </div>
               <div>
                 <h4 className="font-bold text-suka-brown text-sm">Outlet (POS)</h4>
                 <p className="text-[11px] text-suka-gray-500">Rev: {formatRp(data.revenue.outlet.revenue)}</p>
               </div>
             </div>
             <div className="flex items-end justify-between mt-auto">
               <span className={`font-black text-xl ${data.revenue.outlet.grossProfit < 0 ? 'text-red-500' : 'text-suka-orange'}`}>
                 {formatRp(data.revenue.outlet.grossProfit)}
               </span>
               <ChevronRight className="w-5 h-5 text-suka-gray-300 group-hover:text-suka-orange transition-colors" />
             </div>
          </div>

          {/* Food Apps */}
          <div 
            onClick={() => setActiveDrilldown('foodapps')}
            className="group cursor-pointer bg-gradient-to-br from-white to-suka-gray-50 border border-suka-gray-100 p-5 rounded-[24px] hover:shadow-lg hover:shadow-suka-orange/10 transition-all duration-300 flex flex-col justify-between h-full"
          >
             <div className="flex items-center gap-4 mb-4">
               <div className="w-12 h-12 rounded-[16px] bg-green-50 flex items-center justify-center text-green-600 group-hover:scale-110 group-hover:rotate-6 transition-transform shrink-0">
                 <Smartphone className="w-6 h-6" />
               </div>
               <div>
                 <h4 className="font-bold text-suka-brown text-sm">Food Apps</h4>
                 <p className="text-[11px] text-suka-gray-500">Rev: {formatRp(data.revenue.foodApps.revenue)}</p>
               </div>
             </div>
             <div className="flex items-end justify-between mt-auto">
               <span className={`font-black text-xl ${data.revenue.foodApps.grossProfit < 0 ? 'text-red-500' : 'text-suka-orange'}`}>
                 {formatRp(data.revenue.foodApps.grossProfit)}
               </span>
               <ChevronRight className="w-5 h-5 text-suka-gray-300 group-hover:text-suka-orange transition-colors" />
             </div>
          </div>

          {/* Tiktok */}
          <div 
            onClick={() => setActiveDrilldown('tiktok')}
            className="group cursor-pointer bg-gradient-to-br from-white to-suka-gray-50 border border-suka-gray-100 p-5 rounded-[24px] hover:shadow-lg hover:shadow-suka-orange/10 transition-all duration-300 flex flex-col justify-between h-full"
          >
             <div className="flex items-center gap-4 mb-4">
               <div className="w-12 h-12 rounded-[16px] bg-black/5 flex items-center justify-center text-black group-hover:scale-110 group-hover:rotate-6 transition-transform shrink-0">
                 <Music className="w-6 h-6" />
               </div>
               <div>
                 <h4 className="font-bold text-suka-brown text-sm">Tiktok Go</h4>
                 <p className="text-[11px] text-suka-gray-500">Rev: {formatRp(data.revenue.tiktokGo.revenue)}</p>
               </div>
             </div>
             <div className="flex items-end justify-between mt-auto">
               <span className={`font-black text-xl ${data.revenue.tiktokGo.grossProfit < 0 ? 'text-red-500' : 'text-suka-orange'}`}>
                 {formatRp(data.revenue.tiktokGo.grossProfit)}
               </span>
               <ChevronRight className="w-5 h-5 text-suka-gray-300 group-hover:text-suka-orange transition-colors" />
             </div>
          </div>

        </div>
      </div>

      {/* Drill-down Modal */}
      {activeDrilldown && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
          <div className="absolute inset-0 bg-suka-ink/40 backdrop-blur-sm" onClick={() => setActiveDrilldown(null)}></div>
          <div className="bg-white rounded-[32px] shadow-2xl w-full max-w-md relative z-10 animate-scale-in p-6 sm:p-8 border border-white">
             <button onClick={() => setActiveDrilldown(null)} className="absolute top-6 right-6 p-2 bg-suka-gray-100 rounded-full hover:bg-suka-gray-200 transition-colors">
               <X className="w-5 h-5 text-suka-gray-500" />
             </button>
             
             <h3 className="text-2xl font-black text-suka-brown mb-6 capitalize">Detail {activeDrilldown}</h3>
             
             {activeDrilldown === 'outlet' && (
               <div className="space-y-4">
                 <div className="flex justify-between p-4 bg-suka-gray-50 rounded-2xl border border-suka-gray-100"><span className="font-bold text-suka-gray-500">Gross Revenue</span><span className="font-black text-suka-ink">{formatRp(data.revenue.outlet.revenue)}</span></div>
                 <div className="flex justify-between p-3 border-b border-dashed border-suka-gray-200"><span className="font-bold text-red-400">COGS (HPP)</span><span className="font-bold text-red-500">-{formatRp(data.revenue.outlet.cogs)}</span></div>
                 <div className="flex justify-between p-3 border-b border-dashed border-suka-gray-200"><span className="font-bold text-red-400">Discount to Customer</span><span className="font-bold text-red-500">-{formatRp(data.revenue.outlet.revenue - (data.revenue.outlet.revenue - posDeductions))}</span></div>
                 <div className="flex justify-between p-4 bg-suka-orange/10 rounded-2xl border border-suka-orange/20"><span className="font-bold text-suka-brown">Gross Profit</span><span className="font-black text-suka-orange">{formatRp(data.revenue.outlet.grossProfit)}</span></div>
               </div>
             )}

             {activeDrilldown === 'foodapps' && (
               <div className="space-y-4">
                 <div className="flex justify-between p-4 bg-suka-gray-50 rounded-2xl border border-suka-gray-100"><span className="font-bold text-suka-gray-500">Gross Revenue</span><span className="font-black text-suka-ink">{formatRp(data.revenue.foodApps.revenue)}</span></div>
                 <div className="flex justify-between p-3 border-b border-dashed border-suka-gray-200"><span className="font-bold text-red-400">COGS (HPP)</span><span className="font-bold text-red-500">-{formatRp(data.revenue.foodApps.cogs)}</span></div>
                 <div className="flex justify-between p-3 border-b border-dashed border-suka-gray-200"><span className="font-bold text-red-400">Discount to Customer</span><span className="font-bold text-red-500">-{formatRp(data.revenue.foodApps.discountMerchant)}</span></div>
                 <div className="flex justify-between p-4 bg-suka-orange/10 rounded-2xl border border-suka-orange/20 mt-2"><span className="font-bold text-suka-brown">Gross Profit</span><span className="font-black text-suka-orange">{formatRp(data.revenue.foodApps.grossProfit)}</span></div>
               </div>
             )}

             {activeDrilldown === 'tiktok' && (
               <div className="space-y-4">
                 <div className="flex justify-between p-4 bg-suka-gray-50 rounded-2xl border border-suka-gray-100"><span className="font-bold text-suka-gray-500">Gross Revenue</span><span className="font-black text-suka-ink">{formatRp(data.revenue.tiktokGo.revenue)}</span></div>
                 <div className="flex justify-between p-3 border-b border-dashed border-suka-gray-200"><span className="font-bold text-red-400">COGS (HPP)</span><span className="font-bold text-red-500">-{formatRp(data.revenue.tiktokGo.cogs)}</span></div>
                 <div className="flex justify-between p-3 border-b border-dashed border-suka-gray-200"><span className="font-bold text-red-400">Discount to Customer</span><span className="font-bold text-red-500">-{formatRp(data.revenue.tiktokGo.discountMerchant)}</span></div>
                 <div className="flex justify-between p-4 bg-suka-orange/10 rounded-2xl border border-suka-orange/20 mt-2"><span className="font-bold text-suka-brown">Gross Profit</span><span className="font-black text-suka-orange">{formatRp(data.revenue.tiktokGo.grossProfit)}</span></div>
               </div>
             )}

             {activeDrilldown === 'net profit' && (
               <div className="space-y-4">
                 <div className="flex justify-between p-4 bg-suka-gray-50 rounded-2xl border border-suka-gray-100"><span className="font-bold text-suka-gray-500">Total Gross Profit</span><span className="font-black text-suka-ink">{formatRp(data.revenue.total.grossProfit)}</span></div>
                 {data.expenses.managementFee > 0 && (
                   <div className="flex justify-between p-3 border-b border-dashed border-suka-gray-200"><span className="font-bold text-red-400">Management Fee</span><span className="font-bold text-red-500">-{formatRp(data.expenses.managementFee)}</span></div>
                 )}
                 <div className="flex justify-between p-3 border-b border-dashed border-suka-gray-200"><span className="font-bold text-red-400">Total OPEX</span><span className="font-bold text-red-500">-{formatRp(data.expenses.total)}</span></div>
                 <div className="flex justify-between p-4 bg-suka-orange/10 rounded-2xl border border-suka-orange/20 mt-2"><span className="font-bold text-suka-brown">Net Profit</span><span className="font-black text-suka-orange">{formatRp(data.revenue.total.netProfit)}</span></div>
               </div>
             )}
          </div>
        </div>
      )}
    </div>
  )
}
