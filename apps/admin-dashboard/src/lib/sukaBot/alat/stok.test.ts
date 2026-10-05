// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { alatStokBahan, GUDANG_PUSAT_ID, type KonteksStok } from './stok'
import { formatTriUnitSaldoAdaptive } from '@/lib/format/compositeUnit'

const SAPI = { id: 'b-sapi', nama: 'SAPI', satuan: 'Pack', satuan_tengah: null, faktor_tengah: null, satuan_kecil: 'gram', faktor_tampilan: 1000 }
const CABE = { id: 'b-cabe', nama: 'SAOS CABE', satuan: 'Dus', satuan_tengah: 'Kompan', faktor_tengah: 3, satuan_kecil: 'gram', faktor_tampilan: 16500 }
const CABE_P = { id: 'b-cabep', nama: 'SAOS CABE POUCH', satuan: 'Dus', satuan_tengah: 'Pouch', faktor_tengah: 12, satuan_kecil: 'gram', faktor_tampilan: 12000 }

function konteks(): KonteksStok {
  return {
    hariIni: '2026-10-03',
    outlets: [
      { id: 'o-beji', name: 'SUKA SHAWARMA BEJI', type: 'outlet', is_active: true },
      { id: 'o-emp', name: 'SUKA SHAWARMA EMPANG', type: 'outlet', is_active: true },
      { id: GUDANG_PUSAT_ID, name: 'GUDANG PUSAT (HQ)', type: 'office', is_active: true },
      { id: 'o-tes', name: 'outlet tes', type: 'test', is_active: true },
    ],
    daftarBahan: async () => [SAPI, CABE, CABE_P],
    barisStok: async (id) => id !== 'b-sapi' ? [] : [
      { outlet_id: 'o-beji', bahan_baku_id: 'b-sapi', current_qty: 12400, last_opname_date: '2026-10-02', saldo_is_gram: true },
      { outlet_id: 'o-emp', bahan_baku_id: 'b-sapi', current_qty: 3.5, last_opname_date: '2026-09-25', saldo_is_gram: false },
      { outlet_id: 'o-tes', bahan_baku_id: 'b-sapi', current_qty: 999, last_opname_date: null, saldo_is_gram: false },
      { outlet_id: GUDANG_PUSAT_ID, bahan_baku_id: 'b-sapi', current_qty: 40, last_opname_date: null, saldo_is_gram: false },
    ],
  }
}

describe('alatStokBahan', () => {
  it('semua lokasi: format sama dengan app Stok, outlet uji dibuang, opname terakhir & tanda tidak akurat', async () => {
    const r: any = await alatStokBahan(konteks(), { bahan: 'sapi' })
    expect(r.status).toBe('ok')
    expect(r.bahan).toBe('SAPI')
    expect(r.lokasi).toEqual([
      { lokasi: 'GUDANG PUSAT (HQ)', saldo_sistem: formatTriUnitSaldoAdaptive(40, false, 'Pack', null, null, 'gram', 1000), opname_terakhir: 'belum pernah', mungkin_tidak_akurat: true },
      { lokasi: 'SUKA SHAWARMA BEJI', saldo_sistem: formatTriUnitSaldoAdaptive(12400, true, 'Pack', null, null, 'gram', 1000), opname_terakhir: '2026-10-02 (1 hari lalu)', mungkin_tidak_akurat: false },
      { lokasi: 'SUKA SHAWARMA EMPANG', saldo_sistem: formatTriUnitSaldoAdaptive(3.5, false, 'Pack', null, null, 'gram', 1000), opname_terakhir: '2026-09-25 (8 hari lalu)', mungkin_tidak_akurat: true },
    ])
    expect(r.sumber).toContain('Stok')
  })
  it('satu outlet', async () => {
    const r: any = await alatStokBahan(konteks(), { bahan: 'sapi', outlet: 'beji' })
    expect(r.lokasi).toHaveLength(1)
    expect(r.lokasi[0].lokasi).toBe('SUKA SHAWARMA BEJI')
  })
  it('gudang pusat bisa ditanya', async () => {
    const r: any = await alatStokBahan(konteks(), { bahan: 'sapi', outlet: 'gudang' })
    expect(r.lokasi[0].lokasi).toBe('GUDANG PUSAT (HQ)')
  })
  it('nama bahan ambigu → tanya balik', async () => {
    const r: any = await alatStokBahan(konteks(), { bahan: 'cabe' })
    expect(r).toMatchObject({ status: 'ambigu', kandidat: ['SAOS CABE', 'SAOS CABE POUCH'] })
  })
  it('bahan tidak ditemukan', async () => {
    const r: any = await alatStokBahan(konteks(), { bahan: 'durian' })
    expect(r.status).toBe('tidak_ditemukan')
  })
})

describe('paritas formatter dengan app Stok', () => {
  it('kode compositeUnit admin-dashboard identik dengan app Stok (komentar diabaikan)', () => {
    const buangKomentar = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '').split('\n').map((l) => l.trim()).filter(Boolean).join('\n')
    const admin = readFileSync(resolve(__dirname, '../../format/compositeUnit.ts'), 'utf8')
    const stok = readFileSync(resolve(__dirname, '../../../../../stok/src/lib/format/compositeUnit.ts'), 'utf8')
    expect(buangKomentar(admin)).toBe(buangKomentar(stok))
  })
})
