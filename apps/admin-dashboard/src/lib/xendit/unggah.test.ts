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
    expect(r).toEqual({ baru: 3, diperbarui: 0, cocokId: 0, cocokNominalJam: 1, belumCocok: 1, bukanPenjualan: 1 })
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

describe('isPesananWebsite', () => {
  it('online + UUID = website; id platform lain bukan', () => {
    expect(isPesananWebsite({ sales_source: 'online', external_order_id: '22a1629a-373f-4d3c-9c82-17e42740db59' })).toBe(true)
    expect(isPesananWebsite({ sales_source: 'online', external_order_id: 'F-3376293759' })).toBe(false)
    expect(isPesananWebsite({ sales_source: 'online', external_order_id: '3284920822171648074' })).toBe(false)
    expect(isPesananWebsite({ sales_source: 'pos', external_order_id: '22a1629a-373f-4d3c-9c82-17e42740db59' })).toBe(false)
    expect(isPesananWebsite({ sales_source: 'online', external_order_id: null })).toBe(false)
  })
})
