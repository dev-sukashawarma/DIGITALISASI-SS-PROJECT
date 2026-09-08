import { isApproverRole } from './approver'

export interface PendingMutasiItem {
  id: string
  status: string
  outlet_asal_id: string
  outlet_tujuan_id: string
  created_at?: string
}

export interface MutasiBadgeCounts {
  total: number
  menungguPersetujuan: number
  menungguPengiriman: number
  dikirim: number
}

const APPROVER_MUTASI_ROLES = [
  'admin',
  'spv',
  'regional_manager',
  'area_manager',
  'owner',
  'kitchen',
  'admin_finance',
  'developer',
  'purchasing',
  'leader',
] as const

export function canUserApproveMutasi(role: string | null | undefined): boolean {
  if (!role) return false
  return isApproverRole(role) || (APPROVER_MUTASI_ROLES as readonly string[]).includes(role)
}

/**
 * Menghitung jumlah mutasi yang membutuhkan tindakan (Actionable Items)
 * berdasarkan peran staff dan outlet yang sedang aktif/dipilih.
 *
 * Logika Alur:
 * 1. `menunggu_persetujuan`: Memerlukan tindakan persetujuan dari Approver/Pusat.
 * 2. `menunggu_pengiriman`: Memerlukan tindakan pengiriman dari Outlet Asal.
 * 3. `dikirim`: Memerlukan tindakan konfirmasi penerimaan dari Outlet Tujuan.
 */
export function calculateMutasiBadgeCounts(
  items: PendingMutasiItem[],
  role?: string | null,
  currentOutletId?: string | null
): MutasiBadgeCounts {
  const isApprover = canUserApproveMutasi(role)

  let menungguPersetujuan = 0
  let menungguPengiriman = 0
  let dikirim = 0

  for (const item of items) {
    if (item.status === 'menunggu_persetujuan') {
      // Approver selalu perlu melihat antrean persetujuan
      if (isApprover) {
        menungguPersetujuan++
      }
    } else if (item.status === 'menunggu_pengiriman') {
      // Outlet asal wajib mengirim; jika role approver/gudang dan tanpa outlet spesifik, hitung semua
      if (!currentOutletId || item.outlet_asal_id === currentOutletId) {
        menungguPengiriman++
      }
    } else if (item.status === 'dikirim') {
      // Outlet tujuan wajib menerima; jika role approver/gudang dan tanpa outlet spesifik, hitung semua
      if (!currentOutletId || item.outlet_tujuan_id === currentOutletId) {
        dikirim++
      }
    }
  }

  const total = menungguPersetujuan + menungguPengiriman + dikirim

  return {
    total,
    menungguPersetujuan,
    menungguPengiriman,
    dikirim,
  }
}

/**
 * Memeriksa apakah suatu mutasi membutuhkan tindakan dari user saat ini.
 */
export function isMutasiActionable(
  item: { status: string; outlet_asal_id: string; outlet_tujuan_id: string },
  role?: string | null,
  currentOutletId?: string | null
): boolean {
  const isApprover = canUserApproveMutasi(role)
  if (item.status === 'menunggu_persetujuan') {
    return isApprover
  }
  if (item.status === 'menunggu_pengiriman') {
    return !currentOutletId || item.outlet_asal_id === currentOutletId
  }
  if (item.status === 'dikirim') {
    return !currentOutletId || item.outlet_tujuan_id === currentOutletId
  }
  return false
}
