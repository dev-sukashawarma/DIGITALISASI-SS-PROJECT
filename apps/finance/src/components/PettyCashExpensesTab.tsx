'use client'

import React, { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase'
import { useOutlets } from '@/hooks/useOutlets'
import { Spinner, EmptyState } from '@suka/design-system'
import { rupiah, tanggal } from '@/lib/format'
import { motion } from 'framer-motion'
import { Receipt, FileText, ExternalLink, Store } from 'lucide-react'
import NumberFlow from '@number-flow/react'

export default function PettyCashExpensesTab() {
  const [preset, setPreset] = useState('hari_ini')
  const [startDate, setStartDate] = useState(() => {
    const d = new Date()
    return d.toISOString().slice(0, 10)
  })
  const [endDate, setEndDate] = useState(() => {
    const d = new Date()
    return d.toISOString().slice(0, 10)
  })
  const [selectedOutletId, setSelectedOutletId] = useState('all')

  const supabase = useMemo(() => createClient(), [])
  const { data: outlets = [], isLoading: loadingOutlets } = useOutlets()

  const handlePresetChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value
    setPreset(val)
    const today = new Date()
    
    if (val === 'hari_ini') {
      const d = today.toISOString().slice(0, 10)
      setStartDate(d)
      setEndDate(d)
    } else if (val === 'kemarin') {
      const d = new Date(today)
      d.setDate(d.getDate() - 1)
      const str = d.toISOString().slice(0, 10)
      setStartDate(str)
      setEndDate(str)
    } else if (val === '7_hari') {
      const start = new Date(today)
      start.setDate(start.getDate() - 6)
      setStartDate(start.toISOString().slice(0, 10))
      setEndDate(today.toISOString().slice(0, 10))
    } else if (val === '1_bulan') {
      const start = new Date(today)
      start.setDate(start.getDate() - 29)
      setStartDate(start.toISOString().slice(0, 10))
      setEndDate(today.toISOString().slice(0, 10))
    } else if (val === 'bulan_ini') {
      const d = new Date(today)
      setStartDate(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`)
      setEndDate(d.toISOString().slice(0, 10))
    }
  }

  const handleCustomDateChange = (isStart: boolean, val: string) => {
    setPreset('custom')
    if (isStart) setStartDate(val)
    else setEndDate(val)
  }

  const { data = [], isLoading, error } = useQuery({
    queryKey: ['petty_cash_expenses_detail', startDate, endDate, selectedOutletId],
    queryFn: async () => {
      const from = startDate
      const to = endDate
      const toDateTime = `${to}T23:59:59.999Z`

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
          outlets(name)
        `)
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
          outlets(name)
        `)
        .gte('created_at', `${from}T00:00:00.000Z`)
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
        date: row.expense_date,
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
        receiptUrl: null
      }))

      const combined = [...mappedExpenses, ...mappedTopups]
      combined.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

      return combined
    }
  })

  const totalExpenses = useMemo(() => {
    return data.filter(d => d.type === 'expense').reduce((sum, item) => sum + item.amount, 0)
  }, [data])

  const getCategoryBadge = (category: string) => {
    switch (category) {
      case 'operasional':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-lg text-xs font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
            Operasional
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
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-lg text-xs font-semibold bg-orange-50 text-suka-orange border border-orange-200">
            Lainnya
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
    refetchInterval: 30000 // Refresh every 30s
  })

  // Calculate Outlet Petty Cash Balances
  const outletBalances = useMemo(() => {
    const filteredOutlets = outlets.filter(o => 
      !['KANTOR PUSAT', 'GUDANG PUSAT (HQ)', 'GLOBAL OUTLET (SYSTEM)'].includes(o.name)
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

  if (error) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-red-700">
        Gagal memuat data petty cash: {(error as Error).message}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      
      {/* Petty Cash Balances Summary */}
      {selectedOutletId !== 'all' && (
        <div className="bg-white rounded-[2rem] p-6 shadow-sm border border-suka-brown/5 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="bg-suka-brown/10 p-4 rounded-2xl text-suka-brown">
              <Store size={28} />
            </div>
            <div>
              <p className="text-suka-ink/60 text-xs font-bold uppercase tracking-wider mb-1">Sisa Saldo Petty Cash</p>
              <h3 className="font-display text-xl text-suka-brown">
                {outlets.find(o => o.id === selectedOutletId)?.name || 'Outlet'}
              </h3>
            </div>
          </div>
          
          {loadingRealBalances || loadingOutlets ? (
             <div className="flex justify-end pr-4"><Spinner size={28} /></div>
          ) : (
            <div className="md:text-right bg-suka-cream/30 border border-suka-brown/5 px-6 py-4 rounded-2xl">
              <span className={`font-display text-3xl flex items-baseline ${
                (outletBalances.find(l => l.id === selectedOutletId)?.saldo ?? 0) < 0 ? 'text-red-600' : 'text-suka-brown'
              }`}>
                <span className="text-lg mr-1 font-sans font-bold">Rp</span>
                <NumberFlow value={outletBalances.find(l => l.id === selectedOutletId)?.saldo ?? 0} />
              </span>
            </div>
          )}
        </div>
      )}

      {/* Filter & Summary Section */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* Date Range Selector Card */}
        <div className="bg-white rounded-[2rem] p-6 shadow-sm border border-suka-brown/5 flex flex-col justify-center h-full">
          <div>
            <p className="text-suka-ink/60 text-xs font-bold uppercase tracking-wider mb-2">Pilih Periode Pengeluaran</p>
            <div className="flex flex-col gap-2">
              <select 
                value={preset} 
                onChange={handlePresetChange}
                className="w-full border border-suka-gray-200 rounded-xl px-3 py-2.5 text-sm font-bold text-suka-brown focus:outline-none focus:border-suka-orange focus:ring-1 focus:ring-suka-orange transition-all bg-white"
              >
                <option value="hari_ini">Hari Ini</option>
                <option value="kemarin">Kemarin</option>
                <option value="7_hari">7 Hari Terakhir</option>
                <option value="1_bulan">1 Bulan Terakhir</option>
                <option value="bulan_ini">Bulan Ini</option>
                <option value="custom">Kustom...</option>
              </select>
              
              {preset === 'custom' && (
                <div className="flex gap-2">
                  <input 
                    type="date" 
                    value={startDate} 
                    onChange={e => handleCustomDateChange(true, e.target.value)}
                    className="w-full border border-suka-gray-200 rounded-xl px-2 py-2 text-xs font-bold text-suka-brown focus:outline-none focus:border-suka-orange focus:ring-1 focus:ring-suka-orange transition-all bg-suka-cream/10" 
                  />
                  <span className="flex items-center text-suka-gray-400 font-bold">-</span>
                  <input 
                    type="date" 
                    value={endDate} 
                    onChange={e => handleCustomDateChange(false, e.target.value)}
                    className="w-full border border-suka-gray-200 rounded-xl px-2 py-2 text-xs font-bold text-suka-brown focus:outline-none focus:border-suka-orange focus:ring-1 focus:ring-suka-orange transition-all bg-suka-cream/10" 
                  />
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Outlet Selector Card */}
        <div className="bg-white rounded-[2rem] p-6 shadow-sm border border-suka-brown/5 flex flex-col justify-center h-full">
          <div>
            <p className="text-suka-ink/60 text-xs font-bold uppercase tracking-wider mb-2">Filter Outlet</p>
            <select 
              value={selectedOutletId} 
              onChange={e => setSelectedOutletId(e.target.value)}
              className="w-full border border-suka-gray-200 rounded-xl px-3 py-2.5 text-sm font-bold text-suka-brown focus:outline-none focus:border-suka-orange focus:ring-1 focus:ring-suka-orange transition-all bg-white"
            >
              <option value="all">Semua Outlet</option>
              {outlets.map(o => (
                <option key={o.id} value={o.id}>{o.name}</option>
              ))}
            </select>
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
              </div>
              <p className="text-suka-ink/60 text-xs font-bold uppercase tracking-wider mb-1">Total Pemakaian Petty Cash</p>
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
          <h3 className="font-display text-xl text-suka-brown">Rincian Riwayat (Pengeluaran & Topup)</h3>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-12"><Spinner size={32} /></div>
        ) : data.length === 0 ? (
          <EmptyState title="Tidak ada rincian transaksi" description="Belum ada transaksi pengeluaran kas kecil pada periode ini." />
        ) : (
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
              <motion.tbody 
                initial="hidden"
                animate="visible"
                variants={{
                  visible: { transition: { staggerChildren: 0.05 } },
                  hidden: {},
                }}
                className="divide-y divide-suka-brown/5"
              >
                {data.map((item) => (
                  <motion.tr 
                    variants={{
                      hidden: { opacity: 0, y: 10 },
                      visible: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 300, damping: 24 } }
                    }}
                    key={item.id} 
                    className="hover:bg-orange-50/20 transition-colors"
                  >
                    <td className="py-4 px-5 text-suka-gray-500">
                      {tanggal(item.date)}
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
                      {item.type === 'topup' ? '+' : ''}{rupiah(item.amount)}
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
                  </motion.tr>
                ))}
              </motion.tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
