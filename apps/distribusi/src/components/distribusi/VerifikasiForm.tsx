'use client'

import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createSupabaseBrowserClient } from '@suka/auth'
import { useSuratJalanDetail } from '@/hooks/useSuratJalanDetail'
import { ReceiptSignatureStep } from './ReceiptSignatureStep'
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  AlertTriangle,
  Camera,
  Lock,
  QrCode,
  RefreshCw,
  Check
} from 'lucide-react'
import { toast } from 'sonner'

type Kondisi = 'baik' | 'tidak_sesuai'

type ItemVerification = {
  qty_terima: number | ''
  kondisi: Kondisi
  catatan: string
  foto_path: string | null
  foto_preview: string | null
}

type Step = 'cards' | 'summary' | 'signature'

type StoredDraft = {
  verifications: Record<
    string,
    {
      qty_terima: number | ''
      kondisi: Kondisi
      catatan: string
      foto_path: string | null
    }
  >
  currentIndex: number
  step: Step
  kondisiConfirmed: boolean
  updatedAt: number
}

function SignatureBlock({ title, sigs }: { title: string; sigs: any[] }) {
  return (
    <div className="bg-white/80 border border-suka-orange/15 rounded-2xl p-4 shadow-sm space-y-3">
      <div className="flex justify-between items-center border-b border-suka-brown/10 pb-2">
        <p className="text-[10px] font-black text-suka-brown uppercase tracking-wider leading-none">
          {title}
        </p>
        <span className="text-[9px] font-extrabold text-suka-orange bg-suka-orange/10 px-2 py-0.5 rounded-full">
          {sigs.length} TTD
        </span>
      </div>

      {sigs.length === 0 ? (
        <p className="text-[10px] text-suka-gray-400 font-bold italic py-2 text-center">
          Belum ada tanda tangan terverifikasi
        </p>
      ) : (
        <div className="space-y-2.5">
          {sigs.map((s, i) => (
            <div key={i} className="flex items-center gap-3 p-2 bg-[#fff8f1]/60 rounded-xl border border-suka-brown/5">
              {s.signature_image && (
                <img
                  src={s.signature_image}
                  alt={s.role}
                  className="h-10 w-16 bg-white border border-suka-brown/15 rounded-lg p-1 object-contain shrink-0 shadow-xs"
                />
              )}
              <div className="min-w-0 flex-1">
                <p className="text-xs font-extrabold text-suka-ink uppercase tracking-wide truncate">
                  {s.signed_by}
                </p>
                <p className="text-[10px] text-suka-gray-500 font-semibold mt-0.5 truncate">
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
  const [uploadingFoto, setUploadingFoto] = useState(false)
  const [unlocked, setUnlocked] = useState(false)
  const [kondisiConfirmed, setKondisiConfirmed] = useState(false)
  const [isHydrated, setIsHydrated] = useState(false)

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

  // Hydrate verifications: restore draft dari localStorage
  useEffect(() => {
    if (items.length === 0) return
    let cancelled = false
    const supabase = createSupabaseBrowserClient()

    const hydrate = async () => {
      let draft: StoredDraft | null = null
      if (typeof window !== 'undefined') {
        try {
          const raw = localStorage.getItem(`verification_draft_${id}`)
          if (raw) draft = JSON.parse(raw)
        } catch (e) {
          console.warn('Gagal membaca draft verifikasi dari localStorage', e)
        }
      }

      const entries = await Promise.all(
        items.map(async (item: any) => {
          const draftItem = draft?.verifications?.[item.id]

          if (draftItem) {
            let foto_preview: string | null = null
            if (draftItem.foto_path) {
              const { data: blob } = await supabase.storage.from('verif-foto-bahan').download(draftItem.foto_path)
              if (blob) foto_preview = URL.createObjectURL(blob)
            }
            return [
              item.id,
              {
                qty_terima: draftItem.qty_terima,
                kondisi: ((draftItem.kondisi as any) === 'jelek' || draftItem.kondisi === 'tidak_sesuai' ? 'tidak_sesuai' : 'baik') as Kondisi,
                catatan: draftItem.catatan || '',
                foto_path: draftItem.foto_path || null,
                foto_preview,
              },
            ] as const
          }

          if (!item.verified_at) {
            return [item.id, { qty_terima: '', kondisi: 'baik' as const, catatan: '', foto_path: null, foto_preview: null }] as const
          }
          let foto_preview: string | null = null
          if (item.foto_path) {
            const { data: blob } = await supabase.storage.from('verif-foto-bahan').download(item.foto_path)
            if (blob) foto_preview = URL.createObjectURL(blob)
          }
          const qty_terima = typeof item.qty_terima === 'number' ? Math.round(item.qty_terima * item.factor * 1000) / 1000 : ''
          return [item.id, {
            qty_terima,
            kondisi: (item.kondisi === 'rusak' ? 'tidak_sesuai' : 'baik') as Kondisi,
            catatan: item.catatan || '',
            foto_path: item.foto_path || null,
            foto_preview,
          }] as const
        })
      )
      if (cancelled) return
      setVerifications(Object.fromEntries(entries))

      if (draft) {
        if (typeof draft.currentIndex === 'number' && draft.currentIndex >= 0 && draft.currentIndex < items.length) {
          setCurrentIndex(draft.currentIndex)
        }
        if (draft.step) {
          setStep(draft.step)
        }
        if (typeof draft.kondisiConfirmed === 'boolean') {
          setKondisiConfirmed(draft.kondisiConfirmed)
        }
      }

      setIsHydrated(true)
    }

    hydrate()
    return () => { cancelled = true }
  }, [items, id])

  // Cek status unlock QR dari localStorage maupun sessionStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const isUnlocked =
        localStorage.getItem(`unlocked_verification_${id}`) === 'true' ||
        sessionStorage.getItem(`unlocked_verification_${id}`) === 'true'
      setUnlocked(isUnlocked)
    }
  }, [id])

  // Auto-save draft ke localStorage
  useEffect(() => {
    if (!isHydrated || items.length === 0 || typeof window === 'undefined') return
    try {
      const storableVerifs: Record<string, any> = {}
      Object.entries(verifications).forEach(([k, v]) => {
        storableVerifs[k] = {
          qty_terima: v.qty_terima,
          kondisi: v.kondisi,
          catatan: v.catatan,
          foto_path: v.foto_path,
        }
      })
      const draft: StoredDraft = {
        verifications: storableVerifs,
        currentIndex,
        step,
        kondisiConfirmed,
        updatedAt: Date.now(),
      }
      localStorage.setItem(`verification_draft_${id}`, JSON.stringify(draft))
    } catch (e) {
      console.warn('Gagal menyimpan draft verifikasi ke localStorage', e)
    }
  }, [verifications, currentIndex, step, kondisiConfirmed, isHydrated, id, items.length])

  if (loading) {
    return (
      <div className="flex flex-col min-h-screen justify-center items-center bg-[#fff8f1] text-suka-brown font-medium bg-grain relative">
        <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-suka-brown mb-4" />
        <p className="text-xs font-black uppercase tracking-wider animate-pulse">Memuat Formulir Verifikasi...</p>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-[#fff8f1] flex items-center justify-center p-4 bg-grain">
        <div className="p-5 text-xs font-bold text-red-700 bg-red-50 border border-red-200 rounded-2xl max-w-md text-center shadow-sm">
          <AlertTriangle size={24} className="mx-auto mb-2 text-red-500" />
          <p>Gagal memuat: {error || 'Data tidak ditemukan'}</p>
        </div>
      </div>
    )
  }

  // QR Code scan validation check
  if (!unlocked) {
    return (
      <div className="min-h-screen bg-[#fff8f1]/50 flex items-center justify-center p-6 bg-grain">
        <div className="bg-white/85 backdrop-blur-md rounded-3xl border border-suka-orange/20 p-6 max-w-sm text-center shadow-xl space-y-4">
          <div className="w-16 h-16 bg-amber-50 border border-amber-200 text-amber-600 rounded-2xl flex items-center justify-center mx-auto shadow-sm">
            <Lock size={30} />
          </div>
          <div className="space-y-1">
            <h2 className="text-sm font-black text-suka-brown uppercase tracking-wide font-display">
              Akses Verifikasi Terkunci
            </h2>
            <p className="text-xs text-suka-gray-600 leading-relaxed font-medium">
              Untuk integritas data, Anda wajib memindai kode QR pada lembar Surat Jalan fisik yang dibawa supir.
            </p>
          </div>
          <div className="pt-2 flex flex-col gap-2">
            <button
              onClick={() => router.push('/distribusi/terima/scan')}
              className="w-full bg-suka-orange hover:bg-orange-600 active:scale-[0.98] text-white rounded-xl py-3 font-extrabold text-xs uppercase tracking-wider shadow-md transition-all cursor-pointer flex items-center justify-center gap-2"
            >
              <QrCode size={16} /> Scan QR Code Sekarang
            </button>
            <button
              onClick={() => router.push('/distribusi/terima')}
              className="w-full border border-suka-brown/20 text-suka-brown hover:bg-suka-gray-50 bg-white rounded-xl py-2.5 font-bold text-xs uppercase tracking-wider transition-all cursor-pointer shadow-xs"
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
      <div className="min-h-screen bg-[#fff8f1]/50 flex items-center justify-center p-6 bg-grain">
        <div className="bg-white/85 backdrop-blur-md rounded-3xl border border-suka-orange/20 p-6 max-w-sm text-center shadow-xl space-y-4">
          <div className="w-14 h-14 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center mx-auto">
            <CheckCircle2 size={32} />
          </div>
          <div className="space-y-1">
            <h3 className="text-sm font-black text-suka-brown uppercase tracking-wide font-display">
              Verifikasi Selesai
            </h3>
            <p className="text-xs text-suka-gray-600 font-medium">
              Surat Jalan ini telah diverifikasi sebelumnya. Anda dapat melihat detailnya di Riwayat.
            </p>
          </div>
          <button
            onClick={() => router.push('/distribusi/riwayat')}
            className="w-full bg-suka-brown hover:bg-suka-ink active:scale-[0.98] text-white rounded-xl py-3 font-extrabold text-xs uppercase tracking-wider shadow-md transition-all cursor-pointer"
          >
            Buka Riwayat
          </button>
        </div>
      </div>
    )
  }

  const currentItem = items[currentIndex]
  const currentVerif: ItemVerification = verifications[currentItem?.id] ?? {
    qty_terima: '',
    kondisi: 'baik',
    catatan: '',
    foto_path: null,
    foto_preview: null,
  }
  const progress = items.length > 0 ? Math.round(((currentIndex + 1) / items.length) * 100) : 0
  const isTidakSesuaiMode = currentVerif.kondisi === 'tidak_sesuai'

  const setVerif = (patch: Partial<ItemVerification>) => {
    setVerifications((prev) => ({
      ...prev,
      [currentItem.id]: { ...currentVerif, ...patch },
    }))
  }

  const handleMatchQty = () => {
    setVerif({
      qty_terima: currentItem.qty_dikirim_dist,
      kondisi: 'baik',
    })
    toast.success(`Qty disesuaikan: ${currentItem.qty_dikirim_dist} ${currentItem.satuan_dist}`)
  }

  const handleBaik = () => {
    if (currentVerif.qty_terima === '' || currentVerif.qty_terima === 0) {
      toast.warning('Harap isi jumlah fisik (Qty Terima) terlebih dahulu')
      return
    }
    if (currentVerif.qty_terima < 0) {
      toast.error('Qty terima tidak boleh kurang dari 0')
      return
    }
    if (currentVerif.qty_terima > currentItem.qty_dikirim_dist) {
      toast.error('Qty terima tidak boleh melebihi qty dikirim')
      return
    }
    setVerifications((prev) => ({
      ...prev,
      [currentItem.id]: { ...currentVerif, kondisi: 'baik', catatan: '' },
    }))
    setKondisiConfirmed(true)
  }

  const handleTidakSesuaiConfirm = () => {
    if (currentVerif.qty_terima === '') {
      toast.warning('Harap isi jumlah fisik (Qty Terima) terlebih dahulu')
      return
    }
    if (currentVerif.qty_terima < 0) {
      toast.error('Qty terima tidak boleh kurang dari 0')
      return
    }
    if (currentVerif.qty_terima > currentItem.qty_dikirim_dist) {
      toast.error('Qty terima tidak boleh melebihi qty dikirim')
      return
    }
    if (!currentVerif.catatan.trim()) {
      toast.warning('Wajib isi catatan alasan untuk item tidak sesuai')
      return
    }
    setKondisiConfirmed(true)
  }

  const handleAdvance = () => {
    if (!currentVerif.foto_path) {
      toast.warning('Foto bukti wajib diambil sebelum lanjut ke item berikutnya')
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
    setUploadingFoto(true)
    try {
      toast.info('Mengompres dan mengunggah foto bukti...')
      const compressed = await compressImage(file, 200 * 1024)
      const supabase = createSupabaseBrowserClient()
      const path = `${id}/${currentItem.id}.jpg`
      const { error: uploadError } = await supabase.storage
        .from('verif-foto-bahan')
        .upload(path, compressed, { upsert: true, contentType: 'image/jpeg' })
      if (uploadError) throw uploadError
      const preview = URL.createObjectURL(compressed)
      setVerif({ foto_path: path, foto_preview: preview })
      toast.success('Foto bukti berhasil disimpan!')
    } catch (err: any) {
      toast.error(`Gagal upload foto: ${err?.message || 'Error'}`)
    } finally {
      setUploadingFoto(false)
      if (e.target) e.target.value = ''
    }
  }

  const handleSubmit = async () => {
    setSubmitting(true)
    const supabase = createSupabaseBrowserClient()
    try {
      toast.info('Menyimpan verifikasi penerimaan...')
      const updatePromises = items.map((item: any) => {
        const v = verifications[item.id] ?? { qty_terima: item.qty_dikirim_dist, kondisi: 'baik' as const, catatan: '', foto_path: null, foto_preview: null }
        const qty_terima_base = typeof v.qty_terima === 'number' ? (v.qty_terima / item.factor) : item.qty_dikirim
        return supabase
          .from('surat_jalan_item')
          .update({
            qty_terima: qty_terima_base,
            kondisi: v.kondisi === 'tidak_sesuai' ? 'rusak' : 'baik',
            catatan: v.catatan || null,
            flagged: qty_terima_base !== item.qty_dikirim || v.kondisi === 'tidak_sesuai',
            foto_path: v.foto_path || null,
            verified_at: new Date().toISOString(),
          })
          .eq('id', item.id)
      })

      const results = await Promise.all(updatePromises)
      const errors = results.filter(({ error: errItem }) => errItem)
      if (errors.length > 0) throw new Error(errors[0].error?.message)

      const { error: rpcError } = await supabase.rpc('finalize_surat_jalan_and_ledger', {
        p_surat_jalan_id: id,
      })
      if (rpcError) throw new Error(rpcError.message)

      // Bersihkan draft dan kunci verifikasi setelah berhasil disimpan
      if (typeof window !== 'undefined') {
        localStorage.removeItem(`verification_draft_${id}`)
        localStorage.removeItem(`unlocked_verification_${id}`)
        sessionStorage.removeItem(`unlocked_verification_${id}`)
      }

      toast.success('Verifikasi Surat Jalan berhasil diselesaikan!')
      router.push('/distribusi/riwayat')
    } catch (err: any) {
      toast.error(`Error: ${err?.message || 'Gagal menyimpan'}`)
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
    const tidakSesuaiCount = items.filter((it: any) => verifications[it.id]?.kondisi === 'tidak_sesuai').length
    return (
      <div className="min-h-screen bg-[#fff8f1]/50 text-[#1e1b15] pb-24 relative overflow-hidden bg-grain select-none">
        <header className="sticky top-0 z-40 bg-white/85 backdrop-blur-md border-b border-suka-brown/10 px-3 sm:px-6 py-3 flex items-center gap-2 sm:gap-3 shadow-sm min-w-0">
          <button
            onClick={() => { setCurrentIndex(items.length - 1); setStep('cards') }}
            className="w-8 h-8 sm:w-9 sm:h-9 flex items-center justify-center rounded-xl bg-white border border-suka-orange/15 text-suka-orange hover:bg-suka-orange/5 active:scale-95 transition-all shadow-sm shrink-0 cursor-pointer"
            title="Kembali ke item terakhir"
          >
            <ArrowLeft size={16} />
          </button>
          <div className="flex flex-col min-w-0">
            <h1 className="font-black text-xs sm:text-sm text-suka-brown uppercase tracking-wider font-display leading-none truncate">
              Ringkasan Verifikasi
            </h1>
            <p className="text-[9px] sm:text-[10px] text-suka-gray-500 font-bold mt-0.5 truncate">
              {items.length} item selesai dikonfirmasi
            </p>
          </div>
        </header>

        <main className="p-4 max-w-2xl mx-auto space-y-4 mt-2 relative z-10">
          <div className="bg-white/85 backdrop-blur-md rounded-2xl border border-suka-orange/10 divide-y divide-suka-orange/10 shadow-sm overflow-hidden">
            {items.map((item: any) => {
              const v = verifications[item.id]
              const isTidakSesuai = v?.kondisi === 'tidak_sesuai'
              return (
                <div key={item.id} className="px-4 py-3 flex items-center gap-3">
                  {v?.foto_preview ? (
                    <img
                      src={v.foto_preview}
                      alt={item.bahan_baku?.nama}
                      className="w-12 h-12 rounded-xl object-cover shrink-0 border border-suka-brown/15 shadow-xs"
                    />
                  ) : (
                    <div className="w-12 h-12 rounded-xl bg-suka-orange/10 border border-suka-orange/20 flex items-center justify-center shrink-0 text-suka-orange">
                      <Camera size={20} />
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-extrabold text-suka-ink uppercase tracking-wide truncate">
                      {item.bahan_baku?.nama}
                    </p>
                    {isTidakSesuai && v?.catatan && (
                      <p className="text-[10px] text-red-600 mt-0.5 font-semibold truncate">
                        * {v.catatan}
                      </p>
                    )}
                  </div>
                  <span className={`shrink-0 text-[10px] px-2.5 py-1 rounded-xl font-black uppercase tracking-wider border ${
                    isTidakSesuai
                      ? 'bg-red-50 text-red-700 border-red-200'
                      : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                  }`}>
                    {isTidakSesuai
                      ? `Selisih · ${v?.qty_terima}/${item.qty_dikirim_dist} ${item.satuan_dist}`
                      : `Sesuai · ${v?.qty_terima} ${item.satuan_dist}`}
                  </span>
                </div>
              )
            })}
          </div>

          {tidakSesuaiCount > 0 && (
            <div className="p-3.5 bg-red-50 border border-red-200 rounded-2xl text-red-700 text-xs font-bold flex items-center gap-2.5 shadow-xs">
              <AlertTriangle size={18} className="shrink-0 text-red-600" />
              <span>{tidakSesuaiCount} item ada catatan selisih/rusak</span>
            </div>
          )}

          <SignatureBlock title="Tanda Tangan Pengirim (Pusat)" sigs={data.signatures || []} />

          <button
            onClick={() => setStep('signature')}
            className="w-full py-3.5 bg-suka-orange hover:bg-orange-600 active:scale-[0.98] text-white font-extrabold uppercase tracking-wider text-xs shadow-md rounded-xl transition-all cursor-pointer flex items-center justify-center gap-2"
          >
            Lanjut ke Tanda Tangan Penerima <ArrowRight size={16} />
          </button>
        </main>
      </div>
    )
  }

  // ── Step: Cards (satu item per layar) ─────────────────────────────
  return (
    <div className="min-h-screen bg-[#fff8f1]/50 text-[#1e1b15] pb-24 relative overflow-hidden bg-grain select-none">
      <header className="sticky top-0 z-40 bg-white/85 backdrop-blur-md border-b border-suka-brown/10 px-3 sm:px-6 py-3 flex justify-between items-center shadow-sm">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <Link
            href="/distribusi/terima"
            className="w-8 h-8 sm:w-9 sm:h-9 flex items-center justify-center rounded-xl bg-white border border-suka-orange/15 text-suka-orange hover:bg-suka-orange/5 active:scale-95 transition-all shadow-sm shrink-0"
            title="Kembali ke Inbox"
          >
            <ArrowLeft size={16} />
          </Link>
          <div className="flex flex-col min-w-0">
            <h1 className="font-black text-xs sm:text-sm text-suka-brown uppercase tracking-wider font-display leading-none truncate">
              Verifikasi Penerimaan
            </h1>
            <p className="text-[9px] sm:text-[10px] text-suka-gray-500 font-bold mt-0.5 truncate max-w-[170px] sm:max-w-none">
              No. {data.document_number || id.substring(0, 8).toUpperCase()} &bull; {data.outlets?.name?.replace('SUKA SHAWARMA ', '') || ''}
            </p>
          </div>
        </div>
        <span className="text-xs font-black text-suka-brown bg-suka-orange/10 border border-suka-orange/20 px-3 py-1 rounded-full shrink-0">
          {currentIndex + 1} / {items.length}
        </span>
      </header>

      <main className="p-4 max-w-lg mx-auto mt-2 relative z-10 space-y-4">
        {/* Progress bar */}
        <div className="w-full bg-suka-brown/10 rounded-full h-2 overflow-hidden shadow-inner">
          <div
            className="bg-suka-orange h-2 rounded-full transition-all duration-300 shadow-sm"
            style={{ width: `${progress}%` }}
          />
        </div>

        {/* Item card */}
        <div className="bg-white/85 backdrop-blur-md rounded-3xl border border-suka-orange/15 p-5 shadow-sm space-y-4">
          <div className="flex justify-between items-start">
            <span className="text-[8px] font-black uppercase tracking-widest bg-suka-orange/10 text-suka-brown px-2.5 py-1 rounded-lg">
              Kategori: {currentItem?.bahan_baku?.kategori || 'BAHAN BAKU'}
            </span>
          </div>

          <h2 className="text-lg sm:text-xl font-black text-suka-ink uppercase tracking-tight leading-tight">
            {currentItem?.bahan_baku?.nama}
          </h2>

          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-[#fff8f1] p-4 rounded-2xl border border-suka-orange/20">
            <div className="w-full sm:w-auto flex justify-between sm:block">
              <p className="text-[9px] text-suka-gray-500 font-black uppercase tracking-wider mb-0.5">
                Qty Kirim (Pusat)
              </p>
              <p className="text-lg font-black text-suka-brown">
                {currentItem?.qty_dikirim_dist} <span className="text-xs font-bold text-suka-gray-500">{currentItem?.satuan_dist}</span>
              </p>
            </div>

            <div className="w-full sm:w-auto flex items-center justify-between sm:justify-end gap-2 border-t sm:border-t-0 pt-2 sm:pt-0 border-suka-brown/10">
              <button
                type="button"
                onClick={handleMatchQty}
                className="px-2.5 py-1.5 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-700 rounded-xl text-[10px] font-black uppercase tracking-wider flex items-center gap-1 active:scale-95 transition-all cursor-pointer"
                title="Sesuai dengan Qty Kirim"
              >
                <Check size={12} /> Sesuai
              </button>

              <div className="flex items-center gap-1.5">
                <input
                  type="number"
                  step="0.01"
                  min={0}
                  max={currentItem?.qty_dikirim_dist}
                  value={currentVerif.qty_terima}
                  onChange={(e) => {
                    const val = e.target.value === '' ? '' : parseFloat(e.target.value) || 0
                    const isKurang = typeof val === 'number' && val < (currentItem?.qty_dikirim_dist ?? 0)
                    setVerif({
                      qty_terima: val,
                      kondisi: isKurang ? 'tidak_sesuai' : (currentVerif.kondisi === 'tidak_sesuai' && !currentVerif.catatan ? 'baik' : currentVerif.kondisi),
                    })
                  }}
                  className={`border-2 rounded-xl px-2 py-1.5 text-lg font-black text-center w-20 bg-white focus:outline-none focus:ring-2 focus:ring-suka-orange transition-all ${
                    isTidakSesuaiMode || (typeof currentVerif.qty_terima === 'number' && currentVerif.qty_terima < (currentItem?.qty_dikirim_dist ?? 0))
                      ? 'border-red-500 text-red-700'
                      : 'border-emerald-600 text-emerald-800'
                  }`}
                  placeholder="0"
                />
                <span className="text-xs font-bold text-suka-gray-500">{currentItem?.satuan_dist}</span>
              </div>
            </div>
          </div>

          {isTidakSesuaiMode && (
            <div className="space-y-1 animate-in fade-in duration-200">
              <label className="text-[9px] font-black text-red-600 block uppercase tracking-wider pl-1">
                Catatan Masalah / Alasan Selisih (Wajib):
              </label>
              <textarea
                value={currentVerif.catatan}
                onChange={(e) => setVerif({ catatan: e.target.value })}
                placeholder="Sebutkan alasan (misal: 2 pack bocor, kurang kirim 1 botol, rusak saat transit, dll)"
                rows={2}
                className="w-full border border-red-300 rounded-xl px-3 py-2 text-xs bg-red-50/70 focus:outline-none focus:ring-2 focus:ring-red-400 resize-none font-semibold text-red-900 min-h-[55px]"
              />
            </div>
          )}
        </div>

        {/* Action buttons — kondisi belum dikunci */}
        {!kondisiConfirmed && (
          <div className="space-y-3">
            {!isTidakSesuaiMode ? (
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={handleBaik}
                  className="bg-emerald-600 hover:bg-emerald-700 active:scale-[0.98] text-white rounded-2xl py-3.5 font-black text-xs uppercase tracking-wider shadow-md transition-all cursor-pointer flex items-center justify-center gap-2"
                >
                  <CheckCircle2 size={16} /> Kondisi Baik
                </button>
                <button
                  onClick={() => {
                    if (currentVerif.qty_terima === '') {
                      toast.warning('Harap isi jumlah fisik (Qty Terima) terlebih dahulu')
                      return
                    }
                    setVerif({ kondisi: 'tidak_sesuai' })
                  }}
                  className="border-2 border-red-300 text-red-700 bg-white hover:bg-red-50 active:scale-[0.98] rounded-2xl py-3.5 font-black text-xs uppercase tracking-wider transition-all cursor-pointer flex items-center justify-center gap-2"
                >
                  <AlertTriangle size={16} /> Ada Masalah
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => setVerif({ kondisi: 'baik', catatan: '' })}
                  className="border border-suka-brown/20 text-suka-brown bg-white rounded-2xl py-3.5 font-black text-xs uppercase tracking-wider hover:bg-suka-gray-50 active:scale-[0.98] transition-all cursor-pointer"
                >
                  Batal Masalah
                </button>
                <button
                  onClick={handleTidakSesuaiConfirm}
                  className="bg-red-600 hover:bg-red-700 active:scale-[0.98] text-white rounded-2xl py-3.5 font-black text-xs uppercase tracking-wider shadow-md transition-all cursor-pointer flex items-center justify-center gap-1.5"
                >
                  Kunci Selisih →
                </button>
              </div>
            )}
          </div>
        )}

        {/* Section foto inline — muncul setelah kondisi dikonfirmasi */}
        {kondisiConfirmed && (
          <div className="bg-white/85 backdrop-blur-md rounded-3xl border border-suka-orange/15 p-5 shadow-sm space-y-4 animate-in fade-in">
            <div className={`flex items-center justify-between px-4 py-2.5 rounded-xl border ${
              currentVerif.kondisi === 'tidak_sesuai'
                ? 'bg-red-50 border-red-200 text-red-700'
                : 'bg-emerald-50 border-emerald-200 text-emerald-700'
            }`}>
              <span className="text-xs font-black uppercase tracking-wide flex items-center gap-1.5">
                {currentVerif.kondisi === 'tidak_sesuai' ? (
                  <>
                    <AlertTriangle size={14} /> Selisih · {currentVerif.qty_terima}/{currentItem?.qty_dikirim_dist} {currentItem?.satuan_dist}
                  </>
                ) : (
                  <>
                    <CheckCircle2 size={14} /> Baik · {currentVerif.qty_terima} {currentItem?.satuan_dist}
                  </>
                )}
              </span>
              <button
                onClick={() => setKondisiConfirmed(false)}
                className="text-[10px] font-extrabold underline opacity-80 cursor-pointer hover:opacity-100"
              >
                Ubah Qty
              </button>
            </div>

            {currentVerif.foto_preview && (
              <div className="rounded-2xl overflow-hidden border border-suka-brown/15 shadow-inner">
                <img src={currentVerif.foto_preview} alt="Foto barang" className="w-full object-cover max-h-56" />
              </div>
            )}

            <label className={`block w-full ${uploadingFoto ? 'cursor-not-allowed opacity-70' : 'cursor-pointer'}`}>
              <input
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                disabled={uploadingFoto}
                onChange={handleFotoCapture}
              />
              <div className={`w-full py-3.5 font-black uppercase tracking-wider text-xs rounded-2xl transition-all flex items-center justify-center gap-2 active:scale-[0.98] shadow-sm ${
                uploadingFoto
                  ? 'bg-orange-100 text-suka-orange border border-orange-200 animate-pulse'
                  : currentVerif.foto_path
                    ? 'bg-white border border-suka-brown/20 text-suka-brown hover:bg-suka-gray-50'
                    : 'bg-suka-orange hover:bg-orange-600 text-white'
              }`}>
                {uploadingFoto ? (
                  <span className="flex items-center gap-2">
                    <RefreshCw size={14} className="animate-spin" /> Mengompres & Mengunggah...
                  </span>
                ) : currentVerif.foto_path ? (
                  <>
                    <RefreshCw size={14} /> Ambil Ulang Foto Bukti
                  </>
                ) : (
                  <>
                    <Camera size={16} /> Ambil Foto Bukti Fisik
                  </>
                )}
              </div>
            </label>

            <button
              onClick={handleAdvance}
              disabled={!currentVerif.foto_path || uploadingFoto}
              className={`w-full py-3.5 font-black uppercase tracking-wider text-xs rounded-2xl transition-all flex items-center justify-center gap-2 active:scale-[0.98] ${
                currentVerif.foto_path && !uploadingFoto
                  ? 'bg-suka-brown hover:bg-suka-ink text-white shadow-md cursor-pointer'
                  : 'bg-suka-gray-200 text-suka-gray-400 cursor-not-allowed'
              }`}
            >
              {currentIndex + 1 >= items.length ? (
                <>Lihat Ringkasan Akhir <ArrowRight size={16} /></>
              ) : (
                <>Item Berikutnya <ArrowRight size={16} /></>
              )}
            </button>
          </div>
        )}
      </main>
    </div>
  )
}
