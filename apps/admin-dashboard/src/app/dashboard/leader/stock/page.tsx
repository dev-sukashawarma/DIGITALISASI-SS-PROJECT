'use client'

import React, { useState } from 'react'
import { Package, AlertTriangle, CheckCircle, Search } from 'lucide-react'

export default function StockMonitoringPage() {
  const [searchTerm, setSearchTerm] = useState('')

  // Dummy stock data
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
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Monitoring Stok</h1>
          <p className="text-sm text-slate-500 mt-1">Pantau sisa bahan baku di cabang Anda secara real-time.</p>
        </div>
        
        {/* Quick Summary Badges */}
        <div className="flex gap-3">
          <div className="flex items-center gap-2 px-3 py-1.5 bg-red-50 border border-red-100 rounded-lg">
            <AlertTriangle size={16} className="text-red-600" />
            <span className="text-sm font-bold text-red-700">{criticalCount} Kritis</span>
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 bg-amber-50 border border-amber-100 rounded-lg">
            <AlertTriangle size={16} className="text-amber-600" />
            <span className="text-sm font-bold text-amber-700">{warningCount} Menipis</span>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        {/* Toolbar */}
        <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div className="relative w-full max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input 
              type="text" 
              placeholder="Cari bahan baku..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
            />
          </div>
          <button className="px-4 py-2 bg-white border border-slate-200 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors hidden sm:block">
            Minta Restock
          </button>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/80 text-slate-500 text-xs uppercase tracking-wider">
                <th className="px-6 py-3 font-semibold">Nama Item</th>
                <th className="px-6 py-3 font-semibold">Stok Saat Ini</th>
                <th className="px-6 py-3 font-semibold">Batas Minimum</th>
                <th className="px-6 py-3 font-semibold">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {filteredStocks.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-6 py-8 text-center text-slate-500">
                    Tidak ada bahan baku yang sesuai pencarian.
                  </td>
                </tr>
              ) : (
                filteredStocks.map((row) => (
                  <tr key={row.id} className="hover:bg-slate-50/50">
                    <td className="px-6 py-4 font-medium text-slate-800 flex items-center gap-3">
                      <div className="w-8 h-8 rounded-md bg-slate-100 flex items-center justify-center shrink-0">
                        <Package size={16} className="text-slate-400" />
                      </div>
                      {row.name}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`font-bold text-lg ${row.status === 'critical' ? 'text-red-600' : row.status === 'warning' ? 'text-amber-600' : 'text-slate-700'}`}>
                        {row.current}
                      </span>
                      <span className="text-slate-500 text-xs ml-1">{row.unit}</span>
                    </td>
                    <td className="px-6 py-4 text-slate-500">{row.min} {row.unit}</td>
                    <td className="px-6 py-4">
                      {row.status === 'critical' && (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-red-50 text-red-700">
                          <AlertTriangle size={14} /> Kritis
                        </span>
                      )}
                      {row.status === 'warning' && (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700">
                          <AlertTriangle size={14} /> Menipis
                        </span>
                      )}
                      {row.status === 'safe' && (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700">
                          <CheckCircle size={14} /> Aman
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
