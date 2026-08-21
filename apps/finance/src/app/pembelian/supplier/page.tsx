// @ts-nocheck
'use client'

import { useState, useMemo } from 'react'
import {
  Plus,
  Edit3,
  Trash2,
  Phone,
  MapPin,
  Tag,
  Truck,
  Package,
  Layers,
  Search,
  LayoutGrid,
  List,
  Copy,
  Clock,
  Check,
  X,
  MessageCircle,
  ChevronRight,
  AlertTriangle,
  ArrowUpDown,
  FilterX,
  CheckCircle2,
  Download,
  ExternalLink,
  ShoppingBag,
  Info,
} from 'lucide-react'
import {
  useSuppliers,
  useCreateSupplier,
  useUpdateSupplier,
  useDeleteSupplier,
  useBahanBakuOptions,
  type Supplier,
  type BahanBakuOption,
} from '@/hooks/usePurchaseOrder'
import { Spinner } from '@suka/design-system'
import { toast } from 'sonner'
import { PageHeader, StatCard } from '@/components/ui'
import CountUp from 'react-countup'
import { motion, AnimatePresence } from 'framer-motion'
import Link from 'next/link'

// ─── Constants & Metadata ──────────────────────────────────────────────────

const KATEGORI_OPTIONS = [
  { value: 'item core', label: 'Item Core', icon: '⭐', color: 'bg-amber-50 text-amber-700 border-amber-200' },
  { value: 'bumbu', label: 'Bumbu', icon: '🧂', color: 'bg-orange-50 text-orange-700 border-orange-200' },
  { value: 'kemasan', label: 'Kemasan', icon: '📦', color: 'bg-blue-50 text-blue-700 border-blue-200' },
  { value: 'minuman', label: 'Minuman', icon: '🧃', color: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  { value: 'lain-lain', label: 'Lain-lain', icon: '🏷️', color: 'bg-stone-100 text-stone-700 border-stone-200' },
]

const TERMIN_PRESETS = [
  { value: 0, label: 'Tunai (0 Hari)' },
  { value: 7, label: 'Tempo 7 Hari' },
  { value: 14, label: 'Tempo 14 Hari' },
  { value: 30, label: 'Tempo 30 Hari' },
  { value: 45, label: 'Tempo 45 Hari' },
]

function cleanPhoneForWhatsApp(phone: string | null): string | null {
  if (!phone) return null
  let cleaned = phone.replace(/[^0-9]/g, '')
  if (cleaned.startsWith('0')) {
    cleaned = '62' + cleaned.slice(1)
  } else if (cleaned.startsWith('8')) {
    cleaned = '62' + cleaned
  }
  return cleaned.length >= 9 ? cleaned : null
}

function getAvatarColor(nama: string): string {
  const colors = [
    'from-amber-600 to-orange-700 text-white',
    'from-emerald-600 to-teal-700 text-white',
    'from-blue-600 to-indigo-700 text-white',
    'from-rose-600 to-red-700 text-white',
    'from-purple-600 to-indigo-800 text-white',
    'from-stone-700 to-stone-900 text-white',
  ]
  let sum = 0
  for (let i = 0; i < (nama || '').length; i++) sum += nama.charCodeAt(i)
  return colors[sum % colors.length]
}

function getInitials(nama: string): string {
  const parts = (nama || 'SP').trim().split(/\s+/)
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[1][0]).toUpperCase()
}

// ─── Main Page Component ───────────────────────────────────────────────────

export default function SupplierPage() {
  const { data: suppliers = [], isLoading } = useSuppliers()
  const { data: bahanList = [] } = useBahanBakuOptions()
  const createSupplier = useCreateSupplier()
  const updateSupplier = useUpdateSupplier()
  const deleteSupplier = useDeleteSupplier()

  // View & Filter States
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('table')
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedKategori, setSelectedKategori] = useState('all')
  const [selectedTermin, setSelectedTermin] = useState('all')
  const [sortBy, setSortBy] = useState<'nama_asc' | 'nama_desc' | 'items_desc' | 'termin_asc' | 'termin_desc'>('nama_asc')

  // Modal / Drawer States
  const [showModal, setShowModal] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [detailSupplier, setDetailSupplier] = useState<Supplier | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Supplier | null>(null)

  // Form State
  const [form, setForm] = useState({
    nama: '',
    kontak: '',
    alamat: '',
    catatan: '',
    kategori: '',
    termin_hari: null as number | null,
    bahan_baku_ids: [] as string[],
  })
  const [bahanSearch, setBahanSearch] = useState('')

  // Map for fast bahan baku lookup
  const bahanMap = useMemo(() => {
    const map = new Map<string, BahanBakuOption>()
    bahanList.forEach((b) => map.set(b.id, b))
    return map
  }, [bahanList])

  // Calculations for Metrics
  const totalBahanSuplaiCount = useMemo(() => {
    const set = new Set<string>()
    suppliers.forEach((s) => s.bahan_baku_ids?.forEach((bId) => set.add(bId)))
    return set.size
  }, [suppliers])

  const kategoriCount = useMemo(() => {
    const set = new Set<string>()
    suppliers.forEach((s) => s.kategori && set.add(s.kategori))
    return set.size
  }, [suppliers])

  const avgTermin = useMemo(() => {
    const withTermin = suppliers.filter((s) => s.termin_hari != null && s.termin_hari > 0)
    if (withTermin.length === 0) return 0
    const total = withTermin.reduce((acc, curr) => acc + (curr.termin_hari || 0), 0)
    return Math.round(total / withTermin.length)
  }, [suppliers])

  // Category counts for filter tabs
  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = { all: suppliers.length }
    KATEGORI_OPTIONS.forEach((k) => {
      counts[k.value] = suppliers.filter((s) => s.kategori === k.value).length
    })
    return counts
  }, [suppliers])

  // Filtered & Sorted Suppliers
  const filteredSuppliers = useMemo(() => {
    let result = [...suppliers]

    // 1. Search Query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim()
      result = result.filter((s) => {
        const matchName = (s.nama || '').toLowerCase().includes(q)
        const matchContact = (s.kontak || '').toLowerCase().includes(q)
        const matchAddress = (s.alamat || '').toLowerCase().includes(q)
        const matchNotes = (s.catatan || '').toLowerCase().includes(q)
        const matchIngredients = (s.bahan_baku_ids || []).some((bId) => {
          const item = bahanMap.get(bId)
          return item ? item.nama.toLowerCase().includes(q) : false
        })
        return matchName || matchContact || matchAddress || matchNotes || matchIngredients
      })
    }

    // 2. Category Filter
    if (selectedKategori !== 'all') {
      result = result.filter((s) => s.kategori === selectedKategori)
    }

    // 3. Payment Term Filter
    if (selectedTermin === 'cash') {
      result = result.filter((s) => !s.termin_hari || s.termin_hari === 0)
    } else if (selectedTermin === 'tempo_1_14') {
      result = result.filter((s) => s.termin_hari != null && s.termin_hari >= 1 && s.termin_hari <= 14)
    } else if (selectedTermin === 'tempo_15_30') {
      result = result.filter((s) => s.termin_hari != null && s.termin_hari >= 15 && s.termin_hari <= 30)
    } else if (selectedTermin === 'tempo_gt_30') {
      result = result.filter((s) => s.termin_hari != null && s.termin_hari > 30)
    }

    // 4. Sorting
    result.sort((a, b) => {
      if (sortBy === 'nama_asc') return (a.nama || '').localeCompare(b.nama || '')
      if (sortBy === 'nama_desc') return (b.nama || '').localeCompare(a.nama || '')
      if (sortBy === 'items_desc') return (b.bahan_baku_ids?.length || 0) - (a.bahan_baku_ids?.length || 0)
      if (sortBy === 'termin_asc') return (a.termin_hari || 0) - (b.termin_hari || 0)
      if (sortBy === 'termin_desc') return (b.termin_hari || 0) - (a.termin_hari || 0)
      return 0
    })

    return result
  }, [suppliers, searchQuery, selectedKategori, selectedTermin, sortBy, bahanMap])

  // Filtered Bahan Baku for Modal Selector
  const modalFilteredBahan = useMemo(() => {
    if (!bahanSearch.trim()) return bahanList
    const q = bahanSearch.toLowerCase()
    return bahanList.filter((b) => (b.nama || '').toLowerCase().includes(q))
  }, [bahanList, bahanSearch])

  // Export CSV Handler
  function handleExportCSV() {
    if (filteredSuppliers.length === 0) {
      toast.error('Tidak ada data untuk diekspor')
      return
    }

    const headers = ['Nama Supplier', 'Kategori', 'Kontak', 'Alamat', 'Termin (Hari)', 'Bahan Baku Disuplai', 'Catatan']
    const rows = filteredSuppliers.map((s) => {
      const bahanNames = (s.bahan_baku_ids || [])
        .map((bId) => bahanMap.get(bId)?.nama)
        .filter(Boolean)
        .join(', ')

      return [
        `"${(s.nama || '').replace(/"/g, '""')}"`,
        `"${(s.kategori || 'Umum').replace(/"/g, '""')}"`,
        `"${(s.kontak || '').replace(/"/g, '""')}"`,
        `"${(s.alamat || '').replace(/"/g, '""')}"`,
        `"${s.termin_hari ? s.termin_hari : 'Tunai'}"`,
        `"${bahanNames.replace(/"/g, '""')}"`,
        `"${(s.catatan || '').replace(/"/g, '""')}"`,
      ].join(',')
    })

    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + [headers.join(','), ...rows].join('\n')
    const encodedUri = encodeURI(csvContent)
    const link = document.createElement('a')
    link.setAttribute('href', encodedUri)
    link.setAttribute('download', `Master_Supplier_Suka_Shawarma_${new Date().toISOString().slice(0, 10)}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    toast.success('Data supplier berhasil diekspor ke CSV!')
  }

  // Handlers
  function openCreate() {
    setEditId(null)
    setForm({
      nama: '',
      kontak: '',
      alamat: '',
      catatan: '',
      kategori: '',
      termin_hari: 0,
      bahan_baku_ids: [],
    })
    setBahanSearch('')
    setShowModal(true)
  }

  function openEdit(s: Supplier) {
    setEditId(s.id)
    setForm({
      nama: s.nama,
      kontak: s.kontak ?? '',
      alamat: s.alamat ?? '',
      catatan: s.catatan ?? '',
      kategori: s.kategori ?? '',
      termin_hari: s.termin_hari ?? 0,
      bahan_baku_ids: s.bahan_baku_ids ?? [],
    })
    setBahanSearch('')
    setShowModal(true)
  }

  function closeModal() {
    setShowModal(false)
    setEditId(null)
  }

  async function handleSave() {
    if (!form.nama.trim()) {
      toast.error('Nama supplier wajib diisi')
      return
    }
    const payload = {
      nama: form.nama.trim(),
      kontak: form.kontak.trim() || null,
      alamat: form.alamat.trim() || null,
      catatan: form.catatan.trim() || null,
      kategori: form.kategori || null,
      termin_hari: form.termin_hari === 0 ? null : form.termin_hari,
      bahan_baku_ids: form.bahan_baku_ids,
    }
    if (editId) {
      await updateSupplier.mutateAsync({ id: editId, ...payload })
    } else {
      await createSupplier.mutateAsync(payload)
    }
    closeModal()
  }

  async function handleDeleteConfirm() {
    if (!deleteTarget) return
    await deleteSupplier.mutateAsync(deleteTarget.id)
    setDeleteTarget(null)
    if (detailSupplier?.id === deleteTarget.id) {
      setDetailSupplier(null)
    }
  }

  function copyToClipboard(text: string, label: string) {
    navigator.clipboard.writeText(text)
    toast.success(`${label} disalin ke clipboard!`)
  }

  const isSaving = createSupplier.isPending || updateSupplier.isPending
  const isDeleting = deleteSupplier.isPending

  return (
    <div className="space-y-7 animate-fade-in pb-16 font-sans">
      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <PageHeader
        title="Master Supplier"
        description="Pusat database mitra pemasok bahan baku & logistik Kitchen Bogor."
      >
        <div className="flex flex-wrap items-center gap-3">
          {/* View Mode Toggle */}
          <div className="flex items-center bg-suka-cream/60 p-1 rounded-2xl border border-suka-brown/10 shadow-2xs">
            <button
              onClick={() => setViewMode('table')}
              className={`p-2 rounded-xl transition-all flex items-center gap-1.5 text-xs font-bold ${
                viewMode === 'table'
                  ? 'bg-white text-suka-brown shadow-xs'
                  : 'text-suka-ink/50 hover:text-suka-brown'
              }`}
              title="Tampilan Tabel Data"
            >
              <List className="w-4 h-4" />
              <span className="hidden sm:inline">Tabel</span>
            </button>
            <button
              onClick={() => setViewMode('grid')}
              className={`p-2 rounded-xl transition-all flex items-center gap-1.5 text-xs font-bold ${
                viewMode === 'grid'
                  ? 'bg-white text-suka-brown shadow-xs'
                  : 'text-suka-ink/50 hover:text-suka-brown'
              }`}
              title="Tampilan Grid Kartu"
            >
              <LayoutGrid className="w-4 h-4" />
              <span className="hidden sm:inline">Grid</span>
            </button>
          </div>

          {/* Export CSV Button */}
          <button
            onClick={handleExportCSV}
            className="flex items-center justify-center gap-1.5 bg-white border border-suka-brown/15 text-suka-brown font-extrabold px-3.5 py-2.5 rounded-2xl hover:bg-suka-cream/60 transition-all text-xs shadow-2xs cursor-pointer"
            title="Ekspor Data ke CSV / Excel"
          >
            <Download className="w-4 h-4 text-suka-orange" />
            <span className="hidden sm:inline">Ekspor CSV</span>
          </button>

          {/* Add Supplier Button */}
          <button
            onClick={openCreate}
            className="flex items-center justify-center gap-2 bg-gradient-to-r from-suka-brown via-suka-ink to-black text-white font-black px-5 py-2.5 rounded-2xl hover:opacity-95 active:scale-[0.98] transition-all text-xs sm:text-sm shadow-md shadow-suka-brown/20 cursor-pointer"
          >
            <Plus className="w-4 h-4 text-suka-orange" />
            <span>Tambah Supplier</span>
          </button>
        </div>
      </PageHeader>

      {/* ── KPI Stat Cards ─────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Total Supplier"
          value={<CountUp end={suppliers.length} duration={1} />}
          hint="Mitra Aktif Terdaftar"
          icon={<Truck className="w-5 h-5" />}
          tone="default"
        />
        <StatCard
          label="Kategori Tercover"
          value={<CountUp end={kategoriCount} duration={1} />}
          hint="Klasifikasi Bahan Baku"
          icon={<Layers className="w-5 h-5" />}
          tone="orange"
        />
        <StatCard
          label="Bahan Terkoneksi"
          value={<CountUp end={totalBahanSuplaiCount} duration={1} />}
          hint="Total Item Disuplai"
          icon={<Package className="w-5 h-5" />}
          tone="green"
        />
        <StatCard
          label="Rata-rata Tempo"
          value={avgTermin > 0 ? `${avgTermin} Hari` : 'Tunai'}
          hint="Termin Pembayaran"
          icon={<Clock className="w-5 h-5" />}
          tone="blue"
        />
      </div>

      {/* ── Search & Filter Controls ────────────────────────────────────────── */}
      <div className="bg-white/90 backdrop-blur-xl rounded-3xl border border-suka-brown/10 p-5 shadow-sm space-y-4">
        {/* Row 1: Search & Dropdowns */}
        <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
          {/* Search Bar */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-suka-ink/40" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari nama supplier, no. telp, item disuplai, atau alamat..."
              className="w-full pl-10 pr-10 py-2.5 bg-suka-cream/30 border border-suka-brown/10 rounded-2xl text-xs sm:text-sm font-semibold text-suka-ink placeholder:text-suka-ink/40 focus:outline-none focus:border-suka-orange focus:bg-white focus:ring-4 focus:ring-suka-orange/10 transition-all"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-suka-ink/40 hover:text-suka-brown"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Quick Filters & Sorting */}
          <div className="flex flex-wrap items-center gap-2.5">
            {/* Termin Filter */}
            <div className="relative">
              <select
                value={selectedTermin}
                onChange={(e) => setSelectedTermin(e.target.value)}
                className="appearance-none pl-3 pr-8 py-2 bg-suka-cream/30 border border-suka-brown/10 rounded-2xl text-xs font-bold text-suka-brown focus:outline-none focus:border-suka-orange cursor-pointer"
              >
                <option value="all">Semua Termin</option>
                <option value="cash">Tunai (0 Hari)</option>
                <option value="tempo_1_14">Tempo 1 - 14 Hari</option>
                <option value="tempo_15_30">Tempo 15 - 30 Hari</option>
                <option value="tempo_gt_30">Tempo &gt; 30 Hari</option>
              </select>
              <Clock className="w-3.5 h-3.5 absolute right-2.5 top-1/2 -translate-y-1/2 text-suka-ink/40 pointer-events-none" />
            </div>

            {/* Sort Selector */}
            <div className="relative">
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="appearance-none pl-3 pr-8 py-2 bg-suka-cream/30 border border-suka-brown/10 rounded-2xl text-xs font-bold text-suka-brown focus:outline-none focus:border-suka-orange cursor-pointer"
              >
                <option value="nama_asc">Nama (A - Z)</option>
                <option value="nama_desc">Nama (Z - A)</option>
                <option value="items_desc">Item Terbanyak</option>
                <option value="termin_asc">Tempo Terpendek</option>
                <option value="termin_desc">Tempo Terpanjang</option>
              </select>
              <ArrowUpDown className="w-3.5 h-3.5 absolute right-2.5 top-1/2 -translate-y-1/2 text-suka-ink/40 pointer-events-none" />
            </div>

            {/* Reset Filter Button */}
            {(searchQuery || selectedKategori !== 'all' || selectedTermin !== 'all') && (
              <button
                onClick={() => {
                  setSearchQuery('')
                  setSelectedKategori('all')
                  setSelectedTermin('all')
                }}
                className="flex items-center gap-1 px-3 py-2 text-xs font-bold text-rose-600 bg-rose-50 border border-rose-200 rounded-2xl hover:bg-rose-100 transition-colors"
                title="Reset semua filter"
              >
                <FilterX className="w-3.5 h-3.5" />
                <span>Reset</span>
              </button>
            )}
          </div>
        </div>

        {/* Row 2: Category Filter Tabs */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 pt-1 no-scrollbar">
          <button
            onClick={() => setSelectedKategori('all')}
            className={`px-3.5 py-1.5 rounded-full text-xs font-extrabold transition-all shrink-0 flex items-center gap-1.5 border ${
              selectedKategori === 'all'
                ? 'bg-suka-brown text-white border-suka-brown shadow-xs'
                : 'bg-white text-suka-ink/60 border-suka-brown/10 hover:bg-suka-cream/50'
            }`}
          >
            <span>Semua Kategori</span>
            <span
              className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                selectedKategori === 'all' ? 'bg-white/20 text-white' : 'bg-suka-cream text-suka-brown'
              }`}
            >
              {categoryCounts.all}
            </span>
          </button>

          {KATEGORI_OPTIONS.map((cat) => {
            const count = categoryCounts[cat.value] || 0
            const isSelected = selectedKategori === cat.value
            return (
              <button
                key={cat.value}
                onClick={() => setSelectedKategori(cat.value)}
                className={`px-3.5 py-1.5 rounded-full text-xs font-extrabold transition-all shrink-0 flex items-center gap-1.5 border ${
                  isSelected
                    ? 'bg-suka-brown text-white border-suka-brown shadow-xs'
                    : 'bg-white text-suka-ink/60 border-suka-brown/10 hover:bg-suka-cream/50'
                }`}
              >
                <span>{cat.icon}</span>
                <span>{cat.label}</span>
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                    isSelected ? 'bg-white/20 text-white' : 'bg-suka-cream text-suka-brown'
                  }`}
                >
                  {count}
                </span>
              </button>
            )
          })}
        </div>
      </div>

      {/* ── Supplier List Section ───────────────────────────────────────────── */}
      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-24 space-y-3">
          <Spinner className="w-8 h-8 text-suka-orange" />
          <p className="text-xs font-bold text-suka-ink/40 tracking-wider uppercase">Memuat data supplier...</p>
        </div>
      ) : filteredSuppliers.length === 0 ? (
        <div className="bg-white/80 backdrop-blur-xl rounded-3xl border border-dashed border-suka-brown/20 p-12 text-center space-y-3">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-orange-50 flex items-center justify-center text-suka-orange">
            <Truck className="w-7 h-7" />
          </div>
          <div>
            <h3 className="font-extrabold text-suka-brown text-base">Tidak ada supplier ditemukan</h3>
            <p className="text-xs text-suka-ink/60 mt-1 max-w-md mx-auto">
              {searchQuery || selectedKategori !== 'all' || selectedTermin !== 'all'
                ? 'Tidak ada data supplier yang cocok dengan kombinasi filter dan kata kunci saat ini.'
                : 'Belum ada data supplier. Tambahkan supplier baru untuk memulai.'}
            </p>
          </div>
          {(searchQuery || selectedKategori !== 'all' || selectedTermin !== 'all') && (
            <button
              onClick={() => {
                setSearchQuery('')
                setSelectedKategori('all')
                setSelectedTermin('all')
              }}
              className="inline-flex items-center gap-2 px-4 py-2 bg-suka-brown text-white text-xs font-black rounded-xl hover:opacity-90 transition-all"
            >
              <FilterX className="w-4 h-4" /> Reset Filter
            </button>
          )}
        </div>
      ) : viewMode === 'grid' ? (
        /* ── REFINED CLEAN & SPACIOUS GRID VIEW ── */
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5 sm:gap-6">
          {filteredSuppliers.map((supplier) => {
            const waNumber = cleanPhoneForWhatsApp(supplier.kontak)
            const catMeta = KATEGORI_OPTIONS.find((k) => k.value === supplier.kategori)
            const itemIds = supplier.bahan_baku_ids || []
            const avatarBg = getAvatarColor(supplier.nama)

            return (
              <motion.div
                key={supplier.id}
                layout
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 8 }}
                transition={{ duration: 0.2 }}
                className="bg-white/95 backdrop-blur-xl rounded-3xl border border-suka-brown/10 shadow-[0_2px_16px_rgba(0,0,0,0.03)] hover:shadow-[0_8px_30px_rgba(44,24,16,0.08)] hover:border-suka-orange/30 transition-all duration-300 flex flex-col justify-between overflow-hidden group hover:-translate-y-0.5"
              >
                {/* Main Card Content */}
                <div className="p-5 sm:p-6 space-y-4">
                  {/* Top Bar: Avatar + Name + Category + Action Icons */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3.5 min-w-0">
                      <div
                        className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${avatarBg} flex items-center justify-center font-black text-sm shrink-0 shadow-xs`}
                      >
                        {getInitials(supplier.nama)}
                      </div>
                      <div className="min-w-0">
                        <button
                          onClick={() => setDetailSupplier(supplier)}
                          className="font-black text-suka-brown text-base tracking-tight hover:text-suka-orange text-left transition-colors truncate block max-w-full"
                          title={supplier.nama}
                        >
                          {supplier.nama}
                        </button>
                        <div className="flex items-center gap-2 mt-1">
                          {catMeta ? (
                            <span
                              className={`inline-flex items-center gap-1 text-[11px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full border ${catMeta.color}`}
                            >
                              <span>{catMeta.icon}</span>
                              <span>{catMeta.label}</span>
                            </span>
                          ) : (
                            <span className="text-[11px] font-bold text-suka-ink/40 bg-suka-cream/60 px-2 py-0.5 rounded-full border border-suka-brown/5">
                              Umum
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Quick Edit & Delete Actions */}
                    <div className="flex items-center gap-1 shrink-0 -mr-1">
                      <button
                        onClick={() => openEdit(supplier)}
                        className="p-2 rounded-xl text-suka-ink/40 hover:text-suka-orange hover:bg-orange-50 transition-all"
                        title="Edit data supplier"
                      >
                        <Edit3 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => setDeleteTarget(supplier)}
                        className="p-2 rounded-xl text-suka-ink/40 hover:text-rose-600 hover:bg-rose-50 transition-all"
                        title="Nonaktifkan supplier"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Clean Contact & Location Row */}
                  <div className="pt-2 border-t border-suka-brown/5 space-y-2 text-xs">
                    <div className="flex items-center justify-between gap-2">
                      {supplier.kontak ? (
                        <div className="flex items-center gap-2 font-bold text-suka-brown truncate">
                          <Phone className="w-3.5 h-3.5 text-suka-orange shrink-0" />
                          <span className="truncate">{supplier.kontak}</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 text-suka-ink/40 italic text-[11px]">
                          <Phone className="w-3.5 h-3.5 opacity-40 shrink-0" />
                          <span>Belum ada nomor kontak</span>
                        </div>
                      )}

                      {supplier.kontak && (
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            onClick={() => copyToClipboard(supplier.kontak!, 'No. Kontak')}
                            className="p-1.5 rounded-xl text-suka-ink/40 hover:text-suka-brown hover:bg-suka-cream/80 transition-all"
                            title="Salin nomor kontak"
                          >
                            <Copy className="w-3.5 h-3.5" />
                          </button>
                          {waNumber && (
                            <a
                              href={`https://wa.me/${waNumber}?text=Halo%20${encodeURIComponent(
                                supplier.nama
                              )},%20kami%20dari%20Tim%20Purchasing%20Suka%20Shawarma...`}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-600 text-white rounded-xl text-[11px] font-bold hover:bg-emerald-700 transition-all shadow-2xs"
                              title="Chat WhatsApp"
                            >
                              <MessageCircle className="w-3.5 h-3.5" />
                              <span>Chat WA</span>
                            </a>
                          )}
                        </div>
                      )}
                    </div>

                    {supplier.alamat && (
                      <div className="flex items-center gap-2 text-suka-ink/60 font-medium text-[11px] truncate">
                        <MapPin className="w-3.5 h-3.5 text-suka-orange/70 shrink-0" />
                        <span className="truncate" title={supplier.alamat}>
                          {supplier.alamat}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Clean Supplied Ingredients Summary (Progressive Disclosure) */}
                  <div
                    onClick={() => setDetailSupplier(supplier)}
                    className="bg-suka-cream/30 hover:bg-suka-cream/60 transition-colors p-3 rounded-2xl border border-suka-brown/5 cursor-pointer space-y-1.5"
                  >
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2 font-bold text-suka-brown">
                        <Package className="w-3.5 h-3.5 text-suka-orange" />
                        <span>{itemIds.length} Bahan Baku Terhubung</span>
                      </div>
                      <span className="text-[10px] font-black text-suka-orange group-hover:translate-x-0.5 transition-transform flex items-center gap-0.5">
                        Lihat <ChevronRight className="w-3 h-3" />
                      </span>
                    </div>

                    {itemIds.length > 0 ? (
                      <p className="text-[11px] text-suka-ink/70 font-medium truncate">
                        {itemIds
                          .slice(0, 3)
                          .map((bId) => bahanMap.get(bId)?.nama)
                          .filter(Boolean)
                          .join(', ')}
                        {itemIds.length > 3 && ` (+${itemIds.length - 3} lainnya)`}
                      </p>
                    ) : (
                      <p className="text-[11px] text-suka-ink/40 italic">
                        Belum ada item bahan baku dipetakan
                      </p>
                    )}
                  </div>

                  {/* Notes Preview (if any) */}
                  {supplier.catatan && (
                    <p className="text-[11px] font-medium text-suka-ink/60 bg-amber-50/40 border-l-2 border-amber-400 px-2.5 py-1.5 rounded-r-xl line-clamp-1 italic">
                      "{supplier.catatan}"
                    </p>
                  )}
                </div>

                {/* Card Footer: Payment Term & Detail Drawer Trigger */}
                <div className="px-5 sm:px-6 py-3.5 bg-suka-cream/30 border-t border-suka-brown/5 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-black uppercase tracking-wider text-suka-ink/40">
                      Termin:
                    </span>
                    {!supplier.termin_hari || supplier.termin_hari === 0 ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-lg text-[10px] font-black uppercase tracking-wider">
                        <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Tunai
                      </span>
                    ) : supplier.termin_hari <= 14 ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-amber-50 border border-amber-200 text-amber-900 rounded-lg text-[10px] font-black uppercase tracking-wider">
                        <Clock className="w-3 h-3 text-amber-600" /> Tempo {supplier.termin_hari} Hari
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-orange-50 border border-orange-200 text-orange-900 rounded-lg text-[10px] font-black uppercase tracking-wider">
                        <Clock className="w-3 h-3 text-suka-orange" /> Tempo {supplier.termin_hari} Hari
                      </span>
                    )}
                  </div>

                  <button
                    onClick={() => setDetailSupplier(supplier)}
                    className="inline-flex items-center gap-1 text-xs font-bold text-suka-brown hover:text-suka-orange transition-colors"
                  >
                    <span>Detail Lengkap</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </motion.div>
            )
          })}
        </div>
      ) : (
        /* ── REFINED HIGH-CLARITY MODERN DATA TABLE ── */
        <div className="bg-white/95 backdrop-blur-xl rounded-3xl border border-suka-brown/10 shadow-[0_2px_16px_rgba(0,0,0,0.03)] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs sm:text-sm">
              <thead>
                <tr className="bg-suka-cream/70 border-b border-suka-brown/10 text-suka-brown font-black uppercase text-[11px] tracking-wider select-none">
                  <th className="py-4 px-5">Supplier &amp; Lokasi</th>
                  <th className="py-4 px-5">Kategori</th>
                  <th className="py-4 px-5">Kontak &amp; WhatsApp</th>
                  <th className="py-4 px-5">Bahan Baku Disuplai</th>
                  <th className="py-4 px-5">Termin Pembayaran</th>
                  <th className="py-4 px-5 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-suka-brown/5 font-semibold text-suka-ink">
                {filteredSuppliers.map((supplier) => {
                  const catMeta = KATEGORI_OPTIONS.find((k) => k.value === supplier.kategori)
                  const waNumber = cleanPhoneForWhatsApp(supplier.kontak)
                  const itemIds = supplier.bahan_baku_ids || []
                  const avatarBg = getAvatarColor(supplier.nama)

                  return (
                    <tr
                      key={supplier.id}
                      className="hover:bg-amber-50/40 transition-colors group cursor-pointer"
                      onClick={() => setDetailSupplier(supplier)}
                    >
                      {/* Supplier & Alamat */}
                      <td className="py-4 px-5">
                        <div className="flex items-center gap-3.5">
                          <div
                            className={`w-10 h-10 rounded-2xl bg-gradient-to-br ${avatarBg} flex items-center justify-center font-black text-xs shrink-0 shadow-2xs`}
                          >
                            {getInitials(supplier.nama)}
                          </div>
                          <div className="min-w-0 max-w-xs">
                            <span className="font-extrabold text-suka-brown text-sm block group-hover:text-suka-orange transition-colors truncate">
                              {supplier.nama}
                            </span>
                            {supplier.alamat ? (
                              <span className="text-[11px] text-suka-ink/60 font-medium flex items-center gap-1 truncate mt-0.5" title={supplier.alamat}>
                                <MapPin className="w-3 h-3 text-suka-orange shrink-0" />
                                <span className="truncate">{supplier.alamat}</span>
                              </span>
                            ) : (
                              <span className="text-[11px] text-suka-ink/30 italic">Belum ada alamat</span>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Kategori */}
                      <td className="py-4 px-5">
                        {catMeta ? (
                          <span
                            className={`inline-flex items-center gap-1 text-[11px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full border ${catMeta.color}`}
                          >
                            <span>{catMeta.icon}</span>
                            <span>{catMeta.label}</span>
                          </span>
                        ) : (
                          <span className="text-[11px] font-bold text-suka-ink/40 bg-suka-cream/60 px-2 py-0.5 rounded-full border border-suka-brown/5">
                            Umum
                          </span>
                        )}
                      </td>

                      {/* Kontak & WA */}
                      <td className="py-4 px-5" onClick={(e) => e.stopPropagation()}>
                        {supplier.kontak ? (
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-suka-brown">{supplier.kontak}</span>
                            <button
                              onClick={() => copyToClipboard(supplier.kontak!, 'No. Kontak')}
                              className="p-1 text-suka-ink/30 hover:text-suka-brown hover:bg-suka-cream rounded-lg transition-all"
                              title="Salin nomor"
                            >
                              <Copy className="w-3 h-3" />
                            </button>
                            {waNumber && (
                              <a
                                href={`https://wa.me/${waNumber}?text=Halo%20${encodeURIComponent(
                                  supplier.nama
                                )},%20kami%20dari%20Tim%20Purchasing%20Suka%20Shawarma...`}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-600 text-white rounded-lg text-[10px] font-bold hover:bg-emerald-700 transition-all shadow-2xs"
                                title="Chat WhatsApp"
                              >
                                <MessageCircle className="w-3 h-3" />
                                <span>WA</span>
                              </a>
                            )}
                          </div>
                        ) : (
                          <span className="text-suka-ink/40 text-xs italic">Tidak ada kontak</span>
                        )}
                      </td>

                      {/* Bahan Baku Disuplai */}
                      <td className="py-4 px-5">
                        <div className="flex items-center gap-2 flex-wrap max-w-sm">
                          {itemIds.length === 0 ? (
                            <span className="text-suka-ink/40 text-xs italic">0 item terhubung</span>
                          ) : (
                            <>
                              <span className="px-2.5 py-0.5 bg-suka-cream/80 border border-suka-brown/10 rounded-xl text-[11px] font-extrabold text-suka-brown">
                                {itemIds.length} item
                              </span>
                              <span className="text-[11px] text-suka-ink/70 font-medium truncate max-w-[200px]" title={itemIds.map((bId) => bahanMap.get(bId)?.nama).filter(Boolean).join(', ')}>
                                {itemIds
                                  .slice(0, 2)
                                  .map((bId) => bahanMap.get(bId)?.nama)
                                  .filter(Boolean)
                                  .join(', ')}
                                {itemIds.length > 2 && ` (+${itemIds.length - 2} lainnya)`}
                              </span>
                            </>
                          )}
                        </div>
                      </td>

                      {/* Termin Pembayaran */}
                      <td className="py-4 px-5">
                        {!supplier.termin_hari || supplier.termin_hari === 0 ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-lg text-[10px] font-black uppercase tracking-wider">
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Tunai
                          </span>
                        ) : supplier.termin_hari <= 14 ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-amber-50 border border-amber-200 text-amber-900 rounded-lg text-[10px] font-black uppercase tracking-wider">
                            <Clock className="w-3 h-3 text-amber-600" /> {supplier.termin_hari} Hari
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-orange-50 border border-orange-200 text-orange-900 rounded-lg text-[10px] font-black uppercase tracking-wider">
                            <Clock className="w-3 h-3 text-suka-orange" /> {supplier.termin_hari} Hari
                          </span>
                        )}
                      </td>

                      {/* Aksi */}
                      <td className="py-4 px-5 text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => openEdit(supplier)}
                            className="p-1.5 rounded-xl text-suka-ink/40 hover:text-suka-orange hover:bg-orange-50 transition-all"
                            title="Edit data supplier"
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => setDeleteTarget(supplier)}
                            className="p-1.5 rounded-xl text-suka-ink/40 hover:text-rose-600 hover:bg-rose-50 transition-all"
                            title="Hapus / Nonaktifkan"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => setDetailSupplier(supplier)}
                            className="p-1.5 rounded-xl text-suka-ink/40 hover:text-suka-brown hover:bg-suka-cream transition-all ml-1"
                            title="Buka panel detail"
                          >
                            <ChevronRight className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── MODAL: TAMBAH / EDIT SUPPLIER ───────────────────────────────────── */}
      <AnimatePresence>
        {showModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={closeModal}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
            />

            {/* Modal Content */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ type: 'spring', duration: 0.3 }}
              className="relative w-full max-w-2xl bg-white rounded-3xl shadow-2xl border border-suka-brown/10 overflow-hidden z-10 my-8 max-h-[90vh] flex flex-col"
            >
              {/* Modal Header */}
              <div className="px-6 py-5 bg-gradient-to-r from-suka-brown to-suka-ink text-white flex items-center justify-between shrink-0">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-white/10 flex items-center justify-center text-suka-orange">
                    {editId ? <Edit3 className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                  </div>
                  <div>
                    <h3 className="font-extrabold text-base tracking-tight">
                      {editId ? 'Edit Data Supplier' : 'Tambah Supplier Baru'}
                    </h3>
                    <p className="text-[11px] text-white/60 font-medium">
                      Lengkapi data detail mitra pengadaan bahan baku Kitchen Bogor.
                    </p>
                  </div>
                </div>
                <button
                  onClick={closeModal}
                  className="p-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white/80 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Modal Body */}
              <div className="p-6 space-y-5 overflow-y-auto flex-1 font-sans">
                {/* Row 1: Nama Supplier */}
                <div>
                  <label className="block text-[11px] font-black text-suka-brown uppercase tracking-wider mb-1.5">
                    Nama Supplier / PT / CV <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={form.nama}
                    onChange={(e) => setForm((f) => ({ ...f, nama: e.target.value }))}
                    placeholder="Contoh: PT Agro Boga Utama / CV Sumber Rejeki"
                    className="w-full px-4 py-2.5 text-xs sm:text-sm font-bold text-suka-ink bg-suka-cream/20 border border-suka-brown/15 rounded-2xl focus:outline-none focus:border-suka-orange focus:bg-white focus:ring-4 focus:ring-suka-orange/10 transition-all"
                  />
                </div>

                {/* Row 2: Kategori & Kontak */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[11px] font-black text-suka-brown uppercase tracking-wider mb-1.5">
                      Kategori Bahan Utama
                    </label>
                    <select
                      value={form.kategori}
                      onChange={(e) => setForm((f) => ({ ...f, kategori: e.target.value }))}
                      className="w-full px-4 py-2.5 text-xs sm:text-sm font-bold text-suka-ink bg-suka-cream/20 border border-suka-brown/15 rounded-2xl focus:outline-none focus:border-suka-orange focus:bg-white focus:ring-4 focus:ring-suka-orange/10 transition-all cursor-pointer"
                    >
                      <option value="">— Pilih Kategori —</option>
                      {KATEGORI_OPTIONS.map((k) => (
                        <option key={k.value} value={k.value}>
                          {k.icon} {k.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-black text-suka-brown uppercase tracking-wider mb-1.5">
                      No. WhatsApp / Telepon
                    </label>
                    <input
                      type="text"
                      value={form.kontak}
                      onChange={(e) => setForm((f) => ({ ...f, kontak: e.target.value }))}
                      placeholder="0812-3456-7890 / +62..."
                      className="w-full px-4 py-2.5 text-xs sm:text-sm font-bold text-suka-ink bg-suka-cream/20 border border-suka-brown/15 rounded-2xl focus:outline-none focus:border-suka-orange focus:bg-white focus:ring-4 focus:ring-suka-orange/10 transition-all"
                    />
                  </div>
                </div>

                {/* Row 3: Termin Pembayaran with Quick Presets */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-[11px] font-black text-suka-brown uppercase tracking-wider">
                      Termin Pembayaran (Hari)
                    </label>
                    <span className="text-[11px] font-bold text-suka-orange">
                      {form.termin_hari === null || form.termin_hari === 0
                        ? 'Tunai (Cash on Delivery)'
                        : `Tempo ${form.termin_hari} Hari`}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-2 mb-2">
                    {TERMIN_PRESETS.map((preset) => (
                      <button
                        key={preset.value}
                        type="button"
                        onClick={() => setForm((f) => ({ ...f, termin_hari: preset.value }))}
                        className={`px-3 py-1.5 rounded-xl text-xs font-extrabold transition-all border ${
                          (form.termin_hari ?? 0) === preset.value
                            ? 'bg-suka-brown text-white border-suka-brown shadow-xs'
                            : 'bg-suka-cream/30 text-suka-brown border-suka-brown/10 hover:bg-suka-cream'
                        }`}
                      >
                        {preset.label}
                      </button>
                    ))}
                  </div>
                  <input
                    type="number"
                    min={0}
                    value={form.termin_hari ?? ''}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        termin_hari: e.target.value === '' ? null : Number(e.target.value),
                      }))
                    }
                    placeholder="Atau masukkan jumlah hari custom (misal: 21)"
                    className="w-full px-4 py-2 text-xs font-bold text-suka-ink bg-suka-cream/20 border border-suka-brown/15 rounded-2xl focus:outline-none focus:border-suka-orange focus:bg-white transition-all"
                  />
                </div>

                {/* Row 4: Searchable Bahan Baku Selector */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="block text-[11px] font-black text-suka-brown uppercase tracking-wider">
                      Item Bahan Baku yang Disuplai
                    </label>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-bold text-suka-ink/60 bg-suka-cream/60 px-2 py-0.5 rounded-full">
                        {form.bahan_baku_ids.length} dipilih
                      </span>
                      {form.bahan_baku_ids.length > 0 && (
                        <button
                          type="button"
                          onClick={() => setForm((f) => ({ ...f, bahan_baku_ids: [] }))}
                          className="text-[10px] font-bold text-rose-600 hover:underline"
                        >
                          Bersihkan
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Search inside ingredients */}
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-suka-ink/40" />
                    <input
                      type="text"
                      value={bahanSearch}
                      onChange={(e) => setBahanSearch(e.target.value)}
                      placeholder="Cari item bahan baku (misal: Kentang, Daging, Saus)..."
                      className="w-full pl-9 pr-3 py-1.5 text-xs font-semibold bg-white border border-suka-brown/15 rounded-xl focus:outline-none focus:border-suka-orange"
                    />
                  </div>

                  {/* Ingredients Pills Cloud */}
                  <div className="border border-suka-brown/15 rounded-2xl p-3 max-h-48 overflow-y-auto bg-suka-cream/20 space-y-2">
                    {modalFilteredBahan.length === 0 ? (
                      <p className="text-center py-4 text-xs text-suka-ink/40 italic">
                        Tidak ada bahan baku cocok dengan "{bahanSearch}"
                      </p>
                    ) : (
                      <div className="flex flex-wrap gap-1.5">
                        {modalFilteredBahan.map((b) => {
                          const isChecked = form.bahan_baku_ids.includes(b.id)
                          return (
                            <button
                              key={b.id}
                              type="button"
                              onClick={() => {
                                setForm((f) => ({
                                  ...f,
                                  bahan_baku_ids: isChecked
                                    ? f.bahan_baku_ids.filter((id) => id !== b.id)
                                    : [...f.bahan_baku_ids, b.id],
                                }))
                              }}
                              className={`px-2.5 py-1 rounded-xl text-[11px] font-extrabold transition-all border flex items-center gap-1.5 ${
                                isChecked
                                  ? 'bg-suka-orange text-white border-suka-orange shadow-2xs'
                                  : 'bg-white text-suka-brown border-suka-brown/10 hover:bg-suka-cream/60'
                              }`}
                            >
                              {isChecked ? <Check className="w-3 h-3" /> : <Plus className="w-3 h-3 opacity-40" />}
                              <span>{b.nama}</span>
                              <span
                                className={`text-[9px] font-medium ${isChecked ? 'text-white/80' : 'text-suka-ink/50'}`}
                              >
                                ({b.satuan})
                              </span>
                            </button>
                          )
                        })}
                      </div>
                    )}
                  </div>
                </div>

                {/* Row 5: Alamat & Catatan */}
                <div className="space-y-4">
                  <div>
                    <label className="block text-[11px] font-black text-suka-brown uppercase tracking-wider mb-1.5">
                      Alamat Kantor / Gudang Supplier
                    </label>
                    <input
                      type="text"
                      value={form.alamat}
                      onChange={(e) => setForm((f) => ({ ...f, alamat: e.target.value }))}
                      placeholder="Contoh: Jl. Raya Pajajaran No. 88, Bogor"
                      className="w-full px-4 py-2.5 text-xs font-bold text-suka-ink bg-suka-cream/20 border border-suka-brown/15 rounded-2xl focus:outline-none focus:border-suka-orange focus:bg-white transition-all"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-black text-suka-brown uppercase tracking-wider mb-1.5">
                      Catatan Tambahan &amp; Ketentuan Order
                    </label>
                    <textarea
                      value={form.catatan}
                      onChange={(e) => setForm((f) => ({ ...f, catatan: e.target.value }))}
                      rows={2}
                      placeholder="Minimal order, jam operasional penerimaan PO, lead time pengiriman..."
                      className="w-full px-4 py-2.5 text-xs font-medium text-suka-ink bg-suka-cream/20 border border-suka-brown/15 rounded-2xl focus:outline-none focus:border-suka-orange focus:bg-white transition-all resize-none"
                    />
                  </div>
                </div>
              </div>

              {/* Modal Footer */}
              <div className="px-6 py-4 bg-suka-cream/40 border-t border-suka-brown/10 flex items-center justify-end gap-3 shrink-0">
                <button
                  type="button"
                  onClick={closeModal}
                  className="px-5 py-2.5 rounded-2xl font-bold text-xs text-suka-ink/70 hover:bg-suka-brown/5 transition-colors"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={isSaving}
                  className="px-6 py-2.5 bg-gradient-to-r from-suka-brown to-suka-ink text-white rounded-2xl font-extrabold text-xs hover:opacity-95 active:scale-[0.98] transition-all disabled:opacity-50 flex items-center gap-2 shadow-md shadow-suka-brown/20"
                >
                  {isSaving ? <Spinner className="w-4 h-4" /> : <Check className="w-4 h-4" />}
                  <span>{editId ? 'Simpan Perubahan' : 'Simpan Supplier'}</span>
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ── DRAWER: DETAIL SUPPLIER ─────────────────────────────────────────── */}
      <AnimatePresence>
        {detailSupplier && (
          <div className="fixed inset-0 z-50 flex items-center justify-end">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setDetailSupplier(null)}
              className="fixed inset-0 bg-black/50 backdrop-blur-xs transition-opacity"
            />

            {/* Slide-over Panel */}
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="relative w-full max-w-lg bg-white h-full shadow-2xl border-l border-suka-brown/10 z-10 flex flex-col justify-between overflow-hidden"
            >
              {/* Drawer Header */}
              <div className="p-6 bg-gradient-to-br from-suka-brown via-suka-ink to-black text-white relative">
                <button
                  onClick={() => setDetailSupplier(null)}
                  className="absolute top-6 right-6 p-2 rounded-2xl bg-white/10 hover:bg-white/20 text-white transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>

                <div className="space-y-3 pt-2">
                  <div
                    className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${getAvatarColor(
                      detailSupplier.nama
                    )} flex items-center justify-center font-black text-lg shadow-md border-2 border-white/20`}
                  >
                    {getInitials(detailSupplier.nama)}
                  </div>
                  <div>
                    <h2 className="font-extrabold text-xl tracking-tight">{detailSupplier.nama}</h2>
                    {detailSupplier.kategori && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-white/20 text-white mt-1">
                        {KATEGORI_OPTIONS.find((k) => k.value === detailSupplier.kategori)?.icon}{' '}
                        {detailSupplier.kategori}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Drawer Content */}
              <div className="p-6 space-y-6 overflow-y-auto flex-1 font-sans text-xs">
                {/* Quick Actions Row */}
                <div className="flex items-center gap-2">
                  {detailSupplier.kontak && cleanPhoneForWhatsApp(detailSupplier.kontak) && (
                    <a
                      href={`https://wa.me/${cleanPhoneForWhatsApp(
                        detailSupplier.kontak
                      )}?text=Halo%20${encodeURIComponent(
                        detailSupplier.nama
                      )},%20kami%20dari%20Tim%20Purchasing%20Suka%20Shawarma...`}
                      target="_blank"
                      rel="noreferrer"
                      className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl font-black text-xs transition-all flex items-center justify-center gap-1.5 shadow-sm shadow-emerald-600/20"
                    >
                      <MessageCircle className="w-4 h-4" />
                      <span>Chat WhatsApp</span>
                    </a>
                  )}
                  <Link
                    href={`/pembelian/new?supplier_id=${detailSupplier.id}`}
                    className="flex-1 py-2.5 bg-suka-brown hover:bg-suka-ink text-white rounded-2xl font-black text-xs transition-all flex items-center justify-center gap-1.5 shadow-sm shadow-suka-brown/20"
                  >
                    <ShoppingBag className="w-4 h-4 text-suka-orange" />
                    <span>Buat PO Baru</span>
                  </Link>
                </div>

                {/* Contact Quick Card */}
                <div className="bg-suka-cream/30 p-4 rounded-2xl border border-suka-brown/10 space-y-3">
                  <h4 className="font-extrabold text-suka-brown text-xs uppercase tracking-wider">
                    Informasi Kontak
                  </h4>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 font-bold text-suka-ink">
                        <Phone className="w-4 h-4 text-suka-orange" />
                        <span>{detailSupplier.kontak || 'Belum ada nomor kontak'}</span>
                      </div>
                      {detailSupplier.kontak && (
                        <button
                          onClick={() => copyToClipboard(detailSupplier.kontak!, 'No. Kontak')}
                          className="px-2.5 py-1 bg-white border border-suka-brown/10 rounded-lg text-[10px] font-bold text-suka-brown hover:bg-suka-cream"
                        >
                          Salin
                        </button>
                      )}
                    </div>

                    {detailSupplier.alamat && (
                      <div className="flex items-start gap-2 text-suka-ink/70 pt-2 border-t border-suka-brown/5 font-medium">
                        <MapPin className="w-4 h-4 text-suka-orange shrink-0 mt-0.5" />
                        <span>{detailSupplier.alamat}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Termin Card */}
                <div className="bg-suka-cream/30 p-4 rounded-2xl border border-suka-brown/10 flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-xl bg-orange-50 text-suka-orange flex items-center justify-center">
                      <Clock className="w-5 h-5" />
                    </div>
                    <div>
                      <span className="font-extrabold text-suka-brown block">Termin Pembayaran</span>
                      <span className="text-[11px] text-suka-ink/60 font-medium">
                        {!detailSupplier.termin_hari || detailSupplier.termin_hari === 0
                          ? 'Pembayaran Tunai saat barang sampai'
                          : `Jatuh tempo pembayaran ${detailSupplier.termin_hari} hari setelah invoice`}
                      </span>
                    </div>
                  </div>
                  <span className="px-3 py-1 bg-white border border-suka-brown/10 rounded-xl font-black text-suka-brown shadow-2xs">
                    {!detailSupplier.termin_hari || detailSupplier.termin_hari === 0
                      ? 'Tunai'
                      : `${detailSupplier.termin_hari} Hari`}
                  </span>
                </div>

                {/* Full Supplied Items List */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="font-extrabold text-suka-brown text-xs uppercase tracking-wider">
                      Daftar Bahan Baku Disuplai
                    </h4>
                    <span className="text-[11px] font-bold text-suka-orange">
                      {detailSupplier.bahan_baku_ids?.length || 0} Item
                    </span>
                  </div>

                  {(!detailSupplier.bahan_baku_ids || detailSupplier.bahan_baku_ids.length === 0) ? (
                    <p className="text-center py-6 text-suka-ink/40 italic bg-suka-cream/20 rounded-2xl">
                      Belum ada bahan baku yang dipetakan ke supplier ini.
                    </p>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {detailSupplier.bahan_baku_ids.map((bId) => {
                        const item = bahanMap.get(bId)
                        return (
                          <div
                            key={bId}
                            className="p-2.5 bg-white border border-suka-brown/10 rounded-2xl shadow-2xs flex items-center justify-between gap-2"
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <span className="w-2 h-2 rounded-full bg-suka-orange shrink-0" />
                              <span className="font-bold text-suka-brown truncate">
                                {item ? item.nama : 'Bahan Baku'}
                              </span>
                            </div>
                            {item?.satuan && (
                              <span className="text-[10px] font-semibold text-suka-ink/50 bg-suka-cream/50 px-2 py-0.5 rounded-lg shrink-0">
                                {item.satuan}
                              </span>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>

                {/* Catatan */}
                {detailSupplier.catatan && (
                  <div className="space-y-1.5">
                    <h4 className="font-extrabold text-suka-brown text-xs uppercase tracking-wider">
                      Catatan &amp; Persyaratan
                    </h4>
                    <div className="p-3 bg-amber-50/60 border border-amber-200 rounded-2xl text-suka-brown font-medium">
                      {detailSupplier.catatan}
                    </div>
                  </div>
                )}
              </div>

              {/* Drawer Footer Actions */}
              <div className="p-6 bg-suka-cream/40 border-t border-suka-brown/10 flex items-center gap-3 shrink-0">
                <button
                  onClick={() => {
                    const s = detailSupplier
                    setDetailSupplier(null)
                    openEdit(s)
                  }}
                  className="flex-1 py-2.5 bg-white border border-suka-brown/15 text-suka-brown rounded-2xl font-bold text-xs hover:bg-suka-cream transition-colors flex items-center justify-center gap-2 shadow-2xs"
                >
                  <Edit3 className="w-4 h-4 text-suka-orange" /> Edit Data
                </button>
                <button
                  onClick={() => {
                    const s = detailSupplier
                    setDeleteTarget(s)
                  }}
                  className="p-2.5 bg-rose-50 border border-rose-200 text-rose-600 rounded-2xl font-bold text-xs hover:bg-rose-100 transition-colors"
                  title="Nonaktifkan supplier"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ── DIALOG: KONFIRMASI HAPUS / NONAKTIFKAN ────────────────────────── */}
      <AnimatePresence>
        {deleteTarget && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setDeleteTarget(null)}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="relative w-full max-w-md bg-white rounded-3xl p-6 shadow-2xl border border-rose-100 z-10 space-y-4 font-sans text-center"
            >
              <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-extrabold text-suka-brown text-base">
                  Nonaktifkan Supplier Ini?
                </h3>
                <p className="text-xs text-suka-ink/60 mt-1">
                  Supplier <span className="font-black text-suka-brown">"{deleteTarget.nama}"</span>{' '}
                  akan dinonaktifkan dari daftar aktif dan tidak dapat dipilih untuk PO baru.
                </p>
              </div>
              <div className="flex items-center gap-3 pt-2">
                <button
                  onClick={() => setDeleteTarget(null)}
                  disabled={isDeleting}
                  className="flex-1 py-2.5 border border-suka-brown/15 rounded-2xl font-bold text-xs text-suka-ink/70 hover:bg-suka-cream transition-colors"
                >
                  Batal
                </button>
                <button
                  onClick={handleDeleteConfirm}
                  disabled={isDeleting}
                  className="flex-1 py-2.5 bg-rose-600 text-white rounded-2xl font-black text-xs hover:bg-rose-700 transition-colors flex items-center justify-center gap-1.5 shadow-md shadow-rose-600/20"
                >
                  {isDeleting ? <Spinner className="w-4 h-4" /> : <Trash2 className="w-4 h-4" />}
                  <span>Ya, Nonaktifkan</span>
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  )
}

