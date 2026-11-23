import { describe, it, expect } from 'vitest'
import { serapLapisan, type BarisLapisan } from './lapisanAwalFifo'

describe('serapLapisan', () => {
  it('mengambil kiriman terbaru dulu sampai saldo awal tertutup, per kunci', () => {
    const sisa = new Map([
      ['o1|ayam', 15],
      ['o2|ayam', 5],
    ])
    const hasil = new Map<string, BarisLapisan[]>()
    const cukup = serapLapisan(
      sisa,
      [
        { kunci: 'o1|ayam', qty: 10, vendor: 'A' },
        { kunci: 'o2|ayam', qty: 8, vendor: 'B' },
        { kunci: 'o1|ayam', qty: 10, vendor: 'C' },
        { kunci: 'o1|ayam', qty: 10, vendor: 'D' }, // sudah tertutup -> tidak diambil
      ],
      hasil
    )
    expect(cukup).toBe(true)
    expect(hasil.get('o1|ayam')).toEqual([
      { kunci: 'o1|ayam', qty: 10, vendor: 'A' },
      { kunci: 'o1|ayam', qty: 10, vendor: 'C' },
    ])
    expect(hasil.get('o2|ayam')).toEqual([{ kunci: 'o2|ayam', qty: 8, vendor: 'B' }])
  })

  it('belum tertutup -> false (pemanggil lanjut ke halaman berikutnya)', () => {
    const sisa = new Map([['k', 100]])
    const hasil = new Map<string, BarisLapisan[]>()
    expect(serapLapisan(sisa, [{ kunci: 'k', qty: 30, vendor: null }], hasil)).toBe(false)
    expect(sisa.get('k')).toBe(70)
    expect(serapLapisan(sisa, [{ kunci: 'k', qty: 70, vendor: 'X' }], hasil)).toBe(true)
    expect(hasil.get('k')).toHaveLength(2)
  })

  it('kunci yang tidak dibutuhkan diabaikan; tanpa kebutuhan langsung cukup', () => {
    const hasil = new Map<string, BarisLapisan[]>()
    expect(serapLapisan(new Map(), [{ kunci: 'x', qty: 1, vendor: null }], hasil)).toBe(true)
    expect(hasil.size).toBe(0)
  })
})
