import { describe, expect, it } from 'vitest'
import { tautanLangkahPenutupan } from './tautanLangkah'

describe('tautanLangkahPenutupan', () => {
  it('kas kecil mengarah ke Hub Approval di app finance', () => {
    const t = tautanLangkahPenutupan('kas_kecil')
    expect(t?.eksternal).toBe(true)
    expect(t?.href).toMatch(/finance.*\/approval$/)
  })
  it('crew & penugasan mengarah ke HR', () => {
    expect(tautanLangkahPenutupan('crew')?.href).toMatch(/\/staff$/)
    expect(tautanLangkahPenutupan('penugasan')?.eksternal).toBe(true)
  })
  it('kanal online & mitra memakai path internal admin', () => {
    expect(tautanLangkahPenutupan('kanal_online')).toEqual({ href: '/dashboard/app-retail/outlet', eksternal: false })
    expect(tautanLangkahPenutupan('mitra')).toEqual({ href: '/dashboard/owner/kelola-mitra', eksternal: false })
  })
  it('langkah yang dikerjakan di papan tidak punya tautan', () => {
    for (const k of ['stok', 'merchant_ojol', 'aset', 'biaya_rutin', 'pesanan_nyasar']) {
      expect(tautanLangkahPenutupan(k), k).toBeNull()
    }
  })
  it('kunci tak dikenal mengembalikan null', () => {
    expect(tautanLangkahPenutupan('tidak_ada')).toBeNull()
  })
})
