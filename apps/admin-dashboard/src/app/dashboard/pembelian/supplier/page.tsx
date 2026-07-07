'use client'
import { useState } from 'react'
import { Plus, Edit2, Check, Phone, MapPin, Tag } from 'lucide-react'
import { useSuppliers, useCreateSupplier, useUpdateSupplier, type Supplier } from '@/hooks/usePurchaseOrder'
import { Spinner } from '@suka/design-system'
import { toast } from 'sonner'

const KATEGORI_OPTIONS = [
  { value: 'item core', label: '⭐ Item Core' },
  { value: 'bumbu', label: '🌶️ Bumbu' },
  { value: 'minuman', label: '🥤 Minuman' },
  { value: 'kemasan', label: '📦 Kemasan' },
  { value: 'lainnya', label: '📋 Lainnya' },
]

type FormState = {
  nama: string; kontak: string; alamat: string; kategori: string; catatan: string
}

const emptyForm: FormState = { nama: '', kontak: '', alamat: '', kategori: '', catatan: '' }

export default function SupplierPage() {
  const { data: suppliers = [], isLoading } = useSuppliers()
  const createSupplier = useCreateSupplier()
  const updateSupplier = useUpdateSupplier()

  const [showForm, setShowForm] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [form, setForm] = useState<FormState>(emptyForm)

  function openCreate() { setForm(emptyForm); setEditId(null); setShowForm(true) }
  function openEdit(s: Supplier) {
    setForm({ nama: s.nama, kontak: s.kontak ?? '', alamat: s.alamat ?? '', kategori: s.kategori ?? '', catatan: s.catatan ?? '' })
    setEditId(s.id)
    setShowForm(true)
  }
  function closeForm() { setShowForm(false); setEditId(null); setForm(emptyForm) }

  async function handleSave() {
    if (!form.nama.trim()) { toast.error('Nama supplier wajib diisi'); return }
    const payload = {
      nama: form.nama.trim(),
      kontak: form.kontak.trim() || null,
      alamat: form.alamat.trim() || null,
      kategori: form.kategori || null,
      catatan: form.catatan.trim() || null,
    }
    if (editId) {
      await updateSupplier.mutateAsync({ id: editId, ...payload })
    } else {
      await createSupplier.mutateAsync(payload as any)
    }
    closeForm()
  }

  const isSaving = createSupplier.isPending || updateSupplier.isPending

  return (
    <div className="space-y-5 max-w-2xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-extrabold text-suka-brown tracking-tight">Master Supplier</h1>
          <p className="text-sm text-gray-500 mt-0.5">Daftar pemasok bahan baku ke Kitchen Bogor.</p>
        </div>
        <button onClick={openCreate}
          className="flex items-center gap-2 bg-suka-orange text-white font-bold px-4 py-2.5 rounded-xl hover:bg-suka-orange/90 active:scale-95 transition-all text-sm shadow-sm">
          <Plus size={16} /> Tambah Supplier
        </button>
      </div>

      {/* Form */}
      {showForm && (
        <div className="bg-white rounded-2xl border border-suka-orange/30 shadow-md p-5 space-y-4">
          <h2 className="font-bold text-suka-brown">{editId ? 'Edit Supplier' : 'Tambah Supplier Baru'}</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-xs font-bold text-gray-500 mb-1.5 uppercase tracking-wide">Nama Supplier *</label>
              <input type="text" value={form.nama} onChange={e => setForm(f => ({ ...f, nama: e.target.value }))}
                placeholder="Contoh: CV Berkah Protein"
                className="w-full border border-suka-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-suka-brown/20" />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-500 mb-1.5 uppercase tracking-wide">No. Kontak / WhatsApp</label>
              <input type="text" value={form.kontak} onChange={e => setForm(f => ({ ...f, kontak: e.target.value }))}
                placeholder="0812-xxxx-xxxx"
                className="w-full border border-suka-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-suka-brown/20" />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-500 mb-1.5 uppercase tracking-wide">Kategori Bahan Utama</label>
              <select value={form.kategori} onChange={e => setForm(f => ({ ...f, kategori: e.target.value }))}
                className="w-full border border-suka-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-suka-brown/20">
                <option value="">— Pilih kategori —</option>
                {KATEGORI_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-bold text-gray-500 mb-1.5 uppercase tracking-wide">Alamat</label>
              <input type="text" value={form.alamat} onChange={e => setForm(f => ({ ...f, alamat: e.target.value }))}
                placeholder="Alamat lengkap supplier"
                className="w-full border border-suka-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-suka-brown/20" />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-bold text-gray-500 mb-1.5 uppercase tracking-wide">Catatan</label>
              <textarea value={form.catatan} onChange={e => setForm(f => ({ ...f, catatan: e.target.value }))} rows={2}
                placeholder="Syarat pembayaran, min. order, dll."
                className="w-full border border-suka-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-suka-brown/20 resize-none" />
            </div>
          </div>
          <div className="flex gap-3 pt-2">
            <button onClick={closeForm} className="flex-1 py-2.5 border border-suka-gray-200 rounded-xl font-bold text-sm text-gray-500 hover:bg-suka-gray-50 transition-colors">
              Batal
            </button>
            <button onClick={handleSave} disabled={isSaving}
              className="flex-1 py-2.5 bg-suka-orange text-white rounded-xl font-bold text-sm hover:bg-suka-orange/90 active:scale-[0.99] transition-all disabled:opacity-50 flex items-center justify-center gap-2">
              {isSaving ? <Spinner className="w-4 h-4" /> : <Check size={14} />}
              {editId ? 'Simpan Perubahan' : 'Tambah Supplier'}
            </button>
          </div>
        </div>
      )}

      {/* List */}
      {isLoading ? (
        <div className="flex justify-center py-12"><Spinner /></div>
      ) : suppliers.length === 0 ? (
        <div className="text-center py-16 text-gray-400 bg-white rounded-2xl border border-suka-gray-200">
          <p className="font-medium">Belum ada supplier</p>
          <p className="text-sm mt-1">Tambahkan supplier untuk digunakan di Purchase Order</p>
        </div>
      ) : (
        <div className="space-y-2">
          {suppliers.map(s => (
            <div key={s.id} className="bg-white rounded-2xl border border-suka-gray-200 shadow-sm p-4 flex items-start gap-4 hover:border-suka-brown/20 transition-colors group">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-suka-ink">{s.nama}</span>
                  {s.kategori && (
                    <span className="bg-suka-cream text-suka-brown text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                      <Tag size={9} />
                      {KATEGORI_OPTIONS.find(k => k.value === s.kategori)?.label?.replace(/^[^ ]+ /, '') ?? s.kategori}
                    </span>
                  )}
                </div>
                <div className="flex flex-wrap gap-3 mt-1.5 text-xs text-gray-500">
                  {s.kontak && <span className="flex items-center gap-1"><Phone size={10} />{s.kontak}</span>}
                  {s.alamat && <span className="flex items-center gap-1 truncate max-w-xs"><MapPin size={10} />{s.alamat}</span>}
                </div>
                {s.catatan && <p className="text-xs text-gray-400 mt-1 italic">{s.catatan}</p>}
              </div>
              <button onClick={() => openEdit(s)}
                className="p-2 rounded-xl text-gray-300 hover:text-suka-orange hover:bg-suka-orange/5 transition-colors opacity-0 group-hover:opacity-100">
                <Edit2 size={14} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
