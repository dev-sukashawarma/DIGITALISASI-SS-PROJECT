'use client'

import React, { useState } from 'react'
import { Plus, Clock, CheckCircle2, XCircle, FileText, Upload } from 'lucide-react'

export default function PettyCashPage() {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [showForm, setShowForm] = useState(false)

  // Dummy history data
  const history = [
    { id: 'PC-001', date: '21 Jul 2026', amount: 500000, status: 'approved', manager: 'Budi (AM)', finance: 'Siska (Fin)' },
    { id: 'PC-002', date: '15 Jul 2026', amount: 300000, status: 'approved', manager: 'Budi (AM)', finance: 'Siska (Fin)' },
    { id: 'PC-003', date: '01 Jul 2026', amount: 500000, status: 'rejected', manager: 'Budi (AM)', finance: '-' },
  ]

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Top Up Petty Cash</h1>
          <p className="text-sm text-slate-500 mt-1">Ajukan penambahan dana operasional harian cabang.</p>
        </div>
        <button 
          onClick={() => setShowForm(!showForm)}
          className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors"
        >
          <Plus size={18} />
          {showForm ? 'Batal Pengajuan' : 'Ajukan Top Up Baru'}
        </button>
      </div>

      {/* Active Pipeline / Form Area */}
      {showForm && (
        <div className="bg-white rounded-xl border border-blue-100 p-6 shadow-sm relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1 bg-blue-500"></div>
          <h2 className="text-lg font-bold text-slate-800 mb-4">Form Pengajuan Top Up</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">Nominal Pengajuan</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 font-medium">Rp</span>
                  <input type="number" placeholder="500.000" className="w-full pl-10 pr-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all" />
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">Sisa Saldo Saat Ini</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 font-medium">Rp</span>
                  <input type="number" placeholder="50.000" className="w-full pl-10 pr-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all" />
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">Catatan / Alasan</label>
                <textarea rows={3} placeholder="Dana habis untuk beli gas dan plastik..." className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"></textarea>
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">Upload Bukti Nota Sisa</label>
                <div className="border-2 border-dashed border-slate-300 rounded-lg p-6 text-center hover:bg-slate-50 transition-colors cursor-pointer">
                  <Upload className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                  <p className="text-sm text-slate-600 font-medium">Klik untuk upload foto</p>
                  <p className="text-xs text-slate-400 mt-1">PNG, JPG up to 5MB</p>
                </div>
              </div>

              <button 
                className="w-full py-2.5 bg-slate-900 text-white rounded-lg font-medium hover:bg-slate-800 transition-colors"
                onClick={() => {
                  setIsSubmitting(true);
                  setTimeout(() => setIsSubmitting(false), 2000);
                }}
              >
                {isSubmitting ? 'Mengirim...' : 'Kirim Pengajuan'}
              </button>
            </div>

            {/* Approval Pipeline Info */}
            <div className="bg-slate-50 rounded-xl p-5 border border-slate-100">
              <h3 className="text-sm font-bold text-slate-700 mb-4 uppercase tracking-wider">Alur Persetujuan</h3>
              
              <div className="space-y-6 relative before:absolute before:inset-0 before:ml-5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-slate-200 before:to-transparent">
                <div className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
                  <div className="flex items-center justify-center w-10 h-10 rounded-full border-4 border-white bg-blue-100 text-blue-600 shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 z-10">
                    <FileText size={18} />
                  </div>
                  <div className="w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] p-4 rounded-xl bg-white border border-slate-200 shadow-sm">
                    <div className="flex items-center justify-between mb-1">
                      <h4 className="font-bold text-slate-800 text-sm">Pengajuan</h4>
                    </div>
                    <p className="text-xs text-slate-500 font-medium">Leader Cabang</p>
                  </div>
                </div>

                <div className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group">
                  <div className="flex items-center justify-center w-10 h-10 rounded-full border-4 border-white bg-slate-100 text-slate-400 shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 z-10">
                    <Clock size={18} />
                  </div>
                  <div className="w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] p-4 rounded-xl border border-slate-100 bg-slate-50/50">
                    <div className="flex items-center justify-between mb-1">
                      <h4 className="font-bold text-slate-400 text-sm">Review Area Manager</h4>
                    </div>
                    <p className="text-xs text-slate-400 font-medium">Menunggu AM</p>
                  </div>
                </div>

                <div className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group">
                  <div className="flex items-center justify-center w-10 h-10 rounded-full border-4 border-white bg-slate-100 text-slate-400 shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 z-10">
                    <CheckCircle2 size={18} />
                  </div>
                  <div className="w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] p-4 rounded-xl border border-slate-100 bg-slate-50/50">
                    <div className="flex items-center justify-between mb-1">
                      <h4 className="font-bold text-slate-400 text-sm">Pencairan Finance</h4>
                    </div>
                    <p className="text-xs text-slate-400 font-medium">Menunggu Finance</p>
                  </div>
                </div>
              </div>

            </div>
          </div>
        </div>
      )}

      {/* History Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100">
          <h2 className="text-lg font-bold text-slate-800">Riwayat Pengajuan</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/80 text-slate-500 text-xs uppercase tracking-wider">
                <th className="px-6 py-3 font-semibold">ID</th>
                <th className="px-6 py-3 font-semibold">Tanggal</th>
                <th className="px-6 py-3 font-semibold">Nominal</th>
                <th className="px-6 py-3 font-semibold">Status</th>
                <th className="px-6 py-3 font-semibold">Disetujui Oleh</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {history.map((row) => (
                <tr key={row.id} className="hover:bg-slate-50/50">
                  <td className="px-6 py-4 font-medium text-slate-800">{row.id}</td>
                  <td className="px-6 py-4 text-slate-500">{row.date}</td>
                  <td className="px-6 py-4 font-semibold text-slate-700">Rp {row.amount.toLocaleString('id-ID')}</td>
                  <td className="px-6 py-4">
                    {row.status === 'approved' && (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700">
                        <CheckCircle2 size={14} /> Disetujui
                      </span>
                    )}
                    {row.status === 'rejected' && (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-red-50 text-red-700">
                        <XCircle size={14} /> Ditolak
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-slate-500">
                    <div className="flex flex-col gap-0.5">
                      <span className="text-xs">AM: <span className="font-medium text-slate-700">{row.manager}</span></span>
                      <span className="text-xs">Fin: <span className="font-medium text-slate-700">{row.finance}</span></span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
