'use client'

import React, { useState, useMemo } from 'react'
import {
  History,
  Eye,
  FileText,
  User,
  ShoppingBag,
} from 'lucide-react'
import { useOutletSpendingHistory } from '@/hooks/useOutletBudget'
import type { OutletSpendingTransaction, OutletBudgetSummaryItem } from '@/types/budgetMonitoring'

interface Props {
  selectedOutlet: OutletBudgetSummaryItem | null
  onViewDetail: (tx: OutletSpendingTransaction) => void
}

function formatRupiah(val: number): string {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(val)
}

export function OutletSpendingHistory({ selectedOutlet, onViewDetail }: Props) {
  const [dateFilter, setDateFilter] = useState<'all' | 'period' | 'month' | 'today' | 'custom'>('period')
  const [customFrom, setCustomFrom] = useState('')
  const [customTo, setCustomTo] = useState('')

  const { fromDate, toDate } = useMemo(() => {
    const todayStr = new Date().toISOString().split('T')[0]
    if (dateFilter === 'today') {
      return { fromDate: todayStr, toDate: todayStr }
    }
    if (dateFilter === 'period' && selectedOutlet?.periodStart && selectedOutlet?.periodEnd) {
      return { fromDate: selectedOutlet.periodStart, toDate: selectedOutlet.periodEnd }
    }
    if (dateFilter === 'month') {
      const now = new Date()
      const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0]
      return { fromDate: firstDay, toDate: todayStr }
    }
    if (dateFilter === 'custom' && customFrom && customTo) {
      return { fromDate: customFrom, toDate: customTo }
    }
    return { fromDate: undefined, toDate: undefined }
  }, [dateFilter, selectedOutlet, customFrom, customTo])

  const { transactions, loading, error } = useOutletSpendingHistory(
    selectedOutlet?.outletId ?? null,
    fromDate,
    toDate
  )

  if (!selectedOutlet) {
    return (
      <div className="bg-white border border-suka-brown/10 rounded-2xl p-8 text-center shadow-2xs">
        <ShoppingBag className="w-10 h-10 text-suka-brown/30 mx-auto mb-2" />
        <h4 className="font-black text-suka-brown text-sm">Pilih Outlet untuk Melihat Riwayat Belanja</h4>
        <p className="text-xs text-suka-brown/60 mt-1 max-w-sm mx-auto">
          Klik salah satu kartu outlet di atas untuk memuat rincian transaksi belanja dan permintaan bahan yang telah disetujui.
        </p>
      </div>
    )
  }

  const totalFilteredSpending = transactions.reduce((sum, tx) => sum + tx.totalNilai, 0)

  return (
    <div className="bg-white border border-suka-brown/10 rounded-3xl p-5 md:p-6 shadow-2xs space-y-5">
      {/* Header & Title */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-suka-brown/10 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-suka-orange/10 flex items-center justify-center text-suka-orange">
              <History className="w-4 h-4" />
            </div>
            <h3 className="font-black text-suka-brown text-base">
              Riwayat Belanja: <span className="text-suka-orange">{selectedOutlet.outletName}</span>
            </h3>
          </div>
          <p className="text-xs text-suka-brown/60 mt-1">
            Menampilkan daftar permintaan bahan yang disetujui dan memotong plafon budget.
          </p>
        </div>

        {/* Total Summary in Header */}
        <div className="bg-suka-cream/40 border border-suka-brown/10 rounded-2xl px-4 py-2.5 flex items-center gap-4 shrink-0">
          <div>
            <p className="text-[10px] uppercase font-bold text-suka-brown/60">Total Belanja Periode Ini</p>
            <p className="text-base font-black text-suka-brown font-mono">{formatRupiah(totalFilteredSpending)}</p>
          </div>
          <div className="border-l border-suka-brown/15 pl-4">
            <p className="text-[10px] uppercase font-bold text-suka-brown/60">Jumlah Transaksi</p>
            <p className="text-base font-black text-suka-orange font-mono">{transactions.length} kali</p>
          </div>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-[10px] font-bold text-suka-brown/50 uppercase tracking-wider mr-1">Filter Waktu:</span>
          {(
            [
              { id: 'period', label: `Periode Berjalan (${selectedOutlet.periodType || 'Mingguan'})` },
              { id: 'today', label: 'Hari Ini' },
              { id: 'month', label: 'Bulan Ini' },
              { id: 'all', label: 'Semua Riwayat' },
              { id: 'custom', label: 'Kustom Tanggal' },
            ] as const
          ).map((f) => (
            <button
              key={f.id}
              onClick={() => setDateFilter(f.id)}
              className={`text-[11px] font-bold px-3 py-1.5 rounded-xl transition-all cursor-pointer ${
                dateFilter === f.id
                  ? 'bg-suka-orange text-white shadow-2xs'
                  : 'bg-suka-cream/40 hover:bg-suka-cream text-suka-brown/70'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* Custom date range inputs */}
        {dateFilter === 'custom' && (
          <div className="flex items-center gap-2 bg-suka-cream/30 border border-suka-brown/15 rounded-xl p-1.5 animate-in fade-in duration-150">
            <input
              type="date"
              value={customFrom}
              onChange={(e) => setCustomFrom(e.target.value)}
              className="px-2 py-1 bg-white border border-suka-brown/15 rounded-lg text-xs font-bold text-suka-brown"
            />
            <span className="text-xs text-suka-brown/50 font-bold">s/d</span>
            <input
              type="date"
              value={customTo}
              onChange={(e) => setCustomTo(e.target.value)}
              className="px-2 py-1 bg-white border border-suka-brown/15 rounded-lg text-xs font-bold text-suka-brown"
            />
          </div>
        )}
      </div>

      {/* Transactions Table */}
      {loading ? (
        <div className="py-12 text-center text-xs text-suka-brown/60">
          Memuat riwayat transaksi belanja...
        </div>
      ) : error ? (
        <div className="p-4 bg-red-50 text-red-700 rounded-2xl text-xs font-bold">
          {error}
        </div>
      ) : transactions.length === 0 ? (
        <div className="border border-dashed border-suka-brown/20 rounded-2xl p-8 text-center bg-suka-cream/10">
          <FileText className="w-8 h-8 text-suka-brown/30 mx-auto mb-2" />
          <p className="text-xs font-bold text-suka-brown">Belum ada transaksi belanja pada filter tanggal ini.</p>
          <p className="text-[11px] text-suka-brown/60 mt-0.5">
            Setiap permintaan bahan baku yang disetujui (approve) akan otomatis tercatat di sini.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-suka-brown/10">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-suka-cream/40 border-b border-suka-brown/10 text-suka-brown/70 font-black uppercase text-[10px] tracking-wider">
                <th className="py-3 px-4">No. Permintaan</th>
                <th className="py-3 px-4">Tanggal Persetujuan</th>
                <th className="py-3 px-4">Pemohon</th>
                <th className="py-3 px-4">Item Bahan</th>
                <th className="py-3 px-4 text-right">Total Nilai Belanja</th>
                <th className="py-3 px-4 text-center">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-suka-brown/10 bg-white">
              {transactions.map((tx) => {
                const formattedDate = new Date(tx.approvedAt || tx.createdAt).toLocaleDateString('id-ID', {
                  day: 'numeric',
                  month: 'short',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })

                return (
                  <tr key={tx.id} className="hover:bg-suka-cream/20 transition-colors">
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-2">
                        <span className="font-black text-suka-brown text-xs">{tx.kodePermintaan}</span>
                        <span className="text-[9px] font-black uppercase px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800">
                          Disetujui
                        </span>
                      </div>
                    </td>
                    <td className="py-3.5 px-4 text-suka-brown/70 font-medium text-xs">
                      {formattedDate}
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-1.5 font-bold text-suka-brown text-xs">
                        <User className="w-3.5 h-3.5 text-suka-brown/40 shrink-0" />
                        <span>{tx.requesterName}</span>
                      </div>
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="bg-suka-cream/60 text-suka-brown px-2 py-0.5 rounded-md font-bold text-[11px]">
                        {tx.totalItems} jenis bahan
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <span className="font-black text-suka-brown font-mono text-sm">
                        {formatRupiah(tx.totalNilai)}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <button
                        onClick={() => onViewDetail(tx)}
                        className="px-3 py-1.5 rounded-xl bg-suka-orange/10 hover:bg-suka-orange text-suka-orange hover:text-white font-bold text-xs transition-all inline-flex items-center gap-1.5 cursor-pointer shadow-2xs"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>Rincian</span>
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
