import { describe, it, expect, vi } from 'vitest'
import {
  alatOmzet, alatBandingkan, alatMenuTerlaris, alatRankingOutlet, outletTerhitung,
  type KonteksPenjualan, type OutletInfo, type RingkasanLaporan,
} from './penjualan'

// Tipe per migration 20261003150000: outlet sungguhan = 'internal' | 'mitra'.
const OUTLETS: OutletInfo[] = [
  { id: 'o-beji', name: 'SUKA SHAWARMA BEJI', type: 'internal', is_active: true, slug: 'beji-depok' },
  { id: 'o-cbbr', name: 'MITRA CIBUBUR', type: 'mitra', is_active: true, slug: 'suka-shawarma-cibubur' },
  { id: 'o-jati', name: 'SUKA SHAWARMA JATIASIH', type: 'internal', is_active: false, slug: 'jatiasih-bekasi' },
  { id: 'o-tes', name: 'outlet tes', type: 'test', is_active: true, slug: 'outlet-tes' },
  { id: 'o-back', name: 'SS BACKUP', type: 'internal', is_active: true, slug: 'ss-backup' },
  { id: 'o-tesajah', name: 'tes ajah', type: 'internal', is_active: false, slug: 'tes-ajah' },
  { id: 'o-tessaja', name: 'tes saja', type: 'mitra', is_active: false, slug: 'tes-saja' },
  { id: 'o-shp', name: 'Shopee', type: 'marketplace', is_active: true, slug: 'shopee' },
]

// Omzet palsu per outlet per tanggal awal periode — cukup untuk menguji perakitan.
const OMZET: Record<string, Record<string, number>> = {
  '2026-09-30': { 'o-beji': 1_000_000, 'o-cbbr': 3_000_000, 'o-jati': 0 },
  '2026-09-23': { 'o-beji': 800_000, 'o-cbbr': 3_000_000, 'o-jati': 0 },
}

function konteks(): KonteksPenjualan & { panggilan: any[] } {
  const panggilan: any[] = []
  const ambilLaporan = vi.fn(async (r: { dari: string; sampai: string; outletIds: string[]; kanal: string[] }): Promise<RingkasanLaporan> => {
    panggilan.push(r)
    const peta = OMZET[r.dari] ?? {}
    const omzet = r.outletIds.reduce((s, id) => s + (peta[id] ?? 0), 0)
    return {
      omzetKotor: omzet, omzetBersih: omzet * 0.9, transaksi: omzet / 50_000,
      menu: [{ nama: 'Original Sapi Jumbo', qty: 30, omzet: 900_000 }, { nama: 'Extra Keju', qty: 2, omzet: 14_000 }, { nama: 'Original Ayam Jumbo', qty: 12, omzet: 300_000 }],
    }
  })
  return { ambilLaporan, outlets: OUTLETS, hariIni: '2026-10-01', sekarang: new Date('2026-10-01T07:30:00Z'), panggilan }
}

describe('outletTerhitung', () => {
  it('tipe internal & mitra, tanpa SS BACKUP dan outlet bernama tes/test (= valid_operational_outlets)', () => {
    expect(outletTerhitung(OUTLETS).map((o) => o.id)).toEqual(['o-beji', 'o-cbbr', 'o-jati'])
  })
  it('tipe lama "outlet" tidak lagi dihitung (sudah tak sah per CHECK constraint)', () => {
    expect(outletTerhitung([{ id: 'x', name: 'X', type: 'outlet', is_active: true }])).toEqual([])
  })
})

describe('alatOmzet', () => {
  it('semua outlet terhitung, omzet kotor, label & sumber', async () => {
    const ctx = konteks()
    const r: any = await alatOmzet(ctx, { periode: 'kemarin' })
    expect(ctx.panggilan[0]).toEqual({ dari: '2026-09-30', sampai: '2026-09-30', outletIds: ['o-beji', 'o-cbbr', 'o-jati'], kanal: ['all'] })
    expect(r).toMatchObject({ status: 'ok', omzet_kotor: 'Rp 4.000.000', omzet_kotor_angka: 4_000_000, transaksi: 80, sumber: 'Rangkuman Penjualan' })
    expect(r.periode).toBe('Kemarin (Rab 30 Sep 2026)')
    // Hitungan = outlet AKTIF (Jatiasih nonaktif tetap ikut dijumlah untuk periode lampau).
    expect(r.cakupan).toBe('Semua outlet (2 outlet aktif, tanpa SS Online)')
  })
  it('outlet tertentu + kanal', async () => {
    const ctx = konteks()
    const r: any = await alatOmzet(ctx, { periode: 'kemarin', outlet: 'beji', kanal: 'gofood' })
    expect(ctx.panggilan[0]).toMatchObject({ outletIds: ['o-beji'], kanal: ['gofood'] })
    expect(r).toMatchObject({ status: 'ok', cakupan: 'SUKA SHAWARMA BEJI', kanal: 'GoFood' })
  })
  it('outlet uji tidak bisa dipilih', async () => {
    const r: any = await alatOmzet(konteks(), { periode: 'kemarin', outlet: 'outlet tes' })
    expect(r.status).toBe('tidak_ditemukan')
  })
  it('periode berjalan diberi catatan jam', async () => {
    const r: any = await alatOmzet(konteks(), { periode: 'hari_ini' })
    expect(r.catatan).toBe('Angka berjalan sampai pukul 14:30 WIB.')
  })
})

describe('alatBandingkan', () => {
  it('pembanding otomatis = hari yang sama minggu lalu', async () => {
    const r: any = await alatBandingkan(konteks(), { periode: 'kemarin', outlet: 'beji' })
    expect(r).toMatchObject({
      status: 'ok',
      utama: { omzet_kotor: 'Rp 1.000.000' },
      pembanding: { omzet_kotor: 'Rp 800.000', periode: 'Rentang (Rab 23 Sep 2026)' },
      selisih: 'Rp 200.000',
      perubahan: '+25%',
    })
  })
  it('hari ini vs pembanding: diberi peringatan bahwa pembanding seharian penuh', async () => {
    const r: any = await alatBandingkan(konteks(), { periode: 'hari_ini' })
    expect(r.catatan).toContain('Angka berjalan sampai pukul 14:30 WIB.')
    expect(r.catatan).toContain('pembanding dihitung seharian penuh')
  })
})

describe('alatMenuTerlaris', () => {
  it('terlaris urut qty, dibatasi jumlah', async () => {
    const r: any = await alatMenuTerlaris(konteks(), { periode: 'kemarin', jumlah: 2 })
    expect(r.menu.map((m: any) => m.nama)).toEqual(['Original Sapi Jumbo', 'Original Ayam Jumbo'])
  })
  it('tersepi urut naik, hanya menu yang terjual', async () => {
    const r: any = await alatMenuTerlaris(konteks(), { periode: 'kemarin', urutan: 'tersepi', jumlah: 1 })
    expect(r.menu[0].nama).toBe('Extra Keju')
    expect(r.catatan).toContain('terjual minimal 1')
  })
})

describe('alatRankingOutlet', () => {
  it('urut omzet, outlet nonaktif tanpa omzet dibuang, perubahan vs minggu lalu', async () => {
    const r: any = await alatRankingOutlet(konteks(), { periode: 'kemarin' })
    expect(r.ranking.map((x: any) => [x.peringkat, x.nama, x.omzet, x.perubahan])).toEqual([
      [1, 'MITRA CIBUBUR', 'Rp 3.000.000', '0%'],
      [2, 'SUKA SHAWARMA BEJI', 'Rp 1.000.000', '+25%'],
    ])
  })
  it('hari ini: TIDAK dibandingkan otomatis (hari belum selesai)', async () => {
    const ctx = konteks()
    const r: any = await alatRankingOutlet(ctx, { periode: 'hari_ini' })
    expect(r.pembanding).toBeUndefined()
    expect(r.ranking.every((x: any) => x.perubahan === undefined)).toBe(true)
    expect(ctx.panggilan.every((p: any) => p.dari === '2026-10-01')).toBe(true)
  })
  it('hari ini: tetap bisa dibandingkan bila diminta eksplisit, dengan peringatan', async () => {
    const r: any = await alatRankingOutlet(konteks(), { periode: 'hari_ini', bandingkan: true })
    expect(r.pembanding).toBeDefined()
    expect(r.catatan).toContain('pembanding dihitung seharian penuh')
  })
})
