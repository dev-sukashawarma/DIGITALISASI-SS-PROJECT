import { describe, it, expect } from 'vitest'
import { periksaSplash, barisSplash } from './splashForm'

describe('periksaSplash', () => {
  it('menerima gambar https dan durasi 1-5 detik', () => {
    expect(periksaSplash({ gambarUrl: 'https://x/s.webp', durasiMs: 3000 })).toBeNull()
    expect(periksaSplash({ gambarUrl: 'https://x/s.webp', durasiMs: 1000 })).toBeNull()
    expect(periksaSplash({ gambarUrl: 'https://x/s.webp', durasiMs: 5000 })).toBeNull()
  })

  it('menerima gambar kosong (pakai bawaan APK)', () => {
    expect(periksaSplash({ gambarUrl: '', durasiMs: 3000 })).toBeNull()
  })

  it('menolak durasi di luar 1-5 detik', () => {
    expect(periksaSplash({ gambarUrl: '', durasiMs: 999 })).not.toBeNull()
    expect(periksaSplash({ gambarUrl: '', durasiMs: 5001 })).not.toBeNull()
  })

  it('menolak durasi bukan bilangan bulat', () => {
    expect(periksaSplash({ gambarUrl: '', durasiMs: 2500.5 })).not.toBeNull()
    expect(periksaSplash({ gambarUrl: '', durasiMs: Number.NaN })).not.toBeNull()
  })

  it('menolak alamat selain https', () => {
    expect(periksaSplash({ gambarUrl: 'http://x/s.jpg', durasiMs: 3000 })).not.toBeNull()
  })
})

describe('barisSplash', () => {
  it('gambar kosong atau spasi disimpan sebagai null', () => {
    expect(barisSplash({ gambarUrl: '  ', durasiMs: 3000 }).gambar_url).toBeNull()
  })

  it('merapikan spasi di alamat gambar', () => {
    expect(barisSplash({ gambarUrl: ' https://x/s.webp ', durasiMs: 2000 })).toMatchObject({
      gambar_url: 'https://x/s.webp',
      durasi_ms: 2000,
    })
  })
})
