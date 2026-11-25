/**
 * Tahap pengajuan petty cash sejak 25 Nov 2026 (tanpa Area Manager):
 * forwarded_to_finance -> approved_by_finance (Finance transfer + bukti)
 * -> forwarded_by_leader (leader konfirmasi dana masuk laci; saldo POS naik).
 * Status AM lama hanya muncul di riwayat. Salinan identik ada di admin-dashboard.
 */
export const STATUS_MENUNGGU_FINANCE = 'forwarded_to_finance'
export const STATUS_MENUNGGU_KONFIRMASI_LEADER = 'approved_by_finance'

export function perluKonfirmasiLeader(status: string): boolean {
  return status === STATUS_MENUNGGU_KONFIRMASI_LEADER
}

export function sedangBerjalan(status: string): boolean {
  return status === STATUS_MENUNGGU_FINANCE || status === STATUS_MENUNGGU_KONFIRMASI_LEADER
}

const LABEL: Record<string, string> = {
  forwarded_to_finance: 'Menunggu Finance',
  approved_by_finance: 'Sudah ditransfer, menunggu konfirmasi leader',
  forwarded_by_leader: 'Dana diterima (saldo bertambah)',
  completed: 'Selesai',
  rejected: 'Ditolak',
  forwarded_to_area_manager: 'Menunggu Area Manager (alur lama)',
  forwarded_by_finance: 'Diserahkan ke Area Manager (alur lama)',
  forwarded_by_area_manager: 'Diserahkan ke leader (alur lama)',
}

export function labelStatusPettyCash(status: string): string {
  return LABEL[status] ?? status.replace(/_/g, ' ')
}
