import { describe, it, expect } from 'vitest'
import { hitungPemakaianPosPeriodeOpname } from './pemakaianPeriodeOpname'

type MockTableData = {
  opname?: any[]
  ledger_stok?: any[]
  stok_balance?: any[]
  bahan_baku?: any[]
  bahan_baku_harga?: any[]
}

/**
 * Mini query builder mock yang mensimulasikan filter dasar Supabase
 * (eq, neq, lt, gte, lte, in, or, order, limit, range, maybeSingle)
 * supaya alur jendela opname + pembalik order + normalisasi skala teruji nyata.
 */
function makeMockSupabase(data: MockTableData) {
  return {
    from(table: string) {
      let rows = [...(data[table as keyof MockTableData] ?? [])]
      const ops: Array<(r: any) => boolean> = []
      let sortCol: string | null = null
      let sortAsc = true
      let limitVal: number | null = null
      let rangeVal: [number, number] | null = null

      const exec = () => {
        let out = rows.filter((r) => ops.every((fn) => fn(r)))
        if (sortCol) {
          out = [...out].sort((a, b) => {
            const av = String(a[sortCol!] ?? '')
            const bv = String(b[sortCol!] ?? '')
            return sortAsc ? av.localeCompare(bv) : bv.localeCompare(av)
          })
        }
        if (rangeVal) {
          out = out.slice(rangeVal[0], rangeVal[1] + 1)
        } else if (limitVal !== null) {
          out = out.slice(0, limitVal)
        }
        return out
      }

      const builder: any = {
        select() { return builder },
        eq(col: string, val: any) { ops.push((r) => r[col] === val); return builder },
        neq(col: string, val: any) { ops.push((r) => r[col] !== val); return builder },
        lt(col: string, val: any) { ops.push((r) => String(r[col]) < String(val)); return builder },
        gte(col: string, val: any) { ops.push((r) => String(r[col]) >= String(val)); return builder },
        lte(col: string, val: any) { ops.push((r) => String(r[col]) <= String(val)); return builder },
        in(col: string, vals: any[]) { ops.push((r) => vals.includes(r[col])); return builder },
        or(expr: string) {
          // Format: created_at.lt."...",created_at.gt."..."
          const ltMatch = expr.match(/created_at\.lt\."([^"]+)"/)
          const gtMatch = expr.match(/created_at\.gt\."([^"]+)"/)
          ops.push((r) => {
            const v = String(r.created_at)
            const condLt = ltMatch ? v < ltMatch[1] : false
            const condGt = gtMatch ? v > gtMatch[1] : false
            return condLt || condGt
          })
          return builder
        },
        order(col: string, opts?: { ascending?: boolean }) {
          if (!sortCol) {
            sortCol = col
            sortAsc = opts?.ascending ?? true
          }
          return builder
        },
        limit(n: number) { limitVal = n; return builder },
        range(from: number, to: number) {
          rangeVal = [from, to]
          return Promise.resolve({ data: exec(), error: null })
        },
        maybeSingle() {
          const out = exec()
          return Promise.resolve({ data: out[0] ?? null, error: null })
        },
        then(resolve: any) {
          return resolve({ data: exec(), error: null })
        },
      }
      return builder
    },
  }
}

describe('hitungPemakaianPosPeriodeOpname', () => {
  it('menghitung pemakaian bersih di jendela [tutup opname lalu, tutup opname ini] dan meniadakan order batal di luar periode', async () => {
    const supabase = makeMockSupabase({
      opname: [
        {
          id: 'op-prev',
          outlet_id: 'out-1',
          status: 'finalized',
          created_at: '2026-10-20T14:00:00.000Z',
          updated_at: '2026-10-20T15:00:00.000Z',
        },
      ],
      ledger_stok: [
        // Tutup opname sebelumnya di 15:00
        { id: 'l-prev-op', outlet_id: 'out-1', bahan_baku_id: 'ayam', tipe: 'opname_selisih', qty: -50, created_at: '2026-10-20T15:00:00.000Z', ref_opname_id: 'op-prev' },
        // Order normal dalam periode (200 gr)
        { id: 'l-1', outlet_id: 'out-1', bahan_baku_id: 'ayam', tipe: 'pemakaian', qty: -200, created_at: '2026-10-21T05:00:00.000Z', ref_order_id: 'ord-1' },
        // Order yang dipotong di periode ini (300 gr) tapi dibatalkan besoknya -> neto 0
        { id: 'l-2', outlet_id: 'out-1', bahan_baku_id: 'ayam', tipe: 'pemakaian', qty: -300, created_at: '2026-10-21T06:00:00.000Z', ref_order_id: 'ord-batal' },
        { id: 'l-2-rev', outlet_id: 'out-1', bahan_baku_id: 'ayam', tipe: 'adjustment', qty: 300, created_at: '2026-10-22T02:00:00.000Z', ref_order_id: 'ord-batal' },
        // Order lain pada bahan sapi (150 gr)
        { id: 'l-3', outlet_id: 'out-1', bahan_baku_id: 'sapi', tipe: 'pemakaian', qty: -150, created_at: '2026-10-21T07:00:00.000Z', ref_order_id: 'ord-2' },
        // Order lama sebelum periode -> diabaikan
        { id: 'l-old', outlet_id: 'out-1', bahan_baku_id: 'ayam', tipe: 'pemakaian', qty: -999, created_at: '2026-10-20T10:00:00.000Z', ref_order_id: 'ord-old' },
      ],
      stok_balance: [],
    })

    const res = await hitungPemakaianPosPeriodeOpname(supabase, {
      outletId: 'out-1',
      nowIso: '2026-10-21T15:00:00.000Z',
    })

    expect(res).toEqual({
      ayam: 200,
      sapi: 150,
    })
  })

  it('menormalisasi baris yang belum gram-scale (saldo_is_gram = false) dengan faktor_tampilan', async () => {
    const supabase = makeMockSupabase({
      opname: [],
      ledger_stok: [
        // 1.5 kg dalam skala besar -> harus jadi 1500 gram
        { id: 'l-1', outlet_id: 'out-1', bahan_baku_id: 'ayam', tipe: 'pemakaian', qty: -1.5, created_at: '2026-10-21T05:00:00.000Z', ref_order_id: 'ord-1' },
      ],
      stok_balance: [
        { outlet_id: 'out-1', bahan_baku_id: 'ayam', saldo_is_gram: false },
      ],
      bahan_baku: [
        { id: 'ayam', faktor_tampilan: 1000, faktor_konversi: 1000 },
      ],
      bahan_baku_harga: [],
    })

    const res = await hitungPemakaianPosPeriodeOpname(supabase, {
      outletId: 'out-1',
      nowIso: '2026-10-21T15:00:00.000Z',
    })

    expect(res).toEqual({ ayam: 1500 })
  })
})
