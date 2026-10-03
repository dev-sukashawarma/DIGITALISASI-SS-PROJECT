'use client'

import type { ReactNode } from 'react'
import { ArrowRight, Ban, CalendarClock, Gift, Info, Percent, Receipt, Smartphone, Store, Tag, Wallet } from 'lucide-react'
import { CurrencyInput } from '@suka/design-system'
import { DateTimeField, Segmented, Stepper, Switch, TimeInput } from '@/components/ui/controls'
import { formatWib, fromWibInputValue, toWibInputValue, WIB_LABEL } from '@/lib/timezone'
import { getPromoStatus } from '@/lib/promoSchedule'
import PromoDailyScheduleEditor from './PromoDailyScheduleEditor'
import { MenuExclusionPicker, MenuThumb, OutletScopeBadge, OutletScopePicker, RewardMenuPicker, StatusBadge, promoRule, rupiah } from './promoParts'
import type { MenuItem, Outlet, OutletPromo, PromoField } from './promoTypes'

const INPUT =
  'w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm font-semibold text-slate-900 outline-none transition-colors placeholder:font-medium placeholder:text-slate-400 focus:border-suka-orange focus:ring-2 focus:ring-suka-orange/15'

function Section({ icon, title, hint, children }: { icon: ReactNode; title: string; hint?: string; children: ReactNode }) {
  return (
    <section className="space-y-3 border-t border-slate-100 pt-5 first:border-t-0 first:pt-0">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-suka-orange/10 text-suka-brown">{icon}</span>
        <div className="min-w-0">
          <h3 className="text-sm font-extrabold text-slate-900">{title}</h3>
          {hint && <p className="mt-0.5 text-xs leading-relaxed text-slate-500">{hint}</p>}
        </div>
      </div>
      <div className="sm:pl-11">{children}</div>
    </section>
  )
}

function SwitchRow({ title, hint, checked, onChange }: { title: string; hint: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-xl border border-slate-200 bg-white p-3.5">
      <div className="min-w-0">
        <p className="text-sm font-bold text-slate-800">{title}</p>
        <p className="mt-0.5 text-xs text-slate-500">{hint}</p>
      </div>
      <Switch size="sm" checked={checked} onChange={onChange} label={title} />
    </div>
  )
}

/** Kartu ringkasan berbentuk tiket: aturan promo dalam satu kalimat. */
export function PromoTicket({
  promo,
  rule,
  trigger,
  reward,
  outlets,
  outletIds,
  mounted,
  now,
  stacked = false,
}: {
  promo: OutletPromo
  rule: string
  trigger?: MenuItem
  reward?: MenuItem
  outlets: Outlet[]
  outletIds: string[]
  mounted: boolean
  now: number
  /** Kolom sempit: gambar di atas, kalimat aturan di bawah. */
  stacked?: boolean
}) {
  const isBxgy = promo.discount_type === 'buy_one_get_one'
  return (
    <div className="relative overflow-hidden rounded-2xl border border-suka-orange/25 bg-gradient-to-br from-suka-orange/10 via-suka-cream to-white">
      <div className={stacked ? "flex flex-col items-start gap-3 p-4" : "flex items-center gap-3 p-4"}>
        {isBxgy && trigger && reward ? (
          <div className="flex shrink-0 items-center gap-1.5">
            <MenuThumb menu={trigger} size={44} className="h-11 w-11 rounded-xl ring-2 ring-white" />
            <ArrowRight className="h-4 w-4 text-suka-orange" />
            <MenuThumb menu={reward} size={44} className="h-11 w-11 rounded-xl ring-2 ring-white" />
          </div>
        ) : (
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white text-suka-orange shadow-sm">
            {isBxgy ? <Gift className="h-5 w-5" /> : <Tag className="h-5 w-5" />}
          </span>
        )}
        <div className="min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-widest text-suka-brown/60">{promo.promo_name?.trim() || 'Ringkasan promo'}</p>
          <p className="font-display text-lg leading-tight text-suka-brown sm:text-xl">{rule}</p>
        </div>
      </div>
      {/* Garis sobek tiket */}
      <div className="relative mx-4 border-t-2 border-dashed border-suka-orange/25">
        <span className="absolute -left-6 -top-[9px] h-4 w-4 rounded-full bg-white" />
        <span className="absolute -right-6 -top-[9px] h-4 w-4 rounded-full bg-white" />
      </div>
      <div className="flex flex-wrap items-center gap-1.5 px-4 py-3">
        {mounted && <StatusBadge status={getPromoStatus(promo, now)} />}
        <OutletScopeBadge outlets={outlets} selectedIds={outletIds} />
        {isBxgy && (
          <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-bold text-slate-600">
            <Store className="h-3 w-3" /> Hanya kasir offline
          </span>
        )}
      </div>
    </div>
  )
}

function PercentInput({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <div className="relative w-full sm:w-48">
      <input
        aria-label="Persentase diskon"
        inputMode="decimal"
        value={value ? String(value) : ''}
        placeholder="0"
        onChange={e => {
          const n = Number(e.target.value.replace(',', '.').replace(/[^\d.]/g, ''))
          onChange(Number.isFinite(n) ? Math.min(100, Math.max(0, n)) : 0)
        }}
        className={`${INPUT} pr-10 text-base`}
      />
      <Percent className="absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
    </div>
  )
}

export default function PromoEditor({
  promo,
  menu,
  menuItems,
  outlets,
  outletIds,
  rewardId,
  onChange,
  mounted,
  now,
  hideTicket = false,
}: {
  promo: OutletPromo
  /** Menu pemicu (hanya promo per menu). */
  menu?: MenuItem
  menuItems: MenuItem[]
  outlets: Outlet[]
  outletIds: string[]
  rewardId: string | null
  onChange: (field: PromoField, value: any) => void
  mounted: boolean
  now: number
  /** Modal per menu menampilkan tiket di kolom kiri, bukan di atas form. */
  hideTicket?: boolean
}) {
  const isGlobal = promo.scope === 'global'
  const isBxgy = promo.discount_type === 'buy_one_get_one'
  const reward = menuItems.find(m => m.id === rewardId)
  const rule = promoRule(promo, reward?.name || 'menu gratis')
  const today = mounted ? toWibInputValue(new Date(now).toISOString()).slice(0, 10) : undefined
  const hasDailyHours = !!(promo.daily_start_time || promo.daily_end_time)
  const quotaShared = isBxgy && promo.quota_scope === 'global'

  const typeOptions = [
    { value: 'percentage' as const, label: 'Diskon %', icon: <Percent className="h-3.5 w-3.5" /> },
    { value: 'nominal' as const, label: 'Potongan Rp', icon: <Wallet className="h-3.5 w-3.5" /> },
    { value: 'buy_one_get_one' as const, label: 'Beli X Gratis Y', icon: <Gift className="h-3.5 w-3.5" /> },
  ]

  return (
    <div className="space-y-6">
      {!hideTicket && <PromoTicket promo={promo} rule={rule} trigger={menu} reward={reward} outlets={outlets} outletIds={outletIds} mounted={mounted} now={now} />}

      <Section icon={<Tag className="h-4 w-4" />} title="Jenis promo">
        <div className="space-y-4">
          <Segmented label="Jenis promo" value={promo.discount_type} options={typeOptions} onChange={v => onChange('discount_type', v)} />

          {promo.discount_type === 'percentage' && (
            <div className="space-y-1.5">
              <span className="text-xs font-bold text-slate-600">Besar diskon</span>
              <PercentInput value={promo.discount_value || 0} onChange={v => onChange('discount_value', v)} />
              {menu && promo.discount_value > 0 && (
                <p className="text-xs font-semibold text-emerald-700">
                  {rupiah(menu.price)} → {rupiah(Math.max(0, menu.price - (menu.price * promo.discount_value) / 100))}
                </p>
              )}
            </div>
          )}

          {promo.discount_type === 'nominal' && (
            <div className="space-y-1.5">
              <span className="text-xs font-bold text-slate-600">Besar potongan</span>
              <div className="w-full sm:w-56">
                <CurrencyInput aria-label="Besar potongan" value={promo.discount_value || 0} onChange={v => onChange('discount_value', v)} className={`${INPUT} pl-10 text-base`} />
              </div>
              {menu && promo.discount_value > 0 && (
                <p className="text-xs font-semibold text-emerald-700">
                  {rupiah(menu.price)} → {rupiah(Math.max(0, menu.price - promo.discount_value))}
                </p>
              )}
            </div>
          )}

          {isBxgy && (
            <div className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50/60 p-3.5">
              <div className="flex flex-wrap items-center gap-3">
                <span className="w-14 text-xs font-bold uppercase tracking-wide text-slate-500">Beli</span>
                <Stepper value={promo.buy_quantity ?? 1} onChange={v => onChange('buy_quantity', v)} label="jumlah beli" />
                <span className="min-w-0 text-sm font-bold text-slate-800">{menu ? menu.name : 'menu apa saja'}</span>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <span className="w-14 text-xs font-bold uppercase tracking-wide text-emerald-700">Gratis</span>
                <Stepper value={promo.get_quantity ?? 1} onChange={v => onChange('get_quantity', v)} label="jumlah gratis" />
              </div>
              <RewardMenuPicker menuItems={menuItems} value={rewardId} onChange={id => onChange('reward_menu_item_id', id)} />
              <p className="flex items-start gap-1.5 text-xs text-slate-500">
                <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                Menu gratis otomatis masuk keranjang kasir seharga Rp 0. Sekali per transaksi, tidak digabung promo lain. Kalau menu gratis sedang habis, promo tidak berlaku.
              </p>
            </div>
          )}
        </div>
      </Section>

      <Section icon={<Receipt className="h-4 w-4" />} title="Nama promo" hint="Tampil di struk & laporan. Wajib untuk promo terjadwal.">
        <input
          value={promo.promo_name || ''}
          onChange={e => onChange('promo_name', e.target.value)}
          placeholder={menu ? `Contoh: Promo ${menu.name}` : 'Contoh: Promo Kemerdekaan'}
          className={INPUT}
        />
      </Section>

      <Section icon={<Store className="h-4 w-4" />} title="Outlet">
        <OutletScopePicker outlets={outlets} selectedIds={outletIds} onChange={ids => onChange('outlet_ids', ids)} />
      </Section>

      {isGlobal && !isBxgy && (
        <Section icon={<Ban className="h-4 w-4" />} title="Menu yang dikecualikan" hint="Menu ini tidak mendapat diskon. Kalau menu tersebut punya promo per menu, promo itulah yang dipakai.">
          <MenuExclusionPicker
            menuItems={menuItems}
            selectedIds={Array.isArray(promo.excluded_menu_item_ids) ? promo.excluded_menu_item_ids : []}
            onChange={ids => onChange('excluded_menu_item_ids', ids)}
          />
        </Section>
      )}

      <Section icon={<CalendarClock className="h-4 w-4" />} title={`Jadwal (${WIB_LABEL})`} hint="Kosongkan semua agar promo berlaku selama dinyalakan.">
        <div className="space-y-4">
          {/* Satu kolom: panel editor sempit, dua kolom membuat tanggal patah. */}
          <div className="grid grid-cols-1 gap-3">
            <DateTimeField
              label="Mulai"
              emptyLabel="Langsung berlaku"
              defaultTime="00:00"
              today={today}
              value={mounted ? toWibInputValue(promo.start_date) : ''}
              onChange={v => onChange('start_date', fromWibInputValue(v))}
            />
            <DateTimeField
              label="Selesai"
              emptyLabel="Tanpa batas akhir"
              defaultTime="23:59"
              today={today}
              value={mounted ? toWibInputValue(promo.end_date) : ''}
              onChange={v => onChange('end_date', fromWibInputValue(v))}
            />
          </div>

          <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-3.5">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="text-sm font-bold text-slate-800">Jam tertentu setiap hari</p>
                <p className="mt-0.5 text-xs text-slate-500">Happy hour — di luar jam ini promo mati walau tanggal masih berlaku.</p>
              </div>
              <Switch
                size="sm"
                checked={hasDailyHours}
                label="Jam tertentu setiap hari"
                onChange={on => {
                  onChange('daily_start_time', on ? '17:00:00' : null)
                  onChange('daily_end_time', on ? '20:00:00' : null)
                }}
              />
            </div>
            {hasDailyHours && (
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <span className="text-[11px] font-bold text-slate-500">Dari jam</span>
                  <TimeInput value={promo.daily_start_time?.slice(0, 5) || ''} label="Jam mulai harian" onChange={t => onChange('daily_start_time', `${t}:00`)} />
                </div>
                <div className="space-y-1">
                  <span className="text-[11px] font-bold text-slate-500">Sampai jam</span>
                  <TimeInput value={promo.daily_end_time?.slice(0, 5) || ''} label="Jam selesai harian" onChange={t => onChange('daily_end_time', `${t}:00`)} />
                </div>
              </div>
            )}
            <div className="border-t border-slate-100 pt-3">
              <PromoDailyScheduleEditor
                value={promo.daily_schedule}
                startDate={promo.start_date}
                dailyStartTime={promo.daily_start_time}
                dailyEndTime={promo.daily_end_time}
                onChange={value => onChange('daily_schedule', value)}
              />
            </div>
          </div>

          {mounted && (
            <p className="text-xs font-medium text-slate-500">
              {promo.daily_schedule && promo.daily_schedule.length > 0
                ? `Aktif di ${promo.daily_schedule.length} tanggal terdaftar.`
                : !promo.start_date && !promo.end_date
                  ? 'Tanpa jadwal — berlaku selama promo dinyalakan.'
                  : `${promo.start_date ? `Mulai ${formatWib(promo.start_date)}` : 'Mulai sejak dinyalakan'} · ${promo.end_date ? `selesai ${formatWib(promo.end_date)}` : 'tanpa batas akhir'}`}
            </p>
          )}
        </div>
      </Section>

      <Section icon={<Wallet className="h-4 w-4" />} title="Syarat & kuota">
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {!isBxgy && (
              <div className="space-y-1.5">
                <span className="text-xs font-bold text-slate-600">Minimum belanja</span>
                <CurrencyInput
                  aria-label="Minimum belanja"
                  value={promo.min_purchase || 0}
                  onChange={v => onChange('min_purchase', v || null)}
                  className={`${INPUT} pl-10`}
                />
                <p className="text-[11px] text-slate-500">Biarkan 0 jika tanpa minimum.</p>
              </div>
            )}
            {(isGlobal || isBxgy) && (
              <div className="space-y-1.5">
                <span className="text-xs font-bold text-slate-600">Batas kuota pemakaian</span>
                {isBxgy && (
                  <Segmented
                    label="Pola kuota"
                    value={promo.quota_scope || 'per_outlet'}
                    onChange={v => onChange('quota_scope', v)}
                    options={[
                      { value: 'per_outlet', label: 'Per outlet' },
                      { value: 'global', label: 'Gabungan semua outlet' },
                    ]}
                  />
                )}
                <input
                  aria-label="Batas kuota"
                  inputMode="numeric"
                  placeholder="Tanpa batas"
                  value={promo.usage_limit || ''}
                  onChange={e => {
                    const n = Number(e.target.value.replace(/\D/g, ''))
                    onChange('usage_limit', n > 0 ? n : null)
                  }}
                  className={INPUT}
                />
                <p className="text-[11px] text-slate-500">
                  {isBxgy ? (quotaShared ? 'Satu kuota dipakai bersama semua outlet.' : 'Setiap outlet punya kuota sendiri.') : 'Kosongkan jika kuota tak terbatas.'}
                </p>
                {promo.usage_limit ? (
                  <div className="space-y-1">
                    <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
                      <div
                        className="h-full rounded-full bg-suka-orange transition-[width] duration-300"
                        style={{ width: `${Math.min(100, ((promo.current_usage || 0) / promo.usage_limit) * 100)}%` }}
                      />
                    </div>
                    <p className="text-[11px] font-semibold text-slate-600">
                      Terpakai{quotaShared ? ' semua outlet' : ''}: {promo.current_usage || 0} / {promo.usage_limit}
                    </p>
                  </div>
                ) : null}
              </div>
            )}
          </div>
      </Section>

      <Section icon={<Smartphone className="h-4 w-4" />} title="Kanal penjualan">
        {isBxgy ? (
          <p className="rounded-xl bg-slate-50 px-3.5 py-3 text-xs font-medium text-slate-600">
            Beli X Gratis Y hanya berlaku di kasir POS (offline & endorse). Food Apps dan Order Website otomatis tidak ikut.
          </p>
        ) : (
          <div className="space-y-2">
            <SwitchRow
              title="Food Apps"
              hint="Ikut berlaku di GoFood, GrabFood, ShopeeFood, dll."
              checked={promo.apply_to_food_apps || false}
              onChange={v => onChange('apply_to_food_apps', v)}
            />
            <SwitchRow
              title="Order Website"
              hint="Sinkron ke Order Online. Promo terjadwal dikirim nonaktif — simpan ulang saat jadwalnya tiba."
              checked={promo.sync_to_order_online || false}
              onChange={v => onChange('sync_to_order_online', v)}
            />
          </div>
        )}
      </Section>
    </div>
  )
}
