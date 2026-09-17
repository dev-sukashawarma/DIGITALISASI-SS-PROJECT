'use client'

import { useState, useTransition, useMemo } from 'react'
import {
  CreditCard,
  Search,
  Filter,
  CheckCircle2,
  Clock,
  AlertCircle,
  Copy,
  Check,
  Download,
  DollarSign,
  Utensils,
  Store,
  Calendar,
  ExternalLink,
  ChevronDown,
  RefreshCw,
  HelpCircle,
  Truck,
} from 'lucide-react'
import { updatePaymentStatus, updateDraftStatus, batchUpdatePayments } from '@/app/actions/endorsements'
import { SerializedEndorsement } from './EndorsementList'

interface EndorsementFinanceViewProps {
  endorsements: SerializedEndorsement[]
  outlets: Array<{ id: string; name: string }>
  userRole: string
  onEdit: (item: SerializedEndorsement) => void
}

export default function EndorsementFinanceView({
  endorsements,
  outlets,
  userRole,
  onEdit,
}: EndorsementFinanceViewProps) {
  const [search, setSearch] = useState('')
  const [outletFilter, setOutletFilter] = useState('')
  const [paymentFilter, setPaymentFilter] = useState('ALL')
  const [draftFilter, setDraftFilter] = useState('ALL')
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [copiedBankId, setCopiedBankId] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const [bannerMessage, setBannerMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  // Finance KPI Calculations
  const metrics = useMemo(() => {
    let totalUnpaidCash = 0
    let unpaidCount = 0
    let totalPaidCash = 0
    let paidCount = 0
    let totalHpp = 0
    let barterCount = 0
    let totalCommitment = 0

    for (const item of endorsements) {
      const rate = item.rateCard || 0
      const hpp = item.hppMenu || 0
      const shipping = item.shippingCost || 0
      totalHpp += hpp
      totalCommitment += rate + hpp + shipping

      if (item.paymentStatus === 'PAID') {
        totalPaidCash += rate
        paidCount++
      } else if (item.paymentStatus === 'BARTER') {
        barterCount++
      } else {
        // UNPAID or DOWN_PAYMENT
        totalUnpaidCash += rate
        unpaidCount++
      }
    }

    return {
      totalUnpaidCash,
      unpaidCount,
      totalPaidCash,
      paidCount,
      totalHpp,
      barterCount,
      totalCommitment,
    }
  }, [endorsements])

  // Filtered List
  const filteredList = useMemo(() => {
    return endorsements.filter((item) => {
      const q = search.toLowerCase().trim()
      const bankInfo = item.bankAccountCustom || item.kol.bankAccount || ''
      const matchesSearch =
        !q ||
        item.kol.name.toLowerCase().includes(q) ||
        item.outlet.name.toLowerCase().includes(q) ||
        bankInfo.toLowerCase().includes(q) ||
        (item.kol.phoneNumber && item.kol.phoneNumber.includes(q))

      const matchesOutlet = !outletFilter || item.outletId === outletFilter

      let matchesPayment = true
      if (paymentFilter === 'UNPAID') matchesPayment = item.paymentStatus === 'UNPAID' || item.paymentStatus === 'DOWN_PAYMENT'
      else if (paymentFilter === 'PAID') matchesPayment = item.paymentStatus === 'PAID'
      else if (paymentFilter === 'BARTER') matchesPayment = item.paymentStatus === 'BARTER'

      let matchesDraft = true
      if (draftFilter === 'APPROVED') matchesDraft = item.draftStatus === 'APPROVED'
      else if (draftFilter === 'PENDING') matchesDraft = item.draftStatus === 'PENDING'

      return matchesSearch && matchesOutlet && matchesPayment && matchesDraft
    })
  }, [endorsements, search, outletFilter, paymentFilter, draftFilter])

  const formatRupiah = (val: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      maximumFractionDigits: 0,
    }).format(val)
  }

  // Copy to clipboard helper
  const handleCopyBank = (id: string, text: string) => {
    navigator.clipboard.writeText(text)
    setCopiedBankId(id)
    setTimeout(() => setCopiedBankId(null), 2000)
  }

  // Toggle Draft Status
  const handleToggleDraft = (id: string, currentStatus: string) => {
    const nextStatus = currentStatus === 'APPROVED' ? 'PENDING' : 'APPROVED'
    startTransition(async () => {
      const res = await updateDraftStatus(id, nextStatus)
      if (res?.error) {
        setBannerMessage({ type: 'error', text: res.error })
      } else {
        setBannerMessage({
          type: 'success',
          text: `Status draft diperbarui ke ${nextStatus === 'APPROVED' ? 'Disetujui (Siap Bayar)' : 'Pending'}`,
        })
      }
    })
  }

  // Update Payment Status
  const handleUpdatePayment = (id: string, newStatus: string) => {
    const today = new Date().toISOString().split('T')[0]
    startTransition(async () => {
      const res = await updatePaymentStatus(id, newStatus, newStatus === 'PAID' ? today : null)
      if (res?.error) {
        setBannerMessage({ type: 'error', text: res.error })
      } else {
        setBannerMessage({
          type: 'success',
          text: `Status pembayaran diperbarui ke ${newStatus}`,
        })
      }
    })
  }

  // Batch mark as paid
  const handleBatchMarkPaid = () => {
    if (selectedIds.length === 0) return
    const today = new Date().toISOString().split('T')[0]
    startTransition(async () => {
      const res = await batchUpdatePayments(selectedIds, 'PAID', today)
      if (res?.error) {
        setBannerMessage({ type: 'error', text: res.error })
      } else {
        setBannerMessage({
          type: 'success',
          text: `${selectedIds.length} endorsement berhasil ditandai Lunas!`,
        })
        setSelectedIds([])
      }
    })
  }

  // Export to CSV for bank bulk transfer
  const handleExportCSV = () => {
    const headers = [
      'No',
      'Tanggal Visit',
      'Nama KOL',
      'No Telepon',
      'Outlet',
      'Rate Card (Cash)',
      'Menu Gratis',
      'HPP Menu',
      'Total Biaya',
      'Status Draft',
      'Data Rekening Bank',
      'Status Pembayaran',
      'Tanggal Bayar',
      'Catatan Pembayaran',
    ]

    const rows = filteredList.map((item, idx) => {
      const bankInfo = (item.bankAccountCustom || item.kol.bankAccount || '').replace(/,/g, ' ')
      const menu = (item.menuGiven || '-').replace(/,/g, ' ')
      const notes = (item.paymentNotes || '-').replace(/,/g, ' ')

      return [
        idx + 1,
        item.scheduleDate,
        item.kol.name,
        item.kol.phoneNumber || '-',
        item.outlet.name,
        item.rateCard,
        menu,
        item.hppMenu,
        item.totalCost,
        item.draftStatus,
        bankInfo,
        item.paymentStatus,
        item.paymentDate || '-',
        notes,
      ].join(',')
    })

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows].join('\n')
    const encodedUri = encodeURI(csvContent)
    const link = document.createElement('a')
    link.setAttribute('href', encodedUri)
    link.setAttribute('download', `Rekap_Pembayaran_KOL_${new Date().toISOString().split('T')[0]}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  // Select all handler
  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      setSelectedIds(filteredList.map((i) => i.id))
    } else {
      setSelectedIds([])
    }
  }

  const handleToggleSelect = (id: string) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Banner message */}
      {bannerMessage && (
        <div
          className={`p-4 rounded-2xl border flex items-center justify-between gap-3 text-xs sm:text-sm ${
            bannerMessage.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-red-50 border-red-200 text-red-800'
          }`}
        >
          <div className="flex items-center gap-2">
            {bannerMessage.type === 'success' ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            ) : (
              <AlertCircle className="w-5 h-5 text-red-600 shrink-0" />
            )}
            <span className="font-semibold">{bannerMessage.text}</span>
          </div>
          <button
            onClick={() => setBannerMessage(null)}
            className="text-stone-500 hover:text-stone-700 text-xs font-bold"
          >
            Tutup
          </button>
        </div>
      )}

      {/* Finance KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-4 gap-4">
        {/* Card 1: Belum Dibayar */}
        <div className="p-4 sm:p-5 rounded-2xl bg-amber-500/10 border border-amber-500/20 shadow-2xs">
          <div className="flex items-center justify-between text-amber-800">
            <span className="text-xs font-bold uppercase tracking-wider">Belum Bayar (Pending)</span>
            <Clock className="w-4 h-4 text-amber-700" />
          </div>
          <p className="text-xl sm:text-2xl font-black text-amber-950 mt-2">
            {formatRupiah(metrics.totalUnpaidCash)}
          </p>
          <div className="flex items-center gap-2 mt-2 text-xs font-medium text-amber-800">
            <span className="px-2 py-0.5 rounded-full bg-amber-200 text-amber-900 font-bold">
              {metrics.unpaidCount} KOL
            </span>
            <span>Menunggu pembayaran</span>
          </div>
        </div>

        {/* Card 2: Sudah Terbayar (Cash) */}
        <div className="p-4 sm:p-5 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 shadow-2xs">
          <div className="flex items-center justify-between text-emerald-800">
            <span className="text-xs font-bold uppercase tracking-wider">Sudah Dibayar (Cash)</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-700" />
          </div>
          <p className="text-xl sm:text-2xl font-black text-emerald-950 mt-2">
            {formatRupiah(metrics.totalPaidCash)}
          </p>
          <div className="flex items-center gap-2 mt-2 text-xs font-medium text-emerald-800">
            <span className="px-2 py-0.5 rounded-full bg-emerald-200 text-emerald-900 font-bold">
              {metrics.paidCount} KOL
            </span>
            <span>Transfer terselesaikan</span>
          </div>
        </div>

        {/* Card 3: Biaya HPP Menu Complimentary */}
        <div className="p-4 sm:p-5 rounded-2xl bg-stone-100 border border-stone-200 shadow-2xs">
          <div className="flex items-center justify-between text-stone-700">
            <span className="text-xs font-bold uppercase tracking-wider">Biaya HPP Menu</span>
            <Utensils className="w-4 h-4 text-[#D9480F]" />
          </div>
          <p className="text-xl sm:text-2xl font-black text-[#1A1715] mt-2">
            {formatRupiah(metrics.totalHpp)}
          </p>
          <div className="flex items-center gap-2 mt-2 text-xs font-medium text-stone-600">
            <span className="px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 font-bold">
              {metrics.barterCount} Barter
            </span>
            <span>Makanan complimentary</span>
          </div>
        </div>

        {/* Card 4: Total Beban Nyata (Ratecard + HPP) */}
        <div className="p-4 sm:p-5 rounded-2xl bg-[#D9480F]/10 border border-[#D9480F]/20 shadow-2xs">
          <div className="flex items-center justify-between text-[#D9480F]">
            <span className="text-xs font-bold uppercase tracking-wider">Total Beban Endorsement</span>
            <DollarSign className="w-4 h-4 text-[#D9480F]" />
          </div>
          <p className="text-xl sm:text-2xl font-black text-[#D9480F] mt-2">
            {formatRupiah(metrics.totalCommitment)}
          </p>
          <div className="flex items-center gap-2 mt-2 text-xs font-medium text-stone-600">
            <span>Rate Card Cash + HPP SS</span>
          </div>
        </div>
      </div>

      {/* Action Bar & Filters */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 p-4 bg-white rounded-2xl border border-[#EFE8DE] shadow-2xs">
        {/* Search & Select Filters */}
        <div className="flex flex-wrap items-center gap-2.5 flex-1">
          <div className="relative min-w-[220px] flex-1 max-w-sm">
            <Search className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Cari nama KOL, outlet, rekening..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-xs bg-[#FAF8F5] border border-[#EFE8DE] rounded-xl focus:outline-none focus:ring-1 focus:ring-[#D9480F]"
            />
          </div>

          <select
            value={paymentFilter}
            onChange={(e) => setPaymentFilter(e.target.value)}
            className="px-3 py-2 text-xs bg-[#FAF8F5] border border-[#EFE8DE] rounded-xl focus:outline-none text-stone-700 font-medium"
          >
            <option value="ALL">Semua Status Bayar</option>
            <option value="UNPAID">Belum Bayar (Pending)</option>
            <option value="PAID">Sudah Lunas</option>
            <option value="BARTER">Barter Produk</option>
          </select>

          <select
            value={draftFilter}
            onChange={(e) => setDraftFilter(e.target.value)}
            className="px-3 py-2 text-xs bg-[#FAF8F5] border border-[#EFE8DE] rounded-xl focus:outline-none text-stone-700 font-medium"
          >
            <option value="ALL">Semua Status Draft</option>
            <option value="APPROVED">Draft Disetujui (Siap Bayar)</option>
            <option value="PENDING">Menunggu Draft</option>
          </select>

          <select
            value={outletFilter}
            onChange={(e) => setOutletFilter(e.target.value)}
            className="px-3 py-2 text-xs bg-[#FAF8F5] border border-[#EFE8DE] rounded-xl focus:outline-none text-stone-700 font-medium"
          >
            <option value="">Semua Outlet</option>
            {outlets.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name}
              </option>
            ))}
          </select>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          {selectedIds.length > 0 && (
            <button
              onClick={handleBatchMarkPaid}
              disabled={isPending}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-xs transition-all cursor-pointer disabled:opacity-50"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Bayar {selectedIds.length} Terpilih</span>
            </button>
          )}

          <button
            onClick={handleExportCSV}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white hover:bg-[#FAF8F5] text-stone-700 border border-[#EFE8DE] text-xs font-bold shadow-2xs hover:border-[#D9480F]/40 transition-all cursor-pointer"
            title="Download CSV untuk input transfer bank"
          >
            <Download className="w-3.5 h-3.5 text-[#D9480F]" />
            <span>Export CSV Bank</span>
          </button>
        </div>
      </div>

      {/* Finance Table */}
      <div className="bg-white rounded-2xl border border-[#EFE8DE] shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[950px] text-left text-xs">
            <thead className="bg-[#FAF8F5] border-b border-[#EFE8DE] text-stone-600 font-bold uppercase tracking-wider text-[11px] sticky top-0 z-10 shadow-2xs">
              <tr>
                <th className="p-3.5 text-center w-10">
                  <input
                    type="checkbox"
                    checked={selectedIds.length > 0 && selectedIds.length === filteredList.length}
                    onChange={handleSelectAll}
                    className="rounded border-stone-300 text-[#D9480F] focus:ring-[#D9480F]"
                  />
                </th>
                <th className="p-3.5 whitespace-nowrap">Tanggal Visit</th>
                <th className="p-3.5 whitespace-nowrap">KOL & Telepon</th>
                <th className="p-3.5 whitespace-nowrap">Outlet</th>
                <th className="p-3.5 whitespace-nowrap">Menu & HPP</th>
                <th className="p-3.5 text-right whitespace-nowrap">Rate Card</th>
                <th className="p-3.5 text-right whitespace-nowrap">Total Biaya</th>
                <th className="p-3.5 text-center whitespace-nowrap">Draft Video</th>
                <th className="p-3.5 whitespace-nowrap">Nomor Rekening (Transfer)</th>
                <th className="p-3.5 text-center whitespace-nowrap">Status Pembayaran</th>
                <th className="p-3.5 text-center whitespace-nowrap">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#EFE8DE]">
              {filteredList.length === 0 ? (
                <tr>
                  <td colSpan={11} className="p-8 text-center text-stone-400">
                    Tidak ada data endorsement yang cocok dengan filter pembayaran.
                  </td>
                </tr>
              ) : (
                filteredList.map((item) => {
                  const isSelected = selectedIds.includes(item.id)
                  const bankText = item.bankAccountCustom || item.kol.bankAccount || ''
                  const isPaid = item.paymentStatus === 'PAID'
                  const isBarter = item.paymentStatus === 'BARTER'
                  const isDraftApproved = item.draftStatus === 'APPROVED'

                  return (
                    <tr
                      key={item.id}
                      className={`hover:bg-[#FAF8F5]/60 transition-colors ${
                        isSelected ? 'bg-amber-50/40' : ''
                      }`}
                    >
                      {/* Checkbox */}
                      <td className="p-3.5 text-center">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => handleToggleSelect(item.id)}
                          className="rounded border-stone-300 text-[#D9480F] focus:ring-[#D9480F]"
                        />
                      </td>

                      {/* Schedule Date */}
                      <td className="p-3.5 whitespace-nowrap">
                        <div className="font-semibold text-stone-900">{item.scheduleDate}</div>
                        {item.paymentDate && (
                          <div className="text-[10px] text-emerald-700 flex items-center gap-1 mt-0.5 font-medium">
                            <Check className="w-3 h-3" />
                            <span>Paid: {item.paymentDate}</span>
                          </div>
                        )}
                      </td>

                      {/* KOL info */}
                      <td className="p-3.5">
                        <div className="font-bold text-[#1A1715]">{item.kol.name}</div>
                        {item.kol.phoneNumber && (
                          <div className="text-[11px] text-stone-500 font-mono mt-0.5">
                            {item.kol.phoneNumber}
                          </div>
                        )}
                      </td>

                      {/* Outlet */}
                      <td className="p-3.5 whitespace-nowrap">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-stone-100 text-stone-800 font-semibold">
                            <Store className="w-3 h-3 text-stone-500" />
                            {item.outlet.name}
                          </span>
                          {item.type === 'DELIVERY' && (
                            <span className="inline-flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200">
                              <Truck className="w-2.5 h-2.5" />
                              Online
                            </span>
                          )}
                        </div>
                        <span className="block text-[10px] text-stone-400 mt-0.5">
                          {item.outlet.type || 'INTERNAL'}
                        </span>
                      </td>

                      {/* Menu & HPP */}
                      <td className="p-3.5">
                        <div className="text-stone-800 font-medium line-clamp-1">
                          {item.menuGiven || '-'}
                        </div>
                        <div className="text-[11px] text-stone-500 font-mono mt-0.5 flex items-center gap-2">
                          <span>HPP: {formatRupiah(item.hppMenu || 0)}</span>
                          {item.shippingCost && item.shippingCost > 0 ? (
                            <span className="text-blue-600 font-semibold">
                              + Ongkir: {formatRupiah(item.shippingCost)}
                            </span>
                          ) : null}
                        </div>
                      </td>

                      {/* Rate Card (Cash) */}
                      <td className="p-3.5 text-right whitespace-nowrap font-mono font-bold text-stone-900">
                        {item.rateCard > 0 ? (
                          formatRupiah(item.rateCard)
                        ) : (
                          <span className="text-blue-700 bg-blue-50 px-2 py-0.5 rounded-md text-[11px]">
                            Barter (Rp 0)
                          </span>
                        )}
                      </td>

                      {/* Total Biaya (Cash + HPP) */}
                      <td className="p-3.5 text-right whitespace-nowrap font-mono font-black text-[#D9480F]">
                        {formatRupiah(item.totalCost || 0)}
                      </td>

                      {/* Draft Status Toggle */}
                      <td className="p-3.5 text-center whitespace-nowrap">
                        <button
                          onClick={() => handleToggleDraft(item.id, item.draftStatus || 'PENDING')}
                          disabled={isPending}
                          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold transition-all cursor-pointer ${
                            isDraftApproved
                              ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200'
                              : 'bg-amber-100 text-amber-800 hover:bg-amber-200'
                          }`}
                          title="Klik untuk ubah status approval draft"
                        >
                          {isDraftApproved ? (
                            <>
                              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                              <span>Approved</span>
                            </>
                          ) : (
                            <>
                              <Clock className="w-3 h-3 text-amber-600" />
                              <span>Pending</span>
                            </>
                          )}
                        </button>
                      </td>

                      {/* Bank Account with Copy Button */}
                      <td className="p-3.5 min-w-[180px]">
                        {bankText ? (
                          <div className="flex items-center gap-1.5 group">
                            <span className="font-mono text-xs text-stone-800 break-words flex-1">
                              {bankText}
                            </span>
                            <button
                              onClick={() => handleCopyBank(item.id, bankText)}
                              className="p-1.5 rounded-lg bg-stone-100 hover:bg-stone-200 text-stone-600 shrink-0 transition-colors cursor-pointer"
                              title="Salin nomor rekening"
                            >
                              {copiedBankId === item.id ? (
                                <Check className="w-3.5 h-3.5 text-emerald-600" />
                              ) : (
                                <Copy className="w-3.5 h-3.5" />
                              )}
                            </button>
                          </div>
                        ) : (
                          <span className="text-stone-400 text-[11px] italic">Belum ada rekening</span>
                        )}
                        {item.paymentNotes && (
                          <div className="text-[10px] text-amber-700 mt-1 italic">
                            Ket: {item.paymentNotes}
                          </div>
                        )}
                      </td>

                      {/* Payment Status Dropdown */}
                      <td className="p-3.5 text-center whitespace-nowrap">
                        <select
                          value={item.paymentStatus}
                          onChange={(e) => handleUpdatePayment(item.id, e.target.value)}
                          disabled={isPending}
                          className={`px-2.5 py-1 text-[11px] font-bold rounded-lg border cursor-pointer focus:outline-none ${
                            isPaid
                              ? 'bg-emerald-50 border-emerald-300 text-emerald-800'
                              : isBarter
                              ? 'bg-blue-50 border-blue-300 text-blue-800'
                              : item.paymentStatus === 'DOWN_PAYMENT'
                              ? 'bg-purple-50 border-purple-300 text-purple-800'
                              : 'bg-red-50 border-red-300 text-red-800'
                          }`}
                        >
                          <option value="UNPAID">Belum Bayar</option>
                          <option value="PAID">Lunas (Done)</option>
                          <option value="BARTER">Barter</option>
                          <option value="DOWN_PAYMENT">DP Sebagian</option>
                        </select>
                      </td>

                      {/* Action */}
                      <td className="p-3.5 text-center whitespace-nowrap">
                        <button
                          onClick={() => onEdit(item)}
                          className="px-2.5 py-1 text-[11px] font-bold text-stone-600 hover:text-[#D9480F] bg-stone-50 hover:bg-stone-100 rounded-lg border border-stone-200 transition-colors cursor-pointer"
                        >
                          Edit
                        </button>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
