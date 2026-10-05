import { describe, it, expect, vi } from 'vitest'
import { jalankanAgen, type PanggilLLM } from './agen'

describe('jalankanAgen', () => {
  it('menjalankan alat lalu mengembalikan jawaban akhir', async () => {
    const urutan = [
      { pesan: { role: 'assistant' as const, content: null, tool_calls: [{ id: 'c1', type: 'function' as const, function: { name: 'omzet', arguments: '{"periode":"kemarin"}' } }] }, tokenMasuk: 100, tokenKeluar: 10 },
      { pesan: { role: 'assistant' as const, content: 'Omzet kemarin Rp 4.000.000, Bos.' }, tokenMasuk: 150, tokenKeluar: 20 },
    ]
    const panggilLLM: PanggilLLM = vi.fn(async () => urutan.shift()!)
    const jalankan = vi.fn(async () => ({ status: 'ok', omzet_kotor: 'Rp 4.000.000' }))
    const r = await jalankanAgen({ sistem: 'S', riwayat: [], pertanyaan: 'omzet kemarin?', panggilLLM, jalankan })
    expect(jalankan).toHaveBeenCalledWith('omzet', '{"periode":"kemarin"}')
    expect(r).toEqual({ jawaban: 'Omzet kemarin Rp 4.000.000, Bos.', tokenMasuk: 250, tokenKeluar: 30, alatDipakai: ['omzet'], habisPutaran: false })
    const pesanKedua = (panggilLLM as any).mock.calls[1][0]
    expect(pesanKedua.at(-1)).toEqual({ role: 'tool', tool_call_id: 'c1', content: JSON.stringify({ status: 'ok', omzet_kotor: 'Rp 4.000.000' }) })
    expect(pesanKedua[0]).toEqual({ role: 'system', content: 'S' })
  })
  it('berhenti setelah maksPutaran', async () => {
    const panggilLLM: PanggilLLM = vi.fn(async () => ({ pesan: { role: 'assistant' as const, content: null, tool_calls: [{ id: 'c', type: 'function' as const, function: { name: 'omzet', arguments: '{}' } }] }, tokenMasuk: 1, tokenKeluar: 1 }))
    const r = await jalankanAgen({ sistem: 'S', riwayat: [], pertanyaan: '?', panggilLLM, jalankan: async () => ({ status: 'galat' }), maksPutaran: 2 })
    expect(r.habisPutaran).toBe(true)
    expect(r.jawaban).toContain('belum bisa')
    expect(panggilLLM).toHaveBeenCalledTimes(2)
  })
})
