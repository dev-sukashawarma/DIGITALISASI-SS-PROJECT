// @ts-nocheck
'use client'

import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase'
import { Store, Globe, Search, X, Check, Package, Sandwich, Edit2, Calculator, PanelRightClose, RefreshCw, Save, ArrowUpDown, ChevronUp, ChevronDown } from 'lucide-react'
import type { Outlet, MenuOutletPrice } from '@/pos-types'

interface HppMenuItem {
  id: string
  name: string
  category: string
  categoryOrder: number
  sortOrder: number
  price: number
  channelPrices: Record<string, number>
  availableOnlineChannels: string[] | null
  isAvailableOnline: boolean
  isPackage: boolean
  hpp: number | null
  hppOverride: number | null
  isPartial: boolean
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

export default function HppDashboardView({ items }: HppDashboardViewProps) {
  const router = useRouter()
  const supabase = createClient()

  const [searchQuery, setSearchQuery] = useState('')
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
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim()
      res = res.filter(r => r.name.toLowerCase().includes(q))
    }

    // Custom Category Sort Order
    const categoryOrder = [
      'original ayam',
      'original sapi',
      'mix',
      'suka suka',
      'suka drink',
      'topping',
      'paket combo'
    ]

    const getCategoryRank = (categoryName: string) => {
      const lower = (categoryName || '').toLowerCase().trim()
      const index = categoryOrder.indexOf(lower)
      return index !== -1 ? index : categoryOrder.length // If not found, put it at the end
    }

    // Sort by Category Rank, then by name
    const sortedByCategory = [...res].sort((a, b) => {
      const rankA = getCategoryRank(a.category)
      const rankB = getCategoryRank(b.category)
      
      if (rankA !== rankB) {
        return rankA - rankB
      }
      
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
  }, [items, searchQuery, sortField, sortDir])

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

  // Save Pusat Override
  const handleSavePusatHpp = async (itemId: string, name: string) => {
    try {
      setIsSaving(true)
      const val = pusatHppValue.trim() === '' ? null : Math.round(Number(pusatHppValue))
      const { error } = await supabase.from('menu_items').update({ hpp_override: val }).eq('id', itemId)
      if (error) throw error
      toast.success(val === null ? `HPP Pusat untuk "${name}" direset ke BOM` : `HPP Pusat "${name}" diset ke ${rupiah(val)}`)
      setEditingPusatId(null)
      router.refresh()
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
      const payload = Object.values(localOutletPrices).map(p => ({
        menu_item_id: p.menu_item_id,
        outlet_id: p.outlet_id,
        price: p.price === null || p.price === '' as any ? null : Number(p.price),
        hpp_override: p.hpp_override === null || p.hpp_override === '' as any ? null : Number(p.hpp_override),
        is_available: p.is_available
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
      const payload: MenuOutletPrice[] = []
      
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
              is_available: existing ? existing.is_available : true
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
                <th 
                  onClick={() => handleSort('name')}
                  className="px-5 py-4 cursor-pointer select-none group hover:bg-gray-100/50 transition-colors"
                >
                  <div className="flex items-center">
                    Menu
                    <SortIndicator field="name" />
                  </div>
                </th>
                <th 
                  onClick={() => handleSort('price')}
                  className="px-5 py-4 cursor-pointer select-none group hover:bg-gray-100/50 transition-colors text-right"
                >
                  <div className="flex items-center justify-end">
                    Harga Jual (Pusat)
                    <SortIndicator field="price" />
                  </div>
                </th>
                <th 
                  onClick={() => handleSort('hpp')}
                  className="px-5 py-4 cursor-pointer select-none group hover:bg-gray-100/50 transition-colors text-right"
                >
                  <div className="flex items-center justify-end">
                    HPP Aktif Pusat
                    <SortIndicator field="hpp" />
                  </div>
                </th>
                <th 
                  onClick={() => handleSort('margin')}
                  className="px-5 py-4 cursor-pointer select-none group hover:bg-gray-100/50 transition-colors text-center"
                >
                  <div className="flex items-center justify-center">
                    Profit / Margin
                    <SortIndicator field="margin" />
                  </div>
                </th>
                <th className="px-5 py-4 text-center">Distribusi Mitra</th>
                <th className="px-5 py-4 text-right">
                  {sortField !== 'default' ? (
                    <button 
                      onClick={() => handleSort('default')}
                      className="text-[10px] font-bold text-suka-primary bg-suka-primary/10 px-2 py-1 rounded hover:bg-suka-primary/20"
                    >
                      Kembali ke Kategori
                    </button>
                  ) : (
                    'Aksi'
                  )}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredItems.map(row => {
                const effHpp = row.hppOverride !== null ? row.hppOverride : row.hpp
                const profit = effHpp !== null ? row.price - effHpp : null
                
                // Distribusi Stats
                const activeMitras = allOutletPrices.filter(p => p.menu_item_id === row.id && p.is_available).length
                const totalMitras = outlets.length

                return (
                  <tr key={row.id} className="hover:bg-gray-50/60 transition-colors group">
                    <td className="px-5 py-4 text-center">
                      {row.isPackage ? <Package className="w-4 h-4 text-purple-400 inline-block" /> : <Sandwich className="w-4 h-4 text-blue-400 inline-block" />}
                    </td>
                    <td className="px-5 py-4 font-bold text-gray-900">
                      {row.name}
                      <div className="text-[10px] text-gray-400 uppercase tracking-wider mt-0.5">{row.category}</div>
                    </td>
                    <td className="px-5 py-4 text-right font-bold text-gray-900">
                      {rupiah(row.price)}
                    </td>
                    <td className="px-5 py-4 text-right whitespace-nowrap">
                      {editingPusatId === row.id ? (
                        <div className="flex items-center justify-end gap-1.5">
                          <input
                            type="number"
                            placeholder={row.hpp ? String(row.hpp) : 'HPP BOM...'}
                            value={pusatHppValue}
                            onChange={(e) => setPusatHppValue(e.target.value)}
                            className="w-24 px-2 py-1 text-xs text-right border rounded focus:ring-1 focus:ring-suka-primary"
                          />
                          <button onClick={() => handleSavePusatHpp(row.id, row.name)} disabled={isSaving} className="p-1.5 text-white bg-green-500 hover:bg-green-600 rounded">
                            <Check className="w-3.5 h-3.5" />
                          </button>
                          <button onClick={() => setEditingPusatId(null)} disabled={isSaving} className="p-1.5 text-gray-500 bg-gray-100 hover:bg-gray-200 rounded">
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ) : (
                        <div className="group/edit flex items-center justify-end gap-2">
                          <div className="text-right">
                            <div className={`font-bold ${row.hppOverride !== null ? 'text-amber-600' : 'text-gray-600'}`}>
                              {effHpp !== null ? rupiah(effHpp) : <span className="text-red-400 text-xs italic">Belum Set</span>}
                            </div>
                            {row.hppOverride !== null && row.hpp !== null && (
                              <div className="text-[9px] text-gray-400 mt-0.5">BOM: {rupiah(row.hpp)}</div>
                            )}
                          </div>
                          <button onClick={() => { setEditingPusatId(row.id); setPusatHppValue(row.hppOverride !== null ? String(row.hppOverride) : ''); }} className="opacity-0 group-hover/edit:opacity-100 p-1 text-gray-400 hover:text-suka-primary transition-opacity">
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}
                    </td>
                    <td className="px-5 py-4 text-center">
                      {profit !== null ? (
                        <div className="flex flex-col items-center">
                          <span className="font-bold text-[13px] text-gray-900">{rupiah(profit)}</span>
                          <div className="mt-1">{renderMargin(effHpp, row.price)}</div>
                        </div>
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </td>
                    <td className="px-5 py-4 text-center">
                      {isLoadingOutlets ? (
                        <span className="animate-pulse bg-gray-200 h-5 w-16 rounded-full inline-block"></span>
                      ) : activeMitras > 0 ? (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-green-50 text-green-700 rounded-full text-xs font-bold border border-green-200">
                          <Store className="w-3 h-3" /> {activeMitras}/{totalMitras} Mitra
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-gray-50 text-gray-500 rounded-full text-xs font-bold border border-gray-200">
                          Tidak Aktif
                        </span>
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
                )
              })}
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
                        <tr>
                          <td className="px-4 py-3 font-bold text-gray-900 flex items-center gap-2"><Store className="w-4 h-4 text-gray-400"/> Offline (Kasir)</td>
                          <td className="px-4 py-3 text-right font-medium">{rupiah(selectedMenu.price)}</td>
                          <td className="px-4 py-3 text-right">
                            {activeBOM ? <div className="font-bold text-green-600">{rupiah(selectedMenu.price - activeBOM)}</div> : '-'}
                          </td>
                        </tr>
                        {Object.entries(selectedMenu.channelPrices || {}).map(([ch, price]) => (
                          <tr key={ch}>
                            <td className="px-4 py-3 font-bold text-gray-700 flex items-center gap-2">
                              <Globe className="w-4 h-4 text-gray-300"/> {ch.toUpperCase()}
                            </td>
                            <td className="px-4 py-3 text-right font-medium">{rupiah(price)}</td>
                            <td className="px-4 py-3 text-right">
                              {activeBOM ? <div className="font-bold text-green-600">{rupiah(price - activeBOM)}</div> : '-'}
                            </td>
                          </tr>
                        ))}
                        {Object.keys(selectedMenu.channelPrices || {}).length === 0 && (
                          <tr><td colSpan={3} className="px-4 py-3 text-center text-xs text-gray-400">Belum ada harga online spesifik</td></tr>
                        )}
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

