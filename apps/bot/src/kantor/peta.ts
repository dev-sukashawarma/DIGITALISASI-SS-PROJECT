// Penempatan bot ke kursi kantor + selisih terhadap karakter yang sudah ada di engine (spec §5.4).
import type { Meja } from '@/kantor/keadaan'

export type Penempatan<M extends Meja = Meja> = { agentId: number; palet: number; meja: M }

// FNV-1a 32-bit, dipangkas ke 31 bit positif (engine memakai number sebagai id karakter).
export function idKarakter(idKunci: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < idKunci.length; i++) {
    h ^= idKunci.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return (h >>> 1) || 1
}

// Urutan input = urutan RPC (dibuat_at, id) → urutan masuk kantor stabil.
export function tempatkan<M extends Meja>(meja: M[], kapasitas: number, jumlahPalet: number) {
  const diKantor: Penempatan<M>[] = meja.slice(0, Math.max(0, kapasitas)).map((m) => {
    const agentId = idKarakter(m.id)
    return { agentId, palet: jumlahPalet > 0 ? agentId % jumlahPalet : 0, meja: m }
  })
  return { diKantor, diLuar: meja.slice(Math.max(0, kapasitas)) }
}

export function rencanaSinkron<M extends Meja>(adaSekarang: number[], target: Penempatan<M>[]) {
  const ada = new Set(adaSekarang)
  const ingin = new Set(target.map((p) => p.agentId))
  return {
    tambah: target.filter((p) => !ada.has(p.agentId)),
    hapus: adaSekarang.filter((id) => !ingin.has(id)),
  }
}
