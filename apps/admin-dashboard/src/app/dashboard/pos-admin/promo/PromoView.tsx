'use client'

import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { AlertTriangle, CheckCircle2, ChevronRight, Globe2, LayoutGrid, Loader2, Search, X } from 'lucide-react'
import { toast } from 'sonner'
import { Switch } from '@/components/ui/controls'
import { WIB_LABEL } from '@/lib/timezone'
import { getPromoStatus, validateSchedule } from '@/lib/promoSchedule'
import { resolvePromoOutletIds } from '@/lib/promoOutlets'
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
  const [mounted, setMounted] = useState(false)
  // Status jadwal ikut jalan tanpa reload: dievaluasi ulang tiap 30 detik.
  const [now, setNow] = useState<number>(() => Date.now())

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
  /** Outlet promo yang tersimpan; promo baru default ke seluruh outlet aktif. */
  const outletIdsOf = (promo: OutletPromo) => resolvePromoOutletIds(promo, allOutletIds)

  const newPromo = (scope: 'global' | 'item', menuId: string | null): OutletPromo => ({
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
    outlet_ids: allOutletIds,
    ...(scope === 'global' ? { excluded_menu_item_ids: [] } : {}),
  })

  const globalPromo = promos.find(p => p.scope === 'global') || newPromo('global', null)
  const itemPromoOf = (menuId: string) => promos.find(p => p.scope === 'item' && p.menu_item_id === menuId) || newPromo('item', menuId)
  const isGlobalActive = globalPromo.is_active

  const handleGlobalPromoChange = (field: PromoField, value: any) => {
    setPromos(prev => {
      const updated = [...prev]
      const idx = updated.findIndex(p => p.scope === 'global')

      // Promo semua menu dan promo per menu tidak berjalan bersamaan.
      if (field === 'is_active' && value === true) {
        for (let i = 0; i < updated.length; i++) {
          if (updated[i].scope === 'item') updated[i] = { ...updated[i], is_active: false }
        }
      }

      const base = idx >= 0 ? updated[idx] : newPromo('global', null)
      const next: OutletPromo = {
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
      }
      if (idx >= 0) updated[idx] = next
      else updated.push(next)
      return updated
    })
  }

  const handleItemPromoChange = (menuId: string, field: PromoField, value: any) => {
    setPromos(prev => {
      const updated = [...prev]
      const idx = updated.findIndex(p => p.scope === 'item' && p.menu_item_id === menuId)
      if (idx >= 0) updated[idx] = { ...updated[idx], [field]: value }
      else updated.push({ ...newPromo('item', menuId), [field]: value })
      return updated
    })
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      if (!outlets || outlets.length === 0) throw new Error('Tidak ada outlet aktif untuk diterapkan promo.')

      // Cegah jadwal terbalik sebelum menyentuh server (DB juga menolaknya).
      // Promo nonaktif dilewati — tanggal basi di promo yang sudah dimatikan
      // tak boleh memblokir penyimpanan promo lain yang sedang diedit.
      for (const p of promos) {
        if (!p.is_active) continue
        const label = p.scope === 'global' ? 'Promo Semua Menu' : menuItems.find(m => m.id === p.menu_item_id)?.name || 'Promo menu'
        if (outletIdsOf(p).length === 0) throw new Error(`${label}: pilih minimal satu outlet yang masih aktif.`)
        const scheduleError = validateSchedule(p)
        if (scheduleError) throw new Error(`${label}: ${scheduleError}`)
      }

      const result = await savePromosAction(outlets, promos)
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
      .map(menu => ({ menu, promo: itemPromoOf(menu.id) }))
      .filter(({ menu, promo }) => {
        if (keyword && !menu.name.toLowerCase().includes(keyword)) return false
        if (filter === 'active') return promo.is_active
        if (filter === 'inactive') return !promo.is_active
        return true
      })
      // Menu yang sedang berpromo tampil paling depan.
      .sort((a, b) => Number(b.promo.is_active) - Number(a.promo.is_active))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [menuItems, promos, searchQuery, filter])

  const activeItemPromos = promos.filter(p => p.scope === 'item' && p.is_active && menuItems.some(m => m.id === p.menu_item_id))
  const counted = [...activeItemPromos, ...(isGlobalActive ? [globalPromo] : [])]
  const stat = {
    running: mounted ? counted.filter(p => getPromoStatus(p, now) === 'berjalan').length : 0,
    scheduled: mounted ? counted.filter(p => getPromoStatus(p, now) === 'terjadwal').length : 0,
    ended: mounted ? counted.filter(p => getPromoStatus(p, now) === 'berakhir').length : 0,
  }

  const editingMenu = editingMenuId ? menuItems.find(m => m.id === editingMenuId) || null : null

  return (
    <div className="mx-auto w-full max-w-6xl animate-fade-in">
      {/* Ruang bawah menjaga konten terakhir tetap terbaca di balik bilah simpan. */}
      <div className="space-y-6 pb-40">
        {/* ── Header ── */}
        <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="font-display text-3xl tracking-wide text-suka-brown sm:text-4xl">Pengaturan Promo</h1>
            <p className="mt-1 max-w-xl text-sm font-medium text-slate-500">
              Atur diskon dan Beli X Gratis Y untuk kasir POS. Semua jam dalam {WIB_LABEL}.
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
            ['global', 'Promo semua menu', <Globe2 key="i" className="h-4 w-4" />, isGlobalActive ? 'Aktif' : 'Nonaktif'],
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
            {isGlobalActive && (
              <div className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                <p>
                  <b>Promo semua menu sedang aktif</b>, jadi promo per menu tidak berlaku. Matikan dulu di tab{' '}
                  <button type="button" onClick={() => setTab('global')} className="cursor-pointer font-bold underline">
                    Promo semua menu
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
              <div className={`grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 xl:grid-cols-4 ${isGlobalActive ? 'pointer-events-none opacity-50 grayscale' : ''}`}>
                {menuCards.map(({ menu, promo }) => (
                  <MenuPromoCard
                    key={menu.id}
                    menu={menu}
                    promo={promo}
                    rule={promoRule(promo, rewardNameOf(promo))}
                    outlets={outlets}
                    outletIds={outletIdsOf(promo)}
                    mounted={mounted}
                    now={now}
                    onOpen={() => setEditingMenuId(menu.id)}
                    onToggle={on => {
                      handleItemPromoChange(menu.id, 'is_active', on)
                      if (on) setEditingMenuId(menu.id)
                    }}
                  />
                ))}
              </div>
            )}
          </section>
        ) : (
          <section aria-label="Promo semua menu" className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200/70 sm:p-7">
            <div className="mb-6 flex items-start justify-between gap-4">
              <div className="min-w-0">
                <h2 className="font-display text-2xl tracking-wide text-suka-brown">Promo semua menu</h2>
                <p className="mt-1 text-sm text-slate-500">Berlaku untuk seluruh pesanan. Selama aktif, promo per menu dimatikan.</p>
              </div>
              <div className="flex shrink-0 items-center gap-2.5">
                <span className="hidden text-xs font-bold text-slate-500 sm:inline">{isGlobalActive ? 'Aktif' : 'Nonaktif'}</span>
                <Switch checked={isGlobalActive} onChange={v => handleGlobalPromoChange('is_active', v)} label="Aktifkan promo semua menu" />
              </div>
            </div>
            {!isGlobalActive && (
              <p className="mb-6 rounded-xl bg-slate-50 px-4 py-3 text-xs font-medium text-slate-600">
                Atur detail di bawah, lalu nyalakan saklar di kanan atas agar promo mulai berlaku.
              </p>
            )}
            <PromoEditor
              promo={globalPromo}
              menuItems={menuItems}
              outlets={outlets}
              outletIds={outletIdsOf(globalPromo)}
              rewardId={rewardIdOf(globalPromo)}
              onChange={handleGlobalPromoChange}
              mounted={mounted}
              now={now}
            />
          </section>
        )}
      </div>

      {mounted && editingMenu && (
        <PromoModal
          menu={editingMenu}
          promo={itemPromoOf(editingMenu.id)}
          menuItems={menuItems}
          outlets={outlets}
          outletIds={outletIdsOf(itemPromoOf(editingMenu.id))}
          rewardId={rewardIdOf(itemPromoOf(editingMenu.id))}
          rule={promoRule(itemPromoOf(editingMenu.id), rewardNameOf(itemPromoOf(editingMenu.id)))}
          onChange={(field, value) => handleItemPromoChange(editingMenu.id, field, value)}
          onClose={() => setEditingMenuId(null)}
          onSave={handleSave}
          saving={saving}
          dirty={dirty}
          disabled={isGlobalActive}
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
              <span className="line-clamp-2 text-xs font-extrabold leading-snug text-suka-brown">{rule}</span>
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
 * Modal promo per menu. Kolom kiri tetap terlihat (foto, saklar aktif, ringkasan
 * tiket) sementara form di kanan di-scroll; di layar kecil keduanya bertumpuk.
 */
function PromoModal({
  menu,
  promo,
  menuItems,
  outlets,
  outletIds,
  rewardId,
  rule,
  onChange,
  onClose,
  onSave,
  saving,
  dirty,
  disabled,
  now,
}: {
  menu: MenuItem
  promo: OutletPromo
  menuItems: MenuItem[]
  outlets: Outlet[]
  outletIds: string[]
  rewardId: string | null
  rule: string
  onChange: (field: PromoField, value: any) => void
  onClose: () => void
  onSave: () => void
  saving: boolean
  dirty: boolean
  disabled: boolean
  now: number
}) {
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

  const reward = menuItems.find(m => m.id === rewardId)

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

            <div className={`flex items-center justify-between gap-3 rounded-2xl border-2 p-3.5 transition-colors ${promo.is_active ? 'border-suka-orange bg-white' : 'border-slate-200 bg-white/70'}`}>
              <div className="min-w-0">
                <p className="text-sm font-extrabold text-slate-900">{promo.is_active ? 'Promo aktif' : 'Promo nonaktif'}</p>
                <p className="text-[11px] font-medium text-slate-500">{promo.is_active ? 'Berlaku sesuai jadwal.' : 'Nyalakan agar berlaku.'}</p>
              </div>
              <Switch checked={promo.is_active} disabled={disabled} onChange={v => onChange('is_active', v)} label={`Aktifkan promo ${menu.name}`} />
            </div>

            {disabled && (
              <p className="flex items-start gap-2 rounded-xl bg-amber-50 px-3.5 py-3 text-xs font-semibold text-amber-800">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> Promo semua menu sedang aktif, jadi promo per menu tidak berlaku.
              </p>
            )}

            <PromoTicket promo={promo} rule={rule} trigger={menu} reward={reward} outlets={outlets} outletIds={outletIds} mounted now={now} stacked />
          </aside>

          {/* Kolom kanan */}
          <div className="min-w-0 flex-1 p-5 md:overflow-y-auto md:p-7 md:pt-8">
            <PromoEditor
              promo={promo}
              menu={menu}
              menuItems={menuItems}
              outlets={outlets}
              outletIds={outletIds}
              rewardId={rewardId}
              onChange={onChange}
              mounted
              now={now}
              hideTicket
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
