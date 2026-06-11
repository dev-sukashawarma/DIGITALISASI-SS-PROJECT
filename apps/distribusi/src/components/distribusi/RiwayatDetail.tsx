'use client'

import Link from 'next/link'
import { useSuratJalanDetail } from '@/hooks/useSuratJalanDetail'

function SignatureBlock({ title, sigs }: { title: string; sigs: any[] }) {
  return (
    <div className="bg-[#fff8f1] border border-suka-brown/10 rounded-xl p-4">
      <p className="text-xs font-bold text-suka-brown uppercase tracking-wider mb-2">{title} ({sigs.length})</p>
      {sigs.length === 0 ? (
        <p className="text-xs text-suka-brown/40">Belum ada</p>
      ) : (
        <div className="space-y-3">
          {sigs.map((s, i) => (
            <div key={i} className="flex items-center gap-3">
              {s.signature_image && (
                <img src={s.signature_image} alt={s.role} className="h-10 w-auto bg-white border border-suka-brown/10 rounded p-1" />
              )}
              <div>
                <p className="text-sm font-semibold text-suka-ink">{s.signed_by}</p>
                <p className="text-xs text-suka-brown/60">{s.role} · {new Date(s.signed_at).toLocaleString('id-ID', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export function RiwayatDetail({ id }: { id: string }) {
  const { data, loading, error } = useSuratJalanDetail(id)

  if (loading) {
    return (
      <div className="flex flex-col min-h-screen justify-center items-center bg-[#fff8f1] text-[#701604] font-medium">
        <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-[#701604] mb-4"></div>
        <p className="text-sm">Memuat...</p>
      </div>
    )
  }
  if (error || !data) {
    return <p className="p-6 text-red-600">Gagal memuat: {error}</p>
  }

  return (
    <div className="min-h-screen bg-[#fff8f1] text-[#1e1b15] pb-12">
      <header className="sticky top-0 z-40 bg-white border-b border-suka-brown/10 px-6 py-4 flex justify-between items-center shadow-sm">
        <div className="flex items-center gap-3">
          <img src="/logo.png" alt="Logo Suka Shawarma" className="h-10 w-auto object-contain" />
          <h2 className="text-xl font-bold text-[#701604] tracking-tight">Detail Penerimaan</h2>
        </div>
        <Link href="/distribusi/riwayat" className="px-4 py-2 border border-suka-brown/15 text-suka-brown font-semibold text-xs rounded-xl bg-white hover:bg-suka-cream transition-all">
          ← Riwayat
        </Link>
      </header>

      <div className="p-6 max-w-3xl mx-auto mt-6">
        <div className="bg-white rounded-xl border border-suka-brown/10 p-6 shadow-sm space-y-6">
          <div className="border-b-2 border-suka-brown/20 pb-4 text-center">
            <h1 className="text-2xl font-extrabold text-suka-brown tracking-tight">SURAT JALAN</h1>
            <p className="text-md font-semibold text-suka-brown/70 mt-1">{data.document_number || id.substring(0, 8).toUpperCase()}</p>
            <span className="inline-block mt-2 px-3 py-1 rounded-full text-xs font-bold uppercase bg-green-50 text-green-800 border border-green-200">{data.status}</span>
          </div>

          <div>
            <h2 className="text-sm font-bold text-suka-brown uppercase tracking-wider mb-3">Item Diterima</h2>
            <div className="border border-suka-brown/10 rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-[#faf2e9] border-b border-suka-brown/10">
                  <tr>
                    <th className="px-4 py-3 text-left font-bold text-suka-brown text-xs uppercase">Barang</th>
                    <th className="px-4 py-3 text-center font-bold text-suka-brown text-xs uppercase">Kirim</th>
                    <th className="px-4 py-3 text-center font-bold text-suka-brown text-xs uppercase">Terima</th>
                    <th className="px-4 py-3 text-center font-bold text-suka-brown text-xs uppercase">Kondisi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-suka-brown/10">
                  {data.surat_jalan_item.map((item) => {
                    const kurang = item.qty_terima != null && item.qty_terima < item.qty_dikirim
                    const rusak = item.kondisi === 'rusak'
                    return (
                      <tr key={item.id}>
                        <td className="px-4 py-3 font-semibold text-suka-ink">{item.bahan_baku?.nama}</td>
                        <td className="px-4 py-3 text-center text-suka-brown/70">{item.qty_dikirim} {item.bahan_baku?.satuan}</td>
                        <td className={`px-4 py-3 text-center font-bold ${kurang ? 'text-red-600' : 'text-suka-ink'}`}>
                          {item.qty_terima ?? '-'} {item.bahan_baku?.satuan}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${rusak ? 'bg-red-50 text-red-700 border border-red-200' : 'bg-green-50 text-green-700 border border-green-200'}`}>
                            {item.kondisi || 'baik'}
                          </span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <SignatureBlock title="TTD Pengirim" sigs={data.signatures || []} />
            <SignatureBlock title="TTD Penerima" sigs={data.receipt_signatures || []} />
          </div>
        </div>
      </div>
    </div>
  )
}
