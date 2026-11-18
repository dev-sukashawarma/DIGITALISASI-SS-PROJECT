import { describe, it, expect } from 'vitest'
import { prosesUnggahXendit, type DbXendit, type BarisDb } from './unggah'
import { isPesananWebsite } from './website'
import type { BarisXendit } from './balanceHistory'

const wib = (s: string) => new Date(`${s}+07:00`).toISOString()

function dbPalsu(awal: BarisDb[], pesanan: { external_order_id: string; total_amount: number; created_at: string; outlet_id: string; sales_source: string }[]) {
  const tabel = new Map(awal.map(r => [r.xendit_id, { ...r }]))
  const db: DbXendit = {
    async ambilPembayaran(ids) { return ids.flatMap(id => (tabel.has(id) ? [tabel.get(id)!] : [])) },
    async sisipkan(rows) { rows.forEach(r => { if (tabel.has(r.xendit_id)) throw new Error('dobel'); tabel.set(r.xendit_id, { ...r }) }) },
    async perbarui(rows) { rows.forEach(r => tabel.set(r.xendit_id, { ...tabel.get(r.xendit_id)!, ...r })) },
    async ambilPesananWebsite() { return pesanan },
    async externalTertaut(ids) { return new Set([...tabel.values()].map(r => r.external_order_id).filter((x): x is string => !!x && ids.includes(x))) },
    async tautkan(rows) { rows.forEach(r => tabel.set(r.xendit_id, { ...tabel.get(r.xendit_id)!, ...r })) },
    async perbaruiBiaya(rows) { rows.forEach(r => tabel.set(r.xendit_id, { ...tabel.get(r.xendit_id)!, ...r })) },
  }
  return { db, tabel }
}

const b = (xenditId: string, nominal: number, jam: string, extra: Partial<BarisXendit> = {}): BarisXendit => ({
  xenditId, xenditRef: 'ref-' + xenditId, refQris: 'rrn-' + xenditId, nominal, dibayarAt: wib(jam), channel: 'QRIS', bukanPenjualan: false, ...extra,
})
const meta = { namaFile: 'okt.csv', userId: 'u1' }

describe('prosesUnggahXendit', () => {
  it('mencocokkan lewat nominal+jam dan menghitung ringkasan', async () => {
    const { db, tabel } = dbPalsu([], [
      { external_order_id: '22a1629a-373f-4d3c-9c82-17e42740db59', total_amount: 54324, created_at: wib('2026-10-09T14:33:12'), outlet_id: 'cic', sales_source: 'online' },
    ])
    const r = await prosesUnggahXendit(db, [
      b('x1', 54324, '2026-10-09T14:33:41'),
      b('x2', 99999, '2026-10-09T15:00:00'),
      b('pr', 1, '2026-10-09T15:00:00', { bukanPenjualan: true }),
    ], meta)
    expect(r).toEqual({ baru: 3, diperbarui: 0, cocokId: 0, cocokNominalJam: 1, belumCocok: 1, bukanPenjualan: 1, tagihanProses: 0, pembayaranBerbiayaProses: 3 })
    expect(tabel.get('x1')).toMatchObject({ external_order_id: '22a1629a-373f-4d3c-9c82-17e42740db59', cara_cocok: 'file_nominal_jam', outlet_id: 'cic', sumber: 'file', nama_file: 'okt.csv' })
  })

  it('unggah file yang sama dua kali tidak membuat baris dobel dan hasilnya sama', async () => {
    const { db, tabel } = dbPalsu([], [
      { external_order_id: '22a1629a-373f-4d3c-9c82-17e42740db59', total_amount: 54324, created_at: wib('2026-10-09T14:33:12'), outlet_id: 'cic', sales_source: 'online' },
    ])
    const baris = [b('x1', 54324, '2026-10-09T14:33:41')]
    await prosesUnggahXendit(db, baris, meta)
    const r2 = await prosesUnggahXendit(db, baris, meta)
    expect(tabel.size).toBe(1)
    expect(r2).toMatchObject({ baru: 0, diperbarui: 1, cocokNominalJam: 0, belumCocok: 0 })
    expect(tabel.get('x1')!.external_order_id).toBe('22a1629a-373f-4d3c-9c82-17e42740db59')
  })

  it('baris dari webhook tidak ditimpa tautan maupun sumbernya', async () => {
    const { db, tabel } = dbPalsu([
      { xendit_id: 'x1', external_order_id: 'dari-webhook', cara_cocok: 'webhook', sumber: 'webhook', outlet_id: 'o', nominal: 54324, dibayar_at: wib('2026-10-09T14:33:41') } as BarisDb,
    ], [])
    await prosesUnggahXendit(db, [b('x1', 54324, '2026-10-09T14:33:41')], meta)
    expect(tabel.get('x1')).toMatchObject({ external_order_id: 'dari-webhook', cara_cocok: 'webhook', sumber: 'webhook', ref_qris: 'rrn-x1' })
  })
})

describe('prosesUnggahXendit — biaya per pembayaran', () => {
  it('menyimpan MDR dari file, 0 bila memang tak kena MDR, null bila seharusnya ada tapi tak ditemukan', async () => {
    const { db, tabel } = dbPalsu([], [])
    const r = await prosesUnggahXendit(db, [
      b('kecil', 50000, '2026-10-09T14:00:00'),
      b('besar', 262566, '2026-10-26T14:50:39'),
      b('va', 36216, '2026-10-09T14:00:00', { channel: 'BNI' }),
      b('sep', 50000, '2026-09-29T12:00:00'),
    ], meta, { mdrPerTransaksi: { besar: 1835 }, tagihanProses: 3 })
    expect(tabel.get('kecil')).toMatchObject({ biaya_mdr: 0, biaya_proses: 4440 })
    expect(tabel.get('besar')).toMatchObject({ biaya_mdr: 1835, biaya_proses: 4440 })
    expect(tabel.get('va')).toMatchObject({ biaya_mdr: null, biaya_proses: 4440 })
    expect(tabel.get('sep')).toMatchObject({ biaya_mdr: null, biaya_proses: 0 })
    expect(r).toMatchObject({ tagihanProses: 3, pembayaranBerbiayaProses: 3 })
  })

  it('FEE untuk pembayaran yang tak ada di file tapi sudah ada di database tetap ditempelkan', async () => {
    const { db, tabel } = dbPalsu([
      { xendit_id: 'lama', nominal: 150000, dibayar_at: wib('2026-10-31T20:00:00'), biaya_mdr: null } as BarisDb,
    ], [])
    await prosesUnggahXendit(db, [b('baru', 50000, '2026-11-02T10:00:00')], meta, { mdrPerTransaksi: { lama: 1048, hantu: 99 }, tagihanProses: 0 })
    expect(tabel.get('lama')).toMatchObject({ biaya_mdr: 1048 })
    expect(tabel.has('hantu')).toBe(false)
  })

  it('unggah ulang menghasilkan biaya yang sama', async () => {
    const { db, tabel } = dbPalsu([], [])
    const baris = [b('besar', 262566, '2026-10-26T14:50:39')]
    const biaya = { mdrPerTransaksi: { besar: 1835 }, tagihanProses: 1 }
    await prosesUnggahXendit(db, baris, meta, biaya)
    await prosesUnggahXendit(db, baris, meta, biaya)
    expect(tabel.get('besar')).toMatchObject({ biaya_mdr: 1835, biaya_proses: 4440 })
  })

  it('unggah ulang memperbarui waktu impor (dipakai "Last Update" di kartu Admin Fee)', async () => {
    const { db, tabel } = dbPalsu([
      { xendit_id: 'lama', nominal: 50000, dibayar_at: wib('2026-11-02T10:00:00'), diimpor_at: '2026-11-18T05:57:40Z' } as BarisDb,
    ], [])
    const sebelum = Date.now()
    await prosesUnggahXendit(db, [b('lama', 50000, '2026-11-02T10:00:00')], meta)
    expect(Date.parse(tabel.get('lama')!.diimpor_at!)).toBeGreaterThanOrEqual(sebelum)
  })
})

describe('isPesananWebsite', () => {
  it('online + UUID = website; id platform lain bukan', () => {
    expect(isPesananWebsite({ sales_source: 'online', external_order_id: '22a1629a-373f-4d3c-9c82-17e42740db59' })).toBe(true)
    expect(isPesananWebsite({ sales_source: 'online', external_order_id: 'F-3376293759' })).toBe(false)
    expect(isPesananWebsite({ sales_source: 'online', external_order_id: '3284920822171648074' })).toBe(false)
    expect(isPesananWebsite({ sales_source: 'pos', external_order_id: '22a1629a-373f-4d3c-9c82-17e42740db59' })).toBe(false)
    expect(isPesananWebsite({ sales_source: 'online', external_order_id: null })).toBe(false)
  })
})
