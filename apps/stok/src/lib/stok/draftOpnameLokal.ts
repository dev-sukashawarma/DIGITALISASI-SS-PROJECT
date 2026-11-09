/**
 * Draft opname yang disimpan di localStorage (`opname_draft_${outletId}`) menyimpan ketikan
 * crew per tingkat satuan. Bila satuan sebuah bahan diganti (Ganti Satuan di master bahan,
 * kolom bahan_baku.satuan_diganti_at) SESUDAH draft disimpan, ketikan itu bermakna satuan
 * LAMA — kalau dipulihkan ke kolom satuan baru, angkanya terbaca salah (mis. sachet jadi gram).
 * Isian bahan seperti itu dibuang; crew menghitung ulang.
 * Draft tanpa savedAt (dibuat sebelum fitur ini) dianggap disimpan di waktu 0.
 */

export type DraftOpnameLokal = {
  savedAt?: number
  inputs?: Record<string, unknown>
  targets?: Record<string, unknown>
  vendor?: Record<string, unknown>
  [k: string]: unknown
}

export type BahanSatuanDiganti = { id: string; nama: string; satuan_diganti_at?: string | null }

export function saringDraftBasi<T extends DraftOpnameLokal>(
  draft: T,
  bahan: BahanSatuanDiganti[],
): { draft: T; dibuang: string[] } {
  const disimpan = typeof draft.savedAt === 'number' && Number.isFinite(draft.savedAt) ? draft.savedAt : 0
  const basi = new Map<string, string>()
  for (const b of bahan) {
    if (!b.satuan_diganti_at) continue
    const t = Date.parse(b.satuan_diganti_at)
    if (Number.isFinite(t) && t >= disimpan) basi.set(b.id, b.nama)
  }
  if (basi.size === 0) return { draft, dibuang: [] }

  const dibuang = new Set<string>()
  const saring = (rec: Record<string, unknown> | undefined) => {
    if (!rec) return rec
    const hasil: Record<string, unknown> = {}
    for (const [id, nilai] of Object.entries(rec)) {
      const nama = basi.get(id)
      if (nama) dibuang.add(nama)
      else hasil[id] = nilai
    }
    return hasil
  }

  const baru = { ...draft, inputs: saring(draft.inputs), targets: saring(draft.targets), vendor: saring(draft.vendor) }
  return { draft: baru, dibuang: [...dibuang] }
}
