import { describe, expect, it } from 'vitest'
import { bolehVideo } from './modeTampil'

const normal = { kurangiGerak: false, hematData: false, videoGagal: false }

describe('bolehVideo', () => {
  it('video bila tidak ada hambatan', () => {
    expect(bolehVideo(normal)).toBe(true)
  })
  it('selalu gambar bila animasi dimatikan, hemat data, atau video pernah gagal', () => {
    expect(bolehVideo({ ...normal, kurangiGerak: true })).toBe(false)
    expect(bolehVideo({ ...normal, hematData: true })).toBe(false)
    expect(bolehVideo({ ...normal, videoGagal: true })).toBe(false)
  })
})
