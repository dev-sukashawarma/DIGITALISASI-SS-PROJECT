'use client'

import React from 'react'
import { Wallet, TrendingUp, AlertTriangle, CheckCircle2, ShieldAlert } from 'lucide-react'
import type { OutletBudgetSummaryItem } from '@/types/budgetMonitoring'

interface Props {
  outlets: OutletBudgetSummaryItem[]
}

function formatRupiah(val: number): string {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(val)
}

export function OutletBudgetSummaryCards({ outlets }: Props) {
  const totalNominal = outlets.reduce((sum, o) => sum + (o.hasConfig ? o.nominal : 0), 0)
  const totalTerpakai = outlets.reduce((sum, o) => sum + o.terpakai, 0)
  const totalSisa = outlets.reduce((sum, o) => sum + (o.hasConfig ? o.sisa : 0), 0)

  const configuredOutlets = outlets.filter((o) => o.hasConfig)
  const overBudgetCount = configuredOutlets.filter((o) => o.percentage > 100).length
  const warningCount = configuredOutlets.filter((o) => o.percentage >= 80 && o.percentage <= 100).length
  const safeCount = configuredOutlets.filter((o) => o.percentage < 80).length
  const unconfiguredCount = outlets.length - configuredOutlets.length

  const avgPercentage = totalNominal > 0 ? (totalTerpakai / totalNominal) * 100 : 0

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 mb-6">
      {/* 1. Total Alokasi Plafon */}
      <div className="bg-white border border-suka-brown/10 rounded-2xl p-4 shadow-2xs flex items-center gap-3.5">
        <div className="w-11 h-11 rounded-xl bg-suka-orange/10 flex items-center justify-center text-suka-orange shrink-0">
          <Wallet className="w-5 h-5" />
        </div>
        <div className="min-w-0">
          <p className="text-[11px] font-bold text-suka-brown/60 uppercase tracking-wider">Total Alokasi Plafon</p>
          <p className="text-lg font-black text-suka-brown tracking-tight truncate">{formatRupiah(totalNominal)}</p>
          <p className="text-[10px] text-suka-brown/50 font-medium mt-0.5">
            {configuredOutlets.length} dari {outlets.length} outlet terpasang
          </p>
        </div>
      </div>

      {/* 2. Total Realisasi Belanja */}
      <div className="bg-white border border-suka-brown/10 rounded-2xl p-4 shadow-2xs flex items-center gap-3.5">
        <div className="w-11 h-11 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-600 shrink-0">
          <TrendingUp className="w-5 h-5" />
        </div>
        <div className="min-w-0">
          <p className="text-[11px] font-bold text-suka-brown/60 uppercase tracking-wider">Total Belanja Terpakai</p>
          <p className="text-lg font-black text-amber-700 tracking-tight truncate">{formatRupiah(totalTerpakai)}</p>
          <p className="text-[10px] text-amber-600/80 font-bold mt-0.5">
            Rata-rata: {avgPercentage.toFixed(1)}% terpakai
          </p>
        </div>
      </div>

      {/* 3. Total Sisa Saldo Tersedia */}
      <div className="bg-white border border-suka-brown/10 rounded-2xl p-4 shadow-2xs flex items-center gap-3.5">
        <div className="w-11 h-11 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-600 shrink-0">
          <CheckCircle2 className="w-5 h-5" />
        </div>
        <div className="min-w-0">
          <p className="text-[11px] font-bold text-suka-brown/60 uppercase tracking-wider">Total Sisa Saldo</p>
          <p className="text-lg font-black text-emerald-700 tracking-tight truncate">{formatRupiah(totalSisa)}</p>
          <p className="text-[10px] text-emerald-600/80 font-bold mt-0.5">
            {safeCount} outlet status aman
          </p>
        </div>
      </div>

      {/* 4. Peringatan Status Outlet */}
      <div className="bg-white border border-suka-brown/10 rounded-2xl p-4 shadow-2xs flex items-center gap-3.5">
        <div
          className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${
            overBudgetCount > 0 ? 'bg-red-500/10 text-red-600' : 'bg-suka-cream text-suka-brown/70'
          }`}
        >
          {overBudgetCount > 0 ? <ShieldAlert className="w-5 h-5" /> : <AlertTriangle className="w-5 h-5" />}
        </div>
        <div className="min-w-0">
          <p className="text-[11px] font-bold text-suka-brown/60 uppercase tracking-wider">Status Pemantauan</p>
          <div className="flex items-center gap-2 mt-0.5">
            {overBudgetCount > 0 && (
              <span className="text-xs font-black text-red-600 bg-red-50 px-2 py-0.5 rounded-md">
                {overBudgetCount} Over
              </span>
            )}
            {warningCount > 0 && (
              <span className="text-xs font-black text-amber-700 bg-amber-50 px-2 py-0.5 rounded-md">
                {warningCount} Waspada
              </span>
            )}
            {overBudgetCount === 0 && warningCount === 0 && (
              <span className="text-xs font-black text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md">
                Semua Normal
              </span>
            )}
          </div>
          {unconfiguredCount > 0 && (
            <p className="text-[10px] text-suka-brown/50 font-medium mt-1">
              {unconfiguredCount} outlet belum diatur plafon
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
