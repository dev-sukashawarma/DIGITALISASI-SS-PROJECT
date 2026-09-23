'use client'

import React, { useState, useTransition, useMemo } from 'react'
import {
  DollarSign,
  TrendingDown,
  TrendingUp,
  Store,
  Calendar,
  Search,
  Plus,
  Download,
  Edit2,
  Trash2,
  AlertCircle,
  CheckCircle2,
  ExternalLink,
  Receipt,
  FileText,
  Filter,
  Layers,
  Sparkles,
  ArrowUpDown,
  RotateCw,
  UtensilsCrossed,
} from 'lucide-react'
import {
  type OpexSummary,
  type OpexItem,
  getOpexData,
  createMarcomExpense,
  updateMarcomExpense,
  updateOpexItem,
  deleteMarcomExpense,
} from '@/app/actions/opex'
import { MARCOM_EXPENSE_CATEGORIES } from '@/lib/opex-constants'

interface OpexViewProps {
  initialSummary: OpexSummary
  outlets: Array<{ id: string; name: string; type?: string }>
  userRole: string
}

const MONTH_NAMES = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
]

export default function OpexView({ initialSummary, outlets, userRole }: OpexViewProps) {
  const [summary, setSummary] = useState<OpexSummary>(initialSummary)
  const [selectedMonth, setSelectedMonth] = useState<number>(initialSummary.periodMonth)
  const [selectedYear, setSelectedYear] = useState<number>(initialSummary.periodYear)
  const [outletFilter, setOutletFilter] = useState<string>('ALL')
  const [sourceFilter, setSourceFilter] = useState<'ALL' | 'ENDORSEMENT' | 'HPP_MENU' | 'ADS' | 'MANUAL'>('ALL')
  const [searchTerm, setSearchTerm] = useState('')
  const [isPending, startTransition] = useTransition()
  const [bannerMessage, setBannerMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  // Modal States
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingItem, setEditingItem] = useState<OpexItem | null>(null)
  const [deleteConfirmItem, setDeleteConfirmItem] = useState<OpexItem | null>(null)

  // Form States
  const [formDate, setFormDate] = useState<string>(new Date().toISOString().split('T')[0])
  const [formOutletId, setFormOutletId] = useState<string>('GLOBAL')
  const [formCategory, setFormCategory] = useState<string>('CETAK_BRANDING')
  const [formAmount, setFormAmount] = useState<string>('')
  const [formDescription, setFormDescription] = useState<string>('')
  const [formPaymentSource, setFormPaymentSource] = useState<string>('transfer_pusat')
  const [formReceiptUrl, setFormReceiptUrl] = useState<string>('')
  const [formError, setFormError] = useState<string>('')

  const formatRupiah = (val: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      maximumFractionDigits: 0,
    }).format(val)
  }

  const loadData = (m: number, y: number, out: string) => {
    startTransition(async () => {
      try {
        const res = await getOpexData(m, y, out)
        setSummary(res)
      } catch (err: any) {
        setBannerMessage({ type: 'error', text: err?.message || 'Gagal memuat data OPEX' })
      }
    })
  }

  const handlePeriodChange = (m: number, y: number) => {
    setSelectedMonth(m)
    setSelectedYear(y)
    loadData(m, y, outletFilter)
  }

  const handleOutletFilterChange = (out: string) => {
    setOutletFilter(out)
    loadData(selectedMonth, selectedYear, out)
  }

  const handleOpenAdd = () => {
    setEditingItem(null)
    setFormDate(new Date().toISOString().split('T')[0])
    setFormOutletId('GLOBAL')
    setFormCategory('CETAK_BRANDING')
    setFormAmount('')
    setFormDescription('')
    setFormPaymentSource('transfer_pusat')
    setFormReceiptUrl('')
    setFormError('')
    setIsModalOpen(true)
  }

  const handleOpenEdit = (item: OpexItem) => {
    setEditingItem(item)
    setFormDate(item.date)
    setFormOutletId(item.outletId || 'GLOBAL')
    setFormCategory(item.category)
    setFormAmount(item.amount.toString())
    setFormDescription(item.description)
    setFormPaymentSource(item.paymentSource)
    setFormReceiptUrl(item.receiptUrl || '')
    setFormError('')
    setIsModalOpen(true)
  }

  const handleSaveExpense = async (e: React.FormEvent) => {
    e.preventDefault()
    setFormError('')

    const formData = new FormData()
    if (editingItem) {
      formData.append('id', editingItem.sourceId)
      formData.append('source', editingItem.source)
      formData.append('sourceId', editingItem.sourceId)
      formData.append('category', formCategory)
      formData.append('date', formDate)
      formData.append('expenseDate', formDate)
      formData.append('outletId', formOutletId)
      formData.append('amount', formAmount)
      formData.append('description', formDescription)
      formData.append('paymentSource', formPaymentSource)
      if (formReceiptUrl) formData.append('receiptUrl', formReceiptUrl)
    } else {
      formData.append('expenseDate', formDate)
      formData.append('outletId', formOutletId)
      formData.append('category', formCategory)
      formData.append('amount', formAmount)
      formData.append('description', formDescription)
      formData.append('paymentSource', formPaymentSource)
      if (formReceiptUrl) formData.append('receiptUrl', formReceiptUrl)
    }

    startTransition(async () => {
      const res = editingItem
        ? await updateOpexItem({}, formData)
        : await createMarcomExpense({}, formData)

      if (res?.error) {
        setFormError(res.error)
      } else {
        setIsModalOpen(false)
        setBannerMessage({
          type: 'success',
          text: editingItem
            ? 'Perubahan pengeluaran berhasil disimpan dan disinkronkan ke Finance!'
            : 'Pengeluaran baru berhasil dicatat dan disinkronkan ke Finance!',
        })
        loadData(selectedMonth, selectedYear, outletFilter)
      }
    })
  }

  const handleDeleteExpense = async () => {
    if (!deleteConfirmItem) return
    startTransition(async () => {
      const res = await deleteMarcomExpense(deleteConfirmItem.sourceId)
      if (res?.error) {
        setBannerMessage({ type: 'error', text: res.error })
      } else {
        setBannerMessage({
          type: 'success',
          text: 'Pengeluaran berhasil dihapus dari Marcom dan Finance.',
        })
        setDeleteConfirmItem(null)
        loadData(selectedMonth, selectedYear, outletFilter)
      }
    })
  }

  // Filter items based on source and search query
  const filteredItems = useMemo(() => {
    return summary.items.filter((item) => {
      let matchSource = true
      if (sourceFilter === 'HPP_MENU') {
        matchSource = item.category === 'HPP_MENU'
      } else if (sourceFilter === 'ENDORSEMENT') {
        matchSource = item.source === 'ENDORSEMENT' && item.category !== 'HPP_MENU'
      } else if (sourceFilter !== 'ALL') {
        matchSource = item.source === sourceFilter
      }

      const query = searchTerm.toLowerCase().trim()
      const matchSearch =
        !query ||
        item.description.toLowerCase().includes(query) ||
        item.outletName.toLowerCase().includes(query) ||
        item.categoryLabel.toLowerCase().includes(query)
      return matchSource && matchSearch
    })
  }, [summary.items, sourceFilter, searchTerm])

  const exportCSV = () => {
    const headers = ['Tanggal', 'Sumber', 'Kategori', 'Alokasi Outlet', 'Keterangan', 'Sumber Dana', 'Nominal (Rp)']
    const rows = filteredItems.map((item) => [
      `"${item.date}"`,
      `"${item.category === 'HPP_MENU' ? 'HPP KOL' : item.source}"`,
      `"${item.categoryLabel}"`,
      `"${item.outletName}"`,
      `"${item.description.replace(/"/g, '""')}"`,
      `"${item.paymentSource === 'cogs_internal' ? 'Bahan Baku (Non-Tunai)' : item.paymentSource}"`,
      item.amount,
    ])
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n')
    const encodedUri = encodeURI(csvContent)
    const link = document.createElement('a')
    link.setAttribute('href', encodedUri)
    link.setAttribute('download', `OPEX_Marcom_${selectedMonth}_${selectedYear}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  return (
    <div className="space-y-6">
      {/* Banner Notifikasi */}
      {bannerMessage && (
        <div
          className={`p-4 rounded-xl flex items-center justify-between text-sm ${
            bannerMessage.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
              : 'bg-red-50 text-red-800 border border-red-200'
          }`}
        >
          <div className="flex items-center gap-2">
            {bannerMessage.type === 'success' ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            ) : (
              <AlertCircle className="w-5 h-5 text-red-600 shrink-0" />
            )}
            <span>{bannerMessage.text}</span>
          </div>
          <button
            type="button"
            onClick={() => setBannerMessage(null)}
            className="text-stone-400 hover:text-stone-600 text-xs font-semibold ml-4"
          >
            Tutup
          </button>
        </div>
      )}

      {/* Header Filter & Actions */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 bg-white p-4 rounded-2xl border border-[#EFE8DE] shadow-xs">
        {/* Periode Selector */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1.5 bg-[#FAF8F5] px-3 py-1.5 rounded-xl border border-[#EFE8DE]">
            <Calendar className="w-4 h-4 text-[#D9480F]" />
            <select
              value={selectedMonth}
              onChange={(e) => handlePeriodChange(parseInt(e.target.value, 10), selectedYear)}
              className="bg-transparent text-xs font-bold text-stone-800 focus:outline-none cursor-pointer"
            >
              {MONTH_NAMES.map((name, idx) => (
                <option key={idx + 1} value={idx + 1}>
                  {name}
                </option>
              ))}
            </select>
            <select
              value={selectedYear}
              onChange={(e) => handlePeriodChange(selectedMonth, parseInt(e.target.value, 10))}
              className="bg-transparent text-xs font-bold text-stone-800 focus:outline-none cursor-pointer border-l border-[#EFE8DE] pl-2"
            >
              {[2025, 2026, 2027].map((yr) => (
                <option key={yr} value={yr}>
                  {yr}
                </option>
              ))}
            </select>
          </div>

          {/* Filter Cabang Outlet */}
          <div className="flex items-center gap-1.5 bg-[#FAF8F5] px-3 py-1.5 rounded-xl border border-[#EFE8DE]">
            <Store className="w-4 h-4 text-stone-500" />
            <select
              value={outletFilter}
              onChange={(e) => handleOutletFilterChange(e.target.value)}
              className="bg-transparent text-xs font-medium text-stone-700 focus:outline-none cursor-pointer max-w-[170px]"
            >
              <option value="ALL">Semua Alokasi</option>
              <option value="GLOBAL">Kantor Pusat / Global</option>
              {outlets.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name}
                </option>
              ))}
            </select>
          </div>

          <button
            type="button"
            onClick={() => loadData(selectedMonth, selectedYear, outletFilter)}
            disabled={isPending}
            title="Refresh Data"
            className="p-2 rounded-xl bg-[#FAF8F5] hover:bg-stone-100 text-stone-600 border border-[#EFE8DE] transition-colors"
          >
            <RotateCw className={`w-3.5 h-3.5 ${isPending ? 'animate-spin text-[#D9480F]' : ''}`} />
          </button>
        </div>

        {/* Buttons */}
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={exportCSV}
            className="inline-flex items-center gap-1.5 px-3 py-2 bg-white hover:bg-stone-50 text-stone-700 border border-[#EFE8DE] rounded-xl text-xs font-semibold shadow-xs transition-all cursor-pointer"
          >
            <Download className="w-3.5 h-3.5 text-stone-500" />
            <span>Ekspor CSV</span>
          </button>

          <button
            type="button"
            onClick={handleOpenAdd}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#D9480F] hover:bg-[#B83808] text-white rounded-xl text-xs font-bold shadow-xs transition-all active:scale-95 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Catat Pengeluaran OPEX</span>
          </button>
        </div>
      </div>

      {/* KPI Cards Ringkasan */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3.5">
        {/* Total OPEX */}
        <div className="bg-white p-4 rounded-2xl border border-[#EFE8DE] shadow-xs">
          <div className="flex items-center justify-between text-stone-500 text-xs font-medium mb-1">
            <span>Total Realisasi OPEX</span>
            <span className="p-1.5 bg-stone-100 rounded-lg text-stone-700">
              <DollarSign className="w-3.5 h-3.5" />
            </span>
          </div>
          <div className="text-xl font-bold font-mono text-stone-900 truncate">
            {formatRupiah(summary.totalOpex)}
          </div>
          <p className="text-[11px] text-stone-500 mt-1">
            {summary.totalBudget > 0
              ? `${Math.round((summary.totalOpex / summary.totalBudget) * 100)}% dari target budget`
              : 'Target budget belum diisi'}
          </p>
        </div>

        {/* Endorsement Cash & Ongkir */}
        <div className="bg-white p-4 rounded-2xl border border-[#EFE8DE] shadow-xs">
          <div className="flex items-center justify-between text-stone-500 text-xs font-medium mb-1">
            <span>Endorsement Cash</span>
            <span className="p-1.5 bg-purple-50 text-purple-700 rounded-lg">
              <Receipt className="w-3.5 h-3.5" />
            </span>
          </div>
          <div className="text-xl font-bold font-mono text-purple-900 truncate">
            {formatRupiah(summary.totalEndorsement)}
          </div>
          <p className="text-[11px] text-stone-500 mt-1">Rate card paid & ongkir</p>
        </div>

        {/* HPP Menu Jatah KOL */}
        <div className="bg-white p-4 rounded-2xl border border-[#EFE8DE] shadow-xs">
          <div className="flex items-center justify-between text-stone-500 text-xs font-medium mb-1">
            <span>HPP Menu KOL</span>
            <span className="p-1.5 bg-rose-50 text-rose-700 rounded-lg">
              <UtensilsCrossed className="w-3.5 h-3.5" />
            </span>
          </div>
          <div className="text-xl font-bold font-mono text-rose-900 truncate">
            {formatRupiah(summary.totalHppMenu || 0)}
          </div>
          <p className="text-[11px] text-stone-500 mt-1">Jatah menu complimentary</p>
        </div>

        {/* Ads Spent */}
        <div className="bg-white p-4 rounded-2xl border border-[#EFE8DE] shadow-xs">
          <div className="flex items-center justify-between text-stone-500 text-xs font-medium mb-1">
            <span>Ads & Paid Traffic</span>
            <span className="p-1.5 bg-blue-50 text-blue-700 rounded-lg">
              <Layers className="w-3.5 h-3.5" />
            </span>
          </div>
          <div className="text-xl font-bold font-mono text-blue-900 truncate">
            {formatRupiah(summary.totalAds)}
          </div>
          <p className="text-[11px] text-stone-500 mt-1">Realisasi spent TikTok/IG Ads</p>
        </div>

        {/* Manual Operasional */}
        <div className="bg-white p-4 rounded-2xl border border-[#EFE8DE] shadow-xs">
          <div className="flex items-center justify-between text-stone-500 text-xs font-medium mb-1">
            <span>Operasional Manual</span>
            <span className="p-1.5 bg-amber-50 text-amber-700 rounded-lg">
              <Sparkles className="w-3.5 h-3.5" />
            </span>
          </div>
          <div className="text-xl font-bold font-mono text-amber-900 truncate">
            {formatRupiah(summary.totalManual)}
          </div>
          <p className="text-[11px] text-stone-500 mt-1">Cetak, tools, transport, event</p>
        </div>

        {/* Sisa Budget */}
        <div className="bg-white p-4 rounded-2xl border border-[#EFE8DE] shadow-xs">
          <div className="flex items-center justify-between text-stone-500 text-xs font-medium mb-1">
            <span>Sisa Budget Marcom</span>
            <span
              className={`p-1.5 rounded-lg ${
                summary.remainingBudget >= 0
                  ? 'bg-emerald-50 text-emerald-700'
                  : 'bg-red-50 text-red-700'
              }`}
            >
              {summary.remainingBudget >= 0 ? (
                <TrendingUp className="w-3.5 h-3.5" />
              ) : (
                <TrendingDown className="w-3.5 h-3.5" />
              )}
            </span>
          </div>
          <div
            className={`text-xl font-bold font-mono truncate ${
              summary.remainingBudget >= 0 ? 'text-emerald-700' : 'text-red-700'
            }`}
          >
            {formatRupiah(summary.remainingBudget)}
          </div>
          <p className="text-[11px] text-stone-500 mt-1">
            Target: {formatRupiah(summary.totalBudget)}
          </p>
        </div>
      </div>

      {/* Filter Sumber Biaya & Search Bar */}
      <div className="bg-white p-4 rounded-2xl border border-[#EFE8DE] shadow-xs space-y-3">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
          {/* Source Tabs */}
          <div className="flex items-center gap-1.5 bg-[#FAF8F5] p-1 rounded-xl border border-[#EFE8DE] w-full sm:w-auto overflow-x-auto">
            <button
              type="button"
              onClick={() => setSourceFilter('ALL')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
                sourceFilter === 'ALL'
                  ? 'bg-[#1C1917] text-white shadow-xs'
                  : 'text-stone-600 hover:text-stone-900'
              }`}
            >
              Semua ({summary.items.length})
            </button>
            <button
              type="button"
              onClick={() => setSourceFilter('ENDORSEMENT')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
                sourceFilter === 'ENDORSEMENT'
                  ? 'bg-[#1C1917] text-white shadow-xs'
                  : 'text-stone-600 hover:text-stone-900'
              }`}
            >
              Endorsement Cash
            </button>
            <button
              type="button"
              onClick={() => setSourceFilter('HPP_MENU')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
                sourceFilter === 'HPP_MENU'
                  ? 'bg-[#1C1917] text-white shadow-xs'
                  : 'text-stone-600 hover:text-stone-900'
              }`}
            >
              HPP Menu KOL
            </button>
            <button
              type="button"
              onClick={() => setSourceFilter('ADS')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
                sourceFilter === 'ADS'
                  ? 'bg-[#1C1917] text-white shadow-xs'
                  : 'text-stone-600 hover:text-stone-900'
              }`}
            >
              Ads
            </button>
            <button
              type="button"
              onClick={() => setSourceFilter('MANUAL')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
                sourceFilter === 'MANUAL'
                  ? 'bg-[#1C1917] text-white shadow-xs'
                  : 'text-stone-600 hover:text-stone-900'
              }`}
            >
              Manual
            </button>
          </div>

          {/* Search Box */}
          <div className="relative w-full sm:w-72">
            <Search className="w-3.5 h-3.5 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Cari deskripsi, kategori, outlet..."
              className="w-full pl-9 pr-3 py-1.5 text-xs border border-[#EFE8DE] rounded-xl bg-white focus:outline-none focus:border-[#D9480F]"
            />
          </div>
        </div>

        {/* Tabel Pengeluaran OPEX */}
        <div className="overflow-x-auto rounded-xl border border-[#EFE8DE]">
          <table className="w-full text-left text-xs text-stone-700">
            <thead className="bg-[#FAF8F5] text-stone-600 uppercase text-[10px] tracking-wider border-b border-[#EFE8DE]">
              <tr>
                <th className="py-3 px-3.5 font-bold">Tanggal</th>
                <th className="py-3 px-3.5 font-bold">Sumber & Kategori</th>
                <th className="py-3 px-3.5 font-bold">Alokasi Outlet</th>
                <th className="py-3 px-3.5 font-bold">Keterangan</th>
                <th className="py-3 px-3.5 font-bold">Metode / Dana</th>
                <th className="py-3 px-3.5 font-bold text-right">Nominal (Rp)</th>
                <th className="py-3 px-3.5 font-bold text-center">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#EFE8DE] bg-white font-medium">
              {filteredItems.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-stone-400">
                    <FileText className="w-7 h-7 mx-auto mb-1.5 opacity-40 text-stone-400" />
                    <span>Belum ada data pengeluaran untuk filter periode ini.</span>
                  </td>
                </tr>
              ) : (
                filteredItems.map((item) => (
                  <tr key={item.id} className="hover:bg-stone-50/80 transition-colors">
                    {/* Tanggal */}
                    <td className="py-3 px-3.5 whitespace-nowrap text-stone-600 font-mono">
                      {item.date}
                    </td>

                    {/* Sumber & Kategori */}
                    <td className="py-3 px-3.5 whitespace-nowrap">
                      <div className="flex items-center gap-1.5">
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${
                            item.category === 'HPP_MENU'
                              ? 'bg-rose-50 text-rose-700 border-rose-200'
                              : item.source === 'ENDORSEMENT'
                              ? 'bg-purple-50 text-purple-700 border-purple-200'
                              : item.source === 'ADS'
                              ? 'bg-blue-50 text-blue-700 border-blue-200'
                              : 'bg-amber-50 text-amber-700 border-amber-200'
                          }`}
                        >
                          {item.category === 'HPP_MENU' ? 'HPP KOL' : item.source}
                        </span>
                        <span className="text-stone-800 font-semibold">{item.categoryLabel}</span>
                      </div>
                    </td>

                    {/* Alokasi Outlet */}
                    <td className="py-3 px-3.5 whitespace-nowrap">
                      <span className="inline-flex items-center gap-1 text-stone-700">
                        <Store className="w-3 h-3 text-stone-400" />
                        <span>{item.outletName}</span>
                      </span>
                    </td>

                    {/* Keterangan */}
                    <td className="py-3 px-3.5 max-w-xs truncate text-stone-800" title={item.description}>
                      {item.description}
                      {item.receiptUrl && (
                        <a
                          href={item.receiptUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-0.5 text-[#D9480F] hover:underline ml-1.5"
                        >
                          [Nota <ExternalLink className="w-2.5 h-2.5 inline" />]
                        </a>
                      )}
                    </td>

                    {/* Metode Pembayaran */}
                    <td className="py-3 px-3.5 whitespace-nowrap text-stone-600">
                      {item.paymentSource === 'cogs_internal' ? (
                        <span className="text-[11px] font-semibold text-rose-800 bg-rose-50 border border-rose-200/80 px-2 py-0.5 rounded-md">
                          Bahan Baku / Non-Tunai
                        </span>
                      ) : (
                        <span className="capitalize">{item.paymentSource.replace('_', ' ')}</span>
                      )}
                    </td>

                    {/* Nominal */}
                    <td className="py-3 px-3.5 whitespace-nowrap text-right font-mono font-bold text-stone-900">
                      {formatRupiah(item.amount)}
                    </td>

                    {/* Aksi */}
                    <td className="py-3 px-3.5 whitespace-nowrap text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleOpenEdit(item)}
                          className="p-1.5 text-stone-500 hover:text-stone-900 hover:bg-stone-100 rounded-lg transition-colors cursor-pointer"
                          title="Edit Pengeluaran"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        {item.source === 'MANUAL' && (
                          <button
                            type="button"
                            onClick={() => setDeleteConfirmItem(item)}
                            className="p-1.5 text-stone-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                            title="Hapus Pengeluaran"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL: TAMBAH / EDIT PENGELUARAN MANUAL */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl max-w-lg w-full p-5 sm:p-6 shadow-xl border border-[#EFE8DE] space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-[#EFE8DE] pb-3">
              <h3 className="text-base font-bold text-stone-900">
                {editingItem
                  ? editingItem.category === 'HPP_MENU'
                    ? 'Edit HPP Menu Jatah KOL'
                    : editingItem.category === 'transport'
                    ? 'Edit Ongkir Sample Delivery'
                    : editingItem.category === 'endorsement'
                    ? 'Edit Fee Rate Card Endorsement'
                    : editingItem.source === 'ADS'
                    ? 'Edit Realisasi Biaya Ads'
                    : 'Edit Pengeluaran Manual'
                  : 'Catat Pengeluaran OPEX Marcom'}
              </h3>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="text-stone-400 hover:text-stone-600 p-1 rounded-lg cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Context Info Box for Endorsement / Ads */}
            {editingItem && editingItem.source === 'ENDORSEMENT' && (
              <div className="p-3 bg-purple-50/70 border border-purple-200/80 rounded-xl text-stone-800 text-xs space-y-1">
                <div className="flex items-center justify-between font-bold text-purple-900">
                  <span>Sumber: Endorsement ({editingItem.outletName})</span>
                  <a
                    href="/dashboard/endorsements"
                    target="_blank"
                    rel="noreferrer"
                    className="text-[#D9480F] hover:underline inline-flex items-center gap-1 font-semibold"
                  >
                    Buka Endorsements <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
                <p className="text-[11px] text-stone-600">
                  {editingItem.category === 'HPP_MENU'
                    ? 'Perubahan nominal HPP di sini akan otomatis memperbarui nilai HPP menu pada endorsement KOL dan pagu budget outlet, serta disinkronkan ke Finance.'
                    : 'Perubahan nominal di sini akan otomatis memperbarui data biaya endorsement KOL dan disinkronkan ke Finance.'}
                </p>
              </div>
            )}

            {editingItem && editingItem.source === 'ADS' && (
              <div className="p-3 bg-blue-50/70 border border-blue-200/80 rounded-xl text-stone-800 text-xs space-y-1">
                <div className="flex items-center justify-between font-bold text-blue-900">
                  <span>Sumber: Ads / Paid Traffic ({editingItem.outletName})</span>
                  <a
                    href="/dashboard/ads"
                    target="_blank"
                    rel="noreferrer"
                    className="text-[#D9480F] hover:underline inline-flex items-center gap-1 font-semibold"
                  >
                    Buka Ads <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
                <p className="text-[11px] text-stone-600">
                  Perubahan nominal spent di sini akan memperbarui realisasi biaya kampanye iklan dan disinkronkan ke Finance.
                </p>
              </div>
            )}

            {formError && (
              <div className="p-3 bg-red-50 text-red-700 border border-red-200 rounded-xl text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleSaveExpense} className="space-y-3.5 text-xs">
              {/* Tanggal & Alokasi Outlet */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-stone-700 mb-1">
                    Tanggal Pengeluaran *
                  </label>
                  <input
                    type="date"
                    required
                    value={formDate}
                    onChange={(e) => setFormDate(e.target.value)}
                    className="w-full px-3 py-2 border border-[#EFE8DE] rounded-xl bg-white focus:outline-none focus:border-[#D9480F]"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-stone-700 mb-1">
                    Alokasi Outlet / Pusat *
                  </label>
                  {editingItem && editingItem.source !== 'MANUAL' ? (
                    <input
                      type="text"
                      disabled
                      value={editingItem.outletName}
                      className="w-full px-3 py-2 border border-[#EFE8DE] rounded-xl bg-stone-100 text-stone-600 cursor-not-allowed font-medium"
                    />
                  ) : (
                    <select
                      value={formOutletId}
                      onChange={(e) => setFormOutletId(e.target.value)}
                      className="w-full px-3 py-2 border border-[#EFE8DE] rounded-xl bg-white focus:outline-none focus:border-[#D9480F]"
                    >
                      <option value="GLOBAL">Kantor Pusat / Pengeluaran Global</option>
                      {outlets.map((o) => (
                        <option key={o.id} value={o.id}>
                          {o.name}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              </div>

              {/* Kategori & Sumber Dana */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-stone-700 mb-1">
                    Kategori Pengeluaran *
                  </label>
                  {editingItem && editingItem.source !== 'MANUAL' ? (
                    <input
                      type="text"
                      disabled
                      value={editingItem.categoryLabel}
                      className="w-full px-3 py-2 border border-[#EFE8DE] rounded-xl bg-stone-100 text-stone-600 cursor-not-allowed font-medium"
                    />
                  ) : (
                    <select
                      value={formCategory}
                      onChange={(e) => setFormCategory(e.target.value)}
                      className="w-full px-3 py-2 border border-[#EFE8DE] rounded-xl bg-white focus:outline-none focus:border-[#D9480F]"
                    >
                      {Object.entries(MARCOM_EXPENSE_CATEGORIES).map(([val, label]) => (
                        <option key={val} value={val}>
                          {label}
                        </option>
                      ))}
                    </select>
                  )}
                </div>

                <div>
                  <label className="block font-semibold text-stone-700 mb-1">
                    Sumber Dana / Pembayaran *
                  </label>
                  {editingItem && editingItem.source !== 'MANUAL' ? (
                    <input
                      type="text"
                      disabled
                      value={
                        editingItem.paymentSource === 'cogs_internal'
                          ? 'Bahan Baku / Non-Tunai'
                          : editingItem.paymentSource.replace('_', ' ')
                      }
                      className="w-full px-3 py-2 border border-[#EFE8DE] rounded-xl bg-stone-100 text-stone-600 cursor-not-allowed font-medium capitalize"
                    />
                  ) : (
                    <select
                      value={formPaymentSource}
                      onChange={(e) => setFormPaymentSource(e.target.value)}
                      className="w-full px-3 py-2 border border-[#EFE8DE] rounded-xl bg-white focus:outline-none focus:border-[#D9480F]"
                    >
                      <option value="transfer_pusat">Transfer Kantor Pusat</option>
                      <option value="petty_cash">Kas Operasional / Petty Cash</option>
                      <option value="reimburse">Reimburse Karyawan</option>
                    </select>
                  )}
                </div>
              </div>

              {/* Nominal Biaya */}
              <div>
                <label className="block font-semibold text-stone-700 mb-1">
                  {editingItem?.category === 'HPP_MENU'
                    ? 'Nominal HPP Menu (Rp) *'
                    : editingItem?.category === 'endorsement'
                    ? 'Nominal Fee Rate Card (Rp) *'
                    : editingItem?.category === 'transport'
                    ? 'Nominal Ongkir (Rp) *'
                    : editingItem?.source === 'ADS'
                    ? 'Nominal Spent Iklan (Rp) *'
                    : 'Nominal Biaya (Rp) *'}
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 font-mono text-stone-400 font-bold">
                    Rp
                  </span>
                  <input
                    type="number"
                    required
                    min="0"
                    placeholder="Contoh: 150000"
                    value={formAmount}
                    onChange={(e) => setFormAmount(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 border border-[#EFE8DE] rounded-xl bg-white focus:outline-none focus:border-[#D9480F] font-mono font-bold"
                  />
                </div>
              </div>

              {/* Deskripsi */}
              <div>
                <label className="block font-semibold text-stone-700 mb-1">
                  {editingItem?.category === 'HPP_MENU'
                    ? 'Rincian Menu Complimentary (Jatah KOL)'
                    : editingItem?.category === 'endorsement'
                    ? 'Catatan Pembayaran Fee'
                    : editingItem?.category === 'transport'
                    ? 'Keterangan / Nomor Resi'
                    : editingItem?.source === 'ADS'
                    ? 'Nama Akun / Kampanye Iklan'
                    : 'Keterangan / Deskripsi *'}
                </label>
                <textarea
                  required={!editingItem || editingItem.source === 'MANUAL'}
                  rows={2}
                  placeholder={
                    editingItem?.category === 'HPP_MENU'
                      ? 'Contoh: 1x Shawarma Beef Large, 1x Ice Tea'
                      : 'Contoh: Cetak x-banner promo bundling 2 pcs cabang Pajajaran'
                  }
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  className="w-full px-3 py-2 border border-[#EFE8DE] rounded-xl bg-white focus:outline-none focus:border-[#D9480F]"
                />
              </div>

              {/* URL Nota / Bukti Struk */}
              {(!editingItem || editingItem.source === 'MANUAL' || editingItem.source === 'ADS') && (
                <div>
                  <label className="block font-semibold text-stone-700 mb-1">
                    Link Bukti / Nota (Opsional)
                  </label>
                  <input
                    type="url"
                    placeholder="https://drive.google.com/... atau link foto bukti struk"
                    value={formReceiptUrl}
                    onChange={(e) => setFormReceiptUrl(e.target.value)}
                    className="w-full px-3 py-2 border border-[#EFE8DE] rounded-xl bg-white focus:outline-none focus:border-[#D9480F]"
                  />
                </div>
              )}

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-[#EFE8DE]">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-stone-600 hover:bg-stone-100 rounded-xl font-semibold transition-colors"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="px-5 py-2 bg-[#D9480F] hover:bg-[#B83808] text-white rounded-xl font-bold transition-all shadow-xs disabled:opacity-50"
                >
                  {isPending ? 'Menyimpan...' : editingItem ? 'Simpan Perubahan' : 'Catat Pengeluaran'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL KONFIRMASI HAPUS */}
      {deleteConfirmItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl max-w-sm w-full p-5 shadow-xl border border-[#EFE8DE] space-y-3">
            <h4 className="text-sm font-bold text-stone-900">Hapus Pengeluaran Ini?</h4>
            <p className="text-xs text-stone-600">
              Pengeluaran &quot;{deleteConfirmItem.description}&quot; sebesar{' '}
              <strong className="text-stone-900">{formatRupiah(deleteConfirmItem.amount)}</strong> akan
              dihapus dari Marcom dan catatan Finance Supabase.
            </p>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setDeleteConfirmItem(null)}
                className="px-3.5 py-1.5 text-xs text-stone-600 hover:bg-stone-100 rounded-xl font-semibold"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleDeleteExpense}
                disabled={isPending}
                className="px-4 py-1.5 text-xs bg-red-600 hover:bg-red-700 text-white rounded-xl font-bold transition-colors shadow-xs"
              >
                {isPending ? 'Menghapus...' : 'Hapus'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
