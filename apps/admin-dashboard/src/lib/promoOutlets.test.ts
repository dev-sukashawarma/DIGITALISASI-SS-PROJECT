import { describe, it, expect } from 'vitest'
import {
  findPromoOutletOverlaps,
  groupPromoRows,
  isRowAssigned,
  promoConfigSignature,
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

describe('promoConfigSignature', () => {
  it('baris dengan konfigurasi sama menghasilkan sidik jari sama walau format berbeda', () => {
    const a = { discount_type: 'percentage', discount_value: '10', promo_name: ' Diskon ', start_date: '2026-10-30T10:00:00+00:00', excluded_menu_item_ids: ['m2', 'm1'] }
    const b = { discount_type: 'percentage', discount_value: 10, promo_name: 'Diskon', start_date: '2026-10-30T17:00:00+07:00', excluded_menu_item_ids: ['m1', 'm2'], daily_schedule: [] }
    expect(promoConfigSignature(a)).toBe(promoConfigSignature(b))
  })

  it('reward_menu_item_id dan quota_pool_id tidak memecah promo (nilainya memang beda per outlet)', () => {
    expect(promoConfigSignature({ discount_type: 'buy_one_get_one', reward_menu_item_id: 'r1', quota_pool_id: 'p1' })).toBe(
      promoConfigSignature({ discount_type: 'buy_one_get_one', reward_menu_item_id: 'r2', quota_pool_id: 'p2' }),
    )
  })

  it('nilai yang berbeda menghasilkan sidik jari berbeda', () => {
    expect(promoConfigSignature({ discount_type: 'percentage', discount_value: 10 })).not.toBe(
      promoConfigSignature({ discount_type: 'percentage', discount_value: 20 }),
    )
    expect(promoConfigSignature({ is_active: true })).not.toBe(promoConfigSignature({ is_active: false }))
  })
})

describe('groupPromoRows — konfigurasi berbeda per outlet', () => {
  it('memecah satu kunci jadi beberapa promo bila outlet terpilih punya konfigurasi berbeda', () => {
    const grouped = groupPromoRows(
      [
        { ...row({ outlet_id: 'o1', id: 'a' }), discount_type: 'percentage', discount_value: 10 },
        { ...row({ outlet_id: 'o2', id: 'b' }), discount_type: 'buy_one_get_one', discount_value: 0.01 },
        { ...row({ outlet_id: 'o3', id: 'c' }), discount_type: 'percentage', discount_value: 10 },
      ] as unknown as PromoOutletRow[],
      OUTLETS,
    )

    expect(grouped).toHaveLength(2)
    expect(grouped[0].key).toBe('global_null')
    expect(grouped[0].outletIds).toEqual(['o1', 'o3'])
    expect(grouped[0].representative.id).toBe('a')
    expect(grouped[1].key).toBe('global_null')
    expect(grouped[1].outletIds).toEqual(['o2'])
  })

  it('baris yang dilepas tidak ikut memecah promo', () => {
    const grouped = groupPromoRows(
      [
        { ...row({ outlet_id: 'o1', id: 'a' }), discount_value: 10 },
        { ...row({ outlet_id: 'o2', id: 'b', is_assigned: false }), discount_value: 99 },
      ] as unknown as PromoOutletRow[],
      OUTLETS,
    )

    expect(grouped).toHaveLength(1)
    expect(grouped[0].outletIds).toEqual(['o1'])
  })
})

describe('findPromoOutletOverlaps', () => {
  it('tidak ada tabrakan bila outlet tiap promo pada kunci yang sama saling lepas', () => {
    expect(
      findPromoOutletOverlaps(
        [
          { scope: 'global', outlet_ids: ['o1'] },
          { scope: 'global', outlet_ids: ['o2', 'o3'] },
          { scope: 'item', menu_item_id: 'm1', outlet_ids: ['o1', 'o2', 'o3'] },
        ],
        OUTLETS,
      ),
    ).toEqual([])
  })

  it('melaporkan outlet yang diklaim dua promo pada kunci yang sama', () => {
    const overlaps = findPromoOutletOverlaps(
      [
        { scope: 'global', outlet_ids: ['o1', 'o2'] },
        { scope: 'global', outlet_ids: ['o2'] },
      ],
      OUTLETS,
    )
    expect(overlaps).toEqual([{ key: 'global_null', outletId: 'o2', promoIndexes: [0, 1] }])
  })

  it('promo tanpa daftar outlet mengklaim semua outlet (perilaku lama)', () => {
    const overlaps = findPromoOutletOverlaps([{ scope: 'global' }, { scope: 'global', outlet_ids: ['o3'] }], OUTLETS)
    expect(overlaps.map(o => o.outletId)).toEqual(['o3'])
  })

  it('kunci berbeda tidak pernah bertabrakan', () => {
    expect(
      findPromoOutletOverlaps(
        [
          { scope: 'item', menu_item_id: 'm1', outlet_ids: ['o1'] },
          { scope: 'item', menu_item_id: 'm2', outlet_ids: ['o1'] },
        ],
        OUTLETS,
      ),
    ).toEqual([])
  })
})
