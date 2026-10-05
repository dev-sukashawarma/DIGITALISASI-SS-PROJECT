import { describe, it, expect } from 'vitest'
import { susunRiwayat, potongHasil, type BarisPesan } from './riwayat'

describe('susunRiwayat', () => {
  it('rekap jadi pesan assistant berlabel, pertanyaan tetap user', () => {
    const baris: BarisPesan[] = [
      { peran: 'assistant', isi: 'Rekap penjualan Min 4 Okt 2026…', meta: { jenis: 'rekap' } },
      { peran: 'user', isi: 'kok cuma mitra?', meta: {} },
    ]
    expect(susunRiwayat(baris)).toEqual([
      { role: 'assistant', content: 'Rekap harian yang sudah ditampilkan ke Bos di atas percakapan ini:\nRekap penjualan Min 4 Okt 2026…' },
      { role: 'user', content: 'kok cuma mitra?' },
    ])
  })

  it('jawaban dengan jejak alat dibangun ulang: tool_calls → tool → jawaban', () => {
    const baris: BarisPesan[] = [
      { peran: 'user', isi: 'ranking kemarin', meta: {} },
      {
        peran: 'assistant',
        isi: '1. MITRA CILEUNGSI …',
        meta: { jejak: [{ id: 'c1', nama: 'ranking_outlet', argumen: '{"periode":"kemarin"}', hasil: '{"status":"ok"}' }] },
      },
    ]
    expect(susunRiwayat(baris)).toEqual([
      { role: 'user', content: 'ranking kemarin' },
      { role: 'assistant', content: null, tool_calls: [{ id: 'c1', type: 'function', function: { name: 'ranking_outlet', arguments: '{"periode":"kemarin"}' } }] },
      { role: 'tool', tool_call_id: 'c1', content: '{"status":"ok"}' },
      { role: 'assistant', content: '1. MITRA CILEUNGSI …' },
    ])
  })

  it('jawaban tanpa jejak (data lama) tetap jadi teks assistant', () => {
    expect(susunRiwayat([{ peran: 'assistant', isi: 'halo', meta: null }])).toEqual([{ role: 'assistant', content: 'halo' }])
  })
})

describe('potongHasil', () => {
  it('hasil pendek utuh, hasil panjang dipotong dengan penanda', () => {
    expect(potongHasil({ a: 1 })).toBe('{"a":1}')
    const panjang = potongHasil({ x: 'y'.repeat(10_000) }, 100)
    expect(panjang.length).toBeLessThanOrEqual(100 + 40)
    expect(panjang.endsWith('…(dipotong)')).toBe(true)
  })
})
