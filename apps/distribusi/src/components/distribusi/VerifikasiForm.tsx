'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'
import { useSuratJalanDetail } from '@/hooks/useSuratJalanDetail'

export function VerifikasiForm({ id }: { id: string }) {
  const router = useRouter()
  const { data, loading, error } = useSuratJalanDetail(id)
  const [verifications, setVerifications] = useState<Record<string, any>>({})
  const [submitting, setSubmitting] = useState(false)

  if (loading) {
    return <p className="text-gray-500">Memuat...</p>
  }

  if (error || !data) {
    return <p className="text-red-600">Gagal memuat: {error}</p>
  }

  const handleQtyChange = (itemId: string, value: string) => {
    setVerifications({
      ...verifications,
      [itemId]: { ...verifications[itemId], qty_terima: parseInt(value) || 0 },
    })
  }

  const handleKondisiChange = (itemId: string, value: string) => {
    setVerifications({
      ...verifications,
      [itemId]: { ...verifications[itemId], kondisi: value },
    })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    // Validate all items have qty_terima
    const incompleteItems = data.surat_jalan_item.filter(
      (item) => verifications[item.id]?.qty_terima === undefined
    )
    if (incompleteItems.length > 0) {
      alert('Semua item harus diisi qty terima')
      return
    }

    setSubmitting(true)
    const supabase = createClient()

    try {
      // Update all items in parallel
      const updatePromises = data.surat_jalan_item.map((item) => {
        const verification = verifications[item.id]
        return supabase
          .from('surat_jalan_item')
          .update({
            qty_terima: verification.qty_terima,
            kondisi: verification.kondisi || 'baik',
            verified_at: new Date().toISOString(),
          })
          .eq('id', item.id)
      })

      const results = await Promise.all(updatePromises)

      // Check for errors
      const errors = results.filter(({ error }) => error)
      if (errors.length > 0) {
        throw new Error(`Failed to verify items: ${errors[0].error?.message}`)
      }

      // Update surat jalan status to diterima_lengkap
      const { error: sjError } = await supabase
        .from('surat_jalan')
        .update({ status: 'diterima_lengkap' })
        .eq('id', id)

      if (sjError) throw sjError

      alert('Verifikasi berhasil disimpan!')
      router.push('/distribusi/terima')
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Gagal menyimpan verifikasi'
      alert(`Error: ${message}`)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center gap-4 mb-6">
        <Link href="/distribusi/terima" className="text-blue-600 hover:underline">
          ← Kembali
        </Link>
        <h1 className="text-3xl font-bold">Verifikasi Penerimaan</h1>
      </div>

      <div className="bg-white rounded-lg shadow p-6 space-y-6">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-sm text-gray-600">Outlet</p>
            <p className="text-lg font-medium">{data.outlets?.name}</p>
          </div>
          <div>
            <p className="text-sm text-gray-600">Status</p>
            <p className="text-lg font-medium">{data.status}</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <h2 className="text-lg font-semibold">Verifikasi Item</h2>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-4 py-2 text-left">Barang</th>
                  <th className="px-4 py-2 text-center">Qty Dikirim</th>
                  <th className="px-4 py-2 text-center">Qty Terima</th>
                  <th className="px-4 py-2 text-left">Kondisi</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {data.surat_jalan_item.map((item) => (
                  <tr key={item.id} className="hover:bg-gray-50">
                    <td className="px-4 py-2">
                      {item.bahan_baku?.nama} ({item.bahan_baku?.satuan})
                    </td>
                    <td className="px-4 py-2 text-center">{item.qty_dikirim}</td>
                    <td className="px-4 py-2 text-center">
                      <input
                        type="number"
                        min="0"
                        value={verifications[item.id]?.qty_terima || ''}
                        onChange={(e) => handleQtyChange(item.id, e.target.value)}
                        className="w-16 border border-gray-300 rounded px-2 py-1 text-center"
                        placeholder="0"
                      />
                    </td>
                    <td className="px-4 py-2">
                      <select
                        value={verifications[item.id]?.kondisi || 'baik'}
                        onChange={(e) => handleKondisiChange(item.id, e.target.value)}
                        className="border border-gray-300 rounded px-2 py-1"
                      >
                        <option value="baik">Baik</option>
                        <option value="rusak">Rusak</option>
                        <option value="hilang_qty">Hilang Qty</option>
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex gap-3">
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
            >
              {submitting ? 'Menyimpan...' : 'Selesai Verifikasi'}
            </button>
            <Link
              href="/distribusi/terima"
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
