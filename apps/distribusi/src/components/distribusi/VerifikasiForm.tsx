'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'
import { useSuratJalanDetail } from '@/hooks/useSuratJalanDetail'

type Kondisi = 'baik' | 'jelek'

type ItemVerification = {
  qty_terima: number
  kondisi: Kondisi
  catatan: string
}

type Step = 'cards' | 'summary'

export function VerifikasiForm({ id }: { id: string }) {
  const router = useRouter()
  const { data, loading, error } = useSuratJalanDetail(id)
  const [currentIndex, setCurrentIndex] = useState(0)
  const [verifications, setVerifications] = useState<Record<string, ItemVerification>>({})
  const [step, setStep] = useState<Step>('cards')
  const [submitting, setSubmitting] = useState(false)

  if (loading) return <p className="p-6 text-gray-500">Memuat...</p>
  if (error || !data) return <p className="p-6 text-red-600">Gagal memuat: {error}</p>

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

      router.push('/distribusi/terima')
    } catch (err) {
      alert(`Error: ${err instanceof Error ? err.message : 'Gagal menyimpan'}`)
    } finally {
      setSubmitting(false)
    }
  }

  if (step === 'summary') {
    return (
      <div className="p-6 max-w-lg mx-auto">
        <h1 className="text-2xl font-bold mb-1">Ringkasan Verifikasi</h1>
        <p className="text-gray-500 text-sm mb-6">{items.length} item selesai dikonfirmasi</p>

        <div className="bg-white rounded-xl border border-gray-200 divide-y mb-4">
          {items.map((item) => {
            const v = verifications[item.id]
            const isJelek = v?.kondisi === 'jelek'
            return (
              <div key={item.id} className="px-4 py-3 flex justify-between items-center">
                <div>
                  <p className="text-sm font-medium">{item.bahan_baku?.nama}</p>
                  {isJelek && v.catatan && (
                    <p className="text-xs text-red-600 mt-0.5">{v.catatan}</p>
                  )}
                </div>
                <span
                  className={`text-xs px-2 py-1 rounded-full font-medium ${
                    isJelek
                      ? 'bg-red-50 text-red-700'
                      : 'bg-green-50 text-green-700'
                  }`}
                >
                  {isJelek ? `Jelek · ${v?.qty_terima ?? item.qty_dikirim}/${item.qty_dikirim} ${item.bahan_baku?.satuan}` : `Baik · ${v?.qty_terima ?? item.qty_dikirim} ${item.bahan_baku?.satuan}`}
                </span>
              </div>
            )
          })}
        </div>

        {jelekItems.length > 0 && (
          <div className="mb-4 p-3 bg-red-50 border border-red-100 rounded-lg text-red-700 text-sm">
            {jelekItems.length} item bermasalah — concern tercatat di catatan
          </div>
        )}

        <button
          onClick={handleSubmit}
          disabled={submitting}
          className="w-full bg-green-600 text-white rounded-xl py-3 font-medium hover:bg-green-700 disabled:opacity-50"
        >
          {submitting ? 'Menyimpan...' : 'Selesai & Simpan Verifikasi'}
        </button>
        <button
          onClick={() => { setCurrentIndex(items.length - 1); setStep('cards') }}
          className="w-full mt-2 border border-gray-300 rounded-xl py-3 text-sm text-gray-600 hover:bg-gray-50"
        >
          Kembali ke item terakhir
        </button>
      </div>
    )
  }

  // Card step
  const isJelekMode = currentVerif.kondisi === 'jelek'

  return (
    <div className="p-6 max-w-lg mx-auto">
      <div className="flex items-center justify-between mb-4">
        <Link href="/distribusi/terima" className="text-blue-600 text-sm hover:underline">
          ← Kembali
        </Link>
        <span className="text-sm text-gray-500 font-medium">
          {currentIndex + 1} / {items.length}
        </span>
      </div>

      <div className="w-full bg-gray-100 rounded-full h-1.5 mb-6">
        <div
          className="bg-green-500 h-1.5 rounded-full transition-all"
          style={{ width: `${progress}%` }}
        />
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-5 mb-6">
        <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">
          {currentItem.bahan_baku?.kategori}
        </p>
        <h2 className="text-xl font-semibold mb-4">{currentItem.bahan_baku?.nama}</h2>

        <div className="flex items-end gap-4 mb-6">
          <div>
            <p className="text-xs text-gray-500 mb-1">Dikirim</p>
            <div className="bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-lg font-medium text-gray-500 min-w-[72px] text-center">
              {currentItem.qty_dikirim} {currentItem.bahan_baku?.satuan}
            </div>
          </div>
          <span className="text-gray-300 text-xl pb-2">→</span>
          <div>
            <p className="text-xs text-gray-500 mb-1">Diterima</p>
            <div className="flex items-center gap-1">
              <input
                type="number"
                min={0}
                max={currentItem.qty_dikirim}
                value={currentVerif.qty_terima}
                onChange={(e) => setVerif({ qty_terima: parseInt(e.target.value) || 0, kondisi: 'jelek' })}
                className={`border rounded-lg px-3 py-2 text-lg font-medium text-center w-20 ${
                  isJelekMode ? 'border-red-400' : 'border-green-400'
                }`}
              />
              <span className="text-sm text-gray-500">{currentItem.bahan_baku?.satuan}</span>
            </div>
          </div>
        </div>

        {isJelekMode && (
          <div className="mb-4">
            <label className="text-xs text-gray-500 mb-1 block">Catatan / concern (wajib)</label>
            <textarea
              value={currentVerif.catatan}
              onChange={(e) => setVerif({ catatan: e.target.value })}
              placeholder="Contoh: 2 kg busuk, kondisi kemasan rusak..."
              rows={2}
              className="w-full border border-red-200 rounded-lg px-3 py-2 text-sm bg-red-50 resize-none"
            />
          </div>
        )}
      </div>

      {!isJelekMode ? (
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={handleBaik}
            className="bg-green-600 text-white rounded-xl py-3 font-medium hover:bg-green-700 flex items-center justify-center gap-2"
          >
            ✓ Baik
          </button>
          <button
            onClick={() => setVerif({ kondisi: 'jelek', qty_terima: currentItem.qty_dikirim })}
            className="border border-red-400 text-red-600 rounded-xl py-3 font-medium hover:bg-red-50 flex items-center justify-center gap-2"
          >
            ✗ Jelek
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => setVerif({ kondisi: 'baik', qty_terima: currentItem.qty_dikirim, catatan: '' })}
            className="border border-gray-300 text-gray-600 rounded-xl py-3 font-medium hover:bg-gray-50"
          >
            ← Batalkan
          </button>
          <button
            onClick={handleJelekConfirm}
            className="bg-red-600 text-white rounded-xl py-3 font-medium hover:bg-red-700"
          >
            Konfirmasi Jelek →
          </button>
        </div>
      )}
    </div>
  )
}
