'use client'

import React from 'react'
import { LayoutDashboard, TrendingUp, Package, Banknote } from 'lucide-react'

export default function LeaderDashboardPage() {
  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Leader Dashboard</h1>
        <p className="text-sm text-slate-500 mt-1">Ringkasan performa dan operasional cabang Anda hari ini.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* KPI: Penjualan Hari Ini */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-blue-600" />
            </div>
            <span className="text-xs font-semibold px-2 py-1 bg-green-50 text-green-700 rounded-full">
              +12% vs Target
            </span>
          </div>
          <div>
            <p className="text-sm font-medium text-slate-500">Penjualan Hari Ini</p>
            <h3 className="text-2xl font-bold text-slate-800 mt-1">Rp 2.450.000</h3>
            <p className="text-xs text-slate-400 mt-1">Target: Rp 2.200.000</p>
          </div>
        </div>

        {/* KPI: Sisa Petty Cash */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="w-10 h-10 rounded-lg bg-emerald-50 flex items-center justify-center">
              <Banknote className="w-5 h-5 text-emerald-600" />
            </div>
            <span className="text-xs font-semibold px-2 py-1 bg-red-50 text-red-700 rounded-full">
              Hampir Habis
            </span>
          </div>
          <div>
            <p className="text-sm font-medium text-slate-500">Sisa Petty Cash</p>
            <h3 className="text-2xl font-bold text-slate-800 mt-1">Rp 125.000</h3>
            <p className="text-xs text-slate-400 mt-1">Limit: Rp 500.000</p>
          </div>
        </div>

        {/* KPI: Stok Kritis */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="w-10 h-10 rounded-lg bg-orange-50 flex items-center justify-center">
              <Package className="w-5 h-5 text-orange-600" />
            </div>
          </div>
          <div>
            <p className="text-sm font-medium text-slate-500">Peringatan Stok</p>
            <h3 className="text-2xl font-bold text-slate-800 mt-1">3 Item</h3>
            <p className="text-xs text-slate-400 mt-1">Ayam Sedang, Saus, Tortilla</p>
          </div>
        </div>

        {/* KPI: Kehadiran */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="w-10 h-10 rounded-lg bg-purple-50 flex items-center justify-center">
              <LayoutDashboard className="w-5 h-5 text-purple-600" />
            </div>
          </div>
          <div>
            <p className="text-sm font-medium text-slate-500">Tim Shift Ini</p>
            <h3 className="text-2xl font-bold text-slate-800 mt-1">4/4 Hadir</h3>
            <p className="text-xs text-slate-400 mt-1">Semua anggota hadir</p>
          </div>
        </div>
      </div>
      
      {/* Quick Actions / Shortcuts */}
      <div className="bg-slate-50 border border-slate-200 rounded-xl p-6">
        <h2 className="text-base font-semibold text-slate-800 mb-4">Aksi Cepat</h2>
        <div className="flex flex-wrap gap-3">
          <a href="/dashboard/leader/petty-cash" className="px-4 py-2 bg-white border border-slate-200 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors">
            Ajukan Top Up Petty Cash
          </a>
          <a href="/dashboard/leader/stock" className="px-4 py-2 bg-white border border-slate-200 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors">
            Cek Stok
          </a>
        </div>
      </div>
    </div>
  )
}
