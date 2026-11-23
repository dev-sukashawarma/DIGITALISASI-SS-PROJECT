import { describe, expect, it } from 'vitest'
import {
  BATAS_MUNDUR_BASELINE_HARI,
  batasHariWIB,
  cakupanJendela,
  dalamJendela,
  filterOrJendela,
  keMikrodetik,
  pilihOpnameRentang,
  rentangGabungan,
  susunJendelaOutlet,
} from './jendelaRentangOpname'

const A = 'outlet-a'
const B = 'outlet-b'

// Waktu dalam UTC (WIB = UTC+7). 2026-11-20T15:03Z = 20 Nov 22:03 WIB.
const op = (id: string, outlet_id: string, created_at: string) => ({ id, outlet_id, created_at })

describe('batasHariWIB', () => {
  it('00:00 sampai 23:59:59.999999 WIB', () => {
    const b = batasHariWIB('2026-11-21')
    expect(b.awalIso).toBe('2026-11-21T00:00:00+07:00')
    expect(b.akhirIso).toBe('2026-11-21T23:59:59.999999+07:00')
  })
})

describe('keMikrodetik', () => {
  it('mempertahankan presisi mikrodetik Postgres', () => {
    const a = keMikrodetik('2026-11-21T15:23:13.374496+00:00')
    const b = keMikrodetik('2026-11-21T15:23:13.374800+00:00')
    expect(b - a).toBe(304)
  })
  it('zona +07:00 setara UTC', () => {
    expect(keMikrodetik('2026-11-21T00:00:00+07:00')).toBe(keMikrodetik('2026-11-20T17:00:00Z'))
  })
})

describe('pilihOpnameRentang', () => {
  const opnames = [
    op('a19', A, '2026-11-19T15:21:25Z'),
    op('a20', A, '2026-11-20T15:03:44Z'),
    op('a21', A, '2026-11-21T15:09:01Z'),
    op('a22', A, '2026-11-22T15:00:39Z'),
    op('b18', B, '2026-11-18T16:00:00Z'),
  ]

  it('awal = opname terakhir sebelum 00:00 WIB tanggal mulai; penutup = terakhir pada tanggal akhir', () => {
    const r = pilihOpnameRentang({ outletIds: [A, B], startDate: '2026-11-21', endDate: '2026-11-22', opnames })
    expect(r.get(A)?.awal?.id).toBe('a20')
    expect(r.get(A)?.penutup?.id).toBe('a22')
    // B: opname 18 Nov 23:00 WIB = baseline; tidak opname pada 22 Nov
    expect(r.get(B)?.awal?.id).toBe('b18')
    expect(r.get(B)?.penutup).toBeNull()
  })

  it('opname 23:30 WIB tanggal akhir tetap penutup (batas hari WIB, bukan UTC)', () => {
    const r = pilihOpnameRentang({
      outletIds: [A],
      startDate: '2026-11-22',
      endDate: '2026-11-22',
      opnames: [op('x', A, '2026-11-22T16:30:00Z')],
    })
    expect(r.get(A)?.penutup?.id).toBe('x')
    expect(r.get(A)?.awal).toBeNull()
  })

  it('opname pada tanggal mulai bukan baseline', () => {
    const r = pilihOpnameRentang({
      outletIds: [A],
      startDate: '2026-11-21',
      endDate: '2026-11-21',
      opnames: [op('a21', A, '2026-11-21T15:09:01Z')],
    })
    expect(r.get(A)?.awal).toBeNull()
    expect(r.get(A)?.penutup?.id).toBe('a21')
  })

  it('baseline lebih tua dari batas mundur diabaikan', () => {
    const r = pilihOpnameRentang({
      outletIds: [A],
      startDate: '2026-11-21',
      endDate: '2026-11-21',
      opnames: [op('lama', A, '2026-09-01T15:00:00Z')],
    })
    expect(BATAS_MUNDUR_BASELINE_HARI).toBeGreaterThan(0)
    expect(r.get(A)?.awal).toBeNull()
  })

  it('outlet tanpa opname apa pun tetap punya entri kosong', () => {
    const r = pilihOpnameRentang({ outletIds: ['c'], startDate: '2026-11-21', endDate: '2026-11-22', opnames })
    expect(r.get('c')).toEqual({ awal: null, penutup: null })
  })
})

describe('susunJendelaOutlet', () => {
  it('memakai waktu tutup opname; tanpa opname jatuh ke batas hari WIB', () => {
    const j = susunJendelaOutlet({
      outletIds: [A, B],
      startDate: '2026-11-21',
      endDate: '2026-11-22',
      pilihan: new Map([
        [A, { awal: op('a20', A, '2026-11-20T15:03:44Z'), penutup: op('a22', A, '2026-11-22T15:00:39Z') }],
        [B, { awal: null, penutup: null }],
      ]),
      waktuTutup: new Map([
        ['a20', '2026-11-20T15:30:45.014585+00:00'],
        ['a22', '2026-11-22T15:17:36.2923+00:00'],
      ]),
    })
    expect(j.get(A)).toEqual({
      start: '2026-11-20T15:30:45.014585+00:00',
      end: '2026-11-22T15:17:36.2923+00:00',
      opname_awal_id: 'a20',
      opname_penutup_id: 'a22',
    })
    expect(j.get(B)).toEqual({
      start: '2026-11-21T00:00:00+07:00',
      end: '2026-11-22T23:59:59.999999+07:00',
      opname_awal_id: null,
      opname_penutup_id: null,
    })
  })

  it('waktu tutup yang tak dikenal jatuh ke created_at opname', () => {
    const j = susunJendelaOutlet({
      outletIds: [A],
      startDate: '2026-11-21',
      endDate: '2026-11-21',
      pilihan: new Map([[A, { awal: op('a20', A, '2026-11-20T15:03:44Z'), penutup: null }]]),
      waktuTutup: new Map(),
    })
    expect(j.get(A)?.start).toBe('2026-11-20T15:03:44Z')
  })
})

describe('dalamJendela & rentangGabungan', () => {
  const j = { start: '2026-11-20T15:30:45.014585+00:00', end: '2026-11-22T15:17:36.2923+00:00' }
  it('inklusif di kedua batas, presisi mikrodetik', () => {
    expect(dalamJendela('2026-11-20T15:30:45.014585+00:00', j)).toBe(true)
    expect(dalamJendela('2026-11-20T15:30:45.0145+00:00', j)).toBe(false)
    expect(dalamJendela('2026-11-22T15:17:36.2923+00:00', j)).toBe(true)
    expect(dalamJendela('2026-11-22T15:17:36.2924+00:00', j)).toBe(false)
  })
  it('rentang gabungan = awal paling dini & akhir paling akhir', () => {
    const r = rentangGabungan([
      { start: '2026-11-20T15:30:00Z', end: '2026-11-22T15:17:00Z' },
      { start: '2026-11-17T15:00:00Z', end: '2026-11-22T16:59:59.999999Z' },
    ])
    expect(r).toEqual({ start: '2026-11-17T15:00:00Z', end: '2026-11-22T16:59:59.999999Z' })
  })
})

describe('filterOrJendela', () => {
  it('satu grup and() per outlet, nilai waktu dikutip', () => {
    const s = filterOrJendela(
      new Map([
        [A, { start: '2026-11-20T15:30:45+00:00', end: '2026-11-22T15:17:36+00:00' }],
        [B, { start: 'S', end: 'E' }],
      ]),
      'created_at'
    )
    expect(s).toBe(
      'and(outlet_id.eq.outlet-a,created_at.gte."2026-11-20T15:30:45+00:00",created_at.lte."2026-11-22T15:17:36+00:00"),' +
        'and(outlet_id.eq.outlet-b,created_at.gte."S",created_at.lte."E")'
    )
  })
})

describe('cakupanJendela', () => {
  it('menghitung outlet ber-baseline & ber-opname penutup', () => {
    const c = cakupanJendela({
      a: { start: 's', end: 'e', opname_awal_id: 'x', opname_penutup_id: 'y' },
      b: { start: 's', end: 'e', opname_awal_id: null, opname_penutup_id: 'z' },
      c: { start: 's', end: 'e', opname_awal_id: null, opname_penutup_id: null },
    })
    expect(c).toEqual({ total: 3, denganBaseline: 1, denganPenutup: 2 })
  })
  it('tanpa data = nol', () => {
    expect(cakupanJendela(undefined)).toEqual({ total: 0, denganBaseline: 0, denganPenutup: 0 })
  })
})
