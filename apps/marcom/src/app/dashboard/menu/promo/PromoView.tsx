'use client'

import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import {
  Loader2,
  Tag,
  Percent,
  CheckCircle2,
  AlertCircle,
  Search,
  CalendarClock,
  Check,
  Store,
  Ban,
  X,
} from 'lucide-react'
import { CurrencyInput } from '@/components/ui/CurrencyInput'
import { savePromosAction } from './actions'
import PromoDailyScheduleEditor from './PromoDailyScheduleEditor'
import { toWibInputValue, fromWibInputValue, formatWib, WIB_LABEL } from '@/lib/timezone'
import {
  getPromoStatus,
  validateSchedule,
  STATUS_LABEL,
  type PromoDaySchedule,
  type PromoStatus,
} from '@/lib/promoSchedule'
import { resolvePromoOutletIds } from '@/lib/promoOutlets'
import { cn } from '@/lib/utils'

type MenuItem = {
  id: string
  name: string
  price: number
}

type OutletPromo = {
  id?: string
  outlet_id?: string
  scope: 'global' | 'item'
  menu_item_id: string | null
  discount_type: 'percentage' | 'nominal' | 'buy_one_get_one'
  discount_value: number
  is_active: boolean
  min_purchase?: number | null
  usage_limit?: number | null
  current_usage?: number
  quota_scope?: 'global' | 'per_outlet'
  quota_pool_id?: string | null
  start_date?: string | null
  end_date?: string | null
  daily_start_time?: string | null
  daily_end_time?: string | null
  daily_schedule?: PromoDaySchedule[] | null
  apply_to_food_apps?: boolean
  sync_to_order_online?: boolean
  promo_name?: string | null
  buy_quantity?: number
  get_quantity?: number
  reward_menu_item_id?: string | null
  outlet_ids?: string[]
  excluded_menu_item_ids?: string[] | null
}

type Outlet = {
  id: string
  name: string
}

interface PromoViewProps {
  initialMenuItems: MenuItem[]
  initialOutlets: Outlet[]
  initialPromos: OutletPromo[]
}

const STATUS_STYLE: Record<PromoStatus, string> = {
  nonaktif: 'bg-stone-100 text-stone-600 border-stone-200',
  terjadwal: 'bg-violet-50 text-violet-700 border-violet-200',
  berjalan: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  berakhir: 'bg-rose-50 text-rose-700 border-rose-200',
}

function StatusBadge({ status }: { status: PromoStatus }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-bold',
        STATUS_STYLE[status]
      )}
    >
      <span className="w-1.5 h-1.5 rounded-full bg-current" />
      {STATUS_LABEL[status]}
    </span>
  )
}

function ScheduleSummary({ promo }: { promo: OutletPromo }) {
  if (promo.daily_schedule && promo.daily_schedule.length > 0) {
    return (
      <p className="text-xs text-stone-500">
        Jadwal per tanggal: {promo.daily_schedule.length} tanggal terdaftar
        {promo.start_date || promo.end_date
          ? ' · batas promo tetap mengikuti tanggal mulai/selesai di atas'
          : ''}
        .
      </p>
    )
  }
  if (!promo.start_date && !promo.end_date) {
    return <p className="text-xs text-stone-500">Tanpa jadwal — berlaku selama promo dinyalakan.</p>
  }
  return (
    <p className="text-xs text-stone-500">
      {promo.start_date ? `Mulai ${formatWib(promo.start_date)}` : 'Mulai sejak dinyalakan'}
      {' · '}
      {promo.end_date ? `Selesai ${formatWib(promo.end_date)}` : 'Tanpa batas akhir'}
    </p>
  )
}

function OutletScopeBadge({ outlets, selectedIds }: { outlets: Outlet[]; selectedIds: string[] }) {
  const total = outlets.length
  const count = selectedIds.length
  if (total === 0 || count === 0 || count >= total) return null
  const names = outlets
    .filter((o) => selectedIds.includes(o.id))
    .map((o) => o.name)
    .join(', ')
  return (
    <span
      title={names}
      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-bold bg-amber-50 text-amber-800 border-amber-200"
    >
      <Store className="w-3.5 h-3.5 text-amber-600" />
      {count} dari {total} cabang
    </span>
  )
}

const OUTLET_PICKER_STYLE = {
  amber: {
    box: 'border-amber-200/80 bg-amber-50/40',
    icon: 'text-amber-600',
    on: 'bg-amber-500 text-white',
    link: 'text-amber-700 hover:text-amber-900',
    accent: 'accent-amber-500',
  },
  blue: {
    box: 'border-stone-200 bg-stone-50/50',
    icon: 'text-amber-600',
    on: 'bg-stone-900 text-white',
    link: 'text-stone-700 hover:text-stone-900',
    accent: 'accent-amber-500',
  },
} as const

function OutletScopePicker({
  outlets,
  selectedIds,
  onChange,
  accent,
}: {
  outlets: Outlet[]
  selectedIds: string[]
  onChange: (ids: string[]) => void
  accent: keyof typeof OUTLET_PICKER_STYLE
}) {
  const style = OUTLET_PICKER_STYLE[accent]
  const allIds = outlets.map((o) => o.id)
  const isAll = allIds.length > 0 && allIds.every((id) => selectedIds.includes(id))
  const [mode, setMode] = useState<'all' | 'some'>(isAll ? 'all' : 'some')
  const [query, setQuery] = useState('')

  const keyword = query.trim().toLowerCase()
  const visibleOutlets = keyword
    ? outlets.filter((o) => o.name.toLowerCase().includes(keyword))
    : outlets

  const toggle = (id: string) => {
    const next = selectedIds.includes(id) ? selectedIds.filter((x) => x !== id) : [...selectedIds, id]
    onChange(allIds.filter((x) => next.includes(x)))
  }

  const selectMode = (next: 'all' | 'some') => {
    setMode(next)
    if (next === 'all') onChange(allIds)
  }

  return (
    <div className={cn('rounded-2xl border p-4 space-y-3', style.box)}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Store className={cn('w-4 h-4 shrink-0', style.icon)} />
          <h3 className="text-sm font-bold text-stone-800">Outlet yang Menerima Promo</h3>
        </div>
        <div className="inline-flex rounded-xl border border-stone-200 bg-white p-0.5 shadow-2xs">
          {([['all', 'Semua Outlet'], ['some', 'Pilih Outlet']] as const).map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => selectMode(value)}
              aria-pressed={mode === value}
              className={cn(
                'rounded-lg px-3 py-1.5 text-xs font-bold transition-all cursor-pointer',
                mode === value ? style.on : 'text-stone-500 hover:text-stone-800'
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {mode === 'all' ? (
        <p className="text-xs font-semibold text-stone-500">
          Promo berlaku secara global di seluruh {allIds.length} outlet cabang aktif.
        </p>
      ) : (
        <div className="space-y-2.5">
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative flex-1 min-w-[11rem]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Cari cabang outlet..."
                className="w-full rounded-xl border border-stone-200 bg-white pl-9 pr-3 py-1.5 text-xs sm:text-sm font-medium text-stone-900 outline-none transition-colors focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
              />
            </div>
            <button
              type="button"
              onClick={() => onChange(allIds)}
              className={cn('text-xs font-bold cursor-pointer', style.link)}
            >
              Pilih Semua
            </button>
            <button
              type="button"
              onClick={() => onChange([])}
              className="text-xs font-bold text-stone-500 hover:text-stone-800 cursor-pointer"
            >
              Kosongkan
            </button>
          </div>

          <div className="max-h-52 overflow-y-auto rounded-xl border border-stone-200 bg-white divide-y divide-stone-100">
            {visibleOutlets.length === 0 ? (
              <p className="px-3 py-4 text-xs font-medium text-stone-500">Outlet tidak ditemukan.</p>
            ) : (
              visibleOutlets.map((outlet) => {
                const active = selectedIds.includes(outlet.id)
                return (
                  <label
                    key={outlet.id}
                    className="flex cursor-pointer items-center gap-3 px-3 py-2 transition-colors hover:bg-amber-50/40"
                  >
                    <input
                      type="checkbox"
                      checked={active}
                      onChange={() => toggle(outlet.id)}
                      className={cn('h-4 w-4 shrink-0 rounded border-stone-300', style.accent)}
                    />
                    <span className={cn('text-xs sm:text-sm font-semibold', active ? 'text-stone-900 font-bold' : 'text-stone-500')}>
                      {outlet.name}
                    </span>
                  </label>
                )
              })
            )}
          </div>

          <p className={cn('text-xs font-semibold', selectedIds.length === 0 ? 'text-red-600' : 'text-stone-500')}>
            {selectedIds.length === 0
              ? 'Pilih minimal satu outlet agar promo dapat disimpan.'
              : `${selectedIds.length} dari ${allIds.length} outlet cabang terpilih.`}
          </p>
        </div>
      )}
    </div>
  )
}

function MenuExclusionPicker({
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
  const visible = keyword ? menuItems.filter((m) => m.name.toLowerCase().includes(keyword)) : menuItems
  const allIds = menuItems.map((m) => m.id)
  const selected = menuItems.filter((m) => selectedIds.includes(m.id))

  const toggle = (id: string) => {
    const next = selectedIds.includes(id) ? selectedIds.filter((x) => x !== id) : [...selectedIds, id]
    onChange(allIds.filter((x) => next.includes(x)))
  }

  return (
    <div className="rounded-2xl border border-rose-200 bg-rose-50/40 p-4 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <Ban className="w-4 h-4 shrink-0 text-rose-500" />
          <h3 className="text-sm font-bold text-stone-800">Menu yang Dikecualikan</h3>
        </div>
        <p className="text-xs font-semibold text-stone-500">
          {selected.length === 0 ? 'Semua menu ikut promo.' : `${selected.length} menu tidak ikut promo.`}
        </p>
      </div>
      <p className="text-xs text-stone-500">
        Menu yang dipilih di sini <b>tidak</b> mendapat diskon dari promo global ini. Jika menu tersebut memiliki Promo Per Menu, diskon per menu itulah yang berlaku.
      </p>

      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {selected.map((m) => (
            <span
              key={m.id}
              className="inline-flex items-center gap-1 rounded-full border border-rose-200 bg-white px-2.5 py-1 text-xs font-semibold text-rose-700 shadow-2xs"
            >
              {m.name}
              <button
                type="button"
                onClick={() => toggle(m.id)}
                aria-label={`Hapus ${m.name} dari pengecualian`}
                className="rounded-full p-0.5 text-rose-400 hover:bg-rose-100 hover:text-rose-700 cursor-pointer"
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}
          <button
            type="button"
            onClick={() => onChange([])}
            className="text-xs font-bold text-stone-500 hover:text-stone-800 px-1 cursor-pointer"
          >
            Kosongkan
          </button>
        </div>
      )}

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Cari menu untuk dikecualikan..."
          className="w-full rounded-xl border border-stone-200 bg-white pl-9 pr-3 py-1.5 text-xs sm:text-sm font-medium text-stone-900 outline-none transition-colors focus:ring-2 focus:ring-rose-500/20 focus:border-rose-400"
        />
      </div>

      <div className="max-h-52 overflow-y-auto rounded-xl border border-stone-200 bg-white divide-y divide-stone-100">
        {visible.length === 0 ? (
          <p className="px-3 py-4 text-xs font-medium text-stone-500">Menu tidak ditemukan.</p>
        ) : (
          visible.map((m) => {
            const active = selectedIds.includes(m.id)
            return (
              <label
                key={m.id}
                className="flex cursor-pointer items-center gap-3 px-3 py-2 transition-colors hover:bg-rose-50/50"
              >
                <input
                  type="checkbox"
                  checked={active}
                  onChange={() => toggle(m.id)}
                  className="h-4 w-4 shrink-0 rounded border-stone-300 accent-rose-500"
                />
                <span
                  className={cn(
                    'flex-1 min-w-0 truncate text-xs sm:text-sm font-semibold',
                    active ? 'text-rose-700 line-through decoration-rose-300 font-bold' : 'text-stone-700'
                  )}
                >
                  {m.name}
                </span>
                <span className="text-xs font-medium text-stone-400 shrink-0">
                  Rp {Number(m.price || 0).toLocaleString('id-ID')}
                </span>
              </label>
            )
          })
        )}
      </div>
    </div>
  )
}

export default function PromoView({ initialMenuItems, initialOutlets, initialPromos }: PromoViewProps) {
  const [menuItems] = useState<MenuItem[]>(initialMenuItems)
  const [promos, setPromos] = useState<OutletPromo[]>(initialPromos)
  const [outlets] = useState<Outlet[]>(initialOutlets)
  const [saving, setSaving] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [mounted, setMounted] = useState(false)
  const [now, setNow] = useState<number>(() => Date.now())
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null)

  const showToast = (type: 'success' | 'error', message: string) => {
    setToast({ type, message })
    setTimeout(() => setToast(null), 3500)
  }

  useEffect(() => {
    setMounted(true)
    const timer = setInterval(() => setNow(Date.now()), 30_000)
    return () => clearInterval(timer)
  }, [])

  const allOutletIds = outlets.map((o) => o.id)
  const outletIdsOf = (promo: OutletPromo) => resolvePromoOutletIds(promo, allOutletIds)

  const globalPromo = promos.find((p) => p.scope === 'global') || ({
    scope: 'global',
    menu_item_id: null,
    discount_type: 'percentage',
    discount_value: 0,
    is_active: false,
    min_purchase: null,
    usage_limit: null,
    current_usage: 0,
    quota_scope: 'per_outlet',
    start_date: null,
    end_date: null,
    daily_schedule: [],
    apply_to_food_apps: false,
    sync_to_order_online: false,
    promo_name: '',
    buy_quantity: 1,
    get_quantity: 1,
    outlet_ids: allOutletIds,
    excluded_menu_item_ids: [],
  } as OutletPromo)

  const isGlobalActive = globalPromo.is_active
  const isGlobalBuyOneGetOne = globalPromo.discount_type === 'buy_one_get_one'

  const handleGlobalPromoChange = (field: keyof OutletPromo, value: any) => {
    setPromos((prev) => {
      const updated = [...prev]
      const idx = updated.findIndex((p) => p.scope === 'global')

      if (field === 'is_active' && value === true) {
        for (let i = 0; i < updated.length; i++) {
          if (updated[i].scope === 'item') {
            updated[i] = { ...updated[i], is_active: false }
          }
        }
      }

      if (idx >= 0) {
        updated[idx] = {
          ...updated[idx],
          [field]: value,
          ...(field === 'discount_type' && value === 'buy_one_get_one'
            ? {
                discount_value: 0.01,
                min_purchase: null,
                apply_to_food_apps: false,
                sync_to_order_online: false,
                excluded_menu_item_ids: [],
                buy_quantity: updated[idx].buy_quantity ?? 1,
                get_quantity: updated[idx].get_quantity ?? 1,
                quota_scope: updated[idx].quota_scope ?? 'per_outlet',
              }
            : {}),
        }
      } else {
        const defaultGlobal: OutletPromo = {
          scope: 'global',
          menu_item_id: null,
          discount_type: 'percentage',
          discount_value: 0,
          is_active: false,
          min_purchase: null,
          usage_limit: null,
          current_usage: 0,
          quota_scope: 'per_outlet',
          start_date: null,
          end_date: null,
          daily_schedule: [],
          apply_to_food_apps: false,
          sync_to_order_online: false,
          promo_name: '',
          buy_quantity: 1,
          get_quantity: 1,
          outlet_ids: allOutletIds,
          excluded_menu_item_ids: [],
          [field]: value,
        }
        updated.push(defaultGlobal)
      }
      return updated
    })
  }

  const handleItemPromoChange = (menuId: string, field: keyof OutletPromo, value: any) => {
    setPromos((prev) => {
      const updated = [...prev]
      const idx = updated.findIndex((p) => p.scope === 'item' && p.menu_item_id === menuId)

      if (field === 'is_active' && value === true) {
        const gIdx = updated.findIndex((p) => p.scope === 'global')
        if (gIdx >= 0) {
          updated[gIdx] = { ...updated[gIdx], is_active: false }
        }
      }

      if (idx >= 0) {
        updated[idx] = {
          ...updated[idx],
          [field]: value,
          ...(field === 'discount_type' && value === 'buy_one_get_one'
            ? {
                discount_value: 0.01,
                min_purchase: null,
                apply_to_food_apps: false,
                sync_to_order_online: false,
                buy_quantity: updated[idx].buy_quantity ?? 1,
                get_quantity: updated[idx].get_quantity ?? 1,
                quota_scope: updated[idx].quota_scope ?? 'per_outlet',
              }
            : {}),
        }
      } else {
        const defaultItem: OutletPromo = {
          scope: 'item',
          menu_item_id: menuId,
          discount_type: 'nominal',
          discount_value: 0,
          is_active: false,
          min_purchase: null,
          start_date: null,
          end_date: null,
          daily_schedule: [],
          sync_to_order_online: false,
          buy_quantity: 1,
          get_quantity: 1,
          outlet_ids: allOutletIds,
          [field]: value,
        }
        updated.push(defaultItem)
      }
      return updated
    })
  }

  const handleSave = async () => {
    setSaving(true)

    try {
      if (!outlets || outlets.length === 0) {
        throw new Error('Tidak ada outlet aktif untuk diterapkan promo.')
      }

      for (const p of promos) {
        if (!p.is_active) continue
        const label =
          p.scope === 'global'
            ? 'Promo Semua Menu'
            : menuItems.find((m) => m.id === p.menu_item_id)?.name || 'Promo menu'

        if (outletIdsOf(p).length === 0) {
          throw new Error(`${label}: pilih minimal satu outlet yang masih aktif.`)
        }

        const scheduleError = validateSchedule(p)
        if (scheduleError) {
          throw new Error(`${label}: ${scheduleError}`)
        }
      }

      const result = await savePromosAction(outlets, promos)

      if (result && !result.success) {
        throw new Error(result.error || 'Gagal menyimpan promo')
      }

      showToast('success', 'Pengaturan promo berhasil disimpan untuk cabang outlet yang dipilih!')
    } catch (err: any) {
      console.error(err)
      showToast('error', err.message || 'Gagal menyimpan promo')
    } finally {
      setSaving(false)
    }
  }

  const filteredMenuItems = menuItems.filter((m) =>
    m.name.toLowerCase().includes(searchQuery.toLowerCase().trim())
  )

  const scheduledCount = promos.filter((p) => getPromoStatus(p, now) === 'terjadwal').length

  return (
    <div className="max-w-4xl w-full mx-auto space-y-6 pb-40">
      {/* ── Page Header ────────────────────────────────────── */}
      <div>
        <div className="flex items-center gap-2.5">
          <h1 className="text-2xl font-extrabold text-stone-900 tracking-tight">Pengaturan Promo</h1>
          <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-900 border border-amber-200">
            POS Kasir &amp; Outlet
          </span>
        </div>
        <p className="text-stone-500 text-xs sm:text-sm mt-1 font-medium">
          Kelola diskon Global (Seluruh Transaksi) atau diskon Per Menu, batas kuota, dan jadwal operasional per outlet terpilih.
        </p>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center px-3 py-1 bg-amber-50 text-amber-800 text-xs font-bold rounded-full border border-amber-200/80">
            <Store className="w-3.5 h-3.5 mr-1.5 text-amber-600" />
            Distribusi per-cabang spesifik didukung
          </span>
          <span className="inline-flex items-center px-3 py-1 bg-stone-100 text-stone-700 text-xs font-bold rounded-full border border-stone-200">
            <CalendarClock className="w-3.5 h-3.5 mr-1.5 text-stone-500" />
            Zona waktu {WIB_LABEL}
          </span>
          {scheduledCount > 0 && (
            <span className="inline-flex items-center px-3 py-1 bg-violet-50 text-violet-700 text-xs font-bold rounded-full border border-violet-200">
              {scheduledCount} promo terjadwal
            </span>
          )}
        </div>
      </div>

      {/* ── PROMO GLOBAL ───────────────────────────────────────── */}
      <section
        className={cn(
          'rounded-3xl p-5 sm:p-7 border-2 transition-all duration-200 shadow-2xs',
          globalPromo.is_active
            ? 'border-amber-400 bg-white ring-2 ring-amber-500/10'
            : 'border-stone-200/80 bg-white hover:border-stone-300'
        )}
      >
        <div className="flex justify-between items-start gap-4">
          <div className="min-w-0">
            <h2
              className={cn(
                'font-extrabold text-lg sm:text-xl flex items-center gap-2.5',
                globalPromo.is_active ? 'text-amber-800' : 'text-stone-900'
              )}
            >
              <div
                className={cn(
                  'w-9 h-9 rounded-xl flex items-center justify-center shrink-0',
                  globalPromo.is_active ? 'bg-amber-500 text-white' : 'bg-stone-100 text-stone-500'
                )}
              >
                <Tag className="w-4 h-4" />
              </div>
              <span>Promo Semua Menu (Global)</span>
            </h2>
            <p className="text-xs sm:text-sm text-stone-500 mt-1 font-medium">
              Berlaku untuk total harga seluruh pesanan saat promo diaktifkan.
            </p>
            <div className="mt-2.5 flex flex-wrap items-center gap-2">
              {mounted && <StatusBadge status={getPromoStatus(globalPromo, now)} />}
              <OutletScopeBadge outlets={outlets} selectedIds={outletIdsOf(globalPromo)} />
              {!isGlobalBuyOneGetOne && (globalPromo.excluded_menu_item_ids?.length || 0) > 0 && (
                <span
                  title={menuItems
                    .filter((m) => globalPromo.excluded_menu_item_ids!.includes(m.id))
                    .map((m) => m.name)
                    .join(', ')}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-bold bg-rose-50 text-rose-700 border-rose-200"
                >
                  <Ban className="w-3.5 h-3.5" />
                  {globalPromo.excluded_menu_item_ids!.length} menu dikecualikan
                </span>
              )}
            </div>
          </div>

          {/* Toggle Aktif */}
          <label className="relative inline-flex items-center cursor-pointer shrink-0 mt-1 select-none">
            <input
              type="checkbox"
              className="sr-only peer"
              checked={globalPromo.is_active}
              onChange={(e) => handleGlobalPromoChange('is_active', e.target.checked)}
            />
            <div className="w-12 h-6 bg-stone-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-stone-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-500"></div>
          </label>
        </div>

        <div className="mt-6 pt-6 border-t border-stone-100 space-y-5">
          {!globalPromo.is_active && (
            <div className="rounded-2xl border border-amber-200 bg-amber-50/70 p-3.5 text-xs sm:text-sm font-semibold text-amber-900 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-amber-600" />
              <span>Atur detail diskon terlebih dahulu, lalu aktifkan toggle di atas agar promo mulai berlaku.</span>
            </div>
          )}

          {/* Pengaturan Nilai Diskon */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider">
                Nama Promo
              </label>
              <input
                value={globalPromo.promo_name || ''}
                onChange={(e) => handleGlobalPromoChange('promo_name', e.target.value)}
                placeholder="Contoh: Promo Gajian, Promo Kemerdekaan"
                className="w-full bg-white border border-stone-200 focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 rounded-xl px-3.5 py-2.5 outline-none transition-colors font-semibold text-stone-900 text-sm"
              />
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider">
                Tipe Diskon
              </label>
              <select
                className="w-full bg-white border border-stone-200 focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 rounded-xl px-3.5 py-2.5 outline-none transition-colors font-semibold text-stone-900 text-sm cursor-pointer"
                value={globalPromo.discount_type}
                onChange={(e) => handleGlobalPromoChange('discount_type', e.target.value)}
              >
                <option value="percentage">Persentase (%)</option>
                <option value="nominal">Nominal (Rp)</option>
                <option value="buy_one_get_one">Buy X Get Y (Semua Menu)</option>
              </select>
            </div>

            {isGlobalBuyOneGetOne ? (
              <div className="md:col-span-2 rounded-2xl border border-emerald-200 bg-emerald-50/60 p-4 text-xs sm:text-sm text-emerald-950 space-y-3">
                <p className="font-extrabold text-emerald-900">Buy X Get Y untuk Semua Menu</p>
                <p className="text-stone-600">
                  Semua menu dapat menjadi menu pemicu. Hadiah promo tetap <strong>Original Ayam Reguler</strong>, hanya berlaku di POS kasir/toko offline.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  <label className="space-y-1">
                    <span className="block text-xs font-bold text-emerald-900">Beli Minimal (X)</span>
                    <input
                      type="number"
                      min="1"
                      step="1"
                      value={globalPromo.buy_quantity ?? 1}
                      onChange={(e) =>
                        handleGlobalPromoChange('buy_quantity', Math.max(1, Number(e.target.value) || 1))
                      }
                      className="w-full rounded-xl border border-emerald-200 bg-white px-3 py-2 font-bold text-emerald-900 outline-none focus:border-emerald-500 text-sm"
                    />
                  </label>
                  <label className="space-y-1">
                    <span className="block text-xs font-bold text-emerald-900">Gratis (Y)</span>
                    <input
                      type="number"
                      min="1"
                      step="1"
                      value={globalPromo.get_quantity ?? 1}
                      onChange={(e) =>
                        handleGlobalPromoChange('get_quantity', Math.max(1, Number(e.target.value) || 1))
                      }
                      className="w-full rounded-xl border border-emerald-200 bg-white px-3 py-2 font-bold text-emerald-900 outline-none focus:border-emerald-500 text-sm"
                    />
                  </label>
                </div>
              </div>
            ) : (
              <div className="space-y-1.5 md:col-span-2">
                <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider">
                  Nilai Diskon ({globalPromo.discount_type === 'percentage' ? '%' : 'Rp'})
                </label>
                {globalPromo.discount_type === 'nominal' ? (
                  <CurrencyInput
                    value={globalPromo.discount_value || 0}
                    onChange={(v) => handleGlobalPromoChange('discount_value', v)}
                    className="w-full bg-white border border-stone-200 focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 rounded-xl py-2.5 pr-4 outline-none transition-colors font-bold text-stone-900"
                  />
                ) : (
                  <div className="relative">
                    <input
                      type="number"
                      min="0"
                      max="100"
                      placeholder="0"
                      value={globalPromo.discount_value || ''}
                      onChange={(e) =>
                        handleGlobalPromoChange('discount_value', Number(e.target.value) || 0)
                      }
                      className="w-full bg-white border border-stone-200 focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 rounded-xl px-4 py-2.5 outline-none transition-colors font-bold text-stone-900 text-sm"
                    />
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-stone-400 font-bold">%</span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Outlet Picker untuk Promo Global */}
          <OutletScopePicker
            outlets={outlets}
            selectedIds={outletIdsOf(globalPromo)}
            onChange={(ids) => handleGlobalPromoChange('outlet_ids', ids)}
            accent="amber"
          />

          {/* Menu Exclusions (jika bukan BxGy) */}
          {!isGlobalBuyOneGetOne && (
            <MenuExclusionPicker
              menuItems={menuItems}
              selectedIds={globalPromo.excluded_menu_item_ids || []}
              onChange={(ids) => handleGlobalPromoChange('excluded_menu_item_ids', ids)}
            />
          )}

          {/* Jadwal Promo */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <CalendarClock className="w-4 h-4 text-amber-600" />
              <h3 className="text-sm font-bold text-stone-800">Jadwal &amp; Batas Waktu Operasional</h3>
            </div>
            <ScheduleSummary promo={globalPromo} />

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label className="space-y-1">
                <span className="block text-xs font-bold text-stone-600">Tanggal Mulai ({WIB_LABEL})</span>
                <input
                  type="datetime-local"
                  value={toWibInputValue(globalPromo.start_date)}
                  onChange={(e) =>
                    handleGlobalPromoChange('start_date', fromWibInputValue(e.target.value))
                  }
                  className="w-full rounded-xl border border-stone-200 bg-white px-3 py-2 text-xs sm:text-sm font-semibold text-stone-900 outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                />
              </label>
              <label className="space-y-1">
                <span className="block text-xs font-bold text-stone-600">Tanggal Selesai ({WIB_LABEL})</span>
                <input
                  type="datetime-local"
                  value={toWibInputValue(globalPromo.end_date)}
                  onChange={(e) =>
                    handleGlobalPromoChange('end_date', fromWibInputValue(e.target.value))
                  }
                  className="w-full rounded-xl border border-stone-200 bg-white px-3 py-2 text-xs sm:text-sm font-semibold text-stone-900 outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                />
              </label>
            </div>

            <PromoDailyScheduleEditor
              value={globalPromo.daily_schedule}
              startDate={globalPromo.start_date}
              dailyStartTime={globalPromo.daily_start_time}
              dailyEndTime={globalPromo.daily_end_time}
              onChange={(val) => handleGlobalPromoChange('daily_schedule', val)}
              accent="amber"
            />
          </div>

          {/* Minimum Belanja & Kuota */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {!isGlobalBuyOneGetOne && (
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider">
                  Minimum Belanja (Rp) <span className="text-stone-400 font-normal lowercase">(opsional)</span>
                </label>
                <CurrencyInput
                  value={globalPromo.min_purchase || 0}
                  onChange={(v) => handleGlobalPromoChange('min_purchase', v || null)}
                  className="w-full bg-white border border-stone-200 focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 rounded-xl py-2 px-3 text-sm font-semibold text-stone-900"
                />
              </div>
            )}

            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider">
                Batas Kuota Pemakaian <span className="text-stone-400 font-normal lowercase">(opsional)</span>
              </label>
              <input
                type="number"
                min="1"
                placeholder="Tak terbatas"
                value={globalPromo.usage_limit || ''}
                onChange={(e) =>
                  handleGlobalPromoChange('usage_limit', e.target.value ? Number(e.target.value) : null)
                }
                className="w-full rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm font-semibold text-stone-900 outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
              />
              {globalPromo.usage_limit ? (
                <p className="text-[11px] text-amber-700 font-bold">
                  Terpakai: {globalPromo.current_usage || 0} / {globalPromo.usage_limit}
                </p>
              ) : null}
            </div>
          </div>
        </div>
      </section>

      {/* ── PROMO PER MENU (ITEM) ──────────────────────────────── */}
      <section
        className={cn(
          'rounded-3xl p-5 sm:p-7 border-2 border-stone-200/80 bg-white shadow-2xs space-y-5 transition-all duration-200',
          isGlobalActive ? 'opacity-40 pointer-events-none grayscale' : ''
        )}
      >
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-stone-900 text-white flex items-center justify-center shrink-0">
              <Percent className="w-4 h-4 text-amber-400" />
            </div>
            <h2 className="font-extrabold text-lg sm:text-xl text-stone-900">Promo Per Menu Spesifik</h2>
          </div>
          <p className="text-xs sm:text-sm text-stone-500 mt-1 font-medium">
            Berikan diskon untuk menu spesifik tertentu. Otomatis dinonaktifkan jika Promo Global aktif.
          </p>
        </div>

        {/* Pencarian Menu */}
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400 pointer-events-none" />
          <input
            type="text"
            placeholder="Cari nama menu..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-stone-50 border border-stone-200 focus:border-amber-500 focus:bg-white rounded-xl pl-10 pr-4 py-2 text-xs sm:text-sm outline-none transition-colors font-medium text-stone-900"
          />
        </div>

        {/* Daftar Menu Promos */}
        <div className="space-y-4 pt-2">
          {filteredMenuItems.length === 0 ? (
            <div className="text-center py-10 bg-stone-50 rounded-2xl border border-dashed border-stone-200 p-4">
              <p className="text-stone-500 text-xs sm:text-sm font-semibold">Tidak ada menu yang sesuai pencarian.</p>
            </div>
          ) : (
            filteredMenuItems.map((menu) => {
              const promo = promos.find((p) => p.scope === 'item' && p.menu_item_id === menu.id) || ({
                scope: 'item',
                menu_item_id: menu.id,
                discount_type: 'nominal',
                discount_value: 0,
                is_active: false,
                min_purchase: null,
                start_date: null,
                end_date: null,
                daily_schedule: [],
                sync_to_order_online: false,
                buy_quantity: 1,
                get_quantity: 1,
                outlet_ids: allOutletIds,
              } as OutletPromo)

              const status = getPromoStatus(promo, now)
              const isBuyOneGetOne = promo.discount_type === 'buy_one_get_one'

              let discountedPrice = menu.price || 0
              const showDiscountPreview =
                !isBuyOneGetOne && promo.is_active && promo.discount_value > 0 && status === 'berjalan'
              if (showDiscountPreview) {
                if (promo.discount_type === 'nominal') {
                  discountedPrice = Math.max(0, (menu.price || 0) - promo.discount_value)
                } else {
                  discountedPrice = Math.max(0, (menu.price || 0) - ((menu.price || 0) * promo.discount_value) / 100)
                }
              }

              return (
                <div
                  key={menu.id}
                  className={cn(
                    'p-4 sm:p-5 rounded-2xl border-2 transition-all duration-200',
                    promo.is_active
                      ? 'bg-white border-amber-400 shadow-2xs'
                      : 'bg-white border-stone-100 hover:border-stone-200'
                  )}
                >
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <p className={cn('font-bold text-base sm:text-lg', promo.is_active ? 'text-amber-900' : 'text-stone-900')}>
                        {menu.name}
                      </p>
                      <div className="flex flex-wrap items-center gap-2 sm:gap-3 mt-1">
                        {showDiscountPreview ? (
                          <>
                            <span className="text-xs text-stone-400 line-through font-medium">
                              Rp {(menu.price || 0).toLocaleString('id-ID')}
                            </span>
                            <span className="text-sm font-extrabold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md">
                              Rp {(discountedPrice || 0).toLocaleString('id-ID')}
                            </span>
                          </>
                        ) : (
                          <span className="text-sm font-bold text-stone-600">
                            Rp {(menu.price || 0).toLocaleString('id-ID')}
                          </span>
                        )}
                        {mounted && promo.is_active && <StatusBadge status={status} />}
                        {promo.is_active && <OutletScopeBadge outlets={outlets} selectedIds={outletIdsOf(promo)} />}
                      </div>
                    </div>

                    <div className="flex items-center gap-3 shrink-0 flex-wrap">
                      {promo.is_active && (
                        <div className="flex items-center gap-2 animate-in fade-in">
                          <select
                            className="bg-white border border-stone-200 focus:border-amber-500 rounded-xl py-2 px-3 text-xs font-bold text-stone-800 outline-none transition-colors cursor-pointer"
                            value={promo.discount_type}
                            onChange={(e) => handleItemPromoChange(menu.id, 'discount_type', e.target.value)}
                          >
                            <option value="nominal">Rp (Nominal)</option>
                            <option value="percentage">% (Persen)</option>
                            <option value="buy_one_get_one">Buy X Get Y</option>
                          </select>

                          {!isBuyOneGetOne && (
                            <div className="relative">
                              {promo.discount_type === 'nominal' ? (
                                <CurrencyInput
                                  value={promo.discount_value || 0}
                                  onChange={(v) => handleItemPromoChange(menu.id, 'discount_value', v)}
                                  className="bg-white border border-stone-200 focus:border-amber-500 rounded-xl py-1.5 px-3 text-xs w-28 font-bold text-stone-900 outline-none"
                                />
                              ) : (
                                <div className="relative">
                                  <input
                                    type="number"
                                    min="0"
                                    max="100"
                                    placeholder="0"
                                    value={promo.discount_value || ''}
                                    onChange={(e) =>
                                      handleItemPromoChange(menu.id, 'discount_value', Number(e.target.value) || 0)
                                    }
                                    className="bg-white border border-stone-200 focus:border-amber-500 rounded-xl py-1.5 px-3 text-xs w-24 font-bold text-stone-900 outline-none"
                                  />
                                  <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-stone-400 text-xs font-bold">
                                    %
                                  </span>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      )}

                      <label className="relative inline-flex items-center cursor-pointer select-none">
                        <input
                          type="checkbox"
                          className="sr-only peer"
                          checked={promo.is_active}
                          onChange={(e) => handleItemPromoChange(menu.id, 'is_active', e.target.checked)}
                        />
                        <div className="w-11 h-6 bg-stone-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-stone-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-500"></div>
                      </label>
                    </div>
                  </div>

                  {promo.is_active && (
                    <div className="mt-4 pt-4 border-t border-stone-100 space-y-4 animate-in fade-in">
                      {isBuyOneGetOne && (
                        <div className="rounded-2xl border border-emerald-200 bg-emerald-50/60 p-4 text-xs sm:text-sm text-emerald-950 space-y-3">
                          <p className="font-extrabold text-emerald-900">Buy X Get Y</p>
                          <p className="text-stone-600">
                            Pelanggan membeli {promo.buy_quantity ?? 1}x {menu.name}, lalu mendapat {promo.get_quantity ?? 1}x Original Ayam Reguler gratis di POS kasir.
                          </p>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <label className="space-y-1">
                              <span className="block text-xs font-bold text-emerald-900">Beli Minimal (X)</span>
                              <input
                                type="number"
                                min="1"
                                step="1"
                                value={promo.buy_quantity ?? 1}
                                onChange={(e) =>
                                  handleItemPromoChange(menu.id, 'buy_quantity', Math.max(1, Number(e.target.value) || 1))
                                }
                                className="w-full rounded-xl border border-emerald-200 bg-white px-3 py-2 font-bold text-emerald-900 outline-none text-xs sm:text-sm"
                              />
                            </label>
                            <label className="space-y-1">
                              <span className="block text-xs font-bold text-emerald-900">Gratis (Y)</span>
                              <input
                                type="number"
                                min="1"
                                step="1"
                                value={promo.get_quantity ?? 1}
                                onChange={(e) =>
                                  handleItemPromoChange(menu.id, 'get_quantity', Math.max(1, Number(e.target.value) || 1))
                                }
                                className="w-full rounded-xl border border-emerald-200 bg-white px-3 py-2 font-bold text-emerald-900 outline-none text-xs sm:text-sm"
                              />
                            </label>
                          </div>
                        </div>
                      )}

                      {/* Outlet Picker untuk Item Promo */}
                      <OutletScopePicker
                        outlets={outlets}
                        selectedIds={outletIdsOf(promo)}
                        onChange={(ids) => handleItemPromoChange(menu.id, 'outlet_ids', ids)}
                        accent="blue"
                      />

                      {/* Jadwal Item Promo */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <label className="space-y-1">
                          <span className="block text-xs font-bold text-stone-600">Mulai ({WIB_LABEL})</span>
                          <input
                            type="datetime-local"
                            value={toWibInputValue(promo.start_date)}
                            onChange={(e) =>
                              handleItemPromoChange(menu.id, 'start_date', fromWibInputValue(e.target.value))
                            }
                            className="w-full rounded-xl border border-stone-200 bg-white px-3 py-2 text-xs sm:text-sm font-semibold text-stone-900 outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                          />
                        </label>
                        <label className="space-y-1">
                          <span className="block text-xs font-bold text-stone-600">Selesai ({WIB_LABEL})</span>
                          <input
                            type="datetime-local"
                            value={toWibInputValue(promo.end_date)}
                            onChange={(e) =>
                              handleItemPromoChange(menu.id, 'end_date', fromWibInputValue(e.target.value))
                            }
                            className="w-full rounded-xl border border-stone-200 bg-white px-3 py-2 text-xs sm:text-sm font-semibold text-stone-900 outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                          />
                        </label>
                      </div>

                      <PromoDailyScheduleEditor
                        value={promo.daily_schedule}
                        startDate={promo.start_date}
                        dailyStartTime={promo.daily_start_time}
                        dailyEndTime={promo.daily_end_time}
                        onChange={(val) => handleItemPromoChange(menu.id, 'daily_schedule', val)}
                        accent="blue"
                      />
                    </div>
                  )}
                </div>
              )
            })
          )}
        </div>
      </section>

      {/* ── Fixed Floating Save Button ──────────────────────────── */}
      {mounted &&
        createPortal(
          <div className="pointer-events-none fixed inset-x-3 bottom-6 z-40 flex justify-end lg:left-1/2 lg:w-[min(calc(100%-3rem),56rem)] lg:-translate-x-1/2">
            <div className="pointer-events-auto w-full rounded-2xl border border-stone-200/90 bg-white/95 p-3.5 shadow-2xl backdrop-blur-md flex items-center justify-between gap-3">
              <p className="hidden sm:block text-xs font-semibold text-stone-500 pl-2">
                Tiap promo disimpan ke outlet yang dipilih di kartunya, dari {outlets.length} outlet cabang aktif. Jam promo mengikuti {WIB_LABEL}.
              </p>
              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                className="inline-flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 active:bg-amber-700 text-white font-bold text-xs sm:text-sm shadow-md shadow-amber-500/20 active:scale-95 transition-all cursor-pointer disabled:opacity-50 w-full sm:w-auto shrink-0"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                <span>{saving ? 'Menyimpan Promo...' : 'Simpan Pengaturan Promo'}</span>
              </button>
            </div>
          </div>,
          document.body
        )}

      {/* ── Toast Notifications ──────────────────────────────── */}
      {toast && (
        <div
          className={cn(
            'fixed bottom-6 right-6 z-50 flex items-center gap-2.5 px-4 py-3 rounded-2xl shadow-xl font-bold text-xs sm:text-sm animate-in fade-in slide-in-from-bottom-4',
            toast.type === 'success' ? 'bg-stone-900 text-white' : 'bg-red-600 text-white'
          )}
        >
          {toast.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          ) : (
            <AlertCircle className="w-4 h-4 text-white" />
          )}
          <span>{toast.message}</span>
        </div>
      )}
    </div>
  )
}
