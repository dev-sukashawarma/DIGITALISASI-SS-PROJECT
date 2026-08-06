'use client'

import { useState } from 'react'
import { Store, Smartphone, Music, ChevronRight, X, TrendingDown } from 'lucide-react'

const formatRp = (num: number) => {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0
  }).format(num)
}

export function MitraProfitLossMockup({ realData }: any) {
  const [activeDrilldown, setActiveDrilldown] = useState<string | null>(null)

  const { curOutletKpi = [], hppRate = 0, expenses = [] } = realData || {}

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
  const totalHppValue = Number(hppRate) > 0 ? Number(hppRate) : (totalRev * 0.4)

  const outletCogs = totalRev > 0 ? (outletRev / totalRev) * totalHppValue : 0
  const faCogs = totalRev > 0 ? (faRev / totalRev) * totalHppValue : 0
  const tkCogs = totalRev > 0 ? (tkRev / totalRev) * totalHppValue : 0

  // 4. Admin Fees
  const faAdminFee = faRev * 0.20
  const tkAdminFee = tkRev * 0.03

  // 5. Gross Profit = Net Revenue (Omzet) - COGS - Admin Fee
  const outletGross = posOmzet - outletCogs
  const faGross = faOmzet - faCogs - faAdminFee
  const tkGross = tkOmzet - tkCogs - tkAdminFee

  // Settlement (What goes to Bank Account)
  const tkSettlement = tkOmzet - tkAdminFee

  // 6. Expenses
  const expGaji = expenses.filter((e: any) => ['Gaji', 'Salary', 'salary', 'overtime'].includes(e.category)).reduce((s: number, e: any) => s + Number(e.amount), 0)
  const expOpr = expenses.filter((e: any) => ['Operasional', 'Operasional Outlet', 'Modal Awal Kasir', 'Peralatan', 'outlet', 'utilities', 'bb'].includes(e.category)).reduce((s: number, e: any) => s + Number(e.amount), 0)
  const expMkt = expenses.filter((e: any) => ['Marketing', 'Iklan', 'Promo', 'ads'].includes(e.category)).reduce((s: number, e: any) => s + Number(e.amount), 0)
  const expTotal = expGaji + expOpr + expMkt

  // 7. Summaries
  const totalCogs = outletCogs + faCogs + tkCogs
  const totalAdmin = faAdminFee + tkAdminFee
  const totalGrossProfit = outletGross + faGross + tkGross
  
  const totalNetProfit = totalGrossProfit - expTotal
  const profitMitra = totalNetProfit > 0 ? totalNetProfit * 0.5 : 0

  const data = {
    revenue: {
      outlet: { revenue: outletRev, cogs: outletCogs, grossProfit: outletGross },
      foodApps: { revenue: faRev, cogs: faCogs, discountMerchant: faDeductions, adminFee: faAdminFee, grossProfit: faGross },
      tiktokGo: { revenue: tkRev, cogs: tkCogs, adminFee: tkAdminFee, settlement: tkSettlement, grossProfit: tkGross },
      total: { revenue: totalRev, cogs: totalCogs, grossProfit: totalGrossProfit, netProfit: totalNetProfit }
    },
    expenses: {
      gaji: expGaji,
      operasional: expOpr,
      marketing: expMkt,
      total: expTotal
    },
    investment: {
      totalModal: 150000000,
      profitSebelumnya: 45000000,
      totalProfitSementara: profitMitra,
      roi: 32.5
    }
  }

  return (
    <div className="bg-white/70 backdrop-blur-xl border border-white p-6 sm:p-8 rounded-[32px] shadow-xl shadow-suka-orange/5 relative overflow-hidden mt-8 animate-fade-in">
      <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-gradient-to-br from-suka-orange/10 via-suka-brown/5 to-transparent rounded-full blur-[80px] -z-10 translate-x-1/2 -translate-y-1/2 pointer-events-none"></div>
      
              <span className="text-sm font-medium text-slate-600">Sewa Outlet / Lapak</span>
              <span className="font-bold text-suka-brown">{formatRp(sewa)}</span>
            </div>
            <div className="p-4 flex justify-between items-center hover:bg-slate-50 transition-colors">
              <span className="text-sm font-medium text-slate-600">Listrik, Air & Internet</span>
              <span className="font-bold text-suka-brown">{formatRp(listrik)}</span>
            </div>
            <div className="p-4 flex justify-between items-center hover:bg-slate-50 transition-colors">
              <span className="text-sm font-medium text-slate-600">Bahan Baku Tambahan</span>
              <span className="font-bold text-suka-brown">{formatRp(bahanBaku)}</span>
            </div>
            <div className="p-4 flex justify-between items-center hover:bg-slate-50 transition-colors">
              <span className="text-sm font-medium text-slate-600">Marketing & Iklan</span>
              <span className="font-bold text-suka-brown">{formatRp(marketing)}</span>
            </div>
            <div className="p-4 flex justify-between items-center hover:bg-slate-50 transition-colors">
              <span className="text-sm font-medium text-slate-600">Lain-lain</span>
              <span className="font-bold text-suka-brown">{formatRp(lainnya)}</span>
            </div>
          </div>
          <div className="mt-3 bg-red-50 rounded-xl p-4 border border-red-100 flex justify-between items-center">
            <span className="font-semibold text-red-600">Total Pengeluaran</span>
            <span className="font-black text-red-600">-{formatRp(totalOpex)}</span>
          </div>
        </div>

        {/* Laba Bersih */}
        <div className={`mt-8 rounded-[24px] p-6 sm:p-8 flex flex-col sm:flex-row justify-between items-center gap-4 shadow-xl ${
          labaBersih >= 0 
            ? 'bg-gradient-to-br from-suka-green to-green-600 shadow-green-600/20' 
            : 'bg-gradient-to-br from-red-500 to-red-600 shadow-red-500/20'
        }`}>
          <div>
            <span className="block text-white/80 font-bold uppercase tracking-widest text-xs mb-1">Laba Bersih Outlet</span>
            <span className="block text-white/90 text-sm">Estimasi keuntungan bersih periode ini</span>
          </div>
          <span className="font-black text-white text-3xl sm:text-4xl tracking-tighter tabular-nums drop-shadow-sm">
            {formatRp(labaBersih)}
          </span>
        </div>

      </div>
    </div>
  )
}
