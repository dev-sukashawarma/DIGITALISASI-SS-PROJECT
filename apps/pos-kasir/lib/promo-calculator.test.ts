import { describe, it, expect, vi, afterEach } from 'vitest'
import {
  calculateItemDiscount,
  resolveBasePrice,
  calculateItemPrice,
  isPromoEligible,
  isPromoScheduleRunning,
  type BasePromo,
} from './promo-calculator'

describe('calculateItemDiscount', () => {
  it('mencatat selisih harga saat promo menurunkan harga satuan', () => {
    // harga asli 40.000, setelah promo jadi 30.000, beli 1
    expect(calculateItemDiscount(40000, 30000, 1)).toBe(10000)
  })

  it('mengalikan selisih dengan quantity', () => {
    expect(calculateItemDiscount(40000, 30000, 3)).toBe(30000)
  })

  it('nol saat tidak ada promo', () => {
    expect(calculateItemDiscount(40000, 40000, 2)).toBe(0)
  })

  it('nol untuk order endorse — makanan gratis bukan potongan penjualan', () => {
    // Keputusan owner 2026-07-31: endorse dikecualikan dari Total Potongan,
    // supaya angka potongan tetap murni promo/diskon jual-beli.
    expect(calculateItemDiscount(40000, 0, 2, { isGiveaway: true })).toBe(0)
  })
})

describe('resolveBasePrice', () => {
  it('pakai harga menu biasa saat tak ada channel price', () => {
    expect(resolveBasePrice(40000, undefined, null)).toBe(40000)
    expect(resolveBasePrice(40000, 'pos', null)).toBe(40000)
  })

  it('pakai harga channel saat channel punya harga sendiri', () => {
    expect(resolveBasePrice(40000, 'gofood', { gofood: 45000 })).toBe(45000)
  })

  it('markup channel BUKAN diskon — harga acuan ikut naik jadi selisihnya nol', () => {
    // GoFood di-markup 45.000 (nutupi komisi), tanpa promo apa pun.
    // Kalau harga acuan salah ambil menu.price (40.000), diskon jadi -5.000
    // dan Omzet Kotor di laporan jadi lebih kecil dari Pendapatan Bersih.
    const channelPrices = { gofood: 45000 }
    const unitPrice = calculateItemPrice(40000, 'menu-1', [], undefined, 'gofood', channelPrices)
    const basePrice = resolveBasePrice(40000, 'gofood', channelPrices)

    expect(unitPrice).toBe(45000)
    expect(calculateItemDiscount(basePrice, unitPrice, 1)).toBe(0)
  })
})

// ── Promo terjadwal ──────────────────────────────────────────────────────
const NOW = Date.parse('2026-08-14T10:00:00.000Z') // 17:00 WIB

const itemPromo = (over: Partial<BasePromo> = {}): BasePromo => ({
  scope: 'item',
  menu_item_id: 'menu-1',
  discount_type: 'nominal',
  discount_value: 10000,
  is_active: true,
  ...over,
})

const globalPromo = (over: Partial<BasePromo> = {}): BasePromo => ({
  scope: 'global',
  menu_item_id: null,
  discount_type: 'percentage',
  discount_value: 50,
  is_active: true,
  ...over,
})

afterEach(() => {
  vi.useRealTimers()
})

describe('isPromoScheduleRunning', () => {
  it('berjalan saat tanpa jadwal (promo lama tanpa start_date)', () => {
    expect(isPromoScheduleRunning(itemPromo(), NOW)).toBe(true)
  })

  it('belum berjalan saat start_date masih di depan', () => {
    expect(isPromoScheduleRunning(itemPromo({ start_date: '2026-08-14T11:00:00.000Z' }), NOW)).toBe(false)
  })

  it('berjalan tepat saat start_date tiba', () => {
    expect(isPromoScheduleRunning(itemPromo({ start_date: '2026-08-14T10:00:00.000Z' }), NOW)).toBe(true)
  })

  it('berhenti setelah end_date lewat', () => {
    expect(isPromoScheduleRunning(itemPromo({ end_date: '2026-08-14T09:00:00.000Z' }), NOW)).toBe(false)
  })

  it('berhenti tepat saat end_date tiba', () => {
    expect(isPromoScheduleRunning(itemPromo({ end_date: '2026-08-14T10:00:00.000Z' }), NOW)).toBe(false)
  })

  it('berjalan di dalam jendela mulai–selesai', () => {
    expect(isPromoScheduleRunning(
      itemPromo({ start_date: '2026-08-14T09:00:00.000Z', end_date: '2026-08-14T11:00:00.000Z' }),
      NOW
    )).toBe(true)
  })

  it('tanggal rusak fail-closed agar tidak memotong harga tanpa jadwal valid', () => {
    expect(isPromoScheduleRunning(itemPromo({ start_date: 'bukan-tanggal' }), NOW)).toBe(false)
    expect(isPromoScheduleRunning(itemPromo({ end_date: 'bukan-tanggal' }), NOW)).toBe(false)
  })
})

describe('isPromoEligible', () => {
  it('tidak layak saat toggle mati walau jadwal berjalan', () => {
    expect(isPromoEligible(itemPromo({ is_active: false }), NOW)).toBe(false)
  })

  it('tidak layak saat kuota pemakaian sudah habis', () => {
    expect(isPromoEligible(itemPromo({ usage_limit: 5, current_usage: 5 }), NOW)).toBe(false)
  })
})

describe('calculateItemPrice — jadwal promo', () => {
  it('promo item yang belum mulai tidak memotong harga', () => {
    vi.useFakeTimers()
    vi.setSystemTime(NOW)
    const promos = [itemPromo({ start_date: '2026-08-14T11:00:00.000Z' })]
    expect(calculateItemPrice(40000, 'menu-1', promos)).toBe(40000)
  })

  it('promo item memotong harga setelah jadwal mulai', () => {
    vi.useFakeTimers()
    vi.setSystemTime(NOW)
    const promos = [itemPromo({ start_date: '2026-08-14T09:00:00.000Z' })]
    expect(calculateItemPrice(40000, 'menu-1', promos)).toBe(30000)
  })

  it('promo global yang belum mulai jatuh ke promo item', () => {
    vi.useFakeTimers()
    vi.setSystemTime(NOW)
    const promos = [
      globalPromo({ start_date: '2026-08-14T11:00:00.000Z' }), // 50% belum mulai
      itemPromo(), // potong 10.000, sudah berjalan
    ]
    expect(calculateItemPrice(40000, 'menu-1', promos)).toBe(30000)
  })

  it('promo global berlaku begitu jadwalnya tiba', () => {
    vi.useFakeTimers()
    vi.setSystemTime(Date.parse('2026-08-14T11:00:00.000Z'))
    const promos = [globalPromo({ start_date: '2026-08-14T11:00:00.000Z' }), itemPromo()]
    expect(calculateItemPrice(40000, 'menu-1', promos)).toBe(20000)
  })
})
