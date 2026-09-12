import { describe, it, expect } from 'vitest'
import type { PostgrestError } from '@supabase/supabase-js'
import { bacaJumlah } from './jumlahKueri'

// PostgrestError sebuah kelas; di tes cukup bentuknya, bukan instansnya.
const galat = {
  message: 'gagal', details: '', hint: '', code: '42501', name: 'PostgrestError',
} as unknown as PostgrestError

describe('bacaJumlah', () => {
  it('mengembalikan angka apa adanya saat kueri berhasil', () => {
    expect(bacaJumlah({ count: 12, error: null })).toBe(12)
  })

  // Nol yang sungguhan harus lolos sebagai 0, bukan tertukar dengan "tidak tahu".
  it('nol sungguhan tetap nol, bukan null', () => {
    expect(bacaJumlah({ count: 0, error: null })).toBe(0)
  })

  // Kalau ini dikembalikan sebagai 0, layar Outlet menuduh semua outlet
  // "nol menu tayang" hanya karena satu kueri gagal.
  it('kueri gagal menjadi null, bukan nol', () => {
    expect(bacaJumlah({ count: null, error: galat })).toBeNull()
  })

  it('gagal tapi count sempat terisi tetap dianggap tidak diketahui', () => {
    expect(bacaJumlah({ count: 7, error: galat })).toBeNull()
  })

  it('count kosong tanpa galat juga tidak diketahui', () => {
    expect(bacaJumlah({ count: null, error: null })).toBeNull()
  })
})
