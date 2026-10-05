'use client'
import { useState } from 'react'
import { MapPin, Loader2, CheckCircle2, ExternalLink, AlertCircle, Clock, Power } from 'lucide-react'
import { Button } from '@suka/design-system'
import { toast } from 'sonner'
import { slugify } from '@/lib/slugify'
import { resolveLokasiGoogleMaps } from '@/app/dashboard/outlets/lokasiActions'
import type { OutletFormValues, OutletStatus } from '@/lib/types'
import { TIPE_OUTLET, LABEL_TIPE_OUTLET, adalahTipeOutlet, labelNonOutlet } from '@/lib/outletType'
import { Select } from '@/components/ui/Select'

const inputCls =
  'w-full rounded-xl border border-suka-gray-200 px-3 py-2 text-sm outline-none focus:border-suka-orange'

const EMPTY: OutletFormValues = {
  name: '', slug: '', address: '', lat: NaN, lng: NaN, type: 'internal', status: 'active', is_active: true, marquee_warning_threshold: 7,
  open_hour: '14:00', close_hour: '22:00'
}

export function OutletForm({
  initial, submitting, isEdit, onSubmit, onCancel
}: {
  initial?: OutletFormValues
  submitting: boolean
  isEdit: boolean
  onSubmit: (v: OutletFormValues) => void
  onCancel?: () => void
}) {
  const [v, setV] = useState<OutletFormValues>(() => {
    if (!initial) return EMPTY
    const resolvedStatus: OutletStatus = initial.status ?? (initial.is_active ? 'active' : 'pending')
    return {
      ...initial,
      status: resolvedStatus,
      is_active: resolvedStatus === 'active',
    }
  })
  const [slugTouched, setSlugTouched] = useState(isEdit)
  const [slugLocked, setSlugLocked] = useState(isEdit) // edit: read-only until "ubah slug"

  const [mapsInput, setMapsInput] = useState('')
  const [extracting, setExtracting] = useState(false)
  const [extractedInfo, setExtractedInfo] = useState<{
    lat: number
    lng: number
    akurasi: string
    alamat: string | null
  } | null>(null)

  const set = (patch: Partial<OutletFormValues>) => setV((prev) => ({ ...prev, ...patch }))

  function onName(name: string) {
    set({ name, ...(slugTouched ? {} : { slug: slugify(name) }) })
  }

  async function handleEkstrakLokasi() {
    if (extracting) return
    const cleanInput = mapsInput.trim()
    if (!cleanInput) {
      toast.error('Tempel link Google Maps atau koordinat terlebih dahulu')
      return
    }

    setExtracting(true)
    try {
      const res = await resolveLokasiGoogleMaps(cleanInput)
      if (!res.ok) {
        toast.error(res.pesan)
        return
      }

      setV((prev) => {
        const patch: Partial<OutletFormValues> = {
          lat: res.lat,
          lng: res.lng,
        }
        if (res.alamat) {
          patch.address = res.alamat
        }
        if (res.namaTempat && !prev.name.trim()) {
          patch.name = res.namaTempat
          patch.slug = slugify(res.namaTempat)
        }
        return { ...prev, ...patch }
      })

      setExtractedInfo({
        lat: res.lat,
        lng: res.lng,
        akurasi: res.akurasi,
        alamat: res.alamat,
      })

      toast.success('Lokasi berhasil diekstrak!')
      if (res.akurasi === 'tengah_peta') {
        toast.info('Titik diambil dari tampilan peta. Pastikan posisi sudah tepat.')
      }
    } catch {
      toast.error('Terjadi kesalahan saat mengekstrak lokasi')
    } finally {
      setExtracting(false)
    }
  }

  function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!v.name.trim()) { toast.error('Nama wajib diisi'); return }
    if (!v.slug.trim()) { toast.error('Slug wajib diisi'); return }
    if (!Number.isFinite(v.lat) || !Number.isFinite(v.lng)) { toast.error('Koordinat wajib diisi'); return }
    onSubmit(v)
  }

  return (
    <form onSubmit={submit} className="grid gap-3 sm:grid-cols-2">
      {/* Quick-Fill dari Google Maps */}
      <div className="sm:col-span-2 rounded-2xl border border-suka-orange/20 bg-orange-50/40 p-3.5 space-y-2.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-suka-orange">
            <MapPin className="w-3.5 h-3.5" />
            <span>Quick-Fill dari Google Maps</span>
          </div>
          <span className="text-[11px] text-suka-gray-500">
            Dukung link share HP, link web, atau koordinat
          </span>
        </div>

        <div className="flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1">
            <input
              type="text"
              aria-label="Link Google Maps atau koordinat"
              className="w-full rounded-xl border border-suka-gray-200 bg-white px-3 py-2 text-xs sm:text-sm outline-none focus:border-suka-orange transition-colors"
              placeholder="Tempel link Google Maps (maps.app.goo.gl / google.com/maps) atau koordinat..."
              value={mapsInput}
              onChange={(e) => setMapsInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  handleEkstrakLokasi()
                }
              }}
              disabled={extracting}
            />
          </div>
          <button
            type="button"
            onClick={handleEkstrakLokasi}
            disabled={extracting || !mapsInput.trim()}
            className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-suka-orange text-white text-xs font-medium hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm shrink-0"
          >
            {extracting ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Mengekstrak…</span>
              </>
            ) : (
              <>
                <MapPin className="w-3.5 h-3.5" />
                <span>Ekstrak Lokasi</span>
              </>
            )}
          </button>
        </div>

        {extractedInfo && (
          <div className="space-y-1.5 pt-0.5">
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-emerald-700 bg-emerald-50/80 border border-emerald-200 rounded-xl px-3 py-1.5">
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                <span>
                  {extractedInfo.alamat ? 'Titik & Alamat' : 'Titik koordinat'} berhasil diekstrak ({extractedInfo.lat.toFixed(5)}, {extractedInfo.lng.toFixed(5)})
                </span>
              </div>
              <a
                href={`https://www.google.com/maps?q=${extractedInfo.lat},${extractedInfo.lng}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-800 hover:underline"
              >
                <span>Lihat di Maps</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
            {extractedInfo.akurasi === 'tengah_peta' && (
              <div className="flex items-center gap-1.5 text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-3 py-1">
                <AlertCircle className="w-3 h-3 text-amber-600 shrink-0" />
                <span>Titik diambil dari tampilan peta. Pastikan posisi sudah tepat.</span>
              </div>
            )}
          </div>
        )}
      </div>

      <label className="text-sm">
        <span className="mb-1 block font-medium text-suka-ink">Nama</span>
        <input className={inputCls} value={v.name} onChange={(e) => onName(e.target.value)} />
      </label>

      <label className="text-sm">
        <span className="mb-1 block font-medium text-suka-ink">Slug</span>
        <div className="flex items-center gap-2">
          <input
            className={inputCls} value={v.slug} readOnly={slugLocked}
            onChange={(e) => { setSlugTouched(true); set({ slug: slugify(e.target.value) }) }}
          />
          {isEdit && slugLocked && (
            <button type="button" className="whitespace-nowrap text-xs text-suka-orange"
              onClick={() => { setSlugLocked(false); toast('Mengubah slug bisa memutus link lama') }}>
              ubah slug
            </button>
          )}
        </div>
      </label>

      <label className="text-sm sm:col-span-2">
        <span className="mb-1 block font-medium text-suka-ink">Alamat</span>
        <input className={inputCls} value={v.address} onChange={(e) => set({ address: e.target.value })} />
      </label>

      <label className="text-sm">
        <span className="mb-1 block font-medium text-suka-ink">Latitude</span>
        <input type="number" step="any" className={inputCls}
          value={Number.isFinite(v.lat) ? v.lat : ''}
          onChange={(e) => set({ lat: e.target.value === '' ? NaN : Number(e.target.value) })} />
      </label>

      <label className="text-sm">
        <span className="mb-1 block font-medium text-suka-ink">Longitude</span>
        <input type="number" step="any" className={inputCls}
          value={Number.isFinite(v.lng) ? v.lng : ''}
          onChange={(e) => set({ lng: e.target.value === '' ? NaN : Number(e.target.value) })} />
      </label>

      <div className="text-sm">
        <span className="mb-1 block font-medium text-suka-ink">Tipe</span>
        {isEdit && !adalahTipeOutlet(initial?.type) ? (
          // Gudang/marketplace/tes dll. bukan outlet: tipenya yang mengeluarkan
          // mereka dari laporan, jadi tak bisa diganti dari sini.
          <p className="rounded-xl border border-suka-gray-200 bg-suka-gray-50 px-3 py-2 text-suka-gray-500">
            Lokasi non-outlet ({labelNonOutlet(initial?.type)})
          </p>
        ) : (
          <Select
            options={TIPE_OUTLET.map((t) => ({ value: t, label: LABEL_TIPE_OUTLET[t] }))}
            value={v.type}
            onChange={(t) => set({ type: t })}
            placeholder="Pilih tipe outlet"
          />
        )}
      </div>

      <label className="text-sm">
        <span className="mb-1 block font-medium text-suka-ink">Batas Peringatan Porsi (Marquee)</span>
        <input type="number" min="0" className={inputCls} value={v.marquee_warning_threshold} onChange={(e) => set({ marquee_warning_threshold: parseInt(e.target.value) || 0 })} />
      </label>

      <label className="text-sm">
        <span className="mb-1 block font-medium text-suka-ink">Jam Buka</span>
        <input type="time" className={inputCls} value={v.open_hour || '14:00'} onChange={(e) => set({ open_hour: e.target.value })} />
      </label>

      <label className="text-sm">
        <span className="mb-1 block font-medium text-suka-ink">Jam Tutup</span>
        <input type="time" className={inputCls} value={v.close_hour || '22:00'} onChange={(e) => set({ close_hour: e.target.value })} />
      </label>

      {/* Status Outlet (Custom UI - Dilarang Native Browser Controls) */}
      <div className="sm:col-span-2 space-y-2">
        <label className="block text-sm font-bold text-suka-ink">
          Status Outlet <span className="text-suka-orange font-normal">(Wajib Dipilih)</span>
        </label>
        <div className={`grid gap-2.5 ${isEdit ? 'grid-cols-1 sm:grid-cols-3' : 'grid-cols-1 sm:grid-cols-2'}`}>
          {/* Opsi 1: Aktif */}
          <button
            type="button"
            onClick={() => set({ status: 'active', is_active: true })}
            className={`p-3.5 rounded-2xl border text-left transition-all flex items-start gap-3 min-h-[56px] active:scale-[0.99] ${
              v.status === 'active' || (!v.status && v.is_active)
                ? 'bg-emerald-50 border-emerald-500 ring-2 ring-emerald-500/20'
                : 'bg-white border-suka-gray-200 hover:border-emerald-300'
            }`}
          >
            <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 mt-0.5 ${
              v.status === 'active' || (!v.status && v.is_active)
                ? 'bg-emerald-600 text-white'
                : 'bg-emerald-50 text-emerald-600'
            }`}>
              <CheckCircle2 className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="text-sm font-bold text-suka-ink">Aktif</span>
                <span className="text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800">
                  Operasional
                </span>
              </div>
              <p className="text-xs text-suka-gray-500 mt-0.5 leading-snug">
                Beroperasi penuh melayani pesanan & presensi. Terhitung di produksi & target.
              </p>
            </div>
          </button>

          {/* Opsi 2: Pending */}
          <button
            type="button"
            onClick={() => set({ status: 'pending', is_active: false })}
            className={`p-3.5 rounded-2xl border text-left transition-all flex items-start gap-3 min-h-[56px] active:scale-[0.99] ${
              v.status === 'pending'
                ? 'bg-amber-50 border-amber-500 ring-2 ring-amber-500/20'
                : 'bg-white border-suka-gray-200 hover:border-amber-300'
            }`}
          >
            <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 mt-0.5 ${
              v.status === 'pending'
                ? 'bg-amber-600 text-white'
                : 'bg-amber-50 text-amber-700'
            }`}>
              <Clock className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="text-sm font-bold text-suka-ink">Pending</span>
                <span className="text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded bg-amber-100 text-amber-800">
                  Persiapan
                </span>
              </div>
              <p className="text-xs text-suka-gray-500 mt-0.5 leading-snug">
                Persiapan pembukaan cabang. Dikecualikan dari produksi dapur & operasional.
              </p>
            </div>
          </button>

          {/* Opsi 3: Nonaktif (Hanya pada mode Edit) */}
          {isEdit && (
            <button
              type="button"
              onClick={() => set({ status: 'inactive', is_active: false })}
              className={`p-3.5 rounded-2xl border text-left transition-all flex items-start gap-3 min-h-[56px] active:scale-[0.99] ${
                v.status === 'inactive' || (!v.status && !v.is_active)
                  ? 'bg-gray-100 border-gray-400 ring-2 ring-gray-400/20'
                  : 'bg-white border-suka-gray-200 hover:border-gray-300'
              }`}
            >
              <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 mt-0.5 ${
                v.status === 'inactive' || (!v.status && !v.is_active)
                  ? 'bg-gray-700 text-white'
                  : 'bg-gray-100 text-gray-600'
              }`}>
                <Power className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-sm font-bold text-suka-ink">Nonaktif</span>
                  <span className="text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded bg-gray-200 text-gray-700">
                    Arsip
                  </span>
                </div>
                <p className="text-xs text-suka-gray-500 mt-0.5 leading-snug">
                  Cabang ditutup sementara/diarsipkan. Seluruh data transaksi tetap aman.
                </p>
              </div>
            </button>
          )}
        </div>
      </div>

      <div className="sm:col-span-2 sticky bottom-0 -mx-4 -mb-4 sm:-mx-6 sm:-mb-6 mt-4 p-4 sm:p-6 bg-white/95 backdrop-blur-md border-t border-suka-gray-100 flex items-center justify-end gap-3 z-10 shadow-[0_-4px_16px_rgba(0,0,0,0.04)]">
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 sm:flex-initial min-h-[44px] px-5 py-2.5 text-sm font-semibold text-suka-gray-500 hover:text-suka-ink transition-colors rounded-xl border border-suka-gray-200 sm:border-transparent active:scale-95"
          >
            Batal
          </button>
        )}
        <Button
          type="submit"
          disabled={submitting}
          className="flex-1 sm:flex-initial min-h-[44px] px-6 py-2.5 rounded-xl font-bold shadow-md shadow-suka-orange/20 active:scale-95"
        >
          {submitting ? 'Menyimpan…' : isEdit ? 'Simpan Perubahan' : 'Buat Outlet'}
        </Button>
      </div>
    </form>
  )
}
