'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
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
      <div className="flex flex-col min-h-screen justify-center items-center bg-[#fff8f1] text-[#701604] font-medium">
        <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-[#701604] mb-4"></div>
        <p className="text-sm">Memuat...</p>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-[#fff8f1] text-[#1e1b15] pb-12">
        <header className="sticky top-0 z-40 bg-white border-b border-suka-brown/10 px-6 py-4 flex justify-between items-center shadow-sm">
          <div className="flex items-center gap-3">
            <img src="/logo.png" alt="Logo Suka Shawarma" className="h-10 w-auto object-contain" />
            <div className="flex flex-col">
              <h2 className="text-xl font-bold text-[#701604] tracking-tight">Detail Surat Jalan</h2>
              <p className="text-xs text-suka-brown/60 mt-0.5">Sistem Distribusi & Logistik</p>
            </div>
          </div>
          <div>
            <Link
              href="/distribusi/surat-jalan"
              className="px-4 py-2 border border-suka-brown/15 text-suka-brown font-semibold text-xs rounded-xl bg-white hover:bg-suka-cream transition-all"
            >
              ← Kembali
            </Link>
          </div>
        </header>
        <div className="p-6 max-w-3xl mx-auto mt-6">
          <div className="bg-white rounded-xl border border-red-200 p-6 shadow-sm">
            <p className="text-red-600 font-semibold">Gagal memuat surat jalan: {error}</p>
          </div>
        </div>
      </div>
    )
  }

  const statusBadge = {
    draft: 'bg-yellow-55 text-yellow-800 border border-yellow-250',
    dikirim: 'bg-blue-55 text-blue-800 border border-blue-250',
    diterima_sebagian: 'bg-orange-55 text-orange-850 border border-orange-250',
    diterima_lengkap: 'bg-green-55 text-green-800 border border-green-250',
  }

  return (
    <div className="min-h-screen bg-[#fff8f1] text-[#1e1b15] pb-12">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-white border-b border-suka-brown/10 px-6 py-4 flex justify-between items-center shadow-sm">
        <div className="flex items-center gap-3">
          <img src="/logo.png" alt="Logo Suka Shawarma" className="h-10 w-auto object-contain" />
          <div className="flex flex-col">
            <h2 className="text-xl font-bold text-[#701604] tracking-tight">Detail Surat Jalan</h2>
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
      <div className="p-6 max-w-3xl mx-auto mt-6">
        <div className="bg-white rounded-xl border border-suka-brown/10 p-6 shadow-[0px_4px_12px_rgba(112,22,4,0.04)] space-y-6">
          <div className="border-b-2 border-suka-brown/20 pb-4 text-center">
            <h1 className="text-3xl font-extrabold text-suka-brown tracking-tight">SURAT JALAN</h1>
            <p className="text-md font-semibold text-suka-brown/70 mt-1">{data?.document_number || id.substring(0, 8).toUpperCase()}</p>
          </div>

          <div className="grid grid-cols-2 gap-6 border-b border-suka-brown/10 pb-6">
            <div className="bg-[#fff8f1] p-4 rounded-xl border border-suka-brown/5">
              <p className="text-xs text-suka-brown/60 font-bold uppercase tracking-wider">Dikirim dari:</p>
              <p className="text-md font-extrabold text-suka-ink mt-1">Outlet Kitchen Bogor</p>
            </div>
            <div className="bg-[#fff8f1] p-4 rounded-xl border border-suka-brown/5">
              <p className="text-xs text-suka-brown/60 font-bold uppercase tracking-wider">Tujuan Outlet:</p>
              <p className="text-md font-extrabold text-suka-ink mt-1">{data.outlets?.name || 'Unknown'}</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-6 border-b border-suka-brown/10 pb-6">
            <div>
              <p className="text-xs text-suka-brown/60 font-bold uppercase tracking-wider">Status</p>
              <div className="mt-1">
                <span
                  className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wide border ${
                    statusBadge[data.status as keyof typeof statusBadge] ||
                    'bg-gray-50 text-gray-800 border-gray-200'
                  }`}
                >
                  {data.status}
                </span>
              </div>
            </div>
            <div>
              <p className="text-xs text-suka-brown/60 font-bold uppercase tracking-wider">Tanggal</p>
              <p className="text-md font-semibold text-suka-ink mt-1">
                {new Date(data.created_at).toLocaleDateString('id-ID', {
                  day: 'numeric',
                  month: 'long',
                  year: 'numeric'
                })}
              </p>
            </div>
          </div>

          <div>
            <h2 className="text-sm font-bold text-suka-brown uppercase tracking-wider mb-3">Daftar Item Barang</h2>
            {data.surat_jalan_item && data.surat_jalan_item.length > 0 ? (
              <div className="border border-suka-brown/10 rounded-xl overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-[#faf2e9] border-b border-suka-brown/10">
                    <tr>
                      <th className="px-6 py-3 text-left font-bold text-suka-brown text-xs uppercase tracking-wider">Barang</th>
                      <th className="px-6 py-3 text-center font-bold text-suka-brown text-xs uppercase tracking-wider">Qty</th>
                      <th className="px-6 py-3 text-center font-bold text-suka-brown text-xs uppercase tracking-wider">Satuan</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-suka-brown/10">
                    {data.surat_jalan_item.map((item) => (
                      <tr key={item.id} className="hover:bg-suka-cream/10 transition-colors">
                        <td className="px-6 py-3 text-sm font-semibold text-suka-ink">
                          {item.bahan_baku?.nama}
                        </td>
                        <td className="px-6 py-3 text-center font-bold text-suka-ink">{item.qty_dikirim}</td>
                        <td className="px-6 py-3 text-center text-suka-brown/70 font-medium">{item.bahan_baku?.satuan}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-suka-brown/50 bg-[#fff8f1]/50 border border-dashed border-suka-brown/10 p-4 rounded-xl text-center text-sm">
                Tidak ada item barang dalam surat jalan ini
              </p>
            )}
          </div>

          {data.status === 'draft' && (
            <div className="border-t border-suka-brown/10 pt-6 space-y-4">
              <SignatureFlow
                suratJalanId={id}
                signatures={signatures}
                onSignatureAdded={handleSignatureAdded}
                onSent={handleSent}
              />
              <div className="flex gap-3">
                <Link
                  href="/distribusi/surat-jalan"
                  className="px-5 py-2.5 border border-suka-brown/15 text-suka-brown font-bold text-sm rounded-xl bg-white hover:bg-suka-cream transition-all text-center"
                >
                  Kembali
                </Link>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
