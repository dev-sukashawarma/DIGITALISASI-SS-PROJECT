'use client'

import { useState, useRef, useMemo, useEffect, useDeferredValue } from 'react'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import {
  Plus, Pencil, Trash2, X, Loader2, Copy,
  AlertCircle, UploadCloud, Sandwich, ToggleLeft, ToggleRight,
  FileArchive, Search, MoreVertical, Check, ArrowUpDown, ChevronUp, ChevronDown
} from 'lucide-react'
import { createClient } from '@/lib/supabase'
import { CurrencyInput } from '@suka/design-system'
import { formatRupiah } from '@/lib/validations'
import type { MenuItem, Category, SalesChannel, Outlet } from '@/pos-types'
import ZipUploadModal from '@/components/ZipUploadModal'
import { useDialogStore } from '@/lib/dialogStore'
import { MenuPicker } from './MenuPicker'
import { saveMenuItem, toggleMenuAvailability, deleteMenuItem, deleteAllMenuItems, toggleGlobalSetting } from './actions'

const BUCKET = 'menu-images'

const CHANNEL_THEME_CLASSES: Record<string, { selected: string; row: string; badge: string; badgeSelected: string }> = {
  gray:    { selected: 'bg-gray-900 text-white',    row: 'hover:bg-gray-50 text-gray-700',       badge: 'bg-gray-100 text-gray-500',       badgeSelected: 'bg-white/15 text-white' },
  amber:   { selected: 'bg-amber-600 text-white',   row: 'hover:bg-amber-50 text-amber-900',     badge: 'bg-amber-50 text-amber-700',      badgeSelected: 'bg-white/15 text-white' },
  orange:  { selected: 'bg-orange-600 text-white',  row: 'hover:bg-orange-50 text-orange-900',   badge: 'bg-orange-50 text-orange-700',    badgeSelected: 'bg-white/15 text-white' },
  slate:   { selected: 'bg-slate-950 text-white',   row: 'hover:bg-slate-50 text-slate-900',     badge: 'bg-slate-100 text-slate-600',     badgeSelected: 'bg-white/15 text-white' },
  emerald: { selected: 'bg-emerald-600 text-white', row: 'hover:bg-emerald-50 text-emerald-900', badge: 'bg-emerald-50 text-emerald-700',  badgeSelected: 'bg-white/15 text-white' },
  green:   { selected: 'bg-green-600 text-white',   row: 'hover:bg-green-50 text-green-900',     badge: 'bg-green-50 text-green-700',      badgeSelected: 'bg-white/15 text-white' },
}

interface FormState {
  id: string | null
  name: string
  description: string
  price: string
  strike_price: string
  base_price: string
  channel_prices: Record<string, string>
  category_id: string
  is_available: boolean
  is_available_online: boolean
  available_online_channels: string[] | null
  image_url: string | null
  is_package: boolean
  package_items: { menu_item_id: string, or_menu_item_id?: string | null, quantity: number, temp_id: string }[]
  outlet_ids: string[] | null
}

const EMPTY: FormState = {
  id: null, name: '', description: '', price: '', strike_price: '', base_price: '',
  channel_prices: {},
  category_id: '', is_available: true, is_available_online: true, available_online_channels: null, image_url: null,
  is_package: false, package_items: [], outlet_ids: null
}

async function deleteStorageImage(url: string) {
  try {
    const supabase = createClient()
    const marker = `/object/public/${BUCKET}/`
    const idx = url.indexOf(marker)
    if (idx === -1) return
    const path = decodeURIComponent(url.slice(idx + marker.length).split('?')[0])
    await supabase.storage.from(BUCKET).remove([path])
  } catch { /* non-fatal */ }
}

interface MenuViewProps {
  initialItems: MenuItem[]
  initialCategories: Category[]
  initialChannels: SalesChannel[]
  initialOutlets?: Outlet[]
  initialUpsells?: string[]
  initialBestsellers?: string[]
  initialRecommendations?: string[]
  searchQuery?: string
}

export default function MenuView({ 
  initialItems = [], 
  initialCategories = [], 
  initialChannels = [], 
  initialOutlets = [],
  initialUpsells = [], 
  initialBestsellers = [], 
  initialRecommendations = [],
  searchQuery = ''
}: MenuViewProps) {
  const router = useRouter()

  const { showConfirm } = useDialogStore()
  const [form, setForm]           = useState<FormState>(EMPTY)
  const [showForm, setShowForm]   = useState(false)
  const [saving, setSaving]       = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error, setError]         = useState('')
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [preview, setPreview]     = useState<string | null>(null)
  const [showZipModal, setShowZipModal] = useState(false)
  const [deletingAll, setDeletingAll]   = useState(false)
  const [upsells, setUpsells] = useState<string[]>(initialUpsells || [])
  const [bestsellers, setBestsellers] = useState<string[]>(initialBestsellers || [])
  const [recommendations, setRecommendations] = useState<string[]>(initialRecommendations || [])
  const [openDropdownId, setOpenDropdownId] = useState<string | null>(null)
  const [activeChannelFilter, setActiveChannelFilter] = useState<string>('')
  const [channelDropdownOpen, setChannelDropdownOpen] = useState(false)
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' } | null>(null)
  const [outletSearch, setOutletSearch] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)
  const channelDropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (channelDropdownRef.current && !channelDropdownRef.current.contains(e.target as Node)) {
        setChannelDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const getSlug = (channelId: string) => {
    if (!channelId) return ''
    if (channelId === 'pos_kasir') return 'pos_kasir'
    if (channelId === 'all_food_apps') return 'all_food_apps'
    const ch = initialChannels.find(c => c.id === channelId || c.name.toLowerCase().replace(/\s+/g, '') === channelId.toLowerCase().replace(/\s+/g, ''))
    const raw = ch ? ch.name : channelId
    const slug = raw.toLowerCase().replace(/\s+/g, '')
    if (slug === 'tiktokgo' || slug === 'tiktok_go') return 'tiktokgo'
    return slug
  }

  const isItemInChannel = useMemo(() => {
    return (item: MenuItem, channelKey: string) => {
      if (!channelKey || channelKey === 'all') return true
      
      if (channelKey === 'pos_kasir') {
        return item.is_available !== false
      }

      if (channelKey === 'all_food_apps') {
        if (item.is_available_online === false) return false
        const hasPrices = item.channel_prices && Object.keys(item.channel_prices).length > 0
        const hasChannels = item.available_online_channels && item.available_online_channels.length > 0
        return Boolean(hasPrices || hasChannels || item.is_available_online)
      }

      const targetSlug = getSlug(channelKey)
      if (item.is_available_online === false) return false

      // 1. Check if item has a channel price set for this channel
      const channelPrice = item.channel_prices?.[targetSlug] || (targetSlug === 'tiktokgo' ? item.channel_prices?.tiktok_go : undefined)
      const hasSpecificPrice = channelPrice !== undefined && channelPrice !== null && Number(channelPrice) > 0

      // 2. Check if item explicitly lists this channel in available_online_channels
      let hasExplicitChannel = false
      if (item.available_online_channels !== null && Array.isArray(item.available_online_channels)) {
        hasExplicitChannel = item.available_online_channels.some(
          c => c.toLowerCase().replace(/\s+/g, '') === targetSlug || (targetSlug === 'tiktokgo' && (c === 'tiktokgo' || c === 'tiktok_go'))
        )
      }

      // STRICT FILTER: If specific food app (e.g. TikTok Go), MUST have specific price or explicit channel assignment!
      return hasSpecificPrice || hasExplicitChannel
    }
  }, [initialChannels])

  const channelOptions = useMemo(() => {
    const opts: Array<{ key: string; label: string; count: number; icon: string; theme: string }> = [
      { key: '', label: 'Semua Menu', count: initialItems.length, icon: '🍽️', theme: 'gray' },
      { key: 'pos_kasir', label: 'POS Kasir Toko', count: initialItems.filter(i => isItemInChannel(i, 'pos_kasir')).length, icon: '🏪', theme: 'amber' },
      { key: 'all_food_apps', label: 'Semua Food Apps', count: initialItems.filter(i => isItemInChannel(i, 'all_food_apps')).length, icon: '🛵', theme: 'orange' },
    ]

    initialChannels.forEach(ch => {
      const slug = ch.name.toLowerCase().replace(/\s+/g, '')
      let icon = '📱'
      let theme = 'gray'
      if (slug.includes('tiktok')) { icon = '🎵'; theme = 'slate' }
      else if (slug.includes('gofood')) { icon = '🟢'; theme = 'emerald' }
      else if (slug.includes('grabfood')) { icon = '🟢'; theme = 'green' }
      else if (slug.includes('shopee')) { icon = '🧡'; theme = 'orange' }

      opts.push({
        key: ch.id,
        label: `Khusus ${ch.name}`,
        count: initialItems.filter(i => isItemInChannel(i, ch.id)).length,
        icon,
        theme,
      })
    })

    return opts
  }, [initialItems, initialChannels, isItemInChannel])

  const selectedChannelOption = channelOptions.find(o => o.key === activeChannelFilter) ?? channelOptions[0]

  const [searchVal, setSearchVal] = useState(searchQuery)
  const deferredSearch = useDeferredValue(searchVal)

  const sortedItems = useMemo(() => {
    let sortableItems = [...initialItems];

    if (deferredSearch) {
      sortableItems = sortableItems.filter(item => 
        item.name.toLowerCase().includes(deferredSearch.toLowerCase())
      );
    }

    if (activeChannelFilter) {
      sortableItems = sortableItems.filter(item => isItemInChannel(item, activeChannelFilter));
    }

    if (sortConfig !== null) {
      sortableItems.sort((a, b) => {
        let aValue: any;
        let bValue: any;

        if (sortConfig.key === 'name') {
          aValue = a.name.toLowerCase();
          bValue = b.name.toLowerCase();
        } else if (sortConfig.key === 'category') {
          aValue = a.categories?.name?.toLowerCase() || '';
          bValue = b.categories?.name?.toLowerCase() || '';
        } else if (sortConfig.key === 'price') {
          if (activeChannelFilter && !['pos_kasir', 'all_food_apps'].includes(activeChannelFilter)) {
            const slug = getSlug(activeChannelFilter);
            aValue = a.channel_prices?.[slug] || a.price;
            bValue = b.channel_prices?.[slug] || b.price;
          } else {
            aValue = a.price;
            bValue = b.price;
          }
        } else if (sortConfig.key === 'status') {
          aValue = a.is_available ? 1 : 0;
          bValue = b.is_available ? 1 : 0;
        }

        if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
        if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }
    return sortableItems;
  }, [initialItems, sortConfig, activeChannelFilter, searchQuery, isItemInChannel]);

  const requestSort = (key: string) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const getSortIcon = (columnName: string) => {
    if (!sortConfig || sortConfig.key !== columnName) {
      return <ArrowUpDown className="w-3.5 h-3.5 text-gray-300 ml-1.5 inline-block opacity-0 group-hover:opacity-100 transition-opacity" />;
    }
    if (sortConfig.direction === 'asc') {
      return <ChevronUp className="w-3.5 h-3.5 text-amber-500 ml-1.5 inline-block" />;
    }
    return <ChevronDown className="w-3.5 h-3.5 text-amber-500 ml-1.5 inline-block" />;
  };

  function resetImage() {
    setImageFile(null)
    setPreview(null)
    if (fileRef.current) fileRef.current.value = ''
  }

  function openAdd() {
    setForm({ ...EMPTY, category_id: initialCategories[0]?.id ?? '' })
    setOutletSearch('')
    resetImage(); setError(''); setShowForm(true)
  }

  function openEdit(item: MenuItem) {
    const formattedChannelPrices: Record<string, string> = {}
    if (item.channel_prices) {
      Object.entries(item.channel_prices).forEach(([k, v]) => {
        formattedChannelPrices[k] = String(v)
      })
    }
    
    let displayPrice = String(item.price)
    if (activeChannelFilter) {
      const slug = getSlug(activeChannelFilter)
      displayPrice = formattedChannelPrices[slug] || String(item.price)
    }
    
    setForm({
      id: item.id, name: item.name, description: item.description ?? '',
      price: displayPrice, 
      strike_price: item.strike_price ? String(item.strike_price) : '',
      base_price: String(item.price),
      channel_prices: formattedChannelPrices,
      category_id: item.category_id ?? '',
      is_available: item.is_available, 
      is_available_online: item.is_available_online ?? true,
      available_online_channels: item.available_online_channels ?? null,
      image_url: item.image_url,
      is_package: item.is_package ?? false,
      package_items: item.package_items?.map(pi => ({ menu_item_id: pi.menu_item_id, or_menu_item_id: pi.or_menu_item_id, quantity: pi.quantity, temp_id: Math.random().toString() })) || [],
      outlet_ids: (item as any).available_outlets ? (item as any).available_outlets : (item.outlet_id ? [item.outlet_id] : null)
    })
    setOutletSearch('')
    resetImage(); setError(''); setShowForm(true)
  }

  function openDuplicate(item: MenuItem) {
    const formattedChannelPrices: Record<string, string> = {}
    if (item.channel_prices) {
      Object.entries(item.channel_prices).forEach(([k, v]) => {
        formattedChannelPrices[k] = String(v)
      })
    }
    
    setForm({
      id: '', 
      name: `${item.name} (Copy)`, 
      description: item.description ?? '',
      price: String(item.price), 
      strike_price: item.strike_price ? String(item.strike_price) : '',
      base_price: String(item.price),
      channel_prices: formattedChannelPrices,
      category_id: item.category_id ?? '',
      is_available: item.is_available, 
      is_available_online: item.is_available_online ?? true,
      available_online_channels: item.available_online_channels ?? null,
      image_url: item.image_url,
      is_package: item.is_package ?? false,
      package_items: item.package_items?.map(pi => ({ menu_item_id: pi.menu_item_id, or_menu_item_id: pi.or_menu_item_id, quantity: pi.quantity, temp_id: Math.random().toString() })) || [],
      outlet_ids: (item as any).available_outlets ? (item as any).available_outlets : (item.outlet_id ? [item.outlet_id] : null)
    })
    setOutletSearch('')
    resetImage(); setError(''); setShowForm(true)
  }

  function closeForm() { setShowForm(false); resetImage(); setError('') }

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 5 * 1024 * 1024) { setError('Ukuran foto maksimal 5 MB'); return }
    if (!['image/jpeg','image/jpg','image/png','image/webp'].includes(file.type)) {
      setError('Format harus JPG, PNG, atau WebP'); return
    }
    setError('')
    setImageFile(file)
    setPreview(URL.createObjectURL(file))
  }

  async function uploadImage(file: File): Promise<string | null> {
    setUploading(true)
    const supabase = createClient()
    const ext = file.name.split('.').pop()?.toLowerCase() ?? 'jpg'
    const name = `${Date.now()}-${crypto.randomUUID().slice(0,8)}.${ext}`
    const { error: err } = await supabase.storage.from(BUCKET).upload(name, file, { contentType: file.type })
    setUploading(false)
    if (err) { setError(`Upload gagal: ${err.message}`); return null }
    return supabase.storage.from(BUCKET).getPublicUrl(name).data.publicUrl
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault(); setError('')
    const price = parseFloat(form.price)
    if (!form.name.trim()) { setError('Nama menu wajib diisi'); return }
    if (isNaN(price) || price <= 0) { setError('Harga harus angka positif'); return }

    setSaving(true)
    let imgUrl = form.image_url

    if (imageFile) {
      if (form.id && form.image_url) await deleteStorageImage(form.image_url)
      imgUrl = await uploadImage(imageFile)
      if (!imgUrl) { setSaving(false); return }
    }

    let finalBasePrice = parseFloat(form.base_price) || price
    const parsedChannelPrices: Record<string, number> = {}
    
    Object.entries(form.channel_prices).forEach(([k, v]) => {
      if (v) {
        const p = parseFloat(v)
        if (!isNaN(p) && p > 0) parsedChannelPrices[k] = p
      }
    })

    if (activeChannelFilter) {
      const slug = getSlug(activeChannelFilter)
      if (price === finalBasePrice || price <= 0) {
        delete parsedChannelPrices[slug]
      } else {
        parsedChannelPrices[slug] = price
      }
    } else {
      finalBasePrice = price
    }

    const payload = {
      id: form.id ?? undefined,
      name: form.name.trim(), description: form.description.trim() || null,
      price: finalBasePrice, 
      strike_price: form.strike_price ? parseFloat(form.strike_price) : null,
      category_id: form.category_id || null,
      is_available: form.is_available, is_available_online: form.is_available_online, available_online_channels: form.available_online_channels, image_url: imgUrl,
      channel_prices: parsedChannelPrices,
      is_package: form.is_package,
      package_items_to_save: form.is_package ? form.package_items.map(pi => ({ menu_item_id: pi.menu_item_id, or_menu_item_id: pi.or_menu_item_id, quantity: pi.quantity })) : [],
      outlet_id: form.outlet_ids && form.outlet_ids.length === 1 ? form.outlet_ids[0] : null,
      available_outlets: form.outlet_ids
    }

    try {
      await saveMenuItem(payload as any)
      closeForm()
    } catch (err: any) {
      setError(err.message)
    }
    setSaving(false)
  }

  async function toggleAvail(item: MenuItem) {
    await toggleMenuAvailability(item.id, item.is_available)
  }

  async function deleteItem(item: MenuItem) {
    const confirmed = await showConfirm(`Hapus "${item.name}"?`);
    if (!confirmed) return
    await deleteMenuItem(item.id, item.image_url)
  }

  async function toggleSetting(type: 'upsell' | 'bestseller' | 'recommendation', item: MenuItem) {
    let current: string[] = []
    let setter: any = null
    let key = ''
    if (type === 'upsell') { current = upsells; setter = setUpsells; key = 'upsell_ids' }
    if (type === 'bestseller') { current = bestsellers; setter = setBestsellers; key = 'bestseller_ids' }
    if (type === 'recommendation') { current = recommendations; setter = setRecommendations; key = 'recommendation_ids' }
    
    const isIncluded = current.includes(item.id)
    const newIds = isIncluded ? current.filter(id => id !== item.id) : [...current, item.id]
    
    setter(newIds)
    try {
      await toggleGlobalSetting(key, newIds)
    } catch (e) {
      setter(current)
      alert('Gagal menyimpan pengaturan')
    }
  }

  async function deleteAllItems() {
    if (initialItems.length === 0) return
    const confirmed1 = await showConfirm(`Hapus SEMUA ${initialItems.length} menu? Tindakan ini tidak bisa dibatalkan.`);
    if (!confirmed1) return
    const confirmed2 = await showConfirm('Yakin? Semua data menu dan foto akan dihapus permanen.');
    if (!confirmed2) return

    setDeletingAll(true)
    await deleteAllMenuItems(initialItems)
    setDeletingAll(false)
  }

  const displayImage = preview ?? form.image_url

  

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Manajemen Menu</h1>
          <p className="text-gray-400 text-sm mt-0.5">{sortedItems.length} menu ditampilkan ({initialItems.length} total)</p>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Search Input */}
          <div className="relative w-full sm:w-auto sm:min-w-[220px]">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="h-4 w-4 text-gray-400" />
            </div>
            <input
              type="text"
              className="block w-full pl-9 pr-3 py-2.5 border border-gray-200 rounded-2xl leading-5 bg-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-amber-500 transition-colors text-sm"
              placeholder="Cari menu..."
              value={searchVal}
              onChange={(e) => setSearchVal(e.target.value)}
            />
          </div>

          <button
            onClick={() => setShowZipModal(true)}
            className="py-2.5 px-5 text-sm font-semibold rounded-2xl flex items-center gap-2
              bg-violet-600 text-white hover:bg-violet-700
              transition-all duration-200 active:scale-[.98]"
          >
            <FileArchive className="w-4 h-4" />
            Import ZIP
          </button>
          <button
            onClick={deleteAllItems}
            disabled={deletingAll || initialItems.length === 0}
            className="py-2.5 px-5 text-sm font-semibold rounded-2xl flex items-center gap-2
              bg-red-50 text-red-500 hover:bg-red-100 disabled:opacity-50 disabled:cursor-not-allowed
              transition-all duration-200 active:scale-[.98]"
          >
            {deletingAll
              ? <Loader2 className="w-4 h-4 animate-spin" />
              : <Trash2 className="w-4 h-4" />}
            Hapus Semua
          </button>
          <button onClick={openAdd} className="btn-primary py-2.5 px-5 text-sm">
            <Plus className="w-4 h-4" />
            Tambah Menu
          </button>
        </div>
      </div>

      {/* Channel Filter Dropdown (custom, non-native) */}
      <div className="bg-white p-3 rounded-2xl border border-gray-100 shadow-xs flex flex-wrap items-center gap-3">
        <span className="text-xs font-bold text-gray-400 uppercase tracking-wider px-2">Filter Channel:</span>

        <div className="relative" ref={channelDropdownRef}>
          <button
            type="button"
            onClick={() => setChannelDropdownOpen(o => !o)}
            aria-haspopup="listbox"
            aria-expanded={channelDropdownOpen}
            className="flex items-center gap-3 bg-gray-50 border border-gray-200 rounded-xl pl-3.5 pr-3 py-2 min-w-[260px] justify-between hover:bg-gray-100 transition-all cursor-pointer"
          >
            <span className="flex items-center gap-2 text-xs font-bold text-gray-800">
              <span>{selectedChannelOption.icon}</span>
              <span>{selectedChannelOption.label}</span>
              <span className="text-gray-400 font-semibold">({selectedChannelOption.count})</span>
            </span>
            {channelDropdownOpen
              ? <ChevronUp className="w-4 h-4 text-gray-400 flex-shrink-0" />
              : <ChevronDown className="w-4 h-4 text-gray-400 flex-shrink-0" />}
          </button>

          {channelDropdownOpen && (
            <div
              role="listbox"
              className="absolute z-20 mt-2 w-full min-w-[280px] bg-white rounded-2xl border border-gray-100 shadow-lg py-1.5 max-h-80 overflow-y-auto animate-in fade-in slide-in-from-top-2 duration-150"
            >
              {channelOptions.map(opt => {
                const isSelected = activeChannelFilter === opt.key
                const theme = CHANNEL_THEME_CLASSES[opt.theme] ?? CHANNEL_THEME_CLASSES.gray
                return (
                  <button
                    key={opt.key || 'all'}
                    type="button"
                    role="option"
                    aria-selected={isSelected}
                    onClick={() => { setActiveChannelFilter(opt.key); setChannelDropdownOpen(false) }}
                    className={`w-full flex items-center justify-between gap-3 px-4 py-2.5 text-xs font-bold transition-colors cursor-pointer ${
                      isSelected ? theme.selected : theme.row
                    }`}
                  >
                    <span className="flex items-center gap-2.5">
                      <span>{opt.icon}</span>
                      <span>{opt.label}</span>
                    </span>
                    <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${isSelected ? theme.badgeSelected : theme.badge}`}>
                      {opt.count}
                    </span>
                  </button>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {showForm && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 sm:p-6"
          onClick={(e) => { if (e.target === e.currentTarget) closeForm() }}
        >
          <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-4xl flex flex-col max-h-[92vh] animate-scale-in overflow-hidden border border-gray-100">
            {/* Sticky header */}
            <div className="flex items-center justify-between px-8 py-6 border-b border-gray-100 flex-shrink-0 bg-white/80 backdrop-blur-md z-10">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 bg-gradient-to-br from-amber-100 to-amber-50 rounded-2xl flex items-center justify-center shadow-inner border border-amber-200/50">
                  <Sandwich className="w-7 h-7 text-amber-500" strokeWidth={1.5} />
                </div>
                <div>
                  <h2 className="font-extrabold text-2xl text-gray-900 tracking-tight">
                    {form.id ? 'Edit Menu' : 'Tambah Menu Baru'}
                  </h2>
                  <p className="text-sm font-medium text-gray-500 mt-1">
                    {form.id ? 'Perbarui data menu' : 'Isi detail menu baru'}
                  </p>
                </div>
              </div>
              <button onClick={closeForm}
                className="w-11 h-11 bg-gray-50 hover:bg-red-50 hover:text-red-500 rounded-full flex items-center justify-center text-gray-400 transition-all duration-200 border border-gray-100 hover:border-red-100">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Scrollable body */}
            <form onSubmit={handleSave} className="flex flex-col flex-1 overflow-hidden bg-[#F9FAFB]">
              <div className="overflow-y-auto flex-1 px-8 py-8">
                
                {/* Error */}
                {error && (
                  <div className="mb-6 flex items-center gap-3 bg-red-50 border border-red-100 rounded-2xl p-4 text-red-600 text-sm shadow-sm animate-shake">
                    <AlertCircle className="w-5 h-5 flex-shrink-0" />
                    <span className="font-medium">{error}</span>
                  </div>
                )}

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  {/* Left Column */}
                  <div className="space-y-6">
                    {/* Photo Upload */}
                    <div className="bg-white p-6 rounded-[1.5rem] border border-gray-100 shadow-sm">
                      <label className="input-label mb-3 block text-gray-700 font-bold">Foto Produk</label>
                      <div 
                        className={`relative border-2 border-dashed rounded-2xl transition-all duration-200 group cursor-pointer overflow-hidden flex flex-col items-center justify-center min-h-[220px]
                          ${displayImage ? 'border-transparent bg-gray-900 shadow-inner' : 'border-gray-200 bg-gray-50/50 hover:bg-amber-50/30 hover:border-amber-300'}`}
                        onClick={() => fileRef.current?.click()}
                      >
                        {displayImage ? (
                          <>
                            <Image src={displayImage} alt="Preview" fill className="object-cover opacity-90 group-hover:opacity-40 transition-opacity duration-300" unoptimized={true} />
                            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 opacity-0 group-hover:opacity-100 transition-opacity duration-300 z-10">
                              <div className="w-12 h-12 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center">
                                <UploadCloud className="w-6 h-6 text-white" />
                              </div>
                              <span className="text-white text-sm font-semibold drop-shadow-md">Ganti Foto</span>
                            </div>
                            {preview && (
                              <span className="absolute top-4 left-4 bg-amber-500 text-white text-xs font-bold px-3 py-1.5 rounded-lg leading-none shadow-lg z-20 flex items-center gap-1.5">
                                <div className="w-1.5 h-1.5 rounded-full bg-white animate-pulse"></div>
                                BARU
                              </span>
                            )}
                          </>
                        ) : (
                          <div className="flex flex-col items-center gap-4 text-gray-400 p-8">
                            <div className="w-16 h-16 rounded-[1.25rem] bg-amber-50 flex items-center justify-center group-hover:scale-110 group-hover:bg-amber-100 transition-all duration-300 border border-amber-100/50 group-hover:border-amber-200 group-hover:shadow-sm">
                              <UploadCloud className="w-8 h-8 text-amber-500" />
                            </div>
                            <div className="text-center">
                              <p className="text-base font-bold text-gray-700 mb-1.5 group-hover:text-amber-600 transition-colors">Klik untuk upload foto</p>
                              <p className="text-xs text-gray-400 font-medium">Format: JPG, PNG, WebP (Maks. 5MB)</p>
                            </div>
                          </div>
                        )}
                      </div>
                      {displayImage && (
                        <div className="mt-4 flex justify-end">
                          <button type="button" onClick={(e) => { e.stopPropagation(); preview ? resetImage() : setForm(p => ({ ...p, image_url: null })) }} className="text-red-500 text-sm flex items-center gap-2 font-bold hover:text-red-600 transition-colors bg-red-50/50 hover:bg-red-50 px-4 py-2 rounded-xl border border-transparent hover:border-red-100">
                            <Trash2 className="w-4 h-4" /> Hapus Foto
                          </button>
                        </div>
                      )}
                      <input ref={fileRef} type="file" accept="image/jpeg,image/jpg,image/png,image/webp" className="hidden" onChange={handleFile} />
                    </div>

                    <div className="bg-white p-6 rounded-[1.5rem] border border-gray-100 shadow-sm space-y-6">
                      {/* Name */}
                      <div>
                        <label className="input-label text-gray-700 font-bold mb-2 block">Nama Menu <span className="text-red-500">*</span></label>
                        <input type="text" value={form.name}
                          onChange={(e) => setForm({ ...form, name: e.target.value })}
                          required maxLength={100} className="input bg-gray-50 focus:bg-white text-base py-3" placeholder="Cth: Chicken Shawarma" autoFocus />
                      </div>

                      {/* Description */}
                      <div>
                        <label className="input-label text-gray-700 font-bold mb-2 block flex items-center justify-between">
                          <span>Deskripsi</span>
                          <span className="text-gray-400 font-medium text-xs bg-gray-100 px-2 py-1 rounded-md">Opsional</span>
                        </label>
                        <textarea value={form.description}
                          onChange={(e) => setForm({ ...form, description: e.target.value })}
                          maxLength={300} rows={3} className="input resize-none bg-gray-50 focus:bg-white text-base py-3"
                          placeholder="Deskripsi singkat yang menggugah selera..." />
                      </div>
                    </div>
                  </div>

                  {/* Right Column */}
                  <div className="space-y-6">
                    <div className="bg-white p-6 rounded-[1.5rem] border border-gray-100 shadow-sm space-y-6">
                      {/* Price & Category */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                        <div>
                          <label className="input-label text-gray-700 font-bold mb-2 block">
                            {activeChannelFilter 
                              ? `Harga ${initialChannels.find(c => c.id === activeChannelFilter)?.name || ''}` 
                              : 'Harga Dasar'}
                            <span className="text-red-500 ml-1">*</span>
                          </label>
                          <CurrencyInput value={form.price}
                            onChange={(v) => setForm({ ...form, price: String(v) })}
                            required className="input bg-gray-50 focus:bg-white font-bold text-gray-900 text-base py-3" />
                        </div>
                        <div>
                          <label className="input-label text-gray-700 font-bold mb-2 block">
                            Harga Coret
                            <span className="text-gray-400 font-medium text-xs ml-2 bg-gray-100 px-2 py-0.5 rounded-md">Opsional</span>
                          </label>
                          <CurrencyInput value={form.strike_price}
                            onChange={(v) => setForm({ ...form, strike_price: String(v) })}
                            className="input bg-gray-50 focus:bg-white text-gray-900 text-base py-3" />
                        </div>
                        <div>
                          <label className="input-label text-gray-700 font-bold mb-2 block">Kategori</label>
                          <select value={form.category_id}
                            onChange={(e) => setForm({ ...form, category_id: e.target.value })}
                            className="input bg-gray-50 focus:bg-white text-base py-3 font-medium">
                            <option value="">-- Pilih Kategori --</option>
                            {initialCategories.map((c) => (
                              <option key={c.id} value={c.id}>{c.name}</option>
                            ))}
                          </select>
                        </div>
                      </div>

                      {/* Menu Type Toggle */}
                      <div>
                        <label className="input-label mb-2 block text-gray-700 font-bold">Tipe Menu</label>
                        <div className="flex bg-gray-100/80 p-1.5 rounded-[1.25rem]">
                          <button type="button" 
                            onClick={() => setForm({ ...form, is_package: false })}
                            className={`flex-1 py-2.5 text-sm font-bold rounded-xl transition-all duration-200 ${!form.is_package ? 'bg-white shadow text-gray-900 scale-[1.02]' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-200/50'}`}>
                            Satuan
                          </button>
                          <button type="button" 
                            onClick={() => setForm({ ...form, is_package: true })}
                            className={`flex-1 py-2.5 text-sm font-bold rounded-xl transition-all duration-200 ${form.is_package ? 'bg-white shadow text-gray-900 scale-[1.02]' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-200/50'}`}>
                            Paket (Combo)
                          </button>
                        </div>
                      </div>

                      {/* Package Builder */}
                      {form.is_package && (
                        <div className="space-y-4 p-5 bg-amber-50/60 rounded-[1.25rem] border border-amber-100/60 animate-in fade-in slide-in-from-top-2 duration-300">
                          <label className="input-label text-amber-900 font-bold flex items-center justify-between mb-1">
                            <span>Isi Paket</span>
                            <span className="text-xs font-semibold text-amber-700 bg-amber-200/50 px-2.5 py-1 rounded-full">{form.package_items.length} item</span>
                          </label>
                          
                          <div className="space-y-3">
                            {form.package_items.map((pi, idx) => (
                              <div key={pi.temp_id} className="flex gap-3 items-center bg-white p-3 rounded-xl border border-amber-100 shadow-sm">
                                <div className="flex-1 space-y-3">
                                  <div className="flex items-center gap-3">
                                    <div className="flex-1">
                                      <MenuPicker 
                                        value={pi.menu_item_id}
                                        items={initialItems.filter(i => !i.is_package && i.id !== form.id)}
                                        onChange={(val) => {
                                          const newItems = [...form.package_items];
                                          newItems[idx].menu_item_id = val;
                                          
                                          let newBasePrice = 0;
                                          newItems.forEach(item => {
                                            const m = initialItems.find(x => x.id === item.menu_item_id);
                                            if (m) newBasePrice += (m.price * item.quantity);
                                          });
                                          
                                          setForm({ ...form, package_items: newItems, price: String(newBasePrice) });
                                        }}
                                      />
                                    </div>
                                  </div>
                                  
                                  {pi.or_menu_item_id !== undefined && pi.or_menu_item_id !== null && (
                                    <div className="flex items-center gap-3 pl-4 border-l-2 border-amber-200 animate-in fade-in slide-in-from-top-2 duration-300">
                                      <span className="text-xs font-bold text-amber-500 uppercase tracking-widest shrink-0">ATAU</span>
                                      <div className="flex-1">
                                        <MenuPicker 
                                          value={pi.or_menu_item_id || ''}
                                          items={initialItems.filter(i => !i.is_package && i.id !== form.id)}
                                          onChange={(val) => {
                                            const newItems = [...form.package_items];
                                            newItems[idx].or_menu_item_id = val;
                                            setForm({ ...form, package_items: newItems });
                                          }}
                                        />
                                      </div>
                                      <button type="button" onClick={() => {
                                          const newItems = [...form.package_items];
                                          newItems[idx].or_menu_item_id = null;
                                          setForm({ ...form, package_items: newItems });
                                      }} className="w-10 h-10 shrink-0 bg-gray-50 rounded-lg flex items-center justify-center text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors">
                                        <X className="w-4 h-4" />
                                      </button>
                                    </div>
                                  )}
                                  
                                  {(pi.or_menu_item_id === undefined || pi.or_menu_item_id === null) && (
                                    <button type="button" onClick={() => {
                                        const newItems = [...form.package_items];
                                        newItems[idx].or_menu_item_id = '';
                                        setForm({ ...form, package_items: newItems });
                                    }} className="text-xs font-bold text-amber-600 hover:text-amber-700 flex items-center gap-1 mt-1 pl-1">
                                      <Plus className="w-3 h-3" /> Tambah Opsi Atau
                                    </button>
                                  )}
                                </div>
                                <div className="w-24">
                                  <input type="number" min="1" className="input text-center px-2 bg-gray-50 py-2.5 font-bold" 
                                    value={pi.quantity}
                                    onChange={(e) => {
                                      const qty = parseInt(e.target.value) || 1;
                                      const newItems = [...form.package_items];
                                      newItems[idx].quantity = qty;

                                      let newBasePrice = 0;
                                      newItems.forEach(item => {
                                        const m = initialItems.find(x => x.id === item.menu_item_id);
                                        if (m) newBasePrice += (m.price * item.quantity);
                                      });

                                      setForm({ ...form, package_items: newItems, price: String(newBasePrice) });
                                    }}
                                  />
                                </div>
                                <button type="button" onClick={() => {
                                  const newItems = form.package_items.filter((_, i) => i !== idx);
                                  
                                  let newBasePrice = 0;
                                  newItems.forEach(item => {
                                    const m = initialItems.find(x => x.id === item.menu_item_id);
                                    if (m) newBasePrice += (m.price * item.quantity);
                                  });

                                  setForm({ ...form, package_items: newItems, price: String(newBasePrice) });
                                }} className="w-11 h-11 shrink-0 bg-red-50 rounded-xl flex items-center justify-center text-red-500 hover:bg-red-100 hover:text-red-600 transition-colors border border-transparent hover:border-red-200">
                                  <Trash2 className="w-5 h-5" />
                                </button>
                              </div>
                            ))}
                          </div>

                          <button type="button" onClick={() => {
                            setForm({ ...form, package_items: [...form.package_items, { menu_item_id: '', quantity: 1, temp_id: Math.random().toString() }] })
                          }} className="w-full py-3 mt-3 text-sm font-bold text-amber-600 bg-amber-100/50 hover:bg-amber-100 rounded-xl flex items-center justify-center gap-2 transition-all border border-amber-200/50 border-dashed hover:border-solid hover:shadow-sm">
                            <Plus className="w-4 h-4" /> Tambah Item Paket
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Ketersediaan */}
                    <div className="bg-white p-6 rounded-[1.5rem] border border-gray-100 shadow-sm space-y-4">
                      <h3 className="text-sm font-bold text-gray-900 mb-4 flex items-center gap-2.5">
                        <div className="w-2.5 h-2.5 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]"></div>
                        Pengaturan Ketersediaan
                      </h3>

                      {/* Availability toggle */}
                      <button type="button"
                        onClick={() => setForm({ ...form, is_available: !form.is_available })}
                        className={`w-full flex items-center justify-between p-4 rounded-[1.25rem] border-2 transition-all duration-300
                          ${form.is_available
                            ? 'border-green-200 bg-green-50/40 hover:bg-green-50'
                            : 'border-gray-200 bg-gray-50 hover:border-gray-300'}`}>
                        <div className="flex items-center gap-4">
                          <div className={`w-11 h-11 rounded-xl flex items-center justify-center transition-all duration-300 shadow-sm
                            ${form.is_available ? 'bg-green-100 text-green-600' : 'bg-white border border-gray-200 text-gray-400'}`}>
                            {form.is_available
                              ? <ToggleRight className="w-7 h-7" />
                              : <ToggleLeft  className="w-7 h-7" />}
                          </div>
                          <div className="text-left">
                            <p className={`text-sm font-bold leading-none mb-1.5 ${form.is_available ? 'text-green-800' : 'text-gray-600'}`}>
                              {form.is_available ? 'Tersedia' : 'Tidak Tersedia'}
                            </p>
                            <p className="text-xs font-medium text-gray-500">
                              {form.is_available ? 'Pelanggan dapat memesan' : 'Ditandai sebagai habis'}
                            </p>
                          </div>
                        </div>
                        <div className={`w-14 h-7 rounded-full transition-all duration-300 relative flex-shrink-0 shadow-inner
                          ${form.is_available ? 'bg-green-500' : 'bg-gray-300'}`}>
                          <span className={`absolute top-1/2 -translate-y-1/2 w-5 h-5 bg-white rounded-full shadow-sm
                            transition-transform duration-300 ${form.is_available ? 'left-[calc(100%-1.5rem)]' : 'left-1'}`} />
                        </div>
                      </button>

                      {/* Outlet Assignment toggle */}
                      <div className="space-y-3 mt-4">
                        <button type="button"
                          onClick={() => {
                            const isSpecific = form.outlet_ids !== null;
                            if (isSpecific) {
                              setForm({ ...form, outlet_ids: null }); // Turn OFF -> Global
                            } else {
                              setForm({ ...form, outlet_ids: [] }); // Turn ON -> Specific
                            }
                          }}
                          className={`w-full flex items-center justify-between p-4 rounded-[1.25rem] border-2 transition-all duration-300
                            ${form.outlet_ids !== null
                              ? 'border-fuchsia-200 bg-fuchsia-50/40 hover:bg-fuchsia-50'
                              : 'border-gray-200 bg-gray-50 hover:border-gray-300'}`}>
                          <div className="flex items-center gap-4">
                            <div className={`w-11 h-11 rounded-xl flex items-center justify-center transition-all duration-300 shadow-sm
                              ${form.outlet_ids !== null ? 'bg-fuchsia-100 text-fuchsia-600' : 'bg-white border border-gray-200 text-gray-400'}`}>
                              {form.outlet_ids !== null
                                ? <ToggleRight className="w-7 h-7" />
                                : <ToggleLeft  className="w-7 h-7" />}
                            </div>
                            <div className="text-left">
                              <p className={`text-sm font-bold leading-none mb-1.5 ${form.outlet_ids !== null ? 'text-fuchsia-800' : 'text-gray-600'}`}>
                                Outlet Spesifik
                              </p>
                              <p className="text-xs font-medium text-gray-500">
                                {form.outlet_ids !== null ? 'Hanya berlaku di outlet pilihan' : 'Berlaku global di semua outlet'}
                              </p>
                            </div>
                          </div>
                          <div className={`w-14 h-7 rounded-full transition-all duration-300 relative flex-shrink-0 shadow-inner
                            ${form.outlet_ids !== null ? 'bg-fuchsia-500' : 'bg-gray-300'}`}>
                            <span className={`absolute top-1/2 -translate-y-1/2 w-5 h-5 bg-white rounded-full shadow-sm
                              transition-transform duration-300 ${form.outlet_ids !== null ? 'left-[calc(100%-1.5rem)]' : 'left-1'}`} />
                          </div>
                        </button>
                        
                        {form.outlet_ids !== null && initialOutlets.length > 0 && (
                          <div className="p-5 rounded-[1.25rem] border border-fuchsia-100 bg-fuchsia-50/30 ml-4 animate-in fade-in slide-in-from-top-2 duration-300">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
                              <p className="text-[11px] font-bold text-fuchsia-800/70 uppercase tracking-widest flex items-center gap-2.5">
                                <span className="w-1.5 h-1.5 rounded-full bg-fuchsia-400 shadow-[0_0_4px_rgba(217,70,239,0.5)]"></span>
                                Pilih Outlet: {form.outlet_ids && form.outlet_ids.length > 0 && <span className="normal-case font-semibold text-fuchsia-600 bg-fuchsia-100/50 px-2 py-0.5 rounded-md">({form.outlet_ids.length} cabang dipilih)</span>}
                              </p>
                              <div className="relative w-full sm:w-1/2">
                                <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-fuchsia-400" />
                                <input 
                                  type="text" 
                                  placeholder="Cari outlet..." 
                                  value={outletSearch} 
                                  onChange={e => setOutletSearch(e.target.value)} 
                                  className="w-full bg-white border border-fuchsia-100 rounded-lg pl-9 pr-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-fuchsia-500/20 shadow-sm" 
                                />
                              </div>
                            </div>
                            
                            {/* Selected Outlets Summary */}
                            {form.outlet_ids && form.outlet_ids.length > 0 && (
                              <div className="mb-4 p-3 bg-white/60 border border-fuchsia-100/50 rounded-xl">
                                <p className="text-xs font-semibold text-gray-500 mb-2">Menu ini akan aktif di cabang berikut:</p>
                                <div className="flex flex-wrap gap-2">
                                  {form.outlet_ids.map(id => {
                                    const out = initialOutlets.find(o => o.id === id);
                                    if (!out) return null;
                                    return (
                                      <span key={id} className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-fuchsia-100 text-fuchsia-800 text-xs font-bold rounded-lg border border-fuchsia-200 shadow-sm">
                                        {out.name}
                                        <button type="button" onClick={() => setForm({ ...form, outlet_ids: form.outlet_ids!.filter(oid => oid !== id) })} className="hover:bg-fuchsia-200 rounded-full p-0.5 transition-colors">
                                          <X className="w-3 h-3" />
                                        </button>
                                      </span>
                                    );
                                  })}
                                </div>
                              </div>
                            )}


                            <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[200px] overflow-y-auto custom-scrollbar pr-2">
                              {initialOutlets.filter(o => o.name.toLowerCase().includes(outletSearch.toLowerCase())).map(o => {
                                const isChecked = form.outlet_ids!.includes(o.id);
                                return (
                                  <label key={o.id} className={`flex items-center gap-3 cursor-pointer p-3 rounded-xl transition-all duration-200 border ${isChecked ? 'bg-fuchsia-50/80 border-fuchsia-200 shadow-sm' : 'hover:bg-white border-transparent hover:border-fuchsia-100'}`}>
                                    <div className="relative flex items-center shrink-0">
                                      <input type="checkbox" 
                                        checked={isChecked}
                                        onChange={(e) => {
                                          const curr = form.outlet_ids || [];
                                          if (e.target.checked) {
                                            setForm({ ...form, outlet_ids: [...curr, o.id] });
                                          } else {
                                            setForm({ ...form, outlet_ids: curr.filter(id => id !== o.id) });
                                          }
                                        }}
                                        className="peer sr-only" />
                                      <div className="w-5 h-5 rounded-[6px] border-[2px] border-gray-300 peer-checked:border-fuchsia-500 peer-checked:bg-fuchsia-500 transition-colors shadow-sm"></div>
                                      <div className="absolute inset-0 flex items-center justify-center opacity-0 peer-checked:opacity-100 transition-opacity">
                                        <Check className="w-3.5 h-3.5 text-white stroke-[3]" />
                                      </div>
                                    </div>
                                    <span className={`text-sm font-bold ${isChecked ? 'text-fuchsia-900' : 'text-gray-700'}`}>{o.name}</span>
                                  </label>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Online Availability toggle */}
                      <div className="space-y-3">
                        <button type="button"
                          onClick={() => {
                            const willBeOnline = !form.is_available_online;
                            setForm({ ...form, is_available_online: willBeOnline, available_online_channels: willBeOnline ? null : [] })
                          }}
                          className={`w-full flex items-center justify-between p-4 rounded-[1.25rem] border-2 transition-all duration-300
                            ${form.is_available_online
                              ? 'border-indigo-200 bg-indigo-50/40 hover:bg-indigo-50'
                              : 'border-gray-200 bg-gray-50 hover:border-gray-300'}`}>
                          <div className="flex items-center gap-4">
                            <div className={`w-11 h-11 rounded-xl flex items-center justify-center transition-all duration-300 shadow-sm
                              ${form.is_available_online ? 'bg-indigo-100 text-indigo-600' : 'bg-white border border-gray-200 text-gray-400'}`}>
                              {form.is_available_online
                                ? <ToggleRight className="w-7 h-7" />
                                : <ToggleLeft  className="w-7 h-7" />}
                            </div>
                            <div className="text-left">
                              <p className={`text-sm font-bold leading-none mb-1.5 ${form.is_available_online ? 'text-indigo-800' : 'text-gray-600'}`}>
                                {form.is_available_online ? 'Tersedia di Food Apps' : 'Hanya POS (Offline)'}
                              </p>
                              <p className="text-xs font-medium text-gray-500">
                                {form.is_available_online ? 'Menu muncul di aplikasi online' : 'Sembunyikan dari aplikasi online'}
                              </p>
                            </div>
                          </div>
                          <div className={`w-14 h-7 rounded-full transition-all duration-300 relative flex-shrink-0 shadow-inner
                            ${form.is_available_online ? 'bg-indigo-500' : 'bg-gray-300'}`}>
                            <span className={`absolute top-1/2 -translate-y-1/2 w-5 h-5 bg-white rounded-full shadow-sm
                              transition-transform duration-300 ${form.is_available_online ? 'left-[calc(100%-1.5rem)]' : 'left-1'}`} />
                          </div>
                        </button>
                        
                        {form.is_available_online && initialChannels.length > 0 && (
                          <div className="p-5 rounded-[1.25rem] border border-indigo-100 bg-indigo-50/30 ml-4 animate-in fade-in slide-in-from-top-2 duration-300">
                            <p className="text-[11px] font-bold text-indigo-800/70 uppercase tracking-widest mb-4 flex items-center gap-2.5">
                              <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 shadow-[0_0_4px_rgba(99,102,241,0.5)]"></span>
                              Platform Online Tersedia:
                            </p>
                            <div className="space-y-3">
                              <label className="flex items-center gap-3.5 cursor-pointer group">
                                <div className="relative flex items-center">
                                  <input type="radio" 
                                    checked={form.available_online_channels === null} 
                                    onChange={() => setForm({ ...form, available_online_channels: null })}
                                    className="peer sr-only" />
                                  <div className="w-5 h-5 rounded-full border-[2.5px] border-gray-300 peer-checked:border-indigo-500 peer-checked:bg-indigo-500 transition-colors shadow-sm"></div>
                                  <div className="absolute inset-0 flex items-center justify-center opacity-0 peer-checked:opacity-100 transition-opacity">
                                    <div className="w-2 h-2 rounded-full bg-white"></div>
                                  </div>
                                </div>
                                <span className="text-sm text-gray-700 font-bold group-hover:text-indigo-700 transition-colors">Semua Platform Food Apps</span>
                              </label>
                              <label className="flex items-center gap-3.5 cursor-pointer group">
                                <div className="relative flex items-center">
                                  <input type="radio" 
                                    checked={form.available_online_channels !== null} 
                                    onChange={() => setForm({ ...form, available_online_channels: [] })}
                                    className="peer sr-only" />
                                  <div className="w-5 h-5 rounded-full border-[2.5px] border-gray-300 peer-checked:border-indigo-500 peer-checked:bg-indigo-500 transition-colors shadow-sm"></div>
                                  <div className="absolute inset-0 flex items-center justify-center opacity-0 peer-checked:opacity-100 transition-opacity">
                                    <div className="w-2 h-2 rounded-full bg-white"></div>
                                  </div>
                                </div>
                                <span className="text-sm text-gray-700 font-bold group-hover:text-indigo-700 transition-colors">Pilih Platform Spesifik</span>
                              </label>
                            </div>
                            
                            {form.available_online_channels !== null && (
                              <div className="mt-5 pl-8 pt-5 border-t border-indigo-100/60 grid grid-cols-1 sm:grid-cols-2 gap-3 animate-in fade-in duration-300">
                                {initialChannels.map(ch => {
                                  const slug = getSlug(ch.id);
                                  const isChecked = form.available_online_channels!.includes(slug);
                                  return (
                                    <label key={ch.id} className="flex items-center gap-3 cursor-pointer hover:bg-white p-2.5 rounded-xl transition-all duration-200 border border-transparent hover:border-indigo-100 hover:shadow-sm">
                                      <div className="relative flex items-center">
                                        <input type="checkbox" 
                                          checked={isChecked}
                                          onChange={(e) => {
                                            const curr = form.available_online_channels || [];
                                            if (e.target.checked) {
                                              setForm({ ...form, available_online_channels: [...curr, slug] });
                                            } else {
                                              setForm({ ...form, available_online_channels: curr.filter(c => c !== slug) });
                                            }
                                          }}
                                          className="peer sr-only" />
                                        <div className="w-5 h-5 rounded-[6px] border-[2px] border-gray-300 peer-checked:border-indigo-500 peer-checked:bg-indigo-500 transition-colors shadow-sm"></div>
                                        <div className="absolute inset-0 flex items-center justify-center opacity-0 peer-checked:opacity-100 transition-opacity">
                                          <Check className="w-3.5 h-3.5 text-white stroke-[3]" />
                                        </div>
                                      </div>
                                      <span className="text-sm font-bold text-gray-700">{ch.name}</span>
                                    </label>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

              </div>

            {/* Sticky footer — action buttons */}
            <div className="flex gap-4 px-8 py-5 border-t border-gray-100 flex-shrink-0 bg-white/95 backdrop-blur-md z-10 shadow-[0_-4px_10px_rgba(0,0,0,0.02)]">
              <button type="button" onClick={closeForm}
                  className="px-8 py-3.5 rounded-[1.25rem] font-bold text-gray-600 bg-gray-100 hover:bg-gray-200 transition-all duration-200 w-1/3 text-sm flex items-center justify-center border border-gray-200/50">
                  Batal
                </button>
                <button type="submit" disabled={saving || uploading}
                  className="btn-primary flex-1 py-3.5 rounded-[1.25rem] text-base font-bold shadow-lg shadow-amber-500/30 hover:shadow-amber-500/40 hover:-translate-y-0.5 transition-all duration-200">
                  {(saving || uploading)
                    ? <div className="flex items-center justify-center gap-2"><Loader2 className="w-5 h-5 animate-spin" /><span>{uploading ? 'Mengupload...' : 'Menyimpan...'}</span></div>
                    : form.id ? 'Simpan Perubahan' : 'Tambah Menu Baru'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── ZIP Upload Modal ─────────────────────────────── */}
      {showZipModal && (
        <ZipUploadModal
          categories={initialCategories}
          onClose={() => setShowZipModal(false)}
          onComplete={() => router.refresh()}
        />
      )}

      {/* ── Menu Grid / Table ────────────────────────────── */}
      {initialItems.length === 0 ? (
        <div className="card p-16 flex flex-col items-center text-center">
          <div className="w-16 h-16 bg-amber-50 rounded-full flex items-center justify-center mb-4">
            <Sandwich className="w-8 h-8 text-amber-200" strokeWidth={1} />
          </div>
          <p className="font-semibold text-gray-500">Belum ada menu</p>
          <p className="text-sm text-gray-400 mt-1">Tambahkan menu pertamamu</p>
        </div>
      ) : initialItems.length === 0 ? (
        <div className="card p-16 flex flex-col items-center text-center">
          <Search className="w-10 h-10 text-gray-200 mb-3" />
          <p className="font-semibold text-gray-500">Menu tidak ditemukan</p>
          <p className="text-sm text-gray-400 mt-1">Coba kata kunci lain</p>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  <th className="text-left py-3.5 px-5 font-semibold text-gray-500 w-16">Foto</th>
                  <th className="text-left py-3.5 px-4 font-semibold text-gray-500 cursor-pointer group" onClick={() => requestSort('name')}>
                    <div className="flex items-center">Nama Menu {getSortIcon('name')}</div>
                  </th>
                  <th className="text-left py-3.5 px-4 font-semibold text-gray-500 hidden sm:table-cell cursor-pointer group" onClick={() => requestSort('category')}>
                    <div className="flex items-center">Kategori {getSortIcon('category')}</div>
                  </th>
                  <th className={`text-right py-3.5 px-4 font-semibold transition-colors cursor-pointer group
                    ${activeChannelFilter 
                      ? 'bg-amber-100/50 text-amber-700 border-b-2 border-amber-500 rounded-t-lg' 
                      : 'text-gray-500'}`}
                      onClick={() => requestSort('price')}
                  >
                    <div className="flex items-center justify-end">
                      {activeChannelFilter 
                        ? `Harga ${initialChannels.find(c => c.id === activeChannelFilter)?.name || ''}`
                        : 'Harga Dasar'}
                      {getSortIcon('price')}
                    </div>
                  </th>
                  <th className="text-center py-3.5 px-4 font-semibold text-gray-500 cursor-pointer group" onClick={() => requestSort('status')}>
                    <div className="flex items-center justify-center">Status {getSortIcon('status')}</div>
                  </th>
                  <th className="text-center py-3.5 px-5 font-semibold text-gray-500">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {sortedItems.map((item, idx) => (
                  <tr
                    key={item.id}
                    className={`border-b border-gray-50 hover:bg-gray-50/60 transition-colors
                      ${idx === sortedItems.length - 1 ? 'border-0' : ''}`}
                  >
                    {/* Thumbnail */}
                    <td className="py-3.5 px-5">
                      <div className="w-12 h-12 rounded-2xl overflow-hidden bg-amber-50 flex items-center justify-center">
                        {item.image_url ? (
                          <Image src={item.image_url} alt={item.name} width={48} height={48}
                            unoptimized={true}
                            className="object-cover w-full h-full" />
                        ) : (
                          <Sandwich className="w-5 h-5 text-amber-200" strokeWidth={1.5} />
                        )}
                      </div>
                    </td>

                    {/* Name */}
                    <td className="py-3.5 px-4 relative">
                      <p className="font-semibold text-gray-900 leading-none">{item.name}</p>
                      {item.description && (
                        <p className="text-gray-400 text-xs mt-1 truncate max-w-[200px]">{item.description}</p>
                      )}
                      <div className="flex flex-wrap gap-1 mt-1.5">
                        {bestsellers.includes(item.id) && <span className="text-[10px] bg-red-100 text-red-600 px-1.5 py-0.5 rounded font-bold">Best Seller</span>}
                        {recommendations.includes(item.id) && <span className="text-[10px] bg-amber-100 text-amber-600 px-1.5 py-0.5 rounded font-bold">Rekomendasi</span>}
                        {upsells.includes(item.id) && <span className="text-[10px] bg-blue-100 text-blue-600 px-1.5 py-0.5 rounded font-bold">Menu Ekstra</span>}

                        {/* Channel Badges */}
                        {(() => {
                          const activeSlug = activeChannelFilter ? getSlug(activeChannelFilter) : '';
                          const isSpecificFoodApp = Boolean(activeSlug && !['pos_kasir', 'all_food_apps'].includes(activeSlug));

                          const hasSpecificChannelPrice = (slug: string) => {
                            if (!item.channel_prices) return false;
                            const val = item.channel_prices[slug] || (slug === 'tiktokgo' ? item.channel_prices.tiktok_go : undefined);
                            return val !== undefined && val !== null && Number(val) > 0;
                          };

                          const hasExplicitChannel = (slug: string) => {
                            if (!item.available_online_channels || !Array.isArray(item.available_online_channels)) return false;
                            return item.available_online_channels.some(
                              c => c.toLowerCase().replace(/\s+/g, '') === slug || (slug === 'tiktokgo' && (c === 'tiktokgo' || c === 'tiktok_go'))
                            );
                          };

                          const isRealInChannel = (slug: string) => {
                            return hasSpecificChannelPrice(slug) || hasExplicitChannel(slug);
                          };

                          const showPosKasirBadge = !isSpecificFoodApp && activeSlug !== 'all_food_apps' && item.is_available !== false;

                          return (
                            <>
                              {showPosKasirBadge && (
                                <span className="text-[10px] bg-amber-50 text-amber-700 border border-amber-200 px-1.5 py-0.5 rounded font-bold">POS Kasir</span>
                              )}

                              {item.is_available_online !== false && activeSlug !== 'pos_kasir' && (
                                <>
                                  {(isSpecificFoodApp ? activeSlug === 'gofood' : isRealInChannel('gofood')) && (
                                    <span className="text-[10px] bg-emerald-50 text-emerald-700 border border-emerald-200 px-1.5 py-0.5 rounded font-bold">GoFood</span>
                                  )}
                                  {(isSpecificFoodApp ? activeSlug === 'grabfood' : isRealInChannel('grabfood')) && (
                                    <span className="text-[10px] bg-green-50 text-green-700 border border-green-200 px-1.5 py-0.5 rounded font-bold">GrabFood</span>
                                  )}
                                  {(isSpecificFoodApp ? activeSlug === 'shopeefood' : isRealInChannel('shopeefood')) && (
                                    <span className="text-[10px] bg-orange-50 text-orange-700 border border-orange-200 px-1.5 py-0.5 rounded font-bold">ShopeeFood</span>
                                  )}
                                  {(isSpecificFoodApp ? activeSlug === 'tiktokgo' : isRealInChannel('tiktokgo')) && (
                                    <span className="text-[10px] bg-slate-900 text-white px-1.5 py-0.5 rounded font-bold">TikTok Go</span>
                                  )}
                                </>
                              )}
                            </>
                          );
                        })()}
                      </div>
                      
                      {openDropdownId === item.id && (
                        <div className="fixed inset-0 z-40" onClick={() => setOpenDropdownId(null)} />
                      )}
                    </td>

                    {/* Category */}
                    <td className="py-3.5 px-4 hidden sm:table-cell">
                      {item.categories
                        ? <span className="badge-amber">{item.categories.name}</span>
                        : <span className="text-gray-300">—</span>
                      }
                    </td>

                    {/* Price */}
                    <td className="py-3.5 px-4 text-right">
                      <div className="flex flex-col items-end">
                        {item.strike_price && (
                          <span className="text-xs text-gray-400 line-through decoration-gray-400/50 mb-0.5">
                            {formatRupiah(item.strike_price)}
                          </span>
                        )}
                        {activeChannelFilter && !['pos_kasir', 'all_food_apps'].includes(activeChannelFilter) && item.channel_prices?.[getSlug(activeChannelFilter)] ? (
                          <>
                            <span className="font-bold text-amber-600">{formatRupiah(item.channel_prices[getSlug(activeChannelFilter)])}</span>
                            <span className="text-[10px] text-gray-400 font-medium">Dasar: {formatRupiah(item.price)}</span>
                          </>
                        ) : (
                          <span className="font-bold text-gray-900">{formatRupiah(item.price)}</span>
                        )}
                      </div>
                    </td>

                    {/* Status toggle */}
                    <td className="py-3.5 px-4 text-center">
                      <button onClick={() => toggleAvail(item)}
                        className={`text-xs font-bold px-3.5 py-1.5 rounded-2xl transition-all
                          ${item.is_available
                            ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                            : 'bg-red-50 text-red-500 hover:bg-red-100'}`}>
                        {item.is_available ? 'Tersedia' : 'Habis'}
                      </button>
                    </td>

                    {/* Actions */}
                    <td className="py-3.5 px-5">
                      <div className="flex items-center justify-center gap-2">
                        <button onClick={() => openEdit(item)}
                          className="w-8 h-8 bg-amber-50 hover:bg-amber-100 text-amber-600 rounded-xl
                            flex items-center justify-center transition-colors"
                          title="Edit">
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => openDuplicate(item)}
                          className="w-8 h-8 bg-blue-50 hover:bg-blue-100 text-blue-500 hover:text-blue-600 rounded-xl flex items-center justify-center transition-colors"
                          title="Duplikasi">
                          <Copy className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => deleteItem(item)}
                          className="w-8 h-8 bg-gray-50 hover:bg-red-50 text-gray-300 hover:text-red-500
                            rounded-xl flex items-center justify-center transition-all"
                          title="Hapus">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                        <div className="relative">
                          <button onClick={() => setOpenDropdownId(openDropdownId === item.id ? null : item.id)}
                            className="w-8 h-8 bg-gray-50 hover:bg-gray-100 text-gray-400 hover:text-gray-600 rounded-xl flex items-center justify-center transition-all">
                            <MoreVertical className="w-3.5 h-3.5" />
                          </button>
                          {openDropdownId === item.id && (
                            <div className="absolute right-0 top-10 z-50 w-52 bg-white rounded-xl shadow-[0_4px_20px_-4px_rgba(0,0,0,0.1)] border border-gray-100 p-2 text-left origin-top-right">
                              <button onClick={() => { toggleSetting('upsell', item); setOpenDropdownId(null) }} className="w-full text-left px-3 py-2.5 hover:bg-gray-50 rounded-lg text-[13px] flex items-center justify-between transition-colors">
                                <span className={upsells.includes(item.id) ? 'font-bold text-amber-600' : 'font-medium text-gray-700'}>Menu Ekstra</span>
                                {upsells.includes(item.id) && <Check className="w-3.5 h-3.5 text-amber-600" />}
                              </button>
                              <button onClick={() => { toggleSetting('bestseller', item); setOpenDropdownId(null) }} className="w-full text-left px-3 py-2.5 hover:bg-gray-50 rounded-lg text-[13px] flex items-center justify-between mt-1 transition-colors">
                                <span className={bestsellers.includes(item.id) ? 'font-bold text-amber-600' : 'font-medium text-gray-700'}>Best Seller</span>
                                {bestsellers.includes(item.id) && <Check className="w-3.5 h-3.5 text-amber-600" />}
                              </button>
                              <button onClick={() => { toggleSetting('recommendation', item); setOpenDropdownId(null) }} className="w-full text-left px-3 py-2.5 hover:bg-gray-50 rounded-lg text-[13px] flex items-center justify-between mt-1 transition-colors">
                                <span className={recommendations.includes(item.id) ? 'font-bold text-amber-600' : 'font-medium text-gray-700'}>Menu Rekomendasi</span>
                                {recommendations.includes(item.id) && <Check className="w-3.5 h-3.5 text-amber-600" />}
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}


