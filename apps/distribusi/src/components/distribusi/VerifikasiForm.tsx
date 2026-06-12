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

type Step = 'cards' | 'summary' | 'signature'

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
  const [currentIndex, setCurrentIndex] = useState(0)
  const [step, setStep] = useState<Step>('cards')
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
  const currentItem = items[currentIndex]
  const currentVerif: ItemVerification = verifications[currentItem?.id] ?? {
    qty_terima: currentItem?.qty_dikirim ?? 0,
    kondisi: 'baik',
    catatan: '',
  }
  const progress = items.length > 0 ? Math.round(((currentIndex + 1) / items.length) * 100) : 0
  const isJelekMode = currentVerif.kondisi === 'jelek'

  const setVerif = (patch: Partial<ItemVerification>) => {
    setVerifications((prev) => ({
      ...prev,
      [currentItem.id]: { ...currentVerif, ...patch },
    }))
  }

  const advance = (v: ItemVerification) => {
    setVerifications((prev) => ({ ...prev, [currentItem.id]: v }))
    if (currentIndex + 1 >= items.length) {
      setStep('summary')
    } else {
      setCurrentIndex((i) => i + 1)
    }
  }

  const handleBaik = () => {
    advance({ qty_terima: currentItem.qty_dikirim, kondisi: 'baik', catatan: '' })
  }

  const handleJelekConfirm = () => {
    if (currentVerif.qty_terima > currentItem.qty_dikirim) {
      alert('Qty terima tidak boleh melebihi qty dikirim')
      return
    }
    if (!currentVerif.catatan.trim()) {
      alert('Wajib isi catatan alasan untuk item bermasalah')
      return
    }
    advance(currentVerif)
  }

  const handleSubmit = async () => {
    setSubmitting(true)
    const supabase = createClient()
    try {
      const updatePromises = items.map((item: any) => {
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

  // ── Step: Signature ───────────────────────────────────────────────
  if (step === 'signature') {
    return (
      <ReceiptSignatureStep
        suratJalanId={id}
        submitting={submitting}
        onFinalize={handleSubmit}
        onBack={() => setStep('summary')}
      />
    )
  }

  // ── Step: Summary ─────────────────────────────────────────────────
  if (step === 'summary') {
    const jelekCount = items.filter((it: any) => verifications[it.id]?.kondisi === 'jelek').length
    return (
      <div className="min-h-screen bg-[#fff8f1] text-[#1e1b15] pb-24">
        <header className="sticky top-0 z-40 bg-[#fff8f1] border-b border-[#d9c2b2]/30 px-4 py-4 flex items-center gap-3 shadow-[0_2px_8px_rgba(144,77,0,0.03)]">
          <button
            onClick={() => { setCurrentIndex(items.length - 1); setStep('cards') }}
            className="w-9 h-9 flex items-center justify-center rounded-full bg-white border border-[#d9c2b2]/30 text-[#f29744] hover:bg-orange-50 active:scale-95 transition-all shadow-sm"
            title="Kembali ke item terakhir"
          >
            <span className="text-base">←</span>
          </button>
          <div className="flex flex-col">
            <h1 className="font-bold text-sm text-[#701604] uppercase tracking-tight leading-tight">Ringkasan Verifikasi</h1>
            <p className="text-[10px] text-[#544437]/75 font-bold mt-0.5">{items.length} item selesai dikonfirmasi</p>
          </div>
        </header>

        <div className="p-4 max-w-2xl mx-auto space-y-4 mt-2">
          <div className="bg-white rounded-2xl border border-[#d9c2b2]/45 divide-y divide-[#d9c2b2]/20 shadow-[0px_4px_12px_rgba(144,77,0,0.03)] overflow-hidden">
            {items.map((item: any) => {
              const v = verifications[item.id]
              const isJelek = v?.kondisi === 'jelek'
              return (
                <div key={item.id} className="px-4 py-3 flex justify-between items-center gap-3">
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-[#1e1b15] uppercase tracking-wide truncate">{item.bahan_baku?.nama}</p>
                    {isJelek && v?.catatan && (
                      <p className="text-[10px] text-[#ba1a1a] mt-0.5 font-semibold truncate">{v.catatan}</p>
                    )}
                  </div>
                  <span className={`shrink-0 text-[10px] px-2.5 py-1 rounded-full font-bold uppercase tracking-wide border ${
                    isJelek ? 'bg-[#ffdad6] text-[#ba1a1a] border-[#ba1a1a]/20' : 'bg-green-50 text-green-700 border-green-200'
                  }`}>
                    {isJelek
                      ? `Jelek · ${v?.qty_terima}/${item.qty_dikirim} ${item.bahan_baku?.satuan}`
                      : `Baik · ${v?.qty_terima} ${item.bahan_baku?.satuan}`}
                  </span>
                </div>
              )
            })}
          </div>

          {jelekCount > 0 && (
            <div className="p-3 bg-[#ffdad6]/60 border border-[#ba1a1a]/20 rounded-xl text-[#ba1a1a] text-xs font-bold flex items-center gap-2">
              <span>⚠️</span>
              <span>{jelekCount} item bermasalah — alasan tercatat di catatan</span>
            </div>
          )}

          <SignatureBlock title="TTD Pengirim (Pusat)" sigs={data.signatures || []} />

          <button
            onClick={() => setStep('signature')}
            className="w-full py-3 bg-[#f29744] hover:bg-orange-600 active:bg-orange-700 text-white font-bold uppercase tracking-wider text-xs shadow-md rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5 active:scale-95"
          >
            Lanjut ke Tanda Tangan →
          </button>
        </div>
      </div>
    )
  }

  // ── Step: Cards (satu item per layar) ─────────────────────────────
  return (
    <div className="min-h-screen bg-[#fff8f1] text-[#1e1b15] pb-12">
      <header className="sticky top-0 z-40 bg-[#fff8f1] border-b border-[#d9c2b2]/30 px-4 py-4 flex justify-between items-center shadow-[0_2px_8px_rgba(144,77,0,0.03)]">
        <div className="flex items-center gap-3">
          <Link href="/distribusi/terima" className="w-9 h-9 flex items-center justify-center rounded-full bg-white border border-[#d9c2b2]/30 text-[#f29744] hover:bg-orange-50 active:scale-95 transition-all shadow-sm" title="Kembali ke Inbox">
            <span className="text-base">←</span>
          </Link>
          <div className="flex flex-col">
            <h1 className="font-bold text-sm text-[#701604] uppercase tracking-tight leading-tight">Verifikasi Penerimaan</h1>
            <p className="text-[10px] text-[#544437]/75 font-bold mt-0.5">
              No. {data.document_number || id.substring(0, 8).toUpperCase()} &bull; {data.outlets?.name?.replace('SUKA SHAWARMA ', '') || ''}
            </p>
          </div>
        </div>
        <span className="text-xs font-black text-[#701604] bg-[#faf2e9] border border-[#d9c2b2]/40 px-3 py-1 rounded-full shrink-0">
          {currentIndex + 1} / {items.length}
        </span>
      </header>

      <div className="p-4 max-w-lg mx-auto mt-2">
        {/* Progress bar */}
        <div className="w-full bg-[#d9c2b2]/25 rounded-full h-1.5 mb-6 overflow-hidden">
          <div className="bg-[#f29744] h-1.5 rounded-full transition-all duration-300" style={{ width: `${progress}%` }} />
        </div>

        {/* Item card */}
        <div className="bg-white rounded-2xl border border-[#d9c2b2]/45 p-5 mb-6 shadow-[0px_4px_12px_rgba(144,77,0,0.03)]">
          <span className="text-[8px] text-[#f29744] font-black uppercase tracking-widest mb-1 bg-orange-50 border border-orange-100 px-2 py-0.5 rounded-md inline-block">
            Kategori: {currentItem?.bahan_baku?.kategori || 'BAHAN BAKU'}
          </span>
          <h2 className="text-xl font-extrabold text-[#1e1b15] uppercase tracking-tight mb-5 mt-1">{currentItem?.bahan_baku?.nama}</h2>

          <div className="flex items-center gap-4 bg-[#fff8f1]/50 p-4 rounded-xl border border-[#d9c2b2]/25 shadow-inner mb-1">
            <div className="flex-1">
              <p className="text-[9px] text-[#544437]/60 font-bold uppercase tracking-wider mb-1">Qty Kirim</p>
              <p className="text-lg font-extrabold text-[#701604]">
                {currentItem?.qty_dikirim} <span className="text-[10px] font-semibold text-[#544437]/75">{currentItem?.bahan_baku?.satuan}</span>
              </p>
            </div>
            <span className="text-[#544437]/30 text-xl font-bold">→</span>
            <div>
              <p className="text-[9px] text-[#544437]/60 font-bold uppercase tracking-wider mb-1">Qty Terima</p>
              <div className="flex items-center gap-1.5">
                <input
                  type="number"
                  min={0}
                  max={currentItem?.qty_dikirim}
                  value={currentVerif.qty_terima}
                  onChange={(e) => {
                    const val = parseInt(e.target.value) || 0
                    setVerif({ qty_terima: val, kondisi: val < (currentItem?.qty_dikirim ?? 0) ? 'jelek' : currentVerif.kondisi })
                  }}
                  className={`border-2 rounded-xl px-2 py-1.5 text-lg font-extrabold text-center w-20 bg-white focus:outline-none focus:ring-1 focus:ring-[#f29744] transition-all ${
                    isJelekMode || currentVerif.qty_terima < (currentItem?.qty_dikirim ?? 0) ? 'border-[#ba1a1a]' : 'border-[#0a7d2c]'
                  }`}
                />
                <span className="text-xs font-bold text-[#544437]/70">{currentItem?.bahan_baku?.satuan}</span>
              </div>
            </div>
          </div>

          {isJelekMode && (
            <div className="mt-4 space-y-1">
              <label className="text-[8px] font-bold text-[#ba1a1a] block uppercase tracking-wider pl-1">
                Catatan Masalah / Alasan Selisih (Wajib)
              </label>
              <textarea
                value={currentVerif.catatan}
                onChange={(e) => setVerif({ catatan: e.target.value })}
                placeholder="Sebutkan alasan (misal: 2 kg busuk, kemasan robek, pecah di jalan, dll)"
                rows={2}
                className="w-full border border-red-200 rounded-xl px-3 py-2 text-xs bg-red-50 focus:outline-none focus:ring-1 focus:ring-red-400 resize-none font-medium text-[#ba1a1a] min-h-[50px]"
              />
            </div>
          )}
        </div>

        {/* Action buttons */}
        {!isJelekMode ? (
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={handleBaik}
              className="bg-[#0a7d2c] hover:bg-green-700 active:bg-green-800 text-white rounded-xl py-3 font-bold text-xs uppercase tracking-wider shadow-md transition-all cursor-pointer active:scale-95 flex items-center justify-center gap-1.5"
            >
              ✓ Baik
            </button>
            <button
              onClick={() => setVerif({ kondisi: 'jelek', qty_terima: currentItem?.qty_dikirim ?? 0 })}
              className="border-2 border-[#ba1a1a]/60 text-[#ba1a1a] rounded-xl py-3 font-bold text-xs uppercase tracking-wider hover:bg-red-50 transition-all cursor-pointer active:scale-95 flex items-center justify-center gap-1.5"
            >
              ✗ Jelek
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => setVerif({ kondisi: 'baik', qty_terima: currentItem?.qty_dikirim ?? 0, catatan: '' })}
              className="border border-[#d9c2b2]/45 text-[#544437] bg-white rounded-xl py-3 font-bold text-xs uppercase tracking-wider hover:bg-[#faf2e9] transition-all cursor-pointer active:scale-95"
            >
              ← Batalkan
            </button>
            <button
              onClick={handleJelekConfirm}
              className="bg-[#ba1a1a] hover:bg-[#931313] active:bg-[#7a0f0f] text-white rounded-xl py-3 font-bold text-xs uppercase tracking-wider shadow-md transition-all cursor-pointer active:scale-95"
            >
              Konfirmasi Jelek →
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
