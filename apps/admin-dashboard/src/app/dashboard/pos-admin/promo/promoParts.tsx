'use client'

import { useMemo, useRef, useState, useEffect } from 'react'
import { Check, ChevronDown, Search, Store, UtensilsCrossed, X } from 'lucide-react'
import { CheckMark } from '@/components/ui/controls'
import { isRewardEligible } from '@/lib/promoReward'
import { STATUS_LABEL, type PromoStatus } from '@/lib/promoSchedule'
import type { MenuItem, Outlet, OutletPromo } from './promoTypes'

export const rupiah = (n: number | null | undefined) => `Rp ${Number(n || 0).toLocaleString('id-ID')}`

/* ───────────────────────── Foto menu ───────────────────────── */

/**
 * Foto asli menu bisa ratusan KB. Supabase Storage punya endpoint render yang
 * mengecilkan di server (±20–35 KB untuk 2× lebar tampil), jadi halaman berisi
 * puluhan menu tetap ringan. URL non-Supabase dipakai apa adanya.
 */
export function menuThumbUrl(url: string | null | undefined, width: number, height?: number): string | null {
  if (!url) return null
  if (!url.includes('/storage/v1/object/public/')) return url
  const params = new URLSearchParams({ width: String(width), quality: '70', resize: 'cover' })
  if (height) params.set('height', String(height))
  return `${url.replace('/storage/v1/object/public/', '/storage/v1/render/image/public/')}?${params}`
}

export function MenuThumb({
  menu,
  size,
  className = '',
}: {
  menu: Pick<MenuItem, 'name' | 'image_url'>
  /** Lebar tampil (px). Gambar diminta 2× untuk layar retina. */
  size: number
  className?: string
}) {
  const [failed, setFailed] = useState(false)
  const src = failed ? null : menuThumbUrl(menu.image_url, size * 2, size * 2)
  if (!src) {
    return (
      <div className={`flex items-center justify-center bg-suka-cream text-suka-orange/60 ${className}`} aria-hidden>
        <UtensilsCrossed className="h-1/3 w-1/3" />
      </div>
    )
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={menu.name}
      loading="lazy"
      decoding="async"
      onError={() => setFailed(true)}
      className={`bg-suka-cream object-cover ${className}`}
    />
  )
}

/* ───────────────────────── Status ───────────────────────── */

const STATUS_STYLE: Record<PromoStatus, string> = {
  nonaktif: 'bg-slate-100 text-slate-500',
  terjadwal: 'bg-violet-50 text-violet-700',
  berjalan: 'bg-emerald-50 text-emerald-700',
  berakhir: 'bg-rose-50 text-rose-700',
}

export function StatusBadge({ status }: { status: PromoStatus }) {
  return (
    <span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-bold ${STATUS_STYLE[status]}`}>
      <span className={`h-1.5 w-1.5 rounded-full bg-current ${status === 'berjalan' ? 'animate-pulse motion-reduce:animate-none' : ''}`} />
      {STATUS_LABEL[status]}
    </span>
  )
}

/** Kalimat aturan promo yang dibaca manusia, mis. "Beli 1 → Gratis 1 Sapi Sedang". */
export function promoRule(promo: OutletPromo, rewardName: string): string {
  if (promo.discount_type === 'buy_one_get_one') {
    return `Beli ${promo.buy_quantity ?? 1} → Gratis ${promo.get_quantity ?? 1} ${rewardName}`
  }
  if (promo.discount_type === 'percentage') return promo.discount_value ? `Diskon ${promo.discount_value}%` : 'Diskon %'
  return promo.discount_value ? `Potongan ${rupiah(promo.discount_value)}` : 'Potongan Rp'
}

/* ───────────────────────── Menu gratis (combobox bergambar) ───────────────────────── */

/**
 * Pemilih menu gratis Buy X Get Y. Paket tidak bisa dipilih (paket butuh pilihan
 * isi di kasir). Menu bernama sama hanya tampil sekali — server menukarnya ke
 * menu milik tiap outlet (lihat resolveRewardMenuForOutlet).
 */
export function RewardMenuPicker({
  menuItems,
  value,
  onChange,
}: {
  menuItems: MenuItem[]
  value: string | null
  onChange: (menuId: string) => void
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const rootRef = useRef<HTMLDivElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)

  const options = useMemo(() => {
    const seen = new Set<string>()
    return [...menuItems]
      .filter(isRewardEligible)
      .sort((a, b) => (a.outlet_id == null ? 0 : 1) - (b.outlet_id == null ? 0 : 1))
      .filter(m => {
        const key = m.name.trim().toLowerCase()
        if (seen.has(key)) return false
        seen.add(key)
        return true
      })
      .sort((a, b) => a.name.localeCompare(b.name, 'id'))
  }, [menuItems])

  useEffect(() => {
    if (!open) return
    setTimeout(() => searchRef.current?.focus(), 30)
    const close = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false)
    }
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('mousedown', close)
    document.addEventListener('keydown', esc)
    return () => {
      document.removeEventListener('mousedown', close)
      document.removeEventListener('keydown', esc)
      setQuery('')
    }
  }, [open])

  const selected = menuItems.find(m => m.id === value) || null
  const keyword = query.trim().toLowerCase()
  const visible = keyword ? options.filter(m => m.name.toLowerCase().includes(keyword)) : options

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label="Menu gratis"
        onClick={() => setOpen(o => !o)}
        className="flex w-full cursor-pointer items-center gap-3 rounded-xl border border-slate-200 bg-white p-2 pr-3 text-left transition-colors hover:border-suka-orange/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-suka-orange/30"
      >
        {selected ? (
          <MenuThumb menu={selected} size={44} className="h-11 w-11 shrink-0 rounded-lg" />
        ) : (
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-dashed border-slate-300 text-slate-300">
            <UtensilsCrossed className="h-4 w-4" />
          </span>
        )}
        <span className="min-w-0 flex-1">
          <span className={`block truncate text-sm font-bold ${selected ? 'text-slate-900' : 'text-slate-400'}`}>
            {selected?.name || 'Pilih menu gratis'}
          </span>
          {selected && <span className="block text-xs font-medium text-slate-500">Harga normal {rupiah(selected.price)} · jadi Rp 0</span>}
        </span>
        <ChevronDown className={`h-4 w-4 shrink-0 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute left-0 right-0 z-50 mt-1.5 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_16px_40px_-12px_rgba(64,10,7,0.25)]">
          <div className="border-b border-slate-100 p-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                ref={searchRef}
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="Cari menu..."
                aria-label="Cari menu gratis"
                className="w-full rounded-lg bg-slate-50 py-2 pl-9 pr-3 text-sm font-medium text-slate-900 outline-none focus:bg-white focus:ring-2 focus:ring-suka-orange/20"
              />
            </div>
          </div>
          <ul role="listbox" aria-label="Pilihan menu gratis" className="max-h-72 overflow-y-auto p-1.5">
            {visible.length === 0 && <li className="px-3 py-4 text-center text-xs font-medium text-slate-500">Menu tidak ditemukan.</li>}
            {visible.map(m => {
              const active = m.id === value
              return (
                <li key={m.id}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={active}
                    onClick={() => {
                      onChange(m.id)
                      setOpen(false)
                    }}
                    className={`flex w-full cursor-pointer items-center gap-3 rounded-xl p-1.5 pr-3 text-left transition-colors ${
                      active ? 'bg-suka-orange/10' : 'hover:bg-slate-50'
                    }`}
                  >
                    <MenuThumb menu={m} size={36} className="h-9 w-9 shrink-0 rounded-lg" />
                    <span className="min-w-0 flex-1 truncate text-sm font-semibold text-slate-800">{m.name}</span>
                    <span className="shrink-0 text-xs font-medium text-slate-400">{rupiah(m.price)}</span>
                    {active && <Check className="h-4 w-4 shrink-0 text-suka-brown" />}
                  </button>
                </li>
              )
            })}
          </ul>
        </div>
      )}
    </div>
  )
}

/* ───────────────────────── Outlet ───────────────────────── */

/**
 * Pemilih outlet untuk satu promo. Sebagian besar promo berlaku di semua cabang,
 * jadi daftar outlet baru muncul saat admin memilih "Outlet tertentu".
 */
export function OutletScopePicker({
  outlets,
  selectedIds,
  onChange,
}: {
  outlets: Outlet[]
  selectedIds: string[]
  onChange: (ids: string[]) => void
}) {
  const allIds = outlets.map(o => o.id)
  const isAll = allIds.length > 0 && allIds.every(id => selectedIds.includes(id))
  const [mode, setMode] = useState<'all' | 'some'>(isAll ? 'all' : 'some')
  const [query, setQuery] = useState('')
  const keyword = query.trim().toLowerCase()
  const visible = keyword ? outlets.filter(o => o.name.toLowerCase().includes(keyword)) : outlets

  const toggle = (id: string) => {
    const next = selectedIds.includes(id) ? selectedIds.filter(x => x !== id) : [...selectedIds, id]
    // Urutan disamakan dengan daftar outlet supaya hasil simpan stabil.
    onChange(allIds.filter(x => next.includes(x)))
  }

  const pick = (next: 'all' | 'some') => {
    setMode(next)
    // Pindah ke "Outlet tertentu" tidak mengubah pilihan yang sudah ada.
    if (next === 'all') onChange(allIds)
  }

  return (
    <div className="space-y-3">
      <div role="radiogroup" aria-label="Cakupan outlet" className="grid grid-cols-2 gap-2">
        {([
          ['all', 'Semua outlet', `${allIds.length} outlet aktif`],
          ['some', 'Outlet tertentu', mode === 'some' ? `${selectedIds.length} dipilih` : 'Pilih sendiri'],
        ] as const).map(([value, label, hint]) => {
          const active = mode === value
          return (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => pick(value)}
              className={`flex cursor-pointer items-center gap-3 rounded-xl border-2 p-3 text-left transition-colors ${
                active ? 'border-suka-orange bg-suka-orange/5' : 'border-slate-200 bg-white hover:border-slate-300'
              }`}
            >
              <span className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2 ${active ? 'border-suka-orange' : 'border-slate-300'}`}>
                {active && <span className="h-2 w-2 rounded-full bg-suka-orange" />}
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-bold text-slate-900">{label}</span>
                <span className="block text-xs font-medium text-slate-500">{hint}</span>
              </span>
            </button>
          )
        })}
      </div>

      {mode === 'some' && (
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative min-w-[11rem] flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="Cari outlet..."
                aria-label="Cari outlet"
                className="w-full rounded-xl border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm font-medium text-slate-900 outline-none focus:border-suka-orange focus:ring-2 focus:ring-suka-orange/15"
              />
            </div>
            <button type="button" onClick={() => onChange(allIds)} className="cursor-pointer px-1 text-xs font-bold text-suka-brown hover:underline">
              Pilih semua
            </button>
            <button type="button" onClick={() => onChange([])} className="cursor-pointer px-1 text-xs font-bold text-slate-500 hover:text-slate-800">
              Kosongkan
            </button>
          </div>
          <div className="grid max-h-60 grid-cols-1 gap-1 overflow-y-auto rounded-xl border border-slate-200 bg-white p-1.5 sm:grid-cols-2">
            {visible.length === 0 ? (
              <p className="col-span-full px-3 py-4 text-xs font-medium text-slate-500">Outlet tidak ditemukan.</p>
            ) : (
              visible.map(o => {
                const active = selectedIds.includes(o.id)
                return (
                  <button
                    key={o.id}
                    type="button"
                    role="checkbox"
                    aria-checked={active}
                    onClick={() => toggle(o.id)}
                    className={`flex cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2 text-left transition-colors ${active ? 'bg-suka-orange/5' : 'hover:bg-slate-50'}`}
                  >
                    <CheckMark checked={active} />
                    <span className={`truncate text-sm font-semibold ${active ? 'text-slate-900' : 'text-slate-500'}`}>{o.name}</span>
                  </button>
                )
              })
            )}
          </div>
          <p className={`text-xs font-semibold ${selectedIds.length === 0 ? 'text-rose-600' : 'text-slate-500'}`}>
            {selectedIds.length === 0 ? 'Pilih minimal satu outlet agar promo bisa disimpan.' : `${selectedIds.length} dari ${allIds.length} outlet terpilih.`}
          </p>
        </div>
      )}
    </div>
  )
}

export function OutletScopeBadge({ outlets, selectedIds }: { outlets: Outlet[]; selectedIds: string[] }) {
  const total = outlets.length
  const count = selectedIds.length
  if (total === 0) return null
  const all = count >= total
  return (
    <span
      title={all ? undefined : outlets.filter(o => selectedIds.includes(o.id)).map(o => o.name).join(', ')}
      className="inline-flex items-center gap-1 whitespace-nowrap rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-bold text-slate-600"
    >
      <Store className="h-3 w-3" />
      {all ? 'Semua outlet' : `${count} outlet`}
    </span>
  )
}

/* ───────────────────────── Pengecualian menu (promo global) ───────────────────────── */

export function MenuExclusionPicker({
  menuItems,
  selectedIds,
  onChange,
}: {
  menuItems: MenuItem[]
  selectedIds: string[]
  onChange: (ids: string[]) => void
}) {
  const [query, setQuery] = useState('')
  const keyword = query.trim().toLowerCase()
  const visible = keyword ? menuItems.filter(m => m.name.toLowerCase().includes(keyword)) : menuItems
  const allIds = menuItems.map(m => m.id)
  const selected = menuItems.filter(m => selectedIds.includes(m.id))

  const toggle = (id: string) => {
    const next = selectedIds.includes(id) ? selectedIds.filter(x => x !== id) : [...selectedIds, id]
    // Urutan disamakan dengan daftar menu supaya hasil simpan stabil.
    onChange(allIds.filter(x => next.includes(x)))
  }

  return (
    <div className="space-y-3">
      {selected.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          {selected.map(m => (
            <span key={m.id} className="inline-flex items-center gap-1.5 rounded-full border border-rose-200 bg-rose-50 py-0.5 pl-0.5 pr-1.5 text-xs font-semibold text-rose-700">
              <MenuThumb menu={m} size={20} className="h-5 w-5 rounded-full" />
              {m.name}
              <button type="button" onClick={() => toggle(m.id)} aria-label={`Hapus ${m.name} dari pengecualian`} className="cursor-pointer rounded-full p-0.5 text-rose-400 hover:bg-rose-100 hover:text-rose-700">
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
          <button type="button" onClick={() => onChange([])} className="cursor-pointer px-1 text-xs font-bold text-slate-500 hover:text-slate-800">
            Kosongkan
          </button>
        </div>
      )}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Cari menu untuk dikecualikan..."
          aria-label="Cari menu untuk dikecualikan"
          className="w-full rounded-xl border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm font-medium text-slate-900 outline-none focus:border-suka-orange focus:ring-2 focus:ring-suka-orange/15"
        />
      </div>
      <div className="max-h-64 space-y-0.5 overflow-y-auto rounded-xl border border-slate-200 bg-white p-1.5">
        {visible.length === 0 ? (
          <p className="px-3 py-4 text-xs font-medium text-slate-500">Menu tidak ditemukan.</p>
        ) : (
          visible.map(m => {
            const active = selectedIds.includes(m.id)
            return (
              <button
                key={m.id}
                type="button"
                role="checkbox"
                aria-checked={active}
                onClick={() => toggle(m.id)}
                className={`flex w-full cursor-pointer items-center gap-3 rounded-lg p-1.5 pr-3 text-left transition-colors ${active ? 'bg-rose-50' : 'hover:bg-slate-50'}`}
              >
                <CheckMark checked={active} />
                <MenuThumb menu={m} size={32} className="h-8 w-8 shrink-0 rounded-md" />
                <span className={`min-w-0 flex-1 truncate text-sm font-semibold ${active ? 'text-rose-700 line-through decoration-rose-300' : 'text-slate-700'}`}>{m.name}</span>
                <span className="shrink-0 text-xs font-medium text-slate-400">{rupiah(m.price)}</span>
              </button>
            )
          })
        )}
      </div>
    </div>
  )
}
