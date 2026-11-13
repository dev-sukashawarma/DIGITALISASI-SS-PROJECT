import { describe, expect, it } from 'vitest'
import { tipeOrderOnline } from './orderOnlineSync'

describe('tipeOrderOnline', () => {
  it('outlet mitra tercatat sebagai partner di Order Online', () => {
    expect(tipeOrderOnline('mitra')).toBe('partner')
  })
  it('outlet internal dan lainnya tercatat sebagai owned', () => {
    expect(tipeOrderOnline('internal')).toBe('owned')
    expect(tipeOrderOnline('')).toBe('owned')
  })
})
