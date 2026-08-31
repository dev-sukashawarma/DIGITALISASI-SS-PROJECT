'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { ArrowLeft, RotateCcw, Banknote, Receipt, Store, Wallet, FileSpreadsheet, FileText } from 'lucide-react'
import { Button, Spinner } from '@suka/design-system'
import { SectionCard, StatCard, TxStatusBadge } from '@/components/ui'
import { useCashDepositHistory, useShiftDepositHistory, useOutlets } from '@/hooks/useCashDeposit'
import { rupiah, tanggalWaktu } from '@/lib/format'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

type TabType = 'shift_pos' | 'kas_pusat'

export function HistoryView() {
  const [activeTab, setActiveTab] = useState<TabType>('shift_pos')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [outletId, setOutletId] = useState('')

  const { data: outlets = [] } = useOutlets()

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

  const exportToPDF = () => {
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
          Setoran Kas Pusat (Hop-1 Treasury)
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
          label={`Total Setoran ${activeTab === 'shift_pos' ? 'Kasir POS' : 'Kas Pusat'} (Tersaring)`}
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
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </SectionCard>
      )}
    </div>
  )
}


