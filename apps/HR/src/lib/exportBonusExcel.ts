import type { CrewBonusRow, AMBonusRow, RMBonusRow, BonusSummaryData } from '@/hooks/useCrewBonus'

export interface ExportBonusExcelParams {
  mode: 'all' | 'crew' | 'am' | 'rm'
  month: number
  year: number
  monthLabel: string
  summary?: BonusSummaryData | null
  crewData?: CrewBonusRow[]
  amData?: AMBonusRow[]
  rmData?: RMBonusRow[]
  filters?: {
    outletLabel?: string
    roleLabel?: string
    attendanceLabel?: string
    searchQuery?: string
  }
}

export function cleanOutletName(name: string) {
  if (!name) return '-'
  return name.replace('SUKA SHAWARMA ', '').replace('MITRA SUKA ', 'MITRA ')
}

export function getExportBonusFilename(params: ExportBonusExcelParams): string {
  const safeMonth = params.monthLabel.replace(/\s+/g, '_')
  if (params.mode === 'crew') {
    return `Laporan_Bonus_Crew_Leader_${safeMonth}_${params.year}.xlsx`
  }
  if (params.mode === 'am') {
    return `Laporan_Bonus_Area_Manager_${safeMonth}_${params.year}.xlsx`
  }
  if (params.mode === 'rm') {
    return `Laporan_Bonus_Regional_Manager_${safeMonth}_${params.year}.xlsx`
  }
  return `Laporan_Bonus_Insentif_SukaHR_${safeMonth}_${params.year}.xlsx`
}

// Brand color palette (ARGB hex without '#')
const BRAND_BROWN = 'FF701604'
const BRAND_SOFT = 'FFFDF3E7'
const BRAND_GRAY_BG = 'FFFAFAF9'
const TEXT_MUTED = 'FF78716C'
const TEXT_DARK = 'FF292524'
const GREEN_DARK = 'FF15803D'
const BLUE_DARK = 'FF1E40AF'
const BLUE_BG = 'FFDBEAFE'
const AMBER_DARK = 'FF92400E'
const AMBER_BG = 'FFFEF3C7'

const BORDER_THIN = { style: 'thin' as const, color: { argb: 'FFE7DDD3' } }
const BORDER_DOUBLE_BOTTOM = {
  top: BORDER_THIN,
  bottom: { style: 'double' as const, color: { argb: 'FF701604' } },
  left: BORDER_THIN,
  right: BORDER_THIN,
}

/**
 * Membangun workbook ExcelJS dengan struktur sheet & styling profesional.
 */
export async function buildBonusWorkbook(params: ExportBonusExcelParams) {
  const ExcelJS = (await import('exceljs')).default
  const wb = new ExcelJS.Workbook()
  wb.creator = 'SukaHR People & Operations'
  wb.created = new Date()
  wb.modified = new Date()

  const exportDate = new Date().toLocaleString('id-ID', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Asia/Jakarta',
  })

  const {
    mode,
    monthLabel,
    year,
    summary,
    crewData = [],
    amData = [],
    rmData = [],
    filters,
  } = params

  // ─────────────────────────────────────────────────────────────
  // 1. SHEET RINGKASAN (Hanya untuk mode 'all')
  // ─────────────────────────────────────────────────────────────
  if (mode === 'all') {
    const ws = wb.addWorksheet('Ringkasan Eksekutif', {
      views: [{ state: 'frozen', ySplit: 4 }],
      pageSetup: { orientation: 'portrait', fitToPage: true, fitToWidth: 1, fitToHeight: 0 },
    })

    ws.columns = [
      { key: 'colA', width: 34 },
      { key: 'colB', width: 20 },
      { key: 'colC', width: 36 },
      { key: 'colD', width: 24 },
    ]

    // Title banner
    ws.mergeCells('A1:D1')
    ws.getCell('A1').value = 'LAPORAN REKAPITULASI BONUS & INSENTIF PENJUALAN'
    ws.getCell('A1').font = { bold: true, size: 13, color: { argb: 'FFFFFFFF' } }
    ws.getCell('A1').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BRAND_BROWN } }
    ws.getCell('A1').alignment = { vertical: 'middle', indent: 1 }
    ws.getRow(1).height = 28

    ws.mergeCells('A2:D2')
    ws.getCell('A2').value = 'SUKA SHAWARMA INDONESIA — DIVISI PEOPLE & OPERATIONS (HR)'
    ws.getCell('A2').font = { bold: true, size: 10, color: { argb: TEXT_DARK } }
    ws.getCell('A2').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BRAND_SOFT } }
    ws.getCell('A2').alignment = { vertical: 'middle', indent: 1 }
    ws.getRow(2).height = 20

    ws.mergeCells('A3:D3')
    ws.getCell('A3').value = `Periode: ${monthLabel} ${year}   •   Diekspor pada: ${exportDate} WIB`
    ws.getCell('A3').font = { italic: true, size: 9, color: { argb: TEXT_MUTED } }
    ws.getCell('A3').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BRAND_SOFT } }
    ws.getCell('A3').alignment = { vertical: 'middle', indent: 1 }
    ws.getRow(3).height = 18

    // Spacer
    ws.getRow(4).height = 8

    // Section 1: KPI Ringkasan Global
    ws.mergeCells('A5:D5')
    ws.getCell('A5').value = 'RINGKASAN METRIK GLOBAL'
    ws.getCell('A5').font = { bold: true, size: 10, color: { argb: 'FFFFFFFF' } }
    ws.getCell('A5').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFC2410C' } } // Warm orange/amber
    ws.getCell('A5').alignment = { vertical: 'middle', indent: 1 }
    ws.getRow(5).height = 22

    const kpiRows = [
      {
        label: 'Total Beban Pengeluaran Bonus',
        value: summary?.grand_total_bonus ?? 0,
        fmt: '"Rp"#,##0',
        note: 'Akumulasi beban bonus Crew, AM, dan RM',
      },
      {
        label: 'Total Pcs Terjual Global',
        value: summary?.total_pcs_global ?? 0,
        fmt: '#,##0',
        note: 'Total porsi terjual di seluruh outlet aktif',
      },
      {
        label: 'Total Penerima Insentif',
        value:
          (summary?.active_crew_count ?? 0) +
          (summary?.active_am_count ?? 0) +
          (summary?.active_rm_count ?? 0),
        fmt: '#,##0',
        note: 'Staf aktif penerima insentif periode ini',
      },
    ]

    let currRow = 6
    kpiRows.forEach((kpi) => {
      const r = ws.getRow(currRow)
      r.height = 20
      r.getCell(1).value = kpi.label
      r.getCell(1).font = { bold: true, size: 10, color: { argb: TEXT_DARK } }
      r.getCell(1).border = { top: BORDER_THIN, bottom: BORDER_THIN, left: BORDER_THIN, right: BORDER_THIN }

      r.getCell(2).value = kpi.value
      r.getCell(2).font = { bold: true, size: 11, color: { argb: BRAND_BROWN } }
      r.getCell(2).numFmt = kpi.fmt
      r.getCell(2).alignment = { horizontal: 'right', vertical: 'middle' }
      r.getCell(2).border = { top: BORDER_THIN, bottom: BORDER_THIN, left: BORDER_THIN, right: BORDER_THIN }

      ws.mergeCells(`C${currRow}:D${currRow}`)
      const cCell = r.getCell(3)
      cCell.value = kpi.note
      cCell.font = { italic: true, size: 9, color: { argb: TEXT_MUTED } }
      cCell.alignment = { vertical: 'middle', indent: 1 }
      r.getCell(3).border = { top: BORDER_THIN, bottom: BORDER_THIN, left: BORDER_THIN, right: BORDER_THIN }
      r.getCell(4).border = { top: BORDER_THIN, bottom: BORDER_THIN, left: BORDER_THIN, right: BORDER_THIN }

      currRow++
    })

    // Spacer
    ws.getRow(currRow).height = 12
    currRow++

    // Section 2: Alokasi per Posisi
    ws.mergeCells(`A${currRow}:D${currRow}`)
    ws.getCell(`A${currRow}`).value = 'ALOKASI DISTRIBUSI BONUS PER POSISI'
    ws.getCell(`A${currRow}`).font = { bold: true, size: 10, color: { argb: 'FFFFFFFF' } }
    ws.getCell(`A${currRow}`).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BRAND_BROWN } }
    ws.getCell(`A${currRow}`).alignment = { vertical: 'middle', indent: 1 }
    ws.getRow(currRow).height = 22
    currRow++

    // Table Header
    const posHeader = ws.getRow(currRow)
    posHeader.height = 22
    posHeader.values = ['Posisi / Jabatan', 'Jumlah Penerima', 'Skema Perhitungan', 'Total Alokasi (Rp)']
    posHeader.eachCell((c) => {
      c.font = { bold: true, size: 9, color: { argb: TEXT_DARK } }
      c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2E8F0' } }
      c.alignment = { vertical: 'middle', horizontal: 'center' }
      c.border = { top: BORDER_THIN, bottom: BORDER_THIN, left: BORDER_THIN, right: BORDER_THIN }
    })
    posHeader.getCell(1).alignment = { vertical: 'middle', horizontal: 'left', indent: 1 }
    currRow++

    const posRows = [
      {
        pos: 'Crew & Leader Outlet',
        count: summary?.active_crew_count ?? crewData.length,
        skema: 'Rp 100 / pcs dibagi kru hadir harian',
        total: summary?.total_crew_bonus ?? crewData.reduce((s, c) => s + c.total_bonus, 0),
      },
      {
        pos: 'Area Manager (AM)',
        count: summary?.active_am_count ?? amData.length,
        skema: 'Rp 50 / pcs seluruh cabang binaan',
        total: summary?.total_am_bonus ?? amData.reduce((s, a) => s + a.total_bonus, 0),
      },
      {
        pos: 'Regional Manager (RM)',
        count: summary?.active_rm_count ?? rmData.length,
        skema: 'Rp 50 / pcs global seluruh cabang',
        total: summary?.total_rm_bonus ?? rmData.reduce((s, r) => s + r.total_bonus, 0),
      },
    ]

    posRows.forEach((item, idx) => {
      const r = ws.getRow(currRow)
      r.height = 20
      r.getCell(1).value = item.pos
      r.getCell(1).font = { bold: true, size: 10 }
      r.getCell(1).alignment = { vertical: 'middle', indent: 1 }

      r.getCell(2).value = item.count
      r.getCell(2).numFmt = '#,##0'
      r.getCell(2).alignment = { horizontal: 'center', vertical: 'middle' }

      r.getCell(3).value = item.skema
      r.getCell(3).alignment = { vertical: 'middle', indent: 1 }
      r.getCell(3).font = { size: 9, color: { argb: TEXT_MUTED } }

      r.getCell(4).value = item.total
      r.getCell(4).numFmt = '"Rp"#,##0'
      r.getCell(4).font = { bold: true, size: 10 }
      r.getCell(4).alignment = { horizontal: 'right', vertical: 'middle' }

      r.eachCell({ includeEmpty: true }, (c) => {
        c.border = { top: BORDER_THIN, bottom: BORDER_THIN, left: BORDER_THIN, right: BORDER_THIN }
        if (idx % 2 === 1) {
          c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BRAND_GRAY_BG } }
        }
      })
      currRow++
    })

    // Total Row
    const totRow = ws.getRow(currRow)
    totRow.height = 24
    totRow.getCell(1).value = 'GRAND TOTAL PENGELUARAN BONUS'
    totRow.getCell(1).font = { bold: true, size: 10, color: { argb: BRAND_BROWN } }
    totRow.getCell(1).alignment = { vertical: 'middle', indent: 1 }

    totRow.getCell(2).value =
      (summary?.active_crew_count ?? 0) +
      (summary?.active_am_count ?? 0) +
      (summary?.active_rm_count ?? 0)
    totRow.getCell(2).font = { bold: true, size: 10 }
    totRow.getCell(2).numFmt = '#,##0'
    totRow.getCell(2).alignment = { horizontal: 'center', vertical: 'middle' }

    totRow.getCell(3).value = 'Terkoneksi POS Operasional'
    totRow.getCell(3).font = { italic: true, size: 9, color: { argb: TEXT_MUTED } }
    totRow.getCell(3).alignment = { vertical: 'middle', indent: 1 }

    totRow.getCell(4).value = summary?.grand_total_bonus ?? 0
    totRow.getCell(4).font = { bold: true, size: 11, color: { argb: GREEN_DARK } }
    totRow.getCell(4).numFmt = '"Rp"#,##0'
    totRow.getCell(4).alignment = { horizontal: 'right', vertical: 'middle' }

    totRow.eachCell({ includeEmpty: true }, (c) => {
      c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BRAND_SOFT } }
      c.border = BORDER_DOUBLE_BOTTOM
    })
  }

  // ─────────────────────────────────────────────────────────────
  // 2. SHEET CREW & LEADER OUTLET (Untuk 'all' atau 'crew')
  // ─────────────────────────────────────────────────────────────
  if (mode === 'all' || mode === 'crew') {
    const wsCrew = wb.addWorksheet('Crew & Leader', {
      views: [{ state: 'frozen', ySplit: 4 }],
      pageSetup: { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0 },
    })

    wsCrew.columns = [
      { key: 'no', width: 6 },
      { key: 'nama', width: 28 },
      { key: 'role', width: 14 },
      { key: 'sub_role', width: 16 },
      { key: 'outlet', width: 26 },
      { key: 'pcs_outlet', width: 18 },
      { key: 'pool_outlet', width: 18 },
      { key: 'hadir', width: 14 },
      { key: 'total_hari', width: 16 },
      { key: 'porsi', width: 16 },
      { key: 'total_bonus', width: 22 },
    ]

    // Title banner
    wsCrew.mergeCells('A1:K1')
    wsCrew.getCell('A1').value = 'REKAP BONUS INSENTIF CREW & LEADER OUTLET'
    wsCrew.getCell('A1').font = { bold: true, size: 12, color: { argb: 'FFFFFFFF' } }
    wsCrew.getCell('A1').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BRAND_BROWN } }
    wsCrew.getCell('A1').alignment = { vertical: 'middle', indent: 1 }
    wsCrew.getRow(1).height = 26

    // Subtitle banner with filter context
    const filterParts: string[] = []
    if (filters?.outletLabel) filterParts.push(`Outlet: ${filters.outletLabel}`)
    if (filters?.roleLabel) filterParts.push(`Posisi: ${filters.roleLabel}`)
    if (filters?.attendanceLabel) filterParts.push(`Kehadiran: ${filters.attendanceLabel}`)
    if (filters?.searchQuery) filterParts.push(`Pencarian: "${filters.searchQuery}"`)
    const filterText = filterParts.length > 0 ? `   •   ${filterParts.join(' | ')}` : ''

    wsCrew.mergeCells('A2:K2')
    wsCrew.getCell('A2').value = `Periode: ${monthLabel} ${year}   •   Total Staf: ${crewData.length} orang${filterText}   •   Diekspor: ${exportDate} WIB`
    wsCrew.getCell('A2').font = { size: 9, color: { argb: TEXT_DARK } }
    wsCrew.getCell('A2').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BRAND_SOFT } }
    wsCrew.getCell('A2').alignment = { vertical: 'middle', indent: 1 }
    wsCrew.getRow(2).height = 18

    // Spacer
    wsCrew.getRow(3).height = 6

    // Header Table
    const header = wsCrew.getRow(4)
    header.height = 24
    header.values = [
      'No',
      'Nama Staf',
      'Role',
      'Sub-Role',
      'Outlet / Cabang',
      'Pcs Terjual Outlet',
      'Pool Cabang (Rp)',
      'Hadir (Hari)',
      'Total Hari Outlet',
      'Porsi Kehadiran',
      'Bonus Diterima (Rp)',
    ]
    header.eachCell((c) => {
      c.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 9.5 }
      c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BRAND_BROWN } }
      c.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true }
      c.border = { top: BORDER_THIN, bottom: BORDER_THIN, left: BORDER_THIN, right: BORDER_THIN }
    })

    let totalBonusCrew = 0

    crewData.forEach((row, i) => {
      totalBonusCrew += row.total_bonus

      const porsiRatio =
        row.attendance_days && row.total_attendance_days && row.total_attendance_days > 0
          ? row.attendance_days / row.total_attendance_days
          : 0

      const poolAmount = row.total_pcs_outlet * (row.bonus_rate || 100)

      const r = wsCrew.addRow({
        no: i + 1,
        nama: row.crew_name,
        role: row.role === 'leader' ? 'Leader' : 'Crew',
        sub_role: row.sub_role === 'crew_backup' ? 'Mobile Backup' : 'Reguler',
        outlet: cleanOutletName(row.outlet_name),
        pcs_outlet: row.total_pcs_outlet,
        pool_outlet: poolAmount,
        hadir: row.attendance_days ?? 0,
        total_hari: row.total_attendance_days ?? 0,
        porsi: porsiRatio,
        total_bonus: row.total_bonus,
      })
      r.height = 20

      r.eachCell({ includeEmpty: true }, (c) => {
        c.font = { size: 9.5 }
        c.border = { top: BORDER_THIN, bottom: BORDER_THIN, left: BORDER_THIN, right: BORDER_THIN }
        if (i % 2 === 1) {
          c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BRAND_GRAY_BG } }
        }
      })

      // Alignments & Number formats
      r.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' } // No
      r.getCell(2).alignment = { horizontal: 'left', vertical: 'middle', indent: 1 } // Nama
      r.getCell(2).font = { bold: true, size: 9.5 }

      r.getCell(3).alignment = { horizontal: 'center', vertical: 'middle' } // Role
      if (row.role === 'leader') {
        r.getCell(3).font = { bold: true, color: { argb: AMBER_DARK } }
        r.getCell(3).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: AMBER_BG } }
      }

      r.getCell(4).alignment = { horizontal: 'center', vertical: 'middle' } // Sub-Role
      if (row.sub_role === 'crew_backup') {
        r.getCell(4).font = { bold: true, color: { argb: 'FF6B21A8' } } // Purple
        r.getCell(4).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF3E8FF' } }
      }

      r.getCell(5).alignment = { horizontal: 'left', vertical: 'middle', indent: 1 } // Outlet

      r.getCell(6).alignment = { horizontal: 'right', vertical: 'middle' } // Pcs
      r.getCell(6).numFmt = '#,##0'

      r.getCell(7).alignment = { horizontal: 'right', vertical: 'middle' } // Pool
      r.getCell(7).numFmt = '"Rp"#,##0'

      r.getCell(8).alignment = { horizontal: 'center', vertical: 'middle' } // Hadir
      r.getCell(8).numFmt = '#,##0'

      r.getCell(9).alignment = { horizontal: 'center', vertical: 'middle' } // Total Hari
      r.getCell(9).numFmt = '#,##0'

      r.getCell(10).alignment = { horizontal: 'center', vertical: 'middle' } // Porsi %
      r.getCell(10).numFmt = '0.0%'

      r.getCell(11).alignment = { horizontal: 'right', vertical: 'middle' } // Bonus
      r.getCell(11).numFmt = '"Rp"#,##0'
      r.getCell(11).font = { bold: true, size: 10, color: { argb: GREEN_DARK } }
    })

    // Total Footer
    const footer = wsCrew.addRow([])
    footer.height = 24
    wsCrew.mergeCells(`A${5 + crewData.length}:J${5 + crewData.length}`)
    footer.getCell(1).value = `TOTAL BONUS CREW & LEADER (${crewData.length} Staf)`
    footer.getCell(1).font = { bold: true, size: 10, color: { argb: BRAND_BROWN } }
    footer.getCell(1).alignment = { horizontal: 'right', vertical: 'middle', indent: 1 }

    footer.getCell(11).value = totalBonusCrew
    footer.getCell(11).font = { bold: true, size: 11, color: { argb: GREEN_DARK } }
    footer.getCell(11).numFmt = '"Rp"#,##0'
    footer.getCell(11).alignment = { horizontal: 'right', vertical: 'middle' }

    footer.eachCell({ includeEmpty: true }, (c) => {
      c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BRAND_SOFT } }
      c.border = BORDER_DOUBLE_BOTTOM
    })

    if (crewData.length > 0) {
      wsCrew.autoFilter = { from: { row: 4, column: 1 }, to: { row: 4 + crewData.length, column: 11 } }
    }
  }

  // ─────────────────────────────────────────────────────────────
  // 3. SHEET AREA MANAGER (Untuk 'all' atau 'am')
  // ─────────────────────────────────────────────────────────────
  if (mode === 'all' || mode === 'am') {
    const wsAM = wb.addWorksheet('Area Manager', {
      views: [{ state: 'frozen', ySplit: 4 }],
      pageSetup: { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0 },
    })

    wsAM.columns = [
      { key: 'no', width: 6 },
      { key: 'nama', width: 28 },
      { key: 'cabang', width: 44 },
      { key: 'jml_cabang', width: 15 },
      { key: 'total_pcs', width: 18 },
      { key: 'tarif', width: 18 },
      { key: 'total_bonus', width: 22 },
    ]

    // Title banner
    wsAM.mergeCells('A1:G1')
    wsAM.getCell('A1').value = 'REKAP BONUS AREA MANAGER (AM)'
    wsAM.getCell('A1').font = { bold: true, size: 12, color: { argb: 'FFFFFFFF' } }
    wsAM.getCell('A1').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BLUE_DARK } }
    wsAM.getCell('A1').alignment = { vertical: 'middle', indent: 1 }
    wsAM.getRow(1).height = 26

    wsAM.mergeCells('A2:G2')
    wsAM.getCell('A2').value = `Periode: ${monthLabel} ${year}   •   Tarif: Rp 50 / pcs binaan   •   Total: ${amData.length} AM   •   Diekspor: ${exportDate} WIB`
    wsAM.getCell('A2').font = { size: 9, color: { argb: TEXT_DARK } }
    wsAM.getCell('A2').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BLUE_BG } }
    wsAM.getCell('A2').alignment = { vertical: 'middle', indent: 1 }
    wsAM.getRow(2).height = 18

    // Spacer
    wsAM.getRow(3).height = 6

    // Headers
    const header = wsAM.getRow(4)
    header.height = 24
    header.values = [
      'No',
      'Nama Area Manager',
      'Cabang Binaan',
      'Jumlah Cabang',
      'Total Pcs Binaan',
      'Tarif Bonus (Rp/pcs)',
      'Bonus Diterima (Rp)',
    ]
    header.eachCell((c) => {
      c.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 9.5 }
      c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BLUE_DARK } }
      c.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true }
      c.border = { top: BORDER_THIN, bottom: BORDER_THIN, left: BORDER_THIN, right: BORDER_THIN }
    })

    let totalBonusAM = 0
    amData.forEach((row, i) => {
      totalBonusAM += row.total_bonus
      const r = wsAM.addRow({
        no: i + 1,
        nama: row.staff_name,
        cabang: row.managed_outlet_names.map(cleanOutletName).join(', ') || '-',
        jml_cabang: row.managed_outlet_names.length,
        total_pcs: row.total_pcs,
        tarif: row.bonus_rate,
        total_bonus: row.total_bonus,
      })
      r.height = 20

      r.eachCell({ includeEmpty: true }, (c) => {
        c.font = { size: 9.5 }
        c.border = { top: BORDER_THIN, bottom: BORDER_THIN, left: BORDER_THIN, right: BORDER_THIN }
        if (i % 2 === 1) {
          c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BRAND_GRAY_BG } }
        }
      })

      r.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' }
      r.getCell(2).alignment = { horizontal: 'left', vertical: 'middle', indent: 1 }
      r.getCell(2).font = { bold: true, size: 9.5 }
      r.getCell(3).alignment = { horizontal: 'left', vertical: 'middle', wrapText: true }
      r.getCell(4).alignment = { horizontal: 'center', vertical: 'middle' }
      r.getCell(4).numFmt = '#,##0'
      r.getCell(5).alignment = { horizontal: 'right', vertical: 'middle' }
      r.getCell(5).numFmt = '#,##0'
      r.getCell(6).alignment = { horizontal: 'right', vertical: 'middle' }
      r.getCell(6).numFmt = '"Rp"#,##0'
      r.getCell(7).alignment = { horizontal: 'right', vertical: 'middle' }
      r.getCell(7).numFmt = '"Rp"#,##0'
      r.getCell(7).font = { bold: true, size: 10, color: { argb: GREEN_DARK } }
    })

    // Total Footer
    const footer = wsAM.addRow([])
    footer.height = 24
    wsAM.mergeCells(`A${5 + amData.length}:F${5 + amData.length}`)
    footer.getCell(1).value = `TOTAL BONUS AREA MANAGER (${amData.length} AM)`
    footer.getCell(1).font = { bold: true, size: 10, color: { argb: BLUE_DARK } }
    footer.getCell(1).alignment = { horizontal: 'right', vertical: 'middle', indent: 1 }

    footer.getCell(7).value = totalBonusAM
    footer.getCell(7).font = { bold: true, size: 11, color: { argb: GREEN_DARK } }
    footer.getCell(7).numFmt = '"Rp"#,##0'
    footer.getCell(7).alignment = { horizontal: 'right', vertical: 'middle' }

    footer.eachCell({ includeEmpty: true }, (c) => {
      c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BLUE_BG } }
      c.border = BORDER_DOUBLE_BOTTOM
    })

    if (amData.length > 0) {
      wsAM.autoFilter = { from: { row: 4, column: 1 }, to: { row: 4 + amData.length, column: 7 } }
    }
  }

  // ─────────────────────────────────────────────────────────────
  // 4. SHEET REGIONAL MANAGER (Untuk 'all' atau 'rm')
  // ─────────────────────────────────────────────────────────────
  if (mode === 'all' || mode === 'rm') {
    const wsRM = wb.addWorksheet('Regional Manager', {
      views: [{ state: 'frozen', ySplit: 4 }],
      pageSetup: { orientation: 'portrait', fitToPage: true, fitToWidth: 1, fitToHeight: 0 },
    })

    wsRM.columns = [
      { key: 'no', width: 6 },
      { key: 'nama', width: 28 },
      { key: 'cakupan', width: 34 },
      { key: 'total_pcs', width: 20 },
      { key: 'tarif', width: 18 },
      { key: 'total_bonus', width: 22 },
    ]

    // Title banner
    wsRM.mergeCells('A1:F1')
    wsRM.getCell('A1').value = 'REKAP BONUS REGIONAL MANAGER (RM)'
    wsRM.getCell('A1').font = { bold: true, size: 12, color: { argb: 'FFFFFFFF' } }
    wsRM.getCell('A1').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: AMBER_DARK } }
    wsRM.getCell('A1').alignment = { vertical: 'middle', indent: 1 }
    wsRM.getRow(1).height = 26

    wsRM.mergeCells('A2:F2')
    wsRM.getCell('A2').value = `Periode: ${monthLabel} ${year}   •   Tarif: Rp 50 / pcs global   •   Total: ${rmData.length} RM   •   Diekspor: ${exportDate} WIB`
    wsRM.getCell('A2').font = { size: 9, color: { argb: TEXT_DARK } }
    wsRM.getCell('A2').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: AMBER_BG } }
    wsRM.getCell('A2').alignment = { vertical: 'middle', indent: 1 }
    wsRM.getRow(2).height = 18

    // Spacer
    wsRM.getRow(3).height = 6

    // Headers
    const header = wsRM.getRow(4)
    header.height = 24
    header.values = [
      'No',
      'Nama Regional Manager',
      'Cakupan Wilayah',
      'Total Pcs Global',
      'Tarif Bonus (Rp/pcs)',
      'Bonus Diterima (Rp)',
    ]
    header.eachCell((c) => {
      c.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 9.5 }
      c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: AMBER_DARK } }
      c.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true }
      c.border = { top: BORDER_THIN, bottom: BORDER_THIN, left: BORDER_THIN, right: BORDER_THIN }
    })

    let totalBonusRM = 0
    rmData.forEach((row, i) => {
      totalBonusRM += row.total_bonus
      const r = wsRM.addRow({
        no: i + 1,
        nama: row.staff_name,
        cakupan: row.scope_description || 'Seluruh Jaringan Outlet Suka Shawarma',
        total_pcs: row.total_pcs_global,
        tarif: row.bonus_rate,
        total_bonus: row.total_bonus,
      })
      r.height = 20

      r.eachCell({ includeEmpty: true }, (c) => {
        c.font = { size: 9.5 }
        c.border = { top: BORDER_THIN, bottom: BORDER_THIN, left: BORDER_THIN, right: BORDER_THIN }
        if (i % 2 === 1) {
          c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BRAND_GRAY_BG } }
        }
      })

      r.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' }
      r.getCell(2).alignment = { horizontal: 'left', vertical: 'middle', indent: 1 }
      r.getCell(2).font = { bold: true, size: 9.5 }
      r.getCell(3).alignment = { horizontal: 'left', vertical: 'middle', indent: 1 }
      r.getCell(4).alignment = { horizontal: 'right', vertical: 'middle' }
      r.getCell(4).numFmt = '#,##0'
      r.getCell(5).alignment = { horizontal: 'right', vertical: 'middle' }
      r.getCell(5).numFmt = '"Rp"#,##0'
      r.getCell(6).alignment = { horizontal: 'right', vertical: 'middle' }
      r.getCell(6).numFmt = '"Rp"#,##0'
      r.getCell(6).font = { bold: true, size: 10, color: { argb: GREEN_DARK } }
    })

    // Total Footer
    const footer = wsRM.addRow([])
    footer.height = 24
    wsRM.mergeCells(`A${5 + rmData.length}:E${5 + rmData.length}`)
    footer.getCell(1).value = `TOTAL BONUS REGIONAL MANAGER (${rmData.length} RM)`
    footer.getCell(1).font = { bold: true, size: 10, color: { argb: AMBER_DARK } }
    footer.getCell(1).alignment = { horizontal: 'right', vertical: 'middle', indent: 1 }

    footer.getCell(6).value = totalBonusRM
    footer.getCell(6).font = { bold: true, size: 11, color: { argb: GREEN_DARK } }
    footer.getCell(6).numFmt = '"Rp"#,##0'
    footer.getCell(6).alignment = { horizontal: 'right', vertical: 'middle' }

    footer.eachCell({ includeEmpty: true }, (c) => {
      c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: AMBER_BG } }
      c.border = BORDER_DOUBLE_BOTTOM
    })

    if (rmData.length > 0) {
      wsRM.autoFilter = { from: { row: 4, column: 1 }, to: { row: 4 + rmData.length, column: 6 } }
    }
  }

  return wb
}

/**
 * Trigger download file Excel (.xlsx) di sisi browser.
 */
export async function exportBonusExcel(params: ExportBonusExcelParams): Promise<string> {
  const wb = await buildBonusWorkbook(params)
  const buf = await wb.xlsx.writeBuffer()
  const blob = new Blob([buf], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  const filename = getExportBonusFilename(params)

  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(url), 1000)

  return filename
}
