'use client'

import React, { useState } from 'react'
import { Package, AlertTriangle, CheckCircle, Search } from 'lucide-react'

export default function StockMonitoringPage() {
  const [searchTerm, setSearchTerm] = useState('')

  const stocks = [
    { id: 'STK-01', name: 'Ayam Sedang', current: 15, unit: 'Porsi', min: 20, status: 'critical' },
    { id: 'STK-02', name: 'Saus Bawang', current: 2, unit: 'Pack', min: 5, status: 'critical' },
    { id: 'STK-03', name: 'Tortilla Kebab', current: 25, unit: 'Lembar', min: 30, status: 'warning' },
    { id: 'STK-04', name: 'Daging Sapi', current: 40, unit: 'Porsi', min: 20, status: 'safe' },
    { id: 'STK-05', name: 'Minyak Goreng', current: 5, unit: 'Liter', min: 3, status: 'safe' },
    { id: 'STK-06', name: 'Beras Basmati', current: 10, unit: 'Kg', min: 5, status: 'safe' },
  ]

  const filteredStocks = stocks.filter(s => s.name.toLowerCase().includes(searchTerm.toLowerCase()))
  const criticalCount = stocks.filter(s => s.status === 'critical').length
  const warningCount = stocks.filter(s => s.status === 'warning').length

  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto space-y-6 font-sans">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">Monitoring Stok Cabang</h1>
          <p className="text-xs sm:text-sm text-slate-500 font-medium mt-1">Pantau sisa bahan baku di cabang Anda secara real-time.</p>
        </div>
        
        {/* Quick Summary Badges - Solid Pills */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-red-50 border border-red-200 rounded-xl text-xs font-bold text-red-700">
            <AlertTriangle size={14} className="text-red-600" />
            <span>{criticalCount} Kritis</span>
          </div>
          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 border border-amber-200 rounded-xl text-xs font-bold text-amber-800">
            <AlertTriangle size={14} className="text-amber-600" />
            <span>{warningCount} Menipis</span>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        {/* Toolbar */}
        <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50/50">
          <div className="relative w-full max-w-sm">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input 
              type="text" 
              placeholder="Cari bahan baku..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all shadow-xs"
            />
          </div>
          <button className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 active:scale-95 text-white rounded-xl text-xs font-bold transition-all shadow-xs shrink-0 cursor-pointer">
            Minta Restock
          </button>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 text-slate-500 text-[11px] uppercase tracking-wider border-b border-slate-200 font-bold">
                <th className="px-6 py-3.5 font-bold">Nama Item</th>
                <th className="px-6 py-3.5 font-bold">Stok Saat Ini</th>
                <th className="px-6 py-3.5 font-bold">Batas Minimum</th>
                <th className="px-6 py-3.5 font-bold">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs font-semibold">
              {filteredStocks.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-6 py-8 text-center text-slate-400 font-medium">
                    Tidak ada bahan baku yang sesuai pencarian.
                  </td>
                </tr>
              ) : (
                filteredStocks.map((row) => (
                  <tr key={row.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="px-6 py-4 font-bold text-slate-900 flex items-center gap-3">
                      <div className="w-8 h-8 rounded-xl bg-slate-100 flex items-center justify-center shrink-0 border border-slate-200">
                        <Package size={16} className="text-slate-500" />
                      </div>
                      <span>{row.name}</span>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`font-extrabold text-base ${row.status === 'critical' ? 'text-red-600' : row.status === 'warning' ? 'text-amber-600' : 'text-slate-900'}`}>
                        {row.current}
                      </span>
                      <span className="text-slate-500 text-xs ml-1 font-medium">{row.unit}</span>
                    </td>
                    <td className="px-6 py-4 text-slate-600 font-medium">{row.min} {row.unit}</td>
                    <td className="px-6 py-4">
                      {row.status === 'critical' && (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-[11px] font-bold bg-red-50 text-red-700 border border-red-200">
                          <AlertTriangle size={13} /> Kritis
                        </span>
                      )}
                      {row.status === 'warning' && (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-[11px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                          <AlertTriangle size={13} /> Menipis
                        </span>
                      )}
                      {row.status === 'safe' && (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-[11px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                          <CheckCircle size={13} /> Aman
                        </span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
