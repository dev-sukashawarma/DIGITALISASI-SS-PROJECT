/**
 * Validasi dan perhitungan gaji staf status OJT (On the Job Training).
 *
 * Aturan Bisnis:
 * 1. Gaji Pokok OJT dihitung prorata: Rp 2.000.000 / 26 hari x jumlah hadir absensi (dibulatkan).
 * 2. Kru OJT berhak mendapatkan pembagian bonus pool harian penjualan cabang.
 * 3. Kru OJT memiliki akses operasional (POS) dan denda keterlambatan berlaku sama (Rp 1.000/menit).
 */

export const OJT_MONTHLY_BASE_SALARY = 2_000_000
export const OJT_STANDARD_WORKING_DAYS = 26

export interface StaffOjtInfo {
  onboarding_stage?: string | null
  sub_role?: string | null
  contract_type?: string | null
}

/**
 * Mendeteksi apakah staf berada dalam status / tahap OJT
 */
export function isOjtStaff(staff?: StaffOjtInfo | null): boolean {
  if (!staff) return false

  // 1. Prioritas utama: onboarding_stage adalah 'ojt'
  if (staff.onboarding_stage === 'ojt') return true

  // 2. Karyawan magang (intern) yang belum menjadi regular/graduated
  if (
    staff.contract_type === 'intern' &&
    staff.onboarding_stage !== 'regular' &&
    staff.onboarding_stage !== 'graduated' &&
    staff.onboarding_stage !== 'training_7_days'
  ) {
    return true
  }

  return false
}

/**
 * Menghitung gaji pokok prorata OJT berdasarkan jumlah hari masuk/hadir
 * Rumus: round(2.000.000 / 26 * attendanceDays)
 */
export function calculateOjtBasicSalary(
  attendanceDays: number,
  baseSalary: number = OJT_MONTHLY_BASE_SALARY,
  workingDays: number = OJT_STANDARD_WORKING_DAYS
): number {
  if (attendanceDays <= 0 || baseSalary <= 0 || workingDays <= 0) return 0
  return Math.round((baseSalary / workingDays) * attendanceDays)
}

/**
 * Format catatan rincian prorata OJT untuk slip gaji / UI
 */
export function buildOjtSalaryNote(
  attendanceDays: number,
  baseSalary: number = OJT_MONTHLY_BASE_SALARY,
  workingDays: number = OJT_STANDARD_WORKING_DAYS
): string {
  const formattedBase = baseSalary.toLocaleString('id-ID')
  return `Prorata OJT: Rp ${formattedBase}/${workingDays} x ${attendanceDays} hari hadir`
}
