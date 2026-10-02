'use client'

import React, { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase'
import { useOutlets } from '@/hooks/useOutlets'
import { Spinner, EmptyState } from '@suka/design-system'
import { rupiah, tanggal } from '@/lib/format'
import { Receipt, FileText, ExternalLink, Store, ChevronLeft, ChevronRight, Download, Calendar, ArrowDownLeft } from 'lucide-react'
import NumberFlow from '@number-flow/react'
import { TargetCombobox } from '@/components/TargetCombobox'
import { isExcludedOutlet } from '@/lib/outletFilters'

const ITEMS_PER_PAGE = 50

function formatYMD(d: Date): string {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jakarta',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  })
  return formatter.format(d)
}

export default function PettyCashExpensesTab() {
  const [preset, setPreset] = useState('bulan_lalu')
  const [startDate, setStartDate] = useState(() => {
    const today = new Date()
    const todayStr = formatYMD(today)
    const parts = todayStr.split('-').map(Number)
    const curYear = parts[0]
    const curMonth = parts[1]
    const prevMonthDate = new Date(curYear, curMonth - 2, 1)
    const prevYear = prevMonthDate.getFullYear()
    const prevMonth = String(prevMonthDate.getMonth() + 1).padStart(2, '0')
    return `${prevYear}-${prevMonth}-01`
  })
  const [endDate, setEndDate] = useState(() => {
    const today = new Date()
    const todayStr = formatYMD(today)
    const parts = todayStr.split('-').map(Number)
    const curYear = parts[0]
    const curMonth = parts[1]
    const prevMonthDate = new Date(curYear, curMonth - 2, 1)
    const prevYear = prevMonthDate.getFullYear()
    const prevMonth = String(prevMonthDate.getMonth() + 1).padStart(2, '0')
    const lastDay = new Date(curYear, curMonth - 1, 0).getDate()
    return `${prevYear}-${prevMonth}-${String(lastDay).padStart(2, '0')}`
  })
  const [selectedOutletId, setSelectedOutletId] = useState('all')
  const [page, setPage] = useState(1)

  const supabase = useMemo(() => createClient(), [])
  const { data: outlets = [], isLoading: loadingOutlets } = useOutlets()

  const handlePresetChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value
    setPreset(val)
    const today = new Date()
    
    if (val === 'hari_ini') {
      const d = formatYMD(today)
      setStartDate(d)
      setEndDate(d)
    } else if (val === 'kemarin') {
      const d = new Date(today.getTime() - 24 * 60 * 60 * 1000)
      const str = formatYMD(d)
      setStartDate(str)
      setEndDate(str)
    } else if (val === '7_hari') {
      const start = new Date(today.getTime() - 6 * 24 * 60 * 60 * 1000)
      setStartDate(formatYMD(start))
      setEndDate(formatYMD(today))
    } else if (val === '1_bulan') {
      const start = new Date(today.getTime() - 29 * 24 * 60 * 60 * 1000)
      setStartDate(formatYMD(start))
      setEndDate(formatYMD(today))
    } else if (val === 'bulan_ini') {
      const todayStr = formatYMD(today)
      const [year, month] = todayStr.split('-')
      setStartDate(`${year}-${month}-01`)
      setEndDate(todayStr)
    } else if (val === 'bulan_lalu') {
      const todayStr = formatYMD(today)
      const parts = todayStr.split('-').map(Number)
      const curYear = parts[0]
      const curMonth = parts[1]
      const prevMonthDate = new Date(curYear, curMonth - 2, 1)
      const prevYear = prevMonthDate.getFullYear()
      const prevMonth = String(prevMonthDate.getMonth() + 1).padStart(2, '0')
      const lastDay = new Date(curYear, curMonth - 1, 0).getDate()
      setStartDate(`${prevYear}-${prevMonth}-01`)
      setEndDate(`${prevYear}-${prevMonth}-${String(lastDay).padStart(2, '0')}`)
    }
    setPage(1)
  }

  const handleCustomDateChange = (isStart: boolean, val: string) => {
    setPreset('custom')
    if (isStart) setStartDate(val)
    else setEndDate(val)
    setPage(1)
  }

  const handleOutletChange = (val: string) => {
    setSelectedOutletId(val)
    setPage(1)
  }

  const isDateRangeValid = Boolean(startDate && endDate && startDate <= endDate)

  const { data = [], isLoading, error } = useQuery({
    queryKey: ['petty_cash_expenses_detail', startDate, endDate, selectedOutletId],
    enabled: isDateRangeValid,
    queryFn: async () => {
      const from = startDate
      const to = endDate
      const fromDateTime = `${from}T00:00:00.000+07:00`
      const toDateTime = `${to}T23:59:59.999+07:00`

      const expensesQuery = supabase
        .from('petty_cash_expenses')
        .select(`
          id,
          outlet_id,
          category,
          amount,
          description,
          expense_date,
          receipt_url,
          created_at,
          outlets(name)
        `)
        .is('deleted_at', null)
        .gte('expense_date', from)
        .lte('expense_date', to)

      const topupsQuery = supabase
        .from('petty_cash_topups')
        .select(`
          id,
          outlet_id,
          amount,
          description,
          created_at,
          status,
          outlets(name)
        `)
        .in('status', ['completed', 'approved', 'approved_by_finance', 'forwarded_by_leader'])
        .gte('created_at', fromDateTime)
        .lte('created_at', toDateTime)

      if (selectedOutletId !== 'all') {
        expensesQuery.eq('outlet_id', selectedOutletId)
        topupsQuery.eq('outlet_id', selectedOutletId)
      }

      const [resExpenses, resTopups] = await Promise.all([expensesQuery, topupsQuery])
      if (resExpenses.error) throw resExpenses.error
      if (resTopups.error) throw resTopups.error

      const mappedExpenses = (resExpenses.data || []).map(row => ({
        id: row.id,
        type: 'expense' as const,
        outletId: row.outlet_id,
        outletName: row.outlets?.name ?? 'Outlet Tidak Dikenal',
        category: row.category,
        amount: Number(row.amount || 0),
        description: row.description || '',
        date: row.created_at || row.expense_date,
        expenseDate: row.expense_date,
        receiptUrl: row.receipt_url
      }))

      const mappedTopups = (resTopups.data || []).map(row => ({
        id: row.id,
        type: 'topup' as const,
        outletId: row.outlet_id,
        outletName: row.outlets?.name ?? 'Outlet Tidak Dikenal',
        category: 'topup',
        amount: Number(row.amount || 0),
        description: row.description || 'Topup Petty Cash',
        date: row.created_at,
        expenseDate: row.created_at ? row.created_at.substring(0, 10) : from,
        receiptUrl: null
      }))

      const combined = [...mappedExpenses, ...mappedTopups]
      combined.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

      return combined
    }
  })

  const expensesList = useMemo(() => data.filter(d => d.type === 'expense'), [data])
  const topupsList = useMemo(() => data.filter(d => d.type === 'topup'), [data])

  const totalExpenses = useMemo(() => {
    return expensesList.reduce((sum, item) => sum + item.amount, 0)
  }, [expensesList])

  const totalTopups = useMemo(() => {
    return topupsList.reduce((sum, item) => sum + item.amount, 0)
  }, [topupsList])

  const totalPages = Math.max(1, Math.ceil(data.length / ITEMS_PER_PAGE))
  const currentData = useMemo(() => {
    const start = (page - 1) * ITEMS_PER_PAGE
    return data.slice(start, start + ITEMS_PER_PAGE)
  }, [data, page])

  const getCategoryBadge = (category: string) => {
    const cat = (category || '').toLowerCase()
    switch (cat) {
      case 'bahan_baku':
      case 'bb':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-lg text-xs font-semibold bg-amber-50 text-amber-800 border border-amber-200">
            Bahan Baku
          </span>
        )
      case 'operasional':
      case 'pengeluaran_outlet':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-lg text-xs font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
            Operasional
          </span>
        )
      case 'transport':
      case 'transportasi':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-lg text-xs font-semibold bg-purple-50 text-purple-800 border border-purple-200">
            Transport
          </span>
        )
      case 'utilitas':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-lg text-xs font-semibold bg-blue-50 text-blue-800 border border-blue-200">
            Utilitas
          </span>
        )
      case 'topup':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-lg text-xs font-semibold bg-indigo-50 text-indigo-800 border border-indigo-200">
            Topup
          </span>
        )
      default:
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-lg text-xs font-semibold bg-orange-50 text-suka-orange border border-orange-200 capitalize">
            {cat ? cat.replace(/_/g, ' ') : 'Lainnya'}
          </span>
        )
    }
  }

  // Fetch real petty cash balances from latest shifts
  const { data: realBalances = {}, isLoading: loadingRealBalances } = useQuery({
    queryKey: ['petty_cash_real_balances'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_all_latest_petty_cash_balances')
      if (error) throw error
      const map: Record<string, number> = {}
      if (data) {
        for (const r of data) {
          if (r.outlet_id) {
            map[r.outlet_id] = Number(r.balance || 0)
          }
        }
      }
      return map
    },
    refetchInterval: 120000
  })

  // Calculate Outlet Petty Cash Balances
  const outletBalances = useMemo(() => {
    const filteredOutlets = outlets.filter(o => 
      !['KANTOR PUSAT', 'GUDANG PUSAT (HQ)', 'GLOBAL OUTLET (SYSTEM)', 'outlet tes', 'MITRA CITAYAM'].includes(o.name)
    )

    return filteredOutlets.map(o => ({
      id: o.id,
      label: o.name,
      saldo: realBalances[o.id] ?? 0
    })).sort((a, b) => {
      const nameA = a.label.replace('Kas Kecil ', '').replace('Petty Cash ', '')
      const nameB = b.label.replace('Kas Kecil ', '').replace('Petty Cash ', '')
      return nameA.localeCompare(nameB)
    })
  }, [outlets, realBalances])

  const totalAllOutletsBalance = useMemo(() => {
    return outletBalances.reduce((sum, item) => sum + (item.saldo || 0), 0)
  }, [outletBalances])

  const handleDownloadCSV = () => {
    if (!data || data.length === 0) return

    const headers = ['Tanggal', 'Outlet', 'Kategori', 'Deskripsi', 'Jumlah', 'Tipe']
    const rows = data.map(item => [
      item.expenseDate || item.date.substring(0, 10),
      `"${item.outletName}"`,
      `"${item.category}"`,
      `"${(item.description || '').replace(/"/g, '""')}"`,
      item.type === 'expense' ? -item.amount : item.amount,
      item.type
    ])

    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n')
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    
    link.href = URL.createObjectURL(blob)
    link.setAttribute('download', `Riwayat_Petty_Cash_${startDate}_to_${endDate}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(link.href)
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-red-700">
        Gagal memuat data petty cash: {(error as Error).message}
      </div>
    )
  }

  const selectedOutletName = selectedOutletId === 'all' 
    ? 'Semua Outlet' 
    : (outlets.find(o => o.id === selectedOutletId)?.name || 'Outlet')

  const currentDisplayBalance = selectedOutletId === 'all'
    ? totalAllOutletsBalance
    : (outletBalances.find(l => l.id === selectedOutletId)?.saldo ?? 0)

  return (
    <div className="space-y-6">
      
      {/* Petty Cash Balances Summary Card */}
      <div className="bg-white rounded-[2rem] p-6 shadow-sm border border-suka-brown/5 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="bg-suka-brown/10 p-4 rounded-2xl text-suka-brown">
            <Store size={28} />
          </div>
          <div>
            <div className="flex items-center gap-2 mb-1">
              <p className="text-suka-ink/60 text-xs font-bold uppercase tracking-wider">
                {selectedOutletId === 'all' ? 'Total Sisa Saldo Kas Kecil' : 'Sisa Saldo Kas Kecil Fisik'}
              </p>
              <span className="text-[10px] bg-suka-brown/10 text-suka-brown px-2 py-0.5 rounded-full font-bold">
                Real-time
              </span>
            </div>
            <h3 className="font-display text-xl text-suka-brown">
              {selectedOutletName}
            </h3>
            <p className="text-[11px] text-suka-gray-400 font-medium">
              Posisi kas kecil fisik saat ini di kasir/outlet (tidak terikat filter tanggal)
            </p>
          </div>
        </div>
        
        {loadingRealBalances || loadingOutlets ? (
           <div className="flex justify-end pr-4"><Spinner size={28} /></div>
        ) : (
          <div className="md:text-right bg-suka-cream/30 border border-suka-brown/5 px-6 py-4 rounded-2xl">
            <span className={`font-display text-3xl flex items-baseline ${
              currentDisplayBalance < 0 ? 'text-red-600' : 'text-suka-brown'
            }`}>
              <span className="text-lg mr-1 font-sans font-bold">Rp</span>
              <NumberFlow value={currentDisplayBalance} />
            </span>
          </div>
        )}
      </div>

      {/* Filter Section */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* Date Range Selector Card */}
        <div className="bg-white rounded-[2rem] p-6 shadow-sm border border-suka-brown/5 flex flex-col justify-center">
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-suka-ink/60 text-xs font-bold uppercase tracking-wider">Pilih Periode Pengeluaran</p>
              <Calendar size={14} className="text-suka-brown/40" />
            </div>
            <div className="flex flex-col gap-2">
              <select 
                value={preset} 
                onChange={handlePresetChange}
                className="w-full border border-suka-gray-200 rounded-xl px-3 py-2.5 text-sm font-bold text-suka-brown focus:outline-none focus:border-suka-orange focus:ring-1 focus:ring-suka-orange transition-all bg-white"
              >
                <option value="hari_ini">Hari Ini</option>
                <option value="kemarin">Kemarin</option>
                <option value="7_hari">7 Hari Terakhir</option>
                <option value="bulan_ini">Bulan Ini</option>
                <option value="bulan_lalu">Bulan Lalu</option>
                <option value="1_bulan">30 Hari Terakhir</option>
                <option value="custom">Kustom...</option>
              </select>
              
              {preset === 'custom' && (
                <div className="flex flex-col gap-2 mt-1 pt-3 border-t border-suka-brown/10">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-black text-suka-gray-400 uppercase w-12">Dari</span>
                    <input 
                      type="date" 
                      value={startDate} 
                      onChange={e => handleCustomDateChange(true, e.target.value)}
                      className="flex-1 border border-suka-gray-200 rounded-xl px-3 py-2 text-xs font-bold text-suka-brown focus:outline-none focus:border-suka-orange focus:ring-1 focus:ring-suka-orange transition-all bg-suka-cream/10" 
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-black text-suka-gray-400 uppercase w-12">Sampai</span>
                    <input 
                      type="date" 
                      value={endDate} 
                      onChange={e => handleCustomDateChange(false, e.target.value)}
                      className="flex-1 border border-suka-gray-200 rounded-xl px-3 py-2 text-xs font-bold text-suka-brown focus:outline-none focus:border-suka-orange focus:ring-1 focus:ring-suka-orange transition-all bg-suka-cream/10" 
                    />
                  </div>
                  {startDate && endDate && startDate > endDate && (
                    <p className="text-[11px] text-red-500 font-semibold">
                      Tanggal &quot;Dari&quot; tidak boleh lebih besar dari &quot;Sampai&quot;
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Outlet Selector Card */}
        <div className="bg-white rounded-[2rem] p-6 shadow-sm border border-suka-brown/5 flex flex-col justify-center">
          <div>
            <p className="text-suka-ink/60 text-xs font-bold uppercase tracking-wider mb-2">Filter Outlet</p>
            <TargetCombobox 
              value={selectedOutletId} 
              onChange={handleOutletChange}
              options={[
                { value: 'all', label: 'Semua Outlet' },
                ...outlets.filter(o => !isExcludedOutlet(o)).map(o => ({ value: o.id, label: o.name }))
              ]}
              className="w-full"
            />
          </div>
        </div>

      </div>

      {/* Summary Metrics Row (Periode Terpilih) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

        {/* Total Topups Card */}
        <div className="bg-white rounded-[2rem] p-6 shadow-sm border border-suka-brown/5 relative overflow-hidden group hover:shadow-xl hover:shadow-indigo-500/10 transition-all h-full">
          <div className="absolute right-0 top-0 w-32 h-32 bg-indigo-50/80 rounded-bl-full -z-0 transition-transform group-hover:scale-110"></div>
          <div className="relative z-10 flex flex-col justify-center h-full">
            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="bg-indigo-100 p-2 rounded-xl text-indigo-600">
                  <ArrowDownLeft size={20} />
                </div>
                <span className="text-[10px] font-bold text-indigo-700 bg-indigo-50 px-2.5 py-0.5 rounded-full border border-indigo-200">
                  {topupsList.length} Topup Disetujui
                </span>
              </div>
              <p className="text-suka-ink/60 text-xs font-bold uppercase tracking-wider mb-0.5">Total Topup Kas Masuk</p>
              <p className="text-[11px] text-suka-gray-400 font-medium mb-1">
                Dana cair periode {tanggal(startDate)} – {tanggal(endDate)}
              </p>
              <h3 className="font-display text-3xl text-suka-ink flex items-baseline">
                <span className="text-lg mr-1 font-sans font-bold">Rp</span>
                <NumberFlow value={totalTopups} />
              </h3>
            </div>
          </div>
        </div>

        {/* Total Expenses Card */}
        <div className="bg-white rounded-[2rem] p-6 shadow-sm border border-suka-brown/5 relative overflow-hidden group hover:shadow-xl hover:shadow-suka-orange/10 transition-all h-full">
          <div className="absolute right-0 top-0 w-32 h-32 bg-orange-50 rounded-bl-full -z-0 transition-transform group-hover:scale-110"></div>
          <div className="relative z-10 flex flex-col justify-center h-full">
            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="bg-orange-100 p-2 rounded-xl text-suka-orange">
                  <Receipt size={20} />
                </div>
                <span className="text-[10px] font-bold text-suka-orange bg-orange-50 px-2.5 py-0.5 rounded-full border border-orange-200">
                  {expensesList.length} Nota Belanja
                </span>
              </div>
              <p className="text-suka-ink/60 text-xs font-bold uppercase tracking-wider mb-0.5">Total Pemakaian Petty Cash</p>
              <p className="text-[11px] text-suka-gray-400 font-medium mb-1">
                Belanja kasir periode {tanggal(startDate)} – {tanggal(endDate)}
              </p>
              <h3 className="font-display text-3xl text-suka-ink flex items-baseline">
                <span className="text-lg mr-1 font-sans font-bold">Rp</span>
                <NumberFlow value={totalExpenses} />
              </h3>
            </div>
          </div>
        </div>

      </div>

      {/* Table Section */}
      <div className="bg-white rounded-[2rem] p-6 shadow-sm border border-suka-brown/5">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="font-display text-xl text-suka-brown">Rincian Riwayat (Pengeluaran & Topup)</h3>
            <p className="text-xs text-suka-gray-400 font-medium mt-0.5">
              Menampilkan transaksi {selectedOutletName} untuk periode {tanggal(startDate)} – {tanggal(endDate)}
            </p>
          </div>
          <button
            onClick={handleDownloadCSV}
            disabled={!data || data.length === 0}
            className="flex items-center gap-2 px-4 py-2 bg-suka-orange text-white rounded-xl font-bold text-sm hover:bg-orange-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Download size={16} />
            Download CSV
          </button>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-12"><Spinner size={32} /></div>
        ) : !isDateRangeValid ? (
          <EmptyState 
            title="Rentang Tanggal Tidak Valid" 
            description="Silakan periksa kembali tanggal yang dipilih. Tanggal 'Dari' tidak boleh lebih baru dari 'Sampai'." 
          />
        ) : currentData.length === 0 ? (
          <EmptyState 
            title="Tidak ada rincian transaksi" 
            description={`Belum ada transaksi pengeluaran atau topup kas kecil untuk ${selectedOutletName} pada periode ${tanggal(startDate)} s/d ${tanggal(endDate)}.`} 
          />
        ) : (
          <div className="flex flex-col gap-4">
            <div className="overflow-x-auto w-full">
              <table className="w-full text-left text-sm border-collapse min-w-[750px] whitespace-nowrap">
                <thead>
                  <tr className="bg-suka-cream/20 text-suka-gray-500 border-b border-suka-brown/5">
                    <th className="py-3 px-5 font-semibold">Tanggal</th>
                    <th className="py-3 px-5 font-semibold">Outlet</th>
                    <th className="py-3 px-5 font-semibold">Kategori</th>
                    <th className="py-3 px-5 font-semibold">Deskripsi</th>
                    <th className="py-3 px-5 font-semibold text-right">Jumlah</th>
                    <th className="py-3 px-5 font-semibold text-center">Bukti Nota</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-suka-brown/5">
                  {currentData.map((item) => (
                    <tr 
                      key={item.id} 
                      className="hover:bg-orange-50/20 transition-colors"
                    >
                      <td className="py-4 px-5 text-suka-gray-500">
                        {tanggal(item.expenseDate || item.date)}
                      </td>
                      <td className="py-4 px-5 font-bold text-suka-ink">
                        {item.outletName}
                      </td>
                      <td className="py-4 px-5">
                        {getCategoryBadge(item.category)}
                      </td>
                      <td className="py-4 px-5 text-suka-gray-600 max-w-xs truncate" title={item.description}>
                        {item.description}
                      </td>
                      <td className={`py-4 px-5 text-right font-black ${item.type === 'topup' ? 'text-indigo-600' : 'text-suka-brown'}`}>
                        {item.type === 'topup' ? '+' : '-'}{rupiah(item.amount)}
                      </td>
                      <td className="py-4 px-5 text-center">
                        {item.receiptUrl ? (
                          <a 
                            href={item.receiptUrl} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-suka-orange hover:text-suka-orange/80 transition-colors font-bold text-xs bg-orange-50 px-2.5 py-1 rounded-lg border border-orange-200"
                          >
                            <FileText size={14} />
                            Lihat Nota
                            <ExternalLink size={10} />
                          </a>
                        ) : (
                          <span className="text-suka-gray-400 italic text-xs">Tidak ada</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between border-t border-suka-brown/5 pt-4">
                <div className="text-sm text-suka-gray-500 font-medium">
                  Menampilkan <span className="font-bold text-suka-brown">{(page - 1) * ITEMS_PER_PAGE + 1}</span> - <span className="font-bold text-suka-brown">{Math.min(page * ITEMS_PER_PAGE, data.length)}</span> dari <span className="font-bold text-suka-brown">{data.length}</span> data
                </div>
                <div className="flex items-center gap-2">
                  <button 
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="p-1 rounded-lg border border-suka-gray-200 text-suka-brown disabled:opacity-50 disabled:cursor-not-allowed hover:bg-suka-cream transition-colors"
                  >
                    <ChevronLeft size={20} />
                  </button>
                  <span className="text-sm font-bold text-suka-brown px-2">{page} / {totalPages}</span>
                  <button 
                    onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                    className="p-1 rounded-lg border border-suka-gray-200 text-suka-brown disabled:opacity-50 disabled:cursor-not-allowed hover:bg-suka-cream transition-colors"
                  >
                    <ChevronRight size={20} />
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
