import { describe, it, expect } from 'vitest'
import { buatKodeAmbil } from './pickupCode'

describe('buatKodeAmbil', () => {
  it('selalu menghasilkan tepat 4 digit', () => {
    const kode = buatKodeAmbil('9197d153-2a29-4ca8-a123-a4a6ff8e1cbf')
    expect(kode).toMatch(/^\d{4}$/)
  })

  it('deterministik untuk id yang sama', () => {
    const id = '9197d153-2a29-4ca8-a123-a4a6ff8e1cbf'
    expect(buatKodeAmbil(id)).toBe(buatKodeAmbil(id))
  })

  it('menghasilkan kode berbeda untuk id berbeda', () => {
    const a = buatKodeAmbil('9197d153-2a29-4ca8-a123-a4a6ff8e1cbf')
    const b = buatKodeAmbil('11111111-2222-4333-8444-555555555555')
    expect(a).not.toBe(b)
  })

  it('tidak pernah menghasilkan 0000', () => {
    const kode = buatKodeAmbil('00000000-0000-4000-8000-000000000000')
    expect(kode).not.toBe('0000')
  })
})
