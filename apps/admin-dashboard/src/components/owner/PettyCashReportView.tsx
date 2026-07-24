'use client'

import React, { useState, useMemo } from 'react'
import {
  TrendingDown,
  TrendingUp,
  Wallet,
  ArrowUpDown,
  Search,
  Receipt,
  Building2,
  Calendar,
  Layers,
  X,
  Download
} from 'lucide-react'
import type { Outlet } from '@/lib/types'

export interface PettyCashTransaction {
  id: string
  outlet_id: string
  outlet_name: string
  transaction_date: string
  type: 'in' | 'out'
  category: string
  description: string
  amount: number
  staff_name: string
  receipt_url: string | null
}

export interface DailyPettyCashSummary {
  date: string
  total_in: number
  total_out: number
  ending_balance: number
  shift_count: number
}

interface PettyCashReportViewProps {
  outlets: Outlet[]
  transactions: PettyCashTransaction[]
  dailySummaries?: DailyPettyCashSummary[]
  selectedOutletId: string
  onOutletChange: (outletId: string) => void
  dateFrom: string
  dateTo: string
}

interface ReceiptModalProps {
  isOpen: boolean
  imageUrl: string | null
  title: string
  onClose: () => void
}

function ReceiptModal({ isOpen, imageUrl, title, onClose }: ReceiptModalProps) {
  if (!isOpen || !imageUrl) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 p-2 sm:p-4 backdrop-blur-md transition-opacity">
      <div className="relative w-full max-w-lg max-h-[85vh] sm:max-h-[90vh] flex flex-col overflow-hidden rounded-2xl sm:rounded-3xl bg-white border border-slate-100 shadow-2xl animate-in fade-in zoom-in-95 duration-200">
        <div className="shrink-0 flex items-center justify-between border-b border-slate-100 px-4 py-3 sm:px-6 sm:py-4 bg-white">
          <div className="flex items-center gap-2.5 sm:gap-3 overflow-hidden">
            <div className="shrink-0 flex h-9 w-9 sm:h-11 sm:w-11 items-center justify-center rounded-xl bg-orange-50 text-suka-orange border border-orange-100 shadow-sm">
              <Receipt size={18} />
            </div>
            <h3 className="font-extrabold text-xs sm:text-base text-slate-900 truncate">
              {title}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="shrink-0 rounded-full p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-3.5 sm:p-6 flex items-center justify-center bg-slate-950">
          <img
            src={imageUrl}
            alt={title}
            className="max-h-[50vh] sm:max-h-[60vh] w-auto max-w-full object-contain mx-auto rounded-xl"
          />
        </div>

        <div className="shrink-0 flex items-center justify-between border-t border-slate-100 px-4 py-3 sm:px-6 sm:py-4 bg-slate-50/50">
          <a
            href={imageUrl}
            target="_blank"
            rel="noopener noreferrer"
            download
            className="flex items-center gap-1.5 rounded-xl bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 px-3 py-2 text-[11px] sm:text-xs font-bold transition-colors shadow-sm"
          >
            <Download size={13} /> Unduh Nota
          </a>

          <button
            onClick={onClose}
            className="rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold px-5 py-2 text-[11px] sm:text-xs transition-colors shadow-sm"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  )
}

export function PettyCashReportView({
  outlets,
  transactions,
  dailySummaries = [],
  selectedOutletId,
  onOutletChange,
  dateFrom,
  dateTo,
}: PettyCashReportViewProps) {
  const [typeFilter, setTypeFilter] = useState<'all' | 'in' | 'out'>('all')
  const [searchQuery, setSearchQuery] = useState('')

  // State untuk modal bukti nota
  const [activeReceiptUrl, setActiveReceiptUrl] = useState<string | null>(null)
  const [activeReceiptTitle, setActiveReceiptTitle] = useState('')

  // Format IDR
  const formatRp = (amount: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      maximumFractionDigits: 0,
    }).format(amount)
  }

  // Format ISO Date ke DD/MM/YYYY
  const formatDate = (isoStr: string) => {
    try {
      const d = new Date(isoStr)
      if (isNaN(d.getTime())) return isoStr
      return d.toLocaleDateString('id-ID', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      })
    } catch {
      return isoStr
    }
  }

  // Filtering data transaksi
  const filteredData = useMemo(() => {
    return transactions.filter((t) => {
      // Filter Outlet
      if (selectedOutletId !== 'all' && t.outlet_id !== selectedOutletId) {
        return false
      }
      // Filter Tipe Transaksi
      if (typeFilter !== 'all' && t.type !== typeFilter) {
        return false
      }
      // Search Query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase()
        const matchDesc = t.description.toLowerCase().includes(q)
        const matchCategory = t.category.toLowerCase().includes(q)
        const matchStaff = t.staff_name.toLowerCase().includes(q)
        const matchOutlet = t.outlet_name.toLowerCase().includes(q)
        if (!matchDesc && !matchCategory && !matchStaff && !matchOutlet) {
          return false
        }
      }
      return true
    })
  }, [transactions, selectedOutletId, typeFilter, searchQuery])

  // Hitung Summary KPI
  const summary = useMemo(() => {
    let totalIn = 0
    let totalOut = 0
    let countIn = 0
    let countOut = 0

    for (const t of filteredData) {
      if (t.type === 'in') {
        totalIn += t.amount
        countIn++
      } else {
        totalOut += t.amount
        countOut++
      }
    }

    const balance = totalIn - totalOut

    return {
      totalIn,
      totalOut,
      balance,
      countIn,
      countOut,
      totalTx: filteredData.length,
    }
  }, [filteredData])

  // Filter Rekap Saldo Per Hari sesuai outlet terfilter
  const computedDailySummaries = useMemo(() => {
    if (selectedOutletId === 'all') return dailySummaries

    const dailyMap = new Map<string, DailyPettyCashSummary>()
    for (const t of filteredData) {
      const dateKey = t.transaction_date.slice(0, 10)
      const existing = dailyMap.get(dateKey) || {
        date: dateKey,
        total_in: 0,
        total_out: 0,
        ending_balance: 0,
        shift_count: 0,
      }
      if (t.type === 'in') {
        existing.total_in += t.amount
        existing.shift_count++
      } else {
        existing.total_out += t.amount
      }
      existing.ending_balance = existing.total_in - existing.total_out
      dailyMap.set(dateKey, existing)
    }
    return Array.from(dailyMap.values()).sort((a, b) => b.date.localeCompare(a.date))
  }, [dailySummaries, filteredData, selectedOutletId])

  const openReceiptModal = (url: string, title: string) => {
    setActiveReceiptUrl(url)
    setActiveReceiptTitle(title)
  }

  return (
    <div className="space-y-6">
      {/* ── KPI Summary Cards ────────────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Total Kas Masuk */}
        <div className="rounded-2xl border border-emerald-200 bg-gradient-to-br from-emerald-50 to-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-700">
              TOTAL KAS MASUK (MODAL)
            </span>
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600 border border-emerald-200">
              <TrendingUp size={20} />
            </div>
          </div>
          <p className="mt-3 text-2xl font-black tabular-nums text-emerald-600">
            {formatRp(summary.totalIn)}
          </p>
          <p className="mt-1 text-xs text-slate-500">Pemasukan modal kas kecil disetujui</p>
        </div>

        {/* Total Kas Keluar */}
        <div className="rounded-2xl border border-red-200 bg-gradient-to-br from-red-50 to-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-red-700">
              TOTAL KAS KELUAR (PENGELUARAN)
            </span>
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-red-500/10 text-red-600 border border-red-200">
              <TrendingDown size={20} />
            </div>
          </div>
          <p className="mt-3 text-2xl font-black tabular-nums text-red-600">
            {formatRp(summary.totalOut)}
          </p>
          <p className="mt-1 text-xs text-slate-500">Pengeluaran operasional terverifikasi</p>
        </div>

        {/* Saldo Akhir Petty Cash */}
        <div className="rounded-2xl border border-suka-orange/30 bg-gradient-to-br from-orange-50 to-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-suka-brown">
              SALDO AKHIR PETTY CASH
            </span>
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-suka-orange/20 text-suka-orange border border-suka-orange/30">
              <Wallet size={20} />
            </div>
          </div>
          <p className={`mt-3 text-2xl font-black tabular-nums ${summary.balance >= 0 ? 'text-emerald-700' : 'text-red-600'}`}>
            {formatRp(summary.balance)}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Selisih arus kas ({summary.totalTx} transaksi riil)
          </p>
        </div>
      </div>

      {/* ── Table Saldo Per Hari (Summary Daily Petty Cash) ───────────── */}
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Calendar size={18} className="text-suka-orange" />
            <h3 className="font-extrabold text-slate-800 text-sm">Rekap Saldo Petty Cash Per Hari</h3>
          </div>
          <span className="text-xs text-slate-400 font-semibold">{computedDailySummaries.length} hari tercatat</span>
        </div>

        <div className="overflow-x-auto rounded-xl border border-slate-100">
          <table className="w-full text-left text-xs text-slate-700">
            <thead className="bg-slate-50 text-slate-500 font-bold uppercase text-[10px] tracking-wider border-b border-slate-100">
              <tr>
                <th className="p-3">Tanggal</th>
                <th className="p-3 text-center">Jumlah Shift / Modal</th>
                <th className="p-3 text-right">Kas Masuk (Modal)</th>
                <th className="p-3 text-right">Kas Keluar (Pengeluaran)</th>
                <th className="p-3 text-right">Saldo Akhir Per Hari</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium">
              {computedDailySummaries.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-6 text-center text-slate-400">
                    Belum ada data saldo per hari untuk periode ini.
                  </td>
                </tr>
              ) : (
                computedDailySummaries.map((day) => (
                  <tr key={day.date} className="hover:bg-slate-50/60 transition-colors">
                    <td className="p-3 font-bold text-slate-900 flex items-center gap-1.5">
                      <Calendar size={13} className="text-slate-400" />
                      {formatDate(day.date)}
                    </td>
                    <td className="p-3 text-center font-semibold text-slate-600">
                      {day.shift_count > 0 ? `${day.shift_count} Shift` : '-'}
                    </td>
                    <td className="p-3 text-right font-bold text-emerald-600">
                      + {formatRp(day.total_in)}
                    </td>
                    <td className="p-3 text-right font-bold text-red-600">
                      - {formatRp(day.total_out)}
                    </td>
                    <td className={`p-3 text-right font-extrabold tabular-nums ${day.ending_balance >= 0 ? 'text-emerald-700' : 'text-red-600'}`}>
                      {formatRp(day.ending_balance)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Table Bar Quick Filters & Actions ───────────────────────── */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white p-3 rounded-2xl border border-slate-200 shadow-sm">
        <div className="flex flex-wrap items-center gap-2 flex-1">
          <div className="flex items-center gap-2 pr-2 border-r border-slate-200">
            <Layers size={16} className="text-suka-orange" />
            <span className="font-extrabold text-xs text-slate-800">Rincian Transaksi</span>
          </div>

          {/* Tipe Transaksi Dropdown */}
          <div className="relative">
            <ArrowUpDown size={14} className="absolute left-3 top-2.5 text-slate-400" />
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value as any)}
              className="rounded-xl border border-slate-200 bg-slate-50 pl-8 pr-3 py-1.5 text-xs font-semibold text-slate-800 focus:border-suka-orange focus:bg-white focus:outline-none"
            >
              <option value="all">Semua Tipe (Masuk &amp; Keluar)</option>
              <option value="in">Kas Masuk saja</option>
              <option value="out">Kas Keluar saja</option>
            </select>
          </div>

          {/* Quick Search */}
          <div className="relative flex-1 sm:w-64">
            <Search size={14} className="absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              placeholder="Cari keterangan / staff..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 pl-8 pr-3 py-1.5 text-xs font-semibold text-slate-800 focus:border-suka-orange focus:bg-white focus:outline-none"
            />
          </div>
        </div>
      </div>

      {/* ── Table Log Transaksi ─────────────────────────────────────── */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-700">
            <thead className="bg-slate-900 text-white font-bold uppercase text-[10px] tracking-wider">
              <tr>
                <th className="p-3.5">Waktu &amp; Outlet</th>
                <th className="p-3.5">Tipe</th>
                <th className="p-3.5">Kategori &amp; Keterangan</th>
                <th className="p-3.5 text-right">Nominal</th>
                <th className="p-3.5">Staff / Pencatat</th>
                <th className="p-3.5 text-center">Bukti Nota</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium">
              {filteredData.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-slate-400">
                    Tidak ada transaksi petty cash yang sesuai filter.
                  </td>
                </tr>
              ) : (
                filteredData.map((t) => (
                  <tr key={t.id} className="hover:bg-slate-50/80 transition-colors">
                    {/* Tanggal & Outlet */}
                    <td className="p-3.5">
                      <div className="font-bold text-slate-900">{formatDate(t.transaction_date)}</div>
                      <div className="text-[11px] text-slate-500 font-semibold flex items-center gap-1 mt-0.5">
                        <Building2 size={12} className="text-suka-orange" />
                        {t.outlet_name}
                      </div>
                    </td>

                    {/* Tipe Badge */}
                    <td className="p-3.5">
                      {t.type === 'in' ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-1 text-[10px] font-extrabold text-emerald-800 border border-emerald-300">
                          <TrendingUp size={11} /> Kas Masuk
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2.5 py-1 text-[10px] font-extrabold text-red-800 border border-red-300">
                          <TrendingDown size={11} /> Kas Keluar
                        </span>
                      )}
                    </td>

                    {/* Kategori & Keterangan */}
                    <td className="p-3.5">
                      <div className="font-bold text-slate-900">{t.category}</div>
                      <div className="text-[11px] text-slate-500 max-w-xs truncate mt-0.5">
                        {t.description}
                      </div>
                    </td>

                    {/* Nominal */}
                    <td className="p-3.5 text-right font-black tabular-nums text-sm">
                      <span className={t.type === 'in' ? 'text-emerald-600' : 'text-red-600'}>
                        {t.type === 'in' ? '+ ' : '- '}
                        {formatRp(t.amount)}
                      </span>
                    </td>

                    {/* Staff */}
                    <td className="p-3.5 font-bold text-slate-800">{t.staff_name}</td>

                    {/* Bukti Nota Thumbnail */}
                    <td className="p-3.5 text-center">
                      {t.receipt_url ? (
                        <button
                          onClick={() =>
                            openReceiptModal(
                              t.receipt_url!,
                              `Bukti Nota: ${t.category} - ${t.staff_name}`
                            )
                          }
                          className="relative inline-block overflow-hidden rounded-xl border border-slate-200 shadow-sm hover:scale-105 transition-transform group"
                        >
                          <img
                            src={t.receipt_url}
                            alt="Bukti Nota"
                            className="h-10 w-10 object-cover"
                          />
                          <div className="absolute inset-0 bg-black/30 flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity">
                            <Receipt size={14} />
                          </div>
                        </button>
                      ) : (
                        <div className="flex flex-col items-center justify-center text-slate-400">
                          <Receipt size={14} />
                          <span className="text-[9px] font-semibold italic mt-0.5">Tanpa Nota</span>
                        </div>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Bukti Nota Lightbox */}
      <ReceiptModal
        isOpen={!!activeReceiptUrl}
        imageUrl={activeReceiptUrl}
        title={activeReceiptTitle}
        onClose={() => setActiveReceiptUrl(null)}
      />
    </div>
  )
}
