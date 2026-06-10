'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useOutlets } from '@/hooks/useOutlets'
import { useBahanBaku } from '@/hooks/useBahanBaku'

interface FormItem {
  bahanId: string
  qty: number
}

export function SuratJalanForm() {
  const { outlets, loading: outletsLoading } = useOutlets()
  const { bahanBaku, loading: bahanLoading } = useBahanBaku()
  const [outletId, setOutletId] = useState('')
  const [items, setItems] = useState<FormItem[]>([])
  const [selectedBahan, setSelectedBahan] = useState('')
  const [qty, setQty] = useState('')

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
    // TODO: Submit to API
    console.log({ outletId, items })
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center gap-4 mb-6">
        <Link href="/distribusi/surat-jalan" className="text-blue-600 hover:underline">
          ← Kembali
        </Link>
        <h1 className="text-3xl font-bold">Buat Surat Jalan</h1>
      </div>

      <div className="bg-white rounded-lg shadow p-6">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Outlet Tujuan</label>
            {outletsLoading ? (
              <p className="text-sm text-gray-500">Memuat outlet...</p>
            ) : (
              <select
                value={outletId}
                onChange={(e) => setOutletId(e.target.value)}
                className="w-full border border-gray-300 rounded px-3 py-2"
              >
                <option value="">Pilih outlet...</option>
                {outlets.map((outlet) => (
                  <option key={outlet.id} value={outlet.id}>
                    {outlet.nama}
                  </option>
                ))}
              </select>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Tambah Item Barang</label>
            <div className="flex gap-2 mb-3">
              {bahanLoading ? (
                <p className="text-sm text-gray-500">Memuat barang...</p>
              ) : (
                <>
                  <select
                    value={selectedBahan}
                    onChange={(e) => setSelectedBahan(e.target.value)}
                    className="flex-1 border border-gray-300 rounded px-3 py-2"
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
                    className="w-24 border border-gray-300 rounded px-3 py-2"
                  />
                  <button
                    type="button"
                    onClick={addItem}
                    className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
                  >
                    Tambah
                  </button>
                </>
              )}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Item yang dipilih</label>
            {items.length === 0 ? (
              <p className="text-sm text-gray-500 bg-gray-50 p-3 rounded">Belum ada item</p>
            ) : (
              <div className="space-y-2">
                {items.map((item, idx) => {
                  const bahan = bahanBaku.find((b) => b.id === item.bahanId)
                  return (
                    <div
                      key={idx}
                      className="flex justify-between items-center bg-gray-50 p-3 rounded"
                    >
                      <span>
                        {bahan?.nama} - {item.qty} {bahan?.satuan}
                      </span>
                      <button
                        type="button"
                        onClick={() => removeItem(idx)}
                        className="text-red-600 hover:text-red-700 text-sm"
                      >
                        Hapus
                      </button>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          <div className="flex gap-3">
            <button
              type="submit"
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              Simpan
            </button>
            <Link
              href="/distribusi/surat-jalan"
              className="px-4 py-2 border border-gray-300 rounded hover:bg-gray-50"
            >
              Batal
            </Link>
          </div>
        </form>
      </div>
    </div>
  )
}
