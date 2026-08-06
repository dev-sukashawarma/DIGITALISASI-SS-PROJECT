import { describe, it, expect } from 'vitest'
import { fetchAllRows } from './fetchAllRows'

/**
 * Tiruan PostgREST: memotong tiap respons di 1.000 baris (batas `db-max-rows`)
 * dan selalu melaporkan `count` exact — persis perilaku yang membuat laporan
 * omzet diam-diam kurang.
 */
function fakeServer(totalRows: number, opts: { reportedCount?: number } = {}) {
  const all = Array.from({ length: totalRows }, (_, i) => ({ id: i }))
  let requests = 0

  const build = () => ({
    range(from: number, to: number) {
      requests++
      const capped = Math.min(to - from + 1, 1000)
      return Promise.resolve({
        data: all.slice(from, from + capped),
        error: null,
        count: opts.reportedCount ?? totalRows,
      })
    },
  })

  return { build, requests: () => requests }
}

describe('fetchAllRows', () => {
  it('mengambil seluruh baris walau jauh melebihi batas 1.000', async () => {
    const server = fakeServer(4375) // baris tab "Penjualan per Item", 1–4 Agu 2026
    const rows = await fetchAllRows<{ id: number }>(server.build, 'items')

    expect(rows).toHaveLength(4375)
    expect(server.requests()).toBe(5)
  })

  it('tidak melewatkan atau menggandakan baris di batas potongan', async () => {
    const server = fakeServer(2500)
    const rows = await fetchAllRows<{ id: number }>(server.build, 'items')

    expect(rows.map((r) => r.id)).toEqual(Array.from({ length: 2500 }, (_, i) => i))
  })

  it('berhenti dalam satu request saat hasilnya di bawah satu halaman', async () => {
    const server = fakeServer(42)
    const rows = await fetchAllRows<{ id: number }>(server.build, 'items')

    expect(rows).toHaveLength(42)
    expect(server.requests()).toBe(1)
  })

  it('menangani hasil kosong', async () => {
    const server = fakeServer(0)
    await expect(fetchAllRows<{ id: number }>(server.build, 'items')).resolves.toEqual([])
  })

  it('kelipatan pas 1.000 tidak menyebabkan baris hilang', async () => {
    const server = fakeServer(2000)
    const rows = await fetchAllRows<{ id: number }>(server.build, 'items')

    expect(rows).toHaveLength(2000)
    // 2 halaman penuh + 1 halaman kosong sebagai penanda habis
    expect(server.requests()).toBe(3)
  })

  it('MELEMPAR ERROR kalau jumlah baris tak cocok dengan count server', async () => {
    // Server bilang 5.000, tapi cuma mengirim 1.200 → jangan render angka kurang.
    const server = fakeServer(1200, { reportedCount: 5000 })

    await expect(fetchAllRows<{ id: number }>(server.build, 'Omzet outlet')).rejects.toThrow(
      /data tidak lengkap.*5000.*1200/s
    )
  })

  it('meneruskan error server apa adanya', async () => {
    const build = () => ({
      range: () =>
        Promise.resolve({ data: null, error: { message: 'permission denied' }, count: null }),
    })

    await expect(fetchAllRows(build, 'Omzet outlet')).rejects.toThrow(
      'Omzet outlet: permission denied'
    )
  })
})
