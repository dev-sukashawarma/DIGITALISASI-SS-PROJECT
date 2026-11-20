// @ts-nocheck
'use client'

import { useState, useRef, useMemo, useEffect, useDeferredValue } from 'react'
import { createPortal } from 'react-dom'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import {
  Plus, Pencil, Trash2, X, Loader2, Copy,
  AlertCircle, UploadCloud, Sandwich, ToggleLeft, ToggleRight,
  Search, MoreVertical, Check, ArrowUpDown, ChevronUp, ChevronDown, Store, Sparkles, Globe, Tag, Smartphone,
  BookOpen, Eye, EyeOff
} from 'lucide-react'
import { createClient } from '@/lib/supabase'
import { CurrencyInput, compressImageToWebP } from '@suka/design-system'
import { formatRupiah } from '@/lib/validations'
import type { MenuItem, Category, SalesChannel, Outlet } from '@/pos-types'
import { useDialogStore } from '@/lib/dialogStore'
import { MenuFormModal } from './MenuFormModal'
import { saveMenuItem, toggleMenuAvailability, setMenuHiddenPos, deleteMenuItem, nonaktifkanMenu, deleteAllMenuItems, toggleGlobalSetting, toggleMenuPublished, retryMenuOnlineSync, toggleTampilDiApp, quickCreateBahanBaku } from './actions'
import { computeResepHpp, type HppBahan } from '@/lib/hpp'
import { getChannel } from '@/lib/channels'
import { getPromoStatus } from '@/lib/promoSchedule'

type MenuPromo = {
  scope: 'global' | 'item'
  menu_item_id: string | null
  outlet_id?: string | null
  is_active: boolean
  start_date?: string | null
  end_date?: string | null
  daily_start_time?: string | null
  daily_end_time?: string | null
  daily_schedule?: Array<{ date: string; start_time: string; end_time: string }> | null
}

const MENU_PROMO_BADGE_STYLE: Record<'terjadwal' | 'berjalan', string> = {
  terjadwal: 'bg-violet-50 text-violet-700 border-violet-200',
  berjalan: 'bg-emerald-50 text-emerald-700 border-emerald-200',
}

function MenuPromoBadge({ item, promos, now }: { item: MenuItem; promos: MenuPromo[]; now: number }) {
  const matchingStatuses = promos
    .filter(promo => {
      const sameOutlet = promo.outlet_id == null || item.outlet_id == null || promo.outlet_id === item.outlet_id
      const appliesToItem = promo.scope === 'global' || promo.menu_item_id === item.id
      return sameOutlet && appliesToItem
    })
    .map(promo => getPromoStatus(promo, now))
    .filter((status): status is 'terjadwal' | 'berjalan' => status === 'terjadwal' || status === 'berjalan')
    .sort((a, b) => (a === 'berjalan' ? -1 : 1) - (b === 'berjalan' ? -1 : 1))

  const status = matchingStatuses[0]
  if (!status) return null

  const label = status === 'berjalan' ? 'PROMO AKTIF' : 'PROMO TERJADWAL'
  return (
    <span
      title={status === 'berjalan' ? 'Promo sedang berlaku untuk menu ini' : 'Promo sudah diatur dan akan berlaku sesuai jadwal'}
      aria-label={label}
      className={`inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[10px] font-extrabold tracking-wide ${MENU_PROMO_BADGE_STYLE[status]}`}
    >
      <Tag className="h-3 w-3" strokeWidth={2.5} />
      {label}
    </span>
  )
}

function ChannelLogoIcon({ channelKey }: { channelKey: string }) {
  const norm = channelKey.toLowerCase()

  if (norm === '' || norm === 'all') {
    return (
      <span className="w-5 h-5 rounded-md bg-slate-800 text-white flex items-center justify-center shrink-0 shadow-xs">
        <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 fill-current">
          <path d="M11 9H9V2H7v7H5V2H3v7c0 2.12 1.46 3.9 3.45 4.38l-.95 7.62H7.5l.75-6H11V9zm7-7v18h2V2h-2zm-3 0v8h2V2h-2z"/>
        </svg>
      </span>
    )
  }

  if (norm === 'pos_kasir') {
    return (
      <span className="w-5 h-5 rounded-md bg-amber-500 text-white flex items-center justify-center shrink-0 shadow-xs">
        <Store size={12} strokeWidth={2.5} />
      </span>
    )
  }

  if (norm === 'all_food_apps') {
    return (
      <span className="w-5 h-5 rounded-md bg-gradient-to-tr from-orange-600 to-amber-500 text-white flex items-center justify-center shrink-0 shadow-xs">
        <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 fill-current">
          <path d="M19 7c0-1.1-.9-2-2-2h-3v2h3v2.65L13.52 14H10V9H6c-2.21 0-4 1.79-4 4v3h2c0 1.66 1.34 3 3 3s3-1.34 3-3h4.48L19 10.35V7zM7 17c-.55 0-1-.45-1-1h2c0 .55-.45 1-1 1zm12.5-4c.83 0 1.5.67 1.5 1.5s-.67 1.5-1.5 1.5-1.5-.67-1.5-1.5.67-1.5 1.5-1.5z"/>
        </svg>
      </span>
    )
  }

  const ch = getChannel(norm)

  const officialLogos: Record<string, string> = {
    'gofood': '/logos/gofood.svg',
    'grabfood': '/logos/grabfood.svg',
    'shopeefood': '/logos/shopeefood.svg',
    'tiktokgo': '/logos/tiktokgo.svg'
  }

  if (ch && officialLogos[ch.id]) {
    return (
      <span className="w-5 h-5 rounded-md flex items-center justify-center shrink-0 shadow-xs bg-white overflow-hidden border border-slate-200">
        <Image src={officialLogos[ch.id]} alt={ch.label} width={16} height={16} className="object-contain" unoptimized={true} />
      </span>
    )
  }

  if (ch && ch.logoPath) {
    return (
      <span 
        className="w-5 h-5 rounded-md flex items-center justify-center shrink-0 shadow-xs"
        style={{ backgroundColor: ch.bg }}
      >
        <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 fill-white">
          <path d={ch.logoPath} />
        </svg>
      </span>
    )
  }

  return (
    <span className="w-5 h-5 rounded-md bg-slate-500 text-white flex items-center justify-center shrink-0 shadow-xs">
      <Store size={12} />
    </span>
  )
}

function SearchEmptyVector({ 
  query, 
  channelLabel, 
  onReset 
}: { 
  query: string
  channelLabel?: string
  onReset: () => void 
}) {
  return (
    <div className="bg-white rounded-3xl border border-slate-100 p-12 sm:p-16 flex flex-col items-center justify-center text-center shadow-xs animate-in fade-in zoom-in-95 duration-200 my-4">
      {/* Animated Vector Illustration */}
      <div className="relative w-28 h-28 mb-6 flex items-center justify-center">
        <div className="absolute inset-0 bg-gradient-to-tr from-amber-100 to-orange-100 rounded-full blur-xl opacity-60 animate-pulse"></div>
        <div className="absolute inset-2 border-2 border-dashed border-amber-300/60 rounded-full animate-spin-slow"></div>
        
        <div className="relative w-20 h-20 bg-gradient-to-b from-white to-amber-50 rounded-2xl border border-amber-200/80 shadow-md flex items-center justify-center">
          <Search className="w-10 h-10 text-amber-500 stroke-[1.75]" />
          <span className="absolute -top-2 -right-2 bg-suka-orange text-white text-[10px] font-extrabold px-2 py-0.5 rounded-full shadow-sm">
            0 Hasil
          </span>
        </div>
      </div>

      <h3 className="text-xl font-extrabold text-slate-900 tracking-tight mb-2">
        Menu Tidak Ditemukan
      </h3>
      <p className="text-sm font-medium text-slate-500 max-w-md mb-6 leading-relaxed">
        {query ? (
          <>Tidak ada menu yang cocok dengan kata kunci <strong className="text-amber-600 font-bold">&quot;{query}&quot;</strong>.</>
        ) : (
          <>Tidak ada menu yang terdaftar pada filter <strong className="text-amber-600 font-bold">{channelLabel || 'ini'}</strong>.</>
        )}
        <br />Silakan periksa ejaan kata kunci atau ubah filter pencarian Anda.
      </p>

      {/* Action Buttons */}
      <div className="flex flex-wrap items-center justify-center gap-3">
        <button
          onClick={onReset}
          className="px-5 py-2.5 rounded-2xl bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200 text-xs font-extrabold transition-all shadow-xs active:scale-95 flex items-center gap-2 cursor-pointer"
        >
          <X className="w-4 h-4" />
          Reset Filter &amp; Pencarian
        </button>
      </div>
    </div>
  )
}

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
  campaign_price: string
  is_campaign_active: boolean
  base_price: string
  channel_prices: Record<string, string>
  category_id: string
  is_available: boolean
  is_hidden_pos: boolean
  is_available_online: boolean
  is_published_order_online: boolean
  tampil_di_app: boolean
  available_online_channels: string[] | null
  image_url: string | null
  is_package: boolean
  package_items: { menu_item_id: string, or_menu_item_id?: string | null, quantity: number, temp_id: string }[]
  outlet_ids: string[] | null
}

/**
 * Slug harga aplikasi di `menu_items.channel_prices`.
 *
 * SENGAJA di luar daftar slug yang disapu mode "Satu Harga Semua" -- aplikasi
 * bukan agregator, dan menyeretnya ke sapuan itu membuat perubahan harga
 * GoFood diam-diam mengubah harga di aplikasi.
 */
const SLUG_APLIKASI = 'aplikasi'

const EMPTY: FormState = {
  id: null, name: '', description: '', price: '', strike_price: '', campaign_price: '', is_campaign_active: false, base_price: '',
  channel_prices: {},
  category_id: '', is_available: true, is_hidden_pos: false, is_available_online: true, is_published_order_online: false, tampil_di_app: false,
  available_online_channels: ['pos_kasir', 'gofood', 'grabfood', 'shopeefood'],
  image_url: null,
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

interface RecipeRow {
  temp_id: string
  bahan_baku_id: string
  qty_per_porsi: number | string
  satuan: string
}

interface MenuViewProps {
  initialItems: MenuItem[]
  initialCategories: Category[]
  initialChannels: SalesChannel[]
  initialOutlets?: Outlet[]
  initialPromos?: MenuPromo[]
  initialUpsells?: string[]
  initialBestsellers?: string[]
  initialRecommendations?: string[]
  searchQuery?: string
  initialBahanBaku?: Array<{
    id: string
    nama: string
    satuan: string
    satuan_kecil?: string
    harga_beli?: number
    kemasan_qty?: number
    kemasan_satuan?: string
  }>
  initialRecipes?: Record<string, { id: string; resep_item: { bahan_baku_id: string; qty_per_porsi: number; satuan: string }[] }>
}

export default function MenuView({ 
  initialItems = [], 
  initialCategories = [], 
  initialChannels = [], 
  initialOutlets = [],
  initialPromos = [],
  initialUpsells = [], 
  initialBestsellers = [], 
  initialRecommendations = [],
  searchQuery = '',
  initialBahanBaku = [],
  initialRecipes = {},
}: MenuViewProps) {
  const router = useRouter()

  const { showConfirm, showAlert } = useDialogStore()
  const [form, setForm]           = useState<FormState>(EMPTY)
  const [showForm, setShowForm]   = useState(false)
  const [saving, setSaving]       = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error, setError]         = useState('')
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [preview, setPreview]     = useState<string | null>(null)
  const [deletingAll, setDeletingAll]   = useState(false)
  const [posVisibility, setPosVisibility] = useState<Record<string, boolean>>(() => Object.fromEntries(initialItems.map(item => [item.id, !!item.is_hidden_pos])))
  const [posVisibilitySaving, setPosVisibilitySaving] = useState<string[]>([])
  const [upsells, setUpsells] = useState<string[]>(initialUpsells || [])
  const [bestsellers, setBestsellers] = useState<string[]>(initialBestsellers || [])
  const [recommendations, setRecommendations] = useState<string[]>(initialRecommendations || [])
  const [openDropdownId, setOpenDropdownId] = useState<string | null>(null)
  const [dropdownPos, setDropdownPos] = useState<{ top: number, right: number } | null>(null)
  const [activeCategoryFilter, setActiveCategoryFilter] = useState<string>('all')
  const [activeChannelFilter, setActiveChannelFilter] = useState<string>('')
  const [posVisibilityFilter, setPosVisibilityFilter] = useState<'visible' | 'hidden' | 'all'>('visible')
  const [channelDropdownOpen, setChannelDropdownOpen] = useState(false)
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' } | null>(null)
  const [outletSearch, setOutletSearch] = useState('')
  const [modalTab, setModalTab] = useState<'basic' | 'channels' | 'composition'>('basic')
  const [promoNow, setPromoNow] = useState(() => Date.now())
  const fileRef = useRef<HTMLInputElement>(null)
  const channelDropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setPosVisibility(Object.fromEntries(initialItems.map(item => [item.id, !!item.is_hidden_pos])))
  }, [initialItems])

  useEffect(() => {
    const supabase = createClient()
    const channel = supabase.channel('admin-menu-pos-visibility')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'menu_items' }, (payload) => {
        const row = payload.new as { id?: string; is_hidden_pos?: boolean }
        if (row.id && typeof row.is_hidden_pos === 'boolean') {
          setPosVisibility(previous => ({ ...previous, [row.id!]: row.is_hidden_pos! }))
        }
      }).subscribe((status) => { if (status === 'SUBSCRIBED') router.refresh() })
    return () => { supabase.removeChannel(channel) }
  }, [router])

  // Resep (BOM) & Live HPP State
  const [recipeItems, setRecipeItems] = useState<RecipeRow[]>([])
  const [bahanList, setBahanList] = useState(initialBahanBaku || [])
  const [copyNotice, setCopyNotice] = useState<string | null>(null)
  const [showQuickBahanModal, setShowQuickBahanModal] = useState(false)
  const [quickBahanLoading, setQuickBahanLoading] = useState(false)
  const [quickBahanError, setQuickBahanError] = useState('')
  const [quickBahanForm, setQuickBahanForm] = useState({
    nama: '',
    satuan: 'Pack',
    satuan_kecil: 'Pcs',
    faktor_konversi: '10',
    harga_beli: '',
  })

  useEffect(() => {
    if (initialBahanBaku && initialBahanBaku.length > 0) {
      setBahanList(initialBahanBaku)
    }
  }, [initialBahanBaku])

  const bahanById = useMemo(() => {
    const map: Record<string, HppBahan> = {}
    for (const b of bahanList) {
      map[b.id] = {
        hargaBeliDisplay: b.harga_beli || 0,
        kemasanQty: b.kemasan_qty || 1,
        kemasanSatuan: b.kemasan_satuan || b.satuan_kecil || b.satuan || '',
      }
    }
    return map
  }, [bahanList])

  const hppResult = useMemo(() => {
    const numPrice = parseFloat(form.price) || 0
    const validItems = recipeItems.filter(r => r.bahan_baku_id && Number(r.qty_per_porsi) > 0)
    return computeResepHpp(
      validItems.map(r => ({
        bahan_baku_id: r.bahan_baku_id,
        qty_per_porsi: Number(r.qty_per_porsi) || 0,
        satuan: r.satuan || ''
      })),
      bahanById,
      numPrice,
      0
    )
  }, [recipeItems, bahanById, form.price])

  useEffect(() => {
    const timer = window.setInterval(() => setPromoNow(Date.now()), 60_000)
    return () => window.clearInterval(timer)
  }, [])

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (channelDropdownRef.current && !channelDropdownRef.current.contains(e.target as Node)) {
        setChannelDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  useEffect(() => {
    function handleScroll() {
      if (openDropdownId) {
        setOpenDropdownId(null)
        setDropdownPos(null)
      }
    }
    window.addEventListener('scroll', handleScroll, true)
    return () => window.removeEventListener('scroll', handleScroll, true)
  }, [openDropdownId])

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
        if (item.is_available === false || item.is_hidden_pos === true) return false
        const chs = item.available_online_channels
        if (chs && Array.isArray(chs) && chs.length > 0) {
          return chs.some(c => c.toLowerCase().replace(/\s+/g, '') === 'pos_kasir')
        }
        return true
      }

      if (channelKey === 'online_only') {
        if (item.is_available_online === false) return false
        const chs = item.available_online_channels
        if (chs && Array.isArray(chs) && chs.length > 0) {
          return !chs.some(c => c.toLowerCase().replace(/\s+/g, '') === 'pos_kasir')
        }
        return false
      }

      // Aplikasi diperiksa SEBELUM gerbang `is_available_online` di bawah.
      // Ia kanal milik sendiri, sejajar Kasir, bukan sejajar GoFood --
      // mematikan "Tersedia di Food Apps" tidak boleh ikut menutupnya.
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
          c => c.toLowerCase().replace(/\s+/g, '') === targetSlug || ((targetSlug === 'tiktokgo' || targetSlug === 'tiktok') && (c === 'tiktokgo' || c === 'tiktok_go' || c === 'tiktok'))
        )
      } else {
        const channelPrice = pricesObj[targetSlug] || ((targetSlug === 'tiktokgo' || targetSlug === 'tiktok') ? (pricesObj['tiktok_go'] || pricesObj['tiktokgo']) : undefined)
        return channelPrice !== undefined && channelPrice !== null && Number(channelPrice) > 0
      }
    }
  }, [initialChannels])

  const channelOptions = useMemo(() => {
    const opts: Array<{ key: string; label: string; count: number; icon: React.ReactNode; theme: string }> = [
      { key: '', label: 'Semua Menu', count: initialItems.length, icon: <ChannelLogoIcon channelKey="" />, theme: 'gray' },
      { key: 'pos_kasir', label: 'Offline (Kasir Toko)', count: initialItems.filter(i => isItemInChannel(i, 'pos_kasir')).length, icon: <ChannelLogoIcon channelKey="pos_kasir" />, theme: 'amber' },
      { key: 'online_only', label: 'Khusus Online (Tidak Dijual Offline)', count: initialItems.filter(i => isItemInChannel(i, 'online_only')).length, icon: <Globe className="w-4 h-4 text-emerald-600" />, theme: 'emerald' },
      { key: 'all_food_apps', label: 'Semua Food Apps', count: initialItems.filter(i => isItemInChannel(i, 'all_food_apps')).length, icon: <ChannelLogoIcon channelKey="all_food_apps" />, theme: 'orange' },
      { key: SLUG_APLIKASI, label: 'Khusus Aplikasi (SukaShawarma APP)', count: initialItems.filter(i => isItemInChannel(i, SLUG_APLIKASI)).length, icon: <Smartphone className="w-4 h-4 text-amber-600" />, theme: 'amber' },
    ]

    initialChannels.forEach(ch => {
      const slug = ch.name.toLowerCase().replace(/\s+/g, '')
      let theme = 'gray'
      if (slug.includes('tiktok')) { theme = 'slate' }
      else if (slug.includes('gofood')) { theme = 'emerald' }
      else if (slug.includes('grabfood')) { theme = 'green' }
      else if (slug.includes('shopee')) { theme = 'orange' }

      opts.push({
        key: ch.id,
        label: `Khusus ${ch.name}`,
        count: initialItems.filter(i => isItemInChannel(i, ch.id)).length,
        icon: <ChannelLogoIcon channelKey={ch.id} />,
        theme,
      })
    })

    return opts
  }, [initialItems, initialChannels, isItemInChannel])

  const selectedChannelOption = channelOptions.find(o => o.key === activeChannelFilter) ?? channelOptions[0]

  const [searchVal, setSearchVal] = useState(searchQuery)
  const deferredSearch = useDeferredValue(searchVal)

  // Sync searchVal with prop if searchQuery changes externally
  useEffect(() => {
    setSearchVal(searchQuery)
  }, [searchQuery])

  // Keyboard shortcut Esc to clear search
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape' && searchVal) {
        setSearchVal('')
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [searchVal])

  const sortedItems = useMemo(() => {
    let sortableItems = [...initialItems];
    if (posVisibilityFilter === 'visible') sortableItems = sortableItems.filter(item => !posVisibility[item.id]);
    else if (posVisibilityFilter === 'hidden') sortableItems = sortableItems.filter(item => !!posVisibility[item.id]);

    if (activeCategoryFilter !== 'all') {
      sortableItems = sortableItems.filter(item => item.category_id === activeCategoryFilter);
    }

    if (deferredSearch && deferredSearch.trim()) {
      const q = deferredSearch.trim().toLowerCase();
      const keywords = q.split(/\s+/).filter(Boolean);

      sortableItems = sortableItems.filter(item => {
        const name = (item.name || '').toLowerCase();
        const category = (item.categories?.name || '').toLowerCase();
        const desc = (item.description || '').toLowerCase();
        const priceStr = String(item.price);
        const typeStr = item.is_package ? 'paket combo package' : 'satuan';

        return keywords.every(kw => 
          name.includes(kw) || 
          category.includes(kw) || 
          desc.includes(kw) || 
          priceStr.includes(kw) ||
          typeStr.includes(kw)
        );
      });
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
            if (sortConfig === null) { sortableItems.sort((a, b) => Number(!!posVisibility[a.id] || !a.is_available) - Number(!!posVisibility[b.id] || !b.is_available)); }
    return sortableItems;
  }, [initialItems, sortConfig, activeChannelFilter, activeCategoryFilter, deferredSearch, isItemInChannel, posVisibility, posVisibilityFilter]);

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
    setRecipeItems([])
    setCopyNotice(null)
    setOutletSearch('')
    setModalTab('basic')
    resetImage(); setError(''); setShowForm(true)
  }

  function openEdit(item: MenuItem) {
    const formattedChannelPrices: Record<string, string> = {}
    if (item.channel_prices) {
      Object.entries(item.channel_prices).forEach(([k, v]) => {
        formattedChannelPrices[k] = String(v)
      })
    }
    
    setForm({
      id: item.id, name: item.name, description: item.description ?? '',
      price: String(item.price), 
      strike_price: item.strike_price ? String(item.strike_price) : '',
      campaign_price: item.campaign_price ? String(item.campaign_price) : '',
      is_campaign_active: item.is_campaign_active ?? false,
      base_price: String(item.price),
      channel_prices: formattedChannelPrices,
      category_id: item.category_id ?? '',
      is_available: item.is_available, 
      is_hidden_pos: posVisibility[item.id] ?? !!item.is_hidden_pos,
      is_available_online: item.is_available_online ?? true,
      is_published_order_online: item.is_published_order_online ?? false,
      tampil_di_app: item.tampil_di_app ?? false,
      available_online_channels: item.available_online_channels ?? null,
      image_url: item.image_url,
      is_package: item.is_package ?? false,
      package_items: item.package_items?.map(pi => ({ menu_item_id: pi.menu_item_id, or_menu_item_id: pi.or_menu_item_id, quantity: pi.quantity, temp_id: Math.random().toString() })) || [],
      outlet_ids: (item as any).available_outlets ? (item as any).available_outlets : (item.outlet_id ? [item.outlet_id] : null)
    })
    const existingRecipe = initialRecipes[item.id]?.resep_item || []
    setRecipeItems(existingRecipe.map(ri => ({
      temp_id: crypto.randomUUID(),
      bahan_baku_id: ri.bahan_baku_id,
      qty_per_porsi: ri.qty_per_porsi,
      satuan: ri.satuan || ''
    })))
    setCopyNotice(null)
    setOutletSearch('')
    setModalTab('basic')
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
      campaign_price: item.campaign_price ? String(item.campaign_price) : '',
      is_campaign_active: item.is_campaign_active ?? false,
      base_price: String(item.price),
      channel_prices: formattedChannelPrices,
      category_id: item.category_id ?? '',
      is_available: item.is_available, 
      is_hidden_pos: posVisibility[item.id] ?? !!item.is_hidden_pos,
      is_available_online: item.is_available_online ?? true,
      is_published_order_online: false,
      // Salinan tidak ikut terbit di aplikasi: menu duplikat biasanya masih
      // setengah jadi, dan menerbitkannya berarti pelanggan bisa memesannya.
      tampil_di_app: false,
      available_online_channels: item.available_online_channels ?? null,
      image_url: item.image_url,
      is_package: item.is_package ?? false,
      package_items: item.package_items?.map(pi => ({ menu_item_id: pi.menu_item_id, or_menu_item_id: pi.or_menu_item_id, quantity: pi.quantity, temp_id: Math.random().toString() })) || [],
      outlet_ids: (item as any).available_outlets ? (item as any).available_outlets : (item.outlet_id ? [item.outlet_id] : null)
    })
    const existingRecipe = initialRecipes[item.id]?.resep_item || []
    setRecipeItems(existingRecipe.map(ri => ({
      temp_id: crypto.randomUUID(),
      bahan_baku_id: ri.bahan_baku_id,
      qty_per_porsi: ri.qty_per_porsi,
      satuan: ri.satuan || ''
    })))
    setCopyNotice(`Data dan ${existingRecipe.length} bahan resep disalin dari ${item.name}!`)
    setOutletSearch('')
    setModalTab('basic')
    resetImage(); setError(''); setShowForm(true)
  }

  function handleCopyFrom(sourceId: string) {
    const source = initialItems.find(i => i.id === sourceId)
    if (!source) return

    const formattedChannelPrices: Record<string, string> = {}
    if (source.channel_prices) {
      Object.entries(source.channel_prices).forEach(([k, v]) => {
        formattedChannelPrices[k] = String(v)
      })
    }

    setForm(prev => ({
      ...prev,
      name: prev.name.trim() ? prev.name : `${source.name} (Salinan)`,
      description: prev.description.trim() ? prev.description : (source.description ?? ''),
      price: String(source.price),
      strike_price: source.strike_price ? String(source.strike_price) : '',
      campaign_price: source.campaign_price ? String(source.campaign_price) : '',
      is_campaign_active: source.is_campaign_active ?? false,
      base_price: String(source.price),
      channel_prices: formattedChannelPrices,
      category_id: source.category_id ?? prev.category_id,
      is_available: source.is_available,
      is_available_online: source.is_available_online ?? true,
      available_online_channels: source.available_online_channels ?? null,
      outlet_ids: (source as any).available_outlets ? (source as any).available_outlets : (source.outlet_id ? [source.outlet_id] : null),
      is_package: source.is_package ?? false,
      package_items: source.package_items?.map(pi => ({ menu_item_id: pi.menu_item_id, or_menu_item_id: pi.or_menu_item_id, quantity: pi.quantity, temp_id: Math.random().toString() })) || [],
    }))

    const sourceRecipe = initialRecipes[sourceId]?.resep_item || []
    setRecipeItems(sourceRecipe.map(ri => ({
      temp_id: crypto.randomUUID(),
      bahan_baku_id: ri.bahan_baku_id,
      qty_per_porsi: ri.qty_per_porsi,
      satuan: ri.satuan || ''
    })))

    setCopyNotice(`Data harga, kategori & ${sourceRecipe.length} bahan resep disalin dari ${source.name}!`)
  }

  function handleAddRecipeItem() {
    setRecipeItems(prev => [
      ...prev,
      { temp_id: crypto.randomUUID(), bahan_baku_id: '', qty_per_porsi: '', satuan: '' }
    ])
  }

  function handleRemoveRecipeItem(index: number) {
    setRecipeItems(prev => prev.filter((_, i) => i !== index))
  }

  function handleRecipeBahanChange(index: number, bahanId: string) {
    const bb = bahanList.find(b => b.id === bahanId)
    setRecipeItems(prev => {
      const next = [...prev]
      next[index] = {
        ...next[index],
        bahan_baku_id: bahanId,
        satuan: bb?.satuan_kecil || bb?.kemasan_satuan || bb?.satuan || ''
      }
      return next
    })
  }

  function handleRecipeQtyChange(index: number, val: string) {
    setRecipeItems(prev => {
      const next = [...prev]
      next[index] = {
        ...next[index],
        qty_per_porsi: val
      }
      return next
    })
  }

  async function handleQuickCreateBahan(e: React.FormEvent) {
    e.preventDefault()
    if (!quickBahanForm.nama.trim()) {
      setQuickBahanError('Nama bahan wajib diisi')
      return
    }
    if (!quickBahanForm.satuan.trim() || !quickBahanForm.satuan_kecil.trim()) {
      setQuickBahanError('Satuan beli & satuan resep wajib diisi')
      return
    }
    setQuickBahanLoading(true)
    setQuickBahanError('')
    try {
      const res = await quickCreateBahanBaku({
        nama: quickBahanForm.nama,
        satuan: quickBahanForm.satuan,
        satuan_kecil: quickBahanForm.satuan_kecil,
        faktor_konversi: Number(quickBahanForm.faktor_konversi) || 1,
        harga_beli: Number(quickBahanForm.harga_beli) || 0,
      })
      if (res?.ok && res.data) {
        const newBb = res.data
        setBahanList(prev => {
          if (prev.some(b => b.id === newBb.id)) return prev
          return [...prev, newBb]
        })
        setRecipeItems(prev => [
          ...prev,
          {
            temp_id: crypto.randomUUID(),
            bahan_baku_id: newBb.id,
            qty_per_porsi: '',
            satuan: newBb.satuan_kecil || newBb.satuan || ''
          }
        ])
        setShowQuickBahanModal(false)
        setQuickBahanForm({ nama: '', satuan: 'Pack', satuan_kecil: 'Pcs', faktor_konversi: '10', harga_beli: '' })
      }
    } catch (err: any) {
      setQuickBahanError(err?.message || 'Gagal membuat bahan baku')
    } finally {
      setQuickBahanLoading(false)
    }
  }

  function closeForm() { setShowForm(false); resetImage(); setError('') }

  useEffect(() => {
    if (!showForm) return
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape' && !showQuickBahanModal) {
        closeForm()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [showForm, showQuickBahanModal])

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
    const compressedFile = await compressImageToWebP(file, 800, 800, 0.8)
    const name = `${Date.now()}-${crypto.randomUUID().slice(0,8)}.webp`
    const { error: err } = await supabase.storage.from(BUCKET).upload(name, compressedFile, { contentType: 'image/webp' })
    setUploading(false)
    if (err) { setError(`Upload gagal: ${err.message}`); return null }
    return supabase.storage.from(BUCKET).getPublicUrl(name).data.publicUrl
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault(); setError('')
    const price = parseFloat(form.price)
    if (!form.name.trim()) { setModalTab('basic'); setError('Nama menu wajib diisi'); return }
    if (isNaN(price) || price < 0) { setModalTab('basic'); setError('Harga offline wajib diisi dan tidak boleh bernilai negatif'); return }

    if (price === 0) {
      const confirmZero = await showConfirm(`Menu "${form.name.trim()}" diatur dengan harga Rp 0 (Gratis). Apakah Anda yakin ingin menyimpan menu ini?`)
      if (!confirmZero) return
    }

    setSaving(true)
    let imgUrl = form.image_url

    if (imageFile) {
      if (form.id && form.image_url) await deleteStorageImage(form.image_url)
      imgUrl = await uploadImage(imageFile)
      if (!imgUrl) { setSaving(false); return }
    }

    let finalBasePrice = price
    const parsedChannelPrices: Record<string, number> = {}
    
    Object.entries(form.channel_prices).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '') {
        const p = parseFloat(v)
        if (!isNaN(p) && p >= 0) parsedChannelPrices[k] = p
      }
    })

    // Jika menu memiliki channel online spesifik (misal TikTok Go), pastikan channel_prices tersinkron jika belum diset
    if (form.available_online_channels && Array.isArray(form.available_online_channels)) {
      form.available_online_channels.forEach(ch => {
        const slug = ch.toLowerCase().replace(/\s+/g, '')
        if (slug !== 'pos_kasir') {
          if (parsedChannelPrices[slug] === undefined || parsedChannelPrices[slug] < 0) {
            parsedChannelPrices[slug] = finalBasePrice
          }
        }
      })
    }

    const recipeItemsToSave = form.is_package
      ? undefined
      : recipeItems
          .filter(r => r.bahan_baku_id && Number(r.qty_per_porsi) > 0)
          .map(r => ({
            bahan_baku_id: r.bahan_baku_id,
            qty_per_porsi: Number(r.qty_per_porsi),
            satuan: r.satuan || 'gram',
          }))

    const deliverySlugs = ['gofood', 'grabfood', 'shopeefood']
    const normAvailChannels = Array.isArray(form.available_online_channels)
      ? form.available_online_channels.map(c => c.toLowerCase().replace(/\s+/g, ''))
      : null
    const isDeliveryActiveOnSave =
      form.is_available_online &&
      (normAvailChannels === null || normAvailChannels.some(c => deliverySlugs.includes(c)))
    const isTiktokActiveOnSave =
      form.is_available_online &&
      (normAvailChannels === null || normAvailChannels.includes('tiktokgo') || normAvailChannels.includes('tiktok_go'))

    // Pastikan harga GoFood, GrabFood, ShopeeFood selalu seragam saat Food Apps aktif
    if (isDeliveryActiveOnSave) {
      const unifiedDeliveryPrice =
        parsedChannelPrices['gofood'] ??
        parsedChannelPrices['grabfood'] ??
        parsedChannelPrices['shopeefood'] ??
        parsedChannelPrices['all_food_apps'] ??
        finalBasePrice
      deliverySlugs.forEach(s => { parsedChannelPrices[s] = unifiedDeliveryPrice })
      parsedChannelPrices['all_food_apps'] = unifiedDeliveryPrice
      parsedChannelPrices['online'] = unifiedDeliveryPrice
    }

    // Pastikan TikTok Go memiliki harga jika aktif
    if (isTiktokActiveOnSave) {
      const tiktokPrice = parsedChannelPrices['tiktokgo'] ?? parsedChannelPrices['tiktok_go'] ?? finalBasePrice
      parsedChannelPrices['tiktokgo'] = tiktokPrice
      parsedChannelPrices['tiktok_go'] = tiktokPrice
    }

    const hasAnyOnlineFoodApp = isDeliveryActiveOnSave || isTiktokActiveOnSave

    const payload = {
      id: form.id ?? undefined,
      name: form.name.trim(), description: form.description.trim() || null,
      price: finalBasePrice, 
      strike_price: form.strike_price ? parseFloat(form.strike_price) : null,
      campaign_price: form.campaign_price ? parseFloat(form.campaign_price) : null,
      is_campaign_active: isTiktokActiveOnSave ? form.is_campaign_active : false,
      category_id: form.category_id || null,
      is_available: form.is_available, is_hidden_pos: form.is_hidden_pos, is_available_online: hasAnyOnlineFoodApp, is_published_order_online: form.is_published_order_online, tampil_di_app: form.tampil_di_app, available_online_channels: form.available_online_channels, image_url: imgUrl,
      channel_prices: parsedChannelPrices,
      is_package: form.is_package,
      package_items_to_save: form.is_package ? form.package_items.map(pi => ({ menu_item_id: pi.menu_item_id, or_menu_item_id: pi.or_menu_item_id, quantity: pi.quantity })) : [],
      outlet_id: form.outlet_ids && form.outlet_ids.length === 1 ? form.outlet_ids[0] : null,
      available_outlets: form.outlet_ids,
      recipe_items_to_save: recipeItemsToSave,
    }

    try {
      await saveMenuItem(payload as any)
      if (form.id) setPosVisibility(current => ({ ...current, [form.id!]: form.is_hidden_pos }))
      closeForm()
      router.refresh()
    } catch (err: any) {
      const errMsg = err?.message || String(err || '')
      if (errMsg.includes('Server Action') || errMsg.includes('not found on the server') || err?.digest?.includes('ACTION_NOT_FOUND')) {
        setError('Versi aplikasi di browser Anda usang. Memuat ulang halaman...')
        setTimeout(() => {
          window.location.reload()
        }, 600)
        return
      }
      setError(errMsg)
    }
    setSaving(false)
  }

  async function toggleAvail(item: MenuItem) {
    await toggleMenuAvailability(item.id, item.is_available)
  }

  async function togglePosVisibility(item: MenuItem) {
    const nextHidden = !posVisibility[item.id]
    setPosVisibilitySaving(current => [...current, item.id])
    try {
      const saved = await setMenuHiddenPos(item.id, nextHidden)
      setPosVisibility(current => ({ ...current, [item.id]: saved }))
    } catch (err: any) {
      await showAlert(err?.message || 'Gagal mengubah tampilan POS.', 'Gagal menyimpan')
    } finally {
      setPosVisibilitySaving(current => current.filter(id => id !== item.id))
    }
  }

  async function togglePublished(item: MenuItem) {
    try { await toggleMenuPublished(item.id, item.is_published_order_online === true) }
    catch (err: any) { setError(err?.message || 'Sinkronisasi gagal') }
  }

  async function toggleApp(item: MenuItem) {
    try { await toggleTampilDiApp(item.id, item.tampil_di_app === true) }
    catch (err: any) { setError(err?.message || 'Gagal mengubah tayang aplikasi') }
  }

  async function deleteItem(item: MenuItem) {
    const confirmed = await showConfirm(`Hapus "${item.name}"?`);
    if (!confirmed) return
    try {
      const hasil = await deleteMenuItem(item.id, item.image_url)
      if (hasil.ok) return
      if (!hasil.bisaNonaktif) { await showAlert(hasil.alasan, 'Menu tidak dihapus'); return }
      const nonaktifkan = await showConfirm(hasil.alasan, 'Menu tidak bisa dihapus', 'Nonaktifkan')
      if (!nonaktifkan) return
      const h2 = await nonaktifkanMenu(item.id)
      if (h2.ok) { setPosVisibility(current => ({ ...current, [item.id]: true })); router.refresh(); }
      await showAlert(h2.ok ? `"${item.name}" dinonaktifkan & disembunyikan dari POS. Riwayat penjualan & HPP-nya tetap tersimpan.` : h2.alasan,
        h2.ok ? 'Berhasil' : 'Gagal menonaktifkan')
    } catch (err: any) {
      await showAlert(err?.message || 'Terjadi kesalahan saat menghapus menu.', 'Gagal')
    }
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
    try {
      const hasil = await deleteAllMenuItems(initialItems)
      await showAlert(hasil.pesan ?? `${hasil.dihapus} menu dihapus.`, 'Hapus menu')
    } catch (err: any) {
      await showAlert(err?.message || 'Terjadi kesalahan saat menghapus menu.', 'Gagal')
    } finally {
      setDeletingAll(false)
    }
  }

  const displayImage = preview ?? form.image_url

  const normFormChannels = Array.isArray(form.available_online_channels)
    ? form.available_online_channels.map(c => c.toLowerCase().replace(/\s+/g, ''))
    : null

  const isWalkinChannelActive =
    normFormChannels === null ||
    (normFormChannels.length === 0 && !form.is_available_online) ||
    normFormChannels.includes('pos_kasir')

  const isDeliveryChannelActive =
    form.is_available_online &&
    (normFormChannels === null ||
      normFormChannels.some(c => ['gofood', 'grabfood', 'shopeefood'].includes(c)))

  const isTiktokChannelActive =
    form.is_available_online &&
    (normFormChannels === null ||
      normFormChannels.includes('tiktokgo') ||
      normFormChannels.includes('tiktok_go'))

  const activeChannelCount =
    (isWalkinChannelActive ? 1 : 0) +
    (isDeliveryChannelActive ? 1 : 0) +
    (isTiktokChannelActive ? 1 : 0) +
    (form.tampil_di_app ? 1 : 0) +
    (form.is_published_order_online ? 1 : 0)

  

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Manajemen Menu</h1>
          <p className="text-gray-400 text-sm mt-0.5">{sortedItems.length} menu ditampilkan ({initialItems.length} total)</p>
          <p className="text-gray-500 text-xs mt-1">Tampilan POS menyembunyikan menu di kasir untuk semua outlet terkait, tanpa mengubah stok atau kanal pelanggan.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Search Input */}
          <div className="relative w-full sm:w-auto sm:min-w-[280px]">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
              <Search className="h-4 w-4" />
            </div>
            <input
              type="text"
              className="block w-full pl-9 pr-9 py-2.5 border border-slate-200 rounded-2xl text-sm bg-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-amber-500 transition-all font-semibold shadow-xs text-slate-900"
              placeholder="Cari menu, kategori, deskripsi..."
              value={searchVal}
              onChange={(e) => setSearchVal(e.target.value)}
            />
            {searchVal && (
              <button
                onClick={() => setSearchVal('')}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-700 transition-colors cursor-pointer"
                title="Hapus pencarian (Esc)"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

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

      {/* Active Search Result Banner */}
      {deferredSearch.trim() && (
        <div className="flex items-center justify-between gap-3 bg-amber-50/90 border border-amber-200/80 text-amber-900 px-4 py-2.5 rounded-2xl text-xs font-bold shadow-xs animate-in fade-in duration-150">
          <div className="flex items-center gap-2">
            <Search size={14} className="text-amber-600 shrink-0" />
            <span>Pencarian: &quot;<strong className="text-amber-950">{deferredSearch}</strong>&quot; — <strong>{sortedItems.length}</strong> dari {initialItems.length} menu ditemukan</span>
          </div>
          <button
            onClick={() => { setSearchVal(''); setActiveCategoryFilter('all'); }}
            className="text-amber-700 hover:text-amber-950 underline font-extrabold cursor-pointer shrink-0"
          >
            Reset Filter
          </button>
        </div>
      )}


      {/* Filters Container */}
      <div className="flex flex-col gap-3">
        {/* Channel Filter Dropdown (custom, non-native) */}
        <div className="bg-white p-3 rounded-2xl border border-gray-100 shadow-xs flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1 bg-gray-50 p-1 rounded-xl border border-gray-200">
            <button type="button" onClick={() => setPosVisibilityFilter('visible')} className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${posVisibilityFilter === 'visible' ? 'bg-gray-900 text-white shadow-xs' : 'text-gray-600 hover:text-gray-900'}`}>
              Tampil di POS ({initialItems.filter(i => !posVisibility[i.id]).length})
            </button>
            <button type="button" onClick={() => setPosVisibilityFilter('hidden')} className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${posVisibilityFilter === 'hidden' ? 'bg-gray-900 text-white shadow-xs' : 'text-gray-600 hover:text-gray-900'}`}>
              Disembunyikan ({initialItems.filter(i => !!posVisibility[i.id]).length})
            </button>
            <button type="button" onClick={() => setPosVisibilityFilter('all')} className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${posVisibilityFilter === 'all' ? 'bg-gray-900 text-white shadow-xs' : 'text-gray-600 hover:text-gray-900'}`}>
              Semua ({initialItems.length})
            </button>
          </div>
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

        {/* Category Filter Pills */}
        <div className="flex gap-2 overflow-x-auto pb-1.5 scrollbar-hide">
          <button
            onClick={() => setActiveCategoryFilter('all')}
            className={`px-3.5 py-1.5 rounded-lg text-sm font-bold whitespace-nowrap transition-all ${activeCategoryFilter === 'all' ? 'bg-gray-900 text-white shadow-md' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'}`}
          >
            Semua Kategori
          </button>
          {initialCategories.map((c) => (
            <button
              key={c.id}
              onClick={() => setActiveCategoryFilter(c.id)}
              className={`px-3.5 py-1.5 rounded-lg text-sm font-bold whitespace-nowrap transition-all ${activeCategoryFilter === c.id ? 'bg-gray-900 text-white shadow-md' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'}`}
            >
              {c.name}
            </button>
          ))}
        </div>
      </div>

      <MenuFormModal
        open={showForm}
        form={form}
        setForm={setForm}
        modalTab={modalTab}
        setModalTab={setModalTab}
        onClose={closeForm}
        onSubmit={handleSave}
        saving={saving}
        uploading={uploading}
        error={error}
        copyNotice={copyNotice}
        onDismissCopyNotice={() => setCopyNotice(null)}
        displayImage={displayImage}
        preview={preview}
        resetImage={resetImage}
        fileRef={fileRef}
        onFileChange={handleFile}
        initialItems={initialItems}
        initialCategories={initialCategories}
        initialOutlets={initialOutlets}
        onCopyFrom={handleCopyFrom}
        slugAplikasi={SLUG_APLIKASI}
        outletSearch={outletSearch}
        setOutletSearch={setOutletSearch}
        activeChannelCount={activeChannelCount}
        recipeItems={recipeItems}
        bahanList={bahanList}
        hppResult={hppResult}
        onAddRecipeItem={handleAddRecipeItem}
        onRemoveRecipeItem={handleRemoveRecipeItem}
        onRecipeBahanChange={handleRecipeBahanChange}
        onRecipeQtyChange={handleRecipeQtyChange}
        onOpenQuickBahan={() => setShowQuickBahanModal(true)}
        renderChannelIcon={(slug) => <ChannelLogoIcon channelKey={slug} />}
      />

      {showQuickBahanModal && createPortal(
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-xs z-[60] flex items-center justify-center p-4"
          onClick={(e) => { if (e.target === e.currentTarget && !quickBahanLoading) setShowQuickBahanModal(false) }}
        >
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md p-6 border border-slate-100 animate-scale-in space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center font-bold">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-slate-900 text-base">Buat Bahan Baku Baru</h3>
                  <p className="text-xs text-slate-500 font-medium">Bahan langsung terhubung dan siap dipakai di resep</p>
                </div>
              </div>
              <button
                type="button"
                disabled={quickBahanLoading}
                onClick={() => setShowQuickBahanModal(false)}
                className="w-8 h-8 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {quickBahanError && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-xs font-semibold">
                {quickBahanError}
              </div>
            )}

            <form onSubmit={handleQuickCreateBahan} className="space-y-3.5">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Nama Bahan Baku <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={quickBahanForm.nama}
                  onChange={(e) => setQuickBahanForm({ ...quickBahanForm, nama: e.target.value })}
                  placeholder="Cth: SOSIS JUMBO"
                  className="input bg-slate-50 focus:bg-white text-xs font-bold uppercase"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Satuan Beli (Besar) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={quickBahanForm.satuan}
                    onChange={(e) => setQuickBahanForm({ ...quickBahanForm, satuan: e.target.value })}
                    placeholder="Cth: Pack / Kg / Pouch"
                    className="input bg-slate-50 focus:bg-white text-xs font-semibold"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Satuan Resep (Kecil) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={quickBahanForm.satuan_kecil}
                    onChange={(e) => setQuickBahanForm({ ...quickBahanForm, satuan_kecil: e.target.value })}
                    placeholder="Cth: Pcs / Gram / Lembar"
                    className="input bg-slate-50 focus:bg-white text-xs font-semibold"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Isi per Satuan Beli
                  </label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={quickBahanForm.faktor_konversi}
                    onChange={(e) => setQuickBahanForm({ ...quickBahanForm, faktor_konversi: e.target.value })}
                    placeholder="10"
                    className="input bg-slate-50 focus:bg-white text-xs font-bold text-right"
                  />
                  <span className="text-[10px] text-slate-400 block mt-0.5 font-medium">
                    1 {quickBahanForm.satuan || 'Satuan'} = {quickBahanForm.faktor_konversi || 1} {quickBahanForm.satuan_kecil || 'satuan kecil'}
                  </span>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Harga Beli (Rp)
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={quickBahanForm.harga_beli}
                    onChange={(e) => setQuickBahanForm({ ...quickBahanForm, harga_beli: e.target.value })}
                    placeholder="0"
                    className="input bg-slate-50 focus:bg-white text-xs font-bold text-right"
                  />
                  <span className="text-[10px] text-slate-400 block mt-0.5 font-medium">
                    Harga per {quickBahanForm.satuan || 'satuan besar'}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  disabled={quickBahanLoading}
                  onClick={() => setShowQuickBahanModal(false)}
                  className="flex-1 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-all cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={quickBahanLoading}
                  className="flex-1 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold shadow-md shadow-amber-500/20 flex items-center justify-center gap-2 transition-all cursor-pointer"
                >
                  {quickBahanLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Simpan & Pakai'}
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body,
      )}

      {/* ── Menu Grid / Table ────────────────────────────── */}
      {initialItems.length === 0 ? (
        <div className="bg-white rounded-3xl border border-slate-100 p-12 sm:p-16 flex flex-col items-center justify-center text-center shadow-xs animate-in fade-in duration-200 my-4">
          <div className="w-20 h-20 bg-gradient-to-b from-amber-50 to-orange-100 rounded-3xl border border-amber-200/60 flex items-center justify-center mb-4 shadow-sm">
            <Sandwich className="w-10 h-10 text-amber-500" strokeWidth={1.5} />
          </div>
          <h3 className="text-xl font-extrabold text-slate-900 tracking-tight mb-1">Belum Ada Menu POS</h3>
          <p className="text-sm font-medium text-slate-500 max-w-sm mb-6">Daftar menu POS Anda masih kosong. Mulai tambahkan menu makanan &amp; minuman pertama Anda.</p>
          <button onClick={openAdd} className="btn-primary py-2.5 px-6 text-sm font-bold shadow-md">
            <Plus className="w-4 h-4" />
            Tambah Menu Pertama
          </button>
        </div>
      ) : sortedItems.length === 0 ? (
        <SearchEmptyVector
          query={deferredSearch}
          channelLabel={selectedChannelOption.label}
          onReset={() => {
            setSearchVal('')
            setActiveCategoryFilter('all')
            setActiveChannelFilter('')
            setPosVisibilityFilter('visible')
          }}
        />
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
                      {(() => {
                        if (!activeChannelFilter || activeChannelFilter === 'all') return 'Informasi Harga';
                        if (activeChannelFilter === 'pos_kasir') return 'Harga Offline (Kasir Toko)';
                        if (activeChannelFilter === 'online_only') return 'Harga Khusus Online (Non-Offline)';
                        if (activeChannelFilter === 'all_food_apps') return 'Harga Online Food Apps';
                        const ch = initialChannels.find(c => c.id === activeChannelFilter || c.name.toLowerCase().replace(/\s+/g, '') === activeChannelFilter.toLowerCase().replace(/\s+/g, ''));
                        if (ch) return `Harga ${ch.name}`;
                        if (activeChannelFilter === 'tiktokgo' || activeChannelFilter === 'tiktok_go') return 'Harga TikTok Go';
                        return `Harga ${activeChannelFilter}`;
                      })()}
                      {getSortIcon('price')}
                    </div>
                  </th>
                  <th className="text-center py-3.5 px-4 font-semibold text-gray-500">Tampilan POS</th>
                  <th className="text-center py-3.5 px-4 font-semibold text-gray-500">Order Online</th>
                  <th className="text-center py-3.5 px-4 font-semibold text-gray-500">Aplikasi</th>
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
                        <MenuPromoBadge item={item} promos={initialPromos} now={promoNow} />

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
                            if (item.available_online_channels === null || item.available_online_channels === undefined) return true;
                            if (!Array.isArray(item.available_online_channels)) return false;
                            return item.available_online_channels.some(
                              c => c.toLowerCase().replace(/\s+/g, '') === slug || (slug === 'tiktokgo' && (c === 'tiktokgo' || c === 'tiktok_go'))
                            );
                          };


                          const isRealInChannel = (slug: string) => {
                            return hasExplicitChannel(slug);
                          };

                          const isOfflineAvailable = item.is_available !== false && (
                            item.available_online_channels === null ||
                            item.available_online_channels === undefined ||
                            !Array.isArray(item.available_online_channels) ||
                            item.available_online_channels.includes('pos_kasir')
                          );

                          const showPosKasirBadge = !isSpecificFoodApp && activeSlug !== 'all_food_apps' && isOfflineAvailable;

                          return (
                            <>
                              {showPosKasirBadge && (
                                <span className="text-[10px] bg-amber-50 text-amber-700 border border-amber-200 px-1.5 py-0.5 rounded font-bold">Offline</span>
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

                    {/* Price (Offline, Food Apps & TikTok Go) */}
                    <td className="py-3.5 px-4 text-right">
                      {(() => {
                        const offlinePrice = item.price;
                        const pricesObj = item.channel_prices || {};
                        const activeSlug = activeChannelFilter ? getSlug(activeChannelFilter) : '';
                        const deliverySlugs = ['gofood', 'grabfood', 'shopeefood'];
                        const normChs = Array.isArray(item.available_online_channels)
                          ? item.available_online_channels.map(c => c.toLowerCase().replace(/\s+/g, ''))
                          : null;

                        const isChannelOffline =
                          normChs === null ||
                          (normChs.length === 0 && item.is_available_online === false) ||
                          normChs.includes('pos_kasir');

                        const isDeliveryActive =
                          item.is_available_online !== false &&
                          (normChs === null || normChs.some(c => deliverySlugs.includes(c)));

                        const isTiktokActive =
                          item.is_available_online !== false &&
                          (normChs === null || normChs.includes('tiktokgo') || normChs.includes('tiktok_go'));

                        // 1. Skenario Filter Channel Spesifik (GoFood, GrabFood, ShopeeFood, TikTok Go, Offline)
                        if (activeSlug && !['all_food_apps', ''].includes(activeSlug)) {
                          let displayPrice: string | null = null;
                          let numericP: number | null = null;

                          if (activeSlug === 'pos_kasir') {
                            numericP = offlinePrice;
                            displayPrice = formatRupiah(offlinePrice);
                          } else if (item.is_available_online !== false) {
                            const rawP =
                              pricesObj[activeSlug] ??
                              (activeSlug === 'tiktokgo' ? pricesObj['tiktok_go'] : undefined) ??
                              (deliverySlugs.includes(activeSlug) ? (pricesObj['gofood'] ?? pricesObj['grabfood'] ?? pricesObj['shopeefood'] ?? pricesObj['all_food_apps']) : undefined);
                            if (rawP !== undefined && rawP !== null && !isNaN(Number(rawP)) && Number(rawP) >= 0) {
                              numericP = Number(rawP);
                              displayPrice = formatRupiah(numericP);
                            }
                          }

                          if (!displayPrice) {
                            return <span className="text-xs font-bold text-slate-400 font-mono">—</span>;
                          }

                          return (
                            <div className="flex flex-col items-end gap-0.5">
                              {item.strike_price && numericP && item.strike_price > numericP && (
                                <span className="text-xs text-gray-400 line-through decoration-gray-400/50">
                                  {formatRupiah(item.strike_price)}
                                </span>
                              )}
                              <span className="text-sm font-bold text-gray-900 font-mono">
                                {displayPrice}
                              </span>
                            </div>
                          );
                        }

                        // Hitung harga Food Apps (GoFood / GrabFood / ShopeeFood) secara terpisah dari TikTok Go
                        let deliveryDisplay: string | null = null;
                        if (isDeliveryActive) {
                          const deliveryVals = deliverySlugs
                            .filter(s => normChs === null || normChs.includes(s))
                            .map(s => pricesObj[s])
                            .filter(v => v !== undefined && v !== null && !isNaN(Number(v)) && Number(v) >= 0)
                            .map(v => Number(v));

                          if (deliveryVals.length === 0) {
                            const fallback = pricesObj['all_food_apps'] ?? pricesObj['online'];
                            if (fallback !== undefined && fallback !== null && !isNaN(Number(fallback)) && Number(fallback) >= 0) {
                              deliveryVals.push(Number(fallback));
                            }
                          }

                          if (deliveryVals.length > 0) {
                            const minP = Math.min(...deliveryVals);
                            const maxP = Math.max(...deliveryVals);
                            deliveryDisplay = minP === maxP ? formatRupiah(minP) : `${formatRupiah(minP)} - ${formatRupiah(maxP)}`;
                          } else {
                            deliveryDisplay = formatRupiah(offlinePrice);
                          }
                        }

                        // Hitung harga TikTok Go tersendiri
                        let tiktokDisplay: string | null = null;
                        if (isTiktokActive) {
                          const rawTk = pricesObj['tiktokgo'] ?? pricesObj['tiktok_go'];
                          const tkNum =
                            rawTk !== undefined && rawTk !== null && !isNaN(Number(rawTk)) && Number(rawTk) >= 0
                              ? Number(rawTk)
                              : offlinePrice;
                          tiktokDisplay = formatRupiah(tkNum);
                        }

                        // 2. Skenario Umum: tampilkan badge terpisah untuk Offline, Food Apps, dan TikTok Go
                        return (
                          <div className="flex flex-col items-end gap-1">
                            {item.strike_price && item.strike_price > offlinePrice && (
                              <span className="text-xs text-gray-400 line-through decoration-gray-400/50">
                                {formatRupiah(item.strike_price)}
                              </span>
                            )}
                            {isChannelOffline && (
                              <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-lg bg-amber-50/90 border border-amber-200/80 shadow-2xs" title="Harga Jual Offline Kasir Toko">
                                <span className="text-[10px] font-extrabold text-amber-700 uppercase tracking-wider">Offline:</span>
                                <span className="text-xs font-black text-amber-950 font-mono">{formatRupiah(offlinePrice)}</span>
                              </div>
                            )}
                            {deliveryDisplay && (
                              <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-lg bg-emerald-50/90 border border-emerald-200/80 shadow-2xs" title="Harga GoFood, GrabFood & ShopeeFood">
                                <span className="text-[10px] font-extrabold text-emerald-700 uppercase tracking-wider">Food Apps:</span>
                                <span className="text-xs font-black text-emerald-950 font-mono">{deliveryDisplay}</span>
                              </div>
                            )}
                            {tiktokDisplay && (
                              <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-lg bg-slate-100/90 border border-slate-300/80 shadow-2xs" title={item.is_campaign_active && item.campaign_price ? `TikTok Go (Campaign: ${formatRupiah(item.campaign_price)})` : 'Harga TikTok Go'}>
                                <span className="text-[10px] font-extrabold text-slate-700 uppercase tracking-wider">TikTok Go:</span>
                                <span className="text-xs font-black text-slate-900 font-mono">{tiktokDisplay}</span>
                              </div>
                            )}
                          </div>
                        );
                      })()}
                    </td>

                    <td className="py-3.5 px-4 text-center">
                      <button type="button" onClick={() => togglePosVisibility(item)} disabled={posVisibilitySaving.includes(item.id)}
                        aria-pressed={!!posVisibility[item.id]}
                        aria-label={`${posVisibility[item.id] ? 'Tampilkan' : 'Sembunyikan'} ${item.name} di POS`}
                        title="Berlaku di seluruh outlet yang memiliki menu ini; tidak mengubah stok atau tayangan pelanggan"
                        className={`inline-flex items-center gap-1.5 text-[11px] font-bold px-3 py-1.5 rounded-full border transition-colors cursor-pointer disabled:opacity-50 ${posVisibility[item.id] ? 'bg-slate-100 text-slate-600 border-slate-300 hover:bg-slate-200' : 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'}`}>
                        {posVisibility[item.id] ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                        {posVisibilitySaving.includes(item.id) ? 'Menyimpan...' : posVisibility[item.id] ? 'Disembunyikan' : 'Tampil di POS'}
                      </button>
                      {/\(online\)/i.test(item.name) && !posVisibility[item.id] && <p className="text-[10px] text-slate-500 mt-1">Varian Online tidak tampil di Offline</p>}
                    </td>

                    {/* Order-Online publish status */}
                    <td className="py-3.5 px-4 text-center">
                      <div className="flex flex-col items-center gap-1.5">
                        <button onClick={() => togglePublished(item)} className={`text-[11px] font-bold px-2.5 py-1 rounded-full ${item.is_published_order_online ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-100 text-gray-500'}`}>
                          {item.is_published_order_online ? 'Tayang Website' : 'Tidak tayang'}
                        </button>
                        {item.is_published_order_online && item.order_online_sync_status !== 'synced' && (
                          <button onClick={() => retryMenuOnlineSync(item.id)} className="text-[10px] text-amber-600 hover:underline">
                            {item.order_online_sync_status === 'failed' ? 'Retry' : 'Sinkronkan'}
                          </button>
                        )}
                        {item.order_online_sync_status === 'pending' && <span className="text-[10px] text-amber-500">Pending</span>}
                        {item.order_online_sync_status === 'failed' && <span className="text-[10px] text-red-500" title={item.order_online_sync_error || undefined}>Gagal</span>}
                      </div>
                    </td>

                    {/* Tayang di SukaShawarma APP */}
                    <td className="py-3.5 px-4 text-center">
                      <button onClick={() => toggleApp(item)} className={`text-[11px] font-bold px-2.5 py-1 rounded-full ${item.tampil_di_app ? 'bg-amber-50 text-amber-700' : 'bg-gray-100 text-gray-500'}`}>
                        {item.tampil_di_app ? 'Tayang Aplikasi' : 'Tidak tayang'}
                      </button>
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
                        <button
                          type="button"
                          onClick={() => togglePosVisibility(item)}
                          disabled={posVisibilitySaving.includes(item.id)}
                          className={`w-8 h-8 rounded-xl flex items-center justify-center transition-colors cursor-pointer disabled:opacity-50 ${
                            posVisibility[item.id]
                              ? 'bg-slate-200 hover:bg-emerald-100 text-slate-700 hover:text-emerald-700'
                              : 'bg-slate-50 hover:bg-slate-200 text-slate-500 hover:text-slate-800'
                          }`}
                          title={posVisibility[item.id] ? 'Tampilkan kembali di POS' : 'Hide dari POS (Tanpa Hapus)'}
                        >
                          {posVisibility[item.id] ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                        </button>
                        <button onClick={() => deleteItem(item)}
                          className="w-8 h-8 bg-gray-50 hover:bg-red-50 text-gray-300 hover:text-red-500
                            rounded-xl flex items-center justify-center transition-all"
                          title="Hapus">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                        <div className="relative">
                          <button onClick={(e) => {
                            if (openDropdownId === item.id) {
                              setOpenDropdownId(null);
                              setDropdownPos(null);
                            } else {
                              const rect = e.currentTarget.getBoundingClientRect();
                              setDropdownPos({ top: rect.bottom + 4, right: window.innerWidth - rect.right });
                              setOpenDropdownId(item.id);
                            }
                          }}
                            className="w-8 h-8 bg-gray-50 hover:bg-gray-100 text-gray-400 hover:text-gray-600 rounded-xl flex items-center justify-center transition-all">
                            <MoreVertical className="w-3.5 h-3.5" />
                          </button>
                          {openDropdownId === item.id && dropdownPos && typeof document !== 'undefined' && createPortal(
                            <>
                              <div className="fixed inset-0 z-[90]" onClick={() => { setOpenDropdownId(null); setDropdownPos(null); }} />
                              <div 
                                className="fixed z-[100] w-52 bg-white rounded-xl shadow-[0_4px_20px_-4px_rgba(0,0,0,0.15)] border border-gray-100 p-2 text-left origin-top-right animate-in fade-in zoom-in-95 duration-100"
                                style={{ top: dropdownPos.top, right: dropdownPos.right }}
                              >
                                <button onClick={() => { togglePosVisibility(item); setOpenDropdownId(null) }} className="w-full text-left px-3 py-2.5 hover:bg-gray-50 rounded-lg text-[13px] flex items-center justify-between transition-colors border-b border-gray-100 mb-1">
                                  <span className="flex items-center gap-2 font-bold text-slate-700">
                                    {posVisibility[item.id] ? <Eye className="w-3.5 h-3.5 text-emerald-600" /> : <EyeOff className="w-3.5 h-3.5 text-slate-500" />}
                                    {posVisibility[item.id] ? 'Tampilkan di POS' : 'Hide dari POS'}
                                  </span>
                                </button>
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
                            </>,
                            document.body
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



