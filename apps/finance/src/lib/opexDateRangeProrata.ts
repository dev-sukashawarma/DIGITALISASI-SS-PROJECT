/**
 * Modul Prorata OPEX & Payroll Dinamis untuk Keuangan SukaShawarma (Admin Dashboard).
 * 
 * Mengonversi beban gaji bulanan (Payroll HR) menjadi beban akrual harian
 * proporsional sesuai dengan filter rentang waktu (misal: Hari Ini = 1/30 bln,
 * 7 Hari = 7/30 bln), mengadopsi logika waterfall Laba Rugi pada Admin Dashboard.
 */

export interface ProrataInfo {
  overlapDays: number
  totalDays: number
  ratio: number
  isProrated: boolean
  label: string
}

/**
 * Menghitung rasio prorata dan jumlah hari untuk rentang filter waktu.
 * 
 * @param from - Tanggal awal format YYYY-MM-DD
 * @param to - Tanggal akhir format YYYY-MM-DD
 */
export function calculateDateRangeProrata(from: string, to: string): ProrataInfo {
  if (!from || !to) {
    return {
      overlapDays: 1,
      totalDays: 30,
      ratio: 1,
      isProrated: false,
      label: '1 Bulan Penuh'
    }
  }

  const [startY, startM, startD] = from.split('-').map(Number)
  const [endY, endM, endD] = to.split('-').map(Number)

  // Jika berada pada bulan dan tahun yang sama
  if (startY === endY && startM === endM) {
    const totalDaysInMonth = new Date(startY, startM, 0).getDate()
    const overlapDays = Math.max(1, endD - startD + 1)
    const isFullMonth = startD === 1 && endD === totalDaysInMonth
    const ratio = isFullMonth ? 1 : Math.min(1, Math.max(0, overlapDays / totalDaysInMonth))

    const label = !isFullMonth
      ? (overlapDays === 1
          ? `Prorata 1 Hari (1/${totalDaysInMonth} bln)`
          : `Prorata ${overlapDays} Hari (${overlapDays}/${totalDaysInMonth} bln)`)
      : '1 Bulan Penuh'

    return {
      overlapDays,
      totalDays: totalDaysInMonth,
      ratio,
      isProrated: !isFullMonth,
      label
    }
  }

  // Jika rentang tanggal melintasi bulan berbeda (multi-month)
  const periods: { year: number; month: number }[] = []
  let curY = startY
  let curM = startM
  while (curY < endY || (curY === endY && curM <= endM)) {
    periods.push({ year: curY, month: curM })
    curM++
    if (curM > 12) {
      curM = 1
      curY++
    }
  }

  let totalRatio = 0
  let totalOverlapDays = 0
  let totalPeriodDays = 0
  let allFullMonths = true

  for (const p of periods) {
    const totalDays = new Date(p.year, p.month, 0).getDate()
    totalPeriodDays += totalDays

    const mm = String(p.month).padStart(2, '0')
    const firstDay = `${p.year}-${mm}-01`
    const lastDay = `${p.year}-${mm}-${String(totalDays).padStart(2, '0')}`

    const overlapStart = from > firstDay ? from : firstDay
    const overlapEnd = to < lastDay ? to : lastDay

    if (overlapStart <= overlapEnd) {
      const msDiff = Date.parse(overlapEnd + 'T00:00:00Z') - Date.parse(overlapStart + 'T00:00:00Z')
      const days = Math.round(msDiff / 86400000) + 1
      totalOverlapDays += days
      totalRatio += days / totalDays

      if (days < totalDays) {
        allFullMonths = false
      }
    }
  }

  // Normalisasi terhadap jumlah bulan dalam periode payroll
  const monthCount = periods.length || 1
  const effectiveRatio = totalRatio / monthCount
  const isProrated = !allFullMonths || effectiveRatio < 0.999

  const label = isProrated
    ? `Prorata ${totalOverlapDays} Hari (${totalOverlapDays}/${totalPeriodDays} hari)`
    : `${monthCount} Bulan Penuh`

  return {
    overlapDays: totalOverlapDays,
    totalDays: totalPeriodDays,
    ratio: effectiveRatio,
    isProrated,
    label
  }
}

export interface RangePeriodInfo {
  year: number
  month: number
  firstDay: string
  lastDay: string
  totalDays: number
  overlapDays: number
  ratio: number
  isFullMonth: boolean
}

/**
 * Menghasilkan rincian hari dan rasio per bulan kalender untuk rentang tanggal yang diberikan.
 */
export function getPeriodsInRange(from?: string, to?: string): RangePeriodInfo[] {
  if (!from || !to) return []
  const [startY, startM] = from.split('-').map(Number)
  const [endY, endM] = to.split('-').map(Number)
  if (!startY || !startM || !endY || !endM) return []

  const periods: RangePeriodInfo[] = []
  let curY = startY
  let curM = startM

  while (curY < endY || (curY === endY && curM <= endM)) {
    const totalDays = new Date(Date.UTC(curY, curM, 0)).getUTCDate()
    const mm = String(curM).padStart(2, '0')
    const firstDay = `${curY}-${mm}-01`
    const lastDay = `${curY}-${mm}-${String(totalDays).padStart(2, '0')}`

    const overlapStart = from > firstDay ? from : firstDay
    const overlapEnd = to < lastDay ? to : lastDay

    if (overlapStart <= overlapEnd) {
      const msDiff = Date.parse(overlapEnd + 'T00:00:00Z') - Date.parse(overlapStart + 'T00:00:00Z')
      const overlapDays = Math.round(msDiff / 86400000) + 1
      const ratio = totalDays > 0 ? Math.min(1, Math.max(0, overlapDays / totalDays)) : 0
      const isFullMonth = overlapDays === totalDays

      periods.push({
        year: curY,
        month: curM,
        firstDay,
        lastDay,
        totalDays,
        overlapDays,
        ratio,
        isFullMonth,
      })
    }

    curM++
    if (curM > 12) {
      curM = 1
      curY++
    }
  }

  return periods
}

