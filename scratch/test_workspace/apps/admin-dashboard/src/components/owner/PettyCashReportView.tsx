// @ts-nocheck
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
import { StatTile } from '@/components/ui'
import { motion } from 'framer-motion'

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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-suka-ink/70 p-2 sm:p-4 backdrop-blur-md transition-opacity">
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

        <div className="flex-1 overflow-y-auto p-3.5 sm:p-6 flex items-center justify-center bg-suka-ink/95">
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
            className="flex items-center gap-1.5 rounded-xl bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 px-3 py-2 text-[11px] sm:text-xs font-bold transition-all hover:scale-105 active:scale-95 shadow-sm"
          >
            <Download size={13} /> Unduh Nota
          </a>

          <button
            onClick={onClose}
            className="rounded-xl bg-suka-ink hover:bg-suka-ink/90 text-white font-bold px-5 py-2 text-[11px] sm:text-xs transition-all hover:scale-105 active:scale-95 shadow-sm"
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
  dateFrom: _dateFrom,
  dateTo: _dateTo,
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
        timeZone: 'Asia/Jakarta'
      })
    } catch {
      return isoStr
    }
  }

  // Format ISO Time ke HH:mm (WIB)
  const formatTime = (isoStr: string) => {
    try {
      const d = new Date(isoStr)
      if (isNaN(d.getTime())) return isoStr.includes('T') ? isoStr.split('T')[1].slice(0, 5) : '00:00'
      return d.toLocaleTimeString('id-ID', {
        timeZone: 'Asia/Jakarta',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
      }).replace('.', ':')
    } catch {
      return isoStr.includes('T') ? isoStr.split('T')[1].slice(0, 5) : '00:00'
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
    <div className="flex flex-col lg:flex-row items-start gap-6">
      {/* ── KIRI: SUMMARY & REKAP ────────────────────────── */}
      <div className="w-full lg:w-1/3 xl:w-[30%] flex flex-col gap-6 shrink-0 lg:sticky lg:top-6">
        {/* KPI Summary Cards */}
        <motion.div 
          initial="hidden"
          animate="visible"
          variants={{ visible: { transition: { staggerChildren: 0.05 } }, hidden: {} }}
          className="grid grid-cols-1 gap-4"
        >
        <StatTile
          label="TOTAL MODAL KAS MASUK"
          value={formatRp(summary.totalIn)}
          sub="Pengisian modal kas kecil disetujui"
          icon={TrendingUp}
          accent="green"
        />
        <StatTile
          label="TOTAL PENGELUARAN KAS"
          value={formatRp(summary.totalOut)}
          sub="Pengeluaran operasional terverifikasi"
          icon={TrendingDown}
          accent="red"
        />
        <StatTile
          label="SALDO AKHIR PETTY CASH"
          value={formatRp(summary.balance)}
          sub={`Sisa saldo kas kecil (${summary.totalTx} transaksi riil)`}
          icon={Wallet}
          accent={summary.balance >= 0 ? 'orange' : 'red'}
        />
      </motion.div>

      {/* ── Table Rekap Saldo Per Hari ───────────────────────────────── */}
      <div className="bg-white/80 backdrop-blur-xl p-4 sm:p-6 rounded-3xl border border-suka-brown/10 shadow-sm space-y-4">
        <div className="flex items-center justify-between border-b border-suka-brown/5 pb-3">
          <div className="flex items-center gap-2">
            <Calendar size={18} className="text-suka-orange" />
            <h3 className="font-bold text-sm text-suka-brown uppercase tracking-tight">Rekap Saldo Petty Cash Per Hari</h3>
          </div>
          <span className="text-xs text-slate-500 font-semibold">
            {computedDailySummaries.length} hari tercatat
          </span>
        </div>

        <div className="overflow-x-auto rounded-xl border border-suka-brown/5">
          <table className="w-full text-left text-sm text-slate-700">
            <thead className="bg-suka-cream/20 text-suka-gray-500 font-semibold uppercase text-xs tracking-wider border-b border-suka-brown/5">
              <tr>
                <th className="p-4">Tanggal</th>
                <th className="p-4 text-center">Jumlah Shift / Modal</th>
                <th className="p-4 text-right">Modal Kas Masuk</th>
                <th className="p-4 text-right">Pengeluaran Kas</th>
                <th className="p-4 text-right">Saldo Akhir Per Hari</th>
              </tr>
            </thead>
            <motion.tbody 
              initial="hidden"
              animate="visible"
              variants={{ visible: { transition: { staggerChildren: 0.05 } }, hidden: {} }}
              className="divide-y divide-suka-gray-100 font-medium text-suka-ink"
            >
              {computedDailySummaries.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-6 text-center text-slate-400">
                    Belum ada data saldo per hari untuk periode ini.
                  </td>
                </tr>
              ) : (
                computedDailySummaries.map((day) => (
                  <motion.tr 
                    key={day.date} 
                    variants={{ hidden: { opacity: 0, y: 10 }, visible: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 300, damping: 24 } } }}
                    className="hover:bg-orange-50/30 transition-colors group"
                  >
                    <td className="p-4 font-bold text-slate-900 flex items-center gap-1.5">
                      <Calendar size={15} className="text-slate-400" />
                      {formatDate(day.date)}
                    </td>
                    <td className="p-4 text-center font-semibold text-slate-600">
                      {day.shift_count > 0 ? `${day.shift_count} Shift` : '-'}
                    </td>
                    <td className="p-4 text-right font-bold text-emerald-600">
                      + {formatRp(day.total_in)}
                    </td>
                    <td className="p-4 text-right font-bold text-red-600">
                      - {formatRp(day.total_out)}
                    </td>
                    <td className={`p-4 text-right font-bold tabular-nums ${day.ending_balance >= 0 ? 'text-emerald-700' : 'text-rose-600'}`}>
                      {formatRp(day.ending_balance)}
                    </td>
                  </motion.tr>
                ))
              )}
            </motion.tbody>
          </table>
        </div>
      </div>
      </div>

      {/* ── KANAN: TRANSAKSI ─────────────────────────────── */}
      <div className="w-full lg:w-2/3 xl:w-[70%] flex flex-col gap-6 min-w-0">
      {/* ── Table Bar Quick Filters & Actions ───────────────────────── */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 bg-white/80 backdrop-blur-xl p-4 sm:p-6 rounded-3xl border border-suka-brown/10 shadow-sm">
        <div className="flex flex-wrap items-center gap-3 flex-1">
          <div className="flex items-center gap-2 pr-3 border-r border-suka-brown/10">
            <Layers size={18} className="text-suka-orange" />
            <span className="font-bold text-sm text-suka-brown uppercase tracking-tight">Rincian Transaksi</span>
          </div>

          {/* Tipe Transaksi Dropdown */}
          <div className="relative">
            <ArrowUpDown size={15} className="absolute left-3 top-3 text-slate-400" />
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value as any)}
              className="rounded-xl border border-slate-200 bg-slate-50 pl-9 pr-4 py-2 text-sm font-semibold text-slate-800 focus:border-suka-orange focus:bg-white focus:outline-none transition-colors"
            >
              <option value="all">Semua Tipe (Masuk &amp; Keluar)</option>
              <option value="in">Modal Kas Masuk saja</option>
              <option value="out">Pengeluaran Kas saja</option>
            </select>
          </div>

          {/* Quick Search */}
          <div className="relative flex-1 sm:w-72">
            <Search size={15} className="absolute left-3 top-3 text-slate-400" />
            <input
              type="text"
              placeholder="Cari deskripsi / pembuat..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 pl-9 pr-4 py-2 text-sm font-semibold text-slate-800 focus:border-suka-orange focus:bg-white focus:outline-none transition-colors"
            />
          </div>
        </div>
      </div>

      {/* ── Table Rincian Transaksi ────────────────────────────────── */}
      <div className="overflow-hidden bg-white/80 backdrop-blur-xl rounded-3xl border border-suka-brown/10 shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-700">
            <thead className="bg-suka-cream/20 text-suka-gray-500 font-semibold uppercase text-xs tracking-wider border-b border-suka-brown/5">
              <tr>
                <th className="p-4 sm:p-5">Tanggal &amp; Waktu</th>
                <th className="p-4 sm:p-5">Outlet</th>
                <th className="p-4 sm:p-5">Tipe Transaksi</th>
                <th className="p-4 sm:p-5">Kategori &amp; Keterangan</th>
                <th className="p-4 sm:p-5 text-right">Nominal</th>
                <th className="p-4 sm:p-5">Pembuat Kas</th>
                <th className="p-4 sm:p-5 text-center">Bukti Nota</th>
              </tr>
            </thead>
            <motion.tbody 
              initial="hidden"
              animate="visible"
              variants={{ visible: { transition: { staggerChildren: 0.05 } }, hidden: {} }}
              className="divide-y divide-suka-gray-100 font-medium text-suka-ink"
            >
              {filteredData.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-slate-400">
                    Tidak ada transaksi petty cash yang sesuai filter.
                  </td>
                </tr>
              ) : (
                filteredData.map((t) => (
                  <motion.tr 
                    key={t.id} 
                    variants={{ hidden: { opacity: 0, y: 10 }, visible: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 300, damping: 24 } } }}
                    className="hover:bg-orange-50/30 transition-colors group"
                  >
                    {/* Tanggal & Waktu */}
                    <td className="p-4 sm:p-5">
                      <div className="font-bold text-slate-900">{formatDate(t.transaction_date)}</div>
                      <div className="text-xs text-slate-500 font-mono mt-0.5">
                        {formatTime(t.transaction_date)} WIB
                      </div>
                    </td>

                    {/* Outlet */}
                    <td className="p-4 sm:p-5">
                      <div className="font-bold text-slate-800 flex items-center gap-1.5">
                        <Building2 size={15} className="text-suka-orange" />
                        {t.outlet_name}
                      </div>
                    </td>

                    {/* Tipe Badge */}
                    <td className="p-4 sm:p-5">
                      {t.type === 'in' ? (
                        <span className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-800 border border-emerald-200/80">
                          <TrendingUp size={14} /> Modal Kas Masuk
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 rounded-lg bg-rose-50 px-2.5 py-1 text-xs font-semibold text-rose-800 border border-rose-200/80">
                          <TrendingDown size={14} /> Pengeluaran Kas
                        </span>
                      )}
                    </td>

                    {/* Kategori & Keterangan */}
                    <td className="p-4 sm:p-5">
                      <div className="font-bold text-slate-900">{t.category}</div>
                      <div className="text-xs text-slate-500 max-w-xs truncate mt-1">
                        {t.description}
                      </div>
                    </td>

                    {/* Nominal */}
                    <td className="p-4 sm:p-5 text-right font-black tabular-nums text-base">
                      <span className={t.type === 'in' ? 'text-emerald-600' : 'text-red-600'}>
                        {t.type === 'in' ? '+ ' : '- '}
                        {formatRp(t.amount)}
                      </span>
                    </td>

                    {/* Pembuat Kas */}
                    <td className="p-4 sm:p-5 font-semibold text-slate-800">
                      {t.staff_name}
                    </td>

                    {/* Bukti Nota */}
                    <td className="p-4 sm:p-5 text-center">
                      {t.receipt_url ? (
                        <button
                          onClick={() =>
                            openReceiptModal(
                              t.receipt_url!,
                              `Nota Petty Cash - ${t.category} (${formatRp(t.amount)})`
                            )
                          }
                          className="inline-flex items-center gap-1.5 rounded-xl bg-orange-50 border border-orange-200 px-3 py-1.5 text-xs font-bold text-suka-orange hover:bg-suka-orange hover:text-white transition-all hover:scale-105 active:scale-95 shadow-sm"
                        >
                          <Receipt size={14} />
                          Lihat Nota
                        </button>
                      ) : (
                        <span className="text-slate-400 text-xs italic font-normal">Tanpa Nota</span>
                      )}
                    </td>
                  </motion.tr>
                ))
              )}
            </motion.tbody>
          </table>
        </div>
      </div>
      </div>

      {/* Modal Popup Bukti Nota */}
      <ReceiptModal
        isOpen={!!activeReceiptUrl}
        imageUrl={activeReceiptUrl}
        title={activeReceiptTitle}
        onClose={() => setActiveReceiptUrl(null)}
      />
    </div>
  )
}

