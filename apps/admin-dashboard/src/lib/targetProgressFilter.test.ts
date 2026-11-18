import { describe, expect, it } from 'vitest'
import {
  GLOBAL_SYSTEM_OUTLET_ID,
  GUDANG_PUSAT_OUTLET_ID,
  GUDANG_SS_ONLINE_OUTLET_ID,
  KANTOR_PUSAT_OUTLET_ID,
  SAWANGAN_INTERNAL_OUTLET_ID,
  SHOPEE_OUTLET_ID,
  TEST_OUTLET_ID,
  TIKTOK_SHOP_OUTLET_ID,
} from './outletFilters'
import { isTargetProgressOutletVisible } from './targetProgressFilter'

describe('isTargetProgressOutletVisible', () => {
  it('menyembunyikan GUDANG SS ONLINE berdasarkan ID maupun nama', () => {
    expect(
      isTargetProgressOutletVisible({
        outlet_id: GUDANG_SS_ONLINE_OUTLET_ID,
        outlet_name: 'GUDANG SS ONLINE',
      })
    ).toBe(false)

    expect(
      isTargetProgressOutletVisible({
        outlet_id: 'custom-id',
        outlet_name: 'Gudang SS Online',
      })
    ).toBe(false)
  })

  it('menyembunyikan SUKA SHAWARMA SAWANGAN (INTERNAL) berdasarkan ID maupun nama', () => {
    expect(
      isTargetProgressOutletVisible({
        outlet_id: SAWANGAN_INTERNAL_OUTLET_ID,
        outlet_name: 'SUKA SHAWARMA SAWANGAN (INTERNAL)',
      })
    ).toBe(false)

    expect(
      isTargetProgressOutletVisible({
        outlet_id: 'custom-id',
        outlet_name: 'Suka Shawarma Sawangan (Internal)',
      })
    ).toBe(false)

    expect(
      isTargetProgressOutletVisible({
        outlet_id: 'custom-id',
        outlet_name: 'Sawangan Internal',
      })
    ).toBe(false)
  })

  it('tetap menampilkan MITRA SAWANGAN DTC dan kanal marketplace', () => {
    expect(
      isTargetProgressOutletVisible({
        outlet_id: '5a4df577-5237-476e-b54c-9eb642a5a516',
        outlet_name: 'MITRA SAWANGAN DTC',
      })
    ).toBe(true)

    expect(
      isTargetProgressOutletVisible({
        outlet_id: SHOPEE_OUTLET_ID,
        outlet_name: 'Shopee',
      })
    ).toBe(true)

    expect(
      isTargetProgressOutletVisible({
        outlet_id: TIKTOK_SHOP_OUTLET_ID,
        outlet_name: 'TikTok Shop',
      })
    ).toBe(true)

    expect(
      isTargetProgressOutletVisible({
        outlet_id: '3f38c41d-11e3-49ce-a189-d7303e45f9ad',
        outlet_name: 'MITRA CIBUBUR',
      })
    ).toBe(true)
  })

  it('menyembunyikan outlet uji coba dan entitas sistem/pusat/gudang', () => {
    expect(
      isTargetProgressOutletVisible({ outlet_id: TEST_OUTLET_ID, outlet_name: 'OUTLET TES' })
    ).toBe(false)
    expect(
      isTargetProgressOutletVisible({ outlet_id: KANTOR_PUSAT_OUTLET_ID, outlet_name: 'Kantor Pusat' })
    ).toBe(false)
    expect(
      isTargetProgressOutletVisible({ outlet_id: GLOBAL_SYSTEM_OUTLET_ID, outlet_name: 'Global Outlet' })
    ).toBe(false)
    expect(
      isTargetProgressOutletVisible({ outlet_id: GUDANG_PUSAT_OUTLET_ID, outlet_name: 'Gudang Pusat' })
    ).toBe(false)
  })
})
