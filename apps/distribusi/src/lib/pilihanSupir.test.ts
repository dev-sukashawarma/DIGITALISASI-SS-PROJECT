import { describe, expect, it } from 'vitest'
import { pilihanSupirInternal } from './pilihanSupir'

describe('pilihanSupirInternal', () => {
  const staf = [
    { name: 'Ismansyah', role: 'crew' },
    { name: 'Adam Sandy Rakhman', role: 'driver' },
    { name: 'Fahmi Alaydrus', role: 'crew' },
    { name: 'Budi', role: 'kitchen' },
  ]

  it('semua staf tetap bisa dipilih (crew sering jadi supir)', () => {
    expect(pilihanSupirInternal(staf)).toHaveLength(4)
    expect(pilihanSupirInternal(staf)).toContain('Fahmi Alaydrus')
  })

  it('akun driver di urutan teratas, sisanya mengikuti urutan asal', () => {
    expect(pilihanSupirInternal(staf)).toEqual(['Adam Sandy Rakhman', 'Ismansyah', 'Fahmi Alaydrus', 'Budi'])
  })
})
