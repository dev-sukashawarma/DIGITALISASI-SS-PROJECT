import { describe, it, expect } from 'vitest'
import { rentangHalaman } from './halamanRentang'

describe('rentangHalaman', () => {
  it('nol baris -> tidak ada halaman', () => {
    expect(rentangHalaman(0, 1000)).toEqual([])
  })

  it('kurang dari satu halaman -> satu rentang', () => {
    expect(rentangHalaman(250, 1000)).toEqual([[0, 999]])
  })

  it('pas kelipatan ukuran halaman tidak menambah halaman kosong', () => {
    expect(rentangHalaman(2000, 1000)).toEqual([
      [0, 999],
      [1000, 1999],
    ])
  })

  it('sisa baris jadi halaman terakhir', () => {
    expect(rentangHalaman(2001, 1000)).toEqual([
      [0, 999],
      [1000, 1999],
      [2000, 2999],
    ])
  })

  it('nilai tak valid dianggap nol', () => {
    expect(rentangHalaman(Number.NaN, 1000)).toEqual([])
    expect(rentangHalaman(-5, 1000)).toEqual([])
  })
})
