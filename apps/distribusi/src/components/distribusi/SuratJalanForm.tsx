'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'
import { useOutlets } from '@/hooks/useOutlets'
import { useBahanBaku } from '@/hooks/useBahanBaku'
import { BottomNav } from './BottomNav'

interface FormItem {
  bahanId: string
  qty: number
}

export function SuratJalanForm() {
  const router = useRouter()
  const { outlets, loading: outletsLoading } = useOutlets()
  const { bahanBaku, loading: bahanLoading } = useBahanBaku()
  const [outletId, setOutletId] = useState('')
  const [items, setItems] = useState<FormItem[]>([])
  const [selectedBahan, setSelectedBahan] = useState('')
  const [qty, setQty] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const addItem = () => {
    if (!selectedBahan || !qty) return
    setItems([...items, { bahanId: selectedBahan, qty: parseInt(qty) }])
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
    const supabase = createClient()

    try {
      // Create surat jalan with formatted document number
      const { data: sj, error: sjError } = await supabase.rpc(
        'create_surat_jalan_with_number',
        { p_outlet_id: outletId }
      )

      if (sjError) throw new Error(`Failed to create surat jalan: ${sjError.message}`)
      if (!sj?.id) throw new Error('No ID returned from surat jalan insert')

      // Insert items
      const itemsToInsert = items.map((item) => ({
        surat_jalan_id: sj.id,
        bahan_baku_id: item.bahanId,
        qty_dikirim: item.qty,
      }))

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
      {/* Header */}
      <header className="sticky top-0 z-40 bg-[#fff8f1] border-b border-[#d9c2b2]/30 px-4 py-4 flex justify-between items-center shadow-[0_2px_8px_rgba(144,77,0,0.03)] flex-shrink-0">
        <div className="flex items-center gap-3">
          <Link
            href="/distribusi/surat-jalan"
            className="w-9 h-9 flex items-center justify-center rounded-full bg-white border border-[#d9c2b2]/30 text-[#f29744] hover:bg-orange-50 active:scale-95 transition-all shadow-sm"
            title="Kembali"
          >
            <span className="text-base">←</span>
          </Link>
          <div className="flex flex-col">
            <h1 className="font-bold text-sm text-[#701604] uppercase tracking-tight leading-tight">Buat Surat Jalan</h1>
            <p className="text-[10px] text-[#544437]/75 font-bold mt-0.5">Sistem Distribusi & Logistik</p>
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
                    <select
                      value={selectedBahan}
                      onChange={(e) => setSelectedBahan(e.target.value)}
                      className="w-full sm:flex-1 px-4 py-2.5 rounded-xl border border-[#d9c2b2]/40 bg-white focus:outline-none focus:ring-1 focus:ring-[#f29744] focus:border-[#f29744] text-xs text-[#1e1b15] font-semibold transition-all shadow-sm"
                    >
                      <option value="">Pilih barang...</option>
                      {bahanBaku.map((bahan) => (
                        <option key={bahan.id} value={bahan.id}>
                          {bahan.nama.toUpperCase()} ({bahan.satuan})
                        </option>
                      ))}
                    </select>
                    <div className="flex gap-2 w-full sm:w-auto shrink-0">
                      <input
                        type="number"
                        value={qty}
                        onChange={(e) => setQty(e.target.value)}
                        placeholder="Qty"
                        className="flex-1 sm:w-24 px-4 py-2.5 rounded-xl border border-[#d9c2b2]/40 bg-white text-center focus:outline-none focus:ring-1 focus:ring-[#f29744] focus:border-[#f29744] text-xs text-[#1e1b15] placeholder-[#544437]/45 font-semibold transition-all shadow-sm"
                      />
                      <button
                        type="button"
                        onClick={addItem}
                        className="flex-1 sm:flex-initial px-5 py-2.5 bg-[#f29744] hover:bg-orange-600 active:bg-orange-700 text-white font-bold text-xs uppercase tracking-wider rounded-xl shadow-sm transition-all active:scale-95 cursor-pointer shrink-0"
                      >
                        Tambah
                      </button>
                    </div>
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
                          {bahan?.nama || 'Unknown'} - {item.qty} {bahan?.satuan}
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
