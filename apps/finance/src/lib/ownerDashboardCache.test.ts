import { describe, it, expect } from 'vitest'
import {
  eachDateInclusive,
  planPastChunks,
  splitRangeByToday,
  mapWithConcurrency,
  refreshDelayMs,
  orderDatesFromRealtime,
  isDateStr,
  jakartaRangeIso,
  DAILY_CHUNK_MAX_DAYS,
} from './ownerDashboardCache'

describe('eachDateInclusive', () => {
  it('lintas bulan', () => {
    expect(eachDateInclusive('2026-08-30', '2026-09-02')).toEqual(['2026-08-30', '2026-08-31', '2026-09-01', '2026-09-02'])
  })
  it('kosong bila from > to', () => {
    expect(eachDateInclusive('2026-09-02', '2026-09-01')).toEqual([])
  })
})

describe('planPastChunks', () => {
  it('rentang pendek → satu potongan per hari', () => {
    const c = planPastChunks('2026-09-01', '2026-09-24')
    expect(c).toHaveLength(24)
    expect(c[0]).toEqual({ from: '2026-09-01', to: '2026-09-01', dates: ['2026-09-01'] })
  })

  it('rentang panjang → potongan ≤ 7 hari, sejajar Senin, mencakup semua tanggal tanpa celah/dobel', () => {
    const from = '2026-03-01'
    const to = '2026-08-31'
    const c = planPastChunks(from, to)
    expect(c.length).toBeLessThan(40)
    const flat = c.flatMap((x) => x.dates)
    expect(flat).toEqual(eachDateInclusive(from, to))
    for (const x of c) {
      expect(x.dates.length).toBeLessThanOrEqual(7)
      expect(x.from).toBe(x.dates[0])
      expect(x.to).toBe(x.dates[x.dates.length - 1])
    }
    // Semua potongan kecuali yang pertama dimulai hari Senin
    for (const x of c.slice(1)) expect(new Date(`${x.from}T00:00:00Z`).getUTCDay()).toBe(1)
  })

  it('batas per-hari tepat di DAILY_CHUNK_MAX_DAYS', () => {
    const to = eachDateInclusive('2026-01-01', '2026-12-31')[DAILY_CHUNK_MAX_DAYS - 1]
    expect(planPastChunks('2026-01-01', to)).toHaveLength(DAILY_CHUNK_MAX_DAYS)
  })
})

describe('splitRangeByToday', () => {
  const today = '2026-09-25'
  it('bulan ini: lampau s/d kemarin + hari ini', () => {
    expect(splitRangeByToday('2026-09-01', today, today)).toEqual({
      past: { from: '2026-09-01', to: '2026-09-24' },
      includesToday: true,
    })
  })
  it('hari ini saja', () => {
    expect(splitRangeByToday(today, today, today)).toEqual({ past: null, includesToday: true })
  })
  it('seluruhnya lampau', () => {
    expect(splitRangeByToday('2026-08-01', '2026-08-31', today)).toEqual({
      past: { from: '2026-08-01', to: '2026-08-31' },
      includesToday: false,
    })
  })
  it('seluruhnya masa depan', () => {
    expect(splitRangeByToday('2026-09-26', '2026-09-30', today)).toEqual({ past: null, includesToday: false })
  })
})

describe('mapWithConcurrency', () => {
  it('urutan hasil sama dengan input & tidak melebihi batas paralel', async () => {
    let running = 0
    let peak = 0
    const out = await mapWithConcurrency([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 3, async (n) => {
      running++
      peak = Math.max(peak, running)
      await new Promise((r) => setTimeout(r, 5 * (11 - n)))
      running--
      return n * 2
    })
    expect(out).toEqual([2, 4, 6, 8, 10, 12, 14, 16, 18, 20])
    expect(peak).toBeLessThanOrEqual(3)
  })
  it('meneruskan error', async () => {
    await expect(mapWithConcurrency([1, 2], 2, async (n) => { if (n === 2) throw new Error('x'); return n })).rejects.toThrow('x')
  })
})

describe('refreshDelayMs', () => {
  it('refresh pertama langsung', () => expect(refreshDelayMs(null, 1000, 20_000)).toBe(0))
  it('menunggu sisa jeda', () => expect(refreshDelayMs(1000, 6000, 20_000)).toBe(15_000))
  it('nol bila jeda sudah lewat', () => expect(refreshDelayMs(1000, 30_000, 20_000)).toBe(0))
})

describe('orderDatesFromRealtime', () => {
  it('memakai tanggal WIB, bukan UTC', () => {
    // 20:00 UTC tgl 24 = 03:00 WIB tgl 25
    expect(orderDatesFromRealtime({ new: { created_at: '2026-09-24T20:00:00Z' } })).toEqual(['2026-09-25'])
  })
  it('gabungan new & old tanpa duplikat', () => {
    expect(
      orderDatesFromRealtime({
        new: { created_at: '2026-09-20T05:00:00Z' },
        old: { created_at: '2026-09-20T06:00:00Z' },
      })
    ).toEqual(['2026-09-20'])
  })
  it('DELETE tanpa created_at → kosong', () => {
    expect(orderDatesFromRealtime({ old: { id: 'x' } })).toEqual([])
  })
})

describe('isDateStr & jakartaRangeIso', () => {
  it('validasi tanggal', () => {
    expect(isDateStr('2026-09-25')).toBe(true)
    expect(isDateStr('2026-02-30')).toBe(false)
    expect(isDateStr("2026-09-25'; drop")).toBe(false)
  })
  it('batas hari WIB', () => {
    expect(jakartaRangeIso('2026-09-25', '2026-09-25')).toEqual({
      fromIso: '2026-09-24T17:00:00.000Z',
      toIso: '2026-09-25T16:59:59.999Z',
    })
  })
})

describe('codeFingerprint', () => {
  it('stabil untuk masukan sama, berubah bila kode berubah', async () => {
    const { codeFingerprint } = await import('./ownerDashboardCache')
    const f1 = (x: number) => x + 1
    const f2 = (x: number) => x + 2
    expect(codeFingerprint('a', f1, 1)).toBe(codeFingerprint('a', f1, 1))
    expect(codeFingerprint('a', f1, 1)).not.toBe(codeFingerprint('a', f2, 1))
    expect(codeFingerprint('a', 1)).not.toBe(codeFingerprint('b', 1))
  })
})
