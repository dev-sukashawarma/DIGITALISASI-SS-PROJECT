'use client'

import { useEffect, useState, useRef } from 'react'
import Image from 'next/image'
import {
  Plus, Pencil, Trash2, ImagePlus, X, Loader2,
  AlertCircle, UploadCloud, Sandwich, ToggleLeft, ToggleRight,
  FileArchive, Search, Star, PlusCircle,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { formatRupiah } from '@/lib/validations'
import type { MenuItem, Category } from '@/types'
import ZipUploadModal from '@/components/ZipUploadModal'

const BUCKET = 'menu-images'

interface FormState {
  id: string | null
  name: string
  description: string
  price: string
  category_id: string
  is_available: boolean
  image_url: string | null
}

const EMPTY: FormState = {
  id: null, name: '', description: '', price: '',
  category_id: '', is_available: true, image_url: null,
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

export default function AdminMenuPage() {
  const [items, setItems]         = useState<MenuItem[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [bestsellers, setBestsellers] = useState<string[]>([])
  const [upsells, setUpsells] = useState<string[]>([])
  const [loading, setLoading]     = useState(true)
  const [form, setForm]           = useState<FormState>(EMPTY)
  const [showForm, setShowForm]   = useState(false)
  const [saving, setSaving]       = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error, setError]         = useState('')
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [preview, setPreview]     = useState<string | null>(null)
  const [showZipModal, setShowZipModal] = useState(false)
  const [searchQuery, setSearchQuery]   = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  async function fetchData() {
    const supabase = createClient()
    const [{ data: m }, { data: c }, { data: b }, { data: u }] = await Promise.all([
      supabase.from('menu_items').select('*, categories(id,name,sort_order)').order('sort_order'),
      supabase.from('categories').select('*').order('sort_order'),
      supabase.from('kiosk_settings').select('value').eq('key', 'bestseller_ids').maybeSingle(),
      supabase.from('kiosk_settings').select('value').eq('key', 'upsell_ids').maybeSingle(),
    ])
    setItems(m ?? [])
    setCategories(c ?? [])
    
    try {
      setBestsellers(b?.value ? JSON.parse(b.value) : [])
    } catch {
      setBestsellers([])
    }

    try {
      setUpsells(u?.value ? JSON.parse(u.value) : [])
    } catch {
      setUpsells([])
    }

    setLoading(false)
  }

  useEffect(() => { fetchData() }, [])

  function resetImage() {
    setImageFile(null)
    setPreview(null)
    if (fileRef.current) fileRef.current.value = ''
  }

  function openAdd() {
    setForm({ ...EMPTY, category_id: categories[0]?.id ?? '' })
    resetImage(); setError(''); setShowForm(true)
  }

  function openEdit(item: MenuItem) {
    setForm({
      id: item.id, name: item.name, description: item.description ?? '',
      price: String(item.price), category_id: item.category_id ?? '',
      is_available: item.is_available, image_url: item.image_url,
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

    const supabase = createClient()
    const payload = {
      name: form.name.trim(), description: form.description.trim() || null,
      price, category_id: form.category_id || null,
      is_available: form.is_available, image_url: imgUrl,
    }

    const { error: err } = form.id
      ? await supabase.from('menu_items').update({ ...payload, updated_at: new Date().toISOString() }).eq('id', form.id)
      : await supabase.from('menu_items').insert(payload)

    if (err) setError(err.message)
    else { closeForm(); fetchData() }
    setSaving(false)
  }

  async function toggleAvail(item: MenuItem) {
    const supabase = createClient()
    await supabase.from('menu_items').update({ is_available: !item.is_available }).eq('id', item.id)
    fetchData()
  }

  async function toggleBestseller(item: MenuItem) {
    const isBs = bestsellers.includes(item.id)
    const newBs = isBs 
      ? bestsellers.filter(id => id !== item.id)
      : [...bestsellers, item.id]
      
    setBestsellers(newBs)
    
    const supabase = createClient()
    await supabase.from('kiosk_settings').upsert({ 
      key: 'bestseller_ids', 
      value: JSON.stringify(newBs) 
    })
  }

  async function toggleUpsell(item: MenuItem) {
    const isUp = upsells.includes(item.id)
    const newUp = isUp 
      ? upsells.filter(id => id !== item.id)
      : [...upsells, item.id]
      
    setUpsells(newUp)
    
    const supabase = createClient()
    await supabase.from('kiosk_settings').upsert({ 
      key: 'upsell_ids', 
      value: JSON.stringify(newUp) 
    })
  }

  async function deleteItem(item: MenuItem) {
    if (!confirm(`Hapus "${item.name}"?`)) return
    const supabase = createClient()
    if (item.image_url) await deleteStorageImage(item.image_url)
    await supabase.from('menu_items').delete().eq('id', item.id)
    fetchData()
  }

  const displayImage = preview ?? form.image_url

  const filteredItems = items.filter(item => {
    if (!searchQuery) return true;
    const lowerQ = searchQuery.toLowerCase();
    return item.name.toLowerCase().includes(lowerQ) || 
           (item.categories?.name && item.categories.name.toLowerCase().includes(lowerQ));
  });

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Manajemen Menu</h1>
          <p className="text-gray-400 text-sm mt-0.5">{filteredItems.length} dari {items.length} item</p>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Search Input */}
          <div className="relative w-full sm:w-auto sm:min-w-[200px]">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="h-4 w-4 text-gray-400" />
            </div>
            <input
              type="text"
              className="block w-full pl-9 pr-3 py-2.5 border border-gray-200 rounded-2xl leading-5 bg-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-amber-500 transition-colors text-sm"
              placeholder="Cari menu..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
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
                            unoptimized={displayImage.startsWith('blob:')}
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

                {/* Price & Category */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="input-label">Harga (Rp) <span className="text-red-400 font-normal">*</span></label>
                    <input type="number" value={form.price}
                      onChange={(e) => setForm({ ...form, price: e.target.value })}
                      required min="0" step="500" className="input" placeholder="35000" />
                  </div>
                  <div>
                    <label className="input-label">Kategori</label>
                    <select value={form.category_id}
                      onChange={(e) => setForm({ ...form, category_id: e.target.value })}
                      className="input">
                      <option value="">-- Pilih --</option>
                      {categories.map((c) => (
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
          categories={categories}
          onClose={() => setShowZipModal(false)}
          onComplete={() => fetchData()}
        />
      )}

      {/* ── Menu Grid / Table ────────────────────────────── */}
      {loading ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[1,2,3,4].map((i) => (
            <div key={i} className="rounded-2xl bg-gray-100 animate-pulse h-48" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="card p-16 flex flex-col items-center text-center">
          <div className="w-16 h-16 bg-amber-50 rounded-full flex items-center justify-center mb-4">
            <Sandwich className="w-8 h-8 text-amber-200" strokeWidth={1} />
          </div>
          <p className="font-semibold text-gray-500">Belum ada menu</p>
          <p className="text-sm text-gray-400 mt-1">Tambahkan menu pertamamu</p>
        </div>
      ) : filteredItems.length === 0 ? (
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
                  <th className="text-left py-3.5 px-4 font-semibold text-gray-500">Nama Menu</th>
                  <th className="text-left py-3.5 px-4 font-semibold text-gray-500 hidden sm:table-cell">Kategori</th>
                  <th className="text-right py-3.5 px-4 font-semibold text-gray-500">Harga</th>
                  <th className="text-center py-3.5 px-4 font-semibold text-gray-500">Status</th>
                  <th className="text-center py-3.5 px-5 font-semibold text-gray-500">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {filteredItems.map((item, idx) => (
                  <tr
                    key={item.id}
                    className={`border-b border-gray-50 hover:bg-gray-50/60 transition-colors
                      ${idx === filteredItems.length - 1 ? 'border-0' : ''}`}
                  >
                    {/* Thumbnail */}
                    <td className="py-3.5 px-5">
                      <div className="w-12 h-12 rounded-2xl overflow-hidden bg-amber-50 flex items-center justify-center">
                        {item.image_url ? (
                          <Image src={item.image_url} alt={item.name} width={48} height={48}
                            className="object-cover w-full h-full" />
                        ) : (
                          <Sandwich className="w-5 h-5 text-amber-200" strokeWidth={1.5} />
                        )}
                      </div>
                    </td>

                    {/* Name */}
                    <td className="py-3.5 px-4">
                      <p className="font-semibold text-gray-900 leading-none">{item.name}</p>
                      {item.description && (
                        <p className="text-gray-400 text-xs mt-1 truncate max-w-[200px]">{item.description}</p>
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
                      <span className="font-bold text-gray-900">{formatRupiah(item.price)}</span>
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
                        <button onClick={() => toggleUpsell(item)}
                          className={`w-8 h-8 rounded-xl flex items-center justify-center transition-colors
                            ${upsells.includes(item.id) ? 'bg-indigo-50 text-indigo-500 hover:bg-indigo-100' : 'bg-gray-50 text-gray-300 hover:text-indigo-500 hover:bg-indigo-50'}`}
                          title="Tandai sebagai Upsell Pop-up">
                          <PlusCircle className="w-4 h-4" />
                        </button>
                        <button onClick={() => toggleBestseller(item)}
                          className={`w-8 h-8 rounded-xl flex items-center justify-center transition-colors
                            ${bestsellers.includes(item.id) ? 'bg-yellow-50 text-yellow-500 hover:bg-yellow-100' : 'bg-gray-50 text-gray-300 hover:text-yellow-500 hover:bg-yellow-50'}`}
                          title="Tandai Best Seller">
                          <Star className="w-4 h-4" fill={bestsellers.includes(item.id) ? 'currentColor' : 'none'} />
                        </button>
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
