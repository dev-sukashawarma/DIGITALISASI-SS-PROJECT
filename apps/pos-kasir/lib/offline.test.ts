import { describe, it, expect } from 'vitest'
import { estimateOrderNumber } from './offline'

describe('estimateOrderNumber', () => {
  it('melanjutkan dari nomor server tertinggi yang diketahui', () => {
    // Server terakhir memberi 12, belum ada order lokal tertunda.
    expect(estimateOrderNumber([9, 12, 11], 0)).toBe(13)
  })

  it('menghitung order lokal yang sudah antre supaya tidak kembar', () => {
    // Server terakhir 12, sudah ada 2 order offline menunggu -> berikutnya 15.
    expect(estimateOrderNumber([12], 2)).toBe(15)
  })

  it('mulai dari 1 saat belum ada order sama sekali hari itu', () => {
    expect(estimateOrderNumber([], 0)).toBe(1)
  })

  it('mengabaikan nomor tak valid dari data cache yang rusak', () => {
    expect(estimateOrderNumber([NaN, 0, -3, 7], 0)).toBe(8)
  })

  it('tidak pernah mengembalikan angka 9000-an dari nomor lokal lama', () => {
    // Cache lama bisa berisi 9001 warisan build sebelumnya; jangan diikuti.
    expect(estimateOrderNumber([9001, 9002, 14], 0)).toBe(15)
  })
})
