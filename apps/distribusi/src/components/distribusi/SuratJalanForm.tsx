'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createSupabaseBrowserClient, useAuth } from '@suka/auth'
import { useOutlets } from '@/hooks/useOutlets'
import { useBahanBaku } from '@/hooks/useBahanBaku'
import { BottomNav } from './BottomNav'

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

const KATEGORI_ORDER = [
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
  const { bahanBaku, loading: bahanLoading } = useBahanBaku()
  const [outletId, setOutletId] = useState('')
  const [items, setItems] = useState<FormItem[]>([])
  const [selectedBahan, setSelectedBahan] = useState('')
  const [qty, setQty] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const isPusatSender = ['kitchen', 'admin', 'admin_hr', 'spv', 'regional_manager', 'owner'].includes(outletStaff?.role || '')

  if (!isPusatSender) {
    return (
      <div className="min-h-screen bg-[#fff8f1] flex items-center justify-center p-4">
        <div className="bg-white border border-[#d9c2b2]/45 p-6 rounded-2xl text-center max-w-md shadow-md">
          <span className="text-3xl block mb-2">🚫</span>
          <h3 className="font-extrabold text-sm text-[#701604] uppercase">Akses Ditolak</h3>
          <p className="text-xs text-[#544437] mt-1 font-semibold">
            Hanya Gudang Pusat (Kitchen/Admin) yang dapat membuat Surat Jalan baru. Akses Anda terbatas untuk melihat dan menerima barang.
          </p>
          <button
            onClick={() => router.push('/dashboard')}
            className="mt-4 px-4 py-2 bg-[#f29744] hover:bg-orange-600 active:scale-95 text-white text-xs font-bold rounded-xl transition-all uppercase tracking-wider"
          >
            Kembali ke Dashboard
          </button>
        </div>
      </div>
    )
  }

  const addItem = () => {
    if (!selectedBahan || !qty) return
    
    const parsedQty = parseFloat(qty)
    if (isNaN(parsedQty) || parsedQty <= 0) {
      alert('Kuantitas harus berupa angka lebih dari 0')
      return
    }

    const existingIndex = items.findIndex(i => i.bahanId === selectedBahan)
    if (existingIndex >= 0) {
      const newItems = [...items]
      newItems[existingIndex].qty += parsedQty
      setItems(newItems)
    } else {
      setItems([...items, { bahanId: selectedBahan, qty: parsedQty }])
    }

    setSelectedBahan('')
    setQty('')
  }

  const removeItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!outletId || items.length === 0) {
      alert('Pilih outlet dan minimal 1 item')
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

      if (sjError) throw new Error(`Failed to create surat jalan: ${sjError.message}`)
      if (!sj?.id) throw new Error('No ID returned from surat jalan insert')

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

      if (itemsError) throw new Error(`Failed to insert items: ${itemsError.message}`)

      alert('Surat Jalan berhasil dibuat!')
      router.push('/distribusi/surat-jalan')
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Gagal menyimpan'
      alert(`Error: ${message}`)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#fff8f1] text-[#1e1b15] pb-32">
      <header className="sticky top-0 z-40 bg-[#fff8f1] border-b border-[#d9c2b2]/30 px-3 sm:px-4 py-3 flex justify-between items-center shadow-[0_2px_8px_rgba(144,77,0,0.03)] flex-shrink-0">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <Link
            href="/distribusi/surat-jalan"
            className="w-8 h-8 sm:w-9 sm:h-9 flex items-center justify-center rounded-full bg-white border border-[#d9c2b2]/30 text-[#f29744] hover:bg-orange-50 active:scale-95 transition-all shadow-sm shrink-0"
            title="Kembali"
          >
            <span className="text-base">←</span>
          </Link>
          <div className="flex flex-col min-w-0">
            <h1 className="font-bold text-xs sm:text-sm text-[#701604] uppercase tracking-tight leading-tight truncate">Buat Surat Jalan</h1>
            <p className="text-[9px] sm:text-[10px] text-[#544437]/75 font-bold mt-0.5 truncate max-w-[160px] sm:max-w-none">
              {outletStaff?.name || 'Staff'} • {outletStaff?.outlets?.name ?? (['leader', 'kitchen', 'admin', 'admin_hr'].includes(outletStaff?.role || '') ? 'Gudang Pusat' : 'Outlet')}
            </p>
          </div>
        </div>
      </header>

      {/* Main card */}
      <div className="p-4 max-w-2xl mx-auto mt-2">
        <div className="bg-white rounded-2xl border border-[#d9c2b2]/45 p-5 shadow-[0px_4px_12px_rgba(144,77,0,0.03)]">
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Outlet Tujuan */}
            <div>
              <label className="block text-[10px] font-bold text-[#544437]/60 uppercase tracking-wider pl-1 mb-1.5">
                Outlet Tujuan
              </label>
              {outletsLoading ? (
                <p className="text-xs text-[#544437]/45 font-semibold pl-1">Memuat outlet...</p>
              ) : (
                <select
                  value={outletId}
                  onChange={(e) => setOutletId(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-[#d9c2b2]/40 bg-white focus:outline-none focus:ring-1 focus:ring-[#f29744] focus:border-[#f29744] text-xs text-[#1e1b15] font-semibold transition-all shadow-sm"
                >
                  <option value="">Pilih outlet...</option>
                  {outlets.map((outlet) => (
                    <option key={outlet.id} value={outlet.id}>
                      {outlet.name.replace('SUKA SHAWARMA ', '').toUpperCase()}
                    </option>
                  ))}
                </select>
              )}
            </div>

            {/* Tambah Item Barang */}
            <div className="border-t border-[#d9c2b2]/15 pt-4">
              <label className="block text-[10px] font-bold text-[#544437]/60 uppercase tracking-wider pl-1 mb-1.5">
                Tambah Item Barang
              </label>
              <div className="flex flex-col sm:flex-row gap-2">
                {bahanLoading ? (
                  <p className="text-xs text-[#544437]/45 font-semibold pl-1">Memuat barang...</p>
                ) : (
                  <>
                    {(() => {
                      const currentBahan = bahanBaku.find(b => b.id === selectedBahan);
                      const currentDistUnit = currentBahan?.satuan_distribusi || currentBahan?.satuan;
                      return (
                        <div className="flex flex-col gap-1.5 w-full">
                          <div className="flex flex-col sm:flex-row gap-2">
                            <select
                              value={selectedBahan}
                              onChange={(e) => setSelectedBahan(e.target.value)}
                              className="w-full sm:flex-1 px-4 py-2.5 rounded-xl border border-[#d9c2b2]/40 bg-white focus:outline-none focus:ring-1 focus:ring-[#f29744] focus:border-[#f29744] text-xs text-[#1e1b15] font-semibold transition-all shadow-sm"
                            >
                              <option value="">Pilih barang...</option>
                              {KATEGORI_ORDER.map(({ key, label }) => {
                                const items = bahanBaku.filter(b => normalizeKategori(b.kategori) === key);
                                if (items.length === 0) return null;
                                return (
                                  <optgroup key={key} label={label.toUpperCase()}>
                                    {items.map((bahan) => {
                                      const distUnit = bahan.satuan_distribusi || bahan.satuan;
                                      return (
                                        <option key={bahan.id} value={bahan.id}>
                                          {bahan.nama.toUpperCase()} (Kirim per {distUnit.toUpperCase()})
                                        </option>
                                      );
                                    })}
                                  </optgroup>
                                );
                              })}
                            </select>
                            <div className="flex gap-2 w-full sm:w-auto shrink-0 items-center">
                              <div className="relative flex-1 sm:w-36 flex items-center">
                                <input
                                  type="number"
                                  step="0.01"
                                  min="0"
                                  value={qty}
                                  onChange={(e) => setQty(e.target.value)}
                                  placeholder="0"
                                  className="w-full pl-3 pr-14 py-2.5 rounded-xl border border-[#d9c2b2]/40 bg-white text-center focus:outline-none focus:ring-1 focus:ring-[#f29744] focus:border-[#f29744] text-xs text-[#1e1b15] placeholder-[#544437]/45 font-bold transition-all shadow-sm"
                                />
                                <span className="absolute right-2.5 text-[10px] font-extrabold text-[#904d00] bg-orange-100/90 px-1.5 py-0.5 rounded pointer-events-none uppercase">
                                  {currentDistUnit || 'Unit'}
                                </span>
                              </div>
                              <button
                                type="button"
                                onClick={addItem}
                                disabled={!selectedBahan || !qty}
                                className="flex-1 sm:flex-initial px-5 py-2.5 bg-[#f29744] hover:bg-orange-600 active:bg-orange-700 disabled:opacity-50 text-white font-bold text-xs uppercase tracking-wider rounded-xl shadow-sm transition-all active:scale-95 cursor-pointer shrink-0"
                              >
                                Tambah
                              </button>
                            </div>
                          </div>
                          {currentBahan && (
                            <p className="text-[10px] text-[#544437]/80 font-semibold pl-1">
                              📦 Satuan kirim: <strong className="text-[#701604] uppercase font-bold">{currentDistUnit}</strong>
                              {currentBahan.satuan_distribusi && currentBahan.satuan_distribusi.toLowerCase() !== currentBahan.satuan.toLowerCase() && (
                                <span className="text-[#544437]/65"> (1 {currentBahan.satuan} = {currentBahan.satuan_tengah ? `${currentBahan.faktor_tengah} ${currentBahan.satuan_tengah}` : `${currentBahan.faktor_konversi || currentBahan.faktor_tampilan} ${currentBahan.satuan_kecil}`})</span>
                              )}
                            </p>
                          )}
                        </div>
                      );
                    })()}
                  </>
                )}
              </div>
            </div>

            {/* Item yang dipilih */}
            <div className="border-t border-[#d9c2b2]/15 pt-4">
              <label className="block text-[10px] font-bold text-[#544437]/60 uppercase tracking-wider pl-1 mb-2">
                Item yang dipilih
              </label>
              {items.length === 0 ? (
                <p className="text-xs text-[#544437]/50 bg-[#fff8f1]/50 border border-dashed border-[#d9c2b2]/40 p-4 rounded-xl text-center font-bold">
                  Belum ada item ditambahkan
                </p>
              ) : (
                <div className="space-y-2">
                  {items.map((item, idx) => {
                    const bahan = bahanBaku.find((b) => b.id === item.bahanId)
                    return (
                      <div
                        key={idx}
                        className="flex justify-between items-center bg-[#fff8f1] border border-[#d9c2b2]/40 px-4 py-3 rounded-xl shadow-xs"
                      >
                        <span className="text-xs font-bold text-[#1e1b15] uppercase tracking-wide">
                          {bahan?.nama || 'Unknown'} - {item.qty} {bahan?.satuan_distribusi || bahan?.satuan}
                        </span>
                        <button
                          type="button"
                          onClick={() => removeItem(idx)}
                          className="text-[#ba1a1a] hover:text-[#931313] text-xs font-extrabold uppercase tracking-wide transition-colors cursor-pointer"
                        >
                          ✕ Hapus
                        </button>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3 border-t border-[#d9c2b2]/15 pt-4">
              <button
                type="submit"
                disabled={submitting}
                className="flex-1 py-3 bg-[#701604] hover:bg-[#591002] active:bg-[#430b01] text-white font-bold uppercase tracking-wider text-xs shadow-md active:scale-[0.98] transition-all cursor-pointer disabled:opacity-50"
              >
                {submitting ? 'Menyimpan...' : 'Simpan Surat Jalan'}
              </button>
              <Link
                href="/distribusi/surat-jalan"
                className="px-6 py-3 border border-[#d9c2b2]/45 text-[#701604] hover:bg-[#fff8f1]/50 bg-white rounded-xl font-bold text-xs uppercase tracking-wider shadow-sm transition-all active:scale-[0.98] text-center cursor-pointer flex items-center justify-center"
              >
                Batal
              </Link>
            </div>
          </form>
        </div>
      </div>

      {/* Bottom Navigation Bar */}
      <BottomNav activeTab="surat-jalan" />
    </div>
  )
}
