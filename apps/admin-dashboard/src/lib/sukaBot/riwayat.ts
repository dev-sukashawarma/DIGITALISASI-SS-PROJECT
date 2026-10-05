import type { PesanLLM } from './llm'

/** Satu panggilan alat yang dipakai untuk sebuah jawaban, disimpan di suka_bot_pesan.meta.jejak. */
export interface JejakAlat { id: string; nama: string; argumen: string; hasil: string }
export interface BarisPesan { peran: 'user' | 'assistant'; isi: string; meta: { jenis?: string; jejak?: JejakAlat[] } | null }

const BATAS_HASIL = 4000

/** Hasil alat disimpan ringkas: cukup untuk pertanyaan lanjutan, tidak membengkakkan prompt. */
export function potongHasil(hasil: unknown, batas = BATAS_HASIL): string {
  const s = JSON.stringify(hasil)
  return s.length <= batas ? s : `${s.slice(0, batas)}…(dipotong)`
}

/**
 * Baris DB → pesan untuk model. Jawaban yang memakai alat dibangun ulang lengkap
 * (tool_calls → hasil alat → jawaban), supaya pertanyaan lanjutan ("yang nomor 3?")
 * dijawab dari angka yang sama, bukan dari ingatan teks jawaban.
 */
export function susunRiwayat(baris: BarisPesan[]): PesanLLM[] {
  const keluar: PesanLLM[] = []
  for (const b of baris) {
    if (b.peran === 'user') {
      keluar.push({ role: 'user', content: b.isi })
      continue
    }
    if (b.meta?.jenis === 'rekap') {
      keluar.push({ role: 'assistant', content: `Rekap harian yang sudah ditampilkan ke Bos di atas percakapan ini:\n${b.isi}` })
      continue
    }
    const jejak = b.meta?.jejak ?? []
    if (jejak.length > 0) {
      keluar.push({
        role: 'assistant',
        content: null,
        tool_calls: jejak.map((j) => ({ id: j.id, type: 'function' as const, function: { name: j.nama, arguments: j.argumen } })),
      })
      for (const j of jejak) keluar.push({ role: 'tool', tool_call_id: j.id, content: j.hasil })
    }
    keluar.push({ role: 'assistant', content: b.isi })
  }
  return keluar
}
