import { describe, it, expect } from 'vitest'
import { bacaPercakapan, simpanPercakapan, hapusPercakapan } from './simpanan'

function memori(): Storage {
  const m = new Map<string, string>()
  return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => void m.set(k, v), removeItem: (k) => void m.delete(k), clear: () => m.clear(), key: () => null, get length() { return m.size } }
}

describe('simpanan percakapan bot HRD', () => {
  it('hanya dipakai di hari yang sama (WIB)', () => {
    const s = memori()
    simpanPercakapan(s, 'abc', '2026-10-07')
    expect(bacaPercakapan(s, '2026-10-07')).toBe('abc')
    expect(bacaPercakapan(s, '2026-10-08')).toBeNull()
  })
  it('tahan storage rusak / tidak tersedia', () => {
    const s = memori()
    s.setItem('botHrd.percakapan', '{rusak')
    expect(bacaPercakapan(s, '2026-10-07')).toBeNull()
    expect(bacaPercakapan(null, '2026-10-07')).toBeNull()
    expect(() => simpanPercakapan(null, 'x', '2026-10-07')).not.toThrow()
    hapusPercakapan(s)
    expect(s.getItem('botHrd.percakapan')).toBeNull()
  })
})
