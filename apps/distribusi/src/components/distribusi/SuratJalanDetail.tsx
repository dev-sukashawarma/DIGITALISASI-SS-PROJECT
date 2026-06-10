'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'
import { useSuratJalanDetail } from '@/hooks/useSuratJalanDetail'
import { SignatureFlow } from './SignatureFlow'

export function SuratJalanDetail({ id }: { id: string }) {
  const router = useRouter()
  const { data, loading, error } = useSuratJalanDetail(id)
  const [signatures, setSignatures] = useState<any[]>(data?.signatures || [])

  const handleSignatureAdded = (newSignatures: any[]) => {
    setSignatures(newSignatures)
  }

  const handleSent = () => {
    router.push('/distribusi/surat-jalan')
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
      </div>

      <div className="border-b-4 border-gray-800 pb-4 mb-6 text-center">
        <h1 className="text-4xl font-bold">SURAT JALAN</h1>
        <p className="text-lg font-medium mt-2">{data?.document_number || id.substring(0, 8).toUpperCase()}</p>
      </div>

      <div className="bg-white rounded-lg shadow p-6 space-y-6">
        <div className="grid grid-cols-2 gap-6 border-b pb-6">
          <div>
            <p className="text-sm text-gray-600 font-medium">Dikirim dari:</p>
            <p className="text-lg font-bold mt-1">Outlet Kitchen Bogor</p>
          </div>
          <div>
            <p className="text-sm text-gray-600 font-medium">ke Outlet:</p>
            <p className="text-lg font-bold mt-1">{data.outlets?.name || 'Unknown'}</p>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4">
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
            <p className="text-sm text-gray-600">Tanggal</p>
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
                    <th className="px-4 py-2 text-center">Qty</th>
                    <th className="px-4 py-2 text-center">Satuan</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {data.surat_jalan_item.map((item) => (
                    <tr key={item.id} className="hover:bg-gray-50">
                      <td className="px-4 py-2">
                        {item.bahan_baku?.nama}
                      </td>
                      <td className="px-4 py-2 text-center">{item.qty_dikirim}</td>
                      <td className="px-4 py-2 text-center">{item.bahan_baku?.satuan}</td>
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
          <>
            <SignatureFlow
              suratJalanId={id}
              signatures={signatures}
              onSignatureAdded={handleSignatureAdded}
              onSent={handleSent}
            />
            <div className="flex gap-3">
              <Link
                href="/distribusi/surat-jalan"
                className="px-4 py-2 border border-gray-300 rounded hover:bg-gray-50"
              >
                Kembali
              </Link>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
