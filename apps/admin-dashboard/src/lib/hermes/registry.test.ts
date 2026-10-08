import { ALAT_HERMES, bangunAlatMcp, type KonteksHermes } from './registry'
import { DOMAIN } from './domain'
import { polaTerlarang } from './pengecualian'
import { absensiPalsu, hrRinciPalsu } from './absensi/fixture'
import { financePalsu } from './finance/fixture'
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
const ctx: KonteksHermes = { penjualan, absensi: absensiPalsu, hrRinci: hrRinciPalsu, finance: financePalsu, sekarang: penjualan.sekarang }

// §6 spec: pola larangan data per app ada di ./pengecualian (satu sumber, juga dipakai alat baru).

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
      for (const pola of polaTerlarang(m.nama, def.domain)) expect(teks, `${m.nama} cocok ${pola}`).not.toMatch(pola)
      if (r.ok) {
        expect(typeof (r.data.meta as any).sumber).toBe('string')
        expect(['lengkap', 'sebagian']).toContain((r.data.meta as any).kelengkapan)
      }
    }
  })
  it('GERBANG §6: kasbon_ringkasan tanpa nama/id staf', async () => {
    const r = await cari('kasbon_ringkasan').jalankan({})
    expect(r.ok).toBe(true)
    const teks = JSON.stringify(r)
    for (const kata of ['Andi', 'Budi', 'Cici', 'Dedi', 'Eka', 's1', 's2', 'staff_id', 'staffId', '"nama"']) expect(teks).not.toContain(kata)
  })
  it('GERBANG §6: alat non-hr_rinci tak membocorkan gaji/kasbon per orang', async () => {
    for (const m of bangunAlatMcp(async () => ctx)) {
      const def = ALAT_HERMES.find((a) => a.nama === m.nama)!
      if (def.domain === 'hr_rinci' || m.nama === 'kasbon_ringkasan') continue
      const teks = JSON.stringify(await m.jalankan(def.contoh))
      expect(teks, m.nama).not.toMatch(/gaji|salary|payroll|kasbon|cash_advance/i)
    }
  })
  it('alat hr_rinci hanya berdomain hr_rinci', () => {
    for (const n of ['kasbon_daftar', 'gaji_daftar']) expect(ALAT_HERMES.find((a) => a.nama === n)!.domain).toBe('hr_rinci')
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
