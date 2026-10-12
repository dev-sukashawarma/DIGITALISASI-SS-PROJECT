// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { pilihProfilPratinjau } from './mitraPratinjau'

const profil = [
  { id: 'p-a', user_id: 'u-a', nama_mitra: 'A' },
  { id: 'p-b', user_id: 'u-b', nama_mitra: 'B' },
  { id: 'p-c', user_id: null, nama_mitra: 'C' },
]

describe('pilihProfilPratinjau', () => {
  it('tanpa pilihan: profil pertama dalam daftar', () => {
    expect(pilihProfilPratinjau(profil)?.id).toBe('p-a')
    expect(pilihProfilPratinjau(profil, null)?.id).toBe('p-a')
    expect(pilihProfilPratinjau(profil, '')?.id).toBe('p-a')
  })
  it('cocok lewat id profil maupun user_id', () => {
    expect(pilihProfilPratinjau(profil, 'p-b')?.id).toBe('p-b')
    expect(pilihProfilPratinjau(profil, 'u-b')?.id).toBe('p-b')
    expect(pilihProfilPratinjau(profil, 'p-c')?.id).toBe('p-c')
  })
  it('pilihan basi (profil sudah dihapus): kembali ke profil pertama, bukan kosong', () => {
    expect(pilihProfilPratinjau(profil, 'p-sudah-dihapus')?.id).toBe('p-a')
  })
  it('daftar kosong: undefined', () => {
    expect(pilihProfilPratinjau([], 'p-a')).toBeUndefined()
  })
})
