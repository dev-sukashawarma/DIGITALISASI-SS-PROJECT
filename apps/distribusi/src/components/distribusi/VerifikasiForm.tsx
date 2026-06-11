'use client'

import { useState } from 'react'
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

export function VerifikasiForm({ id }: { id: string }) {
  const router = useRouter()
  const { data, loading, error } = useSuratJalanDetail(id)
  const [currentIndex, setCurrentIndex] = useState(0)
  const [verifications, setVerifications] = useState<Record<string, ItemVerification>>({})
  const [step, setStep] = useState<Step>('cards')
  const [submitting, setSubmitting] = useState(false)

  if (loading) return <p className="p-6 text-gray-500">Memuat...</p>
  if (error || !data) return <p className="p-6 text-red-600">Gagal memuat: {error}</p>

  // Idempotency guard: jika SJ sudah diterima, redirect ke riwayat
  if (data.status && (data.status === 'diterima_lengkap' || data.status === 'diterima_sebagian')) {
    return (
      <div className="min-h-screen bg-[#fff8f1] flex items-center justify-center p-6">
        <div className="bg-white rounded-xl border border-suka-brown/10 p-8 max-w-md text-center shadow-sm">
          <p className="text-lg font-bold text-suka-brown mb-2">✓ Verifikasi Sudah Selesai</p>
          <p className="text-sm text-suka-brown/60 mb-6">Surat jalan ini telah diverifikasi sebelumnya. Lihat detail di Riwayat.</p>
          <button
            onClick={() => router.push('/distribusi/riwayat')}
            className="w-full bg-[#701604] hover:opacity-95 text-white rounded-xl py-3 font-bold text-sm"
          >
            Buka Riwayat
          </button>
        </div>
      </div>
    )
  }

  const items = data.surat_jalan_item
  const currentItem = items[currentIndex]
  const currentVerif = verifications[currentItem?.id] ?? {
    qty_terima: currentItem?.qty_dikirim ?? 0,
    kondisi: 'baik' as Kondisi,
    catatan: '',
  }
  const progress = Math.round((currentIndex / items.length) * 100)
  const jelekItems = Object.entries(verifications).filter(([, v]) => v.kondisi === 'jelek')

  const setVerif = (patch: Partial<ItemVerification>) => {
    setVerifications((prev) => ({
      ...prev,
      [currentItem.id]: { ...currentVerif, ...patch },
    }))
  }

  const confirmItem = (v: ItemVerification) => {
    setVerifications((prev) => ({ ...prev, [currentItem.id]: v }))
    if (currentIndex + 1 >= items.length) {
      setStep('summary')
    } else {
      setCurrentIndex((i) => i + 1)
    }
  }

  const handleBaik = () => {
    confirmItem({
      qty_terima: currentItem.qty_dikirim,
      kondisi: 'baik',
      catatan: '',
    })
  }

  const handleJelekConfirm = () => {
    if (currentVerif.kondisi === 'jelek' && !currentVerif.catatan.trim()) {
      alert('Wajib isi catatan untuk item yang jelek')
      return
    }
    if (currentVerif.qty_terima > currentItem.qty_dikirim) {
      alert('Qty terima tidak boleh melebihi qty dikirim')
      return
    }
    confirmItem(currentVerif)
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
        onBack={() => setStep('summary')}
      />
    )
  }

  if (step === 'summary') {
    return (
      <div className="min-h-screen bg-[#fff8f1] text-[#1e1b15] pb-12">
        <header className="sticky top-0 z-40 bg-white border-b border-suka-brown/10 px-6 py-4 flex justify-between items-center shadow-sm">
          <div className="flex items-center gap-3">
            <img src="/logo.png" alt="Logo Suka Shawarma" className="h-10 w-auto object-contain" />
            <div className="flex flex-col">
              <h2 className="text-xl font-bold text-[#701604] tracking-tight">Ringkasan Verifikasi</h2>
              <p className="text-xs text-suka-brown/60 mt-0.5">Sistem Distribusi & Logistik</p>
            </div>
          </div>
        </header>

        <div className="p-6 max-w-lg mx-auto mt-6">
          <div className="bg-white rounded-xl border border-suka-brown/10 p-6 shadow-sm mb-6">
            <h1 className="text-xl font-extrabold text-suka-brown mb-1 uppercase tracking-tight">Konfirmasi Penerimaan</h1>
            <p className="text-suka-brown/50 text-xs font-semibold mb-6">{items.length} item selesai diverifikasi</p>

            <div className="bg-[#fff8f1] rounded-xl border border-suka-brown/10 divide-y divide-suka-brown/10 mb-4 overflow-hidden">
              {items.map((item) => {
                const v = verifications[item.id]
                const isJelek = v?.kondisi === 'jelek'
                return (
                  <div key={item.id} className="px-4 py-3 flex justify-between items-center">
                    <div>
                      <p className="text-sm font-bold text-suka-ink">{item.bahan_baku?.nama}</p>
                      {isJelek && v.catatan && (
                        <p className="text-xs text-red-650 mt-1 italic font-medium">{v.catatan}</p>
                      )}
                    </div>
                    <span
                      className={`text-xs px-2.5 py-1 rounded-full font-bold uppercase tracking-wide border ${
                        isJelek
                          ? 'bg-red-50 text-red-750 border-red-200'
                          : 'bg-green-50 text-green-755 border-green-200'
                      }`}
                    >
                      {isJelek 
                        ? `Jelek · ${v?.qty_terima ?? item.qty_dikirim}/${item.qty_dikirim} ${item.bahan_baku?.satuan}` 
                        : `Baik · ${v?.qty_terima ?? item.qty_dikirim} ${item.bahan_baku?.satuan}`}
                    </span>
                  </div>
                )
              })}
            </div>

            {jelekItems.length > 0 && (
              <div className="mb-4 p-3.5 bg-red-50 border border-red-250 rounded-xl text-red-800 text-xs font-bold flex items-center gap-2">
                <span>⚠️</span>
                <span>{jelekItems.length} item bermasalah — detail terekam di catatan</span>
              </div>
            )}

            <button
              onClick={() => setStep('signature')}
              className="w-full bg-[#701604] hover:opacity-95 text-white rounded-xl py-3.5 font-bold shadow-md transition-all cursor-pointer text-sm"
            >
              Lanjut ke Tanda Tangan →
            </button>
            <button
              onClick={() => { setCurrentIndex(items.length - 1); setStep('cards') }}
              className="w-full mt-2 border border-suka-brown/15 text-suka-brown font-semibold rounded-xl py-3.5 text-xs hover:bg-suka-cream bg-white transition-all cursor-pointer"
            >
              Kembali ke item terakhir
            </button>
          </div>
        </div>
      </div>
    )
  }

  // Card step
  const isJelekMode = currentVerif.kondisi === 'jelek'

  return (
    <div className="min-h-screen bg-[#fff8f1] text-[#1e1b15] pb-12">
      <header className="sticky top-0 z-40 bg-white border-b border-suka-brown/10 px-6 py-4 flex justify-between items-center shadow-sm">
        <div className="flex items-center gap-3">
          <img src="/logo.png" alt="Logo Suka Shawarma" className="h-10 w-auto object-contain" />
          <div className="flex flex-col">
            <h2 className="text-xl font-bold text-[#701604] tracking-tight">Verifikasi Item</h2>
            <p className="text-xs text-suka-brown/60 mt-0.5">Sistem Distribusi & Logistik</p>
          </div>
        </div>
        <div>
          <Link
            href="/distribusi/terima"
            className="px-4 py-2 border border-suka-brown/15 text-suka-brown font-semibold text-xs rounded-xl bg-white hover:bg-suka-cream transition-all"
          >
            ← Batal
          </Link>
        </div>
      </header>

      <div className="p-6 max-w-lg mx-auto mt-6">
        <div className="flex items-center justify-between mb-4">
          <span className="text-xs font-bold text-suka-brown uppercase tracking-wider">Progress Verifikasi</span>
          <span className="text-xs font-bold text-suka-orange bg-white border border-suka-brown/10 px-2.5 py-1 rounded-lg">
            {currentIndex + 1} / {items.length} Barang
          </span>
        </div>

        <div className="w-full bg-[#faf2e9] border border-suka-brown/5 rounded-full h-2.5 mb-6 overflow-hidden">
          <div
            className="bg-suka-orange h-full rounded-full transition-all"
            style={{ width: `${progress}%` }}
          />
        </div>

        <div className="bg-white rounded-xl border border-suka-brown/10 p-6 mb-6 shadow-sm">
          <p className="text-xs text-suka-orange/80 font-bold uppercase tracking-widest mb-1.5">
            Kategori: {currentItem.bahan_baku?.kategori || 'BAHAN BAKU'}
          </p>
          <h2 className="text-xl font-extrabold text-suka-ink mb-6 border-b border-suka-brown/10 pb-3">{currentItem.bahan_baku?.nama}</h2>

          <div className="flex items-center justify-center gap-6 mb-6 bg-[#fff8f1] p-4 rounded-xl border border-suka-brown/5">
            <div>
              <p className="text-xs text-suka-brown/60 font-bold uppercase tracking-wider mb-1.5 text-center">Dikirim</p>
              <div className="bg-white border border-suka-brown/10 rounded-xl px-4 py-2.5 text-base font-bold text-suka-brown/70 min-w-[80px] text-center shadow-sm">
                {currentItem.qty_dikirim} <span className="text-xs font-semibold">{currentItem.bahan_baku?.satuan}</span>
              </div>
            </div>
            <span className="text-suka-brown/30 text-xl font-bold pt-4">→</span>
            <div>
              <p className="text-xs text-suka-brown/60 font-bold uppercase tracking-wider mb-1.5 text-center">Diterima</p>
              <div className="flex items-center gap-1.5">
                <input
                  type="number"
                  min={0}
                  max={currentItem.qty_dikirim}
                  value={currentVerif.qty_terima}
                  onChange={(e) => setVerif({ qty_terima: parseInt(e.target.value) || 0, kondisi: 'jelek' })}
                  className={`border-2 rounded-xl px-3 py-2 text-base font-bold text-center w-20 bg-white focus:outline-none focus:ring-1 focus:ring-suka-orange transition-all ${
                    isJelekMode ? 'border-red-400' : 'border-suka-green'
                  }`}
                />
                <span className="text-xs font-bold text-suka-brown/70">{currentItem.bahan_baku?.satuan}</span>
              </div>
            </div>
          </div>

          {isJelekMode && (
            <div className="mb-4 space-y-1">
              <label className="text-xs font-bold text-red-650 block">Catatan / Concern Masalah (Wajib)</label>
              <textarea
                value={currentVerif.catatan}
                onChange={(e) => setVerif({ catatan: e.target.value })}
                placeholder="Contoh: 2 kg busuk, kemasan berlubang, dll..."
                rows={2}
                className="w-full border border-red-200 rounded-xl px-4 py-3 text-xs bg-red-50 focus:outline-none focus:ring-1 focus:ring-red-400 resize-none"
              />
            </div>
          )}
        </div>

        {!isJelekMode ? (
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={handleBaik}
              className="bg-suka-green hover:opacity-95 text-white rounded-xl py-3.5 font-bold shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer text-sm"
            >
              ✓ Kondisi Baik
            </button>
            <button
              onClick={() => setVerif({ kondisi: 'jelek', qty_terima: currentItem.qty_dikirim })}
              className="border border-red-400 text-red-600 rounded-xl py-3.5 font-bold hover:bg-red-50 bg-white transition-all flex items-center justify-center gap-2 cursor-pointer text-sm"
            >
              ✗ Ada Masalah (Jelek)
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => setVerif({ kondisi: 'baik', qty_terima: currentItem.qty_dikirim, catatan: '' })}
              className="border border-suka-brown/15 text-suka-brown rounded-xl py-3.5 font-semibold hover:bg-suka-cream bg-white transition-all cursor-pointer text-sm"
            >
              ← Batalkan
            </button>
            <button
              onClick={handleJelekConfirm}
              className="bg-red-600 hover:opacity-95 text-white rounded-xl py-3.5 font-bold shadow-md transition-all cursor-pointer text-sm"
            >
              Konfirmasi Masalah →
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
