'use client'

import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createSupabaseBrowserClient } from '@suka/auth'
import { useSuratJalanDetail } from '@/hooks/useSuratJalanDetail'
import { ReceiptSignatureStep } from './ReceiptSignatureStep'

type Kondisi = 'baik' | 'jelek'

type ItemVerification = {
  qty_terima: number | ''
  kondisi: Kondisi
  catatan: string
  foto_path: string | null
  foto_preview: string | null
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
  const [kondisiConfirmed, setKondisiConfirmed] = useState(false)

  const items = useMemo(() => {
    if (!data?.surat_jalan_item) return [];
    return data.surat_jalan_item.map((item: any) => {
      const b = item.bahan_baku;
      let factor = 1;
      if (b && b.satuan_distribusi && b.satuan_distribusi !== b.satuan) {
        const dist = b.satuan_distribusi.toLowerCase();
        if (dist === b.satuan_tengah?.toLowerCase() && b.faktor_tengah) factor = b.faktor_tengah;
        else if (dist === b.satuan_kecil?.toLowerCase() && b.faktor_tampilan) factor = b.faktor_tampilan;
        else if (dist === 'kg' && b.satuan_kecil?.toLowerCase() === 'gram' && b.faktor_tampilan) factor = b.faktor_tampilan / 1000;
      }
      return {
        ...item,
        qty_dikirim_dist: Math.round(item.qty_dikirim * factor),
        satuan_dist: b?.satuan_distribusi || b?.satuan,
        factor,
      }
    })
  }, [data])

  // Initialize verifications when data is loaded
  useEffect(() => {
    if (data?.surat_jalan_item) {
      const initial: Record<string, ItemVerification> = {}
      data.surat_jalan_item.forEach((item: any) => {
        initial[item.id] = {
          qty_terima: '', // Wajib input manual
          kondisi: 'baik',
          catatan: '',
          foto_path: null,
          foto_preview: null,
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

  const currentItem = items[currentIndex]
  const currentVerif: ItemVerification = verifications[currentItem?.id] ?? {
    qty_terima: '', // Wajib input manual
    kondisi: 'baik',
    catatan: '',
    foto_path: null,
    foto_preview: null,
  }
  const progress = items.length > 0 ? Math.round(((currentIndex + 1) / items.length) * 100) : 0
  const isJelekMode = currentVerif.kondisi === 'jelek'

  const setVerif = (patch: Partial<ItemVerification>) => {
    setVerifications((prev) => ({
      ...prev,
      [currentItem.id]: { ...currentVerif, ...patch },
    }))
  }

  const handleBaik = () => {
    if (currentVerif.qty_terima === '' || currentVerif.qty_terima === 0) {
      alert('Harap isi jumlah fisik (Qty Terima) terlebih dahulu')
      return
    }
    if (currentVerif.qty_terima < 0) {
      alert('Qty terima tidak boleh kurang dari 0')
      return
    }
    if (currentVerif.qty_terima > currentItem.qty_dikirim_dist) {
      alert('Qty terima tidak boleh melebihi qty dikirim')
      return
    }
    setVerifications((prev) => ({
      ...prev,
      [currentItem.id]: { ...currentVerif, kondisi: 'baik', catatan: '' },
    }))
    setKondisiConfirmed(true)
  }

  const handleJelekConfirm = () => {
    if (currentVerif.qty_terima === '') {
      alert('Harap isi jumlah fisik (Qty Terima) terlebih dahulu')
      return
    }
    if (currentVerif.qty_terima < 0) {
      alert('Qty terima tidak boleh kurang dari 0')
      return
    }
    if (currentVerif.qty_terima > currentItem.qty_dikirim_dist) {
      alert('Qty terima tidak boleh melebihi qty dikirim')
      return
    }
    if (!currentVerif.catatan.trim()) {
      alert('Wajib isi catatan alasan untuk item bermasalah')
      return
    }
    setKondisiConfirmed(true)
  }

  const handleAdvance = () => {
    if (!currentVerif.foto_path) {
      alert('Foto wajib diambil sebelum lanjut ke item berikutnya')
      return
    }
    setKondisiConfirmed(false)
    if (currentIndex + 1 >= items.length) {
      setStep('summary')
    } else {
      setCurrentIndex((i) => i + 1)
    }
  }

  const compressImage = (file: File, maxBytes: number): Promise<Blob> => {
    return new Promise((resolve, reject) => {
      const img = new Image()
      const url = URL.createObjectURL(file)
      img.onload = () => {
        URL.revokeObjectURL(url)
        let quality = 0.85
        const canvas = document.createElement('canvas')
        const MAX_DIM = 1280
        let { width, height } = img
        if (width > MAX_DIM || height > MAX_DIM) {
          const ratio = Math.min(MAX_DIM / width, MAX_DIM / height)
          width = Math.round(width * ratio)
          height = Math.round(height * ratio)
        }
        canvas.width = width
        canvas.height = height
        canvas.getContext('2d')!.drawImage(img, 0, 0, width, height)
        const tryCompress = () => {
          canvas.toBlob((blob) => {
            if (!blob) return reject(new Error('Gagal kompres foto'))
            if (blob.size <= maxBytes || quality <= 0.2) return resolve(blob)
            quality -= 0.1
            tryCompress()
          }, 'image/jpeg', quality)
        }
        tryCompress()
      }
      img.onerror = reject
      img.src = url
    })
  }

  const handleFotoCapture = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      const compressed = await compressImage(file, 200 * 1024)
      const supabase = createSupabaseBrowserClient()
      const path = `${id}/${currentItem.id}.jpg`
      const { error: uploadError } = await supabase.storage
        .from('verif-foto-bahan')
        .upload(path, compressed, { upsert: true, contentType: 'image/jpeg' })
      if (uploadError) throw uploadError
      const preview = URL.createObjectURL(compressed)
      setVerif({ foto_path: path, foto_preview: preview })
    } catch (err) {
      alert(`Gagal upload foto: ${err instanceof Error ? err.message : 'Error'}`)
    }
  }

  const handleSubmit = async () => {
    setSubmitting(true)
    const supabase = createSupabaseBrowserClient()
    try {
      const updatePromises = items.map((item: any) => {
        const v = verifications[item.id] ?? { qty_terima: item.qty_dikirim_dist, kondisi: 'baik' as const, catatan: '', foto_path: null, foto_preview: null }
        const qty_terima_base = typeof v.qty_terima === 'number' ? (v.qty_terima / item.factor) : item.qty_dikirim
        return supabase
          .from('surat_jalan_item')
          .update({
            qty_terima: qty_terima_base,
            kondisi: v.kondisi === 'jelek' ? 'rusak' : 'baik',
            catatan: v.catatan || null,
            flagged: qty_terima_base !== item.qty_dikirim || v.kondisi === 'jelek',
            foto_path: v.foto_path || null,
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
        initialSignatures={data?.receipt_signatures || []}
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
        <header className="sticky top-0 z-40 bg-[#fff8f1] border-b border-[#d9c2b2]/30 px-3 sm:px-4 py-3 flex items-center gap-2 sm:gap-3 shadow-[0_2px_8px_rgba(144,77,0,0.03)] min-w-0">
          <button
            onClick={() => { setCurrentIndex(items.length - 1); setStep('cards') }}
            className="w-8 h-8 sm:w-9 sm:h-9 flex items-center justify-center rounded-full bg-white border border-[#d9c2b2]/30 text-[#f29744] hover:bg-orange-50 active:scale-95 transition-all shadow-sm shrink-0"
            title="Kembali ke item terakhir"
          >
            <span className="text-base">←</span>
          </button>
          <div className="flex flex-col min-w-0">
            <h1 className="font-bold text-xs sm:text-sm text-[#701604] uppercase tracking-tight leading-tight truncate">Ringkasan Verifikasi</h1>
            <p className="text-[9px] sm:text-[10px] text-[#544437]/75 font-bold mt-0.5 truncate">{items.length} item selesai dikonfirmasi</p>
          </div>
        </header>

        <div className="p-4 max-w-2xl mx-auto space-y-4 mt-2">
          <div className="bg-white rounded-2xl border border-[#d9c2b2]/45 divide-y divide-[#d9c2b2]/20 shadow-[0px_4px_12px_rgba(144,77,0,0.03)] overflow-hidden">
            {items.map((item: any) => {
              const v = verifications[item.id]
              const isJelek = v?.kondisi === 'jelek'
              return (
                <div key={item.id} className="px-4 py-3 flex items-center gap-3">
                  {v?.foto_preview ? (
                    <img src={v.foto_preview} alt={item.bahan_baku?.nama} className="w-12 h-12 rounded-lg object-cover shrink-0 border border-[#d9c2b2]/30" />
                  ) : (
                    <div className="w-12 h-12 rounded-lg bg-[#faf2e9] border border-[#d9c2b2]/30 flex items-center justify-center shrink-0 text-lg">📷</div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-bold text-[#1e1b15] uppercase tracking-wide truncate">{item.bahan_baku?.nama}</p>
                    {isJelek && v?.catatan && (
                      <p className="text-[10px] text-[#ba1a1a] mt-0.5 font-semibold truncate">{v.catatan}</p>
                    )}
                  </div>
                  <span className={`shrink-0 text-[10px] px-2.5 py-1 rounded-full font-bold uppercase tracking-wide border ${
                    isJelek ? 'bg-[#ffdad6] text-[#ba1a1a] border-[#ba1a1a]/20' : 'bg-green-50 text-green-700 border-green-200'
                  }`}>
                    {isJelek
                      ? `Jelek · ${v?.qty_terima}/${item.qty_dikirim_dist} ${item.satuan_dist}`
                      : `Baik · ${v?.qty_terima} ${item.satuan_dist}`}
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
      <header className="sticky top-0 z-40 bg-[#fff8f1] border-b border-[#d9c2b2]/30 px-3 sm:px-4 py-3 flex justify-between items-center shadow-[0_2px_8px_rgba(144,77,0,0.03)]">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <Link href="/distribusi/terima" className="w-8 h-8 sm:w-9 sm:h-9 flex items-center justify-center rounded-full bg-white border border-[#d9c2b2]/30 text-[#f29744] hover:bg-orange-50 active:scale-95 transition-all shadow-sm shrink-0" title="Kembali ke Inbox">
            <span className="text-base">←</span>
          </Link>
          <div className="flex flex-col min-w-0">
            <h1 className="font-bold text-xs sm:text-sm text-[#701604] uppercase tracking-tight leading-tight truncate">Verifikasi Penerimaan</h1>
            <p className="text-[9px] sm:text-[10px] text-[#544437]/75 font-bold mt-0.5 truncate max-w-[170px] sm:max-w-none">
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
                {currentItem?.qty_dikirim_dist} <span className="text-[10px] font-semibold text-[#544437]/75">{currentItem?.satuan_dist}</span>
              </p>
            </div>
            <span className="text-[#544437]/30 text-xl font-bold">→</span>
            <div>
              <p className="text-[9px] text-[#544437]/60 font-bold uppercase tracking-wider mb-1">Qty Terima</p>
              <div className="flex items-center gap-1.5">
                <input
                  type="number"
                  step="0.01"
                  min={0}
                  max={currentItem?.qty_dikirim_dist}
                  value={currentVerif.qty_terima}
                  onChange={(e) => {
                    const val = e.target.value === '' ? '' : parseFloat(e.target.value) || 0
                    setVerif({ qty_terima: val, kondisi: typeof val === 'number' && val < (currentItem?.qty_dikirim_dist ?? 0) ? 'jelek' : currentVerif.kondisi })
                  }}
                  className={`border-2 rounded-xl px-2 py-1.5 text-lg font-extrabold text-center w-20 bg-white focus:outline-none focus:ring-1 focus:ring-[#f29744] transition-all ${
                    isJelekMode || (typeof currentVerif.qty_terima === 'number' && currentVerif.qty_terima < (currentItem?.qty_dikirim_dist ?? 0)) ? 'border-[#ba1a1a]' : 'border-[#0a7d2c]'
                  }`}
                />
                <span className="text-xs font-bold text-[#544437]/70">{currentItem?.satuan_dist}</span>
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

        {/* Action buttons — kondisi belum dikunci */}
        {!kondisiConfirmed && (
          <>
            {!isJelekMode ? (
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={handleBaik}
                  className="bg-[#0a7d2c] hover:bg-green-700 active:bg-green-800 text-white rounded-xl py-3 font-bold text-xs uppercase tracking-wider shadow-md transition-all cursor-pointer active:scale-95 flex items-center justify-center gap-1.5"
                >
                  ✓ Baik
                </button>
                <button
                  onClick={() => {
                    if (currentVerif.qty_terima === '') {
                      alert('Harap isi jumlah fisik (Qty Terima) terlebih dahulu')
                      return
                    }
                    setVerif({ kondisi: 'jelek' })
                  }}
                  className="border-2 border-[#ba1a1a]/60 text-[#ba1a1a] rounded-xl py-3 font-bold text-xs uppercase tracking-wider hover:bg-red-50 transition-all cursor-pointer active:scale-95 flex items-center justify-center gap-1.5"
                >
                  ✗ Jelek
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => setVerif({ kondisi: 'baik', catatan: '' })}
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
          </>
        )}

        {/* Section foto inline — muncul setelah kondisi dikonfirmasi */}
        {kondisiConfirmed && (
          <div className="space-y-3">
            <div className={`flex items-center justify-between px-4 py-2.5 rounded-xl border ${
              currentVerif.kondisi === 'jelek'
                ? 'bg-[#ffdad6]/60 border-[#ba1a1a]/20 text-[#ba1a1a]'
                : 'bg-green-50 border-green-200 text-green-700'
            }`}>
              <span className="text-xs font-bold uppercase tracking-wide">
                {currentVerif.kondisi === 'jelek'
                  ? `✗ Jelek · ${currentVerif.qty_terima}/${currentItem?.qty_dikirim_dist} ${currentItem?.satuan_dist}`
                  : `✓ Baik · ${currentVerif.qty_terima} ${currentItem?.satuan_dist}`}
              </span>
              <button
                onClick={() => setKondisiConfirmed(false)}
                className="text-[10px] font-bold underline opacity-70 cursor-pointer"
              >
                Ubah
              </button>
            </div>

            {currentVerif.foto_preview && (
              <div className="rounded-xl overflow-hidden border border-[#d9c2b2]/30">
                <img src={currentVerif.foto_preview} alt="Foto barang" className="w-full object-cover max-h-52" />
              </div>
            )}

            <label className="block w-full cursor-pointer">
              <input
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={handleFotoCapture}
              />
              <div className={`w-full py-3 font-bold uppercase tracking-wider text-xs rounded-xl transition-all flex items-center justify-center gap-1.5 active:scale-95 shadow-md ${
                currentVerif.foto_path
                  ? 'bg-white border border-[#d9c2b2]/45 text-[#544437]'
                  : 'bg-[#f29744] text-white'
              }`}>
                {currentVerif.foto_path ? '🔄 Ambil Ulang Foto' : '📷 Foto Barang Sekarang'}
              </div>
            </label>

            <button
              onClick={handleAdvance}
              disabled={!currentVerif.foto_path}
              className={`w-full py-3 font-bold uppercase tracking-wider text-xs rounded-xl transition-all flex items-center justify-center gap-1.5 active:scale-95 ${
                currentVerif.foto_path
                  ? 'bg-[#701604] hover:bg-[#591002] text-white shadow-md cursor-pointer'
                  : 'bg-[#d9c2b2]/30 text-[#544437]/40 cursor-not-allowed'
              }`}
            >
              {currentIndex + 1 >= items.length ? 'Lihat Ringkasan →' : 'Item Berikutnya →'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
