import { describe, expect, it } from 'vitest'
import { bolehVideo, pilihFormat } from './modeTampil'

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

const UA = {
  chromeWin: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36',
  edge: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36 Edg/129.0.0.0',
  firefox: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:131.0) Gecko/20100101 Firefox/131.0',
  android: 'Mozilla/5.0 (Linux; Android 14; SM-A546E) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Mobile Safari/537.36',
  iphoneSafari: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1',
  iphoneChrome: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/129.0.6668.69 Mobile/15E148 Safari/604.1',
  macSafari: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15',
  macChrome: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36',
}

describe('pilihFormat', () => {
  it('WebM transparan untuk Chromium & Firefox (desktop dan Android)', () => {
    for (const ua of [UA.chromeWin, UA.edge, UA.firefox, UA.android, UA.macChrome]) expect(pilihFormat(ua, 0)).toBe('webm')
  })
  it('WebP beranimasi untuk semua browser iPhone dan Safari Mac', () => {
    expect(pilihFormat(UA.iphoneSafari, 5)).toBe('webp')
    expect(pilihFormat(UA.iphoneChrome, 5)).toBe('webp')
    expect(pilihFormat(UA.macSafari, 0)).toBe('webp')
  })
  it('iPad yang mengaku Macintosh (punya layar sentuh) dapat WebP', () => {
    expect(pilihFormat(UA.macSafari, 5)).toBe('webp')
    expect(pilihFormat(UA.macChrome.replace('Chrome/129.0.0.0 ', 'CriOS/129.0 '), 5)).toBe('webp')
  })
})
