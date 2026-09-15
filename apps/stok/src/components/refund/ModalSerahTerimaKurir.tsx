'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { Loader2, Truck, UploadCloud, X } from 'lucide-react'
import { createClient } from '@/lib/supabase'
import { useReturActions } from '@/hooks/useRetur'
import { JenisLogistik, ReturStok } from '@/types/retur'

const LOGISTIK_OPTIONS: { value: JenisLogistik; label: string }[] = [
  { value: 'internal', label: 'Armada Internal Suka Shawarma' },
  { value: 'lalamove', label: 'Lalamove' },
  { value: 'gosend', label: 'GoSend (Gojek)' },
  { value: 'grabexpress', label: 'GrabExpress' },
  { value: 'deliveree', label: 'Deliveree' },
  { value: 'lainnya', label: 'Ekspedisi / Kurir Lainnya' },
]

export function ModalSerahTerimaKurir({
  retur,
  isOpen,
  onClose,
}: {
  retur: ReturStok
  isOpen: boolean
  onClose: () => void
}) {
  const { serahTerima } = useReturActions()

  const [jenisLogistik, setJenisLogistik] = useState<JenisLogistik>('internal')
  const [nomorResi, setNomorResi] = useState('')
  const [driverNama, setDriverNama] = useState('')
  const [driverKontak, setDriverKontak] = useState('')
  const [driverPlat, setDriverPlat] = useState('')
  const [fileFoto, setFileFoto] = useState<File | null>(null)
  const [busy, setBusy] = useState(false)

  if (!isOpen) return null

  const is3PL = jenisLogistik !== 'internal'

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!driverNama.trim()) {
      toast.error('Nama supir / kurir wajib diisi')
      return
    }

    if (is3PL && !nomorResi.trim()) {
      toast.error(`Nomor Order / Resi ${jenisLogistik.toUpperCase()} wajib diisi untuk pelacakan`)
      return
    }

    setBusy(true)
    try {
      let fotoUrl = ''
      if (fileFoto) {
        const supabase = createClient()
        const ext = fileFoto.name.split('.').pop() || 'jpg'
        const path = `serah-terima/${retur.id}_${Date.now()}.${ext}`

        // Coba upload ke retur_evidence
        const { data: upData, error: upErr } = await supabase.storage
          .from('retur_evidence')
          .upload(path, fileFoto)

        if (upErr) {
          // Fallback ke waste_evidence
          const fallback = await supabase.storage.from('waste_evidence').upload(`retur/${path}`, fileFoto)
          if (fallback.error) throw fallback.error
          fotoUrl = supabase.storage.from('waste_evidence').getPublicUrl(fallback.data.path).data.publicUrl
        } else {
          fotoUrl = supabase.storage.from('retur_evidence').getPublicUrl(upData.path).data.publicUrl
        }
      }

      await serahTerima.mutateAsync({
        retur_id: retur.id,
        jenis_logistik: jenisLogistik,
        nomor_resi: nomorResi.trim() || undefined,
        driver_nama: driverNama.trim(),
        driver_kontak: driverKontak.trim() || undefined,
        driver_plat: driverPlat.trim() || undefined,
        foto_serah_terima: fotoUrl || undefined,
      })

      toast.success('Serah terima kurir berhasil dicatat. Status: Dalam Pengiriman.')
      onClose()
    } catch (err: any) {
      toast.error(err.message || 'Gagal mencatat serah terima kurir')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-[#d9c2b2]/40 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between pb-4 border-b border-gray-100 mb-4">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-amber-50 text-amber-800">
              <Truck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-[#1e1b15] text-base">Serahkan Fisik ke Kurir</h3>
              <p className="text-xs text-gray-500 font-medium">Tiket: {retur.nomor_retur}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-gray-400 hover:text-gray-700 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 text-xs font-semibold text-gray-700">
          <div>
            <label className="block mb-1 font-bold uppercase tracking-wider text-[11px] text-gray-600">
              Jenis Ekspedisi / Armada
            </label>
            <select
              value={jenisLogistik}
              onChange={(e) => setJenisLogistik(e.target.value as JenisLogistik)}
              className="w-full px-3 py-2.5 rounded-xl border border-gray-200 focus:outline-hidden focus:border-amber-600 font-medium text-sm bg-white"
            >
              {LOGISTIK_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {is3PL && (
            <div className="p-3 bg-blue-50/70 rounded-xl border border-blue-100 space-y-3">
              <p className="text-[11px] text-blue-900 font-bold">
                ℹ️ Pengiriman via kurir online pihak ketiga ({jenisLogistik.toUpperCase()})
              </p>
              <div>
                <label className="block mb-1 text-[11px] font-bold text-gray-700">
                  Nomor Order / Resi {jenisLogistik.toUpperCase()} <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  placeholder="Contoh: LLM-20260914-8821"
                  value={nomorResi}
                  onChange={(e) => setNomorResi(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 focus:outline-hidden focus:border-blue-600 text-sm font-mono bg-white"
                  required={is3PL}
                />
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block mb-1 text-[11px] font-bold text-gray-700">
                Nama Supir / Driver <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                placeholder="Nama kurir"
                value={driverNama}
                onChange={(e) => setDriverNama(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-gray-200 focus:outline-hidden focus:border-amber-600 text-sm bg-white"
                required
              />
            </div>
            <div>
              <label className="block mb-1 text-[11px] font-bold text-gray-700">
                Plat Nomor Kendaraan
              </label>
              <input
                type="text"
                placeholder="Misal: B 1234 XYZ"
                value={driverPlat}
                onChange={(e) => setDriverPlat(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-gray-200 focus:outline-hidden focus:border-amber-600 text-sm uppercase bg-white"
              />
            </div>
          </div>

          <div>
            <label className="block mb-1 text-[11px] font-bold text-gray-700">
              No. HP / Kontak Driver (Opsional)
            </label>
            <input
              type="text"
              placeholder="08xxxxxxxxxx"
              value={driverKontak}
              onChange={(e) => setDriverKontak(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-gray-200 focus:outline-hidden focus:border-amber-600 text-sm bg-white"
            />
          </div>

          <div>
            <label className="block mb-1 text-[11px] font-bold text-gray-700">
              Foto Bukti Serah Terima Paket (Opsional tapi disarankan)
            </label>
            <label className="border-2 border-dashed border-gray-300 hover:border-amber-600 rounded-xl p-4 flex flex-col items-center justify-center cursor-pointer bg-gray-50/50 hover:bg-amber-50/30 transition-colors">
              <UploadCloud className="w-6 h-6 text-gray-400 mb-1" />
              <span className="text-xs font-bold text-gray-600">
                {fileFoto ? fileFoto.name : 'Pilih / Ambil Foto Serah Terima'}
              </span>
              <span className="text-[10px] text-gray-400">Foto paket bersama supir atau plat kendaraan</span>
              <input
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={(e) => setFileFoto(e.target.files?.[0] || null)}
              />
            </label>
          </div>

          <div className="pt-2 flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={busy}
              className="px-4 py-2 rounded-xl text-xs font-bold text-gray-600 hover:bg-gray-100 transition-colors"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={busy}
              className="px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-amber-800 hover:bg-amber-900 shadow-xs flex items-center gap-2 transition-colors disabled:opacity-50"
            >
              {busy && <Loader2 className="w-4 h-4 animate-spin" />}
              Konfirmasi Serah Terima
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
