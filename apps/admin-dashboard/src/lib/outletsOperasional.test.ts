import { describe, expect, it } from 'vitest'
import { fetchOutletsOperasional } from './outletsOperasional'

/** Builder palsu: merekam setiap pemanggilan rantai query Supabase. */
function supabasePalsu(rows: Array<Record<string, unknown>> = []) {
  const panggilan: Array<[string, unknown[]]> = []
  const builder: Record<string, unknown> = {}
  for (const m of ['select', 'neq', 'eq', 'order', 'is', 'in']) {
    builder[m] = (...args: unknown[]) => {
      panggilan.push([m, args])
      return builder
    }
  }
  builder.then = (resolve: (v: unknown) => void) => resolve({ data: rows, error: null })
  return { client: { from: () => builder } as never, panggilan }
}

describe('fetchOutletsOperasional', () => {
  it('bawaan menyembunyikan outlet berstatus Persiapan', async () => {
    const { client, panggilan } = supabasePalsu()
    await fetchOutletsOperasional(client)
    expect(panggilan).toContainEqual(['neq', ['status', 'pending']])
  })

  it('termasukPersiapan menampilkan outlet Persiapan', async () => {
    const { client, panggilan } = supabasePalsu()
    await fetchOutletsOperasional(client, { termasukPersiapan: true })
    expect(panggilan.some(([m, a]) => m === 'neq' && a[0] === 'status')).toBe(false)
  })

  it('tetap membuang outlet tes', async () => {
    const { client } = supabasePalsu([
      { id: 'a', name: 'SUKA SHAWARMA EMPANG', type: 'internal' },
      { id: 'b', name: 'outlet tes', type: 'test' },
    ])
    const hasil = await fetchOutletsOperasional(client)
    expect(hasil.map(o => o.id)).toEqual(['a'])
  })
})
