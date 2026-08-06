'use client'
// @ts-nocheck

import React, { useState, useEffect } from 'react'
import { Target, TrendingUp, Store, Receipt, ArrowRight, AlertCircle, ShoppingBag } from 'lucide-react'
import { createClient } from '@/lib/supabase'
import { formatRupiah } from '@/lib/validations'

interface OrderItem {
  menu_item_name: string
  quantity: number
}

interface Order {
  id: string
  order_number: number
  created_at: string
  status: string
  total_amount: number
  order_items?: OrderItem[]
  outlet_id: string
}

interface Outlet {
  id: string
  name: string
}

function formatTime(iso: string) {
  if (!iso) return '-'
  try {
    const d = new Date(iso)
    return d.toLocaleTimeString('id-ID', {
      hour: '2-digit',
      minute: '2-digit'
    })
  } catch {
    return iso
  }
}

export default function SalesMonitoringPage() {
  const supabase = createClient()
  
  const [outlets, setOutlets] = useState<Outlet[]>([])
  const [selectedOutletId, setSelectedOutletId] = useState<string>('')
  
  const [currentSales, setCurrentSales] = useState<number>(0)
  const [targetSales, setTargetSales] = useState<number>(0)
  const [recentOrders, setRecentOrders] = useState<Order[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    loadOutlets()
  }, [])

  useEffect(() => {
    if (selectedOutletId) {
      loadSalesData(selectedOutletId)
      
      
      
      
      // Realtime subscription for orders
      const channel = supabase
        .channel('leader-sales-realtime')
        .on('postgres_changes', { 
          event: '*', 
          schema: 'public', 
          table: 'orders',
          filter: `outlet_id=eq.${selectedOutletId}`
        }, () => {
          loadSalesData(selectedOutletId)
        })
        .subscribe()

      return () => {
        supabase.removeChannel(channel)
      }
    }
  }, [selectedOutletId])

  async function loadOutlets() {
    try {
      const { data: userRes } = await supabase.auth.getUser()
      const user = userRes?.user
      if (!user) return undefined

      let staff: any = null
      const { data: staffData } = await supabase
        .from('outlet_staff')
        .select('id, name, role, outlet_id')
        .eq('id', user.id)
        .maybeSingle()
      
      staff = staffData
      if (!staff) {
        const { data: leaderStaff } = await supabase
          .from('outlet_staff')
          .select('id, name, role, outlet_id')
          .eq('role', 'leader')
          .limit(1)
          .maybeSingle()
        staff = leaderStaff
      }

      let accessibleOutletIds: string[] = []
      if (staff && !['admin', 'admin_finance', 'owner'].includes(staff.role)) {
        const { data: mapped } = await supabase
          .from('staff_outlets')
          .select('outlet_id')
          .eq('staff_id', staff.id)

        const ids = new Set<string>()
        if (staff.outlet_id) ids.add(staff.outlet_id)
        if (mapped) mapped.forEach((m: any) => ids.add(m.outlet_id))
        accessibleOutletIds = Array.from(ids)
      }

      let outletQuery = supabase.from('outlets').select('id, name').eq('is_active', true).order('name', { ascending: true })
      if (accessibleOutletIds.length > 0) {
        outletQuery = outletQuery.in('id', accessibleOutletIds)
      }

      const { data: outletData } = await outletQuery
      if (outletData && outletData.length > 0) {
        setOutlets(outletData)
        setSelectedOutletId(outletData[0].id)
      }
    } catch (err) {
      console.warn('Error loading outlets:', err)
    } finally {
      setIsLoading(false)
    }
  }

  async function loadSalesData(outletId: string) {
    try {
      setIsLoading(true)
      
      const todayStr = new Date(new Date().getTime() + 7 * 3600 * 1000).toISOString().split('T')[0]
      const fromStart = `${todayStr}T00:00:00.000+07:00`
      const toEnd = `${todayStr}T23:59:59.999+07:00`

      // 1. Fetch Today's Orders (Completed) for Sales Total
      const { data: orders } = await supabase
        .from('orders')
        .select('total_amount')
        .eq('outlet_id', outletId)
        .eq('status', 'completed')
        .gte('created_at', fromStart)
        .lte('created_at', toEnd)

      const totalSales = (orders || []).reduce((sum, o) => sum + (Number(o.total_amount) || 0), 0)
      setCurrentSales(totalSales)

      // 2. Fetch Recent Orders (Any status to see real-time queue)
      const { data: recent } = await supabase
        .from('orders')
        .select('id, order_number, created_at, status, total_amount')
        .eq('outlet_id', outletId)
        .gte('created_at', fromStart)
        .lte('created_at', toEnd)
        .order('created_at', { ascending: false })
        .limit(10)

      if (recent && recent.length > 0) {
        // Fetch items for these recent orders
        const orderIds = recent.map(r => r.id)
        const { data: itemsData } = await supabase
          .from('order_items')
          .select('order_id, menu_item_name, quantity')
          .in('order_id', orderIds)
        
        const enrichedRecent = recent.map(order => {
          const items = (itemsData || []).filter(i => i.order_id === order.id)
          return { ...order, order_items: items }
        })
        setRecentOrders(enrichedRecent)
      } else {
        setRecentOrders([])
      }

      // 3. Fetch Target (try to get from historical_daily_targets for today if it exists, or just fallback to 0)
      const { data: targetData } = await supabase
        .from('historical_daily_targets')
        .select('target_amount')
        .eq('outlet_id', outletId)
        .eq('record_date', today)
        .maybeSingle()

      if (targetData && targetData.target_amount) {
        setTargetSales(Number(targetData.target_amount))
      } else {
        // If no daily target recorded yet, we don't have a reliable target. Default to 0.
        setTargetSales(0)
      }

    } catch (err) {
      console.warn('Error loading sales data:', err)
    }
  }

  const percentage = targetSales > 0 ? Math.min((currentSales / targetSales) * 100, 100) : 0
  const isTargetMet = targetSales > 0 && currentSales >= targetSales

  if (isLoading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[50vh] font-sans">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-suka-orange"></div>
      </div>
    )
  }

  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto space-y-6 font-sans pb-24">
      {/* Header */}
      <div>
        <p className="text-sm font-semibold text-suka-orange mb-1 uppercase tracking-wider">Dashboard Sales</p>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">Penjualan & Target</h1>
      </div>

      {/* Outlet Selector */}
      {outlets.length > 1 && (
        <div className="bg-white rounded-2xl border border-slate-100 p-4 shadow-sm flex items-center gap-3">
          <Store className="w-5 h-5 text-slate-400 shrink-0" />
          <div className="flex-1">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Pilih Outlet</label>
            <select
              value={selectedOutletId}
              onChange={(e) => setSelectedOutletId(e.target.value)}
              className="w-full bg-transparent text-sm font-bold text-slate-900 focus:outline-none cursor-pointer appearance-none"
            >
              {outlets.map(o => (
                <option key={o.id} value={o.id}>{o.name}</option>
              ))}
            </select>
          </div>
        </div>
      )}

      {/* Grid Layout */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6">
        {/* Main Sales & Target Card */}
        <div className="md:col-span-2 bg-white rounded-[24px] border border-slate-100 shadow-sm p-6 relative overflow-hidden">
          <div className="flex items-start justify-between mb-8 relative z-10">
            <div>
              <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Total Penjualan Hari Ini</h2>
              <div className="flex flex-col sm:flex-row sm:items-baseline gap-3">
                <span className="text-4xl sm:text-5xl font-extrabold text-slate-900 tracking-tighter">
                  {formatRupiah(currentSales)}
                </span>
                
                {targetSales > 0 && (
                  isTargetMet ? (
                    <span className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-700 bg-emerald-50 px-3 py-1.5 rounded-xl border border-emerald-100">
                      <TrendingUp size={14} /> Target Tercapai
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 text-xs font-bold text-blue-700 bg-blue-50 px-3 py-1.5 rounded-xl border border-blue-100">
                      <TrendingUp size={14} /> On Track
                    </span>
                  )
                )}
              </div>
            </div>
            <div className="w-14 h-14 rounded-2xl bg-slate-50 border border-slate-100 text-slate-900 flex items-center justify-center shrink-0">
              <ShoppingBag className="w-6 h-6" />
            </div>
          </div>

          {/* Progress Bar (Only show if target is set) */}
          {targetSales > 0 ? (
            <div className="relative z-10 mt-6">
              <div className="flex justify-between text-xs font-bold text-slate-500 mb-3">
                <span>Progress Pencapaian</span>
                <span className="text-slate-900">Target: {formatRupiah(targetSales)}</span>
              </div>
              <div className="h-4 w-full bg-slate-100 rounded-full overflow-hidden">
                <div 
                  className={`h-full rounded-full transition-all duration-1000 ${isTargetMet ? 'bg-emerald-500' : 'bg-suka-orange'}`}
                  style={{ width: `${percentage}%` }}
                />
              </div>
              <div className="mt-3 flex justify-between text-xs font-bold text-slate-400">
                <span>0%</span>
                <span className="text-slate-900">{percentage.toFixed(1)}%</span>
              </div>
            </div>
          ) : (
            <div className="mt-6 pt-6 border-t border-slate-100">
              <p className="text-sm font-medium text-slate-500 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-slate-400" />
                Target harian belum ditentukan untuk outlet ini.
              </p>
            </div>
          )}
        </div>

        {/* Action / Promo Suggestion Card */}
        <div className="bg-slate-950 rounded-[24px] p-6 text-white shadow-md flex flex-col justify-between relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-bl from-white/10 to-transparent rounded-bl-full pointer-events-none" />
          
          <div className="relative z-10">
            <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center mb-4">
              <Target className="w-5 h-5 text-white" />
            </div>
            <h3 className="font-bold text-lg mb-2 text-white leading-tight">Kejar Target Hari Ini</h3>
            <p className="text-slate-400 text-sm leading-relaxed font-medium mb-6">
              Tawarkan menu rekomendasi atau gunakan promo upsell ke pelanggan yang datang.
            </p>
          </div>
          
          <div className="relative z-10">
            <button className="w-full py-3.5 bg-white text-slate-950 hover:bg-slate-100 active:scale-95 rounded-xl font-bold text-sm transition-all shadow-sm flex items-center justify-center gap-2">
              Lihat Panduan Promo <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Recent Orders List */}
      <div className="bg-white rounded-[24px] border border-slate-100 shadow-sm overflow-hidden mt-4">
        <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Receipt className="w-5 h-5 text-slate-400" />
            <h2 className="text-base font-extrabold text-slate-900">Transaksi Terakhir Hari Ini</h2>
          </div>
        </div>
        
        <div className="divide-y divide-slate-100">
          {recentOrders.length === 0 ? (
            <div className="p-8 text-center text-slate-500 text-sm font-medium">
              Belum ada transaksi hari ini.
            </div>
          ) : (
            recentOrders.map((order) => {
              const itemSummary = order.order_items 
                ? order.order_items.map(i => `${i.quantity}x ${i.menu_item_name}`).join(', ')
                : 'Tidak ada detail item'

              return (
                <div key={order.id} className="p-4 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between hover:bg-slate-50 transition-colors gap-4">
                  <div className="flex items-start sm:items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-slate-100 flex flex-col items-center justify-center shrink-0">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Waktu</span>
                      <span className="font-extrabold text-slate-900 text-xs">{formatTime(order.created_at)}</span>
                    </div>
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="font-bold text-slate-900 text-sm">#{order.order_number}</h4>
                        {order.status === 'completed' ? (
                          <span className="px-2 py-0.5 rounded-lg bg-emerald-50 text-emerald-700 text-[10px] font-bold uppercase tracking-wider">
                            Selesai
                          </span>
                        ) : order.status === 'cancelled' ? (
                          <span className="px-2 py-0.5 rounded-lg bg-red-50 text-red-700 text-[10px] font-bold uppercase tracking-wider">
                            Dibatalkan
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-lg bg-blue-50 text-blue-700 text-[10px] font-bold uppercase tracking-wider">
                            Proses
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-500 font-medium line-clamp-1">{itemSummary}</p>
                    </div>
                  </div>
                  
                  <div className="font-extrabold text-slate-900 text-sm sm:text-base whitespace-nowrap pl-16 sm:pl-0">
                    + {formatRupiah(order.total_amount)}
                  </div>
                </div>
              )
            })
          )}
        </div>
      </div>
    </div>
  )
}
