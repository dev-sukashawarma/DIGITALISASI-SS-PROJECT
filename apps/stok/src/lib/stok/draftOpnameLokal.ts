/**
 * Draft opname yang disimpan di localStorage (`opname_draft_${outletId}`) menyimpan ketikan
 * crew per tingkat satuan. Bila satuan sebuah bahan diganti (Ganti Satuan di master bahan,
 * kolom bahan_baku.satuan_diganti_at) SESUDAH draft disimpan, ketikan itu bermakna satuan
 * LAMA — kalau dipulihkan ke kolom satuan baru, angkanya terbaca salah (mis. sachet jadi gram).
 * Isian bahan seperti itu dibuang; crew menghitung ulang.
 * Draft tanpa savedAt (dibuat sebelum fitur ini) dianggap disimpan di waktu 0.
 */

export type DraftOpnameLokal = {
  /** Waktu draft PERTAMA dibuat; dipertahankan antar-autosave (isian tertua berasal dari sini). */
  dibuatAt?: number
  /** Waktu autosave terakhir — hanya cadangan untuk draft lama tanpa dibuatAt. */
  savedAt?: number
  /**
   * satuan_diganti_at terbaru yang SUDAH disaring. Ganti satuan pada/sebelum waktu ini sudah
   * ditangani, jadi isian yang diketik ulang sesudahnya tidak dibuang lagi.
   */
  batasAt?: number
  inputs?: Record<string, unknown>
  targets?: Record<string, unknown>
  vendor?: Record<string, unknown>
  [k: string]: unknown
}

export type BahanSatuanDiganti = { id: string; nama: string; satuan_diganti_at?: string | null }

export function saringDraftBasi<T extends DraftOpnameLokal>(
  draft: T,
  bahan: BahanSatuanDiganti[],
): { draft: T & { batasAt?: number }; dibuang: string[] } {
  // Tab bisa tetap terbuka melewati ganti satuan: autosave memperbarui savedAt padahal isian
  // lama masih bermakna satuan lama. Yang menentukan adalah kapan draft mulai diisi.
  const angka = (n: unknown): number | null => (typeof n === 'number' && Number.isFinite(n) ? n : null)
  const disimpan = angka(draft.dibuatAt) ?? angka(draft.savedAt) ?? 0
  const batas = angka(draft.batasAt) ?? Number.NEGATIVE_INFINITY
  const basi = new Map<string, string>()
  let batasBaru = batas
  for (const b of bahan) {
    if (!b.satuan_diganti_at) continue
    const t = Date.parse(b.satuan_diganti_at)
    if (!Number.isFinite(t)) continue
    if (t > batasBaru) batasBaru = t
    if (t >= disimpan && t > batas) basi.set(b.id, b.nama)
  }
  const denganBatas = (d: T): T & { batasAt?: number } =>
    Number.isFinite(batasBaru) && batasBaru !== batas ? { ...d, batasAt: batasBaru } : d
  if (basi.size === 0) return { draft: denganBatas(draft), dibuang: [] }

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
  return { draft: denganBatas(baru), dibuang: [...dibuang] }
}
