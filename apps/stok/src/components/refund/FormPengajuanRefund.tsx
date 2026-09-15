'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import {
  Scale,
  Camera,
  Loader2,
  AlertCircle,
  ArrowLeft,
} from 'lucide-react'
import { useBahanBaku } from '@/hooks/useBahanBaku'
import { useReturActions } from '@/hooks/useRetur'
import { createClient } from '@/lib/supabase'

const ALASAN_OPTIONS = [
  'Basi / Bau Asam',
  'Berubah Warna / Berlendir',
  'Kemasan Vacum Bocor / Rusak',
  'Cacat Potongan / Susut Ekstrem',
  'Hancur / Rusak saat Pengiriman',
  'Lainnya',
]

export function FormPengajuanRefund({ outletId }: { outletId: string }) {
  const router = useRouter()
  const { bahanBaku } = useBahanBaku()
  const { submitClaim } = useReturActions()

  // Filter hanya bahan refundable (Ayam, Sapi, Kulit)
  const refundableBahan = useMemo(() => {
    return bahanBaku.filter(
      (b) =>
        b.is_refundable ||
        ['AYAM', 'SAPI', 'KULIT 25', 'KULIT 28', 'KULIT 32'].includes(b.nama.toUpperCase().trim())
    )
  }, [bahanBaku])

  const [selectedBahanId, setSelectedBahanId] = useState('')
  const [qtyBesar, setQtyBesar] = useState('')
  const [qtyKecil, setQtyKecil] = useState('')
  const [alasan, setAlasan] = useState(ALASAN_OPTIONS[0])
  const [alasanLainnya, setAlasanLainnya] = useState('')
  const [catatan, setCatatan] = useState('')
  const [fotoBukti, setFotoBukti] = useState<File | null>(null)
  const [fotoPreview, setFotoPreview] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const selectedBahan = refundableBahan.find((b) => b.id === selectedBahanId) ?? null

  // Hitung total kuantitas dalam satuan besar
  const totalQtyBesar = useMemo(() => {
    const besar = parseFloat(qtyBesar || '0')
    const kecil = parseFloat(qtyKecil || '0')
    if (!selectedBahan) return besar

    const faktor = selectedBahan.faktor_tampilan || 1000
    return besar + kecil / faktor
  }, [qtyBesar, qtyKecil, selectedBahan])

  const handleFileChange = (file: File | null) => {
    setFotoBukti(file)
    if (file) {
      const url = URL.createObjectURL(file)
      setFotoPreview(url)
    } else {
      setFotoPreview(null)
    }
  }

  const uploadFile = async (file: File): Promise<string> => {
    const supabase = createClient()
    const ext = file.name.split('.').pop() || 'jpg'
    const fileName = `${outletId}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}.${ext}`

    // Coba upload ke bucket khusus retur_evidence
    const { data, error } = await supabase.storage.from('retur_evidence').upload(fileName, file)
    if (error) {
      // Fallback ke waste_evidence jika bucket retur_evidence belum dibuat di database remote
      const fallback = await supabase.storage.from('waste_evidence').upload(`retur/${fileName}`, file)
      if (fallback.error) throw new Error('Gagal mengunggah foto: ' + (error.message || fallback.error.message))
      return supabase.storage.from('waste_evidence').getPublicUrl(fallback.data.path).data.publicUrl
    }

    return supabase.storage.from('retur_evidence').getPublicUrl(data.path).data.publicUrl
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!selectedBahanId) {
      toast.error('Pilih bahan baku yang akan diretur')
      return
    }

    if (totalQtyBesar <= 0) {
      toast.error('Kuantitas timbangan harus lebih besar dari 0')
      return
    }

    if (!fotoBukti) {
      toast.error('Foto bahan baku di atas timbangan wajib diunggah')
      return
    }

    if (alasan === 'Lainnya' && !alasanLainnya.trim()) {
      toast.error('Keterangan alasan lainnya wajib diisi')
      return
    }

    const finalAlasan = alasan === 'Lainnya'
      ? (alasanLainnya.trim() ? `Lainnya: ${alasanLainnya.trim()}` : 'Lainnya')
      : alasan

    setBusy(true)
    try {
      // 1. Upload foto bukti ke storage
      const uploadedUrl = await uploadFile(fotoBukti)

      // 2. Submit klaim via RPC
      await submitClaim.mutateAsync({
        outlet_id: outletId,
        tipe_retur: 'chiller_outlet',
        items: [
          {
            bahan_baku_id: selectedBahanId,
            qty_klaim: totalQtyBesar,
            foto_fisik_url: uploadedUrl,
            foto_timbangan_url: uploadedUrl, // Disamakan agar kompatibel dengan schema
            alasan: finalAlasan,
            catatan: catatan.trim() || undefined,
          },
        ],
        catatan: catatan.trim() || undefined,
      })

      toast.success('Pengajuan retur berhasil dibuat! Menunggu review AM/RM.')
      router.push('/stok/refund')
    } catch (err: any) {
      toast.error(err.message || 'Gagal mengajukan retur bahan')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="max-w-xl mx-auto bg-white rounded-2xl border border-[#d9c2b2]/40 shadow-sm p-5 sm:p-6 space-y-5">
      <div className="flex items-center gap-3 pb-4 border-b border-gray-100">
        <button
          type="button"
          onClick={() => router.back()}
          className="p-2 text-gray-400 hover:text-gray-800 rounded-xl hover:bg-gray-100 transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h2 className="font-extrabold text-[#1e1b15] text-lg">Formulir Retur Bahan Core</h2>
          <p className="text-xs text-gray-500 font-medium">
            Khusus Sapi, Ayam, dan Kulit (100% Ganti Fisik)
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4 text-xs font-semibold text-gray-700">
        {/* Pilihan Bahan */}
        <div>
          <label className="block mb-1.5 font-bold uppercase tracking-wider text-[11px] text-gray-600">
            Pilih Bahan Baku <span className="text-red-500">*</span>
          </label>
          <select
            value={selectedBahanId}
            onChange={(e) => {
              setSelectedBahanId(e.target.value)
              setQtyBesar('')
              setQtyKecil('')
            }}
            className="w-full px-3 py-2.5 rounded-xl border border-gray-200 focus:outline-hidden focus:border-amber-600 font-bold text-sm bg-white"
            required
          >
            <option value="">-- Pilih Bahan Core --</option>
            {refundableBahan.map((b) => (
              <option key={b.id} value={b.id}>
                {b.nama} ({b.satuan.toUpperCase()})
              </option>
            ))}
          </select>
        </div>

        {/* Input Kuantitas Timbangan */}
        {selectedBahan && (
          <div className="p-4 bg-amber-50/40 rounded-xl border border-amber-100 space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-bold text-amber-950 text-xs flex items-center gap-1.5">
                <Scale className="w-4 h-4 text-amber-700" />
                Input Berat / Kuantitas Rusak
              </span>
              <span className="text-[10px] text-gray-500 font-mono font-bold">
                Total: {totalQtyBesar.toFixed(3)} {selectedBahan.satuan}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[10px] text-gray-600 font-bold mb-1">
                  Satuan {selectedBahan.satuan.toUpperCase()}
                </label>
                <input
                  type="number"
                  step="any"
                  min="0"
                  placeholder="0"
                  value={qtyBesar}
                  onChange={(e) => setQtyBesar(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-amber-200 focus:outline-hidden focus:border-amber-600 text-sm font-bold bg-white text-right"
                />
              </div>

              <div>
                <label className="block text-[10px] text-gray-600 font-bold mb-1">
                  Satuan {selectedBahan.satuan_kecil ? selectedBahan.satuan_kecil.toUpperCase() : 'GRAM'}
                </label>
                <input
                  type="number"
                  step="any"
                  min="0"
                  placeholder="0"
                  value={qtyKecil}
                  onChange={(e) => setQtyKecil(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-amber-200 focus:outline-hidden focus:border-amber-600 text-sm font-bold bg-white text-right"
                />
              </div>
            </div>
            <p className="text-[10px] text-gray-500 italic">
              *Stok di outlet akan dipotong sebesar angka ini saat formulir diajukan.
            </p>
          </div>
        )}

        {/* Alasan Retur */}
        <div>
          <label className="block mb-1.5 font-bold uppercase tracking-wider text-[11px] text-gray-600">
            Kategori Kerusakan / Alasan <span className="text-red-500">*</span>
          </label>
          <select
            value={alasan}
            onChange={(e) => setAlasan(e.target.value)}
            className="w-full px-3 py-2.5 rounded-xl border border-gray-200 focus:outline-hidden focus:border-amber-600 font-medium text-xs bg-white"
          >
            {ALASAN_OPTIONS.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>

          {/* Muncul jika memilih opsi "Lainnya" */}
          {alasan === 'Lainnya' && (
            <div className="mt-2.5 animate-in fade-in slide-in-from-top-1 duration-150">
              <label className="block mb-1 font-bold text-[11px] text-amber-900">
                Keterangan Alasan Lainnya <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={alasanLainnya}
                onChange={(e) => setAlasanLainnya(e.target.value)}
                placeholder="Tuliskan alasan retur (misal: tekstur lembek berurat, cacat kemasan supir, dll)..."
                className="w-full px-3 py-2.5 rounded-xl border-2 border-amber-400 focus:outline-hidden focus:border-amber-600 text-xs bg-amber-50/20 text-gray-800 placeholder:text-gray-400 font-medium shadow-2xs"
                required
                autoFocus
              />
            </div>
          )}
        </div>

        {/* Upload Foto Bahan Baku di Atas Timbangan (1 Foto Saja) */}
        <div>
          <label className="block mb-1 font-bold text-[11px] text-gray-700">
            Foto Bahan Baku di Atas Timbangan <span className="text-red-500">*</span>
          </label>

          {fotoPreview ? (
            <div className="border-2 border-amber-600/40 rounded-2xl p-3 bg-amber-50/30 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <img
                  src={fotoPreview}
                  alt="Preview Timbangan"
                  className="w-16 h-16 object-cover rounded-xl border border-amber-200 shadow-2xs shrink-0"
                />
                <div className="min-w-0 flex-1">
                  <span className="text-xs font-bold text-gray-900 block truncate">
                    {fotoBukti?.name}
                  </span>
                  <span className="text-[10px] text-emerald-700 font-semibold block mt-0.5">
                    ✓ Bahan di atas timbangan siap diupload
                  </span>
                  <span className="text-[9px] text-gray-400 block">
                    {fotoBukti ? `${(fotoBukti.size / 1024).toFixed(1)} KB` : ''}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                <label className="px-2.5 py-1.5 bg-white hover:bg-gray-50 border border-gray-200 rounded-xl text-[11px] font-bold text-gray-700 cursor-pointer transition-colors shadow-2xs">
                  Ganti
                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    className="hidden"
                    onChange={(e) => handleFileChange(e.target.files?.[0] || null)}
                  />
                </label>
                <button
                  type="button"
                  onClick={() => handleFileChange(null)}
                  className="px-2.5 py-1.5 bg-red-50 hover:bg-red-100 border border-red-200 rounded-xl text-[11px] font-bold text-red-700 transition-colors cursor-pointer"
                >
                  Hapus
                </button>
              </div>
            </div>
          ) : (
            <label className="border-2 border-dashed border-amber-600/40 hover:border-amber-600 rounded-2xl p-5 flex flex-col items-center justify-center cursor-pointer bg-amber-50/20 hover:bg-amber-50/50 transition-all group">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center group-hover:scale-105 transition-transform">
                  <Scale className="w-5 h-5" />
                </div>
                <div className="w-10 h-10 rounded-xl bg-orange-100 text-orange-800 flex items-center justify-center group-hover:scale-105 transition-transform">
                  <Camera className="w-5 h-5" />
                </div>
              </div>
              <span className="text-xs font-black text-gray-900 text-center">
                Ambil / Upload Foto Bahan di Atas Timbangan
              </span>
              <span className="text-[10px] text-amber-800/80 font-medium text-center mt-1 max-w-sm">
                Pastikan fisik bahan baku rusak dan jarum/layar angka timbangan terlihat jelas dalam 1 foto
              </span>
              <input
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={(e) => handleFileChange(e.target.files?.[0] || null)}
                required
              />
            </label>
          )}
        </div>

        {/* Catatan Tambahan */}
        <div>
          <label className="block mb-1 font-bold text-[11px] text-gray-700">
            Catatan Tambahan (Opsional)
          </label>
          <textarea
            rows={2}
            value={catatan}
            onChange={(e) => setCatatan(e.target.value)}
            placeholder="Keterangan tambahan untuk Area Manager & Central Kitchen..."
            className="w-full px-3 py-2 rounded-xl border border-gray-200 focus:outline-hidden focus:border-amber-600 text-xs bg-white text-gray-800"
          />
        </div>

        {/* Banner Info Alur */}
        <div className="p-3 bg-amber-50/80 rounded-xl border border-amber-200/60 text-[11px] text-amber-900 flex items-start gap-2">
          <AlertCircle className="w-4 h-4 text-amber-800 shrink-0 mt-0.5" />
          <div>
            <p className="font-bold">Prosedur Pengembalian:</p>
            <p className="text-[10px] text-amber-800 mt-0.5">
              Setelah disubmit, pengajuan akan direview oleh <strong>Area Manager (AM / RM)</strong>. Jangan menyerahkan daging/kulit ke kurir sebelum tiket berstatus <strong>"Disetujui AM/RM"</strong>.
            </p>
          </div>
        </div>

        {/* Submit button */}
        <div className="pt-2 flex justify-end gap-2">
          <button
            type="button"
            onClick={() => router.back()}
            disabled={busy}
            className="px-4 py-2.5 rounded-xl text-xs font-bold text-gray-600 hover:bg-gray-100 transition-colors"
          >
            Batal
          </button>
          <button
            type="submit"
            disabled={busy || totalQtyBesar <= 0}
            className="px-6 py-2.5 rounded-xl text-xs font-bold text-white bg-amber-800 hover:bg-amber-900 shadow-xs flex items-center gap-2 transition-colors disabled:opacity-50"
          >
            {busy && <Loader2 className="w-4 h-4 animate-spin" />}
            Kirim Pengajuan Retur
          </button>
        </div>
      </form>
    </div>
  )
}
