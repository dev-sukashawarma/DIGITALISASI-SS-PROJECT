import { describe, it, expect } from 'vitest'
import { ALAT_ABSENSI } from './absensi'
import { absensiPalsu } from '../absensi/fixture'
import type { KonteksHermes } from '../registry'

const ctx = { absensi: absensiPalsu, sekarang: absensiPalsu.sekarang } as unknown as KonteksHermes
const alat = (n: string) => ALAT_ABSENSI.find((a) => a.nama === n)!
const jalan = (n: string, a: Record<string, unknown> = {}) => alat(n).jalankan(ctx, alat(n).skema.parse(a))

describe('absensi_hari_ini', () => {
  it('ringkas per outlet + daftar telat/belum/alpa (nama & menit), tanpa yang hadir tepat', async () => {
    const r: any = await jalan('absensi_hari_ini')
    expect(r.status).toBe('ok')
    expect(r.tanggal).toBe('2026-10-07')
    expect(r.total).toEqual({ hadir: 2, telat: 1, telat_toleransi: 1, belum: 1, alpa: 1, staf: 6 })
    const empang = r.outlet.find((o: any) => o.outlet === 'SUKA SHAWARMA EMPANG')
    expect(empang.telat).toEqual([{ nama: 'Budi', menit: 40, jam: '13.40' }])
    expect(empang.telat_toleransi).toEqual([{ nama: 'Gina', menit: 5, jam: '13.05' }])
    expect(empang.belum_hadir).toEqual(['Cici'])
    expect(empang.alpa).toEqual(['Dedi'])
    expect(JSON.stringify(r)).not.toContain('Andi')
  })
  it('filter outlet & outlet tak dikenal = galat', async () => {
    const r: any = await jalan('absensi_hari_ini', { outlet: 'kantor' })
    expect(r.outlet.map((o: any) => o.outlet)).toEqual(['Kantor Pusat'])
    expect(await jalan('absensi_hari_ini', { outlet: 'bekasi' })).toMatchObject({ status: 'galat' })
  })
})

describe('diambil_pukul_wib & petunjuk_tampilan', () => {
  it('semua alat membawa jam WIB (UTC+7), bukan UTC', async () => {
    for (const a of ALAT_ABSENSI) {
      const r: any = await jalan(a.nama)
      expect(r.diambil_pukul_wib).toBe('14.00 WIB')
    }
  })
  it('hari_ini & rekap punya petunjuk tampilan', async () => {
    expect(((await jalan('absensi_hari_ini')) as any).petunjuk_tampilan).toContain('suka-ui')
    expect(((await jalan('absensi_rekap')) as any).petunjuk_tampilan).toContain('suka-ui')
  })
})

describe('absensi_rekap & telat bulan ini', () => {
  it('rekap per outlet: hari dinilai, total telat, total alpa (aturan Rekap)', async () => {
    const r: any = await jalan('absensi_rekap', { dari: '2026-10-01', sampai: '2026-10-07' })
    expect(r.hari_dinilai).toBe(7)
    const empang = r.outlet.find((o: any) => o.outlet === 'SUKA SHAWARMA EMPANG')
    expect(empang).toMatchObject({ staf: 2, telat: 3, telat_toleransi: 1, alpa: 2 })
  })
  it('rentang > 62 hari ditolak skema', () => {
    expect(alat('absensi_rekap').skema.safeParse({ dari: '2026-01-01', sampai: '2026-10-07' }).success).toBe(false)
  })
  it('telat bulan ini: per orang, urut telat terbanyak, hanya yang telat/alpa', async () => {
    const r: any = await jalan('absensi_telat_bulan_ini')
    expect(r.dari).toBe('2026-10-01')
    expect(r.sampai).toBe('2026-10-07')
    expect(r.orang[0]).toEqual({ nama: 'Budi', outlet: 'SUKA SHAWARMA EMPANG', telat: 3, telat_toleransi: 0, menit_telat: 95, alpa: 2 })
    expect(r.orang.find((o: any) => o.nama === 'Eka')).toBeUndefined()
  })
})

describe('cuti_izin', () => {
  it('siapa cuti pada tanggal itu (disetujui) + pengajuan menunggu; tanpa alasan', async () => {
    const r: any = await jalan('cuti_izin', { tanggal: '2026-10-07' })
    expect(r.sedang_cuti).toEqual([{ nama: 'Cici', outlet: 'SUKA SHAWARMA EMPANG', jenis: 'Cuti Tahunan', mulai: '2026-10-06', selesai: '2026-10-08', hari: 3 }])
    expect(r.menunggu).toEqual([{ nama: 'Budi', outlet: 'SUKA SHAWARMA EMPANG', jenis: 'Sakit', mulai: '2026-10-09', selesai: '2026-10-09', hari: 1 }])
  })
})

describe('kasbon_ringkasan', () => {
  it('per outlet: aktif & menunggu (jumlah + nominal), total, tanpa nama', async () => {
    const r: any = await jalan('kasbon_ringkasan')
    expect(r.outlet).toEqual([{ outlet: 'SUKA SHAWARMA EMPANG', menunggu_jumlah: 2, menunggu_nominal: 750_000, aktif_jumlah: 3, aktif_sisa: 1_200_000 }])
    expect(r.total).toEqual({ menunggu_jumlah: 2, menunggu_nominal: 750_000, aktif_jumlah: 3, aktif_sisa: 1_200_000 })
  })
})

describe('ceklist_kepatuhan', () => {
  it('sudah/belum dicek per lokasi, nilai terburuk, jumlah temuan, status tinjau', async () => {
    const r: any = await jalan('ceklist_kepatuhan')
    expect(r.ringkas).toEqual({ lokasi: 2, sudah_dicek: 1, belum_dicek: 1, perlu_perhatian: 1, belum_ditinjau: 1 })
    expect(r.outlet).toEqual([
      { outlet: 'SUKA SHAWARMA EMPANG', status: 'sudah_dicek', area_manager: 'Fajar', nilai: 'perhatian', jumlah_temuan: 2, ditinjau: false },
      { outlet: 'Kantor Pusat', status: 'belum_dicek' },
    ])
  })
})
