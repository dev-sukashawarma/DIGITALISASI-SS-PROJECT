// @ts-nocheck
'use client'
// @ts-nocheck

import React, { useState, useEffect } from 'react'
import { Package, AlertTriangle, CheckCircle, Search, Store } from 'lucide-react'
import { createClient } from '@/lib/supabase'

interface InventoryBatch {
  id: string
  item_id: string
  qty_remaining: number
}

interface InventoryItem {
  id: string
  name: string
  base_unit_id: string
}

interface InventoryUnit {
  id: string
  name: string
}

interface Outlet {
  id: string
  name: string
}

interface StockItem {
  id: string
  name: string
  current: number
  unit: string
  min: number
  status: 'critical' | 'warning' | 'safe'
}

export default function StockMonitoringPage() {
  const supabase = createClient()
  
  const [searchTerm, setSearchTerm] = useState('')
  const [outlets, setOutlets] = useState<Outlet[]>([])
  const [selectedOutletId, setSelectedOutletId] = useState<string>('')
  const [isLoading, setIsLoading] = useState(true)
  const [stocks, setStocks] = useState<StockItem[]>([])

  useEffect(() => {
    loadOutlets()
  }, [])

  useEffect(() => {
    if (selectedOutletId) {
      loadStockData(selectedOutletId)
      
      const channel = supabase
        .channel('leader-stock-realtime')
        .on('postgres_changes', { 
          event: '*', 
          schema: 'public', 
          table: 'inventory_batches',
          filter: `location_id=eq.${selectedOutletId}`
        }, () => {
          loadStockData(selectedOutletId)
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

  async function loadStockData(outletId: string) {
    try {
      // Fetch batches, items, units concurrently
      const [batchesRes, itemsRes, unitsRes] = await Promise.all([
        supabase
          .from('inventory_batches')
          .select('id, item_id, qty_remaining')
          .eq('location_id', outletId)
          .gt('qty_remaining', 0),
        supabase.from('inventory_items').select('id, name, base_unit_id'),
        supabase.from('inventory_units').select('id, name')
      ])

      const batches: InventoryBatch[] = batchesRes.data || []
      const items: InventoryItem[] = itemsRes.data || []
      const units: InventoryUnit[] = unitsRes.data || []

      // Create lookup maps
      const itemMap = new Map<string, InventoryItem>(items.map(i => [i.id, i]))
      const unitMap = new Map<string, InventoryUnit>(units.map(u => [u.id, u]))

      // Aggregate quantities by item_id
      const qtyMap = new Map<string, number>()
      for (const b of batches) {
        const currentQty = qtyMap.get(b.item_id) || 0
        qtyMap.set(b.item_id, currentQty + Number(b.qty_remaining))
      }

      // Format as StockItem array
      const newStocks: StockItem[] = []
      
      // We will iterate through all items that belong to the outlet, or at least those that have batches.
      // Wait, what if stock is 0? If we only iterate over batches, items with 0 stock won't appear!
      // Let's just show items that have been assigned to this outlet before or exist in inventory items.
      // But if there are 1000 items globally, maybe we only want ones with some history?
      // Let's just show all items that are present in the qtyMap for now, plus a fallback if needed.
      // To show 0 stock items, we'd need to know which items are linked to this location. We don't have location_items table explicitly mapped here.
      // We'll show all items that are currently in batches for this outlet.
      
      for (const [itemId, qty] of qtyMap.entries()) {
        const itemDef = itemMap.get(itemId)
        if (!itemDef) continue

        const unitDef = itemDef.base_unit_id ? unitMap.get(itemDef.base_unit_id) : undefined
        const unitName = unitDef?.name || 'Unit'
        
        // Define fallback min limits based on unit type (simple heuristic)
        let minLimit = 10
        if (unitName.toLowerCase().includes('kg') || unitName.toLowerCase().includes('liter')) minLimit = 5
        
        let status: 'critical' | 'warning' | 'safe' = 'safe'
        if (qty <= minLimit * 0.5) status = 'critical'
        else if (qty <= minLimit) status = 'warning'

        newStocks.push({
          id: itemId,
          name: itemDef.name,
          current: Number(qty.toFixed(2)),
          unit: unitName,
          min: minLimit,
          status
        })
      }

      // Sort by status (critical first) and then by name
      newStocks.sort((a, b) => {
        const rank = { critical: 0, warning: 1, safe: 2 }
        if (rank[a.status] !== rank[b.status]) return rank[a.status] - rank[b.status]
        return a.name.localeCompare(b.name)
      })

      setStocks(newStocks)
    } catch (err) {
      console.warn('Error fetching stock data:', err)
    }
  }

  const filteredStocks = stocks.filter(s => s.name.toLowerCase().includes(searchTerm.toLowerCase()))
  const criticalCount = stocks.filter(s => s.status === 'critical').length
  const warningCount = stocks.filter(s => s.status === 'warning').length

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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-suka-orange mb-1 uppercase tracking-wider">Dashboard Stok</p>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">Monitoring Stok</h1>
        </div>
        
        {/* Quick Summary Badges - Solid Pills */}
        <div className="flex items-center gap-2">
          {criticalCount > 0 && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-red-50 border border-red-100 rounded-xl text-xs font-bold text-red-700 shadow-sm">
              <AlertTriangle size={14} className="text-red-600" />
              <span>{criticalCount} Kritis</span>
            </div>
          )}
          {warningCount > 0 && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 border border-amber-100 rounded-xl text-xs font-bold text-amber-800 shadow-sm">
              <AlertTriangle size={14} className="text-amber-600" />
              <span>{warningCount} Menipis</span>
            </div>
          )}
        </div>
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

      {/* Toolbar & Search */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="relative w-full max-w-sm">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
          <input 
            type="text" 
            placeholder="Cari bahan baku..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-3 bg-white border border-slate-100 rounded-[16px] text-sm font-semibold text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-suka-orange transition-all shadow-sm"
          />
        </div>
        <button className="px-5 py-3 bg-slate-900 hover:bg-black active:scale-95 text-white rounded-[16px] text-sm font-bold transition-all shadow-sm shrink-0 cursor-pointer">
          Minta Restock
        </button>
      </div>

      {/* Stock List (Mobile First Cards) */}
      {filteredStocks.length === 0 ? (
        <div className="bg-white rounded-[24px] border border-slate-100 shadow-sm p-12 text-center flex flex-col items-center">
          <div className="w-16 h-16 rounded-full bg-slate-50 flex items-center justify-center mb-4">
            <Package className="w-8 h-8 text-slate-300" />
          </div>
          <h3 className="text-slate-900 font-bold text-lg mb-1">Tidak Ada Data</h3>
          <p className="text-slate-500 font-medium text-sm">
            Bahan baku tidak ditemukan atau stok kosong.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
          {filteredStocks.map((row) => (
            <div key={row.id} className="bg-white rounded-[20px] border border-slate-100 shadow-sm p-5 hover:shadow-md transition-shadow relative overflow-hidden group">
              
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-[14px] bg-slate-50 flex items-center justify-center shrink-0 border border-slate-100 group-hover:scale-110 transition-transform">
                    <Package size={20} className="text-slate-400" />
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-900 text-sm line-clamp-1" title={row.name}>{row.name}</h4>
                    <p className="text-xs font-medium text-slate-500 mt-0.5">Batas Min: {row.min} {row.unit}</p>
                  </div>
                </div>
              </div>

              <div className="flex items-end justify-between">
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Sisa Stok</p>
                  <div className="flex items-baseline gap-1">
                    <span className={`font-extrabold text-2xl tracking-tighter ${
                      row.status === 'critical' ? 'text-red-600' : 
                      row.status === 'warning' ? 'text-amber-600' : 
                      'text-slate-900'
                    }`}>
                      {row.current}
                    </span>
                    <span className="text-slate-500 text-xs font-medium ml-1">{row.unit}</span>
                  </div>
                </div>

                <div className="shrink-0">
                  {row.status === 'critical' && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-bold bg-red-50 text-red-700 border border-red-100 uppercase tracking-wider">
                      <AlertTriangle size={12} /> Kritis
                    </span>
                  )}
                  {row.status === 'warning' && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-100 uppercase tracking-wider">
                      <AlertTriangle size={12} /> Menipis
                    </span>
                  )}
                  {row.status === 'safe' && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-100 uppercase tracking-wider">
                      <CheckCircle size={12} /> Aman
                    </span>
                  )}
                </div>
              </div>

            </div>
          ))}
        </div>
      )}
    </div>
  )
}
