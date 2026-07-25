'use client'

import React from 'react'
import { LayoutDashboard, TrendingUp, Package, Banknote, ArrowRight } from 'lucide-react'

export default function LeaderDashboardPage() {
  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6 font-sans">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">Leader Dashboard</h1>
        <p className="text-xs sm:text-sm text-slate-500 font-medium mt-1">Ringkasan performa dan operasional cabang Anda hari ini.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* KPI: Penjualan Hari Ini */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between mb-4">
            <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-100 text-blue-600 flex items-center justify-center">
              <TrendingUp className="w-5 h-5" />
            </div>
            <span className="text-xs font-bold px-2.5 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-lg">
              +12% vs Target
            </span>
          </div>
          <div>
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Penjualan Hari Ini</p>
            <h3 className="text-2xl font-extrabold text-slate-900 mt-1 tracking-tight">Rp 2.450.000</h3>
            <p className="text-xs text-slate-500 font-medium mt-1">Target: Rp 2.200.000</p>
          </div>
        </div>

        {/* KPI: Sisa Petty Cash */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between mb-4">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-100 text-emerald-600 flex items-center justify-center">
              <Banknote className="w-5 h-5" />
            </div>
            <span className="text-xs font-bold px-2.5 py-1 bg-red-50 text-red-700 border border-red-200 rounded-lg">
              Hampir Habis
            </span>
          </div>
          <div>
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Sisa Petty Cash</p>
            <h3 className="text-2xl font-extrabold text-slate-900 mt-1 tracking-tight">Rp 125.000</h3>
            <p className="text-xs text-slate-500 font-medium mt-1">Limit: Rp 500.000</p>
          </div>
        </div>

        {/* KPI: Peringatan Stok */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between mb-4">
            <div className="w-10 h-10 rounded-xl bg-amber-50 border border-amber-100 text-amber-600 flex items-center justify-center">
              <Package className="w-5 h-5" />
            </div>
            <span className="text-xs font-bold px-2.5 py-1 bg-amber-50 text-amber-800 border border-amber-200 rounded-lg">
              Perlu Restock
            </span>
          </div>
          <div>
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Peringatan Stok</p>
            <h3 className="text-2xl font-extrabold text-slate-900 mt-1 tracking-tight">3 Item</h3>
            <p className="text-xs text-slate-500 font-medium mt-1">Ayam Sedang, Saus, Tortilla</p>
          </div>
        </div>

        {/* KPI: Kehadiran */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between mb-4">
            <div className="w-10 h-10 rounded-xl bg-purple-50 border border-purple-100 text-purple-600 flex items-center justify-center">
              <LayoutDashboard className="w-5 h-5" />
            </div>
            <span className="text-xs font-bold px-2.5 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-lg">
              100%
            </span>
          </div>
          <div>
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Tim Shift Ini</p>
            <h3 className="text-2xl font-extrabold text-slate-900 mt-1 tracking-tight">4/4 Hadir</h3>
            <p className="text-xs text-slate-500 font-medium mt-1">Semua anggota hadir</p>
          </div>
        </div>
      </div>
      
      {/* Quick Actions / Shortcuts - Solid Fills */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs">
        <h2 className="text-base font-bold text-slate-900 mb-4">Aksi Cepat Leader</h2>
        <div className="flex flex-wrap gap-3">
          <a 
            href="/dashboard/leader/petty-cash" 
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 active:scale-95 text-white rounded-xl text-xs font-bold transition-all shadow-xs"
          >
            Ajukan Top Up Petty Cash <ArrowRight className="w-3.5 h-3.5" />
          </a>
          <a 
            href="/dashboard/leader/stock" 
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-bold transition-all"
          >
            Cek Stok Cabang <ArrowRight className="w-3.5 h-3.5 text-slate-500" />
          </a>
          <a 
            href="/dashboard/leader/sales" 
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-bold transition-all"
          >
            Penjualan & Target <ArrowRight className="w-3.5 h-3.5 text-slate-500" />
          </a>
        </div>
      </div>
    </div>
  )
}
