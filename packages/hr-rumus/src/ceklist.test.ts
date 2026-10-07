import { describe, it, expect } from 'vitest'
import { terburuk } from './ceklist'

describe('terburuk', () => {
  it('mengambil nilai terburuk, abaikan kosong', () => {
    expect(terburuk(['baik', 'perhatian', null, 'baik'])).toBe('perhatian')
    expect(terburuk(['baik', 'buruk', 'perhatian'])).toBe('buruk')
    expect(terburuk([undefined, null])).toBeNull()
  })
})
