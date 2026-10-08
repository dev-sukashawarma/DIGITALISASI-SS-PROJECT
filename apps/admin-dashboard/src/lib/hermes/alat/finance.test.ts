import { describe, it, expect } from 'vitest'
import { ALAT_FINANCE } from './finance'
import { financePalsu } from '../finance/fixture'
import type { KonteksHermes } from '../registry'

const ctx = {
  finance: financePalsu,
  sekarang: new Date('2026-10-07T03:00:00Z'),
} as unknown as KonteksHermes

const alat = (n: string) => ALAT_FINANCE.find((a) => a.nama === n)!
const jalan = (n: string, a: Record<string, unknown> = {}) => alat(n).jalankan(ctx, alat(n).skema.parse(a))

describe('utang_po', () => {
  it('default: utang PO diterima belum lunas & komitmen terpisah', async () => {
    const r: any = await jalan('utang_po')
    expect(r.status).toBe('ok')
    expect(r.per_tanggal).toBe('2026-10-07')
    expect(r.total_utang).toBe(950_000)
    expect(r.komitmen).toEqual({ total: 500_000, jumlah_po: 1 })
    expect(r.po).toHaveLength(1)
    expect(r.po[0]).toMatchObject({
      nomor_po: 'SPB/PO/X/2026/001',
      supplier: 'Altindo',
      nilai: 950_000,
    })
    expect(JSON.stringify(r)).not.toMatch(/password|token|rekening|bank_account/i)
  })

  it('filter jatuh_tempo_dalam_hari', async () => {
    const r: any = await jalan('utang_po', { jatuh_tempo_dalam_hari: 10 })
    expect(r.status).toBe('ok')
    expect(r.total_utang).toBe(950_000)
  })
})

describe('pengeluaran_ringkasan', () => {
  it('default bulan_ini: total, outlet vs pusat, per kategori', async () => {
    const r: any = await jalan('pengeluaran_ringkasan', { periode: 'bulan_ini' })
    expect(r.status).toBe('ok')
    expect(r.total).toBe(1_020_000)
    expect(r.outlet_total).toBe(120_000)
    expect(r.pusat_total).toBe(900_000)
    expect(r.per_kategori).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kategori: 'bahan_baku', total: 120_000 }),
        expect.objectContaining({ kategori: 'pengeluaran_global', total: 900_000 }),
      ]),
    )
    // Pengecualian: keterangan bebas & receipt_url tidak keluar
    const teks = JSON.stringify(r)
    expect(teks).not.toMatch(/beli bawang|sewa kantor|nota\.jpg/i)
    expect(teks).not.toMatch(/description|receipt_url/i)
  })

  it('filter outlet yang valid', async () => {
    const r: any = await jalan('pengeluaran_ringkasan', { periode: 'bulan_ini', outlet: 'empang' })
    expect(r.status).toBe('ok')
    expect(r.total).toBe(120_000)
    expect(r.outlet_total).toBe(120_000)
    expect(r.pusat_total).toBe(0)
  })

  it('outlet tak dikenal mengembalikan galat', async () => {
    const r: any = await jalan('pengeluaran_ringkasan', { periode: 'bulan_ini', outlet: 'surabaya' })
    expect(r.status).toBe('galat')
  })
})

describe('setoran_ringkasan', () => {
  it('default bulan_ini: setoran tercatat per tanggal jual', async () => {
    const r: any = await jalan('setoran_ringkasan', { periode: 'bulan_ini' })
    expect(r.status).toBe('ok')
    expect(r.total).toBe(430_000)
    expect(r.per_outlet).toEqual([{ outlet: 'MITRA CIBINONG', total: 430_000, jumlah: 1 }])
    expect(r.setoran).toEqual([
      { outlet: 'MITRA CIBINONG', tanggal_jual: '2026-10-01', nominal: 430_000, jenis: 'Setoran Bank' },
    ])
  })
})

describe('selisih_kasir', () => {
  it('default kemarin: selisih uang fisik vs seharusnya dan shift belum tutup', async () => {
    const r: any = await jalan('selisih_kasir')
    expect(r.status).toBe('ok')
    expect(r.total_selisih).toBe(-20_000)
    expect(r.shift_selisih).toHaveLength(1)
    expect(r.shift_selisih[0]).toMatchObject({
      outlet: 'SUKA SHAWARMA EMPANG',
      kasir: 'Andi',
      seharusnya: 1_500_000,
      fisik: 1_480_000,
      selisih: -20_000,
    })
    expect(r.shift_belum_tutup).toHaveLength(1)
    expect(r.shift_belum_tutup[0]).toMatchObject({
      outlet: 'MITRA CIBINONG',
      kasir: 'Budi',
    })
  })
})
