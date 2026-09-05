import { describe, it, expect } from 'vitest'
import { computeDelta } from './compare'

describe('computeDelta', () => {
  it('baseline tidak tersedia -> none', () => {
    expect(computeDelta(120, null)).toEqual({ kind: 'none', pct: null })
  })

  it('hari ini 0 dan baseline 0 -> none (bukan -100% atau NaN)', () => {
    expect(computeDelta(0, 0)).toEqual({ kind: 'none', pct: null })
  })

  it('baseline 0 tapi hari ini ada penjualan -> new (bukan +Infinity)', () => {
    expect(computeDelta(50, 0)).toEqual({ kind: 'new', pct: null })
  })

  it('naik', () => {
    expect(computeDelta(120, 100)).toEqual({ kind: 'up', pct: 20 })
  })

  it('turun', () => {
    expect(computeDelta(80, 100)).toEqual({ kind: 'down', pct: -20 })
  })

  it('hari ini 0 padahal baseline ada -> down -100%', () => {
    expect(computeDelta(0, 100)).toEqual({ kind: 'down', pct: -100 })
  })

  it('selisih di bawah 0.5% dianggap datar', () => {
    expect(computeDelta(1002, 1000)).toEqual({ kind: 'flat', pct: 0.2 })
  })

  it('persen dibulatkan ke satu desimal', () => {
    expect(computeDelta(133, 100)).toEqual({ kind: 'up', pct: 33 })
    expect(computeDelta(1337, 1000)).toEqual({ kind: 'up', pct: 33.7 })
  })
})
