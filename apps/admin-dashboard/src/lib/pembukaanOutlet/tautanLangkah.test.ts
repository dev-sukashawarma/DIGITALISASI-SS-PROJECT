import { describe, expect, it } from 'vitest'
import { tautanLangkah } from './tautanLangkah'

const KUNCI_CHECKLIST = [
  'data_outlet', 'am', 'crew', 'stok_awal', 'opname_pertama', 'grand_opening',
  'mitra', 'masa_rab', 'leader', 'absensi', 'target_harian',
]

describe('tautanLangkah', () => {
  it('setiap kunci checklist dikenali (null hanya untuk langkah yang diedit di papan)', () => {
    for (const k of KUNCI_CHECKLIST) {
      const t = tautanLangkah(k, 'o1')
      if (k === 'masa_rab' || k === 'grand_opening') expect(t).toBeNull()
      else expect(t, k).not.toBeNull()
    }
  })

  it('langkah di admin-dashboard memakai path internal', () => {
    expect(tautanLangkah('data_outlet', 'o1')).toEqual({ href: '/dashboard/outlets', eksternal: false })
    expect(tautanLangkah('target_harian', 'o1')).toEqual({ href: '/dashboard/owner/targets', eksternal: false })
  })

  it('langkah di app lain memakai URL lengkap', () => {
    const t = tautanLangkah('stok_awal', 'o1')
    expect(t?.eksternal).toBe(true)
    expect(t?.href).toMatch(/^https?:\/\/.+\/distribusi\/surat-jalan\/new$/)
    expect(tautanLangkah('crew', 'o1')?.href).toMatch(/\/staff$/)
  })

  it('kunci tak dikenal → null', () => {
    expect(tautanLangkah('tidak_ada', 'o1')).toBeNull()
  })
})
