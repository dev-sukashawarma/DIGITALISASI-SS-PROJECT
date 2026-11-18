/** Pesanan website yang bisa dipasangkan dengan pembayaran Xendit. */
export type KandidatPesanan = { externalOrderId: string; total: number; createdAt: string }

/** Pesanan boleh dibuat paling lama 20 menit sebelum bayar s/d 30 menit sesudah bayar. */
const SEBELUM_MS = 20 * 60_000
const SESUDAH_MS = 30 * 60_000

/**
 * Pasangkan pembayaran Xendit ke pesanan website lewat nominal + jam — hanya untuk data
 * yang tidak punya ID penghubung (pesanan lama). Aturan (spec §5.3):
 * - nominal sama persis dan pesanan dalam jendela [bayar − 20 mnt, bayar + 30 mnt];
 * - satu pesanan ↔ satu pembayaran, pasangan dengan selisih waktu terkecil didahulukan;
 * - bila pembayaran (atau pesanan) punya dua kandidat dengan selisih sama persis,
 *   jangan dicocokkan — biarkan untuk manusia.
 * Hasil: xenditId → externalOrderId.
 */
export function cocokkanNominalJam(
  pembayaran: { xenditId: string; nominal: number; dibayarAt: string }[],
  pesanan: KandidatPesanan[],
  sudahTertaut: Set<string>,
): Map<string, string> {
  type Pasangan = { x: string; o: string; selisih: number }
  const pasangan: Pasangan[] = []
  for (const b of pembayaran) {
    const tBayar = Date.parse(b.dibayarAt)
    for (const p of pesanan) {
      if (sudahTertaut.has(p.externalOrderId) || p.total !== b.nominal) continue
      const d = Date.parse(p.createdAt) - tBayar
      if (d < -SEBELUM_MS || d > SESUDAH_MS) continue
      pasangan.push({ x: b.xenditId, o: p.externalOrderId, selisih: Math.abs(d) })
    }
  }
  pasangan.sort((a, b) => a.selisih - b.selisih)

  const hasil = new Map<string, string>()
  const pesananTerpakai = new Set<string>()
  const ditolak = new Set<string>() // xenditId / externalOrderId yang ambigu

  for (const p of pasangan) {
    if (hasil.has(p.x) || pesananTerpakai.has(p.o) || ditolak.has(p.x) || ditolak.has('o:' + p.o)) continue
    // Kandidat lain yang masih bebas dengan selisih identik → ambigu.
    const kembarBayar = pasangan.some(q => q !== p && q.x === p.x && q.selisih === p.selisih && !pesananTerpakai.has(q.o))
    const kembarPesanan = pasangan.some(q => q !== p && q.o === p.o && q.selisih === p.selisih && !hasil.has(q.x))
    if (kembarBayar || kembarPesanan) {
      ditolak.add(p.x)
      ditolak.add('o:' + p.o)
      continue
    }
    hasil.set(p.x, p.o)
    pesananTerpakai.add(p.o)
  }
  return hasil
}
