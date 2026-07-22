'use client'

import React from 'react'
import { Target, TrendingUp } from 'lucide-react'

export default function SalesMonitoringPage() {
  const currentSales = 2450000;
  const targetSales = 2200000;
  const percentage = Math.min((currentSales / targetSales) * 100, 100);
  const isTargetMet = currentSales >= targetSales;

  // Dummy recent orders
  const recentOrders = [
    { id: 'ORD-092', time: '14:32', items: '2x Shawarma Duo, 1x Ice Tea', total: 65000 },
    { id: 'ORD-091', time: '14:25', items: '1x Kebab Reguler', total: 18000 },
    { id: 'ORD-090', time: '14:15', items: '3x Ayam Gunting, 2x Lemon Tea', total: 95000 },
    { id: 'ORD-089', time: '14:02', items: '1x Paket Kenyang', total: 35000 },
  ]

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Penjualan & Target</h1>
        <p className="text-sm text-slate-500 mt-1">Pantau pencapaian target harian cabang Anda secara real-time.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Main Target Card */}
        <div className="md:col-span-2 bg-white rounded-xl border border-slate-200 shadow-sm p-6 relative overflow-hidden">
          <div className="flex items-start justify-between mb-8 relative z-10">
            <div>
              <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-1">Total Penjualan Hari Ini</h2>
              <div className="flex items-end gap-3">
                <span className="text-4xl font-extrabold text-slate-800">Rp {currentSales.toLocaleString('id-ID')}</span>
                {isTargetMet ? (
                  <span className="inline-flex items-center gap-1 text-sm font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded-md mb-1">
                    <TrendingUp size={16} /> Target Tercapai
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-sm font-bold text-blue-600 bg-blue-50 px-2 py-1 rounded-md mb-1">
                    <TrendingUp size={16} /> On Track
                  </span>
                )}
              </div>
            </div>
            <div className="w-12 h-12 rounded-full bg-blue-50 flex items-center justify-center shrink-0">
              <Target className="w-6 h-6 text-blue-600" />
            </div>
          </div>

          {/* Progress Bar */}
          <div className="relative z-10">
            <div className="flex justify-between text-xs font-semibold text-slate-500 mb-2">
              <span>Progress</span>
              <span>Target: Rp {targetSales.toLocaleString('id-ID')}</span>
            </div>
            <div className="h-4 w-full bg-slate-100 rounded-full overflow-hidden">
              <div 
                className={`h-full rounded-full transition-all duration-1000 ${isTargetMet ? 'bg-emerald-500' : 'bg-blue-500'}`}
                style={{ width: `${percentage}%` }}
              ></div>
            </div>
            <div className="mt-3 flex justify-between text-xs font-medium text-slate-400">
              <span>0</span>
              <span>{(percentage).toFixed(1)}%</span>
            </div>
          </div>
          
          {/* Decorative background element */}
          <div className="absolute right-0 bottom-0 opacity-[0.03] pointer-events-none transform translate-x-1/4 translate-y-1/4">
            <Target size={250} />
          </div>
        </div>

        {/* Action / Suggestion Card */}
        <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-xl p-6 text-white shadow-md flex flex-col">
          <h3 className="font-bold text-lg mb-2 text-white">Butuh bantuan capai target?</h3>
          <p className="text-slate-300 text-sm mb-6 flex-1">Gunakan promo flash sale atau tawarkan upsell ke customer yang datang.</p>
          
          <button className="w-full py-2.5 bg-white text-slate-900 rounded-lg font-semibold text-sm hover:bg-slate-50 transition-colors">
            Aktifkan Promo Kilat
          </button>
        </div>
      </div>

      {/* Recent Orders List */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-800">Transaksi Terakhir</h2>
          <span className="text-sm font-medium text-blue-600 cursor-pointer hover:underline">Lihat Semua</span>
        </div>
        <div className="divide-y divide-slate-100">
          {recentOrders.map((order, i) => (
            <div key={i} className="px-6 py-4 flex items-center justify-between hover:bg-slate-50/50 transition-colors">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center font-bold text-slate-500 text-xs">
                  {order.time}
                </div>
                <div>
                  <h4 className="font-bold text-slate-800 text-sm">{order.id}</h4>
                  <p className="text-xs text-slate-500 mt-0.5">{order.items}</p>
                </div>
              </div>
              <div className="font-bold text-slate-700 text-sm">
                + Rp {order.total.toLocaleString('id-ID')}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
