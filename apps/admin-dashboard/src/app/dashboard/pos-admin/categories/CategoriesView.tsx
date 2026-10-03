'use client'

import { useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { useRouter } from 'next/navigation'
import { Plus, Pencil, Trash2, X, Loader2, AlertCircle, Tag, Minus, Search, UtensilsCrossed, Info } from 'lucide-react'
import { createClient } from '@/lib/supabase'
import type { Category } from '@/pos-types'
import { useDialogStore } from '@/lib/dialogStore'
import { toast } from 'sonner'
import { syncCategoryOnline } from '../menu/actions'

export interface CategoryRow extends Category {
  /** null = hitungan menu gagal dimuat. */
  menu_count: number | null
}

interface FormState {
  id: string | null
  name: string
  sort_order: number
}

const EMPTY: FormState = { id: null, name: '', sort_order: 1 }

export default function CategoriesView({ initialCategories }: { initialCategories: CategoryRow[] }) {
  const router = useRouter()
  const { showConfirm } = useDialogStore()
  const [form, setForm] = useState<FormState>(EMPTY)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [query, setQuery] = useState('')

  const totalMenus = useMemo(
    () => initialCategories.reduce((sum, c) => sum + (c.menu_count ?? 0), 0),
    [initialCategories],
  )
  const emptyCategories = initialCategories.filter(c => c.menu_count === 0).length
  const q = query.trim().toLowerCase()
  const shown = q ? initialCategories.filter(c => c.name.toLowerCase().includes(q)) : initialCategories

  function openAdd() {
    const nextOrder = initialCategories.length > 0 ? Math.max(...initialCategories.map(c => c.sort_order)) + 1 : 1
    setForm({ ...EMPTY, sort_order: nextOrder })
    setError('')
    setShowForm(true)
  }

  function openEdit(cat: CategoryRow) {
    setForm({ id: cat.id, name: cat.name, sort_order: cat.sort_order })
    setError('')
    setShowForm(true)
  }

  function closeForm() {
    if (saving) return
    setShowForm(false)
    setError('')
  }

  // Posisi kategori di kasir setelah disimpan (urut sort_order, lalu nama).
  const preview = useMemo(() => {
    if (!showForm) return null
    const name = form.name.trim() || 'Kategori ini'
    const list = [
      ...initialCategories.filter(c => c.id !== form.id).map(c => ({ name: c.name, sort_order: c.sort_order, self: false })),
      { name, sort_order: form.sort_order, self: true },
    ].sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name))
    const pos = list.findIndex(c => c.self)
    return { pos, total: list.length, prev: list[pos - 1]?.name, next: list[pos + 1]?.name }
  }, [showForm, form.name, form.sort_order, form.id, initialCategories])

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    const name = form.name.trim()
    if (!name) return setError('Nama kategori wajib diisi')
    const dup = initialCategories.find(c => c.id !== form.id && c.name.trim().toLowerCase() === name.toLowerCase())
    if (dup) return setError(`Kategori "${dup.name}" sudah ada`)

    setSaving(true)
    const supabase = createClient()
    const payload = { name, sort_order: form.sort_order }

    // .select('id') agar penolakan RLS (0 baris berubah) tidak tampil sebagai sukses.
    const { data, error: err } = form.id
      ? await supabase.from('categories').update(payload).eq('id', form.id).select('id')
      : await supabase.from('categories').insert(payload).select('id')

    if (err) {
      setError(err.message)
    } else if (!data || data.length === 0) {
      setError('Perubahan ditolak. Akun ini tidak punya izin mengubah kategori.')
    } else {
      if (form.id) await syncCategoryOnline(form.id)
      toast.success(form.id ? 'Kategori diperbarui' : 'Kategori ditambahkan')
      setShowForm(false)
      router.refresh()
    }
    setSaving(false)
  }

  async function handleDelete(cat: CategoryRow) {
    const impact =
      cat.menu_count && cat.menu_count > 0
        ? `\n\n${cat.menu_count} menu di kategori ini akan menjadi tanpa kategori (menunya tidak ikut terhapus).`
        : ''
    const confirmed = await showConfirm(`Hapus kategori "${cat.name}"?${impact}`)
    if (!confirmed) return

    setDeletingId(cat.id)
    const supabase = createClient()
    const { data, error: err } = await supabase.from('categories').delete().eq('id', cat.id).select('id')
    setDeletingId(null)

    if (err) toast.error(err.message)
    else if (!data || data.length === 0) toast.error('Kategori tidak terhapus. Akun ini tidak punya izin.')
    else {
      toast.success(`Kategori "${cat.name}" dihapus`)
      router.refresh()
    }
  }

  return (
    <div className="mx-auto w-full max-w-4xl animate-fade-in space-y-6 pb-16">
      {/* ── Header ── */}
      <header className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <h1 className="font-display text-3xl tracking-wide text-suka-brown sm:text-4xl">Kategori Menu</h1>
          <p className="mt-1 max-w-xl text-sm font-medium text-slate-500">
            Pengelompokan menu di kasir. Urutan kecil tampil lebih dulu.
          </p>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <dl className="grid grid-cols-2 gap-2">
            <div className="min-w-[5.5rem] rounded-2xl bg-white px-4 py-2.5 text-suka-brown ring-1 ring-slate-200/70">
              <dt className="text-[11px] font-bold uppercase tracking-wide opacity-80">Kategori</dt>
              <dd className="font-display text-2xl leading-none">{initialCategories.length}</dd>
            </div>
            <div className="min-w-[5.5rem] rounded-2xl bg-amber-50 px-4 py-2.5 text-amber-900 ring-1 ring-amber-100">
              <dt className="text-[11px] font-bold uppercase tracking-wide opacity-80">Menu</dt>
              <dd className="font-display text-2xl leading-none">{totalMenus}</dd>
            </div>
          </dl>
          <button
            onClick={openAdd}
            className="inline-flex h-12 cursor-pointer items-center justify-center gap-2 rounded-xl bg-suka-brown px-5 text-sm font-bold text-white shadow-sm transition-colors duration-150 hover:bg-suka-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-suka-orange/50 active:scale-[0.98]"
          >
            <Plus className="h-5 w-5" />
            Tambah Kategori
          </button>
        </div>
      </header>

      {initialCategories.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-slate-300 bg-white px-6 py-16 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-suka-orange/10">
            <Tag className="h-5 w-5 text-suka-orange" />
          </div>
          <p className="text-sm font-bold text-slate-700">Belum ada kategori</p>
          <p className="mt-1 text-sm text-slate-500">Tambahkan kategori untuk mengelompokkan menu di kasir.</p>
          <button type="button" onClick={openAdd} className="mt-4 cursor-pointer text-sm font-bold text-suka-brown underline-offset-4 hover:underline">
            Tambah kategori
          </button>
        </div>
      ) : (
        <>
          {/* ── Toolbar ── */}
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative w-full sm:max-w-xs">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="search"
                aria-label="Cari kategori"
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="Cari kategori…"
                className="h-11 w-full rounded-xl border border-slate-200 bg-white pl-11 pr-4 text-sm font-medium text-slate-900 outline-none transition-colors placeholder:text-slate-400 focus:border-suka-orange focus:ring-2 focus:ring-suka-orange/15"
              />
            </div>
            {emptyCategories > 0 && (
              <p className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-700">
                <Info className="h-3.5 w-3.5" /> {emptyCategories} kategori belum berisi menu
              </p>
            )}
          </div>

          {/* ── Daftar ── */}
          {shown.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-slate-300 bg-white px-6 py-12 text-center">
              <p className="text-sm font-bold text-slate-700">Tidak ada kategori &quot;{query}&quot;</p>
              <button type="button" onClick={() => setQuery('')} className="mt-3 cursor-pointer text-sm font-bold text-suka-brown underline-offset-4 hover:underline">
                Hapus pencarian
              </button>
            </div>
          ) : (
            <section aria-label="Daftar kategori" className="overflow-hidden rounded-3xl bg-white shadow-sm ring-1 ring-slate-200/70">
              <div aria-hidden className="hidden grid-cols-[4.5rem_minmax(0,1fr)_8rem_9rem] items-center gap-4 border-b border-slate-100 bg-slate-50/70 px-6 py-3 text-[11px] font-bold uppercase tracking-wide text-slate-500 sm:grid">
                <span>Urutan</span>
                <span>Kategori</span>
                <span>Isi</span>
                <span />
              </div>
              <ol className="divide-y divide-slate-100">
                {shown.map(cat => (
                  <li
                    key={cat.id}
                    className="grid grid-cols-[3.5rem_minmax(0,1fr)] items-center gap-x-3 gap-y-3 px-4 py-3.5 transition-colors duration-150 hover:bg-suka-cream sm:grid-cols-[4.5rem_minmax(0,1fr)_8rem_9rem] sm:gap-4 sm:px-6"
                  >
                    <span
                      title="Urutan tampil di kasir"
                      className="flex h-11 w-11 items-center justify-center rounded-xl bg-suka-orange/10 font-display text-lg tabular-nums leading-none text-suka-brown"
                    >
                      {cat.sort_order}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-[15px] font-bold text-slate-900">{cat.name}</p>
                      <p className="mt-0.5 text-xs font-medium text-slate-500 sm:hidden">
                        <MenuCount count={cat.menu_count} />
                      </p>
                    </div>
                    <p className="hidden text-sm font-semibold sm:block">
                      <MenuCount count={cat.menu_count} />
                    </p>
                    <div className="col-span-2 flex items-center gap-1.5 sm:col-span-1 sm:justify-end">
                      <button
                        type="button"
                        onClick={() => openEdit(cat)}
                        aria-label={`Ubah ${cat.name}`}
                        className="inline-flex h-9 flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-lg px-3 text-xs font-bold text-slate-700 ring-1 ring-inset ring-slate-200 transition-colors duration-150 hover:bg-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-suka-orange/40 sm:flex-none"
                      >
                        <Pencil className="h-3.5 w-3.5" /> Ubah
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(cat)}
                        disabled={deletingId === cat.id}
                        aria-label={`Hapus ${cat.name}`}
                        title="Hapus kategori"
                        className="inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg text-slate-400 transition-colors duration-150 hover:bg-rose-50 hover:text-rose-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-suka-orange/40 disabled:cursor-wait disabled:opacity-60"
                      >
                        {deletingId === cat.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                      </button>
                    </div>
                  </li>
                ))}
              </ol>
            </section>
          )}

          <p className="text-center text-xs font-medium text-slate-400">
            Menghapus kategori tidak menghapus menunya — hanya melepas pengelompokannya.
          </p>
        </>
      )}

      {/* ── Modal tambah / ubah ── */}
      {showForm && createPortal(
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-suka-ink/50 p-2 backdrop-blur-sm sm:items-center sm:p-4"
          onClick={e => { if (e.target === e.currentTarget) closeForm() }}
          onKeyDown={e => { if (e.key === 'Escape') closeForm() }}
        >
          <div role="dialog" aria-modal="true" aria-labelledby="cat-form-title" className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl animate-scale-in sm:rounded-3xl">
            <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-5 py-4 sm:px-6">
              <div className="min-w-0">
                <h2 id="cat-form-title" className="font-display text-2xl leading-tight tracking-wide text-suka-brown">
                  {form.id ? 'Ubah kategori' : 'Kategori baru'}
                </h2>
                <p className="mt-0.5 text-xs font-medium text-slate-500">
                  {form.id ? 'Perbarui nama atau urutan tampil' : 'Kelompok baru untuk menu di kasir'}
                </p>
              </div>
              <button
                type="button"
                aria-label="Tutup"
                onClick={closeForm}
                className="flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-xl text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-5 px-5 py-5 sm:px-6">
              <div>
                <div className="mb-1.5 flex items-baseline justify-between gap-3">
                  <label htmlFor="cat-name" className="text-sm font-bold text-slate-700">Nama kategori</label>
                  <span className="text-xs font-medium tabular-nums text-slate-400">{form.name.length}/50</span>
                </div>
                <input
                  id="cat-name"
                  type="text"
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  required
                  maxLength={50}
                  autoFocus
                  placeholder="Contoh: Shawarma, Minuman, Snack"
                  className="h-12 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm font-medium text-slate-900 outline-none transition-colors placeholder:text-slate-400 focus:border-suka-orange focus:ring-2 focus:ring-suka-orange/15"
                />
              </div>

              <div>
                <p className="mb-1.5 text-sm font-bold text-slate-700">Urutan tampil</p>
                <div className="flex flex-wrap items-center gap-3">
                  <OrderInput value={form.sort_order} onChange={v => setForm(f => ({ ...f, sort_order: v }))} />
                  <span className="text-xs font-medium text-slate-500">Angka kecil tampil lebih dulu.</span>
                </div>
                {preview && (
                  <div className="mt-3 rounded-xl bg-slate-50 px-4 py-3 text-xs font-medium text-slate-600">
                    Tampil di posisi <span className="font-bold text-suka-brown">ke-{preview.pos + 1}</span> dari {preview.total}
                    {preview.prev && <>, setelah <span className="font-bold text-slate-800">{preview.prev}</span></>}
                    {preview.next && <>{preview.prev ? ' dan' : ','} sebelum <span className="font-bold text-slate-800">{preview.next}</span></>}.
                  </div>
                )}
              </div>

              {error && (
                <div role="alert" className="flex items-start gap-2.5 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-800">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <div className="flex gap-2.5 pt-1">
                <button
                  type="button"
                  onClick={closeForm}
                  disabled={saving}
                  className="min-h-12 flex-1 cursor-pointer rounded-xl border border-slate-200 bg-white px-4 text-sm font-bold text-slate-600 transition-colors hover:bg-slate-100 disabled:opacity-50"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex min-h-12 flex-[2] cursor-pointer items-center justify-center gap-2 rounded-xl bg-suka-brown px-4 text-sm font-bold text-white shadow-sm transition-colors hover:bg-suka-ink disabled:cursor-wait disabled:opacity-70"
                >
                  {saving ? <Loader2 className="h-5 w-5 animate-spin" /> : form.id ? 'Simpan perubahan' : 'Tambah kategori'}
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body,
      )}
    </div>
  )
}

function MenuCount({ count }: { count: number | null }) {
  if (count === null) return <span className="text-slate-400">—</span>
  if (count === 0) return <span className="text-amber-700">Belum ada menu</span>
  return (
    <span className="inline-flex items-center gap-1.5 text-slate-600">
      <UtensilsCrossed className="h-3.5 w-3.5 text-slate-400" />
      {count} menu
    </span>
  )
}

/** Input urutan: boleh negatif (mis. -10 untuk dipaksa tampil paling depan). */
function OrderInput({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const [draft, setDraft] = useState(String(value))
  const [prev, setPrev] = useState(value)
  if (prev !== value) {
    setPrev(value)
    setDraft(String(value))
  }
  const clamp = (n: number) => Math.max(-999, Math.min(999, Math.round(n)))
  const commit = (raw: string) => {
    const t = raw.trim()
    if (/^-?\d+$/.test(t)) onChange(clamp(Number(t)))
    else setDraft(String(value))
  }
  const btn = 'flex w-11 cursor-pointer items-center justify-center text-slate-500 transition-colors hover:bg-slate-50 hover:text-slate-800'
  return (
    <div className="inline-flex h-12 items-stretch overflow-hidden rounded-xl border border-slate-200 bg-white focus-within:border-suka-orange focus-within:ring-2 focus-within:ring-suka-orange/15">
      <button type="button" aria-label="Kurangi urutan" onClick={() => onChange(clamp(value - 1))} className={btn}>
        <Minus className="h-4 w-4" />
      </button>
      <input
        aria-label="Urutan tampil"
        value={draft}
        inputMode="numeric"
        onChange={e => setDraft(e.target.value)}
        onBlur={e => commit(e.target.value)}
        onKeyDown={e => {
          if (e.key === 'Enter') {
            e.preventDefault()
            commit((e.target as HTMLInputElement).value)
          }
          if (e.key === 'ArrowUp') { e.preventDefault(); onChange(clamp(value + 1)) }
          if (e.key === 'ArrowDown') { e.preventDefault(); onChange(clamp(value - 1)) }
        }}
        className="w-14 border-x border-slate-100 bg-transparent text-center text-base font-extrabold tabular-nums text-slate-900 focus:outline-none"
      />
      <button type="button" aria-label="Tambah urutan" onClick={() => onChange(clamp(value + 1))} className={btn}>
        <Plus className="h-4 w-4" />
      </button>
    </div>
  )
}
