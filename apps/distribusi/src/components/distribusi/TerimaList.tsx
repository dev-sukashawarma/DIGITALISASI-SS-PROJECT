'use client'

import Link from 'next/link'
import { useTerimaList } from '@/hooks/useTerimaList'

export function TerimaList() {
  const { data, loading } = useTerimaList()

  if (loading) {
    return (
      <div className="p-6 max-w-6xl mx-auto">
        <p className="text-gray-500">Memuat...</p>
      </div>
    )
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <h1 className="text-3xl font-bold mb-6">Penerimaan Barang</h1>

      {data.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-6">
          <p className="text-gray-500">Belum ada kiriman</p>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-6 py-3 text-left text-sm font-medium text-gray-700">
                  Outlet
                </th>
                <th className="px-6 py-3 text-left text-sm font-medium text-gray-700">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-sm font-medium text-gray-700">
                  Tanggal Dikirim
                </th>
                <th className="px-6 py-3 text-left text-sm font-medium text-gray-700">
                  Aksi
                </th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {data.map((sj) => (
                <tr key={sj.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 text-sm">{sj.outlets?.name || 'Unknown'}</td>
                  <td className="px-6 py-4 text-sm">
                    <span
                      className={`px-2 py-1 rounded text-xs font-medium ${
                        sj.status === 'dikirim'
                          ? 'bg-blue-100 text-blue-800'
                          : 'bg-orange-100 text-orange-800'
                      }`}
                    >
                      {sj.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm">
                    {new Date(sj.created_at).toLocaleDateString('id-ID')}
                  </td>
                  <td className="px-6 py-4 text-sm">
                    <Link
                      href={`/distribusi/terima/${sj.id}`}
                      className="text-blue-600 hover:underline"
                    >
                      Verifikasi
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
