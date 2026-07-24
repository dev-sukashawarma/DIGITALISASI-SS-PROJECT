'use client'

import React from 'react'
import { Target, TrendingUp } from 'lucide-react'

export default function SalesMonitoringPage() {
  const currentSales = 2450000
  const targetSales = 2200000
  const percentage = Math.min((currentSales / targetSales) * 100, 100)
  const isTargetMet = currentSales >= targetSales

  const recentOrders = [
    { id: 'ORD-092', time: '14:32', items: '2x Shawarma Duo, 1x Ice Tea', total: 65000 },
    { id: 'ORD-091', time: '14:25', items: '1x Kebab Reguler', total: 18000 },
    { id: 'ORD-090', time: '14:15', items: '3x Ayam Gunting, 2x Lemon Tea', total: 95000 },
    { id: 'ORD-089', time: '14:02', items: '1x Paket Kenyang', total: 35000 },
  ]

  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto space-y-6 font-sans">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">Penjualan & Target</h1>
        <p className="text-xs sm:text-sm text-slate-500 font-medium mt-1">Pantau pencapaian target harian cabang Anda secara real-time.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Main Target Card */}
        <div className="md:col-span-2 bg-white rounded-2xl border border-slate-200 shadow-xs p-6 relative overflow-hidden">
          <div className="flex items-start justify-between mb-8 relative z-10">
            <div>
              <h2 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Total Penjualan Hari Ini</h2>
              <div className="flex flex-wrap items-baseline gap-3">
                <span className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">Rp {currentSales.toLocaleString('id-ID')}</span>
                {isTargetMet ? (
                  <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200">
                    <TrendingUp size={14} /> Target Tercapai
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-xs font-bold text-blue-700 bg-blue-50 px-2.5 py-1 rounded-lg border border-blue-200">
                    <TrendingUp size={14} /> On Track
                  </span>
                )}
              </div>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-blue-50 border border-blue-100 text-blue-600 flex items-center justify-center shrink-0">
              <Target className="w-6 h-6" />
            </div>
          </div>

          {/* Progress Bar */}
          <div className="relative z-10">
            <div className="flex justify-between text-xs font-bold text-slate-600 mb-2">
              <span>Progress Pencapaian</span>
              <span>Target: Rp {targetSales.toLocaleString('id-ID')}</span>
            </div>
            <div className="h-3.5 w-full bg-slate-100 rounded-full overflow-hidden">
              <div 
                className={`h-full rounded-full transition-all duration-1000 ${isTargetMet ? 'bg-emerald-600' : 'bg-blue-600'}`}
                style={{ width: `${percentage}%` }}
              />
            </div>
            <div className="mt-2.5 flex justify-between text-xs font-semibold text-slate-500">
              <span>0%</span>
              <span>{(percentage).toFixed(1)}%</span>
            </div>
          </div>
        </div>

        {/* Action Card - Solid Fill (0% Gradient) */}
        <div className="bg-slate-900 rounded-2xl p-6 text-white shadow-xs flex flex-col justify-between border border-slate-800">
          <div>
            <h3 className="font-bold text-base mb-1.5 text-white">Butuh bantuan capai target?</h3>
            <p className="text-slate-400 text-xs leading-relaxed font-medium">Gunakan promo flash sale atau tawarkan upsell ke customer yang datang.</p>
          </div>
          
          <button className="w-full mt-6 py-3 bg-blue-600 hover:bg-blue-700 active:scale-98 text-white rounded-xl font-bold text-xs transition-all shadow-xs text-center cursor-pointer">
            Aktifkan Promo Kilat
          </button>
        </div>
      </div>

      {/* Recent Orders List */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <h2 className="text-base font-bold text-slate-900">Transaksi Terakhir</h2>
          <span className="text-xs font-bold text-blue-600 cursor-pointer hover:underline">Lihat Semua</span>
        </div>
        <div className="divide-y divide-slate-100">
          {recentOrders.map((order, i) => (
            <div key={i} className="px-6 py-4 flex items-center justify-between hover:bg-slate-50/50 transition-colors">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center font-bold text-slate-600 text-xs shrink-0">
                  {order.time}
                </div>
                <div>
                  <h4 className="font-bold text-slate-900 text-sm">{order.id}</h4>
                  <p className="text-xs text-slate-500 mt-0.5 font-medium">{order.items}</p>
                </div>
              </div>
              <div className="font-extrabold text-slate-900 text-sm">
                + Rp {order.total.toLocaleString('id-ID')}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
