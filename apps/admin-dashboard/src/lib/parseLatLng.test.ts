import { describe, it, expect } from 'vitest'
import { parseLatLng } from './parseLatLng'

describe('parseLatLng', () => {
  it('parses "lat, lng" with spaces', () => {
    expect(parseLatLng('-6.5971, 106.8060')).toEqual({ lat: -6.5971, lng: 106.806 })
  })
  it('parses without space after comma', () => {
    expect(parseLatLng('-6.5971,106.8060')).toEqual({ lat: -6.5971, lng: 106.806 })
  })
  it('tolerates degree symbols and extra whitespace', () => {
    expect(parseLatLng('  -6.5971°, 106.8060°  ')).toEqual({ lat: -6.5971, lng: 106.806 })
  })
  it('returns null for a single number', () => {
    expect(parseLatLng('-6.5971')).toBeNull()
  })
  it('returns null for non-numeric input', () => {
    expect(parseLatLng('not coords')).toBeNull()
  })
  it('returns null for out-of-range values', () => {
    expect(parseLatLng('999, 999')).toBeNull()
  })
})
