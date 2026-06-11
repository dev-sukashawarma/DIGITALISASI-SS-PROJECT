'use client'

import Link from 'next/link'
import { useAuth } from '@/context/AuthContext'
import { usePengirimanList } from '@/hooks/usePengirimanList'

const STATUS_STYLE: Record<string, string> = {
  draft: 'bg-yellow-50 text-yellow-800 border-yellow-200',
  dikirim: 'bg-blue-50 text-blue-800 border-blue-200',
  dikirim_lengkap: 'bg-blue-50 text-blue-800 border-blue-200',
  diterima_sebagian: 'bg-orange-50 text-orange-800 border-orange-200',
  diterima_lengkap: 'bg-green-50 text-green-800 border-green-200',
}

export function PengirimanList() {
  const { outletStaff, loading: authLoading } = useAuth()
  const { data, loading } = usePengirimanList()

  if (authLoading) {
    return <div className="min-h-screen flex items-center justify-center bg-[#fff8f1] text-suka-brown text-sm">Memuat...</div>
  }

  if (outletStaff?.role !== 'kepala_outlet') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#fff8f1] text-center px-6">
        <p className="text-suka-brown font-bold text-lg mb-2">Akses Ditolak</p>
        <p className="text-suka-brown/60 text-sm mb-4">Halaman ini hanya untuk SPV Pusat.</p>
        <Link href="/dashboard" className="px-4 py-2 bg-[#701604] text-white rounded-xl text-sm font-bold">← Dashboard</Link>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#fff8f1] text-[#1e1b15] pb-12">
      <header className="sticky top-0 z-40 bg-white border-b border-suka-brown/10 px-6 py-4 flex justify-between items-center shadow-sm">
        <div className="flex items-center gap-3">
          <img src="/logo.png" alt="Logo Suka Shawarma" className="h-10 w-auto object-contain" />
          <div className="flex flex-col">
            <h2 className="text-xl font-bold text-[#701604] tracking-tight">Pengiriman (Semua Outlet)</h2>
            <p className="text-xs text-suka-brown/60 mt-0.5">{outletStaff?.name} · SPV Pusat</p>
          </div>
        </div>
        <Link href="/dashboard" className="px-4 py-2 border border-suka-brown/15 text-suka-brown font-semibold text-xs rounded-xl bg-white hover:bg-suka-cream transition-all">
          ← Dashboard
        </Link>
      </header>

      <div className="p-6 max-w-6xl mx-auto space-y-6">
        {loading ? (
          <p className="text-suka-brown/50 text-center py-12">Memuat daftar pengiriman...</p>
        ) : data.length === 0 ? (
          <div className="bg-white rounded-xl border border-suka-brown/10 p-12 text-center shadow-sm">
            <p className="text-suka-brown/50 font-medium text-lg">Belum ada surat jalan</p>
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-suka-brown/10 overflow-hidden shadow-sm">
            <table className="w-full text-left">
              <thead className="bg-[#faf2e9] border-b border-suka-brown/10">
                <tr>
                  <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-suka-brown">No. SJ</th>
                  <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-suka-brown">Tujuan</th>
                  <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-suka-brown">Status</th>
                  <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-suka-brown">Tanggal</th>
                  <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-suka-brown">Catatan</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-suka-brown/10">
                {data.map((sj) => (
                  <tr key={sj.id} className="hover:bg-suka-cream/10 transition-colors">
                    <td className="px-6 py-4 text-sm font-semibold text-suka-ink">{sj.document_number || sj.id.substring(0, 8).toUpperCase()}</td>
                    <td className="px-6 py-4 text-sm text-suka-ink">{sj.outlets?.name || 'Unknown'}</td>
                    <td className="px-6 py-4 text-sm">
                      <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wide border ${STATUS_STYLE[sj.status] || 'bg-gray-50 text-gray-800 border-gray-200'}`}>
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
