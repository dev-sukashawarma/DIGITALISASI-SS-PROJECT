import { describe, it, expect } from 'vitest'
import { bacaGalatRpc } from './galatRpc'

describe('bacaGalatRpc', () => {
  it('42501 → pesan hak akses, membawa pesan asli', () => {
    const g = bacaGalatRpc({ code: '42501', message: 'Peran purchasing tidak berhak mengubah master bahan baku (lingkup data)' })
    expect(g.kode).toBe('42501')
    expect(g.pesan).toContain('tidak berhak')
    expect(g.bisaDipaksa).toBe(false)
  })
  it('dugaan salah satuan → bisaDipaksa', () => {
    const g = bacaGalatRpc({ code: 'P0001', message: 'Harga ini 48x harga master (Rp 1), pas dengan faktor satuan 48 — kemungkinan salah satuan. Periksa lagi, atau simpan dengan paksa bila memang benar.' })
    expect(g.bisaDipaksa).toBe(true)
  })
  it('satuan beli tak dikenali → bisaDipaksa', () => {
    const g = bacaGalatRpc({ code: '22023', message: 'Satuan beli "rol" tidak dikenali untuk bahan ini (tingkat: Dus/Roll/cm); periksa ejaan atau simpan dengan paksa bila memang benar.' })
    expect(g.bisaDipaksa).toBe(true)
    expect(g.kode).toBe('22023')
  })
  it('isi berbeda → TIDAK bisa dipaksa', () => {
    const g = bacaGalatRpc({ message: 'Isi 1 roll dari vendor ini (500) berbeda dengan master (760). Bahan harus dipecah per spesifikasi dulu sebelum harga ini dicatat.' })
    expect(g.bisaDipaksa).toBe(false)
    expect(g.pesan).toContain('dipecah')
  })
  it('Error biasa & nilai aneh', () => {
    expect(bacaGalatRpc(new Error('putus')).pesan).toBe('putus')
    expect(bacaGalatRpc('x').pesan).toBe('Terjadi kesalahan')
    expect(bacaGalatRpc(null).kode).toBeNull()
  })
})
