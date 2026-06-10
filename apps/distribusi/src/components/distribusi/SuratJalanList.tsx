'use client'

import Link from 'next/link'
import { useSuratJalanList } from '@/hooks/useSuratJalanList'

export function SuratJalanList() {
  const { data, loading, draftCount, sentCount } = useSuratJalanList()

  if (loading) {
    return (
      <div className="p-6 max-w-6xl mx-auto">
        <p className="text-gray-500">Memuat...</p>
      </div>
    )
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Surat Jalan</h1>
        <Link
          href="/distribusi/surat-jalan/new"
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          Buat Surat Jalan
        </Link>
      </div>

      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <p className="text-sm text-gray-600">
          {draftCount} draft · {sentCount} sedang dikirim
        </p>
      </div>

      {data.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-6">
          <p className="text-gray-500">Belum ada Surat Jalan</p>
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
                  Tanggal
                </th>
                <th className="px-6 py-3 text-left text-sm font-medium text-gray-700">
                  Aksi
                </th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {data.map((sj) => (
                <tr key={sj.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 text-sm">{sj.outlet?.name || 'Unknown'}</td>
                  <td className="px-6 py-4 text-sm">
                    <span
                      className={`px-2 py-1 rounded text-xs font-medium ${
                        sj.status === 'draft'
                          ? 'bg-yellow-100 text-yellow-800'
                          : sj.status === 'dikirim'
                            ? 'bg-blue-100 text-blue-800'
                            : 'bg-green-100 text-green-800'
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
                      href={`/distribusi/surat-jalan/${sj.id}`}
                      className="text-blue-600 hover:underline"
                    >
                      Lihat
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
