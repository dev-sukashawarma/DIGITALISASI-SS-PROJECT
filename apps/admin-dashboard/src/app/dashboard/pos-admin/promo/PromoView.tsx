'use client'

import { useState, useEffect } from 'react'
import { Loader2, Tag, Percent, CheckCircle2, AlertCircle, Search, CalendarClock } from 'lucide-react'
import { toast } from 'sonner'
import { CurrencyInput } from '@suka/design-system'
import { savePromosAction } from './actions'
import { toWibInputValue, fromWibInputValue, formatWib, WIB_LABEL } from '@/lib/timezone'
import { getPromoStatus, validateSchedule, STATUS_LABEL, type PromoStatus } from '@/lib/promoSchedule'

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
  discount_type: 'percentage' | 'nominal'
  discount_value: number
  is_active: boolean
  min_purchase?: number | null
  usage_limit?: number | null
  current_usage?: number
  start_date?: string | null
  end_date?: string | null
  apply_to_food_apps?: boolean
  sync_to_order_online?: boolean
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
  nonaktif: 'bg-gray-100 text-gray-600 border-gray-200',
  terjadwal: 'bg-violet-50 text-violet-700 border-violet-200',
  berjalan: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  berakhir: 'bg-rose-50 text-rose-700 border-rose-200',
}

function StatusBadge({ status }: { status: PromoStatus }) {
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-bold ${STATUS_STYLE[status]}`}>
      <span className="w-1.5 h-1.5 rounded-full bg-current" />
      {STATUS_LABEL[status]}
    </span>
  )
}

/** Ringkasan jadwal untuk dibaca sekilas, selalu dalam WIB. */
function ScheduleSummary({ promo }: { promo: OutletPromo }) {
  if (!promo.start_date && !promo.end_date) {
    return <p className="text-xs text-gray-500">Tanpa jadwal — berlaku selama promo dinyalakan.</p>
  }
  return (
    <p className="text-xs text-gray-500">
      {promo.start_date ? `Mulai ${formatWib(promo.start_date)}` : 'Mulai sejak dinyalakan'}
      {' · '}
      {promo.end_date ? `Selesai ${formatWib(promo.end_date)}` : 'Tanpa batas akhir'}
    </p>
  )
}

export default function PromoView({ initialMenuItems, initialOutlets, initialPromos }: PromoViewProps) {
  const [menuItems] = useState<MenuItem[]>(initialMenuItems)
  const [promos, setPromos] = useState<OutletPromo[]>(initialPromos)
  const [outlets] = useState<Outlet[]>(initialOutlets)
  const [saving, setSaving] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [mounted, setMounted] = useState(false)
  // Status jadwal ikut jalan tanpa reload: dievaluasi ulang tiap 30 detik.
  const [now, setNow] = useState<number>(() => Date.now())

  useEffect(() => {
    setMounted(true)
    const timer = setInterval(() => setNow(Date.now()), 30_000)
    return () => clearInterval(timer)
  }, [])

  const globalPromo = promos.find(p => p.scope === 'global') || {
    scope: 'global',
    menu_item_id: null,
    discount_type: 'percentage',
    discount_value: 0,
    is_active: false,
    min_purchase: null,
    usage_limit: null,
    current_usage: 0,
    start_date: null,
    end_date: null,
    apply_to_food_apps: false,
    sync_to_order_online: false
  } as OutletPromo

  const isGlobalActive = globalPromo.is_active

  const handleGlobalPromoChange = (field: keyof OutletPromo, value: any) => {
    const updated = [...promos]
    const idx = updated.findIndex(p => p.scope === 'global')

    if (field === 'is_active' && value === true) {
      updated.forEach(p => {
        if (p.scope === 'item') p.is_active = false
      })
    }

    if (idx >= 0) {
      updated[idx] = { ...updated[idx], [field]: value }
    } else {
      updated.push({ ...globalPromo, [field]: value })
    }
    setPromos(updated)
  }

  const handleItemPromoChange = (menuId: string, field: keyof OutletPromo, value: any) => {
    const updated = [...promos]
    const idx = updated.findIndex(p => p.scope === 'item' && p.menu_item_id === menuId)

    if (idx >= 0) {
      updated[idx] = { ...updated[idx], [field]: value }
    } else {
      updated.push({
        scope: 'item',
        menu_item_id: menuId,
        discount_type: 'nominal',
        discount_value: 0,
        is_active: field === 'is_active' ? value : false,
        min_purchase: null,
        usage_limit: null,
        current_usage: 0,
        start_date: null,
        end_date: null,
        apply_to_food_apps: false,
        sync_to_order_online: false,
        [field]: value
      })
    }
    setPromos(updated)
  }

  const handleSave = async () => {
    setSaving(true)

    try {
      if (!outlets || outlets.length === 0) {
        throw new Error('Tidak ada outlet aktif untuk diterapkan promo.')
      }

      // Cegah jadwal terbalik sebelum menyentuh server (DB juga menolaknya).
      for (const p of promos) {
        const scheduleError = validateSchedule(p)
        if (scheduleError) {
          const label = p.scope === 'global'
            ? 'Promo Semua Menu'
            : menuItems.find(m => m.id === p.menu_item_id)?.name || 'Promo menu'
          throw new Error(`${label}: ${scheduleError}`)
        }
      }

      const result = await savePromosAction(outlets, promos)

      if (result && !result.success) {
        throw new Error(result.error || 'Gagal menyimpan promo')
      }

      toast.success('Pengaturan promo berhasil diterapkan ke semua outlet!')
    } catch (err: any) {
      console.error(err)
      toast.error(err.message || 'Gagal menyimpan promo')
    } finally {
      setSaving(false)
    }
  }

  const filteredMenuItems = menuItems.filter(m => m.name.toLowerCase().includes(searchQuery.toLowerCase()))

  const scheduledCount = promos.filter(p => getPromoStatus(p, now) === 'terjadwal').length

  return (
    <div className="max-w-4xl w-full mx-auto animate-fade-in">
      {/* pb besar supaya kartu terakhir tidak tertutup bilah simpan yang sticky */}
      <div className="space-y-6 pb-40">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 tracking-tight">Pengaturan Promo</h1>
          <p className="text-gray-500 text-sm sm:text-base mt-1 font-medium">Kelola diskon Global (Seluruh Transaksi) atau diskon Per Menu.</p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center px-3 py-1.5 bg-amber-50 text-amber-700 text-xs sm:text-sm font-semibold rounded-full border border-amber-200/60">
              <AlertCircle className="w-4 h-4 mr-1.5" />
              Berlaku untuk semua cabang outlet
            </span>
            <span className="inline-flex items-center px-3 py-1.5 bg-gray-50 text-gray-600 text-xs sm:text-sm font-semibold rounded-full border border-gray-200">
              <CalendarClock className="w-4 h-4 mr-1.5" />
              Semua jam dalam {WIB_LABEL}
            </span>
            {scheduledCount > 0 && (
              <span className="inline-flex items-center px-3 py-1.5 bg-violet-50 text-violet-700 text-xs sm:text-sm font-semibold rounded-full border border-violet-200">
                {scheduledCount} promo terjadwal
              </span>
            )}
          </div>
        </div>

        {/* PROMO GLOBAL */}
        <section className={`rounded-2xl p-5 sm:p-8 border-2 transition-all duration-300 ${globalPromo.is_active ? 'border-amber-400 bg-white shadow-card' : 'border-gray-100 bg-white hover:border-gray-200'}`}>
          <div className="flex justify-between items-start gap-4">
            <div className="min-w-0">
              <h2 className={`font-bold text-lg sm:text-xl flex items-center gap-2 ${globalPromo.is_active ? 'text-amber-700' : 'text-gray-900'}`}>
                <Tag className={`w-5 h-5 sm:w-6 sm:h-6 shrink-0 ${globalPromo.is_active ? 'text-amber-500' : 'text-gray-400'}`} />
                Promo Semua Menu
              </h2>
              <p className="text-sm text-gray-500 mt-1 font-medium">Berlaku untuk total harga semua pesanan tanpa terkecuali.</p>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                {mounted && <StatusBadge status={getPromoStatus(globalPromo, now)} />}
              </div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer shrink-0 mt-1">
              <input type="checkbox" className="sr-only peer" checked={globalPromo.is_active} onChange={(e) => handleGlobalPromoChange('is_active', e.target.checked)} />
              <div className="w-12 h-7 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:bg-amber-500"></div>
            </label>
          </div>

          {globalPromo.is_active && (
            <div className="mt-6 pt-6 border-t border-amber-200/50 space-y-6 animate-fade-in">
              {/* Nilai diskon */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="space-y-2">
                  <label className="block text-sm font-bold text-gray-700">Tipe Diskon</label>
                  <select
                    className="w-full bg-white border-2 border-amber-200 focus:border-amber-400 rounded-xl px-4 py-2.5 outline-none transition-colors font-semibold text-gray-900 appearance-none cursor-pointer"
                    value={globalPromo.discount_type}
                    onChange={e => handleGlobalPromoChange('discount_type', e.target.value)}
                  >
                    <option value="percentage">Persentase (%)</option>
                    <option value="nominal">Nominal (Rp)</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="block text-sm font-bold text-gray-700">Nilai Diskon</label>
                  <div className="relative">
                    {globalPromo.discount_type === 'nominal' ? (
                      <CurrencyInput
                        value={globalPromo.discount_value || 0}
                        onChange={v => handleGlobalPromoChange('discount_value', v)}
                        className="w-full bg-white border-2 border-amber-200 focus:border-amber-400 rounded-xl py-2.5 pr-4 outline-none transition-colors font-bold text-gray-900"
                      />
                    ) : (
                      <input
                        type="number"
                        onWheel={(e) => e.currentTarget.blur()}
                        min="0"
                        max="100"
                        className="w-full bg-white border-2 border-amber-200 focus:border-amber-400 rounded-xl py-2.5 outline-none transition-colors font-bold text-gray-900 pl-4 pr-11"
                        value={globalPromo.discount_value || ''}
                        onChange={e => handleGlobalPromoChange('discount_value', Number(e.target.value))}
                      />
                    )}
                    {globalPromo.discount_type === 'percentage' && <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 font-bold"><Percent className="w-4 h-4" /></span>}
                  </div>
                </div>
              </div>

              {/* Jadwal promo */}
              <div className="rounded-xl border border-amber-100 bg-amber-50/50 p-4 sm:p-5 space-y-4">
                <div className="flex items-center gap-2">
                  <CalendarClock className="w-4 h-4 text-amber-600 shrink-0" />
                  <h3 className="text-sm font-bold text-gray-800">Jadwal Promo <span className="text-gray-500 font-medium">({WIB_LABEL})</span></h3>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="block text-sm font-semibold text-gray-700">
                      Mulai <span className="text-gray-400 font-medium">(Opsional)</span>
                    </label>
                    <input
                      type="datetime-local"
                      className="w-full bg-white border-2 border-amber-200 focus:border-amber-400 rounded-xl px-4 py-2.5 outline-none transition-colors font-semibold text-gray-900"
                      value={mounted ? toWibInputValue(globalPromo.start_date) : ''}
                      onChange={e => handleGlobalPromoChange('start_date', fromWibInputValue(e.target.value))}
                    />
                    <p className="text-xs text-gray-500">Kosongkan agar langsung berlaku.</p>
                  </div>
                  <div className="space-y-1.5">
                    <label className="block text-sm font-semibold text-gray-700">
                      Selesai <span className="text-gray-400 font-medium">(Opsional)</span>
                    </label>
                    <input
                      type="datetime-local"
                      className="w-full bg-white border-2 border-amber-200 focus:border-amber-400 rounded-xl px-4 py-2.5 outline-none transition-colors font-semibold text-gray-900"
                      value={mounted ? toWibInputValue(globalPromo.end_date) : ''}
                      onChange={e => handleGlobalPromoChange('end_date', fromWibInputValue(e.target.value))}
                    />
                    <p className="text-xs text-gray-500">Kosongkan agar tanpa batas akhir.</p>
                  </div>
                </div>
                {mounted && <ScheduleSummary promo={globalPromo} />}
              </div>

              {/* Syarat & kuota */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="space-y-1.5">
                  <label className="block text-sm font-bold text-gray-700">
                    Minimum Belanja (Rp) <span className="text-gray-400 text-xs font-normal">(Opsional)</span>
                  </label>
                  <CurrencyInput
                    value={globalPromo.min_purchase || 0}
                    onChange={(v) => handleGlobalPromoChange('min_purchase', v || null)}
                    className="w-full bg-white border-2 border-amber-200 focus:border-amber-400 rounded-xl py-2.5 pr-4 outline-none transition-colors font-semibold text-gray-900"
                  />
                  <p className="text-xs text-gray-500">Kosongkan jika tanpa minimum belanja</p>
                </div>
                <div className="space-y-1.5">
                  <label className="block text-sm font-bold text-gray-700">
                    Batas Kuota Pemakaian <span className="text-gray-400 text-xs font-normal">(Opsional)</span>
                  </label>
                  <input
                    type="number"
                    min="1"
                    placeholder="Contoh: 5"
                    value={globalPromo.usage_limit || ''}
                    onChange={(e) => handleGlobalPromoChange('usage_limit', e.target.value ? Number(e.target.value) : null)}
                    className="w-full bg-white border-2 border-amber-200 focus:border-amber-400 rounded-xl px-4 py-2.5 outline-none transition-colors font-semibold text-gray-900"
                  />
                  <p className="text-xs text-gray-500">Kosongkan jika kuota tak terbatas</p>
                  {globalPromo.usage_limit ? (
                    <p className="text-xs text-amber-600 font-medium">Terpakai: {globalPromo.current_usage || 0} / {globalPromo.usage_limit}</p>
                  ) : null}
                </div>
              </div>

              {/* Kanal */}
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-4 p-4 bg-amber-50 rounded-xl border border-amber-100">
                  <div className="min-w-0">
                    <label className="block text-sm font-bold text-gray-700">Berlaku untuk Food Apps</label>
                    <p className="text-xs text-gray-500 mt-1">Jika diaktifkan, promo juga berlaku untuk GoFood, GrabFood, ShopeeFood, dll.</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer shrink-0">
                    <input
                      type="checkbox"
                      className="sr-only peer"
                      checked={globalPromo.apply_to_food_apps || false}
                      onChange={(e) => handleGlobalPromoChange('apply_to_food_apps', e.target.checked)}
                    />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-500"></div>
                  </label>
                </div>

                <div className="flex items-center justify-between gap-4 p-4 bg-orange-50 rounded-xl border border-orange-100">
                  <div className="min-w-0">
                    <label className="block text-sm font-bold text-gray-700">Terapkan ke Order Website (Order Online)</label>
                    <p className="text-xs text-gray-500 mt-1">
                      Jika diaktifkan, promo ini akan otomatis sinkron dan berlaku di platform Order Online.
                      Promo yang masih berstatus <b>Terjadwal</b> dikirim non-aktif — simpan ulang saat jadwalnya tiba.
                    </p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer shrink-0">
                    <input
                      type="checkbox"
                      className="sr-only peer"
                      checked={globalPromo.sync_to_order_online || false}
                      onChange={(e) => handleGlobalPromoChange('sync_to_order_online', e.target.checked)}
                    />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-orange-500"></div>
                  </label>
                </div>
              </div>
            </div>
          )}
        </section>

        {/* PROMO ITEM */}
        <section className={`rounded-2xl p-5 sm:p-8 space-y-6 border-2 border-gray-100 bg-white shadow-sm transition-all duration-300 ${isGlobalActive ? 'opacity-40 pointer-events-none grayscale' : ''}`}>
          <div>
            <h2 className="font-bold text-lg sm:text-xl text-gray-900 flex items-center gap-2">
              <Tag className="w-5 h-5 sm:w-6 sm:h-6 text-blue-500 shrink-0" /> Promo Per Menu
            </h2>
            <p className="text-sm text-gray-500 mt-1 font-medium">Berikan diskon untuk menu spesifik. Nonaktif saat Promo Global aktif.</p>
          </div>

          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Cari nama menu..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full bg-gray-50 border-2 border-transparent focus:border-blue-400 focus:bg-white rounded-xl pl-12 pr-4 py-3 outline-none transition-colors font-medium text-gray-900"
            />
          </div>

          <div className="space-y-4 pt-2">
            {filteredMenuItems.length === 0 ? (
              <div className="text-center py-12 bg-gray-50 rounded-2xl border border-dashed border-gray-200">
                <p className="text-gray-500 font-medium">Tidak ada menu yang sesuai pencarian.</p>
              </div>
            ) : (
              filteredMenuItems.map(menu => {
                const promo = promos.find(p => p.scope === 'item' && p.menu_item_id === menu.id) || {
                  scope: 'item',
                  menu_item_id: menu.id,
                  discount_type: 'nominal',
                  discount_value: 0,
                  is_active: false,
                  min_purchase: null,
                  start_date: null,
                  end_date: null,
                  sync_to_order_online: false
                } as OutletPromo

                const status = getPromoStatus(promo, now)

                let discountedPrice = menu.price || 0;
                // Tampilkan preview harga diskon hanya saat promo sedang berjalan,
                // bukan saat masih "Terjadwal" atau "Berakhir".
                const showDiscountPreview = promo.is_active && promo.discount_value > 0 && status === 'berjalan'
                if (showDiscountPreview) {
                  if (promo.discount_type === 'nominal') {
                    discountedPrice = Math.max(0, (menu.price || 0) - promo.discount_value)
                  } else {
                    discountedPrice = Math.max(0, (menu.price || 0) - ((menu.price || 0) * promo.discount_value / 100))
                  }
                }

                return (
                  <div key={menu.id} className={`p-4 sm:p-5 rounded-2xl border-2 transition-all duration-300 ${promo.is_active ? 'bg-white border-blue-300 shadow-sm' : 'bg-white border-gray-100 hover:border-gray-200'}`}>

                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 sm:gap-5">
                      <div className="flex-1 min-w-0">
                        <p className={`font-bold text-base sm:text-lg break-words ${promo.is_active ? 'text-blue-900' : 'text-gray-900'}`}>{menu.name}</p>
                        <div className="flex flex-wrap items-center gap-2 sm:gap-3 mt-1.5">
                          {showDiscountPreview ? (
                            <>
                              <span className="text-sm text-gray-400 line-through decoration-gray-300 font-medium">Rp {(menu.price || 0).toLocaleString('id-ID')}</span>
                              <span className="text-base font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md">Rp {(discountedPrice || 0).toLocaleString('id-ID')}</span>
                            </>
                          ) : (
                            <span className="text-base font-bold text-gray-600">Rp {(menu.price || 0).toLocaleString('id-ID')}</span>
                          )}
                          {mounted && promo.is_active && <StatusBadge status={status} />}
                        </div>
                      </div>

                      <div className="flex items-center gap-3 sm:gap-4 shrink-0 flex-wrap">
                        {promo.is_active && (
                          <div className="flex items-center gap-2 animate-fade-in">
                            <select
                              className="bg-white border-2 border-blue-200 focus:border-blue-400 rounded-xl py-2 pl-3 pr-8 text-sm font-bold text-blue-800 outline-none transition-colors appearance-none cursor-pointer"
                              value={promo.discount_type}
                              onChange={e => handleItemPromoChange(menu.id, 'discount_type', e.target.value)}
                            >
                              <option value="nominal">Rp</option>
                              <option value="percentage">%</option>
                            </select>

                            <div className="relative">
                              {promo.discount_type === 'nominal' ? (
                                <CurrencyInput
                                  value={promo.discount_value || 0}
                                  onChange={v => handleItemPromoChange(menu.id, 'discount_value', v)}
                                  className="bg-white border-2 border-blue-200 focus:border-blue-400 rounded-xl py-2 text-sm w-28 font-bold text-blue-900 outline-none transition-colors pr-3"
                                />
                              ) : (
                                <input
                                  type="number"
                                  onWheel={(e) => e.currentTarget.blur()}
                                  min="0"
                                  max="100"
                                  placeholder="Nilai"
                                  className="bg-white border-2 border-blue-200 focus:border-blue-400 rounded-xl py-2 text-sm w-28 font-bold text-blue-900 outline-none transition-colors pl-3 pr-9"
                                  value={promo.discount_value || ''}
                                  onChange={e => handleItemPromoChange(menu.id, 'discount_value', Number(e.target.value))}
                                />
                              )}
                              {promo.discount_type === 'percentage' && <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-blue-400 font-bold">%</span>}
                            </div>
                          </div>
                        )}

                        <label className="relative inline-flex items-center cursor-pointer">
                          <input type="checkbox" className="sr-only peer" checked={promo.is_active} onChange={(e) => handleItemPromoChange(menu.id, 'is_active', e.target.checked)} />
                          <div className="w-12 h-7 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:bg-blue-500"></div>
                        </label>
                      </div>
                    </div>

                    {promo.is_active && (
                      <div className="mt-5 pt-5 border-t border-blue-200/50 space-y-4 animate-fade-in">
                        <div className="rounded-xl border border-blue-100 bg-blue-50/40 p-4 space-y-3">
                          <div className="flex items-center gap-2">
                            <CalendarClock className="w-4 h-4 text-blue-500 shrink-0" />
                            <h4 className="text-sm font-bold text-blue-900">Jadwal Promo <span className="text-blue-500/70 font-medium">({WIB_LABEL})</span></h4>
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                              <label className="block text-sm font-semibold text-blue-900">Mulai <span className="text-blue-500/70 font-medium">(Opsional)</span></label>
                              <input
                                type="datetime-local"
                                className="w-full bg-white border-2 border-blue-200 focus:border-blue-400 rounded-xl px-3 py-2 text-sm font-semibold text-blue-900 outline-none transition-colors"
                                value={mounted ? toWibInputValue(promo.start_date) : ''}
                                onChange={e => handleItemPromoChange(menu.id, 'start_date', fromWibInputValue(e.target.value))}
                              />
                            </div>
                            <div className="space-y-1.5">
                              <label className="block text-sm font-semibold text-blue-900">Selesai <span className="text-blue-500/70 font-medium">(Opsional)</span></label>
                              <input
                                type="datetime-local"
                                className="w-full bg-white border-2 border-blue-200 focus:border-blue-400 rounded-xl px-3 py-2 text-sm font-semibold text-blue-900 outline-none transition-colors"
                                value={mounted ? toWibInputValue(promo.end_date) : ''}
                                onChange={e => handleItemPromoChange(menu.id, 'end_date', fromWibInputValue(e.target.value))}
                              />
                            </div>
                          </div>
                          {mounted && <ScheduleSummary promo={promo} />}
                        </div>

                        <div className="space-y-1.5">
                          <label className="block text-sm font-bold text-blue-900">Min. Pembelian <span className="text-blue-500/70 font-medium ml-1">(Opsional)</span></label>
                          <div className="relative">
                            <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm text-blue-400 font-bold">Rp</span>
                            <input
                              type="number"
                              onWheel={(e) => e.currentTarget.blur()}
                              min="0"
                              placeholder="0"
                              className="w-full bg-white border-2 border-blue-200 focus:border-blue-400 rounded-xl pl-10 pr-3 py-2 text-sm font-semibold text-blue-900 outline-none transition-colors"
                              value={promo.min_purchase || ''}
                              onChange={e => handleItemPromoChange(menu.id, 'min_purchase', e.target.value ? Number(e.target.value) : null)}
                            />
                          </div>
                        </div>

                        <div className="space-y-3">
                          <div className="flex items-center justify-between gap-4 p-3 bg-blue-50/50 rounded-xl border border-blue-100">
                            <div className="min-w-0">
                              <label className="block text-sm font-bold text-blue-900">Berlaku untuk Food Apps</label>
                              <p className="text-xs text-blue-500 mt-0.5">Aktifkan agar promo berlaku di GoFood, GrabFood, dll.</p>
                            </div>
                            <label className="relative inline-flex items-center cursor-pointer shrink-0">
                              <input
                                type="checkbox"
                                className="sr-only peer"
                                checked={promo.apply_to_food_apps || false}
                                onChange={(e) => handleItemPromoChange(menu.id, 'apply_to_food_apps', e.target.checked)}
                              />
                              <div className="w-10 h-5 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-500"></div>
                            </label>
                          </div>

                          <div className="flex items-center justify-between gap-4 p-3 bg-orange-50/50 rounded-xl border border-orange-100">
                            <div className="min-w-0">
                              <label className="block text-sm font-bold text-orange-900">Terapkan ke Order Website</label>
                              <p className="text-xs text-orange-600 mt-0.5">Sinkronkan ke platform Order Online.</p>
                            </div>
                            <label className="relative inline-flex items-center cursor-pointer shrink-0">
                              <input
                                type="checkbox"
                                className="sr-only peer"
                                checked={promo.sync_to_order_online || false}
                                onChange={(e) => handleItemPromoChange(menu.id, 'sync_to_order_online', e.target.checked)}
                              />
                              <div className="w-10 h-5 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-orange-500"></div>
                            </label>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )
              })
            )}
          </div>
        </section>
      </div>

      {/* Bilah simpan — melekat di bawah viewport, lebarnya ikut container */}
      <div className="sticky bottom-4 z-40 flex justify-end">
        <div className="w-full rounded-2xl bg-white/95 backdrop-blur-md border border-gray-200 shadow-[0_10px_30px_-10px_rgba(0,0,0,0.25)] p-3 sm:p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <p className="text-xs text-gray-500 font-medium sm:pl-2">
            Perubahan berlaku untuk {outlets.length} outlet aktif. Jam promo mengikuti {WIB_LABEL}.
          </p>
          <button
            className="btn-primary px-6 sm:px-8 py-3 rounded-xl shadow-lg shadow-amber-500/30 flex items-center gap-2 text-sm font-bold sm:text-base w-full sm:w-auto justify-center transition-transform active:scale-95 disabled:opacity-60"
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <CheckCircle2 className="w-5 h-5" />}
            Terapkan ke Semua Cabang
          </button>
        </div>
      </div>
    </div>
  )
}
