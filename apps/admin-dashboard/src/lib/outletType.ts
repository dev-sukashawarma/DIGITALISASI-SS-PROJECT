// Tipe outlet (keputusan owner 2026-10-03): outlet sungguhan hanya INTERNAL atau
// MITRA. Disimpan huruf kecil di `outlets.type`; label huruf besar urusan tampilan.
//
// Baris lokasi non-outlet (gudang, office, marketplace, system, test) tetap
// memakai tipenya sendiri — tipe itu yang mengeluarkan mereka dari laporan —
// dan tidak bisa dipilih di form. Dijaga CHECK `outlets_type_check`
// (migration 20261003150000).

export const TIPE_OUTLET = ['internal', 'mitra'] as const
export type TipeOutlet = (typeof TIPE_OUTLET)[number]

export const LABEL_TIPE_OUTLET: Record<TipeOutlet, string> = {
  internal: 'INTERNAL',
  mitra: 'MITRA',
}

const LABEL_NON_OUTLET: Record<string, string> = {
  gudang: 'Gudang',
  office: 'Kantor',
  marketplace: 'Marketplace',
  system: 'Sistem',
  test: 'Tes',
}

export function adalahTipeOutlet(type: string | null | undefined): type is TipeOutlet {
  return type === 'internal' || type === 'mitra'
}

/** Label untuk lokasi non-outlet, mis. "Gudang". Tipe tak dikenal tampil apa adanya. */
export function labelNonOutlet(type: string | null | undefined): string {
  const t = (type ?? '').trim()
  return LABEL_NON_OUTLET[t] ?? (t || 'Tanpa tipe')
}
