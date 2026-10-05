import { describe, expect, it } from 'vitest'
import { AWAL, langkah, type KeadaanPutar, type Kejadian } from './rencanaPutar'

const jalankan = (...kejadian: Kejadian[]): KeadaanPutar => kejadian.reduce(langkah, AWAL)
const pose = (p: 'diam' | 'berpikir' | 'rekap' | 'bingung'): Kejadian => ({ jenis: 'pose', pose: p })
const klik: Kejadian = { jenis: 'klik' }
const selesai = (klip: KeadaanPutar['klip']): Kejadian => ({ jenis: 'selesai', klip })

describe('rencanaPutar', () => {
  it('pose awal diam memutar diam berulang', () => {
    expect(jalankan(pose('diam'))).toEqual({ pose: 'diam', klip: 'diam', sekali: false })
  })

  it('pose rekap yang bertahan hanya melambai sekali', () => {
    const s = jalankan(pose('rekap'), selesai('rekap'), pose('rekap'), pose('rekap'))
    expect(s).toEqual({ pose: 'rekap', klip: 'diam', sekali: false })
  })

  it('rekap baru saat diam melambai sekali lagi', () => {
    expect(jalankan(pose('diam'), pose('rekap'))).toEqual({ pose: 'rekap', klip: 'rekap', sekali: true })
  })

  it('berpikir memotong lambaian yang sedang main', () => {
    expect(jalankan(pose('rekap'), pose('berpikir'))).toEqual({ pose: 'berpikir', klip: 'berpikir', sekali: false })
  })

  it('jawaban datang: keluar dari berpikir segera', () => {
    expect(jalankan(pose('berpikir'), pose('diam'))).toEqual({ pose: 'diam', klip: 'diam', sekali: false })
  })

  it('galat setelah berpikir: bingung sekali lalu diam', () => {
    const s = jalankan(pose('berpikir'), pose('bingung'))
    expect(s).toEqual({ pose: 'bingung', klip: 'bingung', sekali: true })
    expect(langkah(s, selesai('bingung'))).toEqual({ pose: 'bingung', klip: 'diam', sekali: false })
  })

  it('klik saat diam memutar sapa, klik beruntun diabaikan, lalu kembali ke diam', () => {
    const s = jalankan(pose('diam'), klik)
    expect(s).toEqual({ pose: 'diam', klip: 'sapa', sekali: true })
    expect(langkah(s, klik)).toBe(s)
    expect(langkah(s, selesai('sapa'))).toEqual({ pose: 'diam', klip: 'diam', sekali: false })
  })

  it('klik saat berpikir diabaikan', () => {
    const s = jalankan(pose('berpikir'))
    expect(langkah(s, klik)).toBe(s)
  })

  it('klik saat rekap sedang main diabaikan', () => {
    const s = jalankan(pose('rekap'))
    expect(langkah(s, klik)).toBe(s)
  })

  it('rekap tidak menyela bingung (prioritas lebih rendah)', () => {
    const s = jalankan(pose('bingung'), pose('rekap'))
    expect(s).toEqual({ pose: 'rekap', klip: 'bingung', sekali: true })
    expect(langkah(s, selesai('bingung'))).toEqual({ pose: 'rekap', klip: 'diam', sekali: false })
  })

  it('rekap menyela sapa (prioritas lebih tinggi)', () => {
    expect(jalankan(pose('diam'), klik, pose('rekap'))).toEqual({ pose: 'rekap', klip: 'rekap', sekali: true })
  })

  it('pose diam saat rekap main: rekap dituntaskan dulu', () => {
    const s = jalankan(pose('rekap'), pose('diam'))
    expect(s).toEqual({ pose: 'diam', klip: 'rekap', sekali: true })
    expect(langkah(s, selesai('rekap'))).toEqual({ pose: 'diam', klip: 'diam', sekali: false })
  })

  it('selesai dari klip lain (basi) atau saat klip berulang diabaikan', () => {
    const s = jalankan(pose('rekap'), pose('berpikir'))
    expect(langkah(s, selesai('rekap'))).toBe(s)
    const t = jalankan(pose('bingung'))
    expect(langkah(t, selesai('rekap'))).toBe(t)
  })
})
