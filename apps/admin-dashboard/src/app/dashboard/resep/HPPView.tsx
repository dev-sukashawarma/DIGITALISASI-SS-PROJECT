// @ts-nocheck
'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase'
import { TrendingUp, TrendingDown, Minus, Filter, Package, Sandwich, Store, Globe, ShoppingBag, ArrowUpDown, ChevronUp, ChevronDown, Pencil, Trash2, Loader2, Search, X, Check } from 'lucide-react'
import { CHANNELS } from '@/lib/channels'

interface HppMenuItem {
  id: string
  name: string
  category: string
  categoryOrder: number
  sortOrder: number
  price: number
  channelPrices: Record<string, number>
  channelHpp?: Record<string, number>
  availableOnlineChannels: string[] | null // null = semua channel
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

interface HPPViewProps {
  items: HppMenuItem[]
  channels: Channel[]
}

interface HppRow {
  key: string
  itemId: string
  name: string
  isPackage: boolean
  hpp: number | null
  hppOverride: number | null
  isPartial: boolean
  categoryKey: 'offline' | 'online_web' | 'food_apps' | 'tiktok_go' | 'ss_online'
  categoryLabel: string
  price: number
  logos: React.ReactNode
  sortOrder: number
  categoryOrder: number
  updateKey: 'base' | string | string[]
  currentChannelPrices: Record<string, number>
  currentChannelHpp: Record<string, number>
}

type SortField = 'category' | 'name' | 'type' | 'hpp' | 'price' | 'profit' | 'margin' | 'order'
type SortDir = 'asc' | 'desc'

function rupiah(n: number) {
  return 'Rp ' + Math.round(n).toLocaleString('id-ID')
}

/** Logo SVG kecil untuk channel online (GoFood, Shopee, dll) */
function ChannelLogo({ channelId, size = 20 }: { channelId: string; size?: number }) {
  const cfg = CHANNELS.find((c) => c.id === channelId.toLowerCase())
  if (!cfg) return null
  return (
    <span
      title={cfg.label}
      className="inline-flex items-center justify-center rounded-full flex-shrink-0 ring-2 ring-white"
      style={{ width: size, height: size, background: cfg.bg }}
    >
      {cfg.logoPath ? (
        <svg viewBox="0 0 24 24" width={size * 0.58} height={size * 0.58} fill={cfg.fg}>
          <path d={cfg.logoPath} />
        </svg>
      ) : (
        <span style={{ color: cfg.fg, fontSize: size * 0.45, fontWeight: 700, lineHeight: 1 }}>
          {cfg.mark}
        </span>
      )}
    </span>
  )
}

function MarginBadge({ hpp, price }: { hpp: number | null; price: number }) {
  if (hpp === null) {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-gray-100 text-gray-500 uppercase tracking-wider">
        —
      </span>
    )
  }
  const margin = price > 0 ? ((price - hpp) / price) * 100 : null
  if (margin === null) return <span className="text-gray-400">—</span>

  if (margin >= 35) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-green-100 text-green-700 uppercase tracking-wider">
        <TrendingUp className="w-3 h-3" /> {margin.toFixed(1)}%
      </span>
    )
  }
  if (margin >= 20) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-700 uppercase tracking-wider">
        <Minus className="w-3 h-3" /> {margin.toFixed(1)}%
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-100 text-red-700 uppercase tracking-wider">
      <TrendingDown className="w-3 h-3" /> {margin.toFixed(1)}%
    </span>
  )
}

export default function HPPView({ items, channels }: HPPViewProps) {
  const router = useRouter()
  const supabase = createClient()

  const [selectedFilter, setSelectedFilter] = useState<'all' | 'offline' | 'online_web' | 'food_apps' | 'tiktok_go' | 'ss_online'>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [sortField, setSortField] = useState<SortField>('order')
  const [sortDir, setSortDir] = useState<SortDir>('asc')
  const [deletingId, setDeletingId] = useState<string | null>(null)

  // Inline edit state for HPP Override
  const [editingOverrideId, setEditingOverrideId] = useState<string | null>(null) // row.key
  const [overrideValue, setOverrideValue] = useState<string>('')
  const [isSavingOverride, setIsSavingOverride] = useState(false)

  // Inline edit state for Harga Jual
  const [editingPriceId, setEditingPriceId] = useState<string | null>(null) // row.key
  const [priceValue, setPriceValue] = useState<string>('')
  const [isSavingPrice, setIsSavingPrice] = useState(false)

  // Generate HPP rows dynamically per active channel category for each menu item
  const allRows = useMemo(() => {
    const rows: HppRow[] = []

    for (const item of items) {
      // 1. Offline (POS Kasir / default)
      rows.push({
        key: `${item.id}-offline`,
        itemId: item.id,
        name: item.name,
        isPackage: item.isPackage,
        hpp: item.hpp,
        hppOverride: item.hppOverride,
        isPartial: item.isPartial,
        categoryKey: 'offline',
        categoryLabel: 'Offline',
        price: item.price,
        logos: (
          <span
            title="Kasir"
            className="inline-flex items-center justify-center rounded-full bg-gray-800"
            style={{ width: 20, height: 20 }}
          >
            <Store className="w-2.5 h-2.5 text-white" />
          </span>
        ),
        sortOrder: item.sortOrder,
        categoryOrder: item.categoryOrder,
        updateKey: 'base',
        currentChannelPrices: item.channelPrices,
        currentChannelHpp: item.channelHpp || {},
      })

      // Helper to check if a specific online channel key is active for the menu item
      const isChannelActive = (chId: string) => {
        if (!item.isAvailableOnline) return false
        if (!item.availableOnlineChannels) return true // null means all online channels are active
        return item.availableOnlineChannels.some(
          (c) => c.toLowerCase().replace(/\s+/g, '') === chId.toLowerCase().replace(/\s+/g, '')
        )
      }

      // 2. Online dari Web
      const isWebActive =
        isChannelActive('online') ||
        isChannelActive('web') ||
        (item.isAvailableOnline &&
          (item.channelPrices?.online !== undefined || item.channelPrices?.web !== undefined))

      if (isWebActive) {
        const webPrice = item.channelPrices?.online ?? item.channelPrices?.web ?? item.price
        rows.push({
          key: `${item.id}-online_web`,
          itemId: item.id,
          name: item.name,
          isPackage: item.isPackage,
          hpp: item.hpp,
          hppOverride: item.hppOverride,
          isPartial: item.isPartial,
          categoryKey: 'online_web',
          categoryLabel: 'Online dari Web',
          price: webPrice,
          logos: (
            <span
              title="Website Online"
              className="inline-flex items-center justify-center rounded-full bg-orange-500"
              style={{ width: 20, height: 20 }}
            >
              <Globe className="w-2.5 h-2.5 text-white" />
            </span>
          ),
          sortOrder: item.sortOrder,
          categoryOrder: item.categoryOrder,
          updateKey: 'online',
          currentChannelPrices: item.channelPrices,
          currentChannelHpp: item.channelHpp || {},
        })
      }

      // 3. Food Apps (GoFood, GrabFood, ShopeeFood)
      const foodApps = [
        { id: 'gofood', label: 'GoFood' },
        { id: 'grabfood', label: 'GrabFood' },
        { id: 'shopeefood', label: 'ShopeeFood' },
      ]
      const activeFoodApps = foodApps.filter((app) => isChannelActive(app.id))
      if (activeFoodApps.length > 0) {
        // Group them by price to merge identical price items
        const priceGroups: Record<number, typeof activeFoodApps> = {}
        for (const app of activeFoodApps) {
          const appPrice = item.channelPrices?.[app.id] ?? item.price
          if (!priceGroups[appPrice]) {
            priceGroups[appPrice] = []
          }
          priceGroups[appPrice].push(app)
        }

        Object.entries(priceGroups).forEach(([priceStr, apps]) => {
          const priceVal = Number(priceStr)
          const appKeys = apps.map((a) => a.id).join('-')
          rows.push({
            key: `${item.id}-food_apps-${appKeys}`,
            itemId: item.id,
            name: item.name,
            isPackage: item.isPackage,
            hpp: item.hpp,
            hppOverride: item.hppOverride,
            isPartial: item.isPartial,
            categoryKey: 'food_apps',
            categoryLabel: 'Food Apps',
            price: priceVal,
            logos: (
              <div className="flex items-center gap-1">
                {apps.map((app) => (
                  <ChannelLogo key={app.id} channelId={app.id} size={20} />
                ))}
              </div>
            ),
            sortOrder: item.sortOrder,
            categoryOrder: item.categoryOrder,
            updateKey: apps.map((a) => a.id),
            currentChannelPrices: item.channelPrices,
            currentChannelHpp: item.channelHpp || {},
          })
        })
      }

      // 4. TikTok Go
      const isTikTokActive =
        isChannelActive('tiktokgo') ||
        isChannelActive('tiktok_go') ||
        isChannelActive('tiktok')

      if (isTikTokActive) {
        const ttPrice =
          item.channelPrices?.tiktokgo ??
          item.channelPrices?.tiktok_go ??
          item.channelPrices?.tiktok ??
          item.price
        rows.push({
          key: `${item.id}-tiktok_go`,
          itemId: item.id,
          name: item.name,
          isPackage: item.isPackage,
          hpp: item.hpp,
          hppOverride: item.hppOverride,
          isPartial: item.isPartial,
          categoryKey: 'tiktok_go',
          categoryLabel: 'TikTok Go',
          price: ttPrice,
          logos: <ChannelLogo channelId="tiktokgo" size={20} />,
          sortOrder: item.sortOrder,
          categoryOrder: item.categoryOrder,
          updateKey: 'tiktokgo',
          currentChannelPrices: item.channelPrices,
          currentChannelHpp: item.channelHpp || {},
        })
      }

      // 5. SS Online (TikTok Shop & Shopee)
      const hasSsOnlineHpp = item.channelHpp?.ss_online !== undefined || item.channelHpp?.tiktok_shop !== undefined
      const isSsOnlineActive =
        isChannelActive('ss_online') ||
        isChannelActive('tiktok_shop') ||
        isChannelActive('shopee_shop') ||
        hasSsOnlineHpp

      if (isSsOnlineActive) {
        const ssHpp = item.channelHpp?.ss_online ?? item.channelHpp?.tiktok_shop ?? null
        const ssPrice = item.channelPrices?.ss_online ?? item.channelPrices?.tiktok_shop ?? item.price
        rows.push({
          key: `${item.id}-ss_online`,
          itemId: item.id,
          name: item.name,
          isPackage: item.isPackage,
          hpp: item.hpp,
          hppOverride: ssHpp !== null ? Number(ssHpp) : null,
          isPartial: item.isPartial,
          categoryKey: 'ss_online',
          categoryLabel: 'SS Online',
          price: ssPrice,
          logos: (
            <span
              title="SS Online (TikTok Shop & Shopee)"
              className="inline-flex items-center justify-center rounded-full bg-rose-600"
              style={{ width: 20, height: 20 }}
            >
              <ShoppingBag className="w-2.5 h-2.5 text-white" />
            </span>
          ),
          sortOrder: item.sortOrder,
          categoryOrder: item.categoryOrder,
          updateKey: 'ss_online',
          currentChannelPrices: item.channelPrices,
          currentChannelHpp: item.channelHpp || {},
        })
      }
    }

    return rows
  }, [items])

  // Sort logic helper
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortDir('asc')
    }
  }

  // Delete recipe logic
  const handleDeleteRecipe = async (itemId: string, name: string) => {
    if (!confirm(`Apakah Anda yakin ingin menghapus resep BOM untuk menu "${name}"? Ini akan menghapus bahan baku terdaftar dan mengosongkan HPP.`)) {
      return
    }

    try {
      setDeletingId(itemId)
      
      const { data: recipe } = await supabase
        .from('resep')
        .select('id')
        .eq('menu_item_ref', itemId)
        .maybeSingle()

      if (recipe) {
        // Delete all child recipe items first
        const { error: errItems } = await supabase
          .from('resep_item')
          .delete()
          .eq('resep_id', recipe.id)
        if (errItems) throw errItems

        // Delete parent recipe
        const { error: errResep } = await supabase
          .from('resep')
          .delete()
          .eq('id', recipe.id)
        if (errResep) throw errResep

        toast.success(`Resep BOM untuk "${name}" berhasil dihapus`)
        router.refresh()
      } else {
        toast.error('Resep sudah tidak aktif atau tidak ditemukan')
      }
    } catch (e: any) {
      console.error(e)
      toast.error(e.message || 'Gagal menghapus resep')
    } finally {
      setDeletingId(null)
    }
  }

  // Harga Jual Inline Edit Actions
  const handleStartEditPrice = (rowKey: string, currentPrice: number) => {
    setEditingPriceId(rowKey)
    setPriceValue(currentPrice.toString())
  }

  const handleSavePrice = async (itemId: string, name: string, updateKey: 'base' | string | string[], currentChannelPrices: Record<string, number>) => {
    try {
      setIsSavingPrice(true)
      const val = Number(priceValue) || 0

      if (updateKey === 'base') {
        const { error } = await supabase
          .from('menu_items')
          .update({ price: val })
          .eq('id', itemId)
        if (error) throw error
      } else {
        const newChannelPrices = { ...currentChannelPrices }
        if (Array.isArray(updateKey)) {
          updateKey.forEach(k => { newChannelPrices[k] = val })
        } else {
          newChannelPrices[updateKey] = val
        }
        
        const { error } = await supabase
          .from('menu_items')
          .update({ channel_prices: newChannelPrices })
          .eq('id', itemId)
        if (error) throw error
      }

      toast.success(`Harga jual untuk "${name}" berhasil diperbarui`)
      setEditingPriceId(null)
      router.refresh()
    } catch (e: any) {
      toast.error(e.message || 'Gagal menyimpan harga jual')
    } finally {
      setIsSavingPrice(false)
    }
  }

  // HPP Override Inline Edit Actions
  const handleStartEditOverride = (rowKey: string, currentValue: number | null) => {
    setEditingOverrideId(rowKey)
    setOverrideValue(currentValue !== null ? currentValue.toString() : '')
  }

  const handleSaveOverride = async (row: HppRow) => {
    try {
      setIsSavingOverride(true)
      const val = overrideValue.trim() === '' ? null : Math.round(Number(overrideValue))

      if (row.categoryKey === 'ss_online') {
        const newChannelHpp = { ...(row.currentChannelHpp || {}) }
        if (val === null) {
          delete newChannelHpp.ss_online
          delete newChannelHpp.tiktok_shop
          delete newChannelHpp.shopee_shop
          delete newChannelHpp['f3305089-b9e4-4b92-95da-14bf6e7fb6d5']
          delete newChannelHpp['d68eb5ec-d6bb-4d0a-8758-a2600c8f1584']
        } else {
          newChannelHpp.ss_online = val
          newChannelHpp.tiktok_shop = val
          newChannelHpp.shopee_shop = val
          newChannelHpp['f3305089-b9e4-4b92-95da-14bf6e7fb6d5'] = val
          newChannelHpp['d68eb5ec-d6bb-4d0a-8758-a2600c8f1584'] = val
        }
        const { error } = await supabase
          .from('menu_items')
          .update({ channel_hpp: newChannelHpp })
          .eq('id', row.itemId)
        if (error) throw error
      } else if (row.categoryKey === 'offline') {
        const { error } = await supabase
          .from('menu_items')
          .update({ hpp_override: val })
          .eq('id', row.itemId)
        if (error) throw error
      } else {
        const newChannelHpp = { ...(row.currentChannelHpp || {}) }
        if (val === null) {
          delete newChannelHpp[row.categoryKey]
        } else {
          newChannelHpp[row.categoryKey] = val
        }
        const { error } = await supabase
          .from('menu_items')
          .update({ channel_hpp: newChannelHpp })
          .eq('id', row.itemId)
        if (error) throw error
      }

      toast.success(
        val === null
          ? `HPP Override untuk "${row.name}" (${row.categoryLabel}) berhasil direset`
          : `HPP Override untuk "${row.name}" (${row.categoryLabel}) berhasil diset ke Rp ${val.toLocaleString('id-ID')}`
      )
      setEditingOverrideId(null)
      router.refresh()
    } catch (e: any) {
      console.error(e)
      toast.error(e.message || 'Gagal menyimpan HPP Override')
    } finally {
      setIsSavingOverride(false)
    }
  }

  const handleResetOverride = async (row: HppRow) => {
    if (!confirm(`Reset HPP override untuk "${row.name}" (${row.categoryLabel})?`)) {
      return
    }
    try {
      if (row.categoryKey === 'ss_online') {
        const newChannelHpp = { ...(row.currentChannelHpp || {}) }
        delete newChannelHpp.ss_online
        delete newChannelHpp.tiktok_shop
        delete newChannelHpp.shopee_shop
        delete newChannelHpp['f3305089-b9e4-4b92-95da-14bf6e7fb6d5']
        delete newChannelHpp['d68eb5ec-d6bb-4d0a-8758-a2600c8f1584']
        const { error } = await supabase
          .from('menu_items')
          .update({ channel_hpp: newChannelHpp })
          .eq('id', row.itemId)
        if (error) throw error
      } else if (row.categoryKey === 'offline') {
        const { error } = await supabase
          .from('menu_items')
          .update({ hpp_override: null })
          .eq('id', row.itemId)
        if (error) throw error
      } else {
        const newChannelHpp = { ...(row.currentChannelHpp || {}) }
        delete newChannelHpp[row.categoryKey]
        const { error } = await supabase
          .from('menu_items')
          .update({ channel_hpp: newChannelHpp })
          .eq('id', row.itemId)
        if (error) throw error
      }
      toast.success(`HPP Override untuk "${row.name}" berhasil direset`)
      router.refresh()
    } catch (e: any) {
      toast.error(e.message || 'Gagal mereset override')
    }
  }

  // Filter and sort the rows
  const filteredRows = useMemo(() => {
    let result = allRows
    if (selectedFilter !== 'all') {
      result = allRows.filter((r) => r.categoryKey === selectedFilter)
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim()
      result = result.filter((r) => r.name.toLowerCase().includes(q))
    }

    return [...result].sort((a, b) => {
      let comparison = 0

      const hppA = a.hppOverride !== null ? a.hppOverride : a.hpp
      const hppB = b.hppOverride !== null ? b.hppOverride : b.hpp

      switch (sortField) {
        case 'order':
          comparison = a.sortOrder - b.sortOrder
          break
        case 'category':
          comparison = a.categoryLabel.localeCompare(b.categoryLabel)
          break
        case 'name':
          comparison = a.name.localeCompare(b.name)
          break
        case 'type':
          comparison = (a.isPackage ? 1 : 0) - (b.isPackage ? 1 : 0)
          break
        case 'hpp':
          if (hppA === null && hppB === null) comparison = 0
          else if (hppA === null) return 1
          else if (hppB === null) return -1
          else comparison = hppA - hppB
          break
        case 'price':
          comparison = a.price - b.price
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
        default:
          comparison = 0
      }

      // Tie breaker
      if (comparison === 0) {
        if (a.categoryOrder !== b.categoryOrder) return a.categoryOrder - b.categoryOrder
        if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder
        return a.name.localeCompare(b.name)
      }

      return sortDir === 'asc' ? comparison : -comparison
    })
  }, [allRows, selectedFilter, searchQuery, sortField, sortDir])

  // Summary stats (of the current filtered subset using effective HPP)
  const stats = useMemo(() => {
    const rowsWithHpp = filteredRows.map(r => {
      const effHpp = r.hppOverride !== null ? r.hppOverride : r.hpp
      return { ...r, effHpp }
    }).filter(r => r.effHpp !== null)

    const total = filteredRows.length
    const withHpp = rowsWithHpp.length
    const baik = rowsWithHpp.filter((r) => r.price > 0 && ((r.price - r.effHpp!) / r.price) * 100 >= 35).length
    const cukup = rowsWithHpp.filter((r) => {
      if (r.price <= 0) return false
      const m = ((r.price - r.effHpp!) / r.price) * 100
      return m >= 20 && m < 35
    }).length
    const tipis = rowsWithHpp.filter((r) => r.price > 0 && ((r.price - r.effHpp!) / r.price) * 100 < 20).length
    return { total, withHpp, baik, cukup, tipis }
  }, [filteredRows])

  // Sorting indicator
  const SortIndicator = ({ field }: { field: SortField }) => {
    if (sortField !== field) {
      return <ArrowUpDown className="w-3.5 h-3.5 ml-1 text-gray-400 group-hover:text-gray-600 transition-colors" />
    }
    return sortDir === 'asc' ? (
      <ChevronUp className="w-3.5 h-3.5 ml-1 text-gray-900 font-bold" />
    ) : (
      <ChevronDown className="w-3.5 h-3.5 ml-1 text-gray-900 font-bold" />
    )
  }

  return (
    <div className="space-y-5">
      {/* Category filter & Search bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gray-50/50 p-4 border rounded-xl shadow-sm">
        {/* Left: Category filter buttons */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1.5 text-xs font-bold text-gray-500 uppercase tracking-wider mr-2">
            <Filter className="w-3.5 h-3.5" />
            <span>Channel:</span>
          </div>
          <button
            onClick={() => setSelectedFilter('all')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
              selectedFilter === 'all'
                ? 'bg-gray-900 text-white border-gray-900 shadow-sm'
                : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400'
            }`}
          >
            Semua
          </button>
          <button
            onClick={() => setSelectedFilter('offline')}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
              selectedFilter === 'offline'
                ? 'bg-gray-900 text-white border-gray-900 shadow-sm'
                : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400'
            }`}
          >
            <span className="inline-flex items-center justify-center rounded-full w-4 h-4 bg-gray-800 text-white p-0.5">
              <Store className="w-2.5 h-2.5" />
            </span>
            Offline
          </button>
          <button
            onClick={() => setSelectedFilter('online_web')}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
              selectedFilter === 'online_web'
                ? 'bg-orange-500 text-white border-orange-500 shadow-sm'
                : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400'
            }`}
          >
            <span className="inline-flex items-center justify-center rounded-full w-4 h-4 bg-orange-600 text-white p-0.5">
              <Globe className="w-2.5 h-2.5" />
            </span>
            Online dari Web
          </button>
          <button
            onClick={() => setSelectedFilter('food_apps')}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
              selectedFilter === 'food_apps'
                ? 'bg-green-600 text-white border-green-600 shadow-sm'
                : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400'
            }`}
          >
            <span className="flex gap-0.5">
              <ChannelLogo channelId="gofood" size={14} />
              <ChannelLogo channelId="grabfood" size={14} />
            </span>
            Food Apps
          </button>
          <button
            onClick={() => setSelectedFilter('tiktok_go')}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
              selectedFilter === 'tiktok_go'
                ? 'bg-black text-white border-black shadow-sm'
                : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400'
            }`}
          >
            <ChannelLogo channelId="tiktokgo" size={14} />
            TikTok Go
          </button>
          <button
            onClick={() => setSelectedFilter('ss_online')}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
              selectedFilter === 'ss_online'
                ? 'bg-rose-600 text-white border-rose-600 shadow-sm'
                : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400'
            }`}
          >
            <span className="inline-flex items-center justify-center rounded-full w-4 h-4 bg-rose-600 text-white p-0.5">
              <ShoppingBag className="w-2.5 h-2.5" />
            </span>
            SS Online
          </button>
        </div>

        {/* Right: Search box */}
        <div className="relative w-full md:w-72">
          <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
            <Search className="w-4 h-4 text-gray-400" />
          </span>
          <input
            type="text"
            placeholder="Cari nama menu..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-8 py-1.5 text-sm rounded-lg border border-gray-200 focus:outline-none focus:ring-1 focus:ring-suka-primary focus:border-suka-primary placeholder-gray-400 transition-all bg-white"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute inset-y-0 right-0 flex items-center pr-2.5 text-gray-400 hover:text-gray-600"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white/80 backdrop-blur-xl rounded-3xl p-5 shadow-[0_8px_30px_rgb(0,0,0,0.04)] relative overflow-hidden group hover:shadow-[0_20px_40px_rgb(0,0,0,0.08)] hover:-translate-y-1 transition-all duration-300">
          <div className="absolute top-0 left-0 w-3 h-full bg-gray-400/50 rounded-l-3xl" />
          <div className="text-[11px] uppercase tracking-wider text-gray-500 font-bold ml-2">Total Menu</div>
          <div className="text-3xl font-extrabold text-gray-900 mt-2 ml-2">{stats.total}</div>
        </div>
        <div className="bg-green-50/80 backdrop-blur-xl rounded-3xl p-5 shadow-[0_8px_30px_rgb(0,0,0,0.04)] relative overflow-hidden group hover:shadow-[0_20px_40px_rgb(34,197,94,0.15)] hover:-translate-y-1 transition-all duration-300">
          <div className="absolute top-0 left-0 w-3 h-full bg-green-500/50 rounded-l-3xl" />
          <div className="text-[11px] uppercase tracking-wider text-green-700 font-bold ml-2">Margin Baik ≥35%</div>
          <div className="text-3xl font-extrabold text-green-800 mt-2 ml-2">{stats.baik}</div>
        </div>
        <div className="bg-amber-50/80 backdrop-blur-xl rounded-3xl p-5 shadow-[0_8px_30px_rgb(0,0,0,0.04)] relative overflow-hidden group hover:shadow-[0_20px_40px_rgb(245,158,11,0.15)] hover:-translate-y-1 transition-all duration-300">
          <div className="absolute top-0 left-0 w-3 h-full bg-amber-500/50 rounded-l-3xl" />
          <div className="text-[11px] uppercase tracking-wider text-amber-700 font-bold ml-2">Margin Cukup 20–35%</div>
          <div className="text-3xl font-extrabold text-amber-800 mt-2 ml-2">{stats.cukup}</div>
        </div>
        <div className="bg-red-50/80 backdrop-blur-xl rounded-3xl p-5 shadow-[0_8px_30px_rgb(0,0,0,0.04)] relative overflow-hidden group hover:shadow-[0_20px_40px_rgb(239,68,68,0.15)] hover:-translate-y-1 transition-all duration-300">
          <div className="absolute top-0 left-0 w-3 h-full bg-red-500/50 rounded-l-3xl" />
          <div className="text-[11px] uppercase tracking-wider text-red-700 font-bold ml-2">Margin Tipis &lt;20%</div>
          <div className="text-3xl font-extrabold text-red-800 mt-2 ml-2">{stats.tipis}</div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white/80 backdrop-blur-xl rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-gray-50 border-b text-gray-500 text-[11px] uppercase tracking-wider font-semibold">
              <tr>
                <th
                  onClick={() => handleSort('category')}
                  className="px-5 py-3 cursor-pointer select-none group hover:bg-gray-100/50 transition-colors"
                >
                  <div className="flex items-center">
                    Kategori Channel
                    <SortIndicator field="category" />
                  </div>
                </th>
                <th
                  onClick={() => handleSort('name')}
                  className="px-5 py-3 cursor-pointer select-none group hover:bg-gray-100/50 transition-colors"
                >
                  <div className="flex items-center">
                    Nama Menu
                    <SortIndicator field="name" />
                  </div>
                </th>
                <th
                  onClick={() => handleSort('type')}
                  className="px-5 py-3 cursor-pointer select-none group hover:bg-gray-100/50 transition-colors text-center"
                >
                  <div className="flex items-center justify-center">
                    Tipe
                    <SortIndicator field="type" />
                  </div>
                </th>
                <th className="px-5 py-3 text-center select-none">Logo Channel</th>
                <th className="px-5 py-3 text-right select-none whitespace-nowrap">HPP BOM</th>
                <th
                  onClick={() => handleSort('hpp')}
                  className="px-5 py-3 cursor-pointer select-none group hover:bg-gray-100/50 transition-colors text-right whitespace-nowrap"
                >
                  <div className="flex items-center justify-end">
                    HPP Override
                    <SortIndicator field="hpp" />
                  </div>
                </th>
                <th
                  onClick={() => handleSort('price')}
                  className="px-5 py-3 cursor-pointer select-none group hover:bg-gray-100/50 transition-colors text-right"
                >
                  <div className="flex items-center justify-end">
                    Harga Jual
                    <SortIndicator field="price" />
                  </div>
                </th>
                <th
                  onClick={() => handleSort('profit')}
                  className="px-5 py-3 cursor-pointer select-none group hover:bg-gray-100/50 transition-colors text-right"
                >
                  <div className="flex items-center justify-end">
                    Profit/unit
                    <SortIndicator field="profit" />
                  </div>
                </th>
                <th
                  onClick={() => handleSort('margin')}
                  className="px-5 py-3 cursor-pointer select-none group hover:bg-gray-100/50 transition-colors text-center"
                >
                  <div className="flex items-center justify-center">
                    Margin
                    <SortIndicator field="margin" />
                  </div>
                </th>
                <th className="px-5 py-3 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredRows.map((row) => {
                const effHpp = row.hppOverride !== null ? row.hppOverride : row.hpp
                const profit = effHpp !== null ? row.price - effHpp : null

                return (
                  <tr key={row.key} className="hover:bg-gray-50/60 transition-colors">
                    <td className="px-5 py-3.5 text-gray-700 font-semibold whitespace-nowrap">
                      {row.categoryLabel}
                    </td>
                    <td className="px-5 py-3.5 font-medium text-gray-900">
                      {row.name}
                      {row.isPartial && (
                        <span className="ml-2 text-[10px] text-amber-600 font-normal">(parsial)</span>
                      )}
                    </td>
                    <td className="px-5 py-3.5 text-center">
                      {row.isPackage ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-100 text-purple-700 uppercase tracking-wider">
                          <Package className="w-3 h-3" /> Combo
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-700 uppercase tracking-wider">
                          <Sandwich className="w-3 h-3" /> Single
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-3.5 text-center">
                      <div className="inline-flex justify-center">{row.logos}</div>
                    </td>
                    
                    {/* HPP BOM Cell */}
                    <td className="px-5 py-3.5 text-right font-medium text-gray-500 whitespace-nowrap">
                      {row.hpp === null ? (
                        <span className="text-gray-400 text-xs italic">Belum ada resep</span>
                      ) : (
                        rupiah(row.hpp)
                      )}
                    </td>
                    
                    {/* HPP Override Cell with Inline override editing */}
                    <td className="px-5 py-3.5 text-right font-medium text-gray-700 whitespace-nowrap">
                      {editingOverrideId === row.key ? (
                        <div className="flex items-center justify-end gap-1.5" onClick={(e) => e.stopPropagation()}>
                          <input
                            type="number"
                            min="0"
                            placeholder={row.hpp !== null ? row.hpp.toString() : "HPP..."}
                            value={overrideValue}
                            onChange={(e) => setOverrideValue(e.target.value)}
                            disabled={isSavingOverride}
                            className="w-20 px-2 py-0.5 text-xs text-right border border-gray-300 rounded focus:ring-1 focus:ring-suka-primary focus:border-suka-primary"
                          />
                          <button
                            onClick={() => handleSaveOverride(row)}
                            disabled={isSavingOverride}
                            className="p-1 text-green-600 hover:bg-green-50 rounded"
                            title="Simpan"
                          >
                            <Check className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => setEditingOverrideId(null)}
                            disabled={isSavingOverride}
                            className="p-1 text-red-600 hover:bg-red-50 rounded"
                            title="Batal"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center justify-end gap-1.5 group/cell">
                          {row.hppOverride !== null ? (
                            <span className="text-orange-600 font-bold" title="HPP Override Manual">
                              {rupiah(row.hppOverride)}
                            </span>
                          ) : (
                            <span className="text-gray-400 text-xs italic" title="Mengikuti nilai BOM">
                              Mengikuti BOM
                            </span>
                          )}
                          
                          <button
                            onClick={() => handleStartEditOverride(row.key, row.hppOverride)}
                            className="opacity-0 group-hover/cell:opacity-100 p-1 text-gray-400 hover:text-suka-primary hover:bg-gray-100 rounded transition-all"
                            title="Set Override HPP"
                          >
                            <Pencil className="w-3 h-3" />
                          </button>
                          
                          {row.hppOverride !== null && (
                            <button
                              onClick={() => handleResetOverride(row)}
                              className="opacity-0 group-hover/cell:opacity-100 p-1 text-red-400 hover:text-red-600 hover:bg-red-50 rounded transition-all"
                              title="Reset ke BOM"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                      )}
                    </td>
                    <td className="px-5 py-3.5 text-right font-semibold text-gray-900 whitespace-nowrap">
                      {editingPriceId === row.key ? (
                        <div className="flex items-center justify-end gap-1.5" onClick={(e) => e.stopPropagation()}>
                          <input
                            type="number"
                            min="0"
                            value={priceValue}
                            onChange={(e) => setPriceValue(e.target.value)}
                            disabled={isSavingPrice}
                            className="w-24 px-2 py-0.5 text-xs text-right border border-gray-300 rounded focus:ring-1 focus:ring-suka-primary focus:border-suka-primary"
                          />
                          <button
                            onClick={() => handleSavePrice(row.itemId, row.name, row.updateKey, row.currentChannelPrices)}
                            disabled={isSavingPrice}
                            className="p-1 text-green-600 hover:bg-green-50 rounded"
                            title="Simpan"
                          >
                            <Check className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => setEditingPriceId(null)}
                            disabled={isSavingPrice}
                            className="p-1 text-red-600 hover:bg-red-50 rounded"
                            title="Batal"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center justify-end gap-1.5 group/pricecell">
                          <span>{rupiah(row.price)}</span>
                          <button
                            onClick={() => handleStartEditPrice(row.key, row.price)}
                            className="opacity-0 group-hover/pricecell:opacity-100 p-1 text-gray-400 hover:text-suka-primary hover:bg-gray-100 rounded transition-all"
                            title="Edit Harga Jual"
                          >
                            <Pencil className="w-3 h-3" />
                          </button>
                        </div>
                      )}
                    </td>
                    <td className="px-5 py-3.5 text-right whitespace-nowrap">
                      {profit === null ? (
                        <span className="text-gray-400">—</span>
                      ) : (
                        <span className={profit >= 0 ? 'text-green-700 font-semibold' : 'text-red-700 font-semibold'}>
                          {rupiah(profit)}
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-3.5 text-center">
                      <MarginBadge hpp={effHpp} price={row.price} />
                    </td>
                    <td className="px-5 py-3.5 text-right whitespace-nowrap">
                      <div className="flex justify-end items-center gap-2">
                        <Link
                          href={`/dashboard/resep/${row.itemId}`}
                          className="p-1.5 text-gray-500 hover:text-suka-primary hover:bg-orange-50 rounded-md transition-colors"
                          title="Edit Resep"
                        >
                          <Pencil className="w-4 h-4" />
                        </Link>
                        <button
                          onClick={() => handleDeleteRecipe(row.itemId, row.name)}
                          disabled={row.hpp === null || deletingId === row.itemId}
                          className={`p-1.5 rounded-md transition-colors ${
                            row.hpp === null
                              ? 'text-gray-300 cursor-not-allowed'
                              : 'text-red-500 hover:bg-red-50 hover:text-red-700'
                          }`}
                          title="Hapus Resep BOM"
                        >
                          {deletingId === row.itemId ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Trash2 className="w-4 h-4" />
                          )}
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
              {filteredRows.length === 0 && (
                <tr>
                  <td colSpan={9} className="px-5 py-10 text-center text-gray-400">
                    Tidak ada data menu untuk filter ini.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        {stats.withHpp < stats.total && (
          <div className="border-t px-5 py-3 bg-amber-50 text-xs text-amber-700 font-medium">
            ⚠️ Sebagian menu belum memiliki resep BOM — HPP tidak dapat dihitung.
          </div>
        )}
      </div>
    </div>
  )
}

