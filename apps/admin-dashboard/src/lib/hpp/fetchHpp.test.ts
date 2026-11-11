import { describe, it, expect } from 'vitest'
import { getItemHpp, MENU_HPP_SELECT, MITRA_CILEUNGSI_OUTLET_ID } from './fetchHpp'
import { buatPenerapRiwayat } from './riwayatHpp'
import { cleanItemName } from '@/lib/order-item-name'

describe('getItemHpp', () => {
  const globalSapiSedang = {
    id: '4adb4426-0d1f-4962-a5d9-2b9dfbb29ecd',
    name: 'Original Sapi Sedang',
    hpp_override: 14525.5,
    channel_hpp: {},
    is_package: false
  }

  const globalSukaBeef = {
    id: 'fea982b2-e172-4bfd-8fc6-1fa6de830c19',
    name: 'Suka Beef',
    hpp_override: 17090.7,
    channel_hpp: {},
    is_package: false
  }

  const byNameMap = new Map<string, any>([
    ['Original Sapi Sedang', globalSapiSedang],
    ['original sapi sedang', globalSapiSedang],
    ['Suka Beef', globalSukaBeef],
    ['suka beef', globalSukaBeef]
  ])

  it('fallback saat menuItem null dan fallbackName cocok (mulai Okt 2026 non-Cileungsi: takeout OPEX)', () => {
    const res = getItemHpp(null, 'mitra', 'Original Sapi Sedang', byNameMap, null, 'mitra-lain', '2026-10-15')
    expect(res.hpp).toBe(Math.round(14525.5))
    expect(res.baseHpp).toBe(13205)
    expect(res.markup).toBe(1321)
    expect(res.baseHpp + res.markup).toBe(res.hpp)
  })

  it('periode sebelum 1 Okt 2026 tetap memakai (HPP + OPEX) x 1,10', () => {
    const res = getItemHpp(null, 'mitra', 'Original Sapi Sedang', byNameMap, null, 'mitra-lain', '2026-09-20')
    expect(res.baseHpp).toBe(14525.5)
    expect(res.hpp).toBe(Math.round(14525.5 * 1.1))
    expect(res.markup).toBe(res.hpp - res.baseHpp)
  })

  it('MITRA CILEUNGSI x1,10 sampai 31 Okt 2026, lalu ikut x1,15 mulai 1 Nov 2026', () => {
    const sapiOkt = { ...globalSapiSedang, hpp_override: 15168 }
    const okt = getItemHpp(sapiOkt, 'mitra', undefined, undefined, 'pos', MITRA_CILEUNGSI_OUTLET_ID, '2026-10-31')
    expect(okt.baseHpp).toBe(15168)
    expect(okt.hpp).toBe(Math.round(15168 * 1.1))
    expect(okt.markup).toBe(okt.hpp - okt.baseHpp)

    // Pengecualian Cileungsi berakhir 31 Okt 2026 (keputusan owner 11 Nov 2026).
    const sapiNov = { ...globalSapiSedang, hpp_override: 15168 }
    const nov = getItemHpp(sapiNov, 'mitra', undefined, undefined, 'pos', MITRA_CILEUNGSI_OUTLET_ID, '2026-11-01')
    expect(nov.baseHpp).toBe(15168)
    expect(nov.hpp).toBe(Math.round(15168 * 1.15))
    expect(nov.markup).toBe(nov.hpp - nov.baseHpp)
  })

  it('mulai 1 Nov 2026 markup mitra seragam (HPP + OPEX) x 1,15, paket ikut', () => {
    const sapi = { ...globalSapiSedang, hpp_override: 15099.7 }
    const satuan = getItemHpp(sapi, 'mitra', undefined, undefined, 'pos', 'mitra-lain', '2026-11-01')
    expect(satuan.baseHpp).toBe(15099.7)
    expect(satuan.hpp).toBe(Math.round(15099.7 * 1.15)) // 17365, cocok kolom I Excel (17364,655)
    expect(satuan.markup).toBe(satuan.hpp - satuan.baseHpp)

    const aqua = {
      id: 'c8427af3-0a41-48dd-9a08-6b93cd913ec6',
      name: 'Aqua',
      hpp_override: 1500,
      channel_hpp: {},
      is_package: false,
    }
    const paket = {
      id: 'pkg-sapi-aqua',
      name: 'SAPI SEDANG + AQUA',
      hpp_override: null,
      channel_hpp: {},
      is_package: true,
      package_items: [
        { quantity: 1, component: sapi },
        { quantity: 1, component: aqua },
      ],
    }
    const res = getItemHpp(paket, 'mitra', undefined, undefined, 'pos', 'mitra-lain', '2026-11-01')
    // Excel "PAKET BUNDLING AQUA" HPP MITRA = 19.089,655 -> dibulatkan 19.090
    expect(res.baseHpp).toBe(16599.7)
    expect(res.hpp).toBe(Math.round(16599.7 * 1.15))
    expect(res.markup).toBe(res.hpp - res.baseHpp)
  })

  it('transisi 3 minuman murni & paketnya sebelum vs mulai 2 Nov 2026 untuk mitra non-Cileungsi', () => {
    const iceTeaOct = {
      id: '08a57f8f-f212-4205-a3eb-fb88066ae1b8',
      name: 'Ice Tea',
      hpp_override: 1652,
      channel_hpp: {},
      is_package: false,
    }
    const comboOct = {
      id: 'pkg-combo-1',
      name: 'Combo #1',
      hpp_override: null,
      channel_hpp: {},
      is_package: true,
      package_items: [
        { quantity: 1, component: globalSapiSedang },
        { quantity: 1, component: iceTeaOct },
      ],
    }

    // Oktober 2026: Ice Tea di DB masih HPP murni (tanpa OPEX), Sapi Sedang sudah HPP+OPEX
    const drinkOctRes = getItemHpp(iceTeaOct, 'mitra', undefined, undefined, 'pos', 'mitra-lain', '2026-10-25')
    expect(drinkOctRes.hpp).toBe(Math.round(1652 * 1.1))
    expect(drinkOctRes.baseHpp).toBe(1652)
    expect(drinkOctRes.markup).toBe(drinkOctRes.hpp - drinkOctRes.baseHpp)

    const comboOctRes = getItemHpp(comboOct, 'mitra', undefined, undefined, 'pos', 'mitra-lain', '2026-10-25')
    expect(comboOctRes.hpp).toBe(Math.round(14525.5 + 1652 * 1.1))
    expect(comboOctRes.baseHpp).toBe(13205 + 1652)
    expect(Math.round((comboOctRes.baseHpp + comboOctRes.markup) * 100) / 100).toBe(comboOctRes.hpp)

    // Mulai 1 Nov 2026 aturan takeout OPEX tidak lagi dipakai: markup mitra
    // seragam (HPP + OPEX) x 1,15, jadi Ice Tea 1845 -> round(1845 x 1,15).
    const iceTeaNov = { ...iceTeaOct, hpp_override: 1845 }
    const drinkNovRes = getItemHpp(iceTeaNov, 'mitra', undefined, undefined, 'pos', 'mitra-lain', '2026-11-02')
    expect(drinkNovRes.baseHpp).toBe(1845)
    expect(drinkNovRes.hpp).toBe(Math.round(1845 * 1.15))
    expect(drinkNovRes.markup).toBe(drinkNovRes.hpp - drinkNovRes.baseHpp)
  })

  it('fallback saat menuItem lama memiliki hpp_override null dan channel_hpp kosong {}', () => {
    const legacyItem = {
      id: 'a7d7d3e5-0429-42f9-916c-4b8a0bf784d3',
      name: 'Original Sapi Sedang (Online)',
      hpp_override: null,
      channel_hpp: {},
      is_package: false
    }
    const res = getItemHpp(legacyItem, 'mitra', 'Original Sapi Sedang', byNameMap, null, 'mitra-lain', '2026-10-20')
    expect(res.baseHpp).toBe(13205)
    expect(res.hpp).toBe(Math.round(14525.5))
  })

  it('mampu mencocokkan variasi nama ojol seperti SUKA Beef Shawarma', () => {
    const res = getItemHpp(null, 'outlet', 'SUKA Beef Shawarma', byNameMap)
    expect(res.baseHpp).toBe(17090.7)
    expect(res.hpp).toBe(17090.7)
  })

  it('MENU_HPP_SELECT wajib memuat is_available, outlet_id, dan categories(name) agar prioritas dedup bekerja', () => {
    expect(MENU_HPP_SELECT).toContain('is_available')
    expect(MENU_HPP_SELECT).toContain('outlet_id')
    expect(MENU_HPP_SELECT).toMatch(/categories\s*\(\s*name\s*\)/)
  })

  it('getItemHpp mengambil HPP dari menu aktif saat ada duplikat yatim nonaktif setelah menu aktif', () => {
    const menus = [
      {
        id: 'active-id',
        name: 'Original Sapi Sedang',
        hpp_override: 14525.5,
        channel_hpp: {},
        is_package: false,
        is_available: true,
        outlet_id: null,
        categories: { name: 'Shawarma' },
      },
      {
        id: 'orphan-id',
        name: 'Original Sapi Sedang',
        hpp_override: 9999,
        channel_hpp: {},
        is_package: false,
        is_available: false,
        outlet_id: null,
        categories: null,
      },
    ]
    const penerap = buatPenerapRiwayat(menus, [], cleanItemName).untuk('2026-10-31')
    const res = getItemHpp(null, 'mitra', 'Original Sapi Sedang', penerap.byName, null, 'mitra-lain', '2026-10-31')
    expect(res.baseHpp).toBe(13205)
    expect(res.hpp).toBe(Math.round(14525.5))
  })
})
