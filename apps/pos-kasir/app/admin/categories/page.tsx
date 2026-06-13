'use client'

import { useEffect, useState } from 'react'
import {
  Plus, Pencil, Trash2, X, Loader2,
  AlertCircle, Tag, GripVertical, Check,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import type { Category } from '@/types'

interface FormState {
  id: string | null
  name: string
  sort_order: string
}

const EMPTY: FormState = { id: null, name: '', sort_order: '' }

export default function AdminCategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading]       = useState(true)
  const [form, setForm]             = useState<FormState>(EMPTY)
  const [showForm, setShowForm]     = useState(false)
  const [saving, setSaving]         = useState(false)
  const [error, setError]           = useState('')
  const [deletingId, setDeletingId] = useState<string | null>(null)

  async function fetchCategories() {
    const supabase = createClient()
    const { data } = await supabase
      .from('categories')
      .select('*')
      .order('sort_order')
    setCategories(data ?? [])
    setLoading(false)
  }

  useEffect(() => { fetchCategories() }, [])

  function openAdd() {
    const nextOrder = categories.length > 0
      ? Math.max(...categories.map((c) => c.sort_order)) + 1
      : 1
    setForm({ ...EMPTY, sort_order: String(nextOrder) })
    setError('')
    setShowForm(true)
  }

  function openEdit(cat: Category) {
    setForm({ id: cat.id, name: cat.name, sort_order: String(cat.sort_order) })
    setError('')
    setShowForm(true)
  }

  function closeForm() { setShowForm(false); setError('') }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (!form.name.trim()) { setError('Nama kategori wajib diisi'); return }

    const sortOrder = parseInt(form.sort_order)
    if (isNaN(sortOrder) || sortOrder < 0) { setError('Urutan harus angka positif'); return }

    setSaving(true)
    const supabase = createClient()
    const payload = { name: form.name.trim(), sort_order: sortOrder }

    const { error: err } = form.id
      ? await supabase.from('categories').update(payload).eq('id', form.id)
      : await supabase.from('categories').insert(payload)

    if (err) setError(err.message)
    else { closeForm(); fetchCategories() }
    setSaving(false)
  }

  async function handleDelete(cat: Category) {
    if (!confirm(`Hapus kategori "${cat.name}"?\n\nMenu yang menggunakan kategori ini akan kehilangan kategorinya.`)) return
    setDeletingId(cat.id)
    const supabase = createClient()
    await supabase.from('categories').delete().eq('id', cat.id)
    setDeletingId(null)
    fetchCategories()
  }

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Kategori Menu</h1>
          <p className="text-gray-400 text-sm mt-0.5">{categories.length} kategori terdaftar</p>
        </div>
        <button onClick={openAdd} className="btn-primary py-2.5 px-5 text-sm">
          <Plus className="w-4 h-4" />
          Tambah Kategori
        </button>
      </div>

      {/* Modal Form */}
      {showForm && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={(e) => { if (e.target === e.currentTarget) closeForm() }}
        >
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm animate-scale-in">

            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 bg-amber-100 rounded-2xl flex items-center justify-center">
                  <Tag className="w-5 h-5 text-amber-500" strokeWidth={1.5} />
                </div>
                <div>
                  <h2 className="font-bold text-lg text-gray-900 leading-none">
                    {form.id ? 'Edit Kategori' : 'Tambah Kategori'}
                  </h2>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {form.id ? 'Perbarui nama atau urutan' : 'Buat kategori baru'}
                  </p>
                </div>
              </div>
              <button onClick={closeForm}
                className="w-8 h-8 bg-gray-100 hover:bg-red-50 hover:text-red-500 rounded-xl
                  flex items-center justify-center text-gray-400 transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSave} className="px-6 py-5 space-y-4">

              {/* Name */}
              <div>
                <label className="input-label">Nama Kategori <span className="text-red-400 font-normal">*</span></label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  required
                  maxLength={50}
                  className="input"
                  placeholder="Contoh: Shawarma, Minuman, Snack"
                  autoFocus
                />
              </div>

              {/* Sort order */}
              <div>
                <label className="input-label">
                  Urutan Tampil
                  <span className="text-gray-400 font-normal text-xs ml-1">(angka lebih kecil = tampil lebih awal)</span>
                </label>
                <input
                  type="number"
                  value={form.sort_order}
                  onChange={(e) => setForm({ ...form, sort_order: e.target.value })}
                  min="0"
                  className="input"
                  placeholder="1"
                />
              </div>

              {/* Error */}
              {error && (
                <div className="flex items-center gap-2.5 bg-red-50 border border-red-100 rounded-xl p-3 text-red-600 text-sm">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-3 pt-1">
                <button type="button" onClick={closeForm} className="btn-secondary flex-1 py-2.5 text-sm">
                  Batal
                </button>
                <button type="submit" disabled={saving} className="btn-primary flex-[2] py-2.5 text-sm">
                  {saving
                    ? <><Loader2 className="w-4 h-4 animate-spin" /> Menyimpan...</>
                    : <><Check className="w-4 h-4" />{form.id ? 'Simpan Perubahan' : 'Tambah Kategori'}</>
                  }
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Category List */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="rounded-2xl bg-gray-100 animate-pulse h-16" />
          ))}
        </div>
      ) : categories.length === 0 ? (
        <div className="card p-16 flex flex-col items-center text-center">
          <div className="w-16 h-16 bg-amber-50 rounded-full flex items-center justify-center mb-4">
            <Tag className="w-8 h-8 text-amber-200" strokeWidth={1} />
          </div>
          <p className="font-semibold text-gray-500">Belum ada kategori</p>
          <p className="text-sm text-gray-400 mt-1">Tambahkan kategori untuk mengelompokkan menu</p>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-100 bg-gray-50 grid grid-cols-[auto_1fr_auto_auto] gap-4 items-center">
            <span className="w-6" />
            <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Nama Kategori</span>
            <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide text-center w-20">Urutan</span>
            <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide text-center w-20">Aksi</span>
          </div>

          <div className="divide-y divide-gray-50">
            {categories.map((cat) => (
              <div
                key={cat.id}
                className="px-5 py-4 grid grid-cols-[auto_1fr_auto_auto] gap-4 items-center
                  hover:bg-gray-50/60 transition-colors group"
              >
                {/* Drag handle (visual only) */}
                <GripVertical className="w-4 h-4 text-gray-200 group-hover:text-gray-300 transition-colors" />

                {/* Name */}
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-amber-50 rounded-xl flex items-center justify-center flex-shrink-0">
                    <Tag className="w-4 h-4 text-amber-400" strokeWidth={1.5} />
                  </div>
                  <span className="font-semibold text-gray-900">{cat.name}</span>
                </div>

                {/* Sort order badge */}
                <div className="w-20 flex justify-center">
                  <span className="text-xs font-bold bg-gray-100 text-gray-500 px-3 py-1 rounded-full">
                    #{cat.sort_order}
                  </span>
                </div>

                {/* Actions */}
                <div className="w-20 flex items-center justify-center gap-2">
                  <button
                    onClick={() => openEdit(cat)}
                    className="w-8 h-8 bg-amber-50 hover:bg-amber-100 text-amber-600 rounded-xl
                      flex items-center justify-center transition-colors"
                    title="Edit"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => handleDelete(cat)}
                    disabled={deletingId === cat.id}
                    className="w-8 h-8 bg-gray-50 hover:bg-red-50 text-gray-300 hover:text-red-500
                      rounded-xl flex items-center justify-center transition-all disabled:opacity-50"
                    title="Hapus"
                  >
                    {deletingId === cat.id
                      ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      : <Trash2 className="w-3.5 h-3.5" />
                    }
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Info note */}
      {categories.length > 0 && (
        <p className="text-xs text-gray-400 text-center">
          Kategori yang dihapus tidak akan menghapus menu — hanya melepas pengelompokannya.
        </p>
      )}
    </div>
  )
}
