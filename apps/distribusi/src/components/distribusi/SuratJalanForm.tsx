'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'
import { useOutlets } from '@/hooks/useOutlets'
import { useBahanBaku } from '@/hooks/useBahanBaku'

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
    <div className="min-h-screen bg-[#fff8f1] text-[#1e1b15] pb-12">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-white border-b border-suka-brown/10 px-6 py-4 flex justify-between items-center shadow-sm">
        <div className="flex items-center gap-3">
          <img src="/logo.png" alt="Logo Suka Shawarma" className="h-10 w-auto object-contain" />
          <div className="flex flex-col">
            <h2 className="text-xl font-bold text-[#701604] tracking-tight">Buat Surat Jalan</h2>
            <p className="text-xs text-suka-brown/60 mt-0.5">Sistem Distribusi & Logistik</p>
          </div>
        </div>
        <div>
          <Link
            href="/distribusi/surat-jalan"
            className="px-4 py-2 border border-suka-brown/15 text-suka-brown font-semibold text-xs rounded-xl bg-white hover:bg-suka-cream transition-all flex items-center gap-1"
          >
            ← Kembali
          </Link>
        </div>
      </header>

      {/* Main card */}
      <div className="p-6 max-w-2xl mx-auto mt-6">
        <div className="bg-white rounded-xl border border-suka-brown/10 p-6 shadow-[0px_4px_12px_rgba(112,22,4,0.04)]">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-sm font-bold text-suka-brown mb-1.5">Outlet Tujuan</label>
              {outletsLoading ? (
                <p className="text-sm text-suka-brown/50">Memuat outlet...</p>
              ) : (
                <select
                  value={outletId}
                  onChange={(e) => setOutletId(e.target.value)}
                  className="w-full bg-[#fff8f1] border border-suka-brown/15 focus:border-suka-orange focus:ring-1 focus:ring-suka-orange rounded-xl px-4 py-2.5 text-sm transition-all"
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

            <div className="border-t border-suka-brown/10 pt-4">
              <label className="block text-sm font-bold text-suka-brown mb-2">Tambah Item Barang</label>
              <div className="flex gap-2 mb-3">
                {bahanLoading ? (
                  <p className="text-sm text-suka-brown/50">Memuat barang...</p>
                ) : (
                  <>
                    <select
                      value={selectedBahan}
                      onChange={(e) => setSelectedBahan(e.target.value)}
                      className="flex-1 bg-[#fff8f1] border border-suka-brown/15 focus:border-suka-orange focus:ring-1 focus:ring-suka-orange rounded-xl px-4 py-2.5 text-sm transition-all"
                    >
                      <option value="">Pilih barang...</option>
                      {bahanBaku.map((bahan) => (
                        <option key={bahan.id} value={bahan.id}>
                          {bahan.nama} ({bahan.satuan})
                        </option>
                      ))}
                    </select>
                    <input
                      type="number"
                      value={qty}
                      onChange={(e) => setQty(e.target.value)}
                      placeholder="Qty"
                      className="w-24 bg-[#fff8f1] border border-suka-brown/15 focus:border-suka-orange focus:ring-1 focus:ring-suka-orange rounded-xl px-4 py-2.5 text-sm text-center transition-all"
                    />
                    <button
                      type="button"
                      onClick={addItem}
                      className="px-4 py-2.5 bg-suka-orange text-white font-bold text-sm rounded-xl hover:bg-orange-600 active:bg-orange-700 shadow-sm transition-all cursor-pointer"
                    >
                      Tambah
                    </button>
                  </>
                )}
              </div>
            </div>

            <div className="border-t border-suka-brown/10 pt-4">
              <label className="block text-sm font-bold text-suka-brown mb-2">Item yang dipilih</label>
              {items.length === 0 ? (
                <p className="text-sm text-suka-brown/50 bg-[#fff8f1]/50 border border-dashed border-suka-brown/10 p-4 rounded-xl text-center">
                  Belum ada item ditambahkan
                </p>
              ) : (
                <div className="space-y-2">
                  {items.map((item, idx) => {
                    const bahan = bahanBaku.find((b) => b.id === item.bahanId)
                    return (
                      <div
                        key={idx}
                        className="flex justify-between items-center bg-[#fff8f1] border border-suka-brown/10 px-4 py-3 rounded-xl"
                      >
                        <span className="text-sm font-semibold text-suka-ink">
                          {bahan?.nama || 'Unknown'} - {item.qty} {bahan?.satuan}
                        </span>
                        <button
                          type="button"
                          onClick={() => removeItem(idx)}
                          className="text-red-600 hover:text-red-700 text-xs font-bold transition-colors cursor-pointer"
                        >
                          ✕ Hapus
                        </button>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            <div className="flex gap-3 border-t border-suka-brown/10 pt-4">
              <button
                type="submit"
                disabled={submitting}
                className="flex-1 px-4 py-3 bg-[#701604] hover:opacity-95 text-white font-bold text-sm rounded-xl disabled:opacity-50 transition-all cursor-pointer"
              >
                {submitting ? 'Menyimpan...' : 'Simpan Surat Jalan'}
              </button>
              <Link
                href="/distribusi/surat-jalan"
                className="px-6 py-3 border border-suka-brown/15 text-suka-brown font-semibold text-sm rounded-xl bg-white hover:bg-suka-cream transition-all text-center"
              >
                Batal
              </Link>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
