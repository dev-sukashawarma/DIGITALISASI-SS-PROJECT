'use client'

import { useState, useRef, useMemo } from 'react'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import {
  Plus, Pencil, Trash2, X, Loader2,
  AlertCircle, UploadCloud, Sandwich, ToggleLeft, ToggleRight,
  FileArchive, Search, MoreVertical, Check, ArrowUpDown, ChevronUp, ChevronDown
} from 'lucide-react'
import { createClient } from '@/lib/supabase'
import { CurrencyInput } from '@suka/design-system'
import { formatRupiah } from '@/lib/validations'
import type { MenuItem, Category, SalesChannel } from '@/pos-types'
import ZipUploadModal from '@/components/ZipUploadModal'
import { useDialogStore } from '@/lib/dialogStore'
import MenuSearch from './MenuSearch'
import { MenuPicker } from './MenuPicker'
import { saveMenuItem, toggleMenuAvailability, deleteMenuItem, deleteAllMenuItems, toggleGlobalSetting, updateMenuChannelPrices } from './actions'

const BUCKET = 'menu-images'

interface FormState {
  id: string | null
  name: string
  description: string
  price: string
  base_price: string
  channel_prices: Record<string, string>
  category_id: string
  is_available: boolean
  image_url: string | null
  is_package: boolean
  package_items: { menu_item_id: string, quantity: number, temp_id: string }[]
}

const EMPTY: FormState = {
  id: null, name: '', description: '', price: '', base_price: '',
  channel_prices: {},
  category_id: '', is_available: true, image_url: null,
  is_package: false, package_items: []
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
  initialUpsells?: string[]
  initialBestsellers?: string[]
  initialRecommendations?: string[]
}

export default function MenuView({ 
  initialItems = [], 
  initialCategories = [], 
  initialChannels = [], 
  initialUpsells = [], 
  initialBestsellers = [], 
  initialRecommendations = [] 
}: MenuViewProps) {
  const router = useRouter()
  const supabase = createClient()
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
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' } | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const getSlug = (channelId: string) => {
    const ch = initialChannels.find(c => c.id === channelId)
    return ch ? ch.name.toLowerCase().replace(/\s+/g, '') : ''
  }

  const sortedItems = useMemo(() => {
    let sortableItems = [...initialItems];
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
          if (activeChannelFilter) {
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
  }, [initialItems, sortConfig, activeChannelFilter]);

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
      base_price: String(item.price),
      channel_prices: formattedChannelPrices,
      category_id: item.category_id ?? '',
      is_available: item.is_available, image_url: item.image_url,
      is_package: item.is_package ?? false,
      package_items: item.package_items?.map(pi => ({ menu_item_id: pi.menu_item_id, quantity: pi.quantity, temp_id: Math.random().toString() })) || []
    })
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
      price: finalBasePrice, category_id: form.category_id || null,
      is_available: form.is_available, image_url: imgUrl,
      channel_prices: parsedChannelPrices,
      is_package: form.is_package,
      package_items_to_save: form.is_package ? form.package_items.map(pi => ({ menu_item_id: pi.menu_item_id, quantity: pi.quantity })) : []
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
          <p className="text-gray-400 text-sm mt-0.5">{initialItems.length} item ditemukan</p>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Channel Filter */}
          {initialChannels.length > 0 && (
            <select
              value={activeChannelFilter}
              onChange={(e) => setActiveChannelFilter(e.target.value)}
              className="py-2.5 px-4 text-sm font-medium rounded-2xl border border-gray-200 bg-white hover:border-gray-300 focus:outline-none focus:ring-2 focus:ring-amber-500/20 transition-all cursor-pointer text-gray-700"
            >
              <option value="">Harga Dasar</option>
              {initialChannels.map(ch => (
                <option key={ch.id} value={ch.id}>Harga {ch.name}</option>
              ))}
            </select>
          )}

          {/* Search Input */}
          <MenuSearch />

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

      {/* ── Form Modal ──────────────────────────────────────── */}
      {showForm && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={(e) => { if (e.target === e.currentTarget) closeForm() }}
        >
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md flex flex-col max-h-[92vh] animate-scale-in">

            {/* Sticky header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 flex-shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 bg-amber-100 rounded-2xl flex items-center justify-center">
                  <Sandwich className="w-5 h-5 text-amber-500" strokeWidth={1.5} />
                </div>
                <div>
                  <h2 className="font-bold text-lg text-gray-900 leading-none">
                    {form.id ? 'Edit Menu' : 'Tambah Menu Baru'}
                  </h2>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {form.id ? 'Perbarui data menu' : 'Isi detail menu baru'}
                  </p>
                </div>
              </div>
              <button onClick={closeForm}
                className="w-8 h-8 bg-gray-100 hover:bg-red-50 hover:text-red-500 rounded-xl flex items-center justify-center text-gray-400 transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Scrollable body */}
            <form onSubmit={handleSave} className="flex flex-col flex-1 overflow-hidden">
              <div className="overflow-y-auto flex-1 px-6 py-5 space-y-4">

                {/* Photo upload — compact row */}
                <div>
                  <label className="input-label mb-2 block">Foto Produk</label>
                  <div className="flex items-center gap-4 p-3 rounded-2xl border border-gray-100 bg-gray-50">
                    {/* Thumbnail */}
                    <div className="w-20 h-20 rounded-xl overflow-hidden bg-amber-50 flex-shrink-0 flex items-center justify-center relative group">
                      {displayImage ? (
                        <>
                          <Image
                            src={displayImage}
                            alt="Preview"
                            fill
                            className="object-cover"
                            unoptimized={true}
                          />
                          {preview && (
                            <span className="absolute top-1 left-1 bg-amber-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-md leading-none">
                              Baru
                            </span>
                          )}
                        </>
                      ) : (
                        <Sandwich className="w-7 h-7 text-amber-200" strokeWidth={1} />
                      )}
                    </div>

                    {/* Upload actions */}
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-gray-400 mb-2.5">JPG, PNG, WebP — maks 5 MB</p>
                      <div className="flex gap-2">
                        <button type="button" onClick={() => fileRef.current?.click()}
                          className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg
                            bg-amber-500 text-white hover:bg-amber-600 transition-colors">
                          <UploadCloud className="w-3.5 h-3.5" />
                          {displayImage ? 'Ganti' : 'Upload'}
                        </button>
                        {displayImage && (
                          <button type="button"
                            onClick={() => { preview ? resetImage() : setForm(p => ({ ...p, image_url: null })) }}
                            className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg
                              bg-red-50 text-red-500 hover:bg-red-100 transition-colors">
                            <Trash2 className="w-3.5 h-3.5" />
                            Hapus
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                  <input ref={fileRef} type="file" accept="image/jpeg,image/jpg,image/png,image/webp"
                    className="hidden" onChange={handleFile} />
                </div>

                {/* Name */}
                <div>
                  <label className="input-label">Nama Menu <span className="text-red-400 font-normal">*</span></label>
                  <input type="text" value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    required maxLength={100} className="input" placeholder="Chicken Shawarma" autoFocus />
                </div>

                {/* Description */}
                <div>
                  <label className="input-label">Deskripsi <span className="text-gray-300 font-normal text-xs">(opsional)</span></label>
                  <textarea value={form.description}
                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                    maxLength={300} rows={2} className="input resize-none"
                    placeholder="Deskripsi singkat menu..." />
                </div>

                {/* Menu Type Toggle */}
                <div>
                  <label className="input-label mb-2 block">Tipe Menu</label>
                  <div className="flex bg-gray-100 p-1 rounded-xl">
                    <button type="button" 
                      onClick={() => setForm({ ...form, is_package: false })}
                      className={`flex-1 py-1.5 text-sm font-semibold rounded-lg transition-colors ${!form.is_package ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}>
                      Satuan
                    </button>
                    <button type="button" 
                      onClick={() => setForm({ ...form, is_package: true })}
                      className={`flex-1 py-1.5 text-sm font-semibold rounded-lg transition-colors ${form.is_package ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}>
                      Paket (Combo)
                    </button>
                  </div>
                </div>

                {/* Package Builder */}
                {form.is_package && (
                  <div className="space-y-3 p-4 bg-amber-50/50 rounded-2xl border border-amber-100">
                    <label className="input-label">Isi Paket</label>
                    {form.package_items.map((pi, idx) => (
                      <div key={pi.temp_id} className="flex gap-2 items-center">
                        <MenuPicker 
                          value={pi.menu_item_id}
                          items={initialItems.filter(i => !i.is_package && i.id !== form.id)}
                          getImageUrl={(url) => supabase.storage.from(BUCKET).getPublicUrl(url).data.publicUrl}
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
                        <input type="number" min="1" className="input w-20 text-center" 
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
                        <button type="button" onClick={() => {
                          const newItems = form.package_items.filter((_, i) => i !== idx);
                          
                          let newBasePrice = 0;
                          newItems.forEach(item => {
                            const m = initialItems.find(x => x.id === item.menu_item_id);
                            if (m) newBasePrice += (m.price * item.quantity);
                          });

                          setForm({ ...form, package_items: newItems, price: String(newBasePrice) });
                        }} className="w-10 h-10 bg-white border border-gray-200 rounded-xl flex items-center justify-center text-red-500 hover:bg-red-50">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                    <button type="button" onClick={() => {
                      setForm({ ...form, package_items: [...form.package_items, { menu_item_id: '', quantity: 1, temp_id: Math.random().toString() }] })
                    }} className="text-sm font-semibold text-amber-600 hover:text-amber-700 flex items-center gap-1 mt-2">
                      <Plus className="w-4 h-4" /> Tambah Item
                    </button>
                  </div>
                )}

                {/* Price & Category */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="input-label">
                      {activeChannelFilter 
                        ? `Harga ${initialChannels.find(c => c.id === activeChannelFilter)?.name || ''} (Rp)` 
                        : 'Harga Dasar (Rp)'}
                      <span className="text-red-400 font-normal ml-1">*</span>
                    </label>
                    <CurrencyInput value={form.price}
                      onChange={(v) => setForm({ ...form, price: String(v) })}
                      required className="input" />
                  </div>
                  <div>
                    <label className="input-label">Kategori</label>
                    <select value={form.category_id}
                      onChange={(e) => setForm({ ...form, category_id: e.target.value })}
                      className="input">
                      <option value="">-- Pilih --</option>
                      {initialCategories.map((c) => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                  </div>
                </div>



                {/* Availability toggle */}
                <button type="button"
                  onClick={() => setForm({ ...form, is_available: !form.is_available })}
                  className={`w-full flex items-center justify-between p-4 rounded-2xl border-2 transition-all
                    ${form.is_available
                      ? 'border-amber-200 bg-amber-50/60 hover:bg-amber-50'
                      : 'border-gray-100 bg-gray-50 hover:border-gray-200'}`}>
                  <div className="flex items-center gap-3">
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center transition-colors
                      ${form.is_available ? 'bg-amber-100' : 'bg-gray-100'}`}>
                      {form.is_available
                        ? <ToggleRight className="w-5 h-5 text-amber-500" />
                        : <ToggleLeft  className="w-5 h-5 text-gray-300" />}
                    </div>
                    <div className="text-left">
                      <p className={`text-sm font-semibold leading-none ${form.is_available ? 'text-amber-700' : 'text-gray-500'}`}>
                        {form.is_available ? 'Tersedia' : 'Tidak Tersedia'}
                      </p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {form.is_available ? 'Pelanggan dapat memesan' : 'Ditandai sebagai habis'}
                      </p>
                    </div>
                  </div>
                  <div className={`w-11 h-6 rounded-full transition-all relative flex-shrink-0
                    ${form.is_available ? 'bg-amber-500' : 'bg-gray-200'}`}>
                    <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow-sm
                      transition-transform duration-200 ${form.is_available ? 'translate-x-5' : ''}`} />
                  </div>
                </button>

                {/* Error */}
                {error && (
                  <div className="flex items-center gap-2.5 bg-red-50 border border-red-100 rounded-xl p-3 text-red-600 text-sm">
                    <AlertCircle className="w-4 h-4 flex-shrink-0" />
                    <span>{error}</span>
                  </div>
                )}
              </div>

              {/* Sticky footer — action buttons */}
              <div className="flex gap-3 px-6 py-4 border-t border-gray-100 flex-shrink-0 bg-white rounded-b-3xl">
                <button type="button" onClick={closeForm}
                  className="btn-secondary flex-1 py-2.5 text-sm">
                  Batal
                </button>
                <button type="submit" disabled={saving || uploading}
                  className="btn-primary flex-[2] py-2.5 text-sm">
                  {(saving || uploading)
                    ? <><Loader2 className="w-4 h-4 animate-spin" />{uploading ? 'Mengupload...' : 'Menyimpan...'}</>
                    : form.id ? 'Simpan Perubahan' : 'Tambah Menu'}
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
                      {activeChannelFilter && item.channel_prices?.[getSlug(activeChannelFilter)] ? (
                        <span className="font-bold text-amber-600">{formatRupiah(item.channel_prices[getSlug(activeChannelFilter)])}</span>
                      ) : (
                        <span className="font-bold text-gray-900">{formatRupiah(item.price)}</span>
                      )}
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


