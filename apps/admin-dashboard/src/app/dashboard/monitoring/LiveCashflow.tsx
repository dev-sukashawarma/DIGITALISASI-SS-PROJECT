'use client'

import { useState, useEffect, useMemo } from 'react'
import { createClient } from '@/lib/supabase'
import { Spinner } from '@suka/design-system'
import { Sun, Moon, TrendingUp, TrendingDown, Clock, DollarSign, Activity } from 'lucide-react'

type CashflowItem = {
  id: string
  type: 'INCOME' | 'EXPENSE'
  amount: number
  description: string
  created_at: string
  outlet_id: string
  outlet_name?: string
  isNew?: boolean
}

export default function LiveCashflow() {
  const [isDark, setIsDark] = useState(true)
  const [items, setItems] = useState<CashflowItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [outlets, setOutlets] = useState<Record<string, string>>({})

  const supabase = createClient()

  const getTodayStr = () => {
    const formatter = new Intl.DateTimeFormat('en-CA', { 
      timeZone: 'Asia/Jakarta', year: 'numeric', month: '2-digit', day: '2-digit' 
    })
    return formatter.format(new Date())
  }

  const fetchInitialData = async () => {
    try {
      // fetch outlets
      const { data: outData } = await supabase.from('outlets').select('id, name')
      const outletMap: Record<string, string> = {}
      if (outData) {
        outData.forEach(o => outletMap[o.id] = o.name)
      }
      setOutlets(outletMap)

      const todayStr = getTodayStr()
      const start = new Date(`${todayStr}T00:00:00+07:00`).toISOString()

      const [ordersRes, pettyRes] = await Promise.all([
        supabase.from('orders').select('id, total_amount, customer_name, outlet_id, created_at').gte('created_at', start).order('created_at', { ascending: false }).limit(50),
        supabase.from('petty_cash_expenses').select('id, amount, notes, outlet_id, created_at').gte('created_at', start).order('created_at', { ascending: false }).limit(50)
      ])

      const list: CashflowItem[] = []
      if (ordersRes.data) {
        ordersRes.data.forEach(o => {
          list.push({
            id: o.id,
            type: 'INCOME',
            amount: o.total_amount,
            description: `Pesanan Kasir${o.customer_name ? ` - ${o.customer_name}` : ''}`,
            created_at: o.created_at,
            outlet_id: o.outlet_id,
            outlet_name: outletMap[o.outlet_id] || 'Unknown'
          })
        })
      }
      if (pettyRes.data) {
        pettyRes.data.forEach(p => {
          list.push({
            id: p.id,
            type: 'EXPENSE',
            amount: p.amount,
            description: p.notes || 'Pengeluaran Petty Cash',
            created_at: p.created_at,
            outlet_id: p.outlet_id,
            outlet_name: outletMap[p.outlet_id] || 'Unknown'
          })
        })
      }

      list.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      setItems(list.slice(0, 50))
    } catch (e) {
      console.error(e)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchInitialData()

    const channel = supabase.channel('live-cashflow-stream')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'orders' }, (payload) => {
        const row = payload.new as any
        setItems(prev => {
          const newItem: CashflowItem = {
            id: row.id, type: 'INCOME', amount: row.total_amount,
            description: `Pesanan Baru`, created_at: row.created_at,
            outlet_id: row.outlet_id, isNew: true
          }
          return [newItem, ...prev].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()).slice(0, 50)
        })
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'petty_cash_expenses' }, (payload) => {
        const row = payload.new as any
        setItems(prev => {
          const newItem: CashflowItem = {
            id: row.id, type: 'EXPENSE', amount: row.amount,
            description: row.notes || 'Pengeluaran Baru', created_at: row.created_at,
            outlet_id: row.outlet_id, isNew: true
          }
          return [newItem, ...prev].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()).slice(0, 50)
        })
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  // Clear isNew flag after animation
  useEffect(() => {
    const hasNew = items.some(i => i.isNew)
    if (hasNew) {
      const timer = setTimeout(() => {
        setItems(prev => prev.map(i => ({ ...i, isNew: false })))
      }, 2500)
      return () => clearTimeout(timer)
    }
    return undefined
  }, [items])

  const totalIncome = useMemo(() => items.filter(i => i.type === 'INCOME').reduce((s, i) => s + i.amount, 0), [items])
  const totalExpense = useMemo(() => items.filter(i => i.type === 'EXPENSE').reduce((s, i) => s + i.amount, 0), [items])

  const formatRp = (n: number) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(n)

  if (isLoading) return <div className="flex-1 flex justify-center items-center py-20"><Spinner className="w-8 h-8 text-suka-orange" /></div>

  return (
    <div className={`transition-colors duration-500 rounded-2xl overflow-hidden flex flex-col shadow-sm ${isDark ? 'bg-[#0b0e14] border border-gray-800' : 'bg-white border border-gray-200'}`}>
      
      {/* Header Controls */}
      <div className={`p-4 sm:p-6 border-b flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 ${isDark ? 'border-gray-800/60' : 'border-gray-100'}`}>
        <div>
          <h2 className={`text-lg sm:text-xl font-black flex items-center gap-2 ${isDark ? 'text-white' : 'text-gray-900'}`}>
            <Activity className={isDark ? 'text-emerald-400' : 'text-emerald-600'} /> Live Cashflow Stream
          </h2>
          <p className={`text-xs sm:text-sm font-medium mt-1 flex items-center gap-1.5 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            Real-time Feed Aktif
          </p>
        </div>
        
        {/* Theme Toggle */}
        <button 
          onClick={() => setIsDark(!isDark)}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold transition-all ${
            isDark ? 'bg-gray-800 text-gray-300 hover:bg-gray-700 hover:text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200 hover:text-gray-900'
          }`}
        >
          {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          {isDark ? 'Ubah ke Terang' : 'Ubah ke Gelap'}
        </button>
      </div>

      {/* Metrics Row */}
      <div className={`grid grid-cols-2 gap-px border-b ${isDark ? 'bg-gray-800/50 border-gray-800/60' : 'bg-gray-200 border-gray-100'}`}>
        <div className={`p-4 sm:p-6 flex flex-col justify-center ${isDark ? 'bg-[#0b0e14]' : 'bg-white'}`}>
          <span className={`text-[10px] sm:text-xs font-bold tracking-widest uppercase mb-1 flex items-center gap-1.5 ${isDark ? 'text-emerald-400' : 'text-emerald-600'}`}>
            <TrendingUp className="w-3.5 h-3.5" /> Pemasukan (Streamed)
          </span>
          <span className={`text-xl sm:text-3xl font-black tabular-nums tracking-tight ${isDark ? 'text-emerald-400' : 'text-emerald-600'}`}>
            {formatRp(totalIncome)}
          </span>
        </div>
        <div className={`p-4 sm:p-6 flex flex-col justify-center ${isDark ? 'bg-[#0b0e14]' : 'bg-white'}`}>
          <span className={`text-[10px] sm:text-xs font-bold tracking-widest uppercase mb-1 flex items-center gap-1.5 ${isDark ? 'text-rose-400' : 'text-rose-600'}`}>
            <TrendingDown className="w-3.5 h-3.5" /> Pengeluaran (Streamed)
          </span>
          <span className={`text-xl sm:text-3xl font-black tabular-nums tracking-tight ${isDark ? 'text-rose-400' : 'text-rose-600'}`}>
            {formatRp(totalExpense)}
          </span>
        </div>
      </div>

      {/* Stream List */}
      <div className="flex-1 overflow-auto p-4 sm:p-6 min-h-[400px] max-h-[600px] space-y-3">
        {items.length === 0 ? (
          <div className={`flex flex-col items-center justify-center h-full space-y-3 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
             <DollarSign className="w-12 h-12 opacity-20" />
             <p className="text-sm font-medium">Menunggu transaksi masuk hari ini...</p>
          </div>
        ) : items.map(item => {
          const isIncome = item.type === 'INCOME'
          const timeStr = new Date(item.created_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
          
          return (
            <div 
              key={item.id} 
              className={`flex items-center justify-between p-3 sm:p-4 rounded-xl transition-all duration-700 ${
                item.isNew 
                  ? isIncome ? (isDark ? 'bg-emerald-900/40 shadow-[0_0_15px_rgba(16,185,129,0.2)] scale-[1.02]' : 'bg-emerald-50 border border-emerald-200 scale-[1.02]') : (isDark ? 'bg-rose-900/40 shadow-[0_0_15px_rgba(244,63,94,0.2)] scale-[1.02]' : 'bg-rose-50 border border-rose-200 scale-[1.02]')
                  : isDark ? 'bg-[#151b23] hover:bg-[#1a212a] scale-100' : 'bg-gray-50 hover:bg-gray-100 scale-100'
              }`}
            >
              <div className="flex items-center gap-3 sm:gap-4 overflow-hidden">
                <div className={`w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center shrink-0 ${
                  isIncome 
                    ? isDark ? 'bg-emerald-500/10 text-emerald-400' : 'bg-emerald-100 text-emerald-600' 
                    : isDark ? 'bg-rose-500/10 text-rose-400' : 'bg-rose-100 text-rose-600'
                }`}>
                  {isIncome ? <TrendingUp className="w-4 h-4 sm:w-5 sm:h-5" /> : <TrendingDown className="w-4 h-4 sm:w-5 sm:h-5" />}
                </div>
                <div className="flex flex-col min-w-0">
                  <div className="flex items-center gap-2">
                    <span className={`text-sm sm:text-base font-bold truncate ${isDark ? 'text-gray-100' : 'text-gray-800'}`}>
                      {item.description}
                    </span>
                    {item.isNew && <span className={`text-[9px] px-1.5 py-0.5 rounded uppercase font-black tracking-wider ${isIncome ? 'bg-emerald-500 text-white animate-pulse' : 'bg-rose-500 text-white animate-pulse'}`}>Baru Masuk</span>}
                  </div>
                  <span className={`text-[11px] sm:text-xs font-semibold truncate mt-0.5 ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>
                    {outlets[item.outlet_id] || item.outlet_name || 'Cabang'}
                  </span>
                </div>
              </div>
              
              <div className="flex flex-col items-end shrink-0 pl-3">
                <span className={`text-sm sm:text-lg font-black tabular-nums tracking-tight ${
                  isIncome 
                    ? isDark ? 'text-emerald-400' : 'text-emerald-600' 
                    : isDark ? 'text-rose-400' : 'text-rose-600'
                }`}>
                  {isIncome ? '+' : '-'}{formatRp(item.amount)}
                </span>
                <span className={`text-[10px] sm:text-xs font-medium flex items-center gap-1 mt-0.5 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                  <Clock className="w-3 h-3" /> {timeStr}
                </span>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
