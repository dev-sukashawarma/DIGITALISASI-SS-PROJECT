'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'
import { useSuratJalanDetail } from '@/hooks/useSuratJalanDetail'
import { ReceiptSignatureStep } from './ReceiptSignatureStep'

type Kondisi = 'baik' | 'jelek'

type ItemVerification = {
  qty_terima: number
  kondisi: Kondisi
  catatan: string
}

type Step = 'form' | 'signature'

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

export function VerifikasiForm({ id }: { id: string }) {
  const router = useRouter()
  const { data, loading, error } = useSuratJalanDetail(id)
  const [verifications, setVerifications] = useState<Record<string, ItemVerification>>({})
  const [step, setStep] = useState<Step>('form')
  const [submitting, setSubmitting] = useState(false)

  const [unlocked, setUnlocked] = useState(false)

  // Initialize verifications when data is loaded
  useEffect(() => {
    if (data?.surat_jalan_item) {
      const initial: Record<string, ItemVerification> = {}
      data.surat_jalan_item.forEach((item: any) => {
        initial[item.id] = {
          qty_terima: item.qty_dikirim ?? 0,
          kondisi: 'baik',
          catatan: '',
        }
      })
      setVerifications(initial)
    }
  }, [data])

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const isUnlocked = sessionStorage.getItem(`unlocked_verification_${id}`) === 'true'
      setUnlocked(isUnlocked)
    }
  }, [id])

  if (loading) return <div className="text-center py-12 text-xs font-bold text-[#544437]/50 animate-pulse bg-[#fff8f1] min-h-screen flex items-center justify-center">Memuat Form Verifikasi...</div>
  if (error || !data) return <div className="min-h-screen bg-[#fff8f1] flex items-center justify-center p-4"><p className="p-4 text-xs font-bold text-[#ba1a1a] bg-[#ffdad6] border border-[#ba1a1a]/20 rounded-xl">Gagal memuat: {error}</p></div>

  // QR Code scan validation check
  if (!unlocked) {
    return (
      <div className="min-h-screen bg-[#fff8f1] flex items-center justify-center p-6">
        <div className="bg-white rounded-2xl border border-[#d9c2b2]/45 p-6 max-w-sm text-center shadow-[0px_4px_12px_rgba(144,77,0,0.03)] space-y-4">
          <div className="w-16 h-16 bg-red-50 border border-red-200 text-[#ba1a1a] rounded-full flex items-center justify-center mx-auto text-2xl shadow-sm">
            🔒
          </div>
          <h2 className="text-sm font-extrabold text-[#701604] uppercase tracking-wide">Akses Verifikasi Terkunci</h2>
          <p className="text-xs text-[#544437]/75 leading-relaxed">
            Untuk alasan keamanan dan meminimalkan kesalahan pencatatan, Anda wajib memindai QR Code pada lembar fisik Surat Jalan yang dibawa oleh supir untuk membuka halaman verifikasi ini.
          </p>
          <div className="pt-2 flex flex-col gap-2">
            <button
              onClick={() => router.push('/distribusi/terima/scan')}
              className="w-full bg-[#f29744] hover:bg-orange-600 active:bg-orange-700 text-white rounded-xl py-3 font-bold text-xs uppercase tracking-wider shadow-md transition-all cursor-pointer active:scale-95 flex items-center justify-center gap-1.5"
            >
              📷 Scan QR Code Sekarang
            </button>
            <button
              onClick={() => router.push('/distribusi/terima')}
              className="w-full border border-[#d9c2b2]/45 text-[#544437] hover:bg-[#faf2e9] bg-white rounded-xl py-2.5 font-bold text-xs uppercase tracking-wider transition-all cursor-pointer active:scale-95 shadow-sm"
            >
              Kembali ke Inbox
            </button>
          </div>
        </div>
      </div>
    )
  }

  // Idempotency guard: jika SJ sudah diterima, redirect ke riwayat
  if (data.status && (data.status === 'diterima_lengkap' || data.status === 'diterima_sebagian' || data.status === 'selesai')) {
    return (
      <div className="min-h-screen bg-[#fff8f1] flex items-center justify-center p-6">
        <div className="bg-white rounded-2xl border border-[#d9c2b2]/45 p-6 max-w-sm text-center shadow-[0px_4px_12px_rgba(144,77,0,0.03)]">
          <p className="text-sm font-extrabold text-[#0a7d2c] mb-2 uppercase tracking-wide">✓ Verifikasi Selesai</p>
          <p className="text-xs text-[#544437]/70 mb-5">Surat jalan ini telah diverifikasi sebelumnya. Anda dapat melihat detailnya di Riwayat.</p>
          <button
            onClick={() => router.push('/distribusi/riwayat')}
            className="w-full bg-[#701604] hover:bg-[#591002] active:bg-[#430b01] text-white rounded-xl py-2.5 font-bold text-xs uppercase tracking-wider shadow-md transition-all cursor-pointer active:scale-95"
          >
            Buka Riwayat
          </button>
        </div>
      </div>
    )
  }

  const items = data.surat_jalan_item || []

  const handleNextStep = () => {
    // Validate all items
    for (const item of items) {
      const v = verifications[item.id] || { qty_terima: item.qty_dikirim, kondisi: 'baik' as const, catatan: '' }
      
      if (v.qty_terima > item.qty_dikirim) {
        alert(`Qty terima untuk ${item.bahan_baku?.nama} tidak boleh melebihi qty dikirim!`)
        return
      }
      
      const isDiscrepancy = v.qty_terima < item.qty_dikirim || v.kondisi === 'jelek'
      if (isDiscrepancy && !v.catatan.trim()) {
        alert(`Wajib mengisi catatan alasan selisih/masalah untuk item: ${item.bahan_baku?.nama}`)
        return
      }
    }
    
    setStep('signature')
  }

  const handleSubmit = async () => {
    setSubmitting(true)
    const supabase = createClient()
    try {
      const updatePromises = items.map((item) => {
        const v = verifications[item.id] ?? { qty_terima: item.qty_dikirim, kondisi: 'baik' as const, catatan: '' }
        return supabase
          .from('surat_jalan_item')
          .update({
            qty_terima: v.qty_terima,
            kondisi: v.kondisi === 'jelek' ? 'rusak' : 'baik',
            catatan: v.catatan || null,
            verified_at: new Date().toISOString(),
          })
          .eq('id', item.id)
      })

      const results = await Promise.all(updatePromises)
      const errors = results.filter(({ error }) => error)
      if (errors.length > 0) throw new Error(errors[0].error?.message)

      const { error: rpcError } = await supabase.rpc('finalize_surat_jalan_and_ledger', {
        p_surat_jalan_id: id,
      })
      if (rpcError) throw new Error(rpcError.message)

      router.push('/distribusi/riwayat')
    } catch (err) {
      alert(`Error: ${err instanceof Error ? err.message : 'Gagal menyimpan'}`)
    } finally {
      setSubmitting(false)
    }
  }

  if (step === 'signature') {
    return (
      <ReceiptSignatureStep
        suratJalanId={id}
        submitting={submitting}
        onFinalize={handleSubmit}
        onBack={() => setStep('form')}
      />
    )
  }

  return (
    <div className="min-h-screen bg-[#fff8f1] text-[#1e1b15] pb-24">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-[#fff8f1] border-b border-[#d9c2b2]/30 px-4 py-4 flex justify-between items-center shadow-[0_2px_8px_rgba(144,77,0,0.03)] flex-shrink-0">
        <div className="flex items-center gap-3">
          <Link href="/distribusi/terima" className="w-9 h-9 flex items-center justify-center rounded-full bg-white border border-[#d9c2b2]/30 text-[#f29744] hover:bg-orange-50 active:scale-95 transition-all shadow-sm" title="Kembali ke Inbox">
            <span className="text-base">←</span>
          </Link>
          <div className="flex flex-col">
            <h1 className="font-bold text-sm text-[#701604] uppercase tracking-tight leading-tight">Verifikasi Penerimaan</h1>
            <p className="text-[10px] text-[#544437]/75 font-bold mt-0.5">Sistem Distribusi & Logistik</p>
          </div>
        </div>
      </header>

      {/* Main Body (Surat Jalan dari Pusat layout) */}
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
            <span className="px-2.5 py-1 rounded-lg text-[9px] font-bold uppercase tracking-wider border bg-blue-50 text-blue-700 border-blue-200">
              Dikirim (Pending)
            </span>
          </div>

          {/* Route Info */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="bg-[#fff8f1] p-4 rounded-xl border border-[#d9c2b2]/20">
              <p className="text-[9px] font-black text-[#544437]/55 uppercase tracking-wider">Dikirim Dari</p>
              <p className="text-xs font-bold text-[#1e1b15] uppercase tracking-wide mt-1.5">Outlet Kitchen Pusat</p>
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

          {/* Items Verification Section */}
          <div>
            <h3 className="text-[9px] font-black text-[#544437]/50 uppercase tracking-widest pl-1 mb-3">Item Barang</h3>
            <div className="space-y-4">
              {items.map((item: any) => {
                const v = verifications[item.id] || {
                  qty_terima: item.qty_dikirim,
                  kondisi: 'baik',
                  catatan: '',
                }
                const isJelek = v.kondisi === 'jelek'

                return (
                  <div key={item.id} className="p-4 bg-white rounded-2xl border border-[#d9c2b2]/30 space-y-3 shadow-xs">
                    <div className="flex justify-between items-start">
                      <div>
                        <span className="text-[8px] text-[#f29744] font-black uppercase tracking-widest mb-1 bg-orange-50 border border-orange-100 px-2 py-0.5 rounded-md inline-block">
                          Kategori: {item.bahan_baku?.kategori || 'BAHAN BAKU'}
                        </span>
                        <h4 className="font-bold text-[#1e1b15] text-xs uppercase tracking-wide">{item.bahan_baku?.nama}</h4>
                      </div>
                      
                      {/* Condition toggle buttons */}
                      <div className="flex gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => {
                            setVerifications(prev => ({
                              ...prev,
                              [item.id]: { ...v, kondisi: 'baik', catatan: '' }
                            }))
                          }}
                          className={`px-2 py-1 rounded-lg text-[8px] font-bold uppercase tracking-wider border transition-all cursor-pointer ${
                            !isJelek
                              ? 'bg-green-50 text-green-700 border-green-200'
                              : 'bg-white border-[#d9c2b2]/30 text-[#544437]/60 hover:bg-[#fff8f1]/50'
                          }`}
                        >
                          ✓ Baik
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setVerifications(prev => ({
                              ...prev,
                              [item.id]: { ...v, kondisi: 'jelek' }
                            }))
                          }}
                          className={`px-2 py-1 rounded-lg text-[8px] font-bold uppercase tracking-wider border transition-all cursor-pointer ${
                            isJelek
                              ? 'bg-red-50 text-red-700 border-red-200'
                              : 'bg-white border-[#d9c2b2]/30 text-[#544437]/60 hover:bg-[#fff8f1]/50'
                          }`}
                        >
                          ✗ Jelek
                        </button>
                      </div>
                    </div>

                    <div className="flex items-center gap-6 bg-[#fff8f1]/50 p-3 rounded-xl border border-[#d9c2b2]/25 shadow-inner text-xs">
                      <div className="flex-1">
                        <p className="text-[9px] text-[#544437]/60 font-bold uppercase tracking-wider mb-1">Qty Kirim</p>
                        <p className="font-extrabold text-[#701604]">
                          {item.qty_dikirim} <span className="text-[10px] font-semibold text-[#544437]/75">{item.bahan_baku?.satuan}</span>
                        </p>
                      </div>
                      <span className="text-[#544437]/30 text-base font-bold">→</span>
                      <div className="flex items-center gap-2">
                        <p className="text-[9px] text-[#544437]/60 font-bold uppercase tracking-wider shrink-0 mr-1">Qty Terima</p>
                        <input
                          type="number"
                          min={0}
                          max={item.qty_dikirim}
                          value={v.qty_terima}
                          onChange={(e) => {
                            const val = parseInt(e.target.value) || 0
                            setVerifications(prev => ({
                              ...prev,
                              [item.id]: {
                                ...v,
                                qty_terima: val,
                                kondisi: val < item.qty_dikirim ? 'jelek' : v.kondisi
                              }
                            }))
                          }}
                          className={`border-2 rounded-xl px-2 py-1 text-xs font-extrabold text-center w-16 bg-white focus:outline-none focus:ring-1 focus:ring-[#f29744] transition-all ${
                            isJelek || v.qty_terima < item.qty_dikirim ? 'border-[#ba1a1a]' : 'border-[#0a7d2c]'
                          }`}
                        />
                        <span className="text-xs font-bold text-[#544437]/70">{item.bahan_baku?.satuan}</span>
                      </div>
                    </div>

                    {/* Problem Notes (Required if Jelek or Qty received < Qty shipped) */}
                    {(isJelek || v.qty_terima < item.qty_dikirim) && (
                      <div className="space-y-1">
                        <label className="text-[8px] font-bold text-[#ba1a1a] block uppercase tracking-wider pl-1">
                          Catatan Masalah / Alasan Selisih (Wajib)
                        </label>
                        <textarea
                          value={v.catatan}
                          onChange={(e) => {
                            setVerifications(prev => ({
                              ...prev,
                              [item.id]: { ...v, catatan: e.target.value }
                            }))
                          }}
                          placeholder="Sebutkan alasan (misal: 2 kg busuk, kemasan robek, pecah di jalan, dll)"
                          rows={2}
                          className="w-full border border-red-200 rounded-xl px-3 py-2 text-xs bg-red-50 focus:outline-none focus:ring-1 focus:ring-red-400 resize-none font-medium text-[#ba1a1a] min-h-[50px]"
                        />
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>

          {/* Warehouse signatures block from Pusat */}
          <div className="border-t border-[#d9c2b2]/20 pt-5">
            <SignatureBlock title="TTD Pengirim (Pusat)" sigs={data.signatures || []} />
          </div>

          {/* Verification finalize action button */}
          <div className="border-t border-[#d9c2b2]/20 pt-5">
            <button
              onClick={handleNextStep}
              className="w-full py-3 bg-[#f29744] hover:bg-orange-600 active:bg-orange-700 text-white font-bold uppercase tracking-wider text-xs shadow-md rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5 active:scale-95"
            >
              Lanjut ke Tanda Tangan →
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
