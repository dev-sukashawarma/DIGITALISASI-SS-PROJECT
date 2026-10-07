import { describe, it, expect } from 'vitest'
import { ALAT_HR_RINCI } from './hrRinci'
import { absensiPalsu, hrRinciPalsu } from '../absensi/fixture'
import { statusKasbon } from '../server/hrRinciSumber'
import type { KonteksHermes } from '../registry'

const ctx = { absensi: absensiPalsu, hrRinci: hrRinciPalsu, sekarang: absensiPalsu.sekarang } as unknown as KonteksHermes
const alat = (n: string) => ALAT_HR_RINCI.find((a) => a.nama === n)!
const jalan = (n: string, a: Record<string, unknown> = {}) => alat(n).jalankan(ctx, alat(n).skema.parse(a))

describe('kasbon_daftar', () => {
  it('default = menunggu + aktif, per orang, dengan total', async () => {
    const r: any = await jalan('kasbon_daftar')
    expect(r.kasbon.map((k: any) => k.id).sort()).toEqual(['k1', 'k2', 'k5'])
    expect(r.total).toEqual({ jumlah: 3, nominal: 1_900_000, sisa: 1_500_000 })
    expect(r.kasbon[0]).toHaveProperty('nama')
    expect(JSON.stringify(r)).not.toMatch(/reason|alasan/i)
  })
  it('filter status & outlet', async () => {
    expect(((await jalan('kasbon_daftar', { status: 'lunas' })) as any).kasbon.map((k: any) => k.id)).toEqual(['k3'])
    expect(((await jalan('kasbon_daftar', { status: 'semua' })) as any).kasbon).toHaveLength(5)
    expect(((await jalan('kasbon_daftar', { status: 'semua', outlet: 'kantor' })) as any).kasbon.map((k: any) => k.outlet)).toEqual(['Kantor Pusat', 'Kantor Pusat'])
    expect(await jalan('kasbon_daftar', { outlet: 'bekasi' })).toMatchObject({ status: 'galat' })
  })
})

describe('statusKasbon = layar HR', () => {
  it('pemetaan', () => {
    expect(statusKasbon(null, 'active')).toBe('menunggu')
    expect(statusKasbon('pending', 'pending')).toBe('menunggu')
    expect(statusKasbon('pending', 'paid_off')).toBe('lunas')
    expect(statusKasbon('approved', 'active')).toBe('aktif')
    expect(statusKasbon('rejected', 'rejected')).toBe('ditolak')
    expect(statusKasbon('approved', 'pending')).toBeNull()
  })
})

describe('gaji_daftar', () => {
  it('default bulan WIB berjalan, baris per orang + total', async () => {
    const r: any = await jalan('gaji_daftar')
    expect(r).toMatchObject({ bulan: 10, tahun: 2026 })
    expect(r.gaji).toHaveLength(2)
    expect(r.total).toMatchObject({ jumlah: 2, total: 7_400_000 })
    expect(JSON.stringify(r)).not.toMatch(/rekening|bank|phone|note/i)
  })
  it('skema menolak bulan di luar 1-12', () => {
    expect(alat('gaji_daftar').skema.safeParse({ bulan: 13 }).success).toBe(false)
  })
})
