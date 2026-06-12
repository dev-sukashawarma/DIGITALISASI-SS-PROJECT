'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useSuratJalanDetail } from '@/hooks/useSuratJalanDetail'
import { SignatureFlow } from './SignatureFlow'
import { useAuth } from '@/context/AuthContext'
import { createClient } from '@/lib/supabase'
import { generatePDFContent, downloadPDF } from '@/utils/generatePDF'

function SignatureBlock({ title, sigs }: { title: string; sigs: any[] }) {
  return (
    <div className="bg-[#fff8f1]/50 border border-[#d9c2b2]/45 rounded-xl p-4 shadow-sm">
      <p className="text-[9px] font-bold text-[#544437]/50 uppercase tracking-wider mb-3 leading-none">{title} ({sigs.length})</p>
      {sigs.length === 0 ? (
        <p className="text-[10px] text-[#544437]/40 font-bold italic">Belum ada tanda tangan</p>
      ) : (
        <div className="space-y-3">
          {sigs.map((s, i) => (
            <div key={i} className="flex items-center gap-3">
              {s.signature_image && (
                <img src={s.signature_image} alt={s.role} className="h-10 w-auto bg-white border border-[#d9c2b2]/30 rounded p-1 object-contain shadow-xs" />
              )}
              <div>
                <p className="text-xs font-bold text-[#1e1b15] uppercase tracking-wide">{s.signed_by}</p>
                <p className="text-[10px] text-[#544437]/65 mt-0.5 font-semibold">
                  {s.role} &bull; {new Date(s.signed_at).toLocaleDateString('id-ID', {
                    day: 'numeric',
                    month: 'short',
                    hour: '2-digit',
                    minute: '2-digit'
                  })}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export function SuratJalanDetail({ id }: { id: string }) {
  const router = useRouter()
  const { outletStaff } = useAuth()
  const { data, loading, error } = useSuratJalanDetail(id)
  const [signatures, setSignatures] = useState<any[]>(data?.signatures || [])
  const [verifying, setVerifying] = useState(false)
  const [pdfHtml, setPdfHtml] = useState<string | null>(null)

  useEffect(() => {
    const loadPdfHtml = async () => {
      if (data && outletStaff?.role !== 'kepala_outlet') {
        const htmlContent = await generatePDFContent({
          id: data.id,
          document_number: data.document_number || `SJ-${data.id.substring(0, 8).toUpperCase()}`,
          outlet_name: data.outlets?.name || 'Unknown',
          sender_outlet: 'Outlet Kitchen Bogor',
          status: data.status,
          created_at: data.created_at,
          verification_url: `${window.location.origin}/distribusi/terima/${data.id}`,
          verification_code: data.verification_code,
          items: data.surat_jalan_item.map((item: any) => ({
            ...item,
            nama: item.bahan_baku?.nama,
            satuan: item.bahan_baku?.satuan,
          })),
          signatures: data.signatures || [],
          receipt_signatures: data.receipt_signatures || [],
        }, { hideQR: true })
        setPdfHtml(htmlContent)
      }
    }
    loadPdfHtml()
  }, [data, outletStaff])

  const handleSignatureAdded = (newSignatures: any[]) => {
    setSignatures(newSignatures)
  }

  const handleSent = () => {
    router.push('/distribusi/surat-jalan')
  }

  const handleVerifyPusat = async () => {
    const confirm = window.confirm("Apakah Anda yakin ingin memverifikasi penerimaan Surat Jalan ini dari pihak Pusat?");
    if (!confirm) return;

    setVerifying(true)
    try {
      const supabase = createClient()
      const { error } = await supabase
        .from('surat_jalan')
        .update({ status: 'selesai', updated_at: new Date().toISOString() })
        .eq('id', id)

      if (error) throw error
      alert("Surat Jalan berhasil diverifikasi oleh Pusat!")
      window.location.reload()
    } catch (err: any) {
      alert(`Gagal memverifikasi: ${err.message}`)
    } finally {
      setVerifying(false)
    }
  }

  const handleDownloadPDF = async () => {
    if (!data) return

    const htmlContent = await generatePDFContent({
      id: data.id,
      document_number: data.document_number || `SJ-${data.id.substring(0, 8).toUpperCase()}`,
      outlet_name: data.outlets?.name || 'Unknown',
      sender_outlet: 'Outlet Kitchen Bogor',
      status: data.status,
      created_at: data.created_at,
      verification_url: `${window.location.origin}/distribusi/terima/${data.id}`,
      verification_code: data.verification_code,
      items: data.surat_jalan_item.map((item: any) => ({
        ...item,
        nama: item.bahan_baku?.nama,
        satuan: item.bahan_baku?.satuan,
      })),
      signatures: data.signatures || [],
      receipt_signatures: data.receipt_signatures || [],
    })

    downloadPDF(`Surat-Jalan-${data.id.substring(0, 8)}.html`, htmlContent)
  }

  if (loading) {
    return (
      <div className="flex flex-col min-h-screen justify-center items-center bg-[#fff8f1] text-[#701604] font-medium">
        <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-[#701604] mb-4"></div>
        <p className="text-xs font-bold uppercase tracking-wider animate-pulse">Memuat Detail...</p>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-[#fff8f1] flex items-center justify-center p-4">
        <p className="p-4 text-xs font-bold text-[#ba1a1a] bg-[#ffdad6] border border-[#ba1a1a]/20 rounded-xl">
          Gagal memuat surat jalan: {error}
        </p>
      </div>
    )
  }

  if (outletStaff?.role !== 'kepala_outlet') {
    return (
      <div className="min-h-screen bg-[#fff8f1] text-[#1e1b15] pb-24">
        {/* Header Banner */}
        <header className="sticky top-0 z-40 bg-[#fff8f1] border-b border-[#d9c2b2]/30 px-4 py-4 flex justify-between items-center shadow-[0_2px_8px_rgba(144,77,0,0.03)] flex-shrink-0">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.back()}
              className="w-9 h-9 flex items-center justify-center rounded-full bg-white border border-[#d9c2b2]/30 text-[#f29744] hover:bg-orange-50 active:scale-95 transition-all shadow-sm"
              title="Kembali"
            >
              <span className="text-base">←</span>
            </button>
            <div className="flex flex-col">
              <h1 className="font-bold text-sm text-[#701604] uppercase tracking-tight leading-tight">Detail Surat Jalan</h1>
              <p className="text-[10px] text-[#544437]/75 font-bold mt-0.5">Sistem Distribusi & Logistik</p>
            </div>
          </div>
          
          {(data.status === 'dikirim' || data.status === 'dikirim_lengkap') && (
            <button
              onClick={() => router.push(`/distribusi/terima/${id}`)}
              className="px-3 py-1.5 bg-[#f29744] hover:bg-orange-600 active:bg-orange-700 text-white rounded-xl font-bold text-xs transition-colors shadow-sm uppercase tracking-wider active:scale-95 flex items-center gap-1 cursor-pointer"
            >
              📝 Verifikasi
            </button>
          )}
        </header>

        {/* Main Body - Renders PDF Preview */}
        <div className="p-4 max-w-3xl mx-auto mt-2">
          {pdfHtml ? (
            <div className="bg-white rounded-2xl border border-[#d9c2b2]/45 overflow-hidden shadow-[0px_4px_12px_rgba(144,77,0,0.03)] p-1">
              <iframe
                srcDoc={pdfHtml}
                className="w-full h-[650px] border-0 rounded-xl"
                title="Surat Jalan PDF"
              />
            </div>
          ) : (
            <div className="flex justify-center items-center h-64 text-xs font-bold text-[#544437]/50 animate-pulse bg-white border border-[#d9c2b2]/45 rounded-2xl p-6">
              Memuat PDF Surat Jalan...
            </div>
          )}
        </div>
      </div>
    )
  }

  const hasProblem = data.surat_jalan_item?.some(
    (it) => it.kondisi === 'rusak' || (it.qty_terima != null && it.qty_terima < it.qty_dikirim)
  )

  const statusBadge: Record<string, string> = {
    draft: 'bg-amber-50 text-amber-700 border border-amber-200',
    dikirim: 'bg-blue-50 text-blue-700 border border-blue-200',
    diterima_sebagian: 'bg-orange-50 text-orange-700 border border-orange-200',
    diterima_lengkap: 'bg-orange-50 text-orange-700 border border-orange-200',
    selesai: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
  }

  return (
    <div className="min-h-screen bg-[#fff8f1] text-[#1e1b15] pb-24">
      {/* Header Banner */}
      <header className="sticky top-0 z-40 bg-[#fff8f1] border-b border-[#d9c2b2]/30 px-4 py-4 flex justify-between items-center shadow-[0_2px_8px_rgba(144,77,0,0.03)] flex-shrink-0">
        <div className="flex items-center gap-3">
          <Link href="/distribusi/surat-jalan" className="w-9 h-9 flex items-center justify-center rounded-full bg-white border border-[#d9c2b2]/30 text-[#f29744] hover:bg-orange-50 active:scale-95 transition-all shadow-sm" title="Kembali ke Daftar">
            <span className="text-base">←</span>
          </Link>
          <div className="flex flex-col">
            <h1 className="font-bold text-sm text-[#701604] uppercase tracking-tight leading-tight">Detail Surat Jalan</h1>
            <p className="text-[10px] text-[#544437]/75 font-bold mt-0.5">Sistem Distribusi & Logistik</p>
          </div>
        </div>
        {(data.status === 'selesai' || data.status === 'dikirim') && (
          <button
            onClick={handleDownloadPDF}
            className="px-3 py-1.5 bg-[#701604] hover:bg-[#591002] active:bg-[#430b01] text-white rounded-xl font-bold text-[10px] transition-colors shadow-sm uppercase tracking-wider active:scale-95 flex items-center gap-1.5 cursor-pointer"
          >
            📥 Download Surat Jalan
          </button>
        )}
      </header>

      {/* Main Container */}
      <div className="p-4 max-w-3xl mx-auto space-y-4 mt-2">
        <div className="bg-white rounded-2xl border border-[#d9c2b2]/45 p-5 shadow-[0px_4px_12px_rgba(144,77,0,0.03)] space-y-5">
          {/* Header Info */}
          <div className="flex justify-between items-center border-b border-[#d9c2b2]/20 pb-4">
            <div>
              <span className="text-[9px] font-black text-[#544437]/50 uppercase tracking-widest leading-none">NO. SURAT JALAN</span>
              <p className="text-xs font-mono font-bold text-gray-500 mt-1.5 leading-none truncate max-w-[150px] lg:max-w-xs">
                {data.document_number || id.substring(0, 8).toUpperCase()}
              </p>
            </div>
            <span className={`px-2.5 py-1 rounded-lg text-[9px] font-bold uppercase tracking-wider border ${
              statusBadge[data.status] || 'bg-gray-50 text-gray-800 border-gray-200'
            }`}>
              {data.status === 'draft' && 'Draft'}
              {data.status === 'dikirim' && 'Dikirim'}
              {data.status === 'selesai' && 'Selesai'}
              {(data.status === 'diterima_lengkap' || data.status === 'diterima_sebagian') && (
                hasProblem ? 'Diterima Sebagian' : 'Diterima Lengkap'
              )}
            </span>
          </div>

          {/* Route Info */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="bg-[#fff8f1] p-4 rounded-xl border border-[#d9c2b2]/20">
              <p className="text-[9px] font-black text-[#544437]/55 uppercase tracking-wider">Dikirim Dari</p>
              <p className="text-xs font-bold text-[#1e1b15] uppercase tracking-wide mt-1.5">Outlet Kitchen Bogor</p>
            </div>
            <div className="bg-[#fff8f1] p-4 rounded-xl border border-[#d9c2b2]/20">
              <p className="text-[9px] font-black text-[#544437]/55 uppercase tracking-wider">Tujuan Outlet</p>
              <p className="text-xs font-bold text-[#1e1b15] uppercase tracking-wide mt-1.5">{data.outlets?.name || 'Unknown'}</p>
            </div>
          </div>

          {/* Date Info */}
          <div className="bg-[#faf2e9]/40 p-4 rounded-xl border border-[#d9c2b2]/20 text-xs flex justify-between items-center">
            <span className="font-bold text-[#544437]/70 uppercase tracking-wider">Tanggal Dibuat</span>
            <span className="font-semibold text-[#1e1b15]">
              {new Date(data.created_at).toLocaleDateString('id-ID', {
                weekday: 'long',
                day: 'numeric',
                month: 'long',
                year: 'numeric'
              })}
            </span>
          </div>

          {/* Items Log / Cards Layout */}
          <div>
            <h3 className="text-[9px] font-black text-[#544437]/50 uppercase tracking-widest pl-1 mb-3">Item Barang</h3>
            {data.surat_jalan_item && data.surat_jalan_item.length > 0 ? (
              <div className="space-y-2.5">
                {data.surat_jalan_item.map((item) => {
                  const hasReceived = item.qty_terima !== undefined && item.qty_terima !== null
                  const kurang = hasReceived && item.qty_terima! < item.qty_dikirim
                  const rusak = item.kondisi === 'rusak'
                  return (
                    <div key={item.id} className="p-3 bg-[#fff8f1]/30 rounded-xl border border-[#d9c2b2]/30 flex justify-between items-center text-xs">
                      <div className="space-y-0.5 min-w-0 pr-2">
                        <p className="font-bold text-[#1e1b15] uppercase tracking-wide truncate">{item.bahan_baku?.nama}</p>
                        <p className="text-[9px] text-[#544437]/60">
                          Dikirim: {item.qty_dikirim} {item.bahan_baku?.satuan}
                        </p>
                        {item.catatan && (
                          <p className="text-[9px] text-[#ba1a1a] font-semibold italic mt-0.5">* {item.catatan}</p>
                        )}
                      </div>
                      <div className="text-right shrink-0 space-y-1">
                        {hasReceived && (
                          <span className={`px-2 py-0.5 rounded-lg text-[8px] font-bold uppercase tracking-wider border inline-block ${
                            rusak
                              ? 'bg-red-50 text-red-750 border-red-200'
                              : 'bg-green-50 text-green-700 border-green-200'
                          }`}>
                            {item.kondisi || 'baik'}
                          </span>
                        )}
                        <p className={`font-black text-xs mt-1 ${
                          hasReceived ? (kurang ? 'text-[#ba1a1a]' : 'text-[#0a7d2c]') : 'text-[#544437]/65'
                        }`}>
                          {hasReceived ? `Terima: ${item.qty_terima} ${item.bahan_baku?.satuan}` : 'Belum Diterima'}
                        </p>
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : (
              <p className="text-[10px] text-center text-[#544437]/45 font-bold italic py-4 bg-[#fff8f1]/50 border border-dashed border-[#d9c2b2]/40 rounded-xl">
                Tidak ada item barang dalam surat jalan ini
              </p>
            )}
          </div>

          {/* Signature / Verif info for Draft */}
          {data.status === 'draft' && (
            <div className="border-t border-[#d9c2b2]/20 pt-5 space-y-4">
              <SignatureFlow
                suratJalanId={id}
                signatures={signatures}
                onSignatureAdded={handleSignatureAdded}
                onSent={handleSent}
              />
            </div>
          )}

          {/* Signatures display for Sent / Received states */}
          {data.status !== 'draft' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 border-t border-[#d9c2b2]/20 pt-5">
              <SignatureBlock title="TTD Pengirim (Pusat)" sigs={data.signatures || []} />
              <SignatureBlock title="TTD Penerima (Crew & Supir)" sigs={data.receipt_signatures || []} />
            </div>
          )}

          {/* Pusat Verification Action */}
          {outletStaff?.role === 'kepala_outlet' && (data.status === 'diterima_lengkap' || data.status === 'diterima_sebagian') && (
            <div className="border-t border-[#d9c2b2]/20 pt-5 flex flex-col gap-3">
              <div className="bg-[#faf2e9] border border-[#d9c2b2]/40 rounded-xl p-4 text-xs font-semibold text-[#544437] space-y-2">
                <p className="font-bold text-[#701604] uppercase">Konfirmasi Penerimaan Pusat</p>
                <p>Cabang telah memverifikasi kiriman ini. Silakan periksa item di atas beserta tanda tangan crew & supir, lalu klik tombol di bawah untuk menyelesaikan proses administrasi dan menutup dokumen ini.</p>
              </div>
              <button
                onClick={handleVerifyPusat}
                disabled={verifying}
                className="w-full py-3 bg-[#f29744] hover:bg-orange-600 active:bg-orange-700 text-white font-bold uppercase tracking-wider text-xs shadow-md rounded-xl transition-all cursor-pointer disabled:opacity-50"
              >
                {verifying ? 'Memproses...' : 'Verifikasi & Tutup Surat Jalan'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
