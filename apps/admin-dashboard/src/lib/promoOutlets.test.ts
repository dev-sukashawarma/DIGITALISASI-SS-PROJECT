import { describe, it, expect } from 'vitest'
import {
  groupPromoRows,
  isRowAssigned,
  promoOutletKey,
  resolvePromoOutletIds,
  type PromoOutletRow,
} from './promoOutlets'

const OUTLETS = ['o1', 'o2', 'o3']

const row = (over: Partial<PromoOutletRow> & { outlet_id: string }): PromoOutletRow => ({
  scope: 'global',
  menu_item_id: null,
  ...over,
})

describe('resolvePromoOutletIds', () => {
  it('field yang tidak diisi berarti semua outlet aktif (perilaku lama)', () => {
    expect(resolvePromoOutletIds({ scope: 'global' }, OUTLETS)).toEqual(OUTLETS)
    expect(resolvePromoOutletIds({ scope: 'global', outlet_ids: null }, OUTLETS)).toEqual(OUTLETS)
  })

  it('daftar kosong yang eksplisit berarti belum ada outlet dipilih, bukan semua', () => {
    expect(resolvePromoOutletIds({ scope: 'global', outlet_ids: [] }, OUTLETS)).toEqual([])
  })

  it('menyaring hanya outlet terpilih dan mempertahankan urutan outlet aktif', () => {
    expect(resolvePromoOutletIds({ scope: 'global', outlet_ids: ['o3', 'o1'] }, OUTLETS)).toEqual(['o1', 'o3'])
  })

  it('membuang outlet yang sudah tidak aktif', () => {
    expect(resolvePromoOutletIds({ scope: 'global', outlet_ids: ['o2', 'sudah-hapus'] }, OUTLETS)).toEqual(['o2'])
  })

  it('menghasilkan daftar kosong saat tak ada outlet terpilih yang masih aktif', () => {
    expect(resolvePromoOutletIds({ scope: 'global', outlet_ids: ['sudah-hapus'] }, OUTLETS)).toEqual([])
  })
})

describe('isRowAssigned', () => {
  it('baris lama tanpa kolom is_assigned dianggap terpilih', () => {
    expect(isRowAssigned({})).toBe(true)
    expect(isRowAssigned({ is_assigned: null })).toBe(true)
    expect(isRowAssigned({ is_assigned: true })).toBe(true)
    expect(isRowAssigned({ is_assigned: false })).toBe(false)
  })
})

describe('promoOutletKey', () => {
  it('memisahkan promo global dari promo per menu', () => {
    expect(promoOutletKey({ scope: 'global', menu_item_id: null })).toBe('global_null')
    expect(promoOutletKey({ scope: 'item', menu_item_id: 'm1' })).toBe('item_m1')
  })
})

describe('groupPromoRows', () => {
  it('menggabungkan baris per outlet jadi satu promo dengan daftar outletnya', () => {
    const grouped = groupPromoRows(
      [
        row({ outlet_id: 'o1', id: 'a' }),
        row({ outlet_id: 'o2', id: 'b' }),
        row({ outlet_id: 'o3', id: 'c', is_assigned: false }),
      ],
      OUTLETS,
    )

    expect(grouped).toHaveLength(1)
    expect(grouped[0].outletIds).toEqual(['o1', 'o2'])
    expect(grouped[0].representative.id).toBe('a')
  })

  it('memakai baris terpilih sebagai sumber nilai form, bukan baris yang dilepas', () => {
    const grouped = groupPromoRows(
      [
        row({ outlet_id: 'o1', id: 'lepas', is_assigned: false }),
        row({ outlet_id: 'o2', id: 'terpilih' }),
      ],
      OUTLETS,
    )

    expect(grouped[0].representative.id).toBe('terpilih')
    expect(grouped[0].outletIds).toEqual(['o2'])
  })

  it('promo yang semua outletnya dilepas tetap terbaca dengan daftar outlet kosong', () => {
    const grouped = groupPromoRows(
      [row({ outlet_id: 'o1', id: 'a', is_assigned: false })],
      OUTLETS,
    )

    expect(grouped[0].outletIds).toEqual([])
    expect(grouped[0].representative.id).toBe('a')
  })

  it('memisahkan promo global dan promo per menu', () => {
    const grouped = groupPromoRows(
      [
        row({ outlet_id: 'o1' }),
        row({ outlet_id: 'o1', scope: 'item', menu_item_id: 'm1' }),
        row({ outlet_id: 'o2', scope: 'item', menu_item_id: 'm1' }),
      ],
      OUTLETS,
    )

    expect(grouped.map(g => g.key)).toEqual(['global_null', 'item_m1'])
    expect(grouped[1].outletIds).toEqual(['o1', 'o2'])
  })

  it('baris contoh tidak bergantung pada urutan baris dari database', () => {
    const rows = [
      row({ outlet_id: 'o3', id: 'c' }),
      row({ outlet_id: 'o1', id: 'a' }),
      row({ outlet_id: 'o2', id: 'b' }),
    ]

    expect(groupPromoRows(rows, OUTLETS)[0].representative.id).toBe('a')
    expect(groupPromoRows([...rows].reverse(), OUTLETS)[0].representative.id).toBe('a')
  })

  it('mengabaikan baris milik outlet yang sudah tidak aktif', () => {
    const grouped = groupPromoRows(
      [row({ outlet_id: 'o1' }), row({ outlet_id: 'outlet-nonaktif' })],
      OUTLETS,
    )

    expect(grouped[0].outletIds).toEqual(['o1'])
  })

  it('kuota per-outlet dilaporkan sebagai pemakaian tertinggi outlet terpilih', () => {
    const grouped = groupPromoRows(
      [
        row({ outlet_id: 'o1', current_usage: 3 }),
        row({ outlet_id: 'o2', current_usage: 7 }),
        row({ outlet_id: 'o3', current_usage: 99, is_assigned: false }),
      ],
      OUTLETS,
    )

    expect(grouped[0].currentUsage).toBe(7)
  })

  it('kuota pool global memakai pemakaian bersama, termasuk baris yang dilepas', () => {
    const grouped = groupPromoRows(
      [
        row({ outlet_id: 'o1', quota_pool_id: 'pool', current_usage: 4 }),
        row({ outlet_id: 'o2', quota_pool_id: 'pool', current_usage: 12 }),
      ],
      OUTLETS,
    )

    expect(grouped[0].currentUsage).toBe(12)
  })
})
