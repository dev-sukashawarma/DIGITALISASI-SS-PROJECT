/**
 * Mitra Business Policy Engine
 * Mengatur aturan pembagian hasil (profit sharing) dan management fee mitra.
 *
 * Aturan Mulai September 2026:
 * - Cutoff date: 2026-09-01
 * - Belum BEP (Total Pengembalian Modal < Nilai Investasi):
 *     - Management Fee: 3% dari Omzet Kotor (Gross Sales)
 *     - Profit Sharing: 100% untuk Mitra, 0% Pusat
 * - Sudah BEP (Total Pengembalian Modal >= Nilai Investasi):
 *     - Management Fee: 0% (Bebas Fee Manajemen)
 *     - Profit Sharing: 50% Mitra, 50% Pusat
 *
 * Aturan Sebelum September 2026:
 * - Mengikuti settingan persentase bagi hasil dan fee management historis lama.
 */

export const MITRA_POLICY_SEPTEMBER_2026_CUTOFF = '2026-09-01'

export interface MitraPolicyResolution {
  profitSharingPct: number       // 100% atau 50% (atau legacy)
  managementFeePct: number       // 3% atau 0% (atau legacy)
  isNewPolicyActive: boolean     // true jika periode >= 2026-09-01
  statusLabel: string            // Label status untuk UI
  isBep: boolean
}

export interface ResolveMitraPolicyParams {
  periodFrom?: string | null
  isBep: boolean
  legacyProfitSharingPct?: number
  legacyManagementFee?: number
}

export function resolveMitraPolicy({
  periodFrom,
  isBep,
  legacyProfitSharingPct = 50,
  legacyManagementFee = 0
}: ResolveMitraPolicyParams): MitraPolicyResolution {
  // Ambil format YYYY-MM-DD dari periodFrom jika ada
  const dateStr = (periodFrom || '').slice(0, 10)
  const isAfterCutoff = Boolean(dateStr && dateStr >= MITRA_POLICY_SEPTEMBER_2026_CUTOFF)

  if (!isAfterCutoff) {
    // Periode sebelum September 2026 (Skema Historis)
    return {
      profitSharingPct: legacyProfitSharingPct,
      managementFeePct: legacyManagementFee,
      isNewPolicyActive: false,
      statusLabel: 'Skema Historis (Sebelum Sept 2026)',
      isBep
    }
  }

  // Periode September 2026 Ke Atas (Skema Adaptif BEP)
  if (!isBep) {
    return {
      profitSharingPct: 100,
      managementFeePct: 3,
      isNewPolicyActive: true,
      statusLabel: 'Belum BEP (100% Mitra, 3% Mgmt Fee)',
      isBep: false
    }
  }

  return {
    profitSharingPct: 50,
    managementFeePct: 0,
    isNewPolicyActive: true,
    statusLabel: 'Sudah BEP (50:50, Bebas Fee Manajemen)',
    isBep: true
  }
}
