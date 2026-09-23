'use client'

import React, { useState, useMemo, useEffect } from 'react'
import { Plus, Minus, Trash2, Search, Utensils, Check, ShoppingBag, RotateCw, Loader2 } from 'lucide-react'
import type { PosMenuItem } from '@/lib/supabase-pos'
import { getPosMenuItemsAction } from '@/app/actions/endorsements'

export interface SelectedMenuItem {
  menuItemId: string
  name: string
  quantity: number
  unitPrice: number
  hpp?: number
}

interface EndorsementMenuSelectorProps {
  posMenuItems: PosMenuItem[]
  selectedItems: SelectedMenuItem[]
  onChange: (items: SelectedMenuItem[]) => void
  onSummaryCalculated?: (menuGiven: string, calculatedHpp: number) => void
}

export default function EndorsementMenuSelector({
  posMenuItems = [],
  selectedItems,
  onChange,
  onSummaryCalculated,
}: EndorsementMenuSelectorProps) {
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<string>('all')
  const [menuList, setMenuList] = useState<PosMenuItem[]>(posMenuItems || [])
  const [isLoading, setIsLoading] = useState(false)

  // Keep synced with parent props if provided
  useEffect(() => {
    if (posMenuItems && posMenuItems.length > 0) {
      setMenuList(posMenuItems)
    }
  }, [posMenuItems])

  // Auto-fetch if initially empty
  useEffect(() => {
    if (!posMenuItems || posMenuItems.length === 0) {
      handleRefresh()
    }
  }, [])

  const handleRefresh = async () => {
    setIsLoading(true)
    try {
      const fresh = await getPosMenuItemsAction()
      if (fresh && fresh.length > 0) {
        setMenuList(fresh)
      }
    } catch (err) {
      console.error('Gagal memuat katalog menu POS:', err)
    } finally {
      setIsLoading(false)
    }
  }

  const categories = useMemo(() => {
    const set = new Set<string>()
    menuList.forEach((item) => {
      if (item.categoryName) set.add(item.categoryName)
    })
    return Array.from(set).sort()
  }, [menuList])

  const filteredMenuItems = useMemo(() => {
    return menuList.filter((item) => {
      const matchCat = selectedCategory === 'all' || item.categoryName === selectedCategory
      const matchSearch = item.name.toLowerCase().includes(searchTerm.toLowerCase())
      return matchCat && matchSearch
    })
  }, [menuList, selectedCategory, searchTerm])

  const handleAddItem = (menu: PosMenuItem) => {
    const existingIndex = selectedItems.findIndex((i) => i.menuItemId === menu.id)
    let updated: SelectedMenuItem[]

    if (existingIndex >= 0) {
      updated = selectedItems.map((item, idx) =>
        idx === existingIndex ? { ...item, quantity: item.quantity + 1 } : item
      )
    } else {
      updated = [
        ...selectedItems,
        {
          menuItemId: menu.id,
          name: menu.name,
          quantity: 1,
          unitPrice: menu.price,
          hpp: Math.round(menu.price * 0.45), // estimasi awal HPP ~45%
        },
      ]
    }

    onChange(updated)
    triggerSummary(updated)
  }

  const handleUpdateQty = (index: number, newQty: number) => {
    let updated: SelectedMenuItem[]
    if (newQty <= 0) {
      updated = selectedItems.filter((_, idx) => idx !== index)
    } else {
      updated = selectedItems.map((item, idx) =>
        idx === index ? { ...item, quantity: newQty } : item
      )
    }
    onChange(updated)
    triggerSummary(updated)
  }

  const handleRemoveItem = (index: number) => {
    const updated = selectedItems.filter((_, idx) => idx !== index)
    onChange(updated)
    triggerSummary(updated)
  }

  const triggerSummary = (items: SelectedMenuItem[]) => {
    if (!onSummaryCalculated) return
    const summaryText = items.map((i) => `${i.quantity}x ${i.name}`).join(', ')
    const totalEstimatedHpp = items.reduce((sum, i) => sum + (i.hpp || Math.round(i.unitPrice * 0.45)) * i.quantity, 0)
    onSummaryCalculated(summaryText, totalEstimatedHpp)
  }

  const totalRetail = selectedItems.reduce((sum, i) => sum + i.unitPrice * i.quantity, 0)
  const totalHpp = selectedItems.reduce((sum, i) => sum + (i.hpp || Math.round(i.unitPrice * 0.45)) * i.quantity, 0)

  return (
    <div className="space-y-3 bg-[#FAF8F5] p-3.5 rounded-2xl border border-[#EFE8DE]">
      <input type="hidden" name="menuItems" value={JSON.stringify(selectedItems)} />

      <div className="flex items-center justify-between">
        <label className="text-xs font-bold text-stone-800 uppercase tracking-wider flex items-center gap-1.5">
          <Utensils className="w-3.5 h-3.5 text-[#D9480F]" />
          <span>Menu Jatah KOL (Katalog POS)</span>
        </label>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={handleRefresh}
            disabled={isLoading}
            title="Muat ulang katalog menu POS"
            className="p-1 rounded-md text-stone-500 hover:text-[#D9480F] hover:bg-stone-200/60 transition-colors disabled:opacity-50"
          >
            <RotateCw className={`w-3 h-3 ${isLoading ? 'animate-spin text-[#D9480F]' : ''}`} />
          </button>
          <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
            Otomatis di Kasir POS
          </span>
        </div>
      </div>

      {/* Selected Items List */}
      {selectedItems.length === 0 ? (
        <div className="py-4 px-3 text-center bg-white rounded-xl border border-dashed border-[#EFE8DE] text-stone-400 text-xs">
          <ShoppingBag className="w-6 h-6 mx-auto mb-1 opacity-40 text-stone-400" />
          <span>Belum ada menu POS yang dipilih untuk KOL ini.</span>
          <p className="text-[11px] text-stone-500 mt-0.5">Pilih dari katalog menu di bawah ini.</p>
        </div>
      ) : (
        <div className="space-y-2 bg-white p-2.5 rounded-xl border border-[#EFE8DE] max-h-48 overflow-y-auto scrollbar-thin">
          {selectedItems.map((item, idx) => (
            <div
              key={item.menuItemId + idx}
              className="flex items-center justify-between gap-2 p-2 rounded-lg bg-[#FAF8F5] border border-[#EFE8DE] text-xs"
            >
              <div className="flex-1 min-w-0">
                <div className="font-bold text-stone-800 truncate">{item.name}</div>
                <div className="text-[11px] text-stone-500 font-mono">
                  Rp {item.unitPrice.toLocaleString('id-ID')}
                </div>
              </div>

              <div className="flex items-center gap-1.5 bg-white border border-[#EFE8DE] rounded-lg p-0.5">
                <button
                  type="button"
                  onClick={() => handleUpdateQty(idx, item.quantity - 1)}
                  className="w-6 h-6 rounded flex items-center justify-center text-stone-500 hover:bg-stone-100 active:scale-95 transition-all"
                >
                  <Minus className="w-3 h-3" />
                </button>
                <span className="w-5 text-center font-bold text-xs text-stone-800">
                  {item.quantity}
                </span>
                <button
                  type="button"
                  onClick={() => handleUpdateQty(idx, item.quantity + 1)}
                  className="w-6 h-6 rounded flex items-center justify-center bg-[#D9480F] text-white hover:bg-[#B83808] active:scale-95 transition-all"
                >
                  <Plus className="w-3 h-3" />
                </button>
              </div>

              <button
                type="button"
                onClick={() => handleRemoveItem(idx)}
                className="p-1 text-stone-400 hover:text-red-600 rounded transition-colors"
                title="Hapus menu ini"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}

          <div className="pt-2 border-t border-[#EFE8DE] flex items-center justify-between text-xs px-1">
            <span className="text-stone-500 font-medium">Total Harga Jual (Rp 0 di POS):</span>
            <span className="font-bold font-mono text-stone-800">
              Rp {totalRetail.toLocaleString('id-ID')}
            </span>
          </div>
        </div>
      )}

      {/* Catalog Search and Add */}
      <div className="space-y-2 pt-1">
        <div className="flex items-center justify-between px-0.5">
          <span className="text-[11px] font-semibold text-stone-600">
            Katalog Menu POS {menuList.length > 0 && `(${filteredMenuItems.length} pilihan)`}
          </span>
          {isLoading && (
            <span className="text-[10px] text-[#D9480F] flex items-center gap-1">
              <Loader2 className="w-3 h-3 animate-spin" /> Memuat menu...
            </span>
          )}
        </div>

        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="w-3.5 h-3.5 text-stone-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Cari menu POS..."
              className="w-full pl-8 pr-3 py-1.5 text-xs border border-[#EFE8DE] rounded-xl bg-white focus:outline-none focus:border-[#D9480F]"
            />
          </div>

          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="px-2 py-1.5 text-xs border border-[#EFE8DE] rounded-xl bg-white focus:outline-none max-w-[130px]"
          >
            <option value="all">Semua Kategori</option>
            {categories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>

        {/* Menu Items Quick Pick List */}
        <div className="max-h-44 sm:max-h-52 overflow-y-auto space-y-1 pr-1 scrollbar-thin">
          {filteredMenuItems.map((menu) => {
            const isSelected = selectedItems.some((i) => i.menuItemId === menu.id)
            return (
              <div
                key={menu.id}
                className="flex items-center justify-between p-1.5 bg-white rounded-lg border border-[#EFE8DE] hover:border-[#D9480F]/40 transition-colors text-xs"
              >
                <div className="min-w-0 flex-1 pr-2">
                  <span className="font-semibold text-stone-700 truncate block">
                    {menu.name}
                  </span>
                  <span className="text-[10px] text-stone-400">
                    {menu.categoryName} • Rp {menu.price.toLocaleString('id-ID')}
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() => handleAddItem(menu)}
                  className={`px-2 py-1 rounded-md text-[11px] font-bold flex items-center gap-1 transition-all active:scale-95 ${
                    isSelected
                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                      : 'bg-[#FFF4ED] text-[#D9480F] hover:bg-[#D9480F] hover:text-white'
                  }`}
                >
                  <Plus className="w-3 h-3" />
                  <span>Tambah</span>
                </button>
              </div>
            )
          })}

          {isLoading && menuList.length === 0 && (
            <div className="text-center py-4 text-stone-500 text-xs flex items-center justify-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin text-[#D9480F]" />
              <span>Memuat katalog menu POS...</span>
            </div>
          )}

          {!isLoading && menuList.length === 0 && (
            <div className="text-center py-4 text-stone-500 text-xs space-y-2">
              <p>Katalog menu POS belum termuat.</p>
              <button
                type="button"
                onClick={handleRefresh}
                className="inline-flex items-center gap-1.5 px-3 py-1 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-lg text-xs font-medium transition-colors"
              >
                <RotateCw className="w-3 h-3" />
                <span>Muat Ulang Katalog</span>
              </button>
            </div>
          )}

          {!isLoading && menuList.length > 0 && filteredMenuItems.length === 0 && (
            <div className="text-center py-3 text-stone-400 text-xs">
              Menu tidak ditemukan untuk filter ini
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

