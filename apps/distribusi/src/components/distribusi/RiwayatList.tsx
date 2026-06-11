'use client'

import Link from 'next/link'
import { useAuth } from '@/context/AuthContext'
import { useRiwayatList } from '@/hooks/useRiwayatList'

export function RiwayatList() {
  const { outletStaff } = useAuth()
  const { data, loading } = useRiwayatList()

  if (loading) {
    return (
      <div className="flex flex-col min-h-screen justify-center items-center bg-[#fff8f1] text-[#701604] font-medium">
        <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-[#701604] mb-4"></div>
        <p className="text-sm">Memuat riwayat penerimaan...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#fff8f1] text-[#1e1b15] pb-12">
      <header className="sticky top-0 z-40 bg-white border-b border-suka-brown/10 px-6 py-4 flex justify-between items-center shadow-sm">
        <div className="flex items-center gap-3">
          <img src="/logo.png" alt="Logo Suka Shawarma" className="h-10 w-auto object-contain" />
          <div className="flex flex-col">
            <h2 className="text-xl font-bold text-[#701604] tracking-tight">Riwayat Penerimaan</h2>
            <p className="text-xs text-suka-brown/60 mt-0.5">{outletStaff?.name || 'Staff'}</p>
          </div>
        </div>
        <Link href="/distribusi/terima" className="px-4 py-2 border border-suka-brown/15 text-suka-brown font-semibold text-xs rounded-xl bg-white hover:bg-suka-cream transition-all">
          ← Inbox
        </Link>
      </header>

      <div className="p-6 max-w-6xl mx-auto space-y-6">
        {data.length === 0 ? (
          <div className="bg-white rounded-xl border border-suka-brown/10 p-12 text-center shadow-sm">
            <p className="text-suka-brown/50 font-medium text-lg">Belum ada penerimaan selesai</p>
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-suka-brown/10 overflow-hidden shadow-sm">
            <table className="w-full text-left">
              <thead className="bg-[#faf2e9] border-b border-suka-brown/10">
                <tr>
                  <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-suka-brown">No. SJ</th>
                  <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-suka-brown">Status</th>
                  <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-suka-brown">Tanggal</th>
                  <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-suka-brown">Catatan</th>
                  <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-suka-brown">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-suka-brown/10">
                {data.map((sj) => (
                  <tr key={sj.id} className="hover:bg-suka-cream/10 transition-colors">
                    <td className="px-6 py-4 text-sm font-semibold text-suka-ink">{sj.document_number || sj.id.substring(0, 8).toUpperCase()}</td>
                    <td className="px-6 py-4 text-sm">
                      <span className="px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wide border bg-green-50 text-green-800 border-green-200">
                        {sj.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-suka-brown/70 font-medium">
                      {new Date(sj.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}
                    </td>
                    <td className="px-6 py-4 text-sm">
                      {sj.has_problem ? (
                        <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-red-50 text-red-700 border border-red-200">⚠️ Ada Masalah</span>
                      ) : (
                        <span className="text-suka-brown/40 text-xs">—</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-sm">
                      <Link href={`/distribusi/riwayat/${sj.id}`} className="inline-flex px-3 py-1.5 bg-[#701604] hover:opacity-95 text-white font-bold text-xs rounded-xl shadow-sm transition-all">
                        Lihat Detail
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
