import { readFileSync } from 'fs'
import { resolve } from 'path'

// File closing di finance adalah SALINAN admin-dashboard. Kalau salah satu diubah
// tanpa yang lain, Buku Kas finance tak lagi sama dengan Laba Rugi — tes ini gagal.
const FILES = ['opexClosingInternalSeptember2026.ts', 'terapkanClosingOpex.ts', 'targetKartuClosing.ts']

describe('lib/closing identik dengan admin-dashboard', () => {
  it.each(FILES)('%s', (f) => {
    const norm = (p: string) => readFileSync(p, 'utf8').replace(/\r\n/g, '\n')
    const finance = norm(resolve(__dirname, f))
    const admin = norm(resolve(__dirname, '../../../../admin-dashboard/src/lib/closing', f))
    expect(finance).toBe(admin)
  })
})
