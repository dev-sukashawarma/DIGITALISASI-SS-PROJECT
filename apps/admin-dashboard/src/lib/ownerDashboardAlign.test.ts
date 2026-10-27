import { describe, expect, it } from 'vitest'
import {
  computeSingleMitraManagementFee,
  normalizeRpcHourlyRow,
  normalizeRpcMenuRow,
  normalizeSettlementPlatform,
  reconcilePosKpiRowsWithSettlements,
} from './ownerDashboardAlign'
import { deltaPct } from './format'
import { buildLeaderboard } from './leaderboard'
import { TEST_OUTLET_ID } from './outletFilters'
import type { SalesSummaryRow } from './types'

describe('normalizeRpcHourlyRow & normalizeRpcMenuRow', () => {
  it('mendukung kontrak kunci lama (20261026121500) maupun baru (20261027103000)', () => {
    expect(
      normalizeRpcHourlyRow({ sales_hour: 19, hourly_omzet: 750000, hourly_order_count: 11 }),
    ).toEqual({
      sales_hour: 19,
      omzet: 750000,
      order_count: 11,
    })

    expect(
      normalizeRpcHourlyRow({ sales_hour: 20, omzet: 910000, order_count: 14 }),
    ).toEqual({
      sales_hour: 20,
      omzet: 910000,
      order_count: 14,
    })

    expect(
      normalizeRpcMenuRow({ menu_name: 'Suka Ayam Large', total_qty: 42, revenue: 1260000 }),
    ).toEqual({
      menu_name: 'Suka Ayam Large',
      qty: 42,
      revenue: 1260000,
    })

    expect(
      normalizeRpcMenuRow({ menu_name: 'Suka Sapi Reguler', qty: 18, revenue: 540000 }),
    ).toEqual({
      menu_name: 'Suka Sapi Reguler',
      qty: 18,
      revenue: 540000,
    })
  })
})

describe('reconcilePosKpiRowsWithSettlements — 1:1 dengan useSalesDaily (Tab Laba Rugi)', () => {
  const outletId = '5a4df577-5237-476e-b54c-9eb642a5a516'

  it('mengganti promo GoFood & ShopeeFood dengan promo_merchant settlement tanpa menggeser Omzet Kotor, serta mengisi platform_fee komisi', () => {
    const posRows: SalesSummaryRow[] = [
      {
        outlet_id: outletId,
        outlet_name: 'MITRA SAWANGAN DTC',
        sales_source: 'gofood',
        sales_date: '2026-10-20',
        omzet: 800000, // rawGross = 800k + 200k = 1.000.000
        total_deductions: 200000,
        jumlah_order_completed: 12,
        jumlah_order_all: 12,
        total_qty: 25,
      },
      {
        outlet_id: outletId,
        outlet_name: 'MITRA SAWANGAN DTC',
        sales_source: 'tiktok',
        sales_date: '2026-10-20',
        omzet: 450000,
        total_deductions: 50000,
        jumlah_order_completed: 8,
        jumlah_order_all: 8,
        total_qty: 15,
      },
      {
        outlet_id: TEST_OUTLET_ID,
        outlet_name: 'OUTLET TEST',
        sales_source: 'pos',
        sales_date: '2026-10-20',
        omzet: 999999,
        total_deductions: 0,
        jumlah_order_completed: 1,
        jumlah_order_all: 1,
        total_qty: 1,
      },
    ]

    const reconciled = reconcilePosKpiRowsWithSettlements(posRows, [
      {
        outlet_id: outletId,
        platform: 'GoFood',
        tanggal: '2026-10-20',
        promo_merchant: 260000,
        commission: 148000,
      },
      {
        outlet_id: outletId,
        platform: 'TikTok Go',
        tanggal: '2026-10-20',
        promo_merchant: 99999, // untuk TikTok Go tidak menimpa total_deductions kasir
        commission: 45000,
      },
    ])

    expect(reconciled).toHaveLength(2)

    const gofood = reconciled.find((r) => r.sales_source === 'gofood')!
    // Gross tetap 1.000.000 = 740.000 + 260.000
    expect(gofood.omzet + (gofood.total_deductions || 0)).toBe(1000000)
    expect(gofood.omzet).toBe(740000)
    expect(gofood.total_deductions).toBe(260000)
    expect(gofood.platform_fee).toBe(148000)

    const tiktok = reconciled.find((r) => r.sales_source === 'tiktok')!
    expect(normalizeSettlementPlatform('tiktok')).toBe('tiktokgo')
    expect(tiktok.omzet).toBe(450000)
    expect(tiktok.total_deductions).toBe(50000)
    expect(tiktok.platform_fee).toBe(45000)
  })
})

describe('computeSingleMitraManagementFee & rekonsiliasi Laba Bersih MITRA SAWANGAN DTC (2026-10-26)', () => {
  const sawanganId = '5a4df577-5237-476e-b54c-9eb642a5a516'
  const internalId = '11111111-1111-1111-1111-111111111111'

  const outlets = [
    { id: sawanganId, name: 'MITRA SAWANGAN DTC', type: 'mitra', slug: 'mitra-sawangan-dtc' },
    { id: internalId, name: 'SUKA SHAWARMA MARGONDA', type: 'outlet', slug: 'margonda' },
  ]

  const investments = {
    [sawanganId]: {
      outlet_id: sawanganId,
      nilai_investasi: 185000000,
      tanggal_mulai: '2026-07-01',
      omzet_historis: 0,
      transfer_historis: 0,
      persentase_bagi_hasil: 50,
      management_fee: 3,
      isBep: false,
      transfers: [],
    },
  }

  const sawanganOct26Rows: SalesSummaryRow[] = [
    {
      outlet_id: sawanganId,
      outlet_name: 'MITRA SAWANGAN DTC',
      sales_source: 'pos',
      sales_date: '2026-10-26',
      omzet: 3272773,
      total_deductions: 781227, // Gross = 4.054.000
      platform_fee: 0,
      jumlah_order_completed: 56,
      jumlah_order_all: 56,
      total_qty: 105,
    },
  ]

  it('menghasilkan Management Fee 3% = Rp 121.620 dan Laba Bersih = Rp 812.685 sama persis 1:1 dengan Tab Laba Rugi', () => {
    const mgmtFee = computeSingleMitraManagementFee({
      outletId: sawanganId,
      periodFrom: '2026-10-26',
      periodTo: '2026-10-26',
      kpiRows: sawanganOct26Rows,
      outlets,
      investments,
    })

    expect(mgmtFee).toBe(121620)

    const gross = sawanganOct26Rows[0].omzet + (sawanganOct26Rows[0].total_deductions || 0)
    const adminFee = (sawanganOct26Rows[0].total_deductions || 0) + (sawanganOct26Rows[0].platform_fee || 0)
    const netMasuk = gross - adminFee
    const curCogs = 2087818
    const curWaste = 8272
    const curBebanPokok = curCogs + curWaste
    const curOpex = 242378
    const labaBersih = netMasuk - curBebanPokok - curOpex - mgmtFee

    expect(gross).toBe(4054000)
    expect(netMasuk).toBe(3272773)
    expect(curBebanPokok).toBe(2096090)
    expect(labaBersih).toBe(812685)
  })

  it('bernilai 0 pada cakupan global (all), ss-online, maupun outlet internal', () => {
    expect(
      computeSingleMitraManagementFee({
        outletId: 'all',
        periodFrom: '2026-10-26',
        periodTo: '2026-10-26',
        kpiRows: sawanganOct26Rows,
        outlets,
        investments,
      }),
    ).toBe(0)

    expect(
      computeSingleMitraManagementFee({
        outletId: internalId,
        periodFrom: '2026-10-26',
        periodTo: '2026-10-26',
        kpiRows: [{ ...sawanganOct26Rows[0], outlet_id: internalId }],
        outlets,
        investments,
      }),
    ).toBe(0)
  })

  it('bebas fee manajemen (0%) bila outlet Mitra sudah BEP sesuai mitraPolicy Sept 2026+, dan menghormati cutoff tanggal_mulai', () => {
    const feeBep = computeSingleMitraManagementFee({
      outletId: sawanganId,
      periodFrom: '2026-10-26',
      periodTo: '2026-10-26',
      kpiRows: sawanganOct26Rows,
      outlets,
      investments: {
        [sawanganId]: {
          ...investments[sawanganId],
          isBep: true,
        },
      },
    })
    expect(feeBep).toBe(0)

    const feeBeforeStart = computeSingleMitraManagementFee({
      outletId: sawanganId,
      periodFrom: '2026-10-26',
      periodTo: '2026-10-26',
      kpiRows: sawanganOct26Rows,
      outlets,
      investments: {
        [sawanganId]: {
          ...investments[sawanganId],
          tanggal_mulai: '2026-11-01',
        },
      },
    })
    expect(feeBeforeStart).toBe(0)
  })
})

describe('deltaPct & buildLeaderboard basis Omzet Kotor', () => {
  it('deltaPct memakai nilai absolut penyebut saat periode sebelumnya rugi (negatif)', () => {
    // Rugi -500.000 membaik jadi untung +250.000 => tumbuh +150%, bukan -150%
    expect(deltaPct(250000, -500000)).toBe(150)
    // Rugi -500.000 makin dalam jadi -750.000 => turun -50%
    expect(deltaPct(-750000, -500000)).toBe(-50)
  })

  it('buildLeaderboard menghitung omzet & AOV memakai Omzet Kotor bila total_deductions tersedia', () => {
    const rows: SalesSummaryRow[] = [
      {
        outlet_id: 'o1',
        outlet_name: 'Outlet 1',
        sales_source: 'gofood',
        sales_date: '2026-10-26',
        omzet: 3272773,
        total_deductions: 781227,
        jumlah_order_completed: 56,
        jumlah_order_all: 56,
        total_qty: 105,
      },
    ]
    const board = buildLeaderboard(rows, [], 1)
    expect(board[0].omzet).toBe(4054000)
    expect(board[0].aov).toBe(72393)
    expect(board[0].total_qty).toBe(105)
  })
})
