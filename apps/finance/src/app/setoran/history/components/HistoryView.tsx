'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { toast } from 'sonner'
import { ArrowLeft, RotateCcw, Banknote, Receipt, Store, Wallet, FileSpreadsheet, FileText, Landmark, Pencil, Trash2, X } from 'lucide-react'
import { Button, Spinner } from '@suka/design-system'
import { SectionCard, StatCard, TxStatusBadge } from '@/components/ui'
import { useCashOverview } from '@/hooks/useCashData'
import { useCashDepositHistory, useShiftDepositHistory, useOutlets, useUpdateCashDepositMethod, useDeleteCashDeposit } from '@/hooks/useCashDeposit'
import { rupiah, tanggalWaktu } from '@/lib/format'
import type { CashTransaction } from '@/lib/types'

type TabType = 'shift_pos' | 'kas_pusat'
type DepositMethod = 'transfer' | 'langsung'

export function HistoryView() {
  const [activeTab, setActiveTab] = useState<TabType>('shift_pos')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [outletId, setOutletId] = useState('')

  const { locations } = useCashOverview()
  const { data: outlets = [] } = useOutlets()
  const updateDepositMethod = useUpdateCashDepositMethod()
  const deleteDeposit = useDeleteCashDeposit()

  const [editingTx, setEditingTx] = useState<CashTransaction | null>(null)
  const [editMethod, setEditMethod] = useState<DepositMethod>('transfer')
  const [editLocation, setEditLocation] = useState('')
  const [confirmDelete, setConfirmDelete] = useState(false)

  const editTargetKind = editMethod === 'transfer' ? 'bank' : 'cash'
  const editDestinationOptions = locations.filter(
    (l) => l.scope === 'pusat' && l.is_active !== false && l.kind === editTargetKind
  )

  const openActionModal = (tx: CashTransaction) => {
    const initialMethod: DepositMethod = tx.cash_location?.kind === 'bank' ? 'transfer' : 'langsung'
    setEditingTx(tx)
    setEditMethod(initialMethod)
    setEditLocation(tx.cash_location_id)
    setConfirmDelete(false)
  }

  const closeActionModal = () => {
    if (updateDepositMethod.isPending || deleteDeposit.isPending) return
    setEditingTx(null)
    setConfirmDelete(false)
  }

  const handleSelectEditMethod = (method: DepositMethod) => {
    setEditMethod(method)
    const kind = method === 'transfer' ? 'bank' : 'cash'
    const opts = locations.filter((l) => l.scope === 'pusat' && l.is_active !== false && l.kind === kind)
    if (editingTx && editingTx.cash_location?.kind === kind) {
      setEditLocation(editingTx.cash_location_id)
    } else {
      setEditLocation(opts[0]?.id ?? '')
    }
  }

  const handleUpdateMethod = () => {
    if (!editingTx) return
    if (!editLocation) {
      toast.error('Pilih rekening atau kas tujuan terlebih dahulu')
      return
    }
    updateDepositMethod.mutate(
      { id: editingTx.id, newLocationId: editLocation },
      {
        onSuccess: (res) => {
          toast.success(`Metode setoran berhasil diubah ke ${res.locationLabel}!`)
          setEditingTx(null)
          setConfirmDelete(false)
        },
        onError: (e: unknown) => toast.error((e as Error).message),
      }
    )
  }

  const handleDeleteTx = () => {
    if (!editingTx) return
    deleteDeposit.mutate(editingTx.id, {
      onSuccess: () => {
        toast.success('Data transaksi setoran berhasil dihapus!')
        setEditingTx(null)
        setConfirmDelete(false)
      },
      onError: (e: unknown) => toast.error((e as Error).message),
    })
  }

  // 1. Query for Shift POS (Closing Shift Kasir)
  const { data: shiftHistory = [], isLoading: isLoadingShifts } = useShiftDepositHistory({
    startDate: startDate || undefined,
    endDate: endDate || undefined,
    outletId: outletId || undefined,
  })

  // 2. Query for Kas Pusat (Hop-1 Treasury)
  const { data: kasPusatHistory = [], isLoading: isLoadingKasPusat } = useCashDepositHistory({
    startDate: startDate || undefined,
    endDate: endDate || undefined,
    outletId: outletId || undefined,
  })

  // Quick preset handlers
  const setPreset = (preset: 'all' | 'this_month' | 'last_month' | 'last_30_days') => {
    const now = new Date()
    if (preset === 'all') {
      setStartDate('')
      setEndDate('')
    } else if (preset === 'this_month') {
      const firstDay = new Date(now.getFullYear(), now.getMonth(), 1)
      const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0)
      setStartDate(firstDay.toISOString().split('T')[0])
      setEndDate(lastDay.toISOString().split('T')[0])
    } else if (preset === 'last_month') {
      const firstDay = new Date(now.getFullYear(), now.getMonth() - 1, 1)
      const lastDay = new Date(now.getFullYear(), now.getMonth(), 0)
      setStartDate(firstDay.toISOString().split('T')[0])
      setEndDate(lastDay.toISOString().split('T')[0])
    } else if (preset === 'last_30_days') {
      const past = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
      setStartDate(past.toISOString().split('T')[0])
      setEndDate(now.toISOString().split('T')[0])
    }
  }

  const resetFilter = () => {
    setStartDate('')
    setEndDate('')
    setOutletId('')
  }

  // Summary calculations
  const totalShiftCash = useMemo(() => {
    return shiftHistory.reduce((sum: number, item: any) => sum + (Number(item.actual_ending_cash) || 0), 0)
  }, [shiftHistory])

  const totalKasPusatCash = useMemo(() => {
    return kasPusatHistory.reduce((sum: number, item: any) => sum + (Number(item.amount) || 0), 0)
  }, [kasPusatHistory])

  const currentCount = activeTab === 'shift_pos' ? shiftHistory.length : kasPusatHistory.length
  const currentLoading = activeTab === 'shift_pos' ? isLoadingShifts : isLoadingKasPusat
  const currentTotal = activeTab === 'shift_pos' ? totalShiftCash : totalKasPusatCash

  const exportToCSV = () => {
    const fileSuffix = startDate && endDate ? `${startDate}_sd_${endDate}` : 'semua'

    if (activeTab === 'shift_pos') {
      if (!shiftHistory.length) return
      const headers = [
        'Waktu Mulai',
        'Waktu Selesai (Closing)',
        'Outlet',
        'Kasir (Staff)',
        'Setoran Uang Fisik (Rp)',
        'Estimasi Kasir Sistem (Rp)',
        'Selisih (Rp)',
        'Catatan',
        'Status'
      ]
      const rows = shiftHistory.map((s: any) => [
        tanggalWaktu(s.start_time),
        tanggalWaktu(s.end_time),
        s.outlet?.name || '-',
        s.staff?.name || '-',
        (s.actual_ending_cash ?? 0).toString(),
        (s.expected_ending_cash ?? 0).toString(),
        (s.variance ?? 0).toString(),
        s.notes || '-',
        s.status
      ])

      const csvContent = [
        headers.join(','),
        ...rows.map(r => r.map(f => `"${String(f).replace(/"/g, '""')}"`).join(','))
      ].join('\n')

      downloadCSV(csvContent, `riwayat_setoran_kasir_pos_${fileSuffix}.csv`)
    } else {
      if (!kasPusatHistory.length) return
      const headers = ['Waktu', 'Kas Tujuan', 'Outlet Asal', 'Nominal (Rp)', 'Catatan / Alasan', 'Status']
      const rows = kasPusatHistory.map((t: any) => [
        tanggalWaktu(t.occurred_at),
        t.cash_location?.label || '-',
        t.outlet?.name || '-',
        t.amount.toString(),
        t.note || t.description || '-',
        t.status
      ])

      const csvContent = [
        headers.join(','),
        ...rows.map(r => r.map(f => `"${String(f).replace(/"/g, '""')}"`).join(','))
      ].join('\n')

      downloadCSV(csvContent, `riwayat_setoran_kas_pusat_${fileSuffix}.csv`)
    }
  }

  const exportToPDF = async () => {
    const { jsPDF } = await import('jspdf')
    const autoTable = (await import('jspdf-autotable')).default
    const fileSuffix = startDate && endDate ? `${startDate}_sd_${endDate}` : 'semua'
    const doc = new jsPDF({
      orientation: 'landscape',
      unit: 'mm',
      format: 'a4',
    })

    const title = activeTab === 'shift_pos' 
      ? 'LAPORAN RIWAYAT SETORAN KASIR POS (CLOSING SHIFT)' 
      : 'LAPORAN RIWAYAT SETORAN KAS PUSAT (HOP-1 TREASURY)'
    
    const selectedOutletName = outletId 
      ? outlets.find((o) => o.id === outletId)?.name || 'Outlet Terpilih' 
      : 'Semua Outlet'
    
    const periodeStr = startDate && endDate 
      ? `${startDate} s/d ${endDate}` 
      : (startDate ? `Mulai ${startDate}` : (endDate ? `Sampai ${endDate}` : 'Semua Waktu'))

    // Title & Brand
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(14)
    doc.setTextColor(51, 30, 20)
    doc.text(title, 14, 15)

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9)
    doc.setTextColor(100, 100, 100)
    doc.text(`Suka Profit Berkah | Finance Treasury Hub`, 14, 21)
    doc.text(
      `Periode: ${periodeStr}   |   Outlet: ${selectedOutletName}   |   Total Data: ${currentCount}   |   Total Setoran: ${rupiah(currentTotal)}`, 
      14, 
      26
    )

    doc.setDrawColor(220, 220, 220)
    doc.line(14, 29, 283, 29)

    if (activeTab === 'shift_pos') {
      const head = [['No', 'Waktu Closing Shift', 'Outlet', 'Kasir (Staff)', 'Uang Fisik (Setoran)', 'Estimasi Sistem', 'Selisih', 'Catatan']]
      const body = shiftHistory.map((s: any, idx: number) => {
        const v = s.variance ?? 0
        return [
          (idx + 1).toString(),
          s.end_time ? tanggalWaktu(s.end_time) : '—',
          s.outlet?.name || '—',
          s.staff?.name || '—',
          rupiah(s.actual_ending_cash ?? 0),
          rupiah(s.expected_ending_cash ?? 0),
          v === 0 ? 'Rp 0' : (v > 0 ? `+${rupiah(v)}` : rupiah(v)),
          s.notes || '—'
        ]
      })

      autoTable(doc, {
        head,
        body,
        startY: 32,
        styles: { fontSize: 8, cellPadding: 2.5 },
        headStyles: { fillColor: [242, 107, 15], textColor: 255, fontStyle: 'bold' },
        alternateRowStyles: { fillColor: [250, 250, 250] },
      })

      doc.save(`riwayat_setoran_kasir_pos_${fileSuffix}.pdf`)
    } else {
      const head = [['No', 'Waktu', 'Kas Tujuan', 'Outlet Asal', 'Nominal', 'Catatan / Alasan', 'Status']]
      const body = kasPusatHistory.map((t: any, idx: number) => [
        (idx + 1).toString(),
        tanggalWaktu(t.occurred_at),
        t.cash_location?.label || '—',
        t.outlet?.name || '—',
        rupiah(t.amount ?? 0),
        t.note || t.description || '—',
        t.status
      ])

      autoTable(doc, {
        head,
        body,
        startY: 32,
        styles: { fontSize: 8, cellPadding: 2.5 },
        headStyles: { fillColor: [242, 107, 15], textColor: 255, fontStyle: 'bold' },
        alternateRowStyles: { fillColor: [250, 250, 250] },
      })

      doc.save(`riwayat_setoran_kas_pusat_${fileSuffix}.pdf`)
    }
  }

  const downloadCSV = (content: string, filename: string) => {
    const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.setAttribute('download', filename)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  return (
    <div className="space-y-8 font-sans">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <Link href="/setoran" className="text-sm font-semibold text-suka-orange flex items-center gap-1 mb-2 hover:underline">
            <ArrowLeft size={16} /> Kembali ke Setoran
          </Link>
          <h1 className="font-display text-4xl md:text-5xl text-suka-brown tracking-wide">Riwayat Setoran Tunai</h1>
          <p className="text-suka-ink/60 mt-2 font-medium">
            Pantau seluruh data setoran kasir POS dari outlet dan serah-terima ke Kas Pusat.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button 
            onClick={exportToCSV} 
            disabled={!currentCount || currentLoading} 
            variant="secondary"
            className="flex items-center gap-2 bg-white border border-suka-gray-200 text-suka-gray-700 hover:bg-suka-gray-50"
          >
            <FileSpreadsheet size={16} className="text-emerald-600" /> Export CSV
          </Button>
          <Button 
            onClick={exportToPDF} 
            disabled={!currentCount || currentLoading} 
            className="flex items-center gap-2"
          >
            <FileText size={16} /> Export PDF
          </Button>
        </div>
      </div>

      {/* Tab Selector */}
      <div className="flex border-b border-suka-gray-200">
        <button
          type="button"
          onClick={() => setActiveTab('shift_pos')}
          className={`flex items-center gap-2 px-6 py-3 font-semibold text-sm transition-all border-b-2 ${
            activeTab === 'shift_pos'
              ? 'border-suka-orange text-suka-orange bg-orange-50/50'
              : 'border-transparent text-suka-gray-500 hover:text-suka-ink hover:bg-suka-gray-50'
          } rounded-t-xl`}
        >
          <Store size={18} />
          Setoran Kasir POS (Closing Shift Outlet)
          <span className={`px-2 py-0.5 text-xs rounded-full ${
            activeTab === 'shift_pos' ? 'bg-suka-orange text-white' : 'bg-suka-gray-100 text-suka-gray-600'
          }`}>
            {shiftHistory.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('kas_pusat')}
          className={`flex items-center gap-2 px-6 py-3 font-semibold text-sm transition-all border-b-2 ${
            activeTab === 'kas_pusat'
              ? 'border-suka-orange text-suka-orange bg-orange-50/50'
              : 'border-transparent text-suka-gray-500 hover:text-suka-ink hover:bg-suka-gray-50'
          } rounded-t-xl`}
        >
          <Wallet size={18} />
          Penerimaan Setoran Finance (Bank / Kas)
          <span className={`px-2 py-0.5 text-xs rounded-full ${
            activeTab === 'kas_pusat' ? 'bg-suka-orange text-white' : 'bg-suka-gray-100 text-suka-gray-600'
          }`}>
            {kasPusatHistory.length}
          </span>
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <StatCard 
          label={`Total Setoran ${activeTab === 'shift_pos' ? 'Kasir POS' : 'Finance'} (Tersaring)`}
          value={rupiah(currentTotal)} 
          icon={<Banknote size={22} />} 
          tone="green" 
          hint={`${currentCount} transaksi setoran terdata`} 
        />
        <StatCard 
          label="Jumlah Data Transaksi" 
          value={`${currentCount} Data`} 
          icon={<Receipt size={22} />} 
          tone="orange" 
          hint={startDate || endDate || outletId ? 'Sesuai filter aktif' : 'Total keseluruhan data'} 
        />
      </div>

      {/* Filter Section */}
      <SectionCard title="Filter Riwayat">
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold text-suka-gray-500 mr-1">Preset Cepat:</span>
            <button
              type="button"
              onClick={() => setPreset('all')}
              className={`px-3 py-1 text-xs rounded-lg font-medium transition-colors ${
                !startDate && !endDate ? 'bg-suka-orange text-white' : 'bg-suka-gray-100 text-suka-gray-600 hover:bg-suka-gray-200'
              }`}
            >
              Semua Waktu
            </button>
            <button
              type="button"
              onClick={() => setPreset('this_month')}
              className="px-3 py-1 text-xs rounded-lg font-medium bg-suka-gray-100 text-suka-gray-600 hover:bg-suka-gray-200"
            >
              Bulan Ini
            </button>
            <button
              type="button"
              onClick={() => setPreset('last_month')}
              className="px-3 py-1 text-xs rounded-lg font-medium bg-suka-gray-100 text-suka-gray-600 hover:bg-suka-gray-200"
            >
              Bulan Lalu
            </button>
            <button
              type="button"
              onClick={() => setPreset('last_30_days')}
              className="px-3 py-1 text-xs rounded-lg font-medium bg-suka-gray-100 text-suka-gray-600 hover:bg-suka-gray-200"
            >
              30 Hari Terakhir
            </button>
            {(startDate || endDate || outletId) && (
              <button
                type="button"
                onClick={resetFilter}
                className="ml-auto px-3 py-1 text-xs rounded-lg font-medium text-red-600 hover:bg-red-50 flex items-center gap-1"
              >
                <RotateCcw size={12} /> Reset Filter
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2 border-t border-suka-gray-100">
            <label className="text-sm font-semibold text-suka-gray-600">
              Mulai Tanggal
              <input 
                type="date" 
                value={startDate} 
                onChange={e => setStartDate(e.target.value)}
                className="mt-1 w-full rounded-xl border border-suka-gray-200 px-3 py-2 outline-none focus:border-suka-orange text-sm bg-white" 
              />
            </label>
            <label className="text-sm font-semibold text-suka-gray-600">
              Sampai Tanggal
              <input 
                type="date" 
                value={endDate} 
                onChange={e => setEndDate(e.target.value)}
                className="mt-1 w-full rounded-xl border border-suka-gray-200 px-3 py-2 outline-none focus:border-suka-orange text-sm bg-white" 
              />
            </label>
            <label className="text-sm font-semibold text-suka-gray-600">
              Outlet Asal
              <select 
                value={outletId} 
                onChange={e => setOutletId(e.target.value)}
                className="mt-1 w-full rounded-xl border border-suka-gray-200 px-3 py-2 outline-none focus:border-suka-orange text-sm bg-white" 
              >
                <option value="">Semua Outlet</option>
                {outlets.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
              </select>
            </label>
          </div>
        </div>
      </SectionCard>

      {/* Tab Content 1: Setoran Kasir POS */}
      {activeTab === 'shift_pos' && (
        <SectionCard 
          title="Data Setoran Kasir POS (Closing Shift)"
          action={<span className="text-xs text-suka-gray-400 font-medium">Total: {shiftHistory.length} shift</span>}
        >
          {isLoadingShifts ? (
            <div className="py-12 flex flex-col items-center justify-center gap-3">
              <Spinner size={32} />
              <p className="text-sm text-suka-gray-400">Memuat data setoran shift kasir...</p>
            </div>
          ) : shiftHistory.length === 0 ? (
            <div className="py-12 text-center">
              <p className="text-suka-gray-400 font-medium">Tidak ada data setoran kasir pada filter yang dipilih.</p>
              {(startDate || endDate || outletId) && (
                <button 
                  onClick={resetFilter}
                  className="mt-3 text-sm text-suka-orange font-semibold hover:underline"
                >
                  Tampilkan Semua Waktu & Outlet
                </button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-suka-gray-500 border-b border-suka-gray-100">
                    <th className="py-3 px-3">Waktu Closing Shift</th>
                    <th className="py-3 px-3">Outlet</th>
                    <th className="py-3 px-3">Kasir (Staff)</th>
                    <th className="py-3 px-3 text-right">Uang Fisik (Setoran)</th>
                    <th className="py-3 px-3 text-right">Estimasi Sistem</th>
                    <th className="py-3 px-3 text-right">Selisih</th>
                    <th className="py-3 px-3">Catatan</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-suka-gray-100">
                  {shiftHistory.map((s: any) => {
                    const variance = s.variance || 0
                    return (
                      <tr key={s.id} className="hover:bg-suka-gray-50/50 transition-colors">
                        <td className="py-3.5 px-3 text-suka-gray-500 whitespace-nowrap">
                          {s.end_time ? tanggalWaktu(s.end_time) : '—'}
                        </td>
                        <td className="py-3.5 px-3 font-semibold text-suka-ink">{s.outlet?.name ?? '—'}</td>
                        <td className="py-3.5 px-3 text-suka-gray-700">{s.staff?.name ?? '—'}</td>
                        <td className="py-3.5 px-3 text-right font-bold text-emerald-600 whitespace-nowrap">
                          {rupiah(s.actual_ending_cash ?? 0)}
                        </td>
                        <td className="py-3.5 px-3 text-right text-suka-gray-600 whitespace-nowrap">
                          {rupiah(s.expected_ending_cash ?? 0)}
                        </td>
                        <td className={`py-3.5 px-3 text-right font-semibold whitespace-nowrap ${
                          variance < 0 ? 'text-red-600' : variance > 0 ? 'text-blue-600' : 'text-suka-gray-400'
                        }`}>
                          {variance === 0 ? 'Rp 0' : (variance > 0 ? `+${rupiah(variance)}` : rupiah(variance))}
                        </td>
                        <td className="py-3.5 px-3 text-suka-gray-500 max-w-xs truncate">{s.notes || '—'}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </SectionCard>
      )}

      {/* Tab Content 2: Setoran Kas Pusat */}
      {activeTab === 'kas_pusat' && (
        <SectionCard 
          title="Data Riwayat Setoran Kas Pusat (Hop-1)"
          action={<span className="text-xs text-suka-gray-400 font-medium">Total: {kasPusatHistory.length} transaksi</span>}
        >
          {isLoadingKasPusat ? (
            <div className="py-12 flex flex-col items-center justify-center gap-3">
              <Spinner size={32} />
              <p className="text-sm text-suka-gray-400">Memuat riwayat setoran kas pusat...</p>
            </div>
          ) : kasPusatHistory.length === 0 ? (
            <div className="py-12 text-center">
              <p className="text-suka-gray-400 font-medium">Tidak ada data setoran kas pusat pada filter yang dipilih.</p>
              {(startDate || endDate || outletId) && (
                <button 
                  onClick={resetFilter}
                  className="mt-3 text-sm text-suka-orange font-semibold hover:underline"
                >
                  Tampilkan Semua Waktu & Outlet
                </button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-suka-gray-500 border-b border-suka-gray-100">
                    <th className="py-3 px-3">Waktu</th>
                    <th className="py-3 px-3">Kas Tujuan</th>
                    <th className="py-3 px-3">Outlet Asal</th>
                    <th className="py-3 px-3">Catatan</th>
                    <th className="py-3 px-3 text-right">Nominal</th>
                    <th className="py-3 px-3 text-center">Status</th>
                    <th className="py-3 px-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-suka-gray-100">
                  {kasPusatHistory.map((t: any) => (
                    <tr key={t.id} className="hover:bg-suka-gray-50/50 transition-colors">
                      <td className="py-3.5 px-3 text-suka-gray-500 whitespace-nowrap">{tanggalWaktu(t.occurred_at)}</td>
                      <td className="py-3.5 px-3 font-semibold text-suka-ink">{t.cash_location?.label ?? '—'}</td>
                      <td className="py-3.5 px-3 text-suka-gray-700">{t.outlet?.name ?? '—'}</td>
                      <td className="py-3.5 px-3 text-suka-gray-500 max-w-xs truncate">{t.note || t.description || '—'}</td>
                      <td className="py-3.5 px-3 text-right font-bold text-emerald-600 whitespace-nowrap">+{rupiah(t.amount)}</td>
                      <td className="py-3.5 px-3 text-center whitespace-nowrap"><TxStatusBadge status={t.status} /></td>
                      <td className="py-3.5 px-3 text-right whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => openActionModal(t)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-suka-brown bg-suka-cream/70 hover:bg-suka-orange hover:text-white border border-suka-brown/10 transition-colors cursor-pointer"
                        >
                          <Pencil size={13} /> Action
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </SectionCard>
      )}

      {/* Modal Action: Edit Metode Setoran & Hapus Transaksi */}
      {editingTx && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between px-6 py-4 border-b border-suka-gray-100">
              <div>
                <h3 className="text-lg font-bold text-suka-brown">Kelola Transaksi Setoran</h3>
                <p className="text-xs text-suka-gray-500">Edit metode setoran atau hapus data transaksi</p>
              </div>
              <button
                type="button"
                onClick={closeActionModal}
                className="p-1.5 rounded-lg text-suka-gray-400 hover:text-suka-ink hover:bg-suka-gray-100 transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-6 space-y-5 max-h-[80vh] overflow-y-auto">
              {/* Info Transaksi */}
              <div className="bg-suka-cream/50 rounded-xl p-3.5 border border-suka-brown/10 text-xs space-y-1.5">
                <div className="flex justify-between gap-2">
                  <span className="text-suka-gray-500">Outlet Asal:</span>
                  <span className="font-bold text-suka-ink text-right">{editingTx.outlet?.name ?? '—'}</span>
                </div>
                <div className="flex justify-between gap-2">
                  <span className="text-suka-gray-500">Waktu:</span>
                  <span className="font-semibold text-suka-gray-700">{tanggalWaktu(editingTx.occurred_at)}</span>
                </div>
                <div className="flex justify-between gap-2">
                  <span className="text-suka-gray-500">Nominal Setoran:</span>
                  <span className="font-bold text-emerald-600 text-sm">+{rupiah(editingTx.amount)}</span>
                </div>
                <div className="flex justify-between gap-2 pt-1 border-t border-suka-brown/10">
                  <span className="text-suka-gray-500">Metode &amp; Akun Saat Ini:</span>
                  <span className="font-bold text-suka-brown text-right">
                    {editingTx.cash_location?.kind === 'bank' ? '🏦 Transfer Bank' : '💵 Setor Langsung'} ({editingTx.cash_location?.label ?? '—'})
                  </span>
                </div>
              </div>

              {/* Bagian Edit Metode Setoran */}
              <div className="space-y-3">
                <label className="text-xs font-bold uppercase tracking-wider text-suka-gray-500 block">
                  Edit Metode Setoran
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    onClick={() => handleSelectEditMethod('transfer')}
                    className={`flex items-center gap-3 p-3 rounded-xl border-2 text-left transition-all cursor-pointer ${
                      editMethod === 'transfer'
                        ? 'border-suka-orange bg-orange-50/60 shadow-sm'
                        : 'border-suka-gray-200 bg-white hover:border-suka-gray-300'
                    }`}
                  >
                    <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
                      editMethod === 'transfer' ? 'bg-suka-orange text-white' : 'bg-suka-gray-100 text-suka-gray-500'
                    }`}>
                      <Landmark size={18} />
                    </div>
                    <div className="min-w-0">
                      <p className={`font-bold text-xs ${editMethod === 'transfer' ? 'text-suka-brown' : 'text-suka-ink'}`}>
                        Transfer Bank
                      </p>
                      <p className="text-[11px] text-suka-gray-500 truncate">ATM CDM / M-Banking</p>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleSelectEditMethod('langsung')}
                    className={`flex items-center gap-3 p-3 rounded-xl border-2 text-left transition-all cursor-pointer ${
                      editMethod === 'langsung'
                        ? 'border-suka-orange bg-orange-50/60 shadow-sm'
                        : 'border-suka-gray-200 bg-white hover:border-suka-gray-300'
                    }`}
                  >
                    <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
                      editMethod === 'langsung' ? 'bg-suka-orange text-white' : 'bg-suka-gray-100 text-suka-gray-500'
                    }`}>
                      <Banknote size={18} />
                    </div>
                    <div className="min-w-0">
                      <p className={`font-bold text-xs ${editMethod === 'langsung' ? 'text-suka-brown' : 'text-suka-ink'}`}>
                        Setor Langsung
                      </p>
                      <p className="text-[11px] text-suka-gray-500 truncate">Tunai Fisik Kantor</p>
                    </div>
                  </button>
                </div>

                <label className="text-xs font-semibold text-suka-gray-600 block">
                  {editMethod === 'transfer' ? 'Rekening Bank Tujuan' : 'Kas Fisik Penerima'}
                  <select
                    value={editLocation}
                    onChange={(e) => setEditLocation(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-suka-gray-200 px-3 py-2 text-sm outline-none focus:border-suka-orange bg-white"
                  >
                    {editDestinationOptions.length === 0 && (
                      <option value="">— belum ada {editMethod === 'transfer' ? 'rekening bank' : 'kas'} pusat aktif —</option>
                    )}
                    {editDestinationOptions.map((l) => (
                      <option key={l.id} value={l.id}>{l.label} · Saldo: {rupiah(l.saldo)}</option>
                    ))}
                  </select>
                </label>

                <div className="flex justify-end pt-1">
                  <Button
                    onClick={handleUpdateMethod}
                    disabled={
                      updateDepositMethod.isPending ||
                      deleteDeposit.isPending ||
                      !editLocation ||
                      editLocation === editingTx.cash_location_id
                    }
                  >
                    {updateDepositMethod.isPending ? <Spinner size={16} /> : 'Simpan Metode Setoran'}
                  </Button>
                </div>
              </div>

              {/* Bagian Hapus Data Transaksi */}
              <div className="pt-4 border-t border-suka-gray-100">
                <label className="text-xs font-bold uppercase tracking-wider text-red-600 mb-2 block">
                  Hapus Data Transaksi
                </label>
                {!confirmDelete ? (
                  <button
                    type="button"
                    onClick={() => setConfirmDelete(true)}
                    disabled={updateDepositMethod.isPending || deleteDeposit.isPending}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold text-red-600 bg-red-50 hover:bg-red-100 border border-red-200 transition-colors cursor-pointer"
                  >
                    <Trash2 size={16} /> Hapus Data Transaksi Ini
                  </button>
                ) : (
                  <div className="rounded-xl bg-red-50 border border-red-200 p-3.5 space-y-3">
                    <p className="text-xs text-red-800 leading-relaxed">
                      Anda yakin ingin menghapus transaksi setoran dari <b>{editingTx.outlet?.name ?? 'Outlet'}</b> sebesar <b>{rupiah(editingTx.amount)}</b>? Saldo pada <b>{editingTx.cash_location?.label ?? 'akun tujuan'}</b> akan otomatis dikurangi kembali.
                    </p>
                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => setConfirmDelete(false)}
                        disabled={deleteDeposit.isPending}
                        className="px-3 py-1.5 rounded-lg text-xs font-semibold text-suka-gray-600 bg-white border border-suka-gray-200 hover:bg-suka-gray-50 cursor-pointer"
                      >
                        Batal
                      </button>
                      <button
                        type="button"
                        onClick={handleDeleteTx}
                        disabled={deleteDeposit.isPending}
                        className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold text-white bg-red-600 hover:bg-red-700 disabled:opacity-50 cursor-pointer"
                      >
                        {deleteDeposit.isPending ? <Spinner size={14} /> : <Trash2 size={14} />}
                        Ya, Hapus Permanen
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}


