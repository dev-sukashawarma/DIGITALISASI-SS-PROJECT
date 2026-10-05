import { DEFINISI_ALAT } from './alat/registry'
import { potongHasil, type JejakAlat } from './riwayat'
import type { PanggilLLM, PesanLLM } from './llm'

export type { PanggilLLM, PesanLLM } from './llm'

const JAWABAN_HABIS_PUTARAN = 'Maaf Bos, pertanyaan ini belum bisa saya jawab dengan tuntas. Coba dipecah jadi pertanyaan yang lebih sederhana ya.'

export async function jalankanAgen(o: {
  sistem: string
  riwayat: PesanLLM[]
  pertanyaan: string
  panggilLLM: PanggilLLM
  jalankan: (nama: string, argumen: string) => Promise<Record<string, unknown>>
  maksPutaran?: number
}) {
  const maks = o.maksPutaran ?? 6
  const pesan: PesanLLM[] = [{ role: 'system', content: o.sistem }, ...o.riwayat, { role: 'user', content: o.pertanyaan }]
  let tokenMasuk = 0
  let tokenKeluar = 0
  const alatDipakai: string[] = []
  // Disimpan bersama jawaban → pertanyaan lanjutan bisa merujuk angka yang sama.
  const jejak: JejakAlat[] = []

  for (let putaran = 0; putaran < maks; putaran++) {
    const r = await o.panggilLLM(pesan, DEFINISI_ALAT)
    tokenMasuk += r.tokenMasuk
    tokenKeluar += r.tokenKeluar
    const panggilan = r.pesan.tool_calls ?? []
    if (panggilan.length === 0) {
      return { jawaban: (r.pesan.content ?? '').trim(), tokenMasuk, tokenKeluar, alatDipakai, habisPutaran: false, jejak }
    }
    pesan.push(r.pesan)
    for (const p of panggilan) {
      alatDipakai.push(p.function.name)
      const hasil = await o.jalankan(p.function.name, p.function.arguments)
      const isi = JSON.stringify(hasil)
      pesan.push({ role: 'tool', tool_call_id: p.id, content: isi })
      jejak.push({ id: p.id, nama: p.function.name, argumen: p.function.arguments, hasil: potongHasil(hasil) })
    }
  }
  return { jawaban: JAWABAN_HABIS_PUTARAN, tokenMasuk, tokenKeluar, alatDipakai, habisPutaran: true, jejak }
}
