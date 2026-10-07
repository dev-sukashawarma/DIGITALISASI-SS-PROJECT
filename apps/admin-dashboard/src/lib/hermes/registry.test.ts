import { ALAT_HERMES, bangunAlatMcp, type KonteksHermes } from './registry'
import { DOMAIN } from './domain'
import { absensiPalsu, hrRinciPalsu } from './absensi/fixture'
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
const ctx: KonteksHermes = { penjualan, absensi: absensiPalsu, hrRinci: hrRinciPalsu, sekarang: penjualan.sekarang }

// §6 spec: pola yang tak boleh pernah muncul di output alat mana pun.
// Keputusan owner 2026-10-07: gaji & kasbon per orang BOLEH, tetapi hanya lewat alat domain 'hr_rinci'.
// kasbon_ringkasan (domain absensi) tetap agregat per outlet tanpa nama/id staf.
const TERLARANG_UMUM = [
  /\bnik\b|ktp/i,
  /face_descriptor|selfie|ref_photo_url|foto_wajah/i,
  /password|token|api_key|service_role/i,
  /(\+62|\b08)\d{8,12}\b/,
  /\b\d{16}\b/,
  /@[a-z0-9-]+\.[a-z]{2,}/i,
  /\breason\b|alasan/i,
  /rekening|no_rek|bank_account/i,
]
const KHUSUS_GAJI = /gaji|salary|payroll/i
const KHUSUS_KASBON = /kasbon|cash_advance/i
const terlarangUntuk = (nama: string) => {
  const def = ALAT_HERMES.find((a) => a.nama === nama)!
  if (def.domain === 'hr_rinci') return TERLARANG_UMUM
  return nama === 'kasbon_ringkasan' ? [...TERLARANG_UMUM, KHUSUS_GAJI] : [...TERLARANG_UMUM, KHUSUS_GAJI, KHUSUS_KASBON]
}

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
      for (const pola of terlarangUntuk(m.nama)) expect(teks, `${m.nama} cocok ${pola}`).not.toMatch(pola)
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
