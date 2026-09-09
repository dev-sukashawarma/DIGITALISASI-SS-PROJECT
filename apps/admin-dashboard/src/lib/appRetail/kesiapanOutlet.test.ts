import { describe, it, expect } from 'vitest'
import { periksaKesiapanOutlet, type OutletApp } from './kesiapanOutlet'

const dasar: OutletApp = {
  id: 'o1', name: 'Empang', type: 'outlet', is_active: true, app_enabled: true,
}

describe('periksaKesiapanOutlet', () => {
  it('outlet sehat: melayani, tanpa peringatan', () => {
    expect(periksaKesiapanOutlet(dasar, 12)).toEqual({ melayani: true, peringatan: [] })
  })

  it('outlet mati untuk aplikasi tidak melayani dan tidak diperingatkan', () => {
    const hasil = periksaKesiapanOutlet({ ...dasar, app_enabled: false }, 0)
    expect(hasil.melayani).toBe(false)
    expect(hasil.peringatan).toEqual([])
  })

  // GET /api/v1/outlets menyaring app_enabled TANPA menyaring is_active.
  // Outlet yang sudah dinonaktifkan tetap ditawarkan ke pelanggan.
  it('menyala tapi outlet nonaktif: diperingatkan', () => {
    const hasil = periksaKesiapanOutlet({ ...dasar, is_active: false }, 12)
    expect(hasil.melayani).toBe(true)
    expect(hasil.peringatan).toContain('Outlet nonaktif tapi masih melayani aplikasi')
  })

  // Kegagalan nyata pada uji coba 8 September: katalog kosong, aplikasi tampak
  // rusak, padahal belum ada menu yang diterbitkan.
  it('menyala tapi nol menu tayang: diperingatkan', () => {
    const hasil = periksaKesiapanOutlet(dasar, 0)
    expect(hasil.peringatan).toContain('Nol menu tayang — katalog akan kosong')
  })

  it('dua masalah sekaligus menghasilkan dua peringatan', () => {
    const hasil = periksaKesiapanOutlet({ ...dasar, is_active: false }, 0)
    expect(hasil.peringatan).toHaveLength(2)
  })

  it('outlet mati tidak diperingatkan meski nol menu', () => {
    const hasil = periksaKesiapanOutlet({ ...dasar, app_enabled: false, is_active: false }, 0)
    expect(hasil.peringatan).toEqual([])
  })
})
