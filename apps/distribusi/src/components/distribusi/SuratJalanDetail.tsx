'use client'

import { useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'
import { useSuratJalanDetail } from '@/hooks/useSuratJalanDetail'

export function SuratJalanDetail({ id }: { id: string }) {
  const { data, loading, error } = useSuratJalanDetail(id)
  const [sending, setSending] = useState(false)

  const handleSend = async () => {
    if (!data?.id) return

    setSending(true)
    const supabase = createClient()

    try {
      const { error: sendError } = await supabase
        .from('surat_jalan')
        .update({ status: 'dikirim' })
        .eq('id', data.id)

      if (sendError) throw sendError

      alert('Surat Jalan berhasil dikirim!')
      window.location.reload()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Gagal mengirim'
      alert(`Error: ${message}`)
    } finally {
      setSending(false)
    }
  }

  if (loading) {
    return (
      <div className="p-6 max-w-4xl mx-auto">
        <p className="text-gray-500">Memuat...</p>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="p-6 max-w-4xl mx-auto">
        <div className="flex items-center gap-4 mb-6">
          <Link href="/distribusi/surat-jalan" className="text-blue-600 hover:underline">
            ← Kembali
          </Link>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <p className="text-red-600">Gagal memuat surat jalan: {error}</p>
        </div>
      </div>
    )
  }

  const statusBadge = {
    draft: 'bg-yellow-100 text-yellow-800',
    dikirim: 'bg-blue-100 text-blue-800',
    diterima_sebagian: 'bg-orange-100 text-orange-800',
    diterima_lengkap: 'bg-green-100 text-green-800',
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center gap-4 mb-6">
        <Link href="/distribusi/surat-jalan" className="text-blue-600 hover:underline">
          ← Kembali
        </Link>
        <h1 className="text-3xl font-bold">Detail Surat Jalan</h1>
      </div>

      <div className="bg-white rounded-lg shadow p-6 space-y-6">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-sm text-gray-600">Outlet</p>
            <p className="text-lg font-medium">{data.outlets?.name || 'Unknown'}</p>
          </div>
          <div>
            <p className="text-sm text-gray-600">Status</p>
            <div className="mt-1">
              <span
                className={`px-3 py-1 rounded text-sm font-medium ${
                  statusBadge[data.status as keyof typeof statusBadge] ||
                  'bg-gray-100 text-gray-800'
                }`}
              >
                {data.status}
              </span>
            </div>
          </div>
          <div>
            <p className="text-sm text-gray-600">Tanggal Dibuat</p>
            <p className="text-lg font-medium">
              {new Date(data.created_at).toLocaleDateString('id-ID')}
            </p>
          </div>
        </div>

        <div>
          <h2 className="text-lg font-semibold mb-3">Item Barang</h2>
          {data.surat_jalan_item && data.surat_jalan_item.length > 0 ? (
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
                      <td className="px-4 py-2 text-center">{item.qty_terima || '-'}</td>
                      <td className="px-4 py-2">{item.kondisi || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-gray-500">Tidak ada item</p>
          )}
        </div>

        {data.status === 'draft' && (
          <div className="flex gap-3">
            <button
              onClick={handleSend}
              disabled={sending}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
            >
              {sending ? 'Mengirim...' : 'Kirim Surat Jalan'}
            </button>
            <Link
              href="/distribusi/surat-jalan"
              className="px-4 py-2 border border-gray-300 rounded hover:bg-gray-50"
            >
              Kembali
            </Link>
          </div>
        )}
      </div>
    </div>
  )
}
