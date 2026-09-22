import type { DisciplineRecord, WarningLevel } from './types'

/**
 * Menambahkan bulan kalender ke tanggal YYYY-MM-DD secara aman (tanpa timezone shift).
 */
export function addMonths(dateStr: string, months: number): string {
  if (!dateStr) return ''
  const parts = dateStr.split('-')
  if (parts.length !== 3) return ''
  const year = parseInt(parts[0], 10)
  const month = parseInt(parts[1], 10) - 1
  const day = parseInt(parts[2], 10)

  // Target month
  const targetDate = new Date(year, month + months, 1)
  const daysInTargetMonth = new Date(targetDate.getFullYear(), targetDate.getMonth() + 1, 0).getDate()
  const targetDay = Math.min(day, daysInTargetMonth)
  targetDate.setDate(targetDay)

  const y = targetDate.getFullYear()
  const m = String(targetDate.getMonth() + 1).padStart(2, '0')
  const dt = String(targetDate.getDate()).padStart(2, '0')
  return `${y}-${m}-${dt}`
}

/**
 * Menentukan apakah sebuah catatan SP masih aktif (berlaku <= 3 bulan).
 */
export function isRecordActive(record: DisciplineRecord, now = new Date()): boolean {
  if (record.status !== 'active') return false
  const expStr = record.expires_at || record.expiry_date
  if (!expStr) return true

  const parts = expStr.split('T')[0].split('-')
  if (parts.length === 3) {
    const y = parseInt(parts[0], 10)
    const m = parseInt(parts[1], 10) - 1
    const d = parseInt(parts[2], 10)
    const expDate = new Date(y, m, d, 23, 59, 59, 999)
    return now.getTime() <= expDate.getTime()
  }

  const expDate = new Date(expStr)
  expDate.setHours(23, 59, 59, 999)
  return now.getTime() <= expDate.getTime()
}

export interface StaffSpStatus {
  activeLevel: WarningLevel | null
  nextSuggestedLevel: WarningLevel
  activeRecord?: DisciplineRecord
  hasExpiredPreviousSp: boolean
  lastExpiredRecord?: DisciplineRecord
}

/**
 * Mengevaluasi riwayat SP karyawan untuk menentukan eskalasi otomatis berjenjang:
 * - Belum ada SP aktif (atau sudah gugur > 3 bulan) -> SP1
 * - Sedang aktif SP1 (<= 3 bulan) -> Naik ke SP2
 * - Sedang aktif SP2 (<= 3 bulan) -> Naik ke SP3
 * - Sedang aktif SP3 -> Skorsing
 */
export function getStaffActiveSpStatus(staffId: string, records: DisciplineRecord[]): StaffSpStatus {
  if (!staffId) {
    return {
      activeLevel: null,
      nextSuggestedLevel: 'SP1',
      hasExpiredPreviousSp: false,
    }
  }

  const staffRecords = records
    .filter((r) => r.staff_id === staffId)
    .sort((a, b) => {
      const dateA = new Date(a.incident_date || a.issue_date || a.issued_at || 0).getTime()
      const dateB = new Date(b.incident_date || b.issue_date || b.issued_at || 0).getTime()
      return dateB - dateA
    })

  // SP formal yang masih aktif (dalam rentang 3 bulan)
  const activeFormalSp = staffRecords.find(
    (r) =>
      isRecordActive(r) &&
      (r.warning_level === 'SP1' || r.warning_level === 'SP2' || r.warning_level === 'SP3')
  )

  if (activeFormalSp) {
    let nextLevel: WarningLevel = 'SP1'
    if (activeFormalSp.warning_level === 'SP1') nextLevel = 'SP2'
    else if (activeFormalSp.warning_level === 'SP2') nextLevel = 'SP3'
    else if (activeFormalSp.warning_level === 'SP3') nextLevel = 'Skorsing'

    return {
      activeLevel: activeFormalSp.warning_level,
      nextSuggestedLevel: nextLevel,
      activeRecord: activeFormalSp,
      hasExpiredPreviousSp: false,
    }
  }

  // Jika tidak ada yang aktif, cek riwayat sebelumnya yang sudah gugur/selesai
  const previousFormalSp = staffRecords.find(
    (r) => r.warning_level === 'SP1' || r.warning_level === 'SP2' || r.warning_level === 'SP3'
  )

  return {
    activeLevel: null,
    nextSuggestedLevel: 'SP1',
    hasExpiredPreviousSp: Boolean(previousFormalSp),
    lastExpiredRecord: previousFormalSp,
  }
}
