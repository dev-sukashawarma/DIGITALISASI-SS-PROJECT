'use client'
import { useState } from 'react'
import { Plus, Edit2, Check, Phone, MapPin, Tag } from 'lucide-react'
import { useSuppliers, useCreateSupplier, useUpdateSupplier, useBahanBakuOptions, type Supplier } from '@/hooks/usePurchaseOrder'
import { Spinner } from '@suka/design-system'
import { toast } from 'sonner'
import { PageHeader } from '@/components/ui'

const KATEGORI_OPTIONS = [
  { value: 'item core', label: '⭐ Item Core' },
  { value: 'bumbu', label: '🌶️ Bumbu' },
  { value: 'minuman', label: '🥤 Minuman' },
  { value: 'kemasan', label: '📦 Kemasan' },
  { value: 'lainnya', label: '📋 Lainnya' },
]

type FormState = {
  nama: string; kontak: string; alamat: string; kategori: string; catatan: string; bahan_baku_ids: string[]; termin_hari: number | null
}

const emptyForm: FormState = { nama: '', kontak: '', alamat: '', kategori: '', catatan: '', bahan_baku_ids: [], termin_hari: null }

export default function SupplierPage() {
  const { data: suppliers = [], isLoading } = useSuppliers()
  const createSupplier = useCreateSupplier()
  const updateSupplier = useUpdateSupplier()

  const [showForm, setShowForm] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [form, setForm] = useState<FormState>(emptyForm)

  const { data: bahanList = [] } = useBahanBakuOptions()

  function openCreate() { setForm(emptyForm); setEditId(null); setShowForm(true) }
  function openEdit(s: Supplier) {
    setForm({ 
      nama: s.nama, 
      kontak: s.kontak ?? '', 
      alamat: s.alamat ?? '', 
      kategori: s.kategori ?? '',
      catatan: s.catatan ?? '',
      bahan_baku_ids: s.bahan_baku_ids ?? [],
      termin_hari: s.termin_hari ?? null
    })
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
      bahan_baku_ids: form.bahan_baku_ids,
      termin_hari: form.termin_hari,
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
  return (
    <div className="space-y-6 max-w-3xl animate-fade-in">
      <PageHeader 
        title="Master Supplier" 
        description="Daftar pemasok bahan baku ke Kitchen Bogor."
      >
        <button onClick={openCreate}
          className="mt-3 sm:mt-0 flex items-center justify-center gap-2 bg-gradient-to-r from-suka-brown to-suka-ink text-white font-extrabold px-5 py-2.5 rounded-2xl hover:from-suka-ink hover:to-black active:scale-[.98] transition-all text-sm shadow-[0_8px_20px_rgba(44,24,16,0.15)] w-full sm:w-auto">
          <Plus className="w-5 h-5" /> Tambah Supplier
        </button>
      </PageHeader>

      {/* Form */}
      {showForm && (
        <div className="bg-white/60 backdrop-blur-xl rounded-3xl border border-suka-gray-200/60 shadow-[0_8px_30px_rgba(0,0,0,0.04)] p-5 sm:p-6 space-y-5">
          <h2 className="font-extrabold text-suka-brown text-lg flex items-center gap-2">
            {editId ? 'Edit Supplier' : 'Tambah Supplier Baru'}
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div className="sm:col-span-2">
              <label className="block text-[10px] font-black text-suka-gray-500 mb-1.5 uppercase tracking-widest">Nama Supplier *</label>
              <input type="text" value={form.nama} onChange={e => setForm(f => ({ ...f, nama: e.target.value }))}
                placeholder="Contoh: CV Berkah Protein"
                className="w-full pl-4 pr-3 py-2.5 text-xs font-bold text-suka-ink bg-white shadow-inner border border-suka-gray-200 rounded-xl focus:outline-none focus:border-suka-orange focus:ring-4 focus:ring-suka-orange/10 transition-all" />
            </div>
            <div>
              <label className="block text-[10px] font-black text-suka-gray-500 mb-1.5 uppercase tracking-widest">No. Kontak / WhatsApp</label>
              <input type="text" value={form.kontak} onChange={e => setForm(f => ({ ...f, kontak: e.target.value }))}
                placeholder="0812-xxxx-xxxx"
                className="w-full pl-4 pr-3 py-2.5 text-xs font-bold text-suka-ink bg-white shadow-inner border border-suka-gray-200 rounded-xl focus:outline-none focus:border-suka-orange focus:ring-4 focus:ring-suka-orange/10 transition-all" />
            </div>
            <div>
              <label className="block text-[10px] font-black text-suka-gray-500 mb-1.5 uppercase tracking-widest">Kategori Bahan Utama</label>
              <select value={form.kategori} onChange={e => setForm(f => ({ ...f, kategori: e.target.value }))}
                className="w-full pl-4 pr-3 py-2.5 text-xs font-bold text-suka-ink bg-white shadow-inner border border-suka-gray-200 rounded-xl focus:outline-none focus:border-suka-orange focus:ring-4 focus:ring-suka-orange/10 transition-all">
                <option value="">— Pilih kategori —</option>
                {KATEGORI_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-black text-suka-gray-500 mb-1.5 uppercase tracking-widest">Termin (hari)</label>
              <input type="number" min={0} value={form.termin_hari ?? ''}
                onChange={e => setForm(f => ({ ...f, termin_hari: e.target.value === '' ? null : Number(e.target.value) }))}
                placeholder="mis. 30"
                className="w-full pl-4 pr-3 py-2.5 text-xs font-bold text-suka-ink bg-white shadow-inner border border-suka-gray-200 rounded-xl focus:outline-none focus:border-suka-orange focus:ring-4 focus:ring-suka-orange/10 transition-all" />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-[10px] font-black text-suka-gray-500 mb-1.5 uppercase tracking-widest">Item yang Disuplai</label>
              <div className="w-full border border-suka-gray-200/60 rounded-xl p-3 max-h-48 overflow-y-auto bg-suka-gray-50/50 shadow-inner">
                <div className="flex flex-wrap gap-2">
                  {bahanList.map(b => {
                    const isChecked = form.bahan_baku_ids.includes(b.id)
                    return (
                      <label key={b.id} className={`cursor-pointer px-3 py-1.5 rounded-full text-[11px] font-bold transition-all border flex items-center gap-1.5 select-none ${
                        isChecked 
                          ? 'bg-orange-50 text-suka-orange border-orange-200 shadow-sm' 
                          : 'bg-white text-suka-gray-500 border-suka-gray-200 hover:bg-suka-gray-50'
                      }`}>
                        <input 
                          type="checkbox" 
                          checked={isChecked}
                          onChange={(e) => {
                            const checked = e.target.checked
                            setForm(f => ({
                              ...f,
                              bahan_baku_ids: checked 
                                ? [...f.bahan_baku_ids, b.id]
                                : f.bahan_baku_ids.filter(id => id !== b.id)
                            }))
                          }}
                          className="sr-only"
                        />
                        {b.nama} <span className="opacity-70 font-medium text-[10px]">({b.satuan})</span>
                      </label>
                    )
                  })}
                </div>
              </div>
            </div>
            <div className="sm:col-span-2">
              <label className="block text-[10px] font-black text-suka-gray-500 mb-1.5 uppercase tracking-widest">Alamat</label>
              <input type="text" value={form.alamat} onChange={e => setForm(f => ({ ...f, alamat: e.target.value }))}
                placeholder="Alamat lengkap supplier"
                className="w-full pl-4 pr-3 py-2.5 text-xs font-bold text-suka-ink bg-white shadow-inner border border-suka-gray-200 rounded-xl focus:outline-none focus:border-suka-orange focus:ring-4 focus:ring-suka-orange/10 transition-all" />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-[10px] font-black text-suka-gray-500 mb-1.5 uppercase tracking-widest">Catatan</label>
              <textarea value={form.catatan} onChange={e => setForm(f => ({ ...f, catatan: e.target.value }))} rows={2}
                placeholder="Syarat pembayaran, min. order, dll."
                className="w-full pl-4 pr-3 py-2.5 text-xs font-medium text-suka-ink bg-white shadow-inner border border-suka-gray-200 rounded-xl focus:outline-none focus:border-suka-orange focus:ring-4 focus:ring-suka-orange/10 transition-all resize-none" />
            </div>
          </div>
          <div className="flex gap-3 pt-3 border-t border-suka-gray-100">
            <button onClick={closeForm} className="flex-1 py-3 border border-suka-gray-200 rounded-2xl font-bold text-sm text-gray-500 hover:bg-suka-gray-50 transition-colors">
              Batal
            </button>
            <button onClick={handleSave} disabled={isSaving}
              className="flex-[2] py-3 bg-gradient-to-r from-suka-brown to-suka-ink text-white rounded-2xl font-extrabold text-sm hover:from-suka-ink hover:to-black active:scale-[0.99] transition-all disabled:opacity-50 flex items-center justify-center gap-2 shadow-[0_4px_12px_rgba(44,24,16,0.15)]">
              {isSaving ? <Spinner className="w-5 h-5" /> : <Check className="w-5 h-5" />}
              {editId ? 'Simpan Perubahan' : 'Tambah Supplier Baru'}
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
        <div className="space-y-3">
          {suppliers.map(s => (
            <div key={s.id} className="bg-white/60 backdrop-blur-xl rounded-2xl border border-suka-gray-200/60 shadow-sm p-4 sm:p-5 flex items-start gap-4 hover:bg-white/90 hover:border-suka-brown/20 hover:shadow-[0_4px_16px_rgba(0,0,0,0.04)] transition-all duration-300 group">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2.5">
                  <span className="font-black text-suka-brown text-base tracking-tight">{s.nama}</span>
                  {s.kategori && (
                    <span className="bg-orange-50 text-suka-orange border border-orange-200 text-[9px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full flex items-center gap-1.5 shadow-[0_2px_4px_rgba(234,88,12,0.1)]">
                      <Tag className="w-3 h-3" />
                      {KATEGORI_OPTIONS.find(k => k.value === s.kategori)?.label?.replace(/^[^ ]+ /, '') ?? s.kategori}
                    </span>
                  )}
                </div>
                <div className="flex flex-wrap gap-4 mt-2.5 text-xs font-semibold text-suka-gray-500">
                  {s.kontak && <span className="flex items-center gap-1.5"><Phone className="w-3.5 h-3.5 text-suka-orange" />{s.kontak}</span>}
                  {s.alamat && <span className="flex items-center gap-1.5 truncate max-w-xs"><MapPin className="w-3.5 h-3.5 text-suka-orange" />{s.alamat}</span>}
                </div>
                {s.bahan_baku_ids && s.bahan_baku_ids.length > 0 && (
                  <p className="text-xs text-suka-gray-600 mt-3 font-medium bg-white/60 p-2.5 rounded-xl border border-suka-gray-100">
                    <span className="font-extrabold text-suka-brown">{s.bahan_baku_ids.length} item:</span>{' '}
                    {s.bahan_baku_ids.map(id => {
                      const b = bahanList.find(b => b.id === id)
                      return b ? `${b.nama} (${b.satuan})` : null
                    }).filter(Boolean).slice(0, 5).join(', ')}
                    {s.bahan_baku_ids.length > 5 && <span className="text-suka-gray-400 italic"> ...dan lainnya</span>}
                  </p>
                )}
                {s.catatan && <p className="text-[11px] font-medium text-suka-gray-400 mt-2.5 italic pl-2 border-l-2 border-suka-gray-200/60">{s.catatan}</p>}
              </div>
              <button onClick={() => openEdit(s)}
                className="p-2.5 rounded-xl text-suka-gray-400 bg-white border border-suka-gray-200 hover:text-suka-orange hover:border-orange-200 hover:bg-orange-50 hover:shadow-sm transition-all opacity-0 group-hover:opacity-100 active:scale-95 shrink-0">
                <Edit2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
