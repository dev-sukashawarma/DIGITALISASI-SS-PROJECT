'use client'

import { useState } from 'react'
import {
  Plus,
  Pencil,
  Trash2,
  X,
  Loader2,
  Tag,
  ChevronUp,
  ChevronDown,
  AlertCircle,
  Sandwich,
  Search,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Category, MenuItem } from '@/types/menu'
import { saveCategory, deleteCategory, reorderCategories } from './actions'

interface Props {
  categories: Category[]
  items: MenuItem[]
  onCategoriesChange: (categories: Category[]) => void
  onItemsChange?: (items: MenuItem[]) => void
  onToast: (type: 'success' | 'error', message: string) => void
}

interface CategoryFormState {
  id: string | null
  name: string
  sort_order: number
}

const EMPTY_FORM: CategoryFormState = {
  id: null,
  name: '',
  sort_order: 1,
}

export default function CategoryManagementView({
  categories,
  items,
  onCategoriesChange,
  onItemsChange,
  onToast,
}: Props) {
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState<CategoryFormState>(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [reordering, setReordering] = useState(false)
  const [modalError, setModalError] = useState<string | null>(null)
  const [searchFilter, setSearchFilter] = useState('')

  // Sorted categories by sort_order
  const sortedCategories = [...categories].sort((a, b) => a.sort_order - b.sort_order)

  const filteredCategories = sortedCategories.filter((cat) =>
    cat.name.toLowerCase().includes(searchFilter.toLowerCase().trim())
  )

  const openAdd = () => {
    const nextOrder =
      categories.length > 0 ? Math.max(...categories.map((c) => c.sort_order || 0)) + 1 : 1
    setForm({ id: null, name: '', sort_order: nextOrder })
    setModalError(null)
    setShowModal(true)
  }

  const openEdit = (cat: Category) => {
    setForm({ id: cat.id, name: cat.name, sort_order: cat.sort_order || 1 })
    setModalError(null)
    setShowModal(true)
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.name.trim()) {
      setModalError('Nama kategori wajib diisi.')
      return
    }

    setSaving(true)
    setModalError(null)

    try {
      const savedData = await saveCategory({
        id: form.id,
        name: form.name,
        sort_order: Number(form.sort_order) || 1,
      })

      if (form.id) {
        // Update existing
        const nextCats = categories.map((c) =>
          c.id === form.id ? { ...c, name: form.name.trim(), sort_order: Number(form.sort_order) } : c
        )
        onCategoriesChange(nextCats)
        onToast('success', `Kategori "${form.name}" berhasil diperbarui!`)
      } else {
        // Add new
        const newCat: Category = savedData || {
          id: `cat-${Date.now()}`,
          name: form.name.trim(),
          sort_order: Number(form.sort_order),
        }
        onCategoriesChange([...categories, newCat])
        onToast('success', `Kategori "${form.name}" berhasil ditambahkan!`)
      }

      setShowModal(false)
    } catch (err: any) {
      setModalError(err?.message || 'Gagal menyimpan kategori.')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (cat: Category) => {
    const menuCount = items.filter((i) => i.category_id === cat.id).length
    const warningMessage =
      menuCount > 0
        ? `Hapus kategori "${cat.name}"?\n\nAda ${menuCount} menu yang menggunakan kategori ini. Menu tersebut TIDAK akan terhapus, melainkan akan dilepaskan menjadi "Tanpa Kategori".`
        : `Hapus kategori "${cat.name}"?`

    if (!confirm(warningMessage)) return

    setDeletingId(cat.id)
    try {
      await deleteCategory(cat.id)

      // Update state categories
      onCategoriesChange(categories.filter((c) => c.id !== cat.id))

      // Update menu items local state if provided
      if (onItemsChange) {
        onItemsChange(
          items.map((i) => (i.category_id === cat.id ? { ...i, category_id: null, categories: undefined } : i))
        )
      }

      onToast('success', `Kategori "${cat.name}" berhasil dihapus.`)
    } catch (err: any) {
      onToast('error', err?.message || 'Gagal menghapus kategori.')
    } finally {
      setDeletingId(null)
    }
  }

  // Instant Move Up / Down
  const handleMove = async (index: number, direction: 'up' | 'down') => {
    if (reordering) return
    const targetIndex = direction === 'up' ? index - 1 : index + 1
    if (targetIndex < 0 || targetIndex >= sortedCategories.length) return

    setReordering(true)
    const current = sortedCategories[index]
    const target = sortedCategories[targetIndex]

    // Swap sort orders
    const newCurrentOrder = target.sort_order
    const newTargetOrder = current.sort_order

    // Optimistic UI update
    const updatedCats = categories.map((c) => {
      if (c.id === current.id) return { ...c, sort_order: newCurrentOrder }
      if (c.id === target.id) return { ...c, sort_order: newTargetOrder }
      return c
    })
    onCategoriesChange(updatedCats)

    try {
      await reorderCategories([
        { id: current.id, sort_order: newCurrentOrder },
        { id: target.id, sort_order: newTargetOrder },
      ])
      onToast('success', 'Urutan kategori berhasil diperbarui')
    } catch (err: any) {
      onToast('error', 'Gagal memperbarui urutan kategori.')
      // Revert if error
      onCategoriesChange(categories)
    } finally {
      setReordering(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* ── Sub-Tab Header ────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h2 className="text-xl font-extrabold text-stone-900 tracking-tight">Manajemen Kategori Menu</h2>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-900 border border-amber-200">
              {categories.length} Kategori
            </span>
          </div>
          <p className="text-stone-500 text-xs sm:text-sm mt-1">
            Atur pengelompokan menu kasir, aplikasi, dan kiosk beserta nomor urut tampilannya.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={openAdd}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 active:bg-amber-700 text-white font-bold text-xs sm:text-sm shadow-sm transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Tambah Kategori Baru</span>
          </button>
        </div>
      </div>

      {/* ── Search & Filter ──────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-stone-200/80 p-3.5 shadow-2xs flex items-center justify-between gap-3">
        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            placeholder="Cari nama kategori..."
            value={searchFilter}
            onChange={(e) => setSearchFilter(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 rounded-xl border border-stone-200 bg-stone-50 focus:bg-white text-stone-900 text-xs sm:text-sm font-medium focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-colors"
          />
        </div>
        <span className="text-xs text-stone-400 font-semibold hidden sm:inline">
          Menampilkan {filteredCategories.length} dari {categories.length} kategori
        </span>
      </div>

      {/* ── Categories Table ─────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-stone-200/80 shadow-2xs overflow-hidden">
        {filteredCategories.length === 0 ? (
          <div className="py-14 text-center flex flex-col items-center justify-center p-6">
            <div className="w-14 h-14 rounded-2xl bg-amber-50 flex items-center justify-center mb-3">
              <Tag className="w-7 h-7 text-amber-500" strokeWidth={1.5} />
            </div>
            <h3 className="font-extrabold text-stone-900 text-base">Kategori Tidak Ditemukan</h3>
            <p className="text-stone-500 text-xs mt-1 max-w-sm">
              {searchFilter
                ? 'Tidak ada kategori yang cocok dengan pencarian.'
                : 'Belum ada kategori menu. Klik tombol di atas untuk membuat kategori baru.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs sm:text-sm">
              <thead>
                <tr className="bg-stone-50/90 border-b border-stone-200 text-stone-500 text-[11px] font-bold uppercase tracking-wider">
                  <th className="py-3 px-4 w-28 text-center">Urutan</th>
                  <th className="py-3 px-4">Nama Kategori</th>
                  <th className="py-3 px-4">Menu Terdaftar</th>
                  <th className="py-3 px-4 text-center w-32">Geser Posisi</th>
                  <th className="py-3 px-4 text-right w-28">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {filteredCategories.map((cat, idx) => {
                  const menuCount = items.filter((i) => i.category_id === cat.id).length
                  const isFirst = idx === 0
                  const isLast = idx === filteredCategories.length - 1

                  return (
                    <tr key={cat.id} className="hover:bg-amber-50/30 transition-colors">
                      {/* Sort Order */}
                      <td className="py-3 px-4 text-center">
                        <span className="inline-flex items-center justify-center w-8 h-8 rounded-xl bg-stone-100 font-bold font-mono text-stone-800 text-xs border border-stone-200">
                          {cat.sort_order}
                        </span>
                      </td>

                      {/* Name */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-lg bg-amber-100/70 text-amber-800 flex items-center justify-center shrink-0">
                            <Tag className="w-4 h-4" />
                          </div>
                          <span className="font-bold text-stone-900 text-sm">{cat.name}</span>
                        </div>
                      </td>

                      {/* Linked Menus Count */}
                      <td className="py-3 px-4">
                        <span
                          className={cn(
                            'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold border',
                            menuCount > 0
                              ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                              : 'bg-stone-100 text-stone-400 border-stone-200'
                          )}
                        >
                          <Sandwich className="w-3.5 h-3.5" />
                          <span>{menuCount} Menu</span>
                        </span>
                      </td>

                      {/* Quick Move Buttons */}
                      <td className="py-3 px-4 text-center">
                        <div className="inline-flex items-center gap-1 bg-stone-100 p-1 rounded-xl border border-stone-200">
                          <button
                            type="button"
                            disabled={isFirst || reordering}
                            onClick={() => handleMove(idx, 'up')}
                            className="p-1 rounded-lg text-stone-600 hover:bg-white hover:text-stone-900 disabled:opacity-30 disabled:pointer-events-none transition-colors cursor-pointer"
                            title="Pindah ke Atas"
                          >
                            <ChevronUp className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            disabled={isLast || reordering}
                            onClick={() => handleMove(idx, 'down')}
                            className="p-1 rounded-lg text-stone-600 hover:bg-white hover:text-stone-900 disabled:opacity-30 disabled:pointer-events-none transition-colors cursor-pointer"
                            title="Pindah ke Bawah"
                          >
                            <ChevronDown className="w-4 h-4" />
                          </button>
                        </div>
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => openEdit(cat)}
                            className="p-2 rounded-lg bg-stone-100 hover:bg-amber-100 text-stone-700 hover:text-amber-800 transition-colors cursor-pointer"
                            title="Edit Kategori"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            disabled={deletingId === cat.id}
                            onClick={() => handleDelete(cat)}
                            className="p-2 rounded-lg bg-stone-100 hover:bg-red-100 text-stone-700 hover:text-red-700 disabled:opacity-40 transition-colors cursor-pointer"
                            title="Hapus Kategori"
                          >
                            {deletingId === cat.id ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin text-red-500" />
                            ) : (
                              <Trash2 className="w-3.5 h-3.5" />
                            )}
                          </button>
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

      {/* ── Modal Tambah / Edit Kategori ─────────────────────── */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md border border-stone-200 overflow-hidden animate-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-5 border-b border-stone-100 bg-stone-50/70">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-500 text-white flex items-center justify-center shadow-xs">
                  <Tag className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-stone-900 text-lg">
                    {form.id ? 'Edit Kategori Menu' : 'Tambah Kategori Baru'}
                  </h3>
                  <p className="text-stone-500 text-xs mt-0.5">
                    {form.id ? 'Perbarui nama atau urutan tampilan kategori' : 'Buat kategori baru untuk produk menu'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="w-9 h-9 rounded-xl bg-stone-100 hover:bg-stone-200 flex items-center justify-center text-stone-500 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSave} className="p-6 space-y-4">
              {modalError && (
                <div className="flex items-center gap-2 p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs font-semibold">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{modalError}</span>
                </div>
              )}

              <div>
                <label className="text-xs font-bold text-stone-700 uppercase tracking-wider block mb-1.5">
                  Nama Kategori <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: Makanan Utama, Minuman Segar, Promo"
                  value={form.name}
                  onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                  className="w-full px-3 py-2.5 rounded-xl border border-stone-200 bg-white text-stone-900 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-stone-700 uppercase tracking-wider block mb-1.5">
                  Nomor Urut Tampilan
                </label>
                <input
                  type="number"
                  min={1}
                  required
                  value={form.sort_order}
                  onChange={(e) => setForm((p) => ({ ...p, sort_order: parseInt(e.target.value, 10) || 1 }))}
                  className="w-full px-3 py-2.5 rounded-xl border border-stone-200 bg-white text-stone-900 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                />
                <p className="text-[11px] text-stone-400 mt-1">
                  Urutan nomor menentukan posisi tab kategori di POS kasir dan kiosk.
                </p>
              </div>

              {/* Modal Actions */}
              <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-stone-100">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2.5 rounded-xl border border-stone-200 text-stone-600 hover:bg-stone-50 font-bold text-xs sm:text-sm transition-colors cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 active:bg-amber-700 text-white font-bold text-xs sm:text-sm shadow-sm transition-all cursor-pointer disabled:opacity-50"
                >
                  {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                  <span>{saving ? 'Menyimpan...' : form.id ? 'Simpan Perubahan' : 'Tambah Kategori'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
