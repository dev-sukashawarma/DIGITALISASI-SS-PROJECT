import { ALAT_HERMES, bangunAlatMcp, type KonteksHermes } from './registry'
import { DOMAIN } from './domain'
import { polaTerlarang } from './pengecualian'
import { absensiPalsu, hrRinciPalsu } from './absensi/fixture'
import { financePalsu } from './finance/fixture'
import { stokPalsu } from './stok/fixture'
import { sistemPalsu } from './sistem/fixture'
import { reviewPalsu } from './review/fixture'
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
  auditVoid: async () => ({
    rentang_hari: 1,
    total_void: 0,
    total_nilai_void: 0,
    daftar_void: [],
  }),
  statusBuka: async () => ({
    tanggal: '2026-10-07',
    total_outlet_aktif: 2,
    total_sudah_buka: 2,
    total_belum_buka: 0,
    daftar_belum_buka: [],
    daftar_sudah_buka: [
      { outlet: 'SUKA SHAWARMA EMPANG', jam_buka: '10:00' },
      { outlet: 'MITRA CIBINONG', jam_buka: '10:30' },
    ],
  }),
}
const ctx: KonteksHermes = { penjualan, absensi: absensiPalsu, hrRinci: hrRinciPalsu, finance: financePalsu, stok: stokPalsu, sistem: sistemPalsu, review: reviewPalsu, sekarang: penjualan.sekarang }

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
    expect(r.ok && String(r.data.teks)).toContain('LAPORAN PENJUALAN HARIAN')
  })
  it('laporan_penutupan_malam mengembalikan teks template', async () => {
    const r = await cari('laporan_penutupan_malam').jalankan({ tanggal: '2026-10-07' })
    expect(r.ok && String(r.data.teks)).toContain('LAPORAN CLOSING PENJUALAN')
  })
  it('laporan_absensi_harian mengembalikan teks template', async () => {
    const r = await cari('laporan_absensi_harian').jalankan({ tanggal: '2026-10-07' })
    expect(r.ok && String(r.data.teks)).toContain('Rekap Presensi Kru')
  })
  it('stok_bahan mengembalikan data saldo dan lolos gerbang', async () => {
    const r = await cari('stok_bahan').jalankan({ bahan: 'sapi' })
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.data.bahan).toBe('SAPI')
      expect(Array.isArray(r.data.lokasi)).toBe(true)
    }
  })
  it('stok_surat_jalan mengembalikan daftar pengiriman', async () => {
    const r = await cari('stok_surat_jalan').jalankan({ status: 'dikirim' })
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.data.total).toBe(1)
    }
  })
  it('stok_opname mengembalikan riwayat opname tanpa identitas staf', async () => {
    const r = await cari('stok_opname').jalankan({ hari: 30, limit: 20 })
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.data.daftar).toEqual([{ outlet: 'SUKA SHAWARMA EMPANG', tanggal: '2026-10-06', status: 'finalized', tipe: 'harian' }])
      expect(JSON.stringify(r.data)).not.toMatch(/created_by|staff_id|nama_staf/i)
    }
  })
  it('stok_permintaan_bahan mengembalikan status ringkas tanpa catatan atau identitas', async () => {
    const r = await cari('stok_permintaan_bahan').jalankan({ hari: 30, limit: 20 })
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.data.daftar).toEqual([{ outlet: 'SUKA SHAWARMA EMPANG', tanggal: '2026-10-06', status: 'menunggu' }])
      expect(JSON.stringify(r.data)).not.toMatch(/catatan|dibuat_oleh|staff_id/i)
    }
  })
  it('stok_waste mengembalikan data waste bahan baku', async () => {
    const r = await cari('stok_waste').jalankan({ hari: 30, limit: 5 })
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.data.status).toBe('ok')
      expect(r.data.total_laporan).toBe(15)
      expect(Array.isArray(r.data.top_bahan)).toBe(true)
    }
  })
  it('penjualan_void mengembalikan data pembatalan transaksi POS', async () => {
    const r = await cari('penjualan_void').jalankan({ hari: 1, limit: 10 })
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.data.status).toBe('ok')
      expect(r.data.total_void).toBe(0)
    }
  })
  it('penjualan_status_buka mengembalikan status operasional shift cabang', async () => {
    const r = await cari('penjualan_status_buka').jalankan({})
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.data.status).toBe('ok')
      expect(r.data.total_sudah_buka).toBe(2)
      expect(Array.isArray(r.data.daftar_sudah_buka)).toBe(true)
    }
  })
  it('sistem_status mengembalikan status operasional sistem', async () => {
    const r = await cari('sistem_status').jalankan({})
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.data.status).toBe('ok')
      expect(r.data.database).toBe('terhubung')
      expect(r.data.modul_aktif).toContain('review')
    }
  })
  it('review_ranking_outlet mengembalikan ranking rating cabang Google Maps', async () => {
    const r = await cari('review_ranking_outlet').jalankan({})
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.data.status).toBe('ok')
      expect(r.data.total_outlet).toBe(3)
      expect(Array.isArray(r.data.peringkat)).toBe(true)
      expect((r.data.peringkat as any[])[0].outlet).toBe('SUKA SHAWARMA EMPANG')
    }
  })
  it('review_negatif_terbaru mengembalikan daftar keluhan pelanggan', async () => {
    const r = await cari('review_negatif_terbaru').jalankan({ limit: 5 })
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.data.status).toBe('ok')
      expect(r.data.total_ulasan_negatif).toBe(2)
      expect(Array.isArray(r.data.daftar_ulasan)).toBe(true)
      expect((r.data.daftar_ulasan as any[])[0].reviewer).toBe('Dewi Lestari')
    }
  })
  it('review_sentimen_ringkasan mengembalikan persentase dan topik keluhan', async () => {
    const r = await cari('review_sentimen_ringkasan').jalankan({ rentang_hari: 30 })
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.data.status).toBe('ok')
      expect(r.data.total_ulasan).toBe(4)
      expect((r.data.sentimen as any).positif.persen).toBeGreaterThan(0)
      expect(Array.isArray(r.data.topik_keluhan_utama)).toBe(true)
    }
  })
  it('review_alert_aktif mengembalikan daftar alert ulasan aktif', async () => {
    const r = await cari('review_alert_aktif').jalankan({})
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.data.status).toBe('ok')
      expect(r.data.total_alert_aktif).toBe(2)
      expect(Array.isArray(r.data.daftar_alert)).toBe(true)
    }
  })
})
