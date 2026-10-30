'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { AlertTriangle, CheckCircle2, ChevronDown, ChevronRight, Globe2, Info, LayoutGrid, Loader2, Plus, Search, Trash2, X } from 'lucide-react'
import { toast } from 'sonner'
import { Switch } from '@/components/ui/controls'
import { WIB_LABEL } from '@/lib/timezone'
import { getPromoStatus, validateSchedule } from '@/lib/promoSchedule'
import { findPromoOutletOverlaps, promoOutletKey, resolvePromoOutletIds } from '@/lib/promoOutlets'
import { legacyRewardMenuId } from '@/lib/promoReward'
import { savePromosAction } from './actions'
import PromoEditor, { PromoTicket } from './PromoEditor'
import { MenuThumb, OutletScopeBadge, StatusBadge, promoRule, rupiah } from './promoParts'
import type { MenuItem, Outlet, OutletPromo, PromoField } from './promoTypes'

interface PromoViewProps {
  initialMenuItems: MenuItem[]
  initialOutlets: Outlet[]
  initialPromos: OutletPromo[]
}

type Tab = 'menu' | 'global'
type Filter = 'all' | 'active' | 'inactive'

/** Id promo rancangan yang belum masuk state (dibuat saat form pertama kali diubah). */
const DRAFT_GLOBAL_ID = 'draft_global'
const draftItemId = (menuId: string) => `draft_item_${menuId}`

export default function PromoView({ initialMenuItems, initialOutlets, initialPromos }: PromoViewProps) {
  const [menuItems] = useState<MenuItem[]>(initialMenuItems)
  const [outlets] = useState<Outlet[]>(initialOutlets)
  const [promos, setPromos] = useState<OutletPromo[]>(initialPromos)
  const [savedSnapshot, setSavedSnapshot] = useState(() => JSON.stringify(initialPromos))
  const [saving, setSaving] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [filter, setFilter] = useState<Filter>('all')
  const [tab, setTab] = useState<Tab>(() => (initialPromos.some(p => p.scope === 'global' && p.is_active) ? 'global' : 'menu'))
  const [editingMenuId, setEditingMenuId] = useState<string | null>(null)
  const [expandedGlobalId, setExpandedGlobalId] = useState<string | null>(
    () => (initialPromos.find(p => p.scope === 'global' && p.is_active) || initialPromos.find(p => p.scope === 'global'))?.group_id ?? DRAFT_GLOBAL_ID,
  )
  const [mounted, setMounted] = useState(false)
  // Status jadwal ikut jalan tanpa reload: dievaluasi ulang tiap 30 detik.
  const [now, setNow] = useState<number>(() => Date.now())
  const nextId = useRef(0)
  /**
   * Kunci (scope, menu) yang pernah punya promo di layar ini. Kalau semua
   * promo sebuah kunci dihapus admin, kunci itu tetap dikirim sebagai penanda
   * kosong supaya server melepas barisnya — server hanya menyentuh kunci yang
   * ada di payload, jadi tanpa ini promo yang dihapus terakhir tetap hidup di
   * kasir.
   */
  const knownKeys = useRef(new Set(initialPromos.map(promoOutletKey)))

  useEffect(() => {
    setMounted(true)
    const timer = setInterval(() => setNow(Date.now()), 30_000)
    return () => clearInterval(timer)
  }, [])

  const dirty = JSON.stringify(promos) !== savedSnapshot

  // Cegah perubahan hilang karena tab ditutup sebelum disimpan.
  useEffect(() => {
    if (!dirty) return
    const warn = (e: BeforeUnloadEvent) => e.preventDefault()
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [dirty])

  // Promo lama tanpa pilihan hadiah tetap Original Ayam Reguler (sama dengan server & POS).
  const defaultRewardId = legacyRewardMenuId(menuItems)
  const rewardIdOf = (promo: OutletPromo) => promo.reward_menu_item_id || defaultRewardId
  const rewardNameOf = (promo: OutletPromo) => menuItems.find(m => m.id === rewardIdOf(promo))?.name || 'menu gratis'

  const allOutletIds = outlets.map(o => o.id)
  const outletNameOf = (id: string) => outlets.find(o => o.id === id)?.name || id
  /** Outlet promo yang tersimpan; promo baru default ke seluruh outlet aktif. */
  const outletIdsOf = (promo: OutletPromo) => resolvePromoOutletIds(promo, allOutletIds)
  const labelOf = (promo: OutletPromo) =>
    promo.promo_name?.trim() || promoRule(promo, rewardNameOf(promo))

  const globalPromos = promos.filter(p => p.scope === 'global')
  const itemPromosOf = (menuId: string) => promos.filter(p => p.scope === 'item' && p.menu_item_id === menuId)

  /**
   * Outlet yang sudah dipakai promo lain pada kunci (scope, menu) yang sama —
   * satu outlet hanya bisa ikut satu promo per menu. Dipakai untuk mengunci
   * pilihan di form dan untuk menentukan outlet bawaan promo baru.
   */
  const takenOutletsIn = (list: OutletPromo[], groupId: string, scope: 'global' | 'item', menuId: string | null): Record<string, string> => {
    const taken: Record<string, string> = {}
    for (const other of list) {
      if (other.group_id === groupId || other.scope !== scope) continue
      if (scope === 'item' && other.menu_item_id !== menuId) continue
      for (const id of outletIdsOf(other)) taken[id] = labelOf(other)
    }
    return taken
  }
  const takenOutletsFor = (groupId: string, scope: 'global' | 'item', menuId: string | null) => takenOutletsIn(promos, groupId, scope, menuId)
  const freeOutletsIn = (list: OutletPromo[], groupId: string, scope: 'global' | 'item', menuId: string | null) => {
    const taken = takenOutletsIn(list, groupId, scope, menuId)
    return allOutletIds.filter(id => !taken[id])
  }

  /** `list` = daftar promo yang dipakai menghitung outlet bawaan (state terkini saat dipanggil dari updater). */
  const newPromo = (groupId: string, scope: 'global' | 'item', menuId: string | null, list: OutletPromo[] = promos): OutletPromo => ({
    group_id: groupId,
    scope,
    menu_item_id: menuId,
    discount_type: scope === 'global' ? 'percentage' : 'nominal',
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
    // Promo baru otomatis mengambil outlet yang belum dipakai promo lain.
    outlet_ids: freeOutletsIn(list, groupId, scope, menuId),
    ...(scope === 'global' ? { excluded_menu_item_ids: [] } : {}),
  })

  const applyChange = (base: OutletPromo, field: PromoField, value: any): OutletPromo => ({
    ...base,
    [field]: value,
    ...(field === 'discount_type' && value === 'buy_one_get_one'
      ? {
          discount_value: 0.01,
          min_purchase: null,
          apply_to_food_apps: false,
          sync_to_order_online: false,
          excluded_menu_item_ids: [],
          buy_quantity: base.buy_quantity ?? 1,
          get_quantity: base.get_quantity ?? 1,
          quota_scope: base.quota_scope ?? 'per_outlet',
        }
      : {}),
  })

  /** Ubah satu promo; promo rancangan yang belum ada di state dibuat saat itu juga. */
  const handlePromoChange = (groupId: string, scope: 'global' | 'item', menuId: string | null, field: PromoField, value: any) => {
    setPromos(prev => {
      const idx = prev.findIndex(p => p.group_id === groupId)
      knownKeys.current.add(promoOutletKey({ scope, menu_item_id: menuId }))
      const base = idx >= 0 ? prev[idx] : newPromo(groupId, scope, menuId, prev)
      const next = applyChange(base, field, value)
      if (idx >= 0) {
        const updated = [...prev]
        updated[idx] = next
        return updated
      }
      return [...prev, next]
    })
  }

  const addPromo = (scope: 'global' | 'item', menuId: string | null): string => {
    nextId.current += 1
    const groupId = `new_${scope}_${Date.now()}_${nextId.current}`
    knownKeys.current.add(promoOutletKey({ scope, menu_item_id: menuId }))
    setPromos(prev => [...prev, newPromo(groupId, scope, menuId, prev)])
    return groupId
  }

  /**
   * Hapus promo dari daftar. Baris di DB tidak dihapus — outletnya dilepas
   * (dimatikan) saat disimpan, riwayat pemakaian tetap ada.
   */
  const removePromo = (groupId: string) => setPromos(prev => prev.filter(p => p.group_id !== groupId))

  /**
   * Point 1: promo semua menu dan promo per menu BOLEH berdampingan. Kasir
   * mendahulukan promo semua menu di outlet yang memilikinya, kecuali menu
   * itu dikecualikan. Helper ini menyebut outlet tempat sebuah promo per menu
   * tertutup promo semua menu yang aktif, supaya admin tahu dan bisa
   * mengecualikan menunya.
   */
  const shadowedOutletsOf = (itemPromo: OutletPromo): { outletId: string; by: OutletPromo }[] => {
    if (!itemPromo.is_active || !itemPromo.menu_item_id) return []
    const result: { outletId: string; by: OutletPromo }[] = []
    for (const outletId of outletIdsOf(itemPromo)) {
      const by = globalPromos.find(
        g =>
          g.is_active &&
          outletIdsOf(g).includes(outletId) &&
          !(Array.isArray(g.excluded_menu_item_ids) && g.excluded_menu_item_ids.includes(itemPromo.menu_item_id!)),
      )
      if (by) result.push({ outletId, by })
    }
    return result
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      if (!outlets || outlets.length === 0) throw new Error('Tidak ada outlet aktif untuk diterapkan promo.')

      const overlap = findPromoOutletOverlaps(promos, allOutletIds)[0]
      if (overlap) {
        const names = overlap.promoIndexes.map(i => labelOf(promos[i])).join(' dan ')
        throw new Error(`Outlet ${outletNameOf(overlap.outletId)} dipilih di ${names} sekaligus. Satu outlet hanya bisa ikut satu promo untuk menu yang sama.`)
      }

      // Cegah jadwal terbalik sebelum menyentuh server (DB juga menolaknya).
      // Promo nonaktif dilewati — tanggal basi di promo yang sudah dimatikan
      // tak boleh memblokir penyimpanan promo lain yang sedang diedit.
      for (const p of promos) {
        if (!p.is_active) continue
        const label = p.scope === 'global' ? `Promo semua menu "${labelOf(p)}"` : menuItems.find(m => m.id === p.menu_item_id)?.name || 'Promo menu'
        if (outletIdsOf(p).length === 0) throw new Error(`${label}: pilih minimal satu outlet yang masih aktif.`)
        const scheduleError = validateSchedule(p)
        if (scheduleError) throw new Error(`${label}: ${scheduleError}`)
      }

      const presentKeys = new Set(promos.map(promoOutletKey))
      const released: OutletPromo[] = []
      for (const key of knownKeys.current) {
        if (presentKeys.has(key)) continue
        // Bentuk kunci: `${scope}_${menu_item_id|'null'}` (lihat promoOutletKey).
        const sep = key.indexOf('_')
        const scope = key.slice(0, sep) as 'global' | 'item'
        const menuId = scope === 'item' ? key.slice(sep + 1) : null
        released.push({ ...newPromo(`released_${key}`, scope, menuId), outlet_ids: [], is_active: false })
      }

      const result = await savePromosAction(outlets, [...promos, ...released])
      if (result && !result.success) throw new Error(result.error || 'Gagal menyimpan promo')

      setSavedSnapshot(JSON.stringify(promos))
      toast.success('Pengaturan promo tersimpan.')
    } catch (err: any) {
      console.error(err)
      toast.error(err.message || 'Gagal menyimpan promo')
    } finally {
      setSaving(false)
    }
  }

  /* ── Data tampilan ── */

  const menuCards = useMemo(() => {
    const keyword = searchQuery.trim().toLowerCase()
    return menuItems
      .map(menu => ({ menu, variants: itemPromosOf(menu.id) }))
      .filter(({ menu, variants }) => {
        if (keyword && !menu.name.toLowerCase().includes(keyword)) return false
        const anyActive = variants.some(v => v.is_active)
        if (filter === 'active') return anyActive
        if (filter === 'inactive') return !anyActive
        return true
      })
      // Menu yang sedang berpromo tampil paling depan.
      .sort((a, b) => Number(b.variants.some(v => v.is_active)) - Number(a.variants.some(v => v.is_active)))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [menuItems, promos, searchQuery, filter])

  const activeItemPromos = promos.filter(p => p.scope === 'item' && p.is_active && menuItems.some(m => m.id === p.menu_item_id))
  const activeGlobalPromos = globalPromos.filter(p => p.is_active)
  const counted = [...activeItemPromos, ...activeGlobalPromos]
  const stat = {
    running: mounted ? counted.filter(p => getPromoStatus(p, now) === 'berjalan').length : 0,
    scheduled: mounted ? counted.filter(p => getPromoStatus(p, now) === 'terjadwal').length : 0,
    ended: mounted ? counted.filter(p => getPromoStatus(p, now) === 'berakhir').length : 0,
  }

  const editingMenu = editingMenuId ? menuItems.find(m => m.id === editingMenuId) || null : null

  // Daftar promo semua menu; kalau belum ada sama sekali, tampilkan satu
  // rancangan yang baru masuk state saat formnya diubah (seperti sebelumnya).
  const globalList: OutletPromo[] = globalPromos.length > 0 ? globalPromos : [newPromo(DRAFT_GLOBAL_ID, 'global', null)]

  return (
    <div className="mx-auto w-full max-w-6xl animate-fade-in">
      {/* Ruang bawah menjaga konten terakhir tetap terbaca di balik bilah simpan. */}
      <div className="space-y-6 pb-40">
        {/* ── Header ── */}
        <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="font-display text-3xl tracking-wide text-suka-brown sm:text-4xl">Pengaturan Promo</h1>
            <p className="mt-1 max-w-xl text-sm font-medium text-slate-500">
              Atur diskon dan Beli X Gratis Y untuk kasir POS, bisa berbeda tiap outlet. Semua jam dalam {WIB_LABEL}.
            </p>
          </div>
          <dl className="grid grid-cols-3 gap-2 sm:gap-3">
            {[
              { label: 'Berjalan', value: stat.running, tone: 'text-emerald-700 bg-emerald-50' },
              { label: 'Terjadwal', value: stat.scheduled, tone: 'text-violet-700 bg-violet-50' },
              { label: 'Berakhir', value: stat.ended, tone: 'text-rose-700 bg-rose-50' },
            ].map(s => (
              <div key={s.label} className={`min-w-[5.5rem] rounded-2xl px-4 py-2.5 ${s.tone}`}>
                <dt className="text-[11px] font-bold uppercase tracking-wide opacity-80">{s.label}</dt>
                <dd className="font-display text-2xl leading-none">{s.value}</dd>
              </div>
            ))}
          </dl>
        </header>

        {/* ── Tab ── */}
        <div role="tablist" aria-label="Jenis promo" className="flex gap-1 rounded-2xl bg-white p-1.5 shadow-sm ring-1 ring-slate-200/70 sm:inline-flex">
          {([
            ['menu', 'Promo per menu', <LayoutGrid key="i" className="h-4 w-4" />, `${activeItemPromos.length} aktif`],
            ['global', 'Promo semua menu', <Globe2 key="i" className="h-4 w-4" />, `${activeGlobalPromos.length} aktif`],
          ] as const).map(([value, label, icon, meta]) => {
            const active = tab === value
            return (
              <button
                key={value}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setTab(value)}
                className={`flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold transition-colors duration-150 sm:flex-none ${
                  active ? 'bg-suka-brown text-white' : 'text-slate-600 hover:bg-slate-50'
                }`}
              >
                {icon}
                {label}
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-extrabold ${active ? 'bg-white/15 text-white' : 'bg-slate-100 text-slate-500'}`}>{meta}</span>
              </button>
            )
          })}
        </div>

        {tab === 'menu' ? (
          <section aria-label="Promo per menu" className="space-y-4">
            {activeGlobalPromos.length > 0 && (
              <div className="flex items-start gap-3 rounded-2xl border border-sky-200 bg-sky-50 p-4 text-sm text-sky-900">
                <Info className="mt-0.5 h-4 w-4 shrink-0 text-sky-600" />
                <p>
                  Ada <b>{activeGlobalPromos.length} promo semua menu</b> aktif. Di outlet yang ikut promo itu, kasir mendahulukannya; promo per menu
                  tetap berlaku di outlet lain dan untuk menu yang{' '}
                  <button type="button" onClick={() => setTab('global')} className="cursor-pointer font-bold underline">
                    dikecualikan
                  </button>
                  .
                </p>
              </div>
            )}

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <div className="relative flex-1">
                <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  type="search"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="Cari menu..."
                  aria-label="Cari menu"
                  className="w-full rounded-2xl border border-slate-200 bg-white py-3 pl-11 pr-4 text-sm font-medium text-slate-900 outline-none transition-colors focus:border-suka-orange focus:ring-2 focus:ring-suka-orange/15"
                />
              </div>
              <div role="radiogroup" aria-label="Saring menu" className="flex gap-1 rounded-2xl bg-slate-100 p-1">
                {([
                  ['all', 'Semua'],
                  ['active', 'Berpromo'],
                  ['inactive', 'Tanpa promo'],
                ] as const).map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    role="radio"
                    aria-checked={filter === value}
                    onClick={() => setFilter(value)}
                    className={`min-h-[40px] flex-1 cursor-pointer whitespace-nowrap rounded-xl px-3.5 text-xs font-bold transition-colors sm:flex-none ${
                      filter === value ? 'bg-white text-suka-brown shadow-sm' : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {menuCards.length === 0 ? (
              <div className="rounded-3xl border border-dashed border-slate-300 bg-white py-16 text-center">
                <p className="text-sm font-semibold text-slate-500">Tidak ada menu yang cocok.</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 xl:grid-cols-4">
                {menuCards.map(({ menu, variants }) => {
                  const primary = variants.find(v => v.is_active) || variants[0] || newPromo(draftItemId(menu.id), 'item', menu.id)
                  const activeVariants = variants.filter(v => v.is_active)
                  const coveredOutlets = allOutletIds.filter(id => activeVariants.some(v => outletIdsOf(v).includes(id)))
                  return (
                    <MenuPromoCard
                      key={menu.id}
                      menu={menu}
                      promo={primary}
                      variantCount={activeVariants.length}
                      rule={promoRule(primary, rewardNameOf(primary))}
                      outlets={outlets}
                      outletIds={activeVariants.length > 0 ? coveredOutlets : outletIdsOf(primary)}
                      mounted={mounted}
                      now={now}
                      onOpen={() => setEditingMenuId(menu.id)}
                      onToggle={on => {
                        // Saklar kartu menyalakan/mematikan SEMUA varian menu ini.
                        if (variants.length === 0) {
                          handlePromoChange(draftItemId(menu.id), 'item', menu.id, 'is_active', on)
                        } else {
                          setPromos(prev => prev.map(p => (p.scope === 'item' && p.menu_item_id === menu.id ? { ...p, is_active: on } : p)))
                        }
                        if (on) setEditingMenuId(menu.id)
                      }}
                    />
                  )
                })}
              </div>
            )}
          </section>
        ) : (
          <section aria-label="Promo semua menu" className="space-y-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div className="min-w-0">
                <h2 className="font-display text-2xl tracking-wide text-suka-brown">Promo semua menu</h2>
                <p className="mt-1 text-sm text-slate-500">
                  Berlaku untuk seluruh pesanan di outlet yang dipilih. Tiap outlet hanya bisa ikut satu promo semua menu, tapi outlet berbeda boleh
                  punya promo berbeda.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setExpandedGlobalId(addPromo('global', null))}
                className="inline-flex shrink-0 cursor-pointer items-center justify-center gap-2 rounded-xl border-2 border-dashed border-suka-orange/60 px-4 py-2.5 text-sm font-bold text-suka-brown transition-colors hover:bg-suka-orange/5"
              >
                <Plus className="h-4 w-4" /> Tambah promo untuk outlet lain
              </button>
            </div>

            {globalList.map((promo, index) => {
              const expanded = expandedGlobalId === promo.group_id || globalList.length === 1
              const outletIds = outletIdsOf(promo)
              const taken = takenOutletsFor(promo.group_id, 'global', null)
              const status = getPromoStatus(promo, now)
              // Promo per menu yang akan tertutup promo ini (outlet sama, menu tak dikecualikan).
              const shadowed = promo.is_active
                ? activeItemPromos.filter(ip => shadowedOutletsOf(ip).some(s => s.by.group_id === promo.group_id))
                : []
              const change = (field: PromoField, value: any) => handlePromoChange(promo.group_id, 'global', null, field, value)
              return (
                <article
                  key={promo.group_id}
                  className={`rounded-3xl bg-white shadow-sm ring-1 transition-shadow ${promo.is_active ? 'ring-2 ring-suka-orange' : 'ring-slate-200/70'}`}
                >
                  <header className="flex items-start gap-3 p-5 sm:p-6">
                    {globalList.length > 1 && (
                      <button
                        type="button"
                        onClick={() => setExpandedGlobalId(expanded ? null : promo.group_id)}
                        aria-expanded={expanded}
                        aria-label={expanded ? 'Tutup detail promo' : 'Buka detail promo'}
                        className="mt-0.5 flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100"
                      >
                        <ChevronDown className={`h-5 w-5 transition-transform ${expanded ? 'rotate-180' : ''}`} />
                      </button>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Promo semua menu {globalList.length > 1 ? `#${index + 1}` : ''}</p>
                      <h3 className="font-display text-xl leading-tight tracking-wide text-suka-brown sm:text-2xl">
                        {promo.promo_name?.trim() || promoRule(promo, rewardNameOf(promo))}
                      </h3>
                      <div className="mt-2 flex flex-wrap items-center gap-1.5">
                        {mounted && promo.is_active && <StatusBadge status={status} />}
                        <OutletScopeBadge outlets={outlets} selectedIds={outletIds} />
                        {outletIds.length === 0 && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2.5 py-1 text-[11px] font-bold text-rose-700">
                            <AlertTriangle className="h-3 w-3" /> Belum ada outlet
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      {globalPromos.length > 0 && (
                        <button
                          type="button"
                          onClick={() => removePromo(promo.group_id)}
                          aria-label="Hapus promo ini"
                          title="Hapus promo ini (outletnya dilepas saat disimpan)"
                          className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                      <span className="hidden text-xs font-bold text-slate-500 sm:inline">{promo.is_active ? 'Aktif' : 'Nonaktif'}</span>
                      <Switch checked={promo.is_active} onChange={v => change('is_active', v)} label="Aktifkan promo semua menu" />
                    </div>
                  </header>

                  {expanded && (
                    <div className="border-t border-slate-100 p-5 sm:p-7">
                      {!promo.is_active && (
                        <p className="mb-6 rounded-xl bg-slate-50 px-4 py-3 text-xs font-medium text-slate-600">
                          Atur detail di bawah, lalu nyalakan saklar di kanan atas agar promo mulai berlaku.
                        </p>
                      )}
                      {shadowed.length > 0 && (
                        <p className="mb-6 flex items-start gap-2 rounded-xl bg-amber-50 px-4 py-3 text-xs font-semibold text-amber-800">
                          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                          <span>
                            Promo ini menutup {shadowed.length} promo per menu di outlet yang sama (
                            {shadowed
                              .slice(0, 3)
                              .map(ip => menuItems.find(m => m.id === ip.menu_item_id)?.name || 'menu')
                              .join(', ')}
                            {shadowed.length > 3 ? ', …' : ''}). Kecualikan menu itu di bawah kalau promo per menunya yang harus berlaku.
                          </span>
                        </p>
                      )}
                      <PromoEditor
                        promo={promo}
                        menuItems={menuItems}
                        outlets={outlets}
                        outletIds={outletIds}
                        rewardId={rewardIdOf(promo)}
                        onChange={change}
                        mounted={mounted}
                        now={now}
                        takenOutlets={taken}
                      />
                    </div>
                  )}
                </article>
              )
            })}
          </section>
        )}
      </div>

      {mounted && editingMenu && (
        <PromoModal
          key={editingMenu.id}
          menu={editingMenu}
          variants={itemPromosOf(editingMenu.id)}
          draft={newPromo(draftItemId(editingMenu.id), 'item', editingMenu.id)}
          menuItems={menuItems}
          outlets={outlets}
          outletIdsOf={outletIdsOf}
          rewardIdOf={rewardIdOf}
          ruleOf={promo => promoRule(promo, rewardNameOf(promo))}
          takenOutletsFor={groupId => takenOutletsFor(groupId, 'item', editingMenu.id)}
          shadowedOutletsOf={shadowedOutletsOf}
          outletNameOf={outletNameOf}
          onChange={(groupId, field, value) => handlePromoChange(groupId, 'item', editingMenu.id, field, value)}
          onAdd={() => addPromo('item', editingMenu.id)}
          onRemove={removePromo}
          onClose={() => setEditingMenuId(null)}
          onSave={handleSave}
          saving={saving}
          dirty={dirty}
          now={now}
        />
      )}

      {mounted &&
        !editingMenu &&
        createPortal(
          /* Portal mencegah wrapper swipe/scroll ikut memindahkan bilah fixed. */
          <div className="pointer-events-none fixed inset-x-3 bottom-[calc(76px+env(safe-area-inset-bottom)+1.5rem)] z-40 flex justify-end sm:inset-x-5 lg:inset-x-auto lg:bottom-6 lg:left-1/2 lg:w-[min(calc(100%-3rem),56rem)] lg:-translate-x-1/2">
            <div className="pointer-events-auto flex w-full items-center gap-3 rounded-2xl border border-slate-200 bg-white/95 p-2.5 pl-4 shadow-[0_12px_32px_-12px_rgba(64,10,7,0.35)] backdrop-blur-md sm:p-3 sm:pl-5">
              <p className="min-w-0 flex-1 text-xs font-semibold text-slate-500">
                {dirty ? (
                  <span className="inline-flex items-center gap-2 text-amber-700">
                    <span className="h-2 w-2 shrink-0 rounded-full bg-amber-500" /> Ada perubahan belum disimpan
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-2 text-slate-500">
                    <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" /> Semua perubahan tersimpan
                  </span>
                )}
              </p>
              <SaveButton onClick={handleSave} saving={saving} dirty={dirty} />
            </div>
          </div>,
          document.body,
        )}
    </div>
  )
}

/* ───────────────────────── Kartu menu ───────────────────────── */

function MenuPromoCard({
  menu,
  promo,
  variantCount,
  rule,
  outlets,
  outletIds,
  mounted,
  now,
  onOpen,
  onToggle,
}: {
  menu: MenuItem
  promo: OutletPromo
  /** Jumlah varian aktif (promo berbeda untuk kelompok outlet berbeda). */
  variantCount: number
  rule: string
  outlets: Outlet[]
  outletIds: string[]
  mounted: boolean
  now: number
  onOpen: () => void
  onToggle: (on: boolean) => void
}) {
  const status = getPromoStatus(promo, now)
  const isBxgy = promo.discount_type === 'buy_one_get_one'
  // Status bergantung jam browser, jadi pratinjau harga baru dihitung setelah mount.
  const showDiscount = mounted && !isBxgy && promo.is_active && promo.discount_value > 0 && status === 'berjalan'
  const discounted =
    promo.discount_type === 'nominal'
      ? Math.max(0, menu.price - promo.discount_value)
      : Math.max(0, menu.price - (menu.price * promo.discount_value) / 100)

  return (
    <article
      className={`group flex flex-col overflow-hidden rounded-2xl bg-white transition-shadow duration-200 hover:shadow-[0_12px_28px_-14px_rgba(64,10,7,0.35)] ${
        promo.is_active ? 'ring-2 ring-suka-orange' : 'ring-1 ring-slate-200'
      }`}
    >
      <button type="button" onClick={onOpen} aria-label={`Atur promo ${menu.name}`} className="relative block w-full cursor-pointer text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-suka-orange">
        <MenuThumb menu={menu} size={240} className="aspect-[4/3] w-full transition-transform duration-300 group-hover:scale-[1.03] motion-reduce:transition-none" />
        {promo.is_active && mounted && (
          <span className="absolute left-2 top-2">
            <StatusBadge status={status} />
          </span>
        )}
        <div className="space-y-1 p-3">
          <p className="line-clamp-2 min-h-[2.5rem] text-sm font-bold leading-tight text-slate-900">{menu.name}</p>
          {showDiscount ? (
            <p className="text-xs font-semibold">
              <span className="text-slate-400 line-through">{rupiah(menu.price)}</span>{' '}
              <span className="text-emerald-700">{rupiah(discounted)}</span>
            </p>
          ) : (
            <p className="text-xs font-semibold text-slate-500">{rupiah(menu.price)}</p>
          )}
        </div>
      </button>
      <div className="mt-auto flex items-center gap-2 border-t border-slate-100 px-3 py-2.5">
        <button type="button" onClick={onOpen} className="min-w-0 flex-1 cursor-pointer text-left">
          {promo.is_active ? (
            <>
              <span className="line-clamp-2 text-xs font-extrabold leading-snug text-suka-brown">
                {rule}
                {variantCount > 1 && <span className="font-bold text-slate-500"> +{variantCount - 1} varian</span>}
              </span>
              <span className="mt-0.5 block">
                <OutletScopeBadge outlets={outlets} selectedIds={outletIds} />
              </span>
            </>
          ) : (
            <span className="inline-flex items-center gap-1 text-xs font-bold text-slate-400 group-hover:text-suka-brown">
              Atur promo <ChevronRight className="h-3.5 w-3.5" />
            </span>
          )}
        </button>
        <Switch size="sm" checked={promo.is_active} onChange={onToggle} label={`Promo ${menu.name}`} />
      </div>
    </article>
  )
}

/* ───────────────────────── Modal editor ───────────────────────── */

function SaveButton({ onClick, saving, dirty }: { onClick: () => void; saving: boolean; dirty: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={saving}
      className={`inline-flex shrink-0 cursor-pointer items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm font-bold text-white transition-colors duration-150 disabled:cursor-wait disabled:opacity-70 sm:px-7 ${
        dirty ? 'bg-suka-orange shadow-lg shadow-suka-orange/30 hover:bg-[#e3842f]' : 'bg-suka-brown/80 hover:bg-suka-brown'
      }`}
    >
      {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
      Simpan promo
    </button>
  )
}

/**
 * Modal promo per menu. Kolom kiri tetap terlihat (foto, daftar varian,
 * saklar aktif, ringkasan tiket) sementara form varian terpilih di-scroll di
 * kanan; di layar kecil keduanya bertumpuk. Satu menu bisa punya beberapa
 * varian — promo berbeda untuk kelompok outlet berbeda.
 */
function PromoModal({
  menu,
  variants,
  draft,
  menuItems,
  outlets,
  outletIdsOf,
  rewardIdOf,
  ruleOf,
  takenOutletsFor,
  shadowedOutletsOf,
  outletNameOf,
  onChange,
  onAdd,
  onRemove,
  onClose,
  onSave,
  saving,
  dirty,
  now,
}: {
  menu: MenuItem
  variants: OutletPromo[]
  /** Rancangan yang dipakai saat menu belum punya varian sama sekali. */
  draft: OutletPromo
  menuItems: MenuItem[]
  outlets: Outlet[]
  outletIdsOf: (promo: OutletPromo) => string[]
  rewardIdOf: (promo: OutletPromo) => string | null
  ruleOf: (promo: OutletPromo) => string
  takenOutletsFor: (groupId: string) => Record<string, string>
  shadowedOutletsOf: (promo: OutletPromo) => { outletId: string; by: OutletPromo }[]
  outletNameOf: (id: string) => string
  onChange: (groupId: string, field: PromoField, value: any) => void
  onAdd: () => string
  onRemove: (groupId: string) => void
  onClose: () => void
  onSave: () => void
  saving: boolean
  dirty: boolean
  now: number
}) {
  const list = variants.length > 0 ? variants : [draft]
  const [selectedId, setSelectedId] = useState<string>(() => (list.find(v => v.is_active) || list[0]).group_id)
  const promo = list.find(v => v.group_id === selectedId) || list[0]

  useEffect(() => {
    const esc = (e: KeyboardEvent) => {
      // Escape di dalam popover (kalender, pemilih menu) cukup menutup popover itu.
      if (e.key === 'Escape' && !document.querySelector('[role="dialog"] [aria-expanded="true"]')) onClose()
    }
    document.addEventListener('keydown', esc)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', esc)
      document.body.style.overflow = prev
    }
  }, [onClose])

  const rewardId = rewardIdOf(promo)
  const reward = menuItems.find(m => m.id === rewardId)
  const outletIds = outletIdsOf(promo)
  const rule = ruleOf(promo)
  const shadowed = shadowedOutletsOf(promo)
  const change = (field: PromoField, value: any) => onChange(promo.group_id, field, value)

  return createPortal(
    <div className="fixed inset-0 z-[60] flex items-end justify-center sm:items-center sm:p-6">
      <button type="button" aria-label="Tutup" onClick={onClose} className="absolute inset-0 cursor-default bg-suka-ink/45 backdrop-blur-[3px] animate-fade-in" />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Promo ${menu.name}`}
        className="relative flex max-h-[94dvh] w-full max-w-4xl flex-col overflow-hidden rounded-t-3xl bg-white shadow-[0_30px_80px_-20px_rgba(64,10,7,0.45)] animate-fade-in sm:max-h-[88vh] sm:rounded-3xl"
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Tutup"
          className="absolute right-3 top-3 z-10 flex h-10 w-10 cursor-pointer items-center justify-center rounded-full bg-white/90 text-slate-500 shadow-sm backdrop-blur hover:bg-white hover:text-slate-800"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto md:flex-row md:overflow-hidden">
          {/* Kolom kiri */}
          <aside className="shrink-0 space-y-4 bg-suka-cream/70 p-5 md:w-80 md:overflow-y-auto md:border-r md:border-slate-100 md:p-6">
            <div className="flex items-center gap-4 md:block">
              <MenuThumb menu={menu} size={272} className="h-20 w-20 shrink-0 rounded-2xl md:aspect-square md:h-auto md:w-full" />
              <div className="min-w-0 md:mt-4">
                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Promo per menu</p>
                <h2 className="font-display text-2xl leading-tight tracking-wide text-suka-brown">{menu.name}</h2>
                <p className="mt-0.5 text-sm font-semibold text-slate-500">{rupiah(menu.price)}</p>
              </div>
            </div>

            {/* Daftar varian: satu baris per kelompok outlet. */}
            <div className="space-y-1.5">
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Promo per kelompok outlet</p>
              <div role="tablist" aria-label="Varian promo" className="space-y-1">
                {list.map((v, index) => {
                  const active = v.group_id === promo.group_id
                  const ids = outletIdsOf(v)
                  return (
                    <button
                      key={v.group_id}
                      type="button"
                      role="tab"
                      aria-selected={active}
                      onClick={() => setSelectedId(v.group_id)}
                      className={`flex w-full cursor-pointer items-center gap-2.5 rounded-xl border-2 px-3 py-2 text-left transition-colors ${
                        active ? 'border-suka-orange bg-white' : 'border-transparent bg-white/60 hover:bg-white'
                      }`}
                    >
                      <span className={`h-2 w-2 shrink-0 rounded-full ${v.is_active ? 'bg-emerald-500' : 'bg-slate-300'}`} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-xs font-extrabold text-slate-900">{v.promo_name?.trim() || ruleOf(v) || `Promo ${index + 1}`}</span>
                        <span className="block truncate text-[11px] font-medium text-slate-500">
                          {ids.length === 0 ? 'Belum ada outlet' : ids.length >= outlets.length ? 'Semua outlet' : `${ids.length} outlet`}
                        </span>
                      </span>
                      {list.length > 1 && (
                        <span
                          role="button"
                          tabIndex={0}
                          aria-label="Hapus varian ini"
                          title="Hapus varian ini (outletnya dilepas saat disimpan)"
                          onClick={e => {
                            e.stopPropagation()
                            onRemove(v.group_id)
                            if (active) setSelectedId(list.find(x => x.group_id !== v.group_id)!.group_id)
                          }}
                          onKeyDown={e => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault()
                              e.stopPropagation()
                              onRemove(v.group_id)
                              if (active) setSelectedId(list.find(x => x.group_id !== v.group_id)!.group_id)
                            }
                          }}
                          className="flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center rounded-md text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </span>
                      )}
                    </button>
                  )
                })}
              </div>
              <button
                type="button"
                onClick={() => {
                  // Varian pertama yang masih rancangan ikut dimasukkan ke state
                  // dulu supaya outlet bawaan varian baru tidak menimpanya.
                  if (variants.length === 0) onChange(draft.group_id, 'outlet_ids', outletIdsOf(draft))
                  setSelectedId(onAdd())
                }}
                className="flex w-full cursor-pointer items-center justify-center gap-1.5 rounded-xl border-2 border-dashed border-slate-300 px-3 py-2 text-xs font-bold text-slate-600 transition-colors hover:border-suka-orange/60 hover:text-suka-brown"
              >
                <Plus className="h-3.5 w-3.5" /> Tambah promo untuk outlet lain
              </button>
            </div>

            <div className={`flex items-center justify-between gap-3 rounded-2xl border-2 p-3.5 transition-colors ${promo.is_active ? 'border-suka-orange bg-white' : 'border-slate-200 bg-white/70'}`}>
              <div className="min-w-0">
                <p className="text-sm font-extrabold text-slate-900">{promo.is_active ? 'Promo aktif' : 'Promo nonaktif'}</p>
                <p className="text-[11px] font-medium text-slate-500">{promo.is_active ? 'Berlaku sesuai jadwal.' : 'Nyalakan agar berlaku.'}</p>
              </div>
              <Switch checked={promo.is_active} onChange={v => change('is_active', v)} label={`Aktifkan promo ${menu.name}`} />
            </div>

            {shadowed.length > 0 && (
              <p className="flex items-start gap-2 rounded-xl bg-amber-50 px-3.5 py-3 text-xs font-semibold text-amber-800">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>
                  Di {shadowed.length === outletIds.length ? 'semua outlet promo ini' : shadowed.map(s => outletNameOf(s.outletId)).slice(0, 3).join(', ') + (shadowed.length > 3 ? `, +${shadowed.length - 3} lagi` : '')}{' '}
                  kasir mendahulukan promo semua menu &ldquo;{shadowed[0].by.promo_name?.trim() || 'yang aktif'}&rdquo;. Kecualikan {menu.name} di promo itu agar promo ini
                  yang berlaku.
                </span>
              </p>
            )}

            <PromoTicket promo={promo} rule={rule} trigger={menu} reward={reward} outlets={outlets} outletIds={outletIds} mounted now={now} stacked />
          </aside>

          {/* Kolom kanan */}
          <div className="min-w-0 flex-1 p-5 md:overflow-y-auto md:p-7 md:pt-8">
            <PromoEditor
              key={promo.group_id}
              promo={promo}
              menu={menu}
              menuItems={menuItems}
              outlets={outlets}
              outletIds={outletIds}
              rewardId={rewardId}
              onChange={change}
              mounted
              now={now}
              hideTicket
              takenOutlets={takenOutletsFor(promo.group_id)}
            />
          </div>
        </div>

        <footer className="flex items-center gap-3 border-t border-slate-100 bg-white p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] sm:px-5 sm:py-4">
          <button type="button" onClick={onClose} className="cursor-pointer rounded-xl px-4 py-3 text-sm font-bold text-slate-600 hover:bg-slate-100">
            Tutup
          </button>
          <span className="min-w-0 flex-1 truncate text-xs font-semibold text-amber-700">
            {dirty && (
              <span className="inline-flex items-center gap-2">
                <span className="h-2 w-2 shrink-0 rounded-full bg-amber-500" /> Belum disimpan
              </span>
            )}
          </span>
          <SaveButton onClick={onSave} saving={saving} dirty={dirty} />
        </footer>
      </div>
    </div>,
    document.body,
  )
}
