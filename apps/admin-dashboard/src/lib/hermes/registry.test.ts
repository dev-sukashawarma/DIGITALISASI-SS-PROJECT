import { ALAT_HERMES, bangunAlatMcp, type KonteksHermes } from './registry'
import { DOMAIN } from './domain'
import type { KonteksPenjualan, OutletInfo } from '@/lib/sukaBot/alat/penjualan'

const outlets: OutletInfo[] = [
  { id: 'o1', name: 'SUKA SHAWARMA EMPANG', type: 'internal', is_active: true, slug: 'empang' },
  { id: 'o2', name: 'MITRA CIBINONG', type: 'mitra', is_active: true, slug: 'cibinong' },
  { id: 'o3', name: 'outlet tes', type: 'test', is_active: true, slug: 'tes' },
]
const penjualan: KonteksPenjualan = {
  outlets,
  hariIni: '2026-10-07',
  sekarang: new Date('2026-10-07T03:00:00Z'),
  ambilLaporan: async ({ outletIds }) => ({
    omzetKotor: 1_000_000 * outletIds.length, omzetBersih: 900_000 * outletIds.length, transaksi: 10 * outletIds.length,
    menu: [{ nama: 'Original Sapi Jumbo', qty: 5, omzet: 300_000 }],
  }),
}
const ctx: KonteksHermes = { penjualan, sekarang: penjualan.sekarang }

// §6 spec: pola yang tak boleh pernah muncul di output alat mana pun.
const TERLARANG = [
  /gaji|salary|kasbon|cash_advance|payroll/i,
  /\bnik\b|ktp/i,
  /face_descriptor|selfie|ref_photo_url|foto_wajah/i,
  /password|token|api_key|service_role/i,
  /(\+62|\b08)\d{8,12}\b/,
  /\b\d{16}\b/,
  /@[a-z0-9-]+\.[a-z]{2,}/i,
]

const cari = (nama: string) => bangunAlatMcp(async () => ctx).find((m) => m.nama === nama)!

describe('registry alat Hermes', () => {
  it('nama unik, domain sah, deskripsi terisi, contoh argumen lolos skema', () => {
    const nama = ALAT_HERMES.map((a) => a.nama)
    expect(new Set(nama).size).toBe(nama.length)
    for (const a of ALAT_HERMES) {
      expect(DOMAIN).toContain(a.domain)
      expect(a.deskripsi.length).toBeGreaterThan(20)
      expect(a.skema.safeParse(a.contoh).success).toBe(true)
    }
  })
  it('skema JSON tiap alat = object tanpa $schema', () => {
    for (const m of bangunAlatMcp(async () => ctx)) {
      expect(m.skemaInput.type).toBe('object')
      expect(m.skemaInput).not.toHaveProperty('$schema')
    }
  })
  it('argumen salah → ok:false dengan pesan, bukan exception', async () => {
    const r = await cari('penjualan_ringkasan').jalankan({ periode: 'kemarin_lusa' })
    expect(r.ok).toBe(false)
  })
  it('sumber data gagal → ok:false "Data tidak tersedia", bukan angka 0', async () => {
    const rusak: KonteksHermes = { ...ctx, penjualan: { ...penjualan, ambilLaporan: async () => { throw new Error('timeout') } } }
    const r = await bangunAlatMcp(async () => rusak).find((m) => m.nama === 'penjualan_ringkasan')!.jalankan({ periode: 'kemarin' })
    expect(r).toEqual({ ok: false, pesan: 'Data tidak tersedia: timeout' })
  })
  it('GERBANG §6: output setiap alat bebas data terlarang & membawa meta', async () => {
    for (const m of bangunAlatMcp(async () => ctx)) {
      const def = ALAT_HERMES.find((a) => a.nama === m.nama)!
      const r = await m.jalankan(def.contoh)
      expect(r.ok, m.nama).toBe(true)
      const teks = JSON.stringify(r)
      for (const pola of TERLARANG) expect(teks, `${m.nama} cocok ${pola}`).not.toMatch(pola)
      if (r.ok) {
        expect(r.data.meta).toMatchObject({ sumber: 'Rangkuman Penjualan' })
        expect(['lengkap', 'sebagian']).toContain((r.data.meta as any).kelengkapan)
      }
    }
  })
  it('outlet tes tidak pernah ikut peringkat', async () => {
    const r = await cari('penjualan_peringkat_outlet').jalankan({ periode: 'kemarin' })
    expect(JSON.stringify(r)).not.toContain('outlet tes')
  })
  it('laporan_pagi_ceo mengembalikan teks template', async () => {
    const r = await cari('laporan_pagi_ceo').jalankan({ tanggal: '2026-10-06' })
    expect(r.ok && String(r.data.teks)).toContain('Laporan Pagi')
  })
})
