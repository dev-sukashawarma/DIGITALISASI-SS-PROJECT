// @ts-nocheck
'use client'

import React, { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase'
import { useAuth } from '@suka/auth'
import { Store, Globe, Search, X, Check, Package, Sandwich, Edit2, Calculator, PanelRightClose, RefreshCw, Save, ArrowUpDown, ChevronUp, ChevronDown, Layers, Sparkles } from 'lucide-react'
import type { Outlet, MenuOutletPrice } from '@/pos-types'
import { CATEGORY_GROUPS, type CategoryGroupMeta, getSizeRank } from './categoryHelper'

interface HppMenuItem {
  id: string
  name: string
  category: string
  categoryFullName?: string
  categoryId?: string
  categoryOrder: number
  categoryIcon?: string
  categoryBadgeBg?: string
  categoryBorderAccent?: string
  sortOrder: number
  price: number
  channelPrices: Record<string, number>
  channelHpp?: Record<string, number>
  availableOnlineChannels: string[] | null
  isAvailable: boolean
  isAvailableOnline: boolean
  isPackage: boolean
  hpp: number | null
  hppOverride: number | null
  isPartial: boolean
  updatedAt?: string | null
  updatedBy?: string | null
}

interface Channel {
  id: string
  name: string
  color?: string
}

interface HppDashboardViewProps {
  items: HppMenuItem[]
  channels: Channel[]
}

function rupiah(n: number) {
  return 'Rp ' + Math.round(n).toLocaleString('id-ID')
}

export default function HppDashboardView({ items, channels }: HppDashboardViewProps) {
  const router = useRouter()
  const supabase = createClient()
  const { outletStaff } = useAuth()

  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<string>('all')
  const [sortField, setSortField] = useState<'default' | 'name' | 'price' | 'hpp' | 'profit' | 'margin'>('default')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')
  
  // Drawer state
  const [selectedMenuId, setSelectedMenuId] = useState<string | null>(null)
  const [isDrawerOpen, setIsDrawerOpen] = useState(false)

  // Global Data
  const [outlets, setOutlets] = useState<Outlet[]>([])
  const [allOutletPrices, setAllOutletPrices] = useState<MenuOutletPrice[]>([])
  const [isLoadingOutlets, setIsLoadingOutlets] = useState(true)
  const [isSaving, setIsSaving] = useState(false)

  // Inline edit for Pusat HPP
  const [editingPusatId, setEditingPusatId] = useState<string | null>(null)
  const [pusatHppValue, setPusatHppValue] = useState<string>('')

  // Local state for Drawer edits before saving
  const [localOutletPrices, setLocalOutletPrices] = useState<Record<string, MenuOutletPrice>>({}) // keyed by outlet_id

  useEffect(() => {
    const fetchOutletData = async () => {
      try {
        const { data: outletData, error: errOutlets } = await supabase
          .from('outlets')
          .select('*')
          .eq('type', 'mitra')
          .order('name')
        
        if (errOutlets) throw errOutlets
        setOutlets(outletData || [])

        const { data: priceData, error: errPrices } = await supabase
          .from('menu_outlet_prices')
          .select('*')
        
        if (errPrices) throw errPrices
        setAllOutletPrices(priceData || [])
      } catch (err: any) {
        console.error(err)
        toast.error('Gagal memuat data outlet')
      } finally {
        setIsLoadingOutlets(false)
      }
    }
    fetchOutletData()
  }, [supabase])

  // Count items per category
  const categoryCountMap = useMemo(() => {
    const map: Record<string, number> = {}
    items.forEach(i => {
      const catId = i.categoryId || 'other'
      map[catId] = (map[catId] || 0) + 1
    })
    return map
  }, [items])

  // Open Drawer and initialize local state
  const handleOpenDrawer = (menuId: string) => {
    const menuPrices = allOutletPrices.filter(p => p.menu_item_id === menuId)
    const priceMap: Record<string, MenuOutletPrice> = {}
    
    // Initialize map with existing data or defaults
    outlets.forEach(o => {
      const existing = menuPrices.find(p => p.outlet_id === o.id)
      if (existing) {
        priceMap[o.id] = { ...existing }
      } else {
        priceMap[o.id] = {
          menu_item_id: menuId,
          outlet_id: o.id,
          price: null,
          hpp_override: null,
          is_available: true
        }
      }
    })
    
    setLocalOutletPrices(priceMap)
    setSelectedMenuId(menuId)
    setIsDrawerOpen(true)
  }

  const handleCloseDrawer = () => {
    setIsDrawerOpen(false)
    setTimeout(() => setSelectedMenuId(null), 300) // wait for animation
  }

  // Filtered Main Table Items
  const filteredItems = useMemo(() => {
    let res = items

    // Filter by Category
    if (selectedCategory !== 'all') {
      res = res.filter(r => r.categoryId === selectedCategory)
    }

    // Filter by Search Query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim()
      res = res.filter(r => r.name.toLowerCase().includes(q) || (r.categoryFullName && r.categoryFullName.toLowerCase().includes(q)))
    }

    // Sort by categoryOrder, then sizeRank (Sedang, Besar, Jumbo, Reguler), then sortOrder, then name
    const sortedByCategory = [...res].sort((a, b) => {
      // 1. Sort by Category Order
      if (a.categoryOrder !== b.categoryOrder) {
        return a.categoryOrder - b.categoryOrder
      }

      // 2. Sort by Size Rank: Sedang (1), Besar (2), Jumbo (3), Reguler (4)
      const sizeRankA = getSizeRank(a.name)
      const sizeRankB = getSizeRank(b.name)
      if (sizeRankA !== sizeRankB) {
        return sizeRankA - sizeRankB
      }
      
      // 3. Sort by Item Sort Order
      if (a.sortOrder !== b.sortOrder) {
        return a.sortOrder - b.sortOrder
      }
      
      // 4. Fallback to Alphabetical
      return a.name.localeCompare(b.name)
    })

    if (sortField === 'default') {
      return sortedByCategory
    }

    // Secondary sorting logic
    return sortedByCategory.sort((a, b) => {
      let comparison = 0
      const hppA = a.hppOverride !== null ? a.hppOverride : a.hpp
      const hppB = b.hppOverride !== null ? b.hppOverride : b.hpp

      switch (sortField) {
        case 'name':
          comparison = a.name.localeCompare(b.name)
          break
        case 'price':
          comparison = a.price - b.price
          break
        case 'hpp':
          if (hppA === null && hppB === null) comparison = 0
          else if (hppA === null) return 1
          else if (hppB === null) return -1
          else comparison = hppA - hppB
          break
        case 'profit': {
          const profitA = hppA !== null ? a.price - hppA : -Infinity
          const profitB = hppB !== null ? b.price - hppB : -Infinity
          comparison = profitA - profitB
          break
        }
        case 'margin': {
          const marginA = hppA !== null && a.price > 0 ? (a.price - hppA) / a.price : -Infinity
          const marginB = hppB !== null && b.price > 0 ? (b.price - hppB) / b.price : -Infinity
          comparison = marginA - marginB
          break
        }
      }

      return sortDir === 'asc' ? comparison : -comparison
    })
  }, [items, selectedCategory, searchQuery, sortField, sortDir])

  const handleSort = (field: 'default' | 'name' | 'price' | 'hpp' | 'profit' | 'margin') => {
    if (sortField === field) {
      if (field === 'default') return // Default only has one direction
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortDir('asc')
    }
  }

  const SortIndicator = ({ field }: { field: 'default' | 'name' | 'price' | 'hpp' | 'profit' | 'margin' }) => {
    if (sortField !== field) {
      return <ArrowUpDown className="w-3 h-3 ml-1 text-gray-300 group-hover:text-gray-500 transition-colors" />
    }
    return sortDir === 'asc' ? (
      <ChevronUp className="w-3.5 h-3.5 ml-1 text-suka-primary font-bold" />
    ) : (
      <ChevronDown className="w-3.5 h-3.5 ml-1 text-suka-primary font-bold" />
    )
  }

  // Helper for rendering Margin
  const renderMargin = (hpp: number | null, price: number) => {
    if (hpp === null || price <= 0) return <span className="text-gray-400">—</span>
    const margin = ((price - hpp) / price) * 100
    if (margin >= 35) return <span className="text-green-600 font-bold">+{margin.toFixed(1)}%</span>
    if (margin >= 20) return <span className="text-amber-600 font-bold">{margin.toFixed(1)}%</span>
    return <span className="text-red-600 font-bold">{margin.toFixed(1)}%</span>
  }

  const renderMarginTextOnly = (hpp: number | null, price: number) => {
    if (hpp === null || price <= 0) return <span className="text-gray-400 text-[10px]">—</span>
    const margin = ((price - hpp) / price) * 100
    if (margin >= 35) return <span className="text-green-600 font-bold text-[10px]">+{margin.toFixed(1)}%</span>
    if (margin >= 20) return <span className="text-amber-600 font-bold text-[10px]">{margin.toFixed(1)}%</span>
    return <span className="text-red-600 font-bold text-[10px]">{margin.toFixed(1)}%</span>
  }

  // Save Pusat Override
  const handleSavePusatHpp = async (row: HppMenuItem, channelKey?: string) => {
    try {
      setIsSaving(true)
      const val = pusatHppValue.trim() === '' ? null : Math.round(Number(pusatHppValue))

      const userUpdater = outletStaff?.name
        ? `${outletStaff.name} (${outletStaff.role === 'regional_manager' ? 'RM' : outletStaff.role.replace('_', ' ').toUpperCase()})`
        : 'Manager'

      if (channelKey === 'ss_online') {
        const currentChannelHpp = row.channelHpp || {}
        const nextChannelHpp = { ...currentChannelHpp }
        if (val === null) {
          delete nextChannelHpp.ss_online
          delete nextChannelHpp.tiktok_shop
          delete nextChannelHpp.shopee_shop
          delete nextChannelHpp['f3305089-b9e4-4b92-95da-14bf6e7fb6d5']
          delete nextChannelHpp['d68eb5ec-d6bb-4d0a-8758-a2600c8f1584']
        } else {
          nextChannelHpp.ss_online = val
          nextChannelHpp.tiktok_shop = val
          nextChannelHpp.shopee_shop = val
          nextChannelHpp['f3305089-b9e4-4b92-95da-14bf6e7fb6d5'] = val
          nextChannelHpp['d68eb5ec-d6bb-4d0a-8758-a2600c8f1584'] = val
        }
        const { error } = await supabase
          .from('menu_items')
          .update({
            channel_hpp: nextChannelHpp,
            updated_by: userUpdater,
            updated_at: new Date().toISOString()
          })
          .eq('id', row.id)
        if (error) throw error
        toast.success(val === null ? `HPP SS Online "${row.name}" direset` : `HPP SS Online "${row.name}" diset ke ${rupiah(val)}`)
      } else {
        const { error } = await supabase
          .from('menu_items')
          .update({
            hpp_override: val,
            updated_by: userUpdater,
            updated_at: new Date().toISOString()
          })
          .eq('id', row.id)
        if (error) throw error

        // Auto update Mitra HPP (+10%)
        const mitraVal = val === null ? null : Math.round(val * 1.1)
        const payload = outlets.map(o => {
          const existing = allOutletPrices.find(p => p.menu_item_id === row.id && p.outlet_id === o.id)
          return {
            menu_item_id: row.id,
            outlet_id: o.id,
            is_available: existing ? existing.is_available : true,
            price: existing ? existing.price : null,
            hpp_override: mitraVal
          }
        })
        
        const { error: mitraError } = await supabase.from('menu_outlet_prices').upsert(payload, { onConflict: 'menu_item_id,outlet_id' })
        if (mitraError) console.error("Gagal auto-update HPP Mitra", mitraError)

        toast.success(val === null ? `HPP Pusat untuk "${row.name}" direset ke BOM` : `HPP Pusat "${row.name}" diset ke ${rupiah(val)}, HPP Mitra otomatis disesuaikan (+10%)`)
      }

      setEditingPusatId(null)
      router.refresh()
      setTimeout(() => {
        window.location.reload()
      }, 500)
    } catch (e: any) {
      toast.error(e.message || 'Gagal menyimpan HPP')
    } finally {
      setIsSaving(false)
    }
  }

  // Drawer Save Outlet Prices
  const handleSaveDrawer = async () => {
    if (!selectedMenuId) return
    try {
      setIsSaving(true)
      const userUpdater = outletStaff?.name
        ? `${outletStaff.name} (${outletStaff.role === 'regional_manager' ? 'RM' : outletStaff.role.replace('_', ' ').toUpperCase()})`
        : 'Manager'

      const payload = Object.values(localOutletPrices).map(p => ({
        menu_item_id: p.menu_item_id,
        outlet_id: p.outlet_id,
        price: p.price === null || p.price === '' as any ? null : Number(p.price),
        hpp_override: p.hpp_override === null || p.hpp_override === '' as any ? null : Number(p.hpp_override),
        is_available: p.is_available,
        updated_by: userUpdater,
        updated_at: new Date().toISOString()
      }))

      if (payload.length > 0) {
        const { error } = await supabase.from('menu_outlet_prices').upsert(payload, { onConflict: 'menu_item_id,outlet_id' })
        if (error) throw error
        
        // Update local cache
        const newAllPrices = allOutletPrices.filter(p => p.menu_item_id !== selectedMenuId).concat(payload as any)
        setAllOutletPrices(newAllPrices)
        
        toast.success('Pengaturan harga mitra berhasil disimpan!')
        handleCloseDrawer()
      }
    } catch (e: any) {
      toast.error(e.message || 'Gagal menyimpan harga mitra')
    } finally {
      setIsSaving(false)
    }
  }

  // Auto +10% in Drawer
  const handleAutoCalculateDrawer = (baseHpp: number | null) => {
    if (!baseHpp || baseHpp <= 0) return toast.error('HPP Pusat belum tersedia')
    if (!confirm('Auto-isi semua HPP Mitra di bawah menjadi +10% dari HPP Pusat?')) return

    const autoHpp = Math.round(baseHpp * 1.10)
    setLocalOutletPrices(prev => {
      const next = { ...prev }
      Object.keys(next).forEach(oId => {
        next[oId] = { ...next[oId], hpp_override: autoHpp }
      })
      return next
    })
    toast.success('HPP Mitra dihitung (+10%). Silakan periksa dan Simpan.')
  }

  const selectedMenu = items.find(i => i.id === selectedMenuId)
  const activeBOM = selectedMenu ? (selectedMenu.hppOverride !== null ? selectedMenu.hppOverride : selectedMenu.hpp) : null

  // Bulk Auto +10% Semua Menu
  const handleBulkAutoCalculate = async () => {
    if (!confirm('PENTING: Ini akan menghitung dan menimpa HPP semua Mitra menjadi +10% dari HPP Pusat untuk SEMUA MENU yang sudah memiliki HPP. Lanjutkan?')) return;
    
    setIsSaving(true)
    try {
      const userUpdater = outletStaff?.name
        ? `${outletStaff.name} (${outletStaff.role === 'regional_manager' ? 'RM' : outletStaff.role.replace('_', ' ').toUpperCase()})`
        : 'Manager'

      const payload: any[] = []
      
      items.forEach(menu => {
        const effHpp = menu.hppOverride !== null ? menu.hppOverride : menu.hpp
        if (effHpp !== null && effHpp > 0) {
          const autoHpp = Math.round(effHpp * 1.10)
          
          outlets.forEach(o => {
            // Cek apakah sudah ada config sebelumnya
            const existing = allOutletPrices.find(p => p.menu_item_id === menu.id && p.outlet_id === o.id)
            
            payload.push({
              menu_item_id: menu.id,
              outlet_id: o.id,
              price: existing ? existing.price : null,
              hpp_override: autoHpp,
              is_available: existing ? existing.is_available : true,
              updated_by: userUpdater,
              updated_at: new Date().toISOString()
            })
          })
        }
      })

      if (payload.length > 0) {
        // Upsert in chunks to avoid large payload errors
        const chunkSize = 500
        for (let i = 0; i < payload.length; i += chunkSize) {
          const chunk = payload.slice(i, i + chunkSize)
          const { error } = await supabase.from('menu_outlet_prices').upsert(chunk, { onConflict: 'menu_item_id,outlet_id' })
          if (error) throw error
        }
        
        toast.success(`Berhasil! ${payload.length} harga mitra telah diupdate menjadi +10%.`)
        
        // Refresh local state by fetching again
        const { data: priceData } = await supabase.from('menu_outlet_prices').select('*')
        if (priceData) setAllOutletPrices(priceData)
      } else {
        toast.info('Tidak ada menu yang memiliki HPP untuk diupdate.')
      }
    } catch (e: any) {
      console.error(e)
      toast.error(e.message || 'Gagal melakukan bulk update')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="space-y-6 relative overflow-hidden">
      
      {/* Category Pills Filter Bar */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-gray-200">
        {/* 'Semua' Pill */}
        <button
          onClick={() => setSelectedCategory('all')}
          className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs font-extrabold whitespace-nowrap transition-all duration-200 border shadow-sm ${
            selectedCategory === 'all'
              ? 'bg-suka-primary text-white border-suka-primary shadow-amber-500/20 scale-[1.02]'
              : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50 hover:text-gray-900'
          }`}
        >
          <Layers className="w-3.5 h-3.5" />
          <span>Semua Menu</span>
          <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
            selectedCategory === 'all' ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-600'
          }`}>
            {items.length}
          </span>
        </button>

        {/* 9 Category Groups */}
        {CATEGORY_GROUPS.map((cat) => {
          const count = categoryCountMap[cat.id] || 0
          const isSelected = selectedCategory === cat.id
          const isTikTok = cat.id === 'tiktok'

          return (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              className={`inline-flex items-center gap-2 px-3.5 py-2.5 rounded-2xl text-xs font-bold whitespace-nowrap transition-all duration-200 border shadow-sm ${
                isSelected
                  ? isTikTok
                    ? 'bg-gradient-to-r from-pink-500 to-rose-600 text-white border-transparent shadow-rose-500/30 scale-[1.02]'
                    : 'bg-gradient-to-r from-amber-500 to-orange-500 text-white border-transparent shadow-amber-500/30 scale-[1.02]'
                  : isTikTok
                    ? 'bg-rose-50/70 text-rose-700 border-rose-200 hover:bg-rose-100/80'
                    : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50 hover:text-gray-900'
              }`}
            >
              <span className="text-sm">{cat.icon}</span>
              <span>{cat.shortName}</span>
              <span
                className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
                  isSelected
                    ? 'bg-white/20 text-white'
                    : isTikTok
                      ? 'bg-rose-200/60 text-rose-800'
                      : 'bg-gray-100 text-gray-600'
                }`}
              >
                {count}
              </span>
            </button>
          )
        })}
      </div>

      {/* Search Bar & Actions */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white/60 backdrop-blur-xl p-4 border rounded-2xl shadow-sm">
        <div className="relative w-full md:w-96">
          <span className="absolute inset-y-0 left-0 flex items-center pl-4 pointer-events-none">
            <Search className="w-4 h-4 text-gray-400" />
          </span>
          <input
            type="text"
            placeholder="Cari nama menu..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-8 py-2.5 text-sm rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-suka-primary/20 focus:border-suka-primary placeholder-gray-400 bg-white shadow-inner transition-all"
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery('')} className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400 hover:text-gray-600">
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
        <div className="flex items-center gap-4">
          <button
            onClick={handleBulkAutoCalculate}
            disabled={isSaving || isLoadingOutlets}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-amber-50 text-amber-700 hover:bg-amber-100 rounded-xl text-sm font-bold border border-amber-200 transition-colors disabled:opacity-50"
          >
            {isSaving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Calculator className="w-4 h-4" />}
            Auto Set 10% Semua Mitra
          </button>
          <div className="text-sm font-bold text-gray-500 border-l pl-4">
            Total: <span className="text-gray-900">{filteredItems.length} Menu</span>
          </div>
        </div>
      </div>

      {/* Main Table */}
      <div className="bg-white/80 backdrop-blur-xl rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] overflow-hidden border border-gray-100">
        <div className="overflow-x-auto min-h-[60vh]">
          <table className="w-full text-sm text-left">
            <thead className="bg-gray-50/80 border-b border-gray-100 text-gray-500 text-[11px] uppercase tracking-wider font-extrabold sticky top-0 z-10">
              <tr>
                <th className="px-5 py-4 w-10"></th>
                <th onClick={() => handleSort('name')} className="px-5 py-4 cursor-pointer select-none group hover:bg-gray-100/50 transition-colors">
                  <div className="flex items-center">Menu<SortIndicator field="name" /></div>
                </th>
                <th className="px-5 py-4">
                  Channel
                </th>
                <th onClick={() => handleSort('price')} className="px-5 py-4 cursor-pointer select-none group hover:bg-gray-100/50 transition-colors text-right">
                  <div className="flex items-center justify-end">Harga Jual<SortIndicator field="price" /></div>
                </th>
                <th onClick={() => handleSort('hpp')} className="px-5 py-4 cursor-pointer select-none group hover:bg-gray-100/50 transition-colors text-right">
                  <div className="flex items-center justify-end">HPP Pusat<SortIndicator field="hpp" /></div>
                </th>
                <th className="px-5 py-4 text-right">
                  HPP Mitra
                </th>
                <th onClick={() => handleSort('margin')} className="px-5 py-4 cursor-pointer select-none group hover:bg-gray-100/50 transition-colors text-right">
                  <div className="flex items-center justify-end">Profit Pusat<SortIndicator field="margin" /></div>
                </th>
                <th className="px-5 py-4 text-right">
                  Profit Mitra
                </th>
                <th className="px-5 py-4">
                  Terakhir Diubah
                </th>
                <th className="px-5 py-4 text-right">
                  {sortField !== 'default' ? (
                    <button onClick={() => handleSort('default')} className="text-[10px] font-bold text-suka-primary bg-suka-primary/10 px-2 py-1 rounded hover:bg-suka-primary/20">
                      Kembali ke Kategori
                    </button>
                  ) : 'Aksi'}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredItems.map((row, idx) => {
                const isRegulerItem = row.name.toLowerCase().includes('reguler')
                
                const hasSsOnlineHpp = row.channelHpp && typeof row.channelHpp === 'object' && (
                  (row.channelHpp.ss_online !== undefined && row.channelHpp.ss_online !== null && Number(row.channelHpp.ss_online) > 0) ||
                  (row.channelHpp.tiktok_shop !== undefined && row.channelHpp.tiktok_shop !== null && Number(row.channelHpp.tiktok_shop) > 0) ||
                  (row.channelHpp.shopee_shop !== undefined && row.channelHpp.shopee_shop !== null && Number(row.channelHpp.shopee_shop) > 0)
                )

                const isSsOnlineChannel = row.availableOnlineChannels && Array.isArray(row.availableOnlineChannels) &&
                  row.availableOnlineChannels.some(c => ['ss_online', 'ss-online', 'tiktok_shop', 'shopee_shop'].includes(c.toLowerCase()))

                const isSsOnlineAvailable = hasSsOnlineHpp || isSsOnlineChannel || isRegulerItem

                const isOfflineAvailable = !isRegulerItem && row.isAvailable !== false && (
                  row.isAvailableOnline === false ||
                  row.availableOnlineChannels === null ||
                  row.availableOnlineChannels === undefined ||
                  !Array.isArray(row.availableOnlineChannels) ||
                  row.availableOnlineChannels.includes('pos_kasir')
                )

                const foodAppSlugs = ['gofood', 'grabfood', 'shopeefood']
                const isFoodAppsAvailable = !isRegulerItem && row.isAvailableOnline !== false && (
                  row.availableOnlineChannels === null ||
                  row.availableOnlineChannels === undefined ||
                  !Array.isArray(row.availableOnlineChannels) ||
                  row.availableOnlineChannels.some(c => foodAppSlugs.includes(c.toLowerCase().replace(/\s+/g, '')))
                )

                const isTikTokGoAvailable = !isRegulerItem && row.isAvailableOnline !== false && (
                  row.availableOnlineChannels && Array.isArray(row.availableOnlineChannels) &&
                  row.availableOnlineChannels.some(c => ['tiktokgo', 'tiktok_go', 'tiktok'].includes(c.toLowerCase().replace(/\s+/g, '')))
                )

                const offlineHpp = row.hppOverride !== null ? row.hppOverride : row.hpp

                interface FormattedChannelRow {
                  channelKey: string
                  label: string
                  price: number
                  hppPusat: number | null
                  bomHpp: number | null
                  hppOverride: number | null
                  isSsOnline: boolean
                  labelColor: string
                }

                const channelRows: FormattedChannelRow[] = []

                if (isOfflineAvailable) {
                  channelRows.push({
                    channelKey: 'offline',
                    label: 'OFFLINE',
                    price: row.price,
                    hppPusat: offlineHpp,
                    bomHpp: row.hpp,
                    hppOverride: row.hppOverride,
                    isSsOnline: false,
                    labelColor: 'text-gray-500'
                  })
                }

                if (isFoodAppsAvailable) {
                  let foodAppPrice: number | undefined = undefined
                  for (const slug of foodAppSlugs) {
                    if (row.channelPrices[slug] && Number(row.channelPrices[slug]) > 0) {
                      foodAppPrice = Number(row.channelPrices[slug])
                      break
                    }
                  }
                  channelRows.push({
                    channelKey: 'foodapps',
                    label: 'FOODAPPS',
                    price: foodAppPrice ?? (row.channelPrices.all_food_apps || row.channelPrices.foodapps || row.price),
                    hppPusat: offlineHpp,
                    bomHpp: row.hpp,
                    hppOverride: row.hppOverride,
                    isSsOnline: false,
                    labelColor: 'text-green-600'
                  })
                }

                if (isTikTokGoAvailable) {
                  const ttPrice = row.channelPrices.tiktokgo || row.channelPrices.tiktok_go
                  const ttHpp = row.channelHpp?.tiktok_go || offlineHpp
                  channelRows.push({
                    channelKey: 'tiktok_go',
                    label: 'TIKTOK GO',
                    price: (ttPrice !== undefined && ttPrice !== null && Number(ttPrice) > 0) ? Number(ttPrice) : row.price,
                    hppPusat: ttHpp,
                    bomHpp: row.hpp,
                    hppOverride: row.channelHpp?.tiktok_go || row.hppOverride,
                    isSsOnline: false,
                    labelColor: 'text-purple-600'
                  })
                }

                if (isSsOnlineAvailable) {
                  const ssPrice = row.channelPrices.ss_online || row.channelPrices.tiktok_shop || row.channelPrices.shopee_shop || row.price
                  const ssHpp = row.channelHpp?.ss_online ?? row.channelHpp?.tiktok_shop ?? row.channelHpp?.shopee_shop ?? (isRegulerItem ? null : offlineHpp)
                  channelRows.push({
                    channelKey: 'ss_online',
                    label: 'SS ONLINE',
                    price: (ssPrice !== undefined && ssPrice !== null && Number(ssPrice) > 0) ? Number(ssPrice) : row.price,
                    hppPusat: ssHpp,
                    bomHpp: row.hpp,
                    hppOverride: row.channelHpp?.ss_online ?? null,
                    isSsOnline: true,
                    labelColor: 'text-rose-600'
                  })
                }

                if (channelRows.length === 0) {
                  channelRows.push({
                    channelKey: 'offline',
                    label: 'OFFLINE',
                    price: row.price,
                    hppPusat: offlineHpp,
                    bomHpp: row.hpp,
                    hppOverride: row.hppOverride,
                    isSsOnline: false,
                    labelColor: 'text-gray-500'
                  })
                }

                const rowClasses = "flex items-center h-8 border-b border-gray-100 last:border-0";

                // Check category section divider header
                const prevRow = idx > 0 ? filteredItems[idx - 1] : null
                const isFirstOfCategory = !prevRow || prevRow.categoryId !== row.categoryId
                const showCategoryHeader = sortField === 'default' && isFirstOfCategory && selectedCategory === 'all' && !searchQuery.trim()
                const isTikTokRow = row.categoryId === 'tiktok'

                return (
                  <React.Fragment key={row.id}>
                    {showCategoryHeader && (
                      <tr className={`${isTikTokRow ? 'bg-gradient-to-r from-pink-50/80 via-rose-50/40 to-transparent border-t-2 border-b border-rose-200' : 'bg-gradient-to-r from-amber-50/80 via-orange-50/30 to-transparent border-t-2 border-b border-amber-200/60'}`}>
                        <td colSpan={10} className="px-5 py-3">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2.5">
                              <span className="text-lg">{row.categoryIcon || '📁'}</span>
                              <span className="font-black text-xs text-gray-900 tracking-wider uppercase">
                                {row.categoryFullName || row.category}
                              </span>
                              <span className={`text-[10px] font-extrabold px-2.5 py-0.5 rounded-full border ${row.categoryBadgeBg || 'bg-gray-100 text-gray-700'}`}>
                                {categoryCountMap[row.categoryId || ''] || 0} Menu
                              </span>
                            </div>
                            <button
                              onClick={() => setSelectedCategory(row.categoryId || 'all')}
                              className="text-[11px] font-bold text-suka-primary hover:underline hover:text-suka-primary/80"
                            >
                              Fokus Kategori Ini &rarr;
                            </button>
                          </div>
                        </td>
                      </tr>
                    )}
                    <tr className="hover:bg-gray-50/60 transition-colors group">
                      <td className="px-5 py-4 text-center">
                        {row.isPackage ? <Package className="w-4 h-4 text-purple-400 inline-block" /> : <Sandwich className="w-4 h-4 text-blue-400 inline-block" />}
                      </td>
                      <td className="px-5 py-4 font-bold text-gray-900">
                        {row.name}
                        <div className="flex items-center gap-1.5 mt-1">
                          <span className={`text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border ${row.categoryBadgeBg || 'bg-gray-100 text-gray-600'}`}>
                            {row.categoryIcon} {row.category}
                          </span>
                        </div>
                      </td>
                      
                      {/* Channel Column */}
                      <td className="py-4">
                        <div className="flex flex-col">
                          {channelRows.map((ch, cIdx) => (
                            <div key={`ch-${cIdx}`} className={rowClasses}>
                              <span className={`text-[10px] font-extrabold uppercase tracking-wider px-2 ${ch.labelColor}`}>
                                {ch.label}
                              </span>
                            </div>
                          ))}
                        </div>
                      </td>

                      {/* Harga Jual Column */}
                      <td className="py-4 text-right">
                        <div className="flex flex-col">
                          {channelRows.map((ch, cIdx) => (
                            <div key={`pr-${cIdx}`} className={`${rowClasses} justify-end px-5`}>
                              <span className="font-bold text-gray-900">{rupiah(ch.price)}</span>
                            </div>
                          ))}
                        </div>
                      </td>

                      {/* HPP Pusat Column */}
                      <td className="py-4 text-right align-middle">
                        <div className="flex flex-col">
                          {channelRows.map((ch, cIdx) => {
                            const editKey = `${row.id}_${ch.channelKey}`
                            const isEditingThis = editingPusatId === editKey
                            return (
                              <div key={`hpp-pst-${cIdx}`} className={`${rowClasses} justify-end gap-1.5 px-5 group/cell`}>
                                {isEditingThis ? (
                                  <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                                    <input
                                      type="number"
                                      placeholder={ch.hppPusat ? String(ch.hppPusat) : 'HPP...'}
                                      value={pusatHppValue}
                                      onChange={(e) => setPusatHppValue(e.target.value)}
                                      className="w-20 px-1.5 py-0.5 text-xs text-right border rounded focus:ring-1 focus:ring-suka-primary"
                                    />
                                    <button onClick={() => handleSavePusatHpp(row, ch.channelKey)} disabled={isSaving} className="p-1 text-white bg-green-500 hover:bg-green-600 rounded">
                                      <Check className="w-3 h-3" />
                                    </button>
                                    <button onClick={() => setEditingPusatId(null)} disabled={isSaving} className="p-1 text-gray-500 bg-gray-100 hover:bg-gray-200 rounded">
                                      <X className="w-3 h-3" />
                                    </button>
                                  </div>
                                ) : (
                                  <div className="flex items-center justify-end gap-1.5">
                                    <div className="text-right">
                                      <div className={`font-bold ${ch.hppPusat !== null ? (ch.isSsOnline ? 'text-rose-600' : 'text-amber-600') : 'text-gray-400'}`}>
                                        {ch.hppPusat !== null ? rupiah(ch.hppPusat) : <span className="text-red-400 text-xs italic">Belum Set</span>}
                                      </div>
                                    </div>
                                    <button 
                                      onClick={() => { setEditingPusatId(editKey); setPusatHppValue(ch.hppPusat !== null ? String(ch.hppPusat) : ''); }} 
                                      className="opacity-0 group-hover/cell:opacity-100 p-0.5 text-gray-400 hover:text-suka-primary transition-opacity rounded hover:bg-gray-100"
                                      title={`Edit HPP Pusat (${ch.label})`}
                                    >
                                      <Edit2 className="w-3 h-3" />
                                    </button>
                                  </div>
                                )}
                              </div>
                            )
                          })}
                        </div>
                      </td>

                      {/* HPP Mitra Column */}
                      <td className="py-4 text-right align-middle">
                        <div className="flex flex-col">
                          {channelRows.map((ch, cIdx) => {
                            const mitraHpp = ch.hppPusat !== null ? Math.round(ch.hppPusat * 1.1) : null;
                            return (
                              <div key={`hpp-mtr-${cIdx}`} className={`${rowClasses} justify-end px-5`}>
                                <span className="font-bold text-blue-600">
                                  {mitraHpp !== null ? rupiah(mitraHpp) : <span className="text-gray-400 text-xs italic">Belum Set</span>}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </td>

                      {/* Profit Pusat Column */}
                      <td className="py-4 text-right">
                        <div className="flex flex-col">
                          {channelRows.map((ch, cIdx) => {
                            const pft = ch.hppPusat !== null ? ch.price - ch.hppPusat : null;
                            return (
                              <div key={`pft-pst-${cIdx}`} className={`${rowClasses} justify-end gap-2 px-5`}>
                                {pft !== null ? (
                                  <>
                                    <span className="font-bold text-gray-900 text-sm text-right w-[70px]">{rupiah(pft)}</span>
                                    <div className="w-12 text-right">{renderMarginTextOnly(ch.hppPusat, ch.price)}</div>
                                  </>
                                ) : (
                                  <span className="text-gray-400 text-sm w-[90px] text-right">—</span>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </td>

                      {/* Profit Mitra Column */}
                      <td className="py-4 text-right">
                        <div className="flex flex-col">
                          {channelRows.map((ch, cIdx) => {
                            const mitraHpp = ch.hppPusat !== null ? Math.round(ch.hppPusat * 1.1) : null;
                            const profitMitra = mitraHpp !== null ? ch.price - mitraHpp : null;
                            return (
                              <div key={`pft-mtr-${cIdx}`} className={`${rowClasses} justify-end gap-2 px-5`}>
                                {profitMitra !== null ? (
                                  <>
                                    <span className="font-bold text-blue-700 text-sm text-right w-[70px]">{rupiah(profitMitra)}</span>
                                    <div className="w-12 text-right">{renderMarginTextOnly(mitraHpp, ch.price)}</div>
                                  </>
                                ) : (
                                  <span className="text-gray-400 text-sm w-[90px] text-right">—</span>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </td>

                      {/* Terakhir Diubah Column */}
                      <td className="px-5 py-4 whitespace-nowrap">
                        {row.updatedBy || row.updatedAt ? (
                          <div className="flex flex-col">
                            <span className="text-xs font-bold text-gray-900 flex items-center gap-1.5">
                              <span className="w-1.5 h-1.5 rounded-full bg-suka-orange inline-block" />
                              {row.updatedBy || 'Admin'}
                            </span>
                            <span className="text-[10px] text-gray-400 font-semibold">
                              {row.updatedAt ? new Date(row.updatedAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jakarta' }) : '—'}
                            </span>
                          </div>
                        ) : (
                          <span className="text-xs text-gray-400">—</span>
                        )}
                      </td>

                      <td className="px-5 py-4 text-right">
                        <button
                          onClick={() => handleOpenDrawer(row.id)}
                          className="inline-flex items-center gap-1.5 px-4 py-2 bg-suka-primary/10 text-suka-primary hover:bg-suka-primary/20 rounded-xl text-xs font-bold transition-colors"
                        >
                          <PanelRightClose className="w-4 h-4" /> Kelola Distribusi
                        </button>
                      </td>
                    </tr>
                  </React.Fragment>
                )
              })}
              {filteredItems.length === 0 && (
                <tr>
                  <td colSpan={9} className="px-6 py-12 text-center text-gray-500">
                    <p className="font-semibold text-base">Tidak ada menu ditemukan</p>
                    <p className="text-xs text-gray-400 mt-1">Coba ganti filter kategori atau kata kunci pencarian.</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Slide-over Drawer */}
      <div className={`fixed inset-0 z-[100] transition-all duration-500 ${isDrawerOpen ? 'visible' : 'invisible'}`}>
        {/* Backdrop */}
        <div 
          className={`absolute inset-0 bg-gray-900/40 backdrop-blur-sm transition-opacity duration-500 ${isDrawerOpen ? 'opacity-100' : 'opacity-0'}`} 
          onClick={handleCloseDrawer} 
        />
        
        {/* Drawer Panel */}
        <div className={`absolute top-0 right-0 h-full w-full max-w-xl bg-white shadow-2xl transition-transform duration-500 ease-in-out transform ${isDrawerOpen ? 'translate-x-0' : 'translate-x-full'} flex flex-col`}>
          
          {selectedMenu && (
            <>
              {/* Drawer Header */}
              <div className="p-6 bg-gray-50/80 border-b flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-[10px] uppercase tracking-wider font-bold text-gray-500 bg-white px-2 py-0.5 rounded border shadow-sm">{selectedMenu.category}</span>
                    {selectedMenu.isPackage && <span className="text-[10px] uppercase tracking-wider font-bold text-purple-600 bg-purple-100 px-2 py-0.5 rounded border shadow-sm border-purple-200">Paket</span>}
                  </div>
                  <h2 className="text-2xl font-black text-gray-900 leading-tight">{selectedMenu.name}</h2>
                  <div className="flex items-center gap-4 mt-3">
                    <div>
                      <div className="text-[10px] text-gray-500 uppercase font-bold">Harga Pusat</div>
                      <div className="font-extrabold text-gray-900">{rupiah(selectedMenu.price)}</div>
                    </div>
                    <div className="w-px h-8 bg-gray-200"></div>
                    <div>
                      <div className="text-[10px] text-gray-500 uppercase font-bold">HPP Aktif Pusat</div>
                      <div className="font-extrabold text-amber-600">{activeBOM !== null ? rupiah(activeBOM) : '-'}</div>
                    </div>
                    <div className="w-px h-8 bg-gray-200"></div>
                    <div>
                      <div className="text-[10px] text-blue-500 uppercase font-bold">HPP Rekomendasi Mitra</div>
                      <div className="font-extrabold text-blue-600">{activeBOM !== null ? rupiah(Math.round(activeBOM * 1.10)) : '-'}</div>
                    </div>
                  </div>
                </div>
                <button onClick={handleCloseDrawer} className="p-2 bg-white hover:bg-gray-100 rounded-full text-gray-400 hover:text-gray-600 shadow-sm transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Drawer Content */}
              <div className="flex-1 overflow-y-auto p-6 space-y-8">
                
                {/* Bagian A: Channel Harga Online */}
                <section>
                  <h3 className="text-sm font-extrabold text-gray-900 flex items-center gap-2 mb-4">
                    <Globe className="w-4 h-4 text-orange-500" /> Analisis Harga Channel
                  </h3>
                  <div className="bg-white border rounded-2xl overflow-hidden shadow-sm">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50 text-gray-500 text-[11px] uppercase font-bold">
                        <tr>
                          <th className="px-4 py-3 text-left">Channel</th>
                          <th className="px-4 py-3 text-right">Harga Jual</th>
                          <th className="px-4 py-3 text-right">Profit</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {(() => {
                          const isOfflineDrawerAvailable = selectedMenu.isAvailable !== false && (
                            selectedMenu.isAvailableOnline === false ||
                            selectedMenu.availableOnlineChannels === null ||
                            selectedMenu.availableOnlineChannels === undefined ||
                            !Array.isArray(selectedMenu.availableOnlineChannels) ||
                            selectedMenu.availableOnlineChannels.includes('pos_kasir')
                          );
                          if (!isOfflineDrawerAvailable) return null;
                          return (
                            <tr>
                              <td className="px-4 py-3 font-bold text-gray-900 flex items-center gap-2"><Store className="w-4 h-4 text-gray-400"/> Offline (Kasir)</td>
                              <td className="px-4 py-3 text-right font-medium">{rupiah(selectedMenu.price)}</td>
                              <td className="px-4 py-3 text-right">
                                {activeBOM ? <div className="font-bold text-green-600">{rupiah(selectedMenu.price - activeBOM)}</div> : '-'}
                              </td>
                            </tr>
                          );
                        })()}
                        {(() => {
                          if (selectedMenu.isAvailableOnline === false) return null;
                          
                          const activeDrawerChannels = (channels || []).filter(ch => {
                            const slug = ch.name.toLowerCase().replace(/\s+/g, '');
                            if (selectedMenu.availableOnlineChannels === null || selectedMenu.availableOnlineChannels === undefined) return true;
                            return selectedMenu.availableOnlineChannels.some(
                              c => {
                                const cleanC = c.toLowerCase().replace(/\s+/g, '');
                                return cleanC === slug || (slug === 'tiktokgo' && (cleanC === 'tiktokgo' || cleanC === 'tiktok_go' || cleanC === 'tiktok'));
                              }
                            );
                          });

                          const foodAppSlugs = ['gofood', 'grabfood', 'shopeefood'];
                          const activeFoodApps = activeDrawerChannels.filter(ch => foodAppSlugs.includes(ch.name.toLowerCase().replace(/\s+/g, '')));
                          const otherChannels = activeDrawerChannels.filter(ch => !foodAppSlugs.includes(ch.name.toLowerCase().replace(/\s+/g, '')));

                          return (
                            <>
                              {activeFoodApps.length > 0 && (() => {
                                let explicitPrice: number | undefined = undefined;
                                for (const app of activeFoodApps) {
                                  const s = app.name.toLowerCase().replace(/\s+/g, '');
                                  if (selectedMenu.channelPrices[s] && Number(selectedMenu.channelPrices[s]) > 0) {
                                    explicitPrice = Number(selectedMenu.channelPrices[s]);
                                    break;
                                  }
                                }
                                const displayPrice = explicitPrice ?? selectedMenu.price;
                                return (
                                  <tr>
                                    <td className="px-4 py-3 font-bold text-gray-700 flex items-center gap-2">
                                      <Globe className="w-4 h-4 text-gray-300"/> FOODAPPS
                                    </td>
                                    <td className="px-4 py-3 text-right font-medium">{rupiah(displayPrice)}</td>
                                    <td className="px-4 py-3 text-right">
                                      {activeBOM ? <div className="font-bold text-green-600">{rupiah(displayPrice - activeBOM)}</div> : '-'}
                                    </td>
                                  </tr>
                                );
                              })()}

                              {otherChannels.map(ch => {
                                const slug = ch.name.toLowerCase().replace(/\s+/g, '');
                                const explicitPrice = selectedMenu.channelPrices[slug] || (slug === 'tiktokgo' ? selectedMenu.channelPrices['tiktok_go'] : undefined);
                                const displayPrice = (explicitPrice !== undefined && explicitPrice !== null && Number(explicitPrice) > 0) ? explicitPrice : selectedMenu.price;
                                
                                return (
                                  <tr key={ch.id}>
                                    <td className="px-4 py-3 font-bold text-gray-700 flex items-center gap-2">
                                      <Globe className="w-4 h-4 text-gray-300"/> {ch.name === 'TikTok Go' ? 'TIKTOK GO' : ch.name.toUpperCase()}
                                    </td>
                                    <td className="px-4 py-3 text-right font-medium">{rupiah(displayPrice)}</td>
                                    <td className="px-4 py-3 text-right">
                                      {activeBOM ? <div className="font-bold text-green-600">{rupiah(displayPrice - activeBOM)}</div> : '-'}
                                    </td>
                                  </tr>
                                );
                              })}
                            </>
                          );
                        })()}
                      </tbody>
                    </table>
                  </div>
                </section>

                {/* Bagian B: Distribusi & HPP Mitra */}
                <section>
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-sm font-extrabold text-gray-900 flex items-center gap-2">
                      <Store className="w-4 h-4 text-suka-primary" /> Distribusi & HPP Mitra
                    </h3>
                    <button
                      onClick={() => handleAutoCalculateDrawer(activeBOM)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 text-amber-700 hover:bg-amber-100 rounded-lg text-[11px] font-bold border border-amber-200 transition-colors"
                    >
                      <Calculator className="w-3.5 h-3.5" /> Auto (+10% BOM)
                    </button>
                  </div>
                  
                  <div className="bg-white border rounded-2xl overflow-hidden shadow-sm">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50 text-gray-500 text-[11px] uppercase font-bold">
                        <tr>
                          <th className="px-4 py-3 w-10 text-center">Aktif</th>
                          <th className="px-4 py-3 text-left">Mitra</th>
                          <th className="px-4 py-3 text-right">HPP Override</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {outlets.map(o => {
                          const conf = localOutletPrices[o.id]
                          if (!conf) return null
                          
                          return (
                            <tr key={o.id} className={conf.is_available ? 'bg-white' : 'bg-gray-50/50'}>
                              <td className="px-4 py-3 text-center align-middle">
                                <label className="relative inline-flex items-center cursor-pointer">
                                  <input 
                                    type="checkbox" 
                                    className="sr-only peer" 
                                    checked={conf.is_available}
                                    onChange={(e) => setLocalOutletPrices(prev => ({ ...prev, [o.id]: { ...conf, is_available: e.target.checked } }))}
                                  />
                                  <div className="w-8 h-4 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-green-500"></div>
                                </label>
                              </td>
                              <td className="px-4 py-3 font-bold text-gray-900">{o.name.replace('MITRA ', '')}</td>
                              <td className="px-4 py-3 text-right">
                                <div className="relative w-32 ml-auto">
                                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-gray-400 font-medium">Rp</span>
                                  <input
                                    type="number"
                                    value={conf.hpp_override !== null ? conf.hpp_override : ''}
                                    onChange={(e) => setLocalOutletPrices(prev => ({ ...prev, [o.id]: { ...conf, hpp_override: e.target.value === '' ? null : Number(e.target.value) } }))}
                                    placeholder="Ikut Pusat"
                                    disabled={!conf.is_available}
                                    className="w-full text-xs rounded-lg border-gray-200 shadow-inner focus:border-suka-primary focus:ring-suka-primary pl-8 pr-2 py-1.5 disabled:bg-gray-100 disabled:cursor-not-allowed"
                                  />
                                </div>
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                </section>
                
              </div>

              {/* Drawer Footer */}
              <div className="p-5 bg-white border-t flex justify-end gap-3 shadow-[0_-10px_20px_rgba(0,0,0,0.03)] z-10 relative">
                <button
                  onClick={handleCloseDrawer}
                  disabled={isSaving}
                  className="px-5 py-2.5 rounded-xl text-sm font-bold text-gray-500 hover:bg-gray-100 transition-colors"
                >
                  Batal
                </button>
                <button
                  onClick={handleSaveDrawer}
                  disabled={isSaving}
                  className="flex items-center gap-2 px-6 py-2.5 bg-suka-primary hover:bg-suka-primary/90 text-white rounded-xl text-sm font-bold shadow-lg shadow-suka-primary/30 transition-all active:scale-95 disabled:opacity-50"
                >
                  {isSaving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  Simpan Perubahan
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

