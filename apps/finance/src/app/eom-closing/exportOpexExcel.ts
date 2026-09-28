// apps/finance/src/app/eom-closing/exportOpexExcel.ts
import type { OpexSummary, OpexGroup } from '@/lib/eom/opex'

const MONTHS = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
]

const GROUP_LABEL: Record<OpexGroup, string> = {
  global: 'Global (Pusat)',
  internal: 'Internal',
  mitra: 'Mitra',
}

export interface ExportOpexExcelOptions {
  month: number
  year: number
  summary: OpexSummary
  dicetakOleh: string
  picNote?: string
}

export async function generateOpexExcel({
  month,
  year,
  summary,
  dicetakOleh,
  picNote = 'Seluruh realisasi biaya operasional telah diverifikasi kesesuaian dokumen bukti dan rekonsiliasi.',
}: ExportOpexExcelOptions) {
  const ExcelJS = (await import('exceljs')).default || (await import('exceljs'))

  const workbook = new (ExcelJS as any).Workbook()
  workbook.creator = 'PT Suka Kuliner Nusantara'
  workbook.created = new Date()

  const prevMonthNum = month === 1 ? 12 : month - 1
  const prevYearNum = month === 1 ? year - 1 : year
  const prevLabel = `${MONTHS[prevMonthNum - 1]} ${prevYearNum}`
  const curLabel = `${MONTHS[month - 1]} ${year}`

  // -------------------------------------------------------------
  // SHEET 1: REKAP KONSOLIDASI CABANG & UNIT
  // -------------------------------------------------------------
  const sheet1 = workbook.addWorksheet('Rekap Konsolidasi', {
    pageSetup: { orientation: 'landscape', paperSize: 9 },
  })

  // Title Block
  sheet1.mergeCells('A1:I1')
  sheet1.getCell('A1').value = 'SUKA SHAWARMA INDONESIA — PT SUKA KULINER NUSANTARA'
  sheet1.getCell('A1').font = { name: 'Arial', size: 14, bold: true, color: { argb: 'FF3B1D0D' } }

  sheet1.mergeCells('A2:I2')
  sheet1.getCell('A2').value = `BERITA ACARA REKAP BIAYA OPERASIONAL (OPEX) — PERIODE ${curLabel.toUpperCase()}`
  sheet1.getCell('A2').font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FF64748B' } }

  sheet1.mergeCells('A3:I3')
  sheet1.getCell('A3').value = `No. Dokumen: BA/SS/OPX/${year}/${String(month).padStart(2, '0')}/001 | Dicetak oleh: ${dicetakOleh}`
  sheet1.getCell('A3').font = { name: 'Arial', size: 9, italic: true, color: { argb: 'FF166534' } }

  sheet1.addRow([])

  // Header Table 1
  const headerRow1 = sheet1.addRow([
    'No',
    'Outlet / Unit Kerja',
    'Kelompok',
    `OPEX Murni (${curLabel})`,
    `OPEX Murni (${prevLabel})`,
    'Selisih (Rp)',
    'Bahan Baku Non-OPEX',
    'Total Keseluruhan',
    'Status Kelengkapan',
  ])

  headerRow1.eachCell((cell: any) => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF3B1D0D' } }
    cell.font = { name: 'Arial', size: 9, bold: true, color: { argb: 'FFFFFFFF' } }
    cell.alignment = { vertical: 'middle', horizontal: 'center' }
  })

  summary.units.forEach((u, idx) => {
    const diff = u.total - u.totalPrev
    let statusText = 'Lengkap'
    if (u.missing.length > 0) {
      statusText = `Belum Diisi (${u.missing.length})`
    } else if (u.exempted.length > 0) {
      statusText = `Nihil Terverifikasi (${u.exempted.length})`
    }

    const row = sheet1.addRow([
      idx + 1,
      u.unitName.replace('SUKA SHAWARMA ', ''),
      GROUP_LABEL[u.group],
      u.total,
      u.totalPrev,
      diff,
      u.nonOpexTotal,
      u.grandTotal,
      statusText,
    ])

    row.getCell(4).numFmt = '#,##0'
    row.getCell(5).numFmt = '#,##0'
    row.getCell(6).numFmt = '#,##0'
    row.getCell(7).numFmt = '#,##0'
    row.getCell(8).numFmt = '#,##0'
    row.getCell(1).alignment = { horizontal: 'center' }
    row.getCell(3).alignment = { horizontal: 'center' }
    row.getCell(9).alignment = { horizontal: 'center' }

    if (u.missing.length > 0) {
      row.getCell(9).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEF3C7' } }
      row.getCell(9).font = { name: 'Arial', size: 8.5, bold: true, color: { argb: 'FF92400E' } }
    } else if (u.exempted.length > 0) {
      row.getCell(9).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF0FDF4' } }
      row.getCell(9).font = { name: 'Arial', size: 8.5, color: { argb: 'FF166534' } }
    }
  })

  // Grand Total Row
  const totalOpex = summary.units.reduce((s, u) => s + u.total, 0)
  const totalOpexPrev = summary.units.reduce((s, u) => s + u.totalPrev, 0)
  const totalNonOpex = summary.units.reduce((s, u) => s + u.nonOpexTotal, 0)
  const totalGrand = summary.units.reduce((s, u) => s + u.grandTotal, 0)
  const totalDiff = totalOpex - totalOpexPrev

  const totalRow1 = sheet1.addRow([
    'TOTAL',
    `KONSOLIDASI (${summary.units.length} UNIT)`,
    'SEMUA',
    totalOpex,
    totalOpexPrev,
    totalDiff,
    totalNonOpex,
    totalGrand,
    'VERIFIED',
  ])

  totalRow1.eachCell((cell: any) => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEF3C7' } }
    cell.font = { name: 'Arial', size: 9, bold: true, color: { argb: 'FF78350F' } }
  })
  totalRow1.getCell(4).numFmt = '#,##0'
  totalRow1.getCell(5).numFmt = '#,##0'
  totalRow1.getCell(6).numFmt = '#,##0'
  totalRow1.getCell(7).numFmt = '#,##0'
  totalRow1.getCell(8).numFmt = '#,##0'
  totalRow1.getCell(1).alignment = { horizontal: 'center' }
  totalRow1.getCell(3).alignment = { horizontal: 'center' }
  totalRow1.getCell(9).alignment = { horizontal: 'center' }

  sheet1.columns = [
    { width: 6 },
    { width: 34 },
    { width: 16 },
    { width: 22 },
    { width: 22 },
    { width: 20 },
    { width: 22 },
    { width: 22 },
    { width: 22 },
  ]

  // Signatures on Sheet 1
  sheet1.addRow([])
  const noteRow = sheet1.addRow(['CATATAN LAPANGAN PIC:', picNote])
  noteRow.getCell(1).font = { name: 'Arial', size: 9, bold: true, color: { argb: 'FF3B1D0D' } }
  noteRow.getCell(2).font = { name: 'Arial', size: 9, italic: true, color: { argb: 'FF475569' } }

  sheet1.addRow([])
  const sigRow1 = sheet1.addRow(['Disusun Oleh:', '', 'Diverifikasi Oleh:', '', 'Disetujui Oleh:'])
  sigRow1.getCell(1).font = { name: 'Arial', size: 9, bold: true }
  sigRow1.getCell(3).font = { name: 'Arial', size: 9, bold: true }
  sigRow1.getCell(5).font = { name: 'Arial', size: 9, bold: true }

  const sigRow2 = sheet1.addRow(['Staff Finance & Accounting', '', 'Finance Controller / SPV', '', 'Finance Director / Owner'])
  sigRow2.font = { name: 'Arial', size: 8.5, color: { argb: 'FF64748B' } }

  sheet1.addRow([])
  sheet1.addRow([])
  const sigRow3 = sheet1.addRow([`(${dicetakOleh})`, '', '( Finance Controller )', '', '( Direktur Keuangan )'])
  sigRow3.font = { name: 'Arial', size: 9, bold: true }

  // -------------------------------------------------------------
  // SHEET 2: RINGKASAN KLUSTER BEBAN KONSOLIDASI
  // -------------------------------------------------------------
  const sheet2 = workbook.addWorksheet('Kluster Beban', {
    pageSetup: { orientation: 'portrait', paperSize: 9 },
  })

  sheet2.mergeCells('A1:F1')
  sheet2.getCell('A1').value = `RINGKASAN BEBAN BERDASARKAN KLUSTER — ${curLabel.toUpperCase()}`
  sheet2.getCell('A1').font = { name: 'Arial', size: 12, bold: true, color: { argb: 'FF3B1D0D' } }

  sheet2.addRow([])
  const headerRow2 = sheet2.addRow([
    'Kluster Beban',
    'Tipe',
    `Bulan Ini (${curLabel})`,
    `Bulan Lalu (${prevLabel})`,
    'Selisih (Rp)',
    'Varians (%)',
  ])
  headerRow2.eachCell((cell: any) => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF3B1D0D' } }
    cell.font = { name: 'Arial', size: 9, bold: true, color: { argb: 'FFFFFFFF' } }
    cell.alignment = { vertical: 'middle', horizontal: 'center' }
  })

  Object.values(summary.clusterTotals).forEach((ct) => {
    const row = sheet2.addRow([
      ct.label,
      ct.isNonOpex ? 'Non-OPEX (COGS)' : 'OPEX Murni',
      ct.total,
      ct.totalPrev,
      ct.diff,
      ct.diffPct != null ? `${ct.diffPct > 0 ? '+' : ''}${ct.diffPct.toFixed(1)}%` : '—',
    ])
    row.getCell(3).numFmt = '#,##0'
    row.getCell(4).numFmt = '#,##0'
    row.getCell(5).numFmt = '#,##0'
    row.getCell(2).alignment = { horizontal: 'center' }
    row.getCell(6).alignment = { horizontal: 'right' }
    row.getCell(1).font = { name: 'Arial', size: 9, bold: true }
  })

  sheet2.columns = [
    { width: 32 },
    { width: 20 },
    { width: 22 },
    { width: 22 },
    { width: 20 },
    { width: 16 },
  ]

  // -------------------------------------------------------------
  // SHEET 3: RINCIAN KATEGORI PER OUTLET
  // -------------------------------------------------------------
  const sheet3 = workbook.addWorksheet('Rincian per Kategori', {
    pageSetup: { orientation: 'landscape', paperSize: 9 },
  })

  sheet3.mergeCells('A1:G1')
  sheet3.getCell('A1').value = `RINCIAN KATEGORI BEBAN PER OUTLET / UNIT — ${curLabel.toUpperCase()}`
  sheet3.getCell('A1').font = { name: 'Arial', size: 12, bold: true, color: { argb: 'FF3B1D0D' } }

  sheet3.addRow([])
  const headerRow3 = sheet3.addRow([
    'Outlet / Unit',
    'Kluster Beban',
    'Nama Kategori',
    `Bulan Ini (${curLabel})`,
    `Bulan Lalu (${prevLabel})`,
    'Selisih (Rp)',
    'Keterangan / Alasan Nihil',
  ])
  headerRow3.eachCell((cell: any) => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF3B1D0D' } }
    cell.font = { name: 'Arial', size: 9, bold: true, color: { argb: 'FFFFFFFF' } }
    cell.alignment = { vertical: 'middle', horizontal: 'center' }
  })

  summary.units.forEach((u) => {
    const unitTitle = u.unitName.replace('SUKA SHAWARMA ', '')
    u.clusters.forEach((cl) => {
      cl.categories.forEach((cat) => {
        let ket = ''
        if (cat.status === 'nihil') {
          ket = `NIHIL: ${cat.exemption?.quickReason || 'Diverifikasi'}${cat.exemption?.notes ? ` (${cat.exemption.notes})` : ''}`
        } else if (cat.status === 'missing') {
          ket = 'BELUM DIISI'
        } else if (cat.status === 'added') {
          ket = 'Kategori Baru Bulan Ini'
        }

        const row = sheet3.addRow([
          unitTitle,
          cl.label,
          cat.label,
          cat.current,
          cat.previous,
          cat.diff,
          ket,
        ])

        row.getCell(4).numFmt = '#,##0'
        row.getCell(5).numFmt = '#,##0'
        row.getCell(6).numFmt = '#,##0'

        if (cat.status === 'missing') {
          row.getCell(7).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEF3C7' } }
          row.getCell(7).font = { name: 'Arial', size: 8.5, bold: true, color: { argb: 'FF92400E' } }
        } else if (cat.status === 'nihil') {
          row.getCell(7).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF0FDF4' } }
          row.getCell(7).font = { name: 'Arial', size: 8.5, color: { argb: 'FF166534' } }
        }
      })
    })
  })

  sheet3.columns = [
    { width: 28 },
    { width: 25 },
    { width: 25 },
    { width: 20 },
    { width: 20 },
    { width: 18 },
    { width: 38 },
  ]

  // Write and trigger download
  const buffer = await workbook.xlsx.writeBuffer()
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })
  const filename = `BA_OPEX_${MONTHS[month - 1]}_${year}.xlsx`
  if (typeof window !== 'undefined') {
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }
}
