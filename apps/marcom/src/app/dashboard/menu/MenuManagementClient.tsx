'use client'

import { useState, useRef, useMemo, useDeferredValue } from 'react'
import Image from 'next/image'
import {
  Plus,
  Pencil,
  Trash2,
  X,
  Loader2,
  Copy,
  AlertCircle,
  UploadCloud,
  Sandwich,
  Search,
  MoreVertical,
  Check,
  Store,
  Globe,
  Tag,
  Smartphone,
  CheckCircle2,
  ChevronDown,
  ArrowUpDown,
  ExternalLink,
} from 'lucide-react'
import { CurrencyInput } from '@/components/ui/CurrencyInput'
import { formatRupiah, cn } from '@/lib/utils'
import { getPosSupabase } from '@/lib/supabase-pos'
import type { MenuItem, Category, SalesChannel, Outlet, MenuPromo } from '@/types/menu'
import {
  saveMenuItem,
  toggleMenuAvailability,
  toggleTampilDiApp,
  toggleMenuPublished,
  deleteMenuItem,
  toggleSettingBadge,
} from './actions'

interface FormState {
  id: string | null
  name: string
  description: string
  price: string
  strike_price: string
  channel_prices: Record<string, string>
  category_id: string
  is_available: boolean
  is_available_online: boolean
  is_published_order_online: boolean
  tampil_di_app: boolean
  available_online_channels: string[] | null
  image_url: string | null
  outlet_ids: string[] | null
}

const EMPTY_FORM: FormState = {
  id: null,
  name: '',
  description: '',
  price: '',
  strike_price: '',
  channel_prices: {},
  category_id: '',
  is_available: true,
  is_available_online: true,
  is_published_order_online: false,
  tampil_di_app: true,
  available_online_channels: null,
  image_url: null,
  outlet_ids: null,
}

const SLUG_APLIKASI = 'aplikasi'

interface Props {
  initialItems: MenuItem[]
  categories: Category[]
  channels: SalesChannel[]
  outlets: Outlet[]
  initialUpsells: string[]
  initialBestsellers: string[]
  initialRecommendations: string[]
  promos?: MenuPromo[]
}

type ToastState = { type: 'success' | 'error'; message: string } | null

export default function MenuManagementClient({
  initialItems,
  categories,
  channels,
  outlets,
  initialUpsells,
  initialBestsellers,
  initialRecommendations,
  promos = [],
}: Props) {
  const [categoriesList, setCategoriesList] = useState<Category[]>(categories)
  const [items, setItems] = useState<MenuItem[]>(initialItems)
  const [upsells, setUpsells] = useState<string[]>(initialUpsells)
  const [bestsellers, setBestsellers] = useState<string[]>(initialBestsellers)
  const [recommendations, setRecommendations] = useState<string[]>(initialRecommendations)

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState('')
  const deferredSearch = useDeferredValue(searchQuery)
  const [activeCategoryFilter, setActiveCategoryFilter] = useState<string>('all')
  const [activeChannelFilter, setActiveChannelFilter] = useState<string>('')
  const [sortKey, setSortKey] = useState<'name' | 'price' | 'category' | null>(null)
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc')

  // Form & Modals
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [onlinePriceMode, setOnlinePriceMode] = useState<'unified' | 'per_channel'>('unified')
  const [outletSearch, setOutletSearch] = useState('')
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [openDropdownId, setOpenDropdownId] = useState<string | null>(null)
  const [toast, setToast] = useState<ToastState>(null)

  const fileInputRef = useRef<HTMLInputElement>(null)

  const showToast = (type: 'success' | 'error', message: string) => {
    setToast({ type, message })
    setTimeout(() => setToast(null), 3500)
  }

  const getSlug = (channelId: string) => {
    const ch = channels.find((c) => c.id === channelId)
    const raw = ch ? ch.name : channelId
    return raw.toLowerCase().replace(/\s+/g, '')
  }

  // Filter check for items in channel
  const isItemInChannel = (item: MenuItem, channelKey: string) => {
    if (!channelKey || channelKey === 'all') return true

    if (channelKey === 'pos_kasir') {
      if (item.available_online_channels && Array.isArray(item.available_online_channels)) {
        return item.available_online_channels.includes('pos_kasir')
      }
      return item.is_available !== false
    }

    if (channelKey === SLUG_APLIKASI) {
      return item.tampil_di_app === true
    }

    if (channelKey === 'all_food_apps') {
      if (item.is_available_online === false) return false
      const hasPrices = item.channel_prices && Object.keys(item.channel_prices).length > 0
      const hasChannels = item.available_online_channels && item.available_online_channels.length > 0
      return Boolean(hasPrices || hasChannels || item.is_available_online)
    }

    const targetSlug = getSlug(channelKey)
    if (item.is_available_online === false) return false

    const chs = item.available_online_channels
    const pricesObj = item.channel_prices || {}

    if (Array.isArray(chs) && chs.length > 0) {
      return chs.some(
        (c) =>
          c.toLowerCase().replace(/\s+/g, '') === targetSlug ||
          ((targetSlug === 'tiktokgo' || targetSlug === 'tiktok') &&
            (c === 'tiktokgo' || c === 'tiktok_go' || c === 'tiktok'))
      )
    } else {
      const channelPrice =
        pricesObj[targetSlug] ||
        ((targetSlug === 'tiktokgo' || targetSlug === 'tiktok')
          ? (pricesObj['tiktok_go'] || pricesObj['tiktokgo'])
          : undefined)
      return channelPrice !== undefined && channelPrice !== null && Number(channelPrice) > 0
    }
  }

  // Filtered & Sorted items
  const filteredItems = useMemo(() => {
    let result = [...items]

    if (activeCategoryFilter !== 'all') {
      result = result.filter((item) => item.category_id === activeCategoryFilter)
    }

    if (activeChannelFilter) {
      result = result.filter((item) => isItemInChannel(item, activeChannelFilter))
    }

    if (deferredSearch.trim()) {
      const q = deferredSearch.trim().toLowerCase()
      result = result.filter((item) => {
        const nameMatch = item.name.toLowerCase().includes(q)
        const descMatch = (item.description || '').toLowerCase().includes(q)
        const catMatch = (item.categories?.name || '').toLowerCase().includes(q)
        return nameMatch || descMatch || catMatch
      })
    }

    if (sortKey) {
      result.sort((a, b) => {
        let valA: any = ''
        let valB: any = ''

        if (sortKey === 'name') {
          valA = a.name.toLowerCase()
          valB = b.name.toLowerCase()
        } else if (sortKey === 'category') {
          valA = (a.categories?.name || '').toLowerCase()
          valB = (b.categories?.name || '').toLowerCase()
        } else if (sortKey === 'price') {
          valA = Number(a.price) || 0
          valB = Number(b.price) || 0
        }

        if (valA < valB) return sortOrder === 'asc' ? -1 : 1
        if (valA > valB) return sortOrder === 'asc' ? 1 : -1
        return 0
      })
    }

    return result
  }, [items, activeCategoryFilter, activeChannelFilter, deferredSearch, sortKey, sortOrder])

  const handleSort = (key: 'name' | 'price' | 'category') => {
    if (sortKey === key) {
      setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortKey(key)
      setSortOrder('asc')
    }
  }

  // Open Edit Form
  const openEdit = (item: MenuItem) => {
    const rawPrices = item.channel_prices || {}
    const strPrices: Record<string, string> = {}
    Object.entries(rawPrices).forEach(([k, v]) => {
      strPrices[k] = v !== undefined && v !== null ? String(v) : ''
    })

    // Determine unified vs per_channel
    const onlineKeys = Object.keys(strPrices).filter((k) => k !== 'pos_kasir' && k !== SLUG_APLIKASI)
    const uniqueValues = new Set(onlineKeys.map((k) => strPrices[k]))
    const isUnified = uniqueValues.size <= 1

    setForm({
      id: item.id,
      name: item.name,
      description: item.description || '',
      price: String(item.price),
      strike_price: item.strike_price ? String(item.strike_price) : '',
      channel_prices: strPrices,
      category_id: item.category_id || '',
      is_available: item.is_available,
      is_available_online: item.is_available_online ?? true,
      is_published_order_online: item.is_published_order_online ?? false,
      tampil_di_app: item.tampil_di_app ?? true,
      available_online_channels: item.available_online_channels ?? null,
      image_url: item.image_url,
      outlet_ids:
        item.available_outlets && Array.isArray(item.available_outlets) && item.available_outlets.length > 0
          ? item.available_outlets
          : null,
    })
    setOnlinePriceMode(isUnified ? 'unified' : 'per_channel')
    setPreview(null)
    setImageFile(null)
    setFormError(null)
    setShowForm(true)
  }

  const openAdd = () => {
    setForm(EMPTY_FORM)
    setPreview(null)
    setImageFile(null)
    setFormError(null)
    setOnlinePriceMode('unified')
    setShowForm(true)
  }

  const openDuplicate = (item: MenuItem) => {
    const rawPrices = item.channel_prices || {}
    const strPrices: Record<string, string> = {}
    Object.entries(rawPrices).forEach(([k, v]) => {
      strPrices[k] = v !== undefined && v !== null ? String(v) : ''
    })

    setForm({
      id: null,
      name: `${item.name} (Salinan)`,
      description: item.description || '',
      price: String(item.price),
      strike_price: item.strike_price ? String(item.strike_price) : '',
      channel_prices: strPrices,
      category_id: item.category_id || '',
      is_available: item.is_available,
      is_available_online: item.is_available_online ?? true,
      is_published_order_online: false,
      tampil_di_app: item.tampil_di_app ?? true,
      available_online_channels: item.available_online_channels ?? null,
      image_url: item.image_url,
      outlet_ids:
        item.available_outlets && Array.isArray(item.available_outlets) && item.available_outlets.length > 0
          ? [...item.available_outlets]
          : null,
    })
    setPreview(null)
    setImageFile(null)
    setFormError(null)
    setShowForm(true)
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        setFormError('Ukuran gambar melebihi batas 5MB.')
        return
      }
      setImageFile(file)
      setPreview(URL.createObjectURL(file))
    }
  }

  // Save Form (Add or Edit)
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.name.trim()) {
      setFormError('Nama menu wajib diisi.')
      return
    }
    if (form.price === '' || isNaN(Number(form.price)) || Number(form.price) < 0) {
      setFormError('Harga offline harus diisi dengan angka valid.')
      return
    }

    setSaving(true)
    setFormError(null)

    try {
      let finalImageUrl = form.image_url

      // If user selected a new image file, upload to Supabase storage 'menu-images'
      if (imageFile) {
        const supabase = getPosSupabase()
        const ext = imageFile.name.split('.').pop() || 'webp'
        const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${ext}`
        const { error: uploadError } = await supabase.storage
          .from('menu-images')
          .upload(fileName, imageFile, { contentType: imageFile.type, upsert: true })

        if (uploadError) {
          throw new Error(`Upload gambar gagal: ${uploadError.message}`)
        }

        const {
          data: { publicUrl },
        } = supabase.storage.from('menu-images').getPublicUrl(fileName)

        finalImageUrl = publicUrl
      }

      await saveMenuItem({
        id: form.id,
        name: form.name,
        description: form.description,
        price: Number(form.price),
        strike_price: form.strike_price ? Number(form.strike_price) : null,
        category_id: form.category_id || null,
        image_url: finalImageUrl,
        is_available: form.is_available,
        is_available_online: form.is_available_online,
        available_online_channels: form.available_online_channels,
        channel_prices: form.channel_prices,
        outlet_id: null,
        available_outlets: form.outlet_ids,
        is_published_order_online: form.is_published_order_online,
        tampil_di_app: form.tampil_di_app,
      })

      // Update local state for immediate feedback
      setItems((prev) => {
        const updatedItem: MenuItem = {
          id: form.id || `temp-${Date.now()}`,
          name: form.name,
          description: form.description,
          price: Number(form.price),
          strike_price: form.strike_price ? Number(form.strike_price) : null,
          category_id: form.category_id || null,
          image_url: finalImageUrl,
          is_available: form.is_available,
          is_available_online: form.is_available_online,
          available_online_channels: form.available_online_channels,
          channel_prices: form.channel_prices as any,
          sort_order: 0,
          outlet_id: null,
          available_outlets: form.outlet_ids,
          is_published_order_online: form.is_published_order_online,
          tampil_di_app: form.tampil_di_app,
          categories: categoriesList.find((c) => c.id === form.category_id),
        }

        if (form.id) {
          return prev.map((it) => (it.id === form.id ? updatedItem : it))
        } else {
          return [updatedItem, ...prev]
        }
      })

      setShowForm(false)
      showToast('success', form.id ? 'Perubahan menu berhasil disimpan!' : 'Menu baru berhasil ditambahkan!')
    } catch (err: any) {
      setFormError(err?.message || 'Terjadi kesalahan saat menyimpan menu.')
    } finally {
      setSaving(false)
    }
  }

  // Quick Action Toggles
  const handleToggleAvail = async (item: MenuItem) => {
    try {
      await toggleMenuAvailability(item.id, item.is_available)
      setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, is_available: !i.is_available } : i)))
      showToast('success', `Status ${item.name} berhasil diubah`)
    } catch (err: any) {
      showToast('error', `Gagal mengubah status: ${err.message}`)
    }
  }

  const handleToggleApp = async (item: MenuItem) => {
    try {
      const nextStatus = !item.tampil_di_app
      await toggleTampilDiApp(item.id, item.tampil_di_app ?? false)
      setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, tampil_di_app: nextStatus } : i)))
      showToast('success', `Tayang aplikasi untuk ${item.name} diperbarui`)
    } catch (err: any) {
      showToast('error', `Gagal mengubah tayang app: ${err.message}`)
    }
  }

  const handleTogglePublished = async (item: MenuItem) => {
    try {
      const nextStatus = !item.is_published_order_online
      await toggleMenuPublished(item.id, item.is_published_order_online ?? false)
      setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, is_published_order_online: nextStatus } : i)))
      showToast('success', `Status website untuk ${item.name} diperbarui`)
    } catch (err: any) {
      showToast('error', `Gagal mengubah status website: ${err.message}`)
    }
  }

  const handleDelete = async (item: MenuItem) => {
    if (!confirm(`Apakah Anda yakin ingin menghapus menu "${item.name}"? Tindakan ini tidak dapat dibatalkan.`)) {
      return
    }

    try {
      await deleteMenuItem(item.id, item.image_url)
      setItems((prev) => prev.filter((i) => i.id !== item.id))
      showToast('success', `Menu ${item.name} berhasil dihapus`)
    } catch (err: any) {
      showToast('error', `Gagal menghapus menu: ${err.message}`)
    }
  }

  const handleToggleBadge = async (itemId: string, key: 'bestseller_ids' | 'upsell_ids' | 'recommendation_ids') => {
    try {
      await toggleSettingBadge(itemId, key)
      if (key === 'bestseller_ids') {
        setBestsellers((prev) => (prev.includes(itemId) ? prev.filter((id) => id !== itemId) : [...prev, itemId]))
      } else if (key === 'upsell_ids') {
        setUpsells((prev) => (prev.includes(itemId) ? prev.filter((id) => id !== itemId) : [...prev, itemId]))
      } else if (key === 'recommendation_ids') {
        setRecommendations((prev) => (prev.includes(itemId) ? prev.filter((id) => id !== itemId) : [...prev, itemId]))
      }
      showToast('success', 'Pengaturan highlight menu berhasil diperbarui')
    } catch (err: any) {
      showToast('error', `Gagal mengubah highlight: ${err.message}`)
    }
  }

  return (
    <div className="space-y-6">
      {/* ── Page Header ────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-extrabold text-stone-900 tracking-tight">Katalog &amp; Harga Menu</h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-900 border border-amber-200">
              POS &amp; Online Multi-Channel
            </span>
          </div>
          <p className="text-stone-500 text-xs sm:text-sm mt-1">
            Kelola harga offline toko, online food apps (GoFood/Grab/Shopee/TikTok), aplikasi pelanggan, dan ketersediaan menu.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={openAdd}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 active:bg-amber-700 text-white font-bold text-xs sm:text-sm shadow-sm transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Tambah Menu Baru</span>
          </button>
        </div>
      </div>

      {/* ── Filters Bar ──────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-stone-200/80 p-4 shadow-2xs space-y-4">
        {/* Top Controls: Search & Channel Pills */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* Search Box */}
          <div className="relative w-full md:w-80">
            <Search className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              placeholder="Cari nama menu, deskripsi, atau kategori..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-8 py-2 rounded-xl border border-stone-200 bg-stone-50 focus:bg-white text-stone-900 text-xs sm:text-sm font-medium focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-colors"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600 p-0.5 rounded cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Channel Filter Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 max-w-full scrollbar-none">
            <span className="text-[11px] font-bold text-stone-400 uppercase tracking-wider shrink-0 mr-1">
              Filter Kanal:
            </span>
            {[
              { id: '', name: 'Semua Kanal' },
              { id: 'pos_kasir', name: 'Kasir Toko (Offline)' },
              { id: 'all_food_apps', name: 'Semua Food Apps' },
              { id: SLUG_APLIKASI, name: 'Suka App' },
              ...channels.map((c) => ({ id: c.id, name: c.name })),
            ].map((ch) => {
              const isActive = activeChannelFilter === ch.id
              return (
                <button
                  key={ch.id}
                  type="button"
                  onClick={() => setActiveChannelFilter(ch.id)}
                  className={cn(
                    'px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer shrink-0',
                    isActive
                      ? 'bg-stone-900 text-white shadow-xs'
                      : 'bg-stone-100 text-stone-600 hover:bg-stone-200/80 hover:text-stone-900'
                  )}
                >
                  {ch.name}
                </button>
              )
            })}
          </div>
        </div>

        {/* Category Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pt-2 border-t border-stone-100 scrollbar-none">
          <span className="text-[11px] font-bold text-stone-400 uppercase tracking-wider shrink-0 mr-1">
            Kategori:
          </span>
          <button
            type="button"
            onClick={() => setActiveCategoryFilter('all')}
            className={cn(
              'px-3 py-1 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer',
              activeCategoryFilter === 'all'
                ? 'bg-amber-500 text-white font-bold'
                : 'text-stone-600 hover:bg-stone-100'
            )}
          >
            Semua ({items.length})
          </button>
          {categoriesList.map((cat) => {
            const count = items.filter((i) => i.category_id === cat.id).length
            const isCatActive = activeCategoryFilter === cat.id
            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => setActiveCategoryFilter(cat.id)}
                className={cn(
                  'px-3 py-1 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer',
                  isCatActive ? 'bg-amber-500 text-white font-bold' : 'text-stone-600 hover:bg-stone-100'
                )}
              >
                {cat.name} ({count})
              </button>
            )
          })}
        </div>
      </div>

      {/* ── Menu Table ───────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-stone-200/80 shadow-2xs overflow-hidden">
        {filteredItems.length === 0 ? (
          <div className="py-16 text-center flex flex-col items-center justify-center p-6">
            <div className="w-16 h-16 rounded-2xl bg-amber-50 flex items-center justify-center mb-3">
              <Sandwich className="w-8 h-8 text-amber-400" />
            </div>
            <h3 className="font-extrabold text-stone-900 text-base">Tidak ada menu yang sesuai</h3>
            <p className="text-stone-500 text-xs sm:text-sm mt-1 max-w-sm">
              Coba sesuaikan kata kunci pencarian atau ganti filter kanal &amp; kategori di atas.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto pb-44">
            <table className="w-full text-left text-xs sm:text-sm">
              <thead>
                <tr className="bg-stone-50/90 border-b border-stone-200 text-stone-500 text-[11px] font-bold uppercase tracking-wider">
                  <th className="py-3.5 px-4 w-14">Foto</th>
                  <th
                    className="py-3.5 px-4 cursor-pointer hover:text-stone-900 select-none"
                    onClick={() => handleSort('name')}
                  >
                    <div className="flex items-center gap-1.5">
                      <span>Nama Menu</span>
                      <ArrowUpDown className="w-3 h-3" />
                    </div>
                  </th>
                  <th
                    className="py-3.5 px-4 cursor-pointer hover:text-stone-900 select-none hidden sm:table-cell"
                    onClick={() => handleSort('category')}
                  >
                    <div className="flex items-center gap-1.5">
                      <span>Kategori</span>
                      <ArrowUpDown className="w-3 h-3" />
                    </div>
                  </th>
                  <th
                    className="py-3.5 px-4 text-right cursor-pointer hover:text-stone-900 select-none"
                    onClick={() => handleSort('price')}
                  >
                    <div className="flex items-center justify-end gap-1.5">
                      <span>
                        {activeChannelFilter === 'pos_kasir'
                          ? 'Harga Kasir (Offline)'
                          : activeChannelFilter
                          ? `Harga ${activeChannelFilter}`
                          : 'Informasi Harga'}
                      </span>
                      <ArrowUpDown className="w-3 h-3" />
                    </div>
                  </th>
                  <th className="py-3.5 px-3 text-center">App</th>
                  <th className="py-3.5 px-3 text-center">Website</th>
                  <th className="py-3.5 px-3 text-center">Status</th>
                  <th className="py-3.5 px-4 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {filteredItems.map((item) => {
                  const rawPrices = item.channel_prices || {}
                  const activeSlug = activeChannelFilter ? getSlug(activeChannelFilter) : ''

                  // Calculate online price display
                  let onlinePriceDisplay: string | null = null
                  const onlinePricesList = Object.entries(rawPrices)
                    .filter(([k, v]) => k !== 'pos_kasir' && k !== SLUG_APLIKASI && Number(v) > 0)
                    .map(([, v]) => Number(v))

                  if (onlinePricesList.length > 0) {
                    const minP = Math.min(...onlinePricesList)
                    const maxP = Math.max(...onlinePricesList)
                    onlinePriceDisplay = minP === maxP ? formatRupiah(minP) : `${formatRupiah(minP)} - ${formatRupiah(maxP)}`
                  }

                  const channelPrice =
                    activeSlug && activeSlug !== 'pos_kasir' && activeSlug !== 'all_food_apps'
                      ? rawPrices[activeSlug] || (activeSlug === 'tiktokgo' ? rawPrices['tiktok_go'] : undefined)
                      : null

                  return (
                    <tr key={item.id} className="hover:bg-amber-50/30 transition-colors">
                      {/* Thumbnail */}
                      <td className="py-3 px-4">
                        <div className="w-12 h-12 rounded-xl overflow-hidden bg-stone-100 border border-stone-200/60 relative flex items-center justify-center shrink-0">
                          {item.image_url ? (
                            <Image
                              src={item.image_url}
                              alt={item.name}
                              fill
                              unoptimized
                              className="object-cover"
                            />
                          ) : (
                            <Sandwich className="w-6 h-6 text-stone-300" strokeWidth={1.5} />
                          )}
                        </div>
                      </td>

                      {/* Name & Badges */}
                      <td className="py-3 px-4 min-w-[200px]">
                        <p className="font-bold text-stone-900 leading-tight">{item.name}</p>
                        {item.description && (
                          <p className="text-[11px] text-stone-400 line-clamp-1 mt-0.5">{item.description}</p>
                        )}
                        <div className="flex flex-wrap gap-1 mt-1.5">
                          {bestsellers.includes(item.id) && (
                            <span className="text-[10px] bg-red-100 text-red-700 px-1.5 py-0.5 rounded font-bold">
                              Best Seller
                            </span>
                          )}
                          {recommendations.includes(item.id) && (
                            <span className="text-[10px] bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded font-bold">
                              Rekomendasi
                            </span>
                          )}
                          {upsells.includes(item.id) && (
                            <span className="text-[10px] bg-blue-100 text-blue-800 px-1.5 py-0.5 rounded font-bold">
                              Menu Ekstra
                            </span>
                          )}
                          {item.available_outlets && Array.isArray(item.available_outlets) && item.available_outlets.length > 0 ? (
                            <span
                              className="text-[10px] bg-purple-50 text-purple-700 border border-purple-200 px-1.5 py-0.5 rounded font-bold"
                              title={item.available_outlets
                                .map((id) => outlets.find((o) => o.id === id)?.name || id)
                                .join(', ')}
                            >
                              {item.available_outlets.length} Cabang
                            </span>
                          ) : (
                            <span className="text-[10px] bg-stone-100 text-stone-600 border border-stone-200 px-1.5 py-0.5 rounded font-bold">
                              Global (Semua Cabang)
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Category */}
                      <td className="py-3 px-4 hidden sm:table-cell">
                        {item.categories?.name ? (
                          <span className="inline-flex px-2.5 py-1 rounded-lg bg-stone-100 text-stone-700 text-xs font-semibold">
                            {item.categories.name}
                          </span>
                        ) : (
                          <span className="text-stone-300 text-xs">—</span>
                        )}
                      </td>

                      {/* Price Details */}
                      <td className="py-3 px-4 text-right">
                        {activeSlug && !['all_food_apps', ''].includes(activeSlug) ? (
                          // Specific Filter Price
                          <div className="flex flex-col items-end gap-0.5">
                            {item.strike_price && (
                              <span className="text-xs text-stone-400 line-through decoration-stone-400">
                                {formatRupiah(item.strike_price)}
                              </span>
                            )}
                            <span className="font-extrabold text-stone-900 font-mono text-sm">
                              {activeSlug === 'pos_kasir'
                                ? formatRupiah(item.price)
                                : channelPrice
                                ? formatRupiah(channelPrice)
                                : '—'}
                            </span>
                          </div>
                        ) : (
                          // Multi-Channel Overview
                          <div className="flex flex-col items-end gap-1">
                            {item.strike_price && (
                              <span className="text-xs text-stone-400 line-through">
                                {formatRupiah(item.strike_price)}
                              </span>
                            )}
                            <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-stone-100 text-stone-800 text-xs">
                              <span className="text-[10px] font-bold text-stone-500 uppercase">Offline:</span>
                              <span className="font-bold font-mono">{formatRupiah(item.price)}</span>
                            </div>
                            {onlinePriceDisplay && (
                              <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-800 text-xs">
                                <span className="text-[10px] font-bold text-emerald-600 uppercase">Food Apps:</span>
                                <span className="font-bold font-mono">{onlinePriceDisplay}</span>
                              </div>
                            )}
                          </div>
                        )}
                      </td>

                      {/* Tampil di App */}
                      <td className="py-3 px-3 text-center">
                        <button
                          type="button"
                          onClick={() => handleToggleApp(item)}
                          className={cn(
                            'px-2.5 py-1 rounded-full text-xs font-bold transition-all cursor-pointer',
                            item.tampil_di_app
                              ? 'bg-amber-100 text-amber-800 hover:bg-amber-200'
                              : 'bg-stone-100 text-stone-400 hover:bg-stone-200'
                          )}
                          title="Klik untuk ubah tayang di SukaShawarma APP"
                        >
                          {item.tampil_di_app ? 'Tayang' : 'Tutup'}
                        </button>
                      </td>

                      {/* Website Order-Online */}
                      <td className="py-3 px-3 text-center">
                        <button
                          type="button"
                          onClick={() => handleTogglePublished(item)}
                          className={cn(
                            'px-2.5 py-1 rounded-full text-xs font-bold transition-all cursor-pointer',
                            item.is_published_order_online
                              ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200'
                              : 'bg-stone-100 text-stone-400 hover:bg-stone-200'
                          )}
                          title="Klik untuk ubah tayang di website publik"
                        >
                          {item.is_published_order_online ? 'Tayang' : 'Tutup'}
                        </button>
                      </td>

                      {/* Status Stok */}
                      <td className="py-3 px-3 text-center">
                        <button
                          type="button"
                          onClick={() => handleToggleAvail(item)}
                          className={cn(
                            'px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer',
                            item.is_available
                              ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                              : 'bg-red-50 text-red-600 hover:bg-red-100'
                          )}
                        >
                          {item.is_available ? 'Tersedia' : 'Habis'}
                        </button>
                      </td>

                      {/* Aksi */}
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5 relative">
                          <button
                            type="button"
                            onClick={() => openEdit(item)}
                            className="p-2 rounded-lg bg-stone-100 hover:bg-amber-100 text-stone-700 hover:text-amber-800 transition-colors cursor-pointer"
                            title="Edit Menu & Harga"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => openDuplicate(item)}
                            className="p-2 rounded-lg bg-stone-100 hover:bg-blue-100 text-stone-700 hover:text-blue-800 transition-colors cursor-pointer"
                            title="Duplikasi Menu"
                          >
                            <Copy className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(item)}
                            className="p-2 rounded-lg bg-stone-100 hover:bg-red-100 text-stone-700 hover:text-red-700 transition-colors cursor-pointer"
                            title="Hapus Menu"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>

                          {/* Extra Dropdown */}
                          <button
                            type="button"
                            onClick={() => setOpenDropdownId(openDropdownId === item.id ? null : item.id)}
                            className="p-2 rounded-lg bg-stone-100 hover:bg-stone-200 text-stone-600 transition-colors cursor-pointer"
                          >
                            <MoreVertical className="w-3.5 h-3.5" />
                          </button>

                          {openDropdownId === item.id && (
                            <div className="absolute right-0 top-10 z-50 w-52 bg-white rounded-xl shadow-xl border border-stone-200/80 p-1.5 animate-in fade-in zoom-in-95 text-left">
                              <button
                                type="button"
                                onClick={() => {
                                  handleToggleBadge(item.id, 'bestseller_ids')
                                  setOpenDropdownId(null)
                                }}
                                className="w-full px-3 py-2 rounded-lg text-xs font-semibold text-stone-700 hover:bg-stone-100 flex items-center justify-between cursor-pointer"
                              >
                                <span>Tandai Best Seller</span>
                                {bestsellers.includes(item.id) && <Check className="w-3.5 h-3.5 text-amber-600" />}
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  handleToggleBadge(item.id, 'recommendation_ids')
                                  setOpenDropdownId(null)
                                }}
                                className="w-full px-3 py-2 rounded-lg text-xs font-semibold text-stone-700 hover:bg-stone-100 flex items-center justify-between cursor-pointer"
                              >
                                <span>Jadikan Rekomendasi</span>
                                {recommendations.includes(item.id) && <Check className="w-3.5 h-3.5 text-amber-600" />}
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  handleToggleBadge(item.id, 'upsell_ids')
                                  setOpenDropdownId(null)
                                }}
                                className="w-full px-3 py-2 rounded-lg text-xs font-semibold text-stone-700 hover:bg-stone-100 flex items-center justify-between cursor-pointer"
                              >
                                <span>Jadikan Menu Ekstra</span>
                                {upsells.includes(item.id) && <Check className="w-3.5 h-3.5 text-amber-600" />}
                              </button>
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Modal Form Edit / Tambah Menu ─────────────────────── */}
      {showForm && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-4xl border border-stone-200 overflow-hidden my-auto animate-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-5 border-b border-stone-100 bg-stone-50/70">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-500 text-white flex items-center justify-center shadow-xs">
                  <Sandwich className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="font-extrabold text-stone-900 text-lg">
                    {form.id ? 'Edit Menu & Harga Multi-Channel' : 'Tambah Menu Baru'}
                  </h2>
                  <p className="text-stone-500 text-xs mt-0.5">
                    {form.id
                      ? 'Perbarui harga offline, online food apps, dan pengaturan saluran penjualan'
                      : 'Isi informasi menu baru untuk POS kasir dan saluran online'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="w-9 h-9 rounded-xl bg-stone-100 hover:bg-stone-200 flex items-center justify-center text-stone-500 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Form Body */}
            <form onSubmit={handleSave} className="p-6 space-y-6 max-h-[75vh] overflow-y-auto">
              {formError && (
                <div className="flex items-center gap-2.5 p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs font-semibold">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
                {/* ── Left Column: Media & Channels ── */}
                <div className="space-y-5">
                  {/* Photo Upload */}
                  <div className="bg-stone-50 p-4 rounded-2xl border border-stone-200/80 space-y-3">
                    <label className="text-xs font-bold text-stone-700 uppercase tracking-wider block">
                      Foto Menu Produk
                    </label>
                    <div
                      onClick={() => fileInputRef.current?.click()}
                      className="relative border-2 border-dashed border-stone-300 hover:border-amber-500 rounded-2xl p-4 flex flex-col items-center justify-center min-h-[160px] bg-white cursor-pointer transition-colors overflow-hidden group"
                    >
                      {preview || form.image_url ? (
                        <>
                          <Image
                            src={preview || form.image_url!}
                            alt="Preview"
                            fill
                            unoptimized
                            className="object-cover group-hover:opacity-40 transition-opacity"
                          />
                          <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                            <span className="bg-stone-900/80 text-white text-xs font-bold px-3 py-1.5 rounded-lg shadow-sm">
                              Ganti Foto
                            </span>
                          </div>
                        </>
                      ) : (
                        <div className="text-center space-y-2">
                          <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center mx-auto">
                            <UploadCloud className="w-5 h-5" />
                          </div>
                          <div>
                            <p className="text-xs font-bold text-stone-700">Klik untuk upload foto</p>
                            <p className="text-[10px] text-stone-400">JPG, PNG, atau WebP (Maks. 5MB)</p>
                          </div>
                        </div>
                      )}
                    </div>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      className="hidden"
                      onChange={handleFileChange}
                    />
                    {(preview || form.image_url) && (
                      <button
                        type="button"
                        onClick={() => {
                          setPreview(null)
                          setImageFile(null)
                          setForm((p) => ({ ...p, image_url: null }))
                        }}
                        className="text-xs text-red-600 hover:text-red-700 font-bold block text-center cursor-pointer"
                      >
                        Hapus Foto
                      </button>
                    )}
                  </div>

                  {/* Saluran & Ketersediaan Toggles */}
                  <div className="bg-stone-50 p-4 rounded-2xl border border-stone-200/80 space-y-3.5">
                    <h3 className="text-xs font-bold text-stone-800 uppercase tracking-wider">
                      Distribusi Saluran Penjualan
                    </h3>

                    {/* Toggle: SukaShawarma APP */}
                    <div
                      onClick={() => setForm((p) => ({ ...p, tampil_di_app: !p.tampil_di_app }))}
                      className="flex items-center justify-between p-3 rounded-xl bg-white border border-stone-200 cursor-pointer hover:border-amber-400 transition-all select-none"
                    >
                      <div className="flex items-center gap-2.5">
                        <Smartphone className="w-4 h-4 text-amber-600" />
                        <div>
                          <p className="text-xs font-bold text-stone-900">Tayang di SukaShawarma APP</p>
                          <p className="text-[11px] text-stone-400">Menu dapat dipesan di aplikasi pelanggan</p>
                        </div>
                      </div>
                      <div
                        className={cn(
                          'w-10 h-5 rounded-full transition-colors relative shrink-0',
                          form.tampil_di_app ? 'bg-amber-500' : 'bg-stone-300'
                        )}
                      >
                        <span
                          className={cn(
                            'absolute top-0.5 w-4 h-4 bg-white rounded-full transition-transform',
                            form.tampil_di_app ? 'left-5' : 'left-0.5'
                          )}
                        />
                      </div>
                    </div>

                    {/* Toggle: Order-Online Website */}
                    <div
                      onClick={() =>
                        setForm((p) => ({ ...p, is_published_order_online: !p.is_published_order_online }))
                      }
                      className="flex items-center justify-between p-3 rounded-xl bg-white border border-stone-200 cursor-pointer hover:border-emerald-400 transition-all select-none"
                    >
                      <div className="flex items-center gap-2.5">
                        <Globe className="w-4 h-4 text-emerald-600" />
                        <div>
                          <p className="text-xs font-bold text-stone-900">Tayang di Website Order-Online</p>
                          <p className="text-[11px] text-stone-400">Sinkronkan ke katalog pemesanan website publik</p>
                        </div>
                      </div>
                      <div
                        className={cn(
                          'w-10 h-5 rounded-full transition-colors relative shrink-0',
                          form.is_published_order_online ? 'bg-emerald-500' : 'bg-stone-300'
                        )}
                      >
                        <span
                          className={cn(
                            'absolute top-0.5 w-4 h-4 bg-white rounded-full transition-transform',
                            form.is_published_order_online ? 'left-5' : 'left-0.5'
                          )}
                        />
                      </div>
                    </div>

                    {/* Toggle: Tersedia di Food Apps */}
                    <div
                      onClick={() =>
                        setForm((p) => ({ ...p, is_available_online: !p.is_available_online }))
                      }
                      className="flex items-center justify-between p-3 rounded-xl bg-white border border-stone-200 cursor-pointer hover:border-indigo-400 transition-all select-none"
                    >
                      <div className="flex items-center gap-2.5">
                        <Store className="w-4 h-4 text-indigo-600" />
                        <div>
                          <p className="text-xs font-bold text-stone-900">Tersedia di Food Apps</p>
                          <p className="text-[11px] text-stone-400">Tersedia untuk GoFood, Grab, Shopee, TikTok Go</p>
                        </div>
                      </div>
                      <div
                        className={cn(
                          'w-10 h-5 rounded-full transition-colors relative shrink-0',
                          form.is_available_online ? 'bg-indigo-600' : 'bg-stone-300'
                        )}
                      >
                        <span
                          className={cn(
                            'absolute top-0.5 w-4 h-4 bg-white rounded-full transition-transform',
                            form.is_available_online ? 'left-5' : 'left-0.5'
                          )}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Distribusi Outlet (Global vs Spesifik Cabang) */}
                  <div className="bg-stone-50 p-4 rounded-2xl border border-stone-200/80 space-y-3.5">
                    <div className="flex items-center justify-between">
                      <h3 className="text-xs font-bold text-stone-800 uppercase tracking-wider flex items-center gap-1.5">
                        <Store className="w-3.5 h-3.5 text-amber-600" />
                        Pengaturan Distribusi Outlet
                      </h3>
                      {form.outlet_ids !== null && (
                        <span className="text-[10px] font-extrabold text-amber-800 bg-amber-100 px-2 py-0.5 rounded-md">
                          {form.outlet_ids.length} dari {outlets.length} Cabang
                        </span>
                      )}
                    </div>

                    {/* Toggle: Outlet Spesifik vs Global */}
                    <div
                      onClick={() => {
                        const isSpecific = form.outlet_ids !== null
                        if (isSpecific) {
                          setForm((p) => ({ ...p, outlet_ids: null })) // Global
                        } else {
                          setForm((p) => ({ ...p, outlet_ids: [] })) // Specific
                        }
                      }}
                      className={cn(
                        'flex items-center justify-between p-3 rounded-xl border transition-all cursor-pointer select-none',
                        form.outlet_ids !== null
                          ? 'bg-amber-50/60 border-amber-300'
                          : 'bg-white border-stone-200 hover:border-amber-300'
                      )}
                    >
                      <div className="flex items-center gap-2.5">
                        <Store
                          className={cn('w-4 h-4', form.outlet_ids !== null ? 'text-amber-600' : 'text-stone-400')}
                        />
                        <div>
                          <p className="text-xs font-bold text-stone-900">
                            {form.outlet_ids !== null ? 'Outlet Pilihan (Spesifik)' : 'Berlaku Global (Semua Outlet)'}
                          </p>
                          <p className="text-[11px] text-stone-500">
                            {form.outlet_ids !== null
                              ? 'Hanya dijual di cabang-cabang yang dipilih'
                              : 'Otomatis aktif dan dijual di seluruh cabang'}
                          </p>
                        </div>
                      </div>
                      <div
                        className={cn(
                          'w-10 h-5 rounded-full transition-colors relative shrink-0',
                          form.outlet_ids !== null ? 'bg-amber-500' : 'bg-stone-300'
                        )}
                      >
                        <span
                          className={cn(
                            'absolute top-0.5 w-4 h-4 bg-white rounded-full transition-transform',
                            form.outlet_ids !== null ? 'left-5' : 'left-0.5'
                          )}
                        />
                      </div>
                    </div>

                    {/* Outlet Selection Box */}
                    {form.outlet_ids !== null && (
                      <div className="p-3.5 rounded-xl border border-amber-200/90 bg-white space-y-3 animate-in fade-in duration-150">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                          <div className="relative flex-1">
                            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-stone-400 pointer-events-none" />
                            <input
                              type="text"
                              placeholder="Cari nama cabang outlet..."
                              value={outletSearch}
                              onChange={(e) => setOutletSearch(e.target.value)}
                              className="w-full pl-8 pr-2.5 py-1.5 rounded-lg border border-stone-200 text-xs text-stone-800 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                            />
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0">
                            <button
                              type="button"
                              onClick={() =>
                                setForm((p) => ({
                                  ...p,
                                  outlet_ids: outlets.map((o) => o.id),
                                }))
                              }
                              className="px-2 py-1 rounded-md text-[11px] font-bold text-amber-700 bg-amber-50 hover:bg-amber-100 transition-colors cursor-pointer"
                            >
                              Pilih Semua
                            </button>
                            <button
                              type="button"
                              onClick={() => setForm((p) => ({ ...p, outlet_ids: [] }))}
                              className="px-2 py-1 rounded-md text-[11px] font-bold text-stone-500 bg-stone-100 hover:bg-stone-200 transition-colors cursor-pointer"
                            >
                              Kosongkan
                            </button>
                          </div>
                        </div>

                        {/* Selected Outlet Badges */}
                        {form.outlet_ids.length > 0 && (
                          <div className="flex flex-wrap gap-1 p-2 bg-amber-50/50 border border-amber-100 rounded-lg max-h-24 overflow-y-auto">
                            {form.outlet_ids.map((id) => {
                              const out = outlets.find((o) => o.id === id)
                              if (!out) return null
                              return (
                                <span
                                  key={id}
                                  className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-100 text-amber-900 text-[11px] font-bold rounded-md border border-amber-200/80"
                                >
                                  <span>{out.name}</span>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setForm((p) => ({
                                        ...p,
                                        outlet_ids: p.outlet_ids!.filter((oid) => oid !== id),
                                      }))
                                    }
                                    className="hover:text-red-600 rounded p-0.5 cursor-pointer"
                                  >
                                    <X className="w-3 h-3" />
                                  </button>
                                </span>
                              )
                            })}
                          </div>
                        )}

                        {/* Checkbox List */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 max-h-48 overflow-y-auto pr-1">
                          {outlets
                            .filter((o) => o.name.toLowerCase().includes(outletSearch.toLowerCase()))
                            .map((o) => {
                              const isChecked = form.outlet_ids!.includes(o.id)
                              return (
                                <label
                                  key={o.id}
                                  className={cn(
                                    'flex items-center gap-2 p-2 rounded-lg cursor-pointer border text-xs font-semibold select-none transition-colors',
                                    isChecked
                                      ? 'bg-amber-50/80 border-amber-300 text-amber-950 font-bold'
                                      : 'bg-stone-50 border-stone-200 text-stone-700 hover:bg-white'
                                  )}
                                >
                                  <input
                                    type="checkbox"
                                    checked={isChecked}
                                    onChange={(e) => {
                                      const curr = form.outlet_ids || []
                                      if (e.target.checked) {
                                        setForm((p) => ({ ...p, outlet_ids: [...curr, o.id] }))
                                      } else {
                                        setForm((p) => ({ ...p, outlet_ids: curr.filter((id) => id !== o.id) }))
                                      }
                                    }}
                                    className="w-3.5 h-3.5 text-amber-600 rounded border-stone-300 focus:ring-amber-500 cursor-pointer"
                                  />
                                  <span className="truncate">{o.name}</span>
                                </label>
                              )
                            })}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* ── Right Column: Info & Price Management ── */}
                <div className="space-y-5">
                  {/* General Info */}
                  <div className="space-y-3.5">
                    <div>
                      <label className="text-xs font-bold text-stone-700 uppercase tracking-wider block mb-1">
                        Nama Menu <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="Contoh: Shawarma Beef Classic"
                        value={form.name}
                        onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                        className="w-full px-3 py-2 rounded-xl border border-stone-200 bg-white text-stone-900 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                      />
                    </div>

                    <div>
                      <label className="text-xs font-bold text-stone-700 uppercase tracking-wider block mb-1">
                        Kategori Menu
                      </label>
                      <select
                        value={form.category_id}
                        onChange={(e) => setForm((p) => ({ ...p, category_id: e.target.value }))}
                        className="w-full px-3 py-2 rounded-xl border border-stone-200 bg-white text-stone-900 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                      >
                        <option value="">-- Pilih Kategori --</option>
                        {categoriesList.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="text-xs font-bold text-stone-700 uppercase tracking-wider block mb-1">
                        Deskripsi Menu
                      </label>
                      <textarea
                        rows={2}
                        placeholder="Deskripsi singkat produk untuk kasir dan aplikasi..."
                        value={form.description}
                        onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
                        className="w-full px-3 py-2 rounded-xl border border-stone-200 bg-white text-stone-900 text-xs sm:text-sm font-medium focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                      />
                    </div>
                  </div>

                  {/* Multi-Channel Pricing Card */}
                  <div className="bg-amber-50/50 p-4 rounded-2xl border border-amber-200/80 space-y-4">
                    <div className="flex items-center justify-between border-b border-amber-200/60 pb-2">
                      <h3 className="text-xs font-bold text-stone-900 uppercase tracking-wider flex items-center gap-1.5">
                        <Tag className="w-3.5 h-3.5 text-amber-600" />
                        Pengaturan Harga Multi-Channel
                      </h3>
                      <span className="text-[10px] font-extrabold text-amber-800 bg-amber-100 px-2 py-0.5 rounded-md">
                        Real-time Sync
                      </span>
                    </div>

                    {/* Harga Kasir Offline & Harga Coret */}
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <CurrencyInput
                          label="Harga Kasir (Offline) *"
                          value={form.price}
                          onChange={(v) => {
                            const valStr = String(v)
                            setForm((prev) => ({
                              ...prev,
                              price: valStr,
                              channel_prices: {
                                ...prev.channel_prices,
                                pos_kasir: valStr,
                              },
                            }))
                          }}
                          placeholder="0"
                        />
                      </div>
                      <div>
                        <CurrencyInput
                          label="Harga Coret (Diskon)"
                          value={form.strike_price}
                          onChange={(v) => setForm((p) => ({ ...p, strike_price: String(v) }))}
                          placeholder="Opsional"
                        />
                      </div>
                    </div>

                    {/* Online Food Apps Pricing Section */}
                    <div className="space-y-2.5 pt-2 border-t border-amber-200/50">
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-bold text-stone-800 uppercase tracking-wider">
                          Harga Food Apps (Online)
                        </label>
                        <div className="flex items-center gap-1 bg-amber-100/70 p-0.5 rounded-lg text-[11px] font-bold">
                          <button
                            type="button"
                            onClick={() => setOnlinePriceMode('unified')}
                            className={cn(
                              'px-2 py-0.5 rounded-md transition-all cursor-pointer',
                              onlinePriceMode === 'unified' ? 'bg-white text-stone-900 shadow-2xs' : 'text-stone-600'
                            )}
                          >
                            Satu Harga
                          </button>
                          <button
                            type="button"
                            onClick={() => setOnlinePriceMode('per_channel')}
                            className={cn(
                              'px-2 py-0.5 rounded-md transition-all cursor-pointer',
                              onlinePriceMode === 'per_channel' ? 'bg-white text-stone-900 shadow-2xs' : 'text-stone-600'
                            )}
                          >
                            Per Kanal
                          </button>
                        </div>
                      </div>

                      {onlinePriceMode === 'unified' ? (
                        <div>
                          <CurrencyInput
                            value={
                              form.channel_prices['gofood'] ||
                              form.channel_prices['grabfood'] ||
                              form.channel_prices['shopeefood'] ||
                              form.channel_prices['tiktok_go'] ||
                              form.channel_prices['all_food_apps'] ||
                              form.price
                            }
                            onChange={(v) => {
                              const valStr = String(v)
                              setForm((prev) => {
                                const nextPrices = { ...prev.channel_prices }
                                const slugs = ['gofood', 'grabfood', 'shopeefood', 'tiktok_go', 'all_food_apps']
                                slugs.forEach((s) => {
                                  nextPrices[s] = valStr
                                })
                                channels.forEach((c) => {
                                  const slug = c.name.toLowerCase().replace(/\s+/g, '')
                                  if (slug !== 'pos_kasir') nextPrices[slug] = valStr
                                })
                                return { ...prev, channel_prices: nextPrices }
                              })
                            }}
                            placeholder={form.price || '0'}
                          />
                          <p className="text-[10px] text-stone-500 mt-1">
                            Harga online ini berlaku seragam untuk GoFood, GrabFood, Shopee, TikTok Go, dsb.
                          </p>
                        </div>
                      ) : (
                        <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
                          {channels
                            .filter((c) => c.name.toLowerCase().replace(/\s+/g, '') !== 'pos_kasir')
                            .map((ch) => {
                              const slug = ch.name.toLowerCase().replace(/\s+/g, '')
                              const val = form.channel_prices[slug] || form.price
                              return (
                                <div
                                  key={ch.id}
                                  className="flex items-center justify-between gap-3 bg-white p-2 rounded-xl border border-stone-200"
                                >
                                  <span className="text-xs font-semibold text-stone-800">{ch.name}</span>
                                  <div className="w-36">
                                    <CurrencyInput
                                      value={val}
                                      onChange={(v) => {
                                        const valStr = String(v)
                                        setForm((prev) => ({
                                          ...prev,
                                          channel_prices: {
                                            ...prev.channel_prices,
                                            [slug]: valStr,
                                          },
                                        }))
                                      }}
                                    />
                                  </div>
                                </div>
                              )
                            })}
                        </div>
                      )}
                    </div>

                    {/* SukaShawarma APP Price */}
                    <div className="pt-2 border-t border-amber-200/50">
                      <CurrencyInput
                        label="Harga Khusus SukaShawarma APP"
                        value={form.channel_prices[SLUG_APLIKASI] || form.price}
                        onChange={(v) => {
                          const valStr = String(v)
                          setForm((prev) => ({
                            ...prev,
                            channel_prices: {
                              ...prev.channel_prices,
                              [SLUG_APLIKASI]: valStr,
                            },
                          }))
                        }}
                        placeholder={form.price || '0'}
                      />
                      <p className="text-[10px] text-stone-500 mt-1">
                        Harga pemesanan oleh pelanggan melalui aplikasi mobile SukaShawarma.
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Modal Actions */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-stone-100">
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="px-4 py-2.5 rounded-xl border border-stone-200 text-stone-600 hover:bg-stone-50 font-bold text-xs sm:text-sm transition-colors cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 active:bg-amber-700 text-white font-bold text-xs sm:text-sm shadow-sm transition-all cursor-pointer disabled:opacity-50"
                >
                  {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                  <span>{saving ? 'Menyimpan...' : form.id ? 'Simpan Perubahan' : 'Tambah Menu'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Toast Notifications ──────────────────────────────── */}
      {toast && (
        <div
          className={cn(
            'fixed bottom-6 right-6 z-50 flex items-center gap-2.5 px-4 py-3 rounded-2xl shadow-xl font-bold text-xs sm:text-sm animate-in fade-in slide-in-from-bottom-4',
            toast.type === 'success' ? 'bg-stone-900 text-white' : 'bg-red-600 text-white'
          )}
        >
          {toast.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          ) : (
            <AlertCircle className="w-4 h-4 text-white" />
          )}
          <span>{toast.message}</span>
        </div>
      )}
    </div>
  )
}
