import { readFileSync } from 'fs'
import { resolve } from 'path'

// compute.ts di finance adalah SALINAN rumus Rangkuman Penjualan admin-dashboard.
// Kalau salah satu diubah tanpa yang lain, angka EOM finance tak lagi sama dengan
// laporan — tes ini gagal supaya keduanya diubah bersamaan.
describe('posReport/compute.ts', () => {
  it('identik dengan apps/admin-dashboard/src/lib/posReport/compute.ts', () => {
    const norm = (p: string) => readFileSync(p, 'utf8').replace(/\r\n/g, '\n')
    const finance = norm(resolve(__dirname, 'compute.ts'))
    const admin = norm(resolve(__dirname, '../../../../admin-dashboard/src/lib/posReport/compute.ts'))
    expect(finance).toBe(admin)
  })
})
