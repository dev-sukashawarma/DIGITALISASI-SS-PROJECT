'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createSupabaseBrowserClient, useAuth } from '@suka/auth'
import { useOutlets } from '@/hooks/useOutlets'
import { useBahanBaku } from '@/hooks/useBahanBaku'
import { BottomNav } from './BottomNav'
import { ArrowLeft, Search, Plus, Trash2, Check, Package, X, Store } from 'lucide-react'
import { toast } from 'sonner'

interface FormItem {
  bahanId: string
  qty: number
}

function getDistribusiFactor(b: any): number {
  if (!b.satuan_distribusi || b.satuan_distribusi === b.satuan) return 1;
  const dist = b.satuan_distribusi.toLowerCase();
  if (dist === b.satuan_tengah?.toLowerCase() && b.faktor_tengah) return b.faktor_tengah;
  if (dist === b.satuan_kecil?.toLowerCase() && b.faktor_tampilan) return b.faktor_tampilan;
  
  // Implicit mapping: if dist is 'kg' and satuan_kecil is 'gram'
  if (dist === 'kg' && b.satuan_kecil?.toLowerCase() === 'gram' && b.faktor_tampilan) {
    return b.faktor_tampilan / 1000;
  }
  
  return 1;
}

function convertToBaseUnit(qtyDistribusi: number, b: any): number {
  return qtyDistribusi / getDistribusiFactor(b);
}

const normalizeKategori = (kategori: string | undefined): string => {
  const c = (kategori || '').toLowerCase();
  if (c === 'protein' || c === 'sayur') return 'item core';
  if (c === 'saus') return 'bumbu';
  if (c === 'gas') return 'lainnya';
  if (['item core', 'bumbu', 'minuman', 'kemasan', 'lainnya'].includes(c)) return c;
  return 'lainnya';
};

const KATEGORI_TABS = [
  { key: 'all', label: 'Semua' },
  { key: 'item core', label: 'Item Core' },
  { key: 'bumbu', label: 'Bumbu' },
  { key: 'minuman', label: 'Minuman' },
  { key: 'kemasan', label: 'Kemasan' },
  { key: 'lainnya', label: 'Lainnya' },
];

export function SuratJalanForm() {
  const router = useRouter()
  const { outletStaff } = useAuth()
  const { outlets, loading: outletsLoading } = useOutlets()
  const { bahanBaku } = useBahanBaku()
  const [outletId, setOutletId] = useState('')
  const [items, setItems] = useState<FormItem[]>([])
  
  // Selection state
  const [selectedBahanId, setSelectedBahanId] = useState('')
  const [qty, setQty] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [activeCategory, setActiveCategory] = useState('all')
  const [isPickerOpen, setIsPickerOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const isPusatSender = ['kitchen', 'admin', 'admin_hr', 'spv', 'regional_manager', 'owner'].includes(outletStaff?.role || '')

  const selectedBahan = useMemo(() => {
    return bahanBaku.find((b) => b.id === selectedBahanId)
  }, [bahanBaku, selectedBahanId])

  const currentDistUnit = selectedBahan?.satuan_distribusi || selectedBahan?.satuan || 'Unit'

  const filteredBahanList = useMemo(() => {
    return bahanBaku.filter((b) => {
      const matchCat = activeCategory === 'all' || normalizeKategori(b.kategori) === activeCategory
      const matchSearch = !searchQuery.trim() || b.nama.toLowerCase().includes(searchQuery.toLowerCase().trim())
      return matchCat && matchSearch
    })
  }, [bahanBaku, activeCategory, searchQuery])

  if (!isPusatSender) {
    return (
      <div className="min-h-screen bg-[#fff8f1] flex items-center justify-center p-4 bg-grain">
        <div className="bg-white border border-suka-brown/10 p-6 rounded-2xl text-center max-w-md shadow-lg">
          <span className="text-3xl block mb-2">🚫</span>
          <h3 className="font-extrabold text-sm text-suka-brown uppercase tracking-wider">Akses Ditolak</h3>
          <p className="text-xs text-suka-gray-600 mt-1 font-semibold">
            Hanya Gudang Pusat (Kitchen/Admin) yang dapat membuat Surat Jalan baru. Akses Anda terbatas untuk melihat dan menerima barang.
          </p>
          <button
            onClick={() => router.push('/dashboard')}
            className="mt-4 px-4 py-2 bg-suka-orange hover:bg-orange-600 active:scale-95 text-white text-xs font-bold rounded-xl transition-all uppercase tracking-wider cursor-pointer"
          >
            Kembali ke Dashboard
          </button>
        </div>
      </div>
    )
  }

  const handleSelectBahan = (bId: string) => {
    setSelectedBahanId(bId)
    setIsPickerOpen(false)
  }

  const handleAddQtyPreset = (amount: number) => {
    const currentVal = parseFloat(qty) || 0
    setQty(String(Math.max(0, currentVal + amount)))
  }

  const addItem = () => {
    if (!selectedBahanId) {
      toast.warning('Pilih bahan baku terlebih dahulu')
      return
    }
    
    const parsedQty = parseFloat(qty)
    if (isNaN(parsedQty) || parsedQty <= 0) {
      toast.warning('Kuantitas harus berupa angka lebih dari 0')
      return
    }

    const existingIndex = items.findIndex(i => i.bahanId === selectedBahanId)
    if (existingIndex >= 0) {
      const newItems = [...items]
      newItems[existingIndex].qty += parsedQty
      setItems(newItems)
      toast.success(`Menambahkan ${parsedQty} ke ${selectedBahan?.nama}`)
    } else {
      setItems([...items, { bahanId: selectedBahanId, qty: parsedQty }])
      toast.success(`${selectedBahan?.nama} ditambahkan ke daftar kirim`)
    }

    setSelectedBahanId('')
    setQty('')
  }

  const removeItem = (index: number) => {
    const itemToRemove = items[index]
    const b = bahanBaku.find((x) => x.id === itemToRemove?.bahanId)
    setItems(items.filter((_, i) => i !== index))
    toast.info(`${b?.nama || 'Item'} dihapus dari daftar`)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!outletId) {
      toast.error('Silakan pilih outlet tujuan')
      return
    }
    if (items.length === 0) {
      toast.error('Tambahkan minimal 1 item barang yang akan dikirim')
      return
    }

    setSubmitting(true)
    const supabase = createSupabaseBrowserClient()

    try {
      // Create surat jalan with formatted document number
      const { data: sj, error: sjError } = await supabase.rpc(
        'create_surat_jalan_with_number',
        { p_outlet_id: outletId }
      )

      if (sjError) throw new Error(`Gagal membuat surat jalan: ${sjError.message}`)
      if (!sj?.id) throw new Error('ID Surat Jalan tidak valid dari server')

      // Insert items
      const itemsToInsert = items.map((item) => {
        const bahan = bahanBaku.find((b) => b.id === item.bahanId)
        const qty_dikirim_base = bahan ? convertToBaseUnit(item.qty, bahan) : item.qty
        return {
          surat_jalan_id: sj.id,
          bahan_baku_id: item.bahanId,
          qty_dikirim: qty_dikirim_base,
        }
      })

      const { error: itemsError } = await supabase
        .from('surat_jalan_item')
        .insert(itemsToInsert)

      if (itemsError) throw new Error(`Gagal menyimpan item: ${itemsError.message}`)

      toast.success('Surat Jalan berhasil dibuat! Menuju ke proses penandatanganan...')
      router.push(`/distribusi/surat-jalan/${sj.id}`)
    } catch (err: any) {
      toast.error(err?.message || 'Gagal menyimpan Surat Jalan')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#fff8f1]/50 text-[#1e1b15] pb-32 relative overflow-hidden bg-grain select-none">
      {/* Drifting Background Blobs */}
      <div className="absolute top-[-10%] right-[-10%] w-[50vw] h-[50vw] rounded-full bg-suka-orange/5 blur-[120px] pointer-events-none z-0" />
      <div className="absolute bottom-[-10%] left-[-10%] w-[50vw] h-[50vw] rounded-full bg-suka-brown/5 blur-[120px] pointer-events-none z-0" />

      <header className="sticky top-0 z-40 bg-white/85 backdrop-blur-md border-b border-suka-brown/10 px-3 sm:px-4 py-3 flex justify-between items-center shadow-sm relative">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <Link
            href="/distribusi/surat-jalan"
            className="w-8 h-8 sm:w-9 sm:h-9 flex items-center justify-center rounded-xl bg-white border border-suka-orange/15 text-suka-orange hover:bg-suka-orange/5 active:scale-95 transition-all shadow-sm shrink-0"
            title="Kembali"
          >
            <ArrowLeft size={16} />
          </Link>
          <div className="flex flex-col min-w-0">
            <h1 className="font-black text-xs sm:text-sm text-suka-brown uppercase tracking-wider font-display leading-none truncate">
              Buat Surat Jalan
            </h1>
            <p className="text-[9px] sm:text-[10px] text-suka-gray-500 font-bold mt-0.5 truncate">
              {outletStaff?.name || 'Staff'} • Gudang Pusat (HQ)
            </p>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="p-4 max-w-2xl mx-auto space-y-5 relative z-10">
        <div className="bg-white/80 backdrop-blur-md rounded-2xl border border-suka-orange/10 p-5 shadow-sm">
          <form onSubmit={handleSubmit} className="space-y-6">
            
            {/* Outlet Tujuan Section */}
            <div className="space-y-2">
              <label className="flex items-center gap-1.5 text-[10px] font-black text-suka-brown uppercase tracking-wider">
                <Store size={14} className="text-suka-orange" /> Outlet Tujuan
              </label>
              {outletsLoading ? (
                <div className="h-11 bg-suka-gray-100 rounded-xl animate-pulse" />
              ) : (
                <select
                  value={outletId}
                  onChange={(e) => setOutletId(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-suka-brown/15 bg-white focus:outline-none focus:ring-2 focus:ring-suka-orange/40 focus:border-suka-orange text-xs text-suka-ink font-bold transition-all shadow-sm cursor-pointer"
                >
                  <option value="">-- Pilih Outlet Tujuan Pengiriman --</option>
                  {outlets.map((outlet) => (
                    <option key={outlet.id} value={outlet.id}>
                      {outlet.name.replace('SUKA SHAWARMA ', '').toUpperCase()}
                    </option>
                  ))}
                </select>
              )}
            </div>

            {/* Tambah Item Barang Section */}
            <div className="border-t border-suka-brown/10 pt-5 space-y-3">
              <label className="flex items-center gap-1.5 text-[10px] font-black text-suka-brown uppercase tracking-wider">
                <Package size={14} className="text-suka-orange" /> Tambah Bahan / Barang
              </label>

              {/* Selector trigger */}
              <div className="space-y-3">
                <button
                  type="button"
                  onClick={() => setIsPickerOpen(true)}
                  className={`w-full px-4 py-3 rounded-xl border text-left flex items-center justify-between transition-all cursor-pointer shadow-sm ${
                    selectedBahan
                      ? 'border-suka-orange bg-suka-orange/5 text-suka-ink'
                      : 'border-suka-brown/15 bg-white text-suka-gray-400 hover:border-suka-orange/40'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <Search size={16} className={selectedBahan ? 'text-suka-orange' : 'text-suka-gray-400'} />
                    <span className="text-xs font-bold uppercase truncate">
                      {selectedBahan ? `${selectedBahan.nama} (Kirim per ${currentDistUnit.toUpperCase()})` : 'Pilih barang dari katalog...'}
                    </span>
                  </div>
                  <span className="text-[10px] font-extrabold text-suka-orange bg-suka-orange/10 px-2 py-0.5 rounded uppercase shrink-0">
                    {selectedBahan ? 'Ganti' : 'Cari'}
                  </span>
                </button>

                {/* Input Qty & Steppers */}
                {selectedBahan && (
                  <div className="p-4 bg-white rounded-xl border border-suka-orange/20 shadow-sm space-y-3 animate-in fade-in zoom-in-95 duration-200">
                    <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
                      <div className="relative flex-1 flex items-center">
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={qty}
                          onChange={(e) => setQty(e.target.value)}
                          placeholder="0"
                          autoFocus
                          className="w-full pl-4 pr-16 py-3 rounded-xl border-2 border-suka-orange/30 bg-white text-center focus:outline-none focus:ring-2 focus:ring-suka-orange text-sm text-suka-ink font-black shadow-inner"
                        />
                        <span className="absolute right-3 text-[10px] font-extrabold text-suka-brown bg-suka-orange/15 px-2 py-1 rounded pointer-events-none uppercase">
                          {currentDistUnit}
                        </span>
                      </div>

                      <button
                        type="button"
                        onClick={addItem}
                        disabled={!qty || parseFloat(qty) <= 0}
                        className="px-6 py-3 bg-suka-orange hover:bg-orange-600 active:bg-orange-700 disabled:opacity-40 text-white font-bold text-xs uppercase tracking-wider rounded-xl shadow-md shadow-suka-orange/20 transition-all active:scale-95 cursor-pointer flex items-center justify-center gap-1.5 shrink-0"
                      >
                        <Plus size={16} /> Tambahkan
                      </button>
                    </div>

                    {/* Quick presets steppers */}
                    <div className="flex flex-wrap items-center gap-1.5 pt-1">
                      <span className="text-[9px] font-extrabold text-suka-gray-500 uppercase mr-1">Quick:</span>
                      {[1, 5, 10, 20, 50].map((val) => (
                        <button
                          key={val}
                          type="button"
                          onClick={() => handleAddQtyPreset(val)}
                          className="px-2.5 py-1 rounded-lg text-[10px] font-extrabold bg-suka-gray-100 hover:bg-suka-orange/10 hover:text-suka-orange active:scale-95 transition-all text-suka-gray-700 border border-suka-gray-200 cursor-pointer"
                        >
                          +{val}
                        </button>
                      ))}
                      <button
                        type="button"
                        onClick={() => setQty('')}
                        className="px-2 py-1 rounded-lg text-[9px] font-bold text-red-600 hover:bg-red-50 transition-colors ml-auto cursor-pointer"
                      >
                        Reset
                      </button>
                    </div>

                    <p className="text-[10px] text-suka-gray-500 font-semibold">
                      📦 Satuan kirim: <strong className="text-suka-brown uppercase font-extrabold">{currentDistUnit}</strong>
                      {selectedBahan.satuan_distribusi && selectedBahan.satuan_distribusi.toLowerCase() !== selectedBahan.satuan.toLowerCase() && (
                        <span> (1 {selectedBahan.satuan} = {selectedBahan.satuan_tengah ? `${selectedBahan.faktor_tengah} ${selectedBahan.satuan_tengah}` : `${selectedBahan.faktor_konversi || selectedBahan.faktor_tampilan} ${selectedBahan.satuan_kecil}`})</span>
                      )}
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Item yang Dipilih (Selected Items List) */}
            <div className="border-t border-suka-brown/10 pt-5 space-y-3">
              <div className="flex justify-between items-center">
                <label className="text-[10px] font-black text-suka-brown uppercase tracking-wider">
                  Daftar Muatan ({items.length} Item)
                </label>
                {items.length > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      if (confirm('Kosongkan semua item yang sudah dipilih?')) {
                        setItems([])
                        toast.info('Daftar muatan dikosongkan')
                      }
                    }}
                    className="text-[10px] font-bold text-red-600 hover:underline cursor-pointer"
                  >
                    Hapus Semua
                  </button>
                )}
              </div>

              {items.length === 0 ? (
                <div className="bg-white/50 border border-dashed border-suka-brown/20 p-8 rounded-2xl text-center space-y-2">
                  <span className="text-3xl block">📦</span>
                  <p className="text-xs font-bold text-suka-gray-500 uppercase tracking-wide">
                    Belum ada barang ditambahkan
                  </p>
                  <p className="text-[10px] text-suka-gray-400 font-medium">
                    Gunakan tombol pencarian di atas untuk memilih bahan yang akan dikirim.
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {items.map((item, idx) => {
                    const bahan = bahanBaku.find((b) => b.id === item.bahanId)
                    const distUnit = bahan?.satuan_distribusi || bahan?.satuan
                    return (
                      <div
                        key={idx}
                        className="flex justify-between items-center bg-white border border-suka-orange/15 px-4 py-3 rounded-xl shadow-xs hover:border-suka-orange/40 transition-all"
                      >
                        <div className="min-w-0 space-y-0.5">
                          <p className="text-xs font-black text-suka-ink uppercase tracking-wide truncate">
                            {bahan?.nama || 'Unknown Item'}
                          </p>
                          <p className="text-[10px] font-bold text-suka-orange uppercase">
                            {item.qty} {distUnit}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => removeItem(idx)}
                          className="w-8 h-8 rounded-lg flex items-center justify-center text-red-600 hover:bg-red-50 active:scale-95 transition-all cursor-pointer shrink-0"
                          title="Hapus item"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3 border-t border-suka-brown/10 pt-5">
              <button
                type="submit"
                disabled={submitting || items.length === 0 || !outletId}
                className="flex-1 py-3.5 bg-suka-brown hover:bg-suka-ink active:scale-[0.98] text-white font-extrabold uppercase tracking-wider text-xs shadow-md rounded-xl transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {submitting ? 'Membuat Surat Jalan...' : `Simpan & Lanjut TTD (${items.length} Item)`}
              </button>
              <Link
                href="/distribusi/surat-jalan"
                className="px-6 py-3.5 border border-suka-brown/20 text-suka-brown hover:bg-white/60 bg-white rounded-xl font-bold text-xs uppercase tracking-wider shadow-sm transition-all active:scale-[0.98] text-center cursor-pointer flex items-center justify-center"
              >
                Batal
              </Link>
            </div>
          </form>
        </div>
      </main>

      {/* Search & Select Modal Dialog */}
      {isPickerOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-xs p-0 sm:p-4 animate-in fade-in duration-200">
          <div className="bg-white w-full sm:max-w-lg rounded-t-3xl sm:rounded-3xl shadow-2xl flex flex-col max-h-[85vh] overflow-hidden border border-suka-brown/10">
            {/* Modal Header */}
            <div className="px-5 py-4 border-b border-suka-brown/10 flex justify-between items-center bg-[#fff8f1]">
              <div className="flex items-center gap-2">
                <Package size={18} className="text-suka-orange" />
                <h3 className="font-black text-sm text-suka-brown uppercase tracking-wider font-display">
                  Pilih Bahan Baku
                </h3>
              </div>
              <button
                onClick={() => setIsPickerOpen(false)}
                className="w-8 h-8 rounded-full flex items-center justify-center text-suka-gray-500 hover:bg-suka-brown/10 cursor-pointer transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            {/* Search Input */}
            <div className="p-4 border-b border-suka-brown/10 bg-white space-y-3">
              <div className="relative">
                <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-suka-gray-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Ketik nama bahan (contoh: Daging, Saus, Roti)..."
                  autoFocus
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-suka-brown/20 bg-suka-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-suka-orange text-xs text-suka-ink font-bold shadow-inner"
                />
              </div>

              {/* Category Pills */}
              <div className="flex gap-1.5 overflow-x-auto no-scrollbar pb-0.5">
                {KATEGORI_TABS.map((tab) => (
                  <button
                    key={tab.key}
                    type="button"
                    onClick={() => setActiveCategory(tab.key)}
                    className={`px-3 py-1.5 rounded-lg text-[9px] font-extrabold uppercase tracking-wider whitespace-nowrap transition-all cursor-pointer ${
                      activeCategory === tab.key
                        ? 'bg-suka-brown text-white shadow-sm'
                        : 'bg-suka-gray-100 text-suka-gray-600 hover:bg-suka-orange/10 hover:text-suka-orange'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Items List */}
            <div className="flex-1 overflow-y-auto p-4 divide-y divide-suka-brown/5 space-y-1">
              {filteredBahanList.length === 0 ? (
                <div className="p-12 text-center text-suka-gray-400 font-bold text-xs uppercase tracking-wider">
                  Tidak ada bahan baku yang cocok
                </div>
              ) : (
                filteredBahanList.map((bahan) => {
                  const isSelected = selectedBahanId === bahan.id
                  const distUnit = bahan.satuan_distribusi || bahan.satuan
                  return (
                    <div
                      key={bahan.id}
                      onClick={() => handleSelectBahan(bahan.id)}
                      className={`p-3 rounded-xl flex items-center justify-between cursor-pointer transition-all ${
                        isSelected
                          ? 'bg-suka-orange/10 border border-suka-orange/30'
                          : 'hover:bg-suka-orange/5'
                      }`}
                    >
                      <div className="min-w-0 pr-3">
                        <p className="text-xs font-black text-suka-ink uppercase tracking-wide truncate">
                          {bahan.nama}
                        </p>
                        <p className="text-[10px] text-suka-gray-500 font-semibold mt-0.5">
                          Kategori: <span className="uppercase text-suka-brown font-bold">{bahan.kategori || 'Core'}</span> • Satuan Kirim: <span className="uppercase text-suka-orange font-black">{distUnit}</span>
                        </p>
                      </div>
                      <div className="shrink-0">
                        {isSelected ? (
                          <div className="w-7 h-7 rounded-full bg-suka-orange text-white flex items-center justify-center shadow-xs">
                            <Check size={14} />
                          </div>
                        ) : (
                          <button
                            type="button"
                            className="px-3 py-1.5 bg-white border border-suka-brown/20 text-suka-brown rounded-lg text-[10px] font-extrabold uppercase hover:bg-suka-orange hover:text-white hover:border-suka-orange transition-all"
                          >
                            Pilih
                          </button>
                        )}
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          </div>
        </div>
      )}

      {/* Bottom Navigation Bar */}
      <BottomNav activeTab="surat-jalan" />
    </div>
  )
}
