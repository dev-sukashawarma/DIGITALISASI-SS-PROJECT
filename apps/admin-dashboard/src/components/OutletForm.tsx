'use client'
import { useState } from 'react'
import { Button } from '@suka/design-system'
import { toast } from 'sonner'
import { slugify } from '@/lib/slugify'
import { parseLatLng } from '@/lib/parseLatLng'
import type { OutletFormValues } from '@/lib/types'

const inputCls =
  'w-full rounded-xl border border-suka-gray-200 px-3 py-2 text-sm outline-none focus:border-suka-orange'

const EMPTY: OutletFormValues = {
  name: '', slug: '', address: '', lat: NaN, lng: NaN, type: 'outlet', is_active: true, marquee_warning_threshold: 7
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
  const [v, setV] = useState<OutletFormValues>(initial ?? EMPTY)
  const [slugTouched, setSlugTouched] = useState(isEdit)
  const [slugLocked, setSlugLocked] = useState(isEdit) // edit: read-only until "ubah slug"
  const set = (patch: Partial<OutletFormValues>) => setV((prev) => ({ ...prev, ...patch }))

  function onName(name: string) {
    set({ name, ...(slugTouched ? {} : { slug: slugify(name) }) })
  }

  function onPaste() {
    const text = prompt('Tempel koordinat dari Google Maps (contoh: -6.5971, 106.8060)')
    if (!text) return
    const parsed = parseLatLng(text)
    if (!parsed) { toast.error('Format koordinat tidak dikenali'); return }
    set({ lat: parsed.lat, lng: parsed.lng })
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

      <div className="sm:col-span-2">
        <button type="button" onClick={onPaste} className="text-xs font-medium text-suka-orange">
          Paste dari Google Maps
        </button>
      </div>

      <label className="text-sm">
        <span className="mb-1 block font-medium text-suka-ink">Tipe</span>
        <input className={inputCls} value={v.type} onChange={(e) => set({ type: e.target.value })} />
      </label>

      <label className="text-sm">
        <span className="mb-1 block font-medium text-suka-ink">Batas Peringatan Porsi (Marquee)</span>
        <input type="number" min="0" className={inputCls} value={v.marquee_warning_threshold} onChange={(e) => set({ marquee_warning_threshold: parseInt(e.target.value) || 0 })} />
      </label>

      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={v.is_active} onChange={(e) => set({ is_active: e.target.checked })} />
        <span className="font-medium text-suka-ink">Aktif</span>
      </label>

      <div className="sm:col-span-2 flex items-center justify-end gap-3 mt-4 pt-4 border-t border-suka-gray-100">
        {onCancel && (
          <button type="button" onClick={onCancel} className="px-4 py-2 text-sm font-medium text-suka-gray-500 hover:text-suka-ink transition-colors">
            Batal
          </button>
        )}
        <Button type="submit" disabled={submitting} className="rounded-xl">
          {submitting ? 'Menyimpan…' : isEdit ? 'Simpan Perubahan' : 'Buat Outlet'}
        </Button>
      </div>
    </form>
  )
}
