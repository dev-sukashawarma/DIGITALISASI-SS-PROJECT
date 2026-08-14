'use client'

import { useState, useMemo } from 'react'
import { Plus, Edit2, Check, Phone, MapPin, Tag, Truck, Package, Layers } from 'lucide-react'
import { useSuppliers, useCreateSupplier, useUpdateSupplier, useBahanBakuOptions, type Supplier } from '@/hooks/usePurchaseOrder'
import { Spinner } from '@suka/design-system'
import { toast } from 'sonner'
import { PageHeader, StatTile } from '@/components/ui'
import CountUp from 'react-countup'

const KATEGORI_OPTIONS = [
  { value: 'item core', label: '⭐ Item Core' },
  { value: 'bumbu', label: '🧂 Bumbu' },
  { value: 'kemasan', label: '📦 Kemasan' },
  { value: 'minuman', label: '🧃 Minuman' },
  { value: 'lain-lain', label: '🏷️ Lain-lain' },
]

export default function SupplierPage() {
  const { data: suppliers = [], isLoading } = useSuppliers()
  const { data: bahanList = [] } = useBahanBakuOptions()
  const createSupplier = useCreateSupplier()
  const updateSupplier = useUpdateSupplier()

  const [showForm, setShowForm] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [form, setForm] = useState({
    nama: '',
    kontak: '',
    alamat: '',
    catatan: '',
    kategori: '',
    termin_hari: null as number | null,
    bahan_baku_ids: [] as string[],
  })

  // Calculations for StatTiles
  const totalBahanSuplaiCount = useMemo(() => {
    const set = new Set<string>()
    suppliers.forEach(s => s.bahan_baku_ids?.forEach(bId => set.add(bId)))
    return set.size
  }, [suppliers])

  const kategoriCount = useMemo(() => {
    const set = new Set<string>()
    suppliers.forEach(s => s.kategori && set.add(s.kategori))
    return set.size
  }, [suppliers])

  function openCreate() {
    setEditId(null)
    setForm({ nama: '', kontak: '', alamat: '', catatan: '', kategori: '', termin_hari: null, bahan_baku_ids: [] })
    setShowForm(true)
  }

  function openEdit(s: Supplier) {
    setEditId(s.id)
    setForm({
      nama: s.nama,
      kontak: s.kontak ?? '',
      alamat: s.alamat ?? '',
      catatan: s.catatan ?? '',
      kategori: s.kategori ?? '',
      termin_hari: s.termin_hari ?? null,
      bahan_baku_ids: s.bahan_baku_ids ?? [],
    })
    setShowForm(true)
  }

  function closeForm() {
    setShowForm(false)
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
      termin_hari: form.termin_hari,
      bahan_baku_ids: form.bahan_baku_ids,
    }
    if (editId) {
      await updateSupplier.mutateAsync({ id: editId, ...payload })
    } else {
      await createSupplier.mutateAsync(payload)
    }
    closeForm()
  }

  const isSaving = createSupplier.isPending || updateSupplier.isPending

  return (
    <div className="space-y-6 animate-fade-in pb-12">
      {/* Header */}
      <PageHeader 
        title="Master Supplier" 
        description="Daftar pemasok bahan baku ke Kitchen Bogor & jaringan cabang."
      >
        <button onClick={openCreate}
          className="mt-3 sm:mt-0 flex items-center justify-center gap-2 bg-gradient-to-r from-suka-brown to-suka-ink text-white font-extrabold px-6 py-3 rounded-2xl hover:from-suka-ink hover:to-black active:scale-[.98] transition-all text-sm shadow-[0_8px_20px_rgba(44,24,16,0.15)] w-full sm:w-auto">
          <Plus className="w-5 h-5 text-suka-orange" /> Tambah Supplier Baru
        </button>
      </PageHeader>

      {/* Top Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatTile
          label="Total Supplier"
          value={<CountUp end={suppliers.length} duration={1} />}
          sub="Mitra Pemasok Terdaftar"
          icon={Truck}
          accent="brown"
        />
        <StatTile
          label="Kategori Tercover"
          value={<CountUp end={kategoriCount} duration={1} />}
          sub="Klasifikasi Bahan Utama"
          icon={Layers}
          accent="orange"
        />
        <StatTile
          label="Total Items Disuplai"
          value={<CountUp end={totalBahanSuplaiCount} duration={1} />}
          sub="Bahan Baku Terhubung"
          icon={Package}
          accent="green"
        />
      </div>

      {/* Form Overlay Card */}
      {showForm && (
        <div className="bg-white/70 backdrop-blur-xl rounded-3xl border border-suka-gray-200/60 shadow-[0_8px_30px_rgba(0,0,0,0.04)] p-6 space-y-5">
          <h2 className="font-black text-suka-brown text-base uppercase tracking-widest flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-suka-orange" />
            {editId ? 'Edit Data Supplier' : 'Tambah Supplier Baru'}
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
                className="w-full pl-4 pr-3 py-2.5 text-xs font-bold text-suka-ink bg-white shadow-inner border border-suka-gray-200 rounded-xl focus:outline-none focus:border-suka-orange focus:ring-4 focus:ring-suka-orange/10 transition-all cursor-pointer">
                <option value="">— Pilih kategori —</option>
                {KATEGORI_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-black text-suka-gray-500 mb-1.5 uppercase tracking-widest">Termin Pembayaran (Hari)</label>
              <input type="number" min={0} value={form.termin_hari ?? ''}
                onChange={e => setForm(f => ({ ...f, termin_hari: e.target.value === '' ? null : Number(e.target.value) }))}
                placeholder="misal: 30"
                className="w-full pl-4 pr-3 py-2.5 text-xs font-bold text-suka-ink bg-white shadow-inner border border-suka-gray-200 rounded-xl focus:outline-none focus:border-suka-orange focus:ring-4 focus:ring-suka-orange/10 transition-all" />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-[10px] font-black text-suka-gray-500 mb-1.5 uppercase tracking-widest">Item Bahan Baku yang Disuplai</label>
              <div className="w-full border border-suka-gray-200/60 rounded-2xl p-3.5 max-h-48 overflow-y-auto bg-suka-gray-50/50 shadow-inner">
                <div className="flex flex-wrap gap-2">
                  {bahanList.map(b => {
                    const isChecked = form.bahan_baku_ids.includes(b.id)
                    return (
                      <label key={b.id} className={`cursor-pointer px-3 py-1.5 rounded-full text-[11px] font-extrabold transition-all border flex items-center gap-1.5 select-none ${
                        isChecked 
                          ? 'bg-orange-50 text-suka-orange border-orange-200 shadow-2xs' 
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
              <label className="block text-[10px] font-black text-suka-gray-500 mb-1.5 uppercase tracking-widest">Alamat Lengkap</label>
              <input type="text" value={form.alamat} onChange={e => setForm(f => ({ ...f, alamat: e.target.value }))}
                placeholder="Alamat kantor / gudang supplier"
                className="w-full pl-4 pr-3 py-2.5 text-xs font-bold text-suka-ink bg-white shadow-inner border border-suka-gray-200 rounded-xl focus:outline-none focus:border-suka-orange focus:ring-4 focus:ring-suka-orange/10 transition-all" />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-[10px] font-black text-suka-gray-500 mb-1.5 uppercase tracking-widest">Catatan Tambahan</label>
              <textarea value={form.catatan} onChange={e => setForm(f => ({ ...f, catatan: e.target.value }))} rows={2}
                placeholder="Syarat pengiriman, minimum order quantity, dll."
                className="w-full pl-4 pr-3 py-2.5 text-xs font-medium text-suka-ink bg-white shadow-inner border border-suka-gray-200 rounded-xl focus:outline-none focus:border-suka-orange focus:ring-4 focus:ring-suka-orange/10 transition-all resize-none" />
            </div>
          </div>
          <div className="flex gap-3 pt-3 border-t border-suka-gray-100">
            <button onClick={closeForm} className="flex-1 py-3 border border-suka-gray-200 rounded-2xl font-bold text-sm text-suka-gray-500 hover:bg-suka-gray-50 transition-colors">
              Batal
            </button>
            <button onClick={handleSave} disabled={isSaving}
              className="flex-[2] py-3 bg-gradient-to-r from-suka-brown to-suka-ink text-white rounded-2xl font-extrabold text-sm hover:from-suka-ink hover:to-black active:scale-[0.99] transition-all disabled:opacity-50 flex items-center justify-center gap-2 shadow-[0_4px_16px_rgba(44,24,16,0.15)]">
              {isSaving ? <Spinner className="w-5 h-5" /> : <Check className="w-5 h-5" />}
              {editId ? 'Simpan Perubahan' : 'Tambah Supplier Baru'}
            </button>
          </div>
        </div>
      )}

      {/* Supplier Grid List */}
      {isLoading ? (
        <div className="flex justify-center py-16"><Spinner className="w-8 h-8 text-suka-orange" /></div>
      ) : suppliers.length === 0 ? (
        <div className="bg-white/70 backdrop-blur-xl rounded-3xl border border-suka-gray-200/60 p-16 text-center text-suka-gray-400 space-y-2 shadow-[0_4px_20px_rgba(0,0,0,0.03)]">
          <Truck className="w-10 h-10 mx-auto text-suka-orange/60" />
          <p className="font-extrabold text-suka-brown text-base">Belum ada supplier terdaftar</p>
          <p className="text-xs text-suka-gray-400 font-medium">Tambahkan data supplier untuk mulai menghubungkannya dengan Purchase Order.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {suppliers.map(s => (
            <div key={s.id} className="bg-white/70 backdrop-blur-xl rounded-3xl border border-suka-gray-200/60 shadow-[0_4px_20px_rgba(0,0,0,0.03)] p-5 flex flex-col justify-between hover:bg-white/90 hover:border-suka-brown/20 hover:shadow-[0_8px_24px_rgba(0,0,0,0.06)] transition-all duration-300 group">
              <div className="space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <span className="font-black text-suka-brown text-base tracking-tight block leading-snug">{s.nama}</span>
                    {s.kategori && (
                      <span className="inline-flex items-center gap-1 mt-1 bg-orange-50 text-suka-orange border border-orange-200 text-[9px] font-black uppercase tracking-widest px-2.5 py-0.5 rounded-full shadow-2xs">
                        <Tag className="w-3 h-3" />
                        {KATEGORI_OPTIONS.find(k => k.value === s.kategori)?.label?.replace(/^[^ ]+ /, '') ?? s.kategori}
                      </span>
                    )}
                  </div>
                  <button onClick={() => openEdit(s)}
                    className="p-2 rounded-xl text-suka-gray-400 bg-white border border-suka-gray-200 hover:text-suka-orange hover:border-orange-200 hover:bg-orange-50 hover:shadow-xs transition-all opacity-0 group-hover:opacity-100 active:scale-95 shrink-0">
                    <Edit2 className="w-4 h-4" />
                  </button>
                </div>

                <div className="space-y-1.5 text-xs font-semibold text-suka-gray-500">
                  {s.kontak && <p className="flex items-center gap-2"><Phone className="w-3.5 h-3.5 text-suka-orange shrink-0" />{s.kontak}</p>}
                  {s.alamat && <p className="flex items-center gap-2 truncate"><MapPin className="w-3.5 h-3.5 text-suka-orange shrink-0" /><span className="truncate">{s.alamat}</span></p>}
                </div>

                {s.bahan_baku_ids && s.bahan_baku_ids.length > 0 && (
                  <div className="text-xs text-suka-gray-600 font-medium bg-white/60 p-3 rounded-2xl border border-suka-gray-100/80 space-y-1">
                    <span className="font-extrabold text-suka-brown text-[10px] uppercase tracking-widest block">Bahan Baku Disuplai ({s.bahan_baku_ids.length}):</span>
                    <p className="text-xs text-suka-gray-600 line-clamp-2">
                      {s.bahan_baku_ids.map(id => {
                        const b = bahanList.find(b => b.id === id)
                        return b ? `${b.nama} (${b.satuan})` : null
                      }).filter(Boolean).slice(0, 4).join(', ')}
                      {s.bahan_baku_ids.length > 4 && <span className="text-suka-gray-400 italic"> ...+{s.bahan_baku_ids.length - 4} lainnya</span>}
                    </p>
                  </div>
                )}
                {s.catatan && <p className="text-[11px] font-medium text-suka-gray-400 italic pl-2 border-l-2 border-suka-gray-200/60 line-clamp-2">{s.catatan}</p>}
              </div>

              {s.termin_hari != null && (
                <div className="mt-4 pt-3 border-t border-suka-gray-100 flex items-center justify-between text-[11px]">
                  <span className="text-suka-gray-400 font-semibold uppercase tracking-wider">Termin Pembayaran:</span>
                  <span className="font-black text-suka-brown">{s.termin_hari} Hari</span>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
