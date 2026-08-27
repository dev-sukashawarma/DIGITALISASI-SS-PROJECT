export interface SalesExportItem {
  date: string
  outletName: string
  channelName: string
  itemName: string
  unitPrice: number
  hppSatuan: number
  qty: number
  hppTotal: number
  revenue: number
  adminPlatform: number
  grossProfit: number
  marginGpPct: number
}

export interface SalesExportOptions {
  items: SalesExportItem[]
  outletName: string
  dateRangeText: string
  channelSuffix: string
}

export async function exportSalesToExcel(options: SalesExportOptions) {
  const ExcelJS = (await import('exceljs')).default
  const { saveAs } = await import('file-saver')
  const workbook = new ExcelJS.Workbook()
  const worksheet = workbook.addWorksheet('Rangkuman Penjualan')

  // Set Sheet Properties
  worksheet.views = [{ showGridLines: true }]

  // 1. Header Title
  worksheet.mergeCells('A1:L1')
  const titleCell = worksheet.getCell('A1')
  titleCell.value = 'LAPORAN RANGKUMAN PENJUALAN - SUKASHAWARMA'
  titleCell.font = { name: 'Arial', size: 14, bold: true, color: { argb: 'FFFFFFFF' } }
  titleCell.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF701604' } // Suka Brown / Maroon
  }
  titleCell.alignment = { vertical: 'middle', horizontal: 'center' }
  worksheet.getRow(1).height = 32

  // 2. Metadata Info
  worksheet.mergeCells('A2:L2')
  worksheet.getCell('A2').value = `Periode: ${options.dateRangeText}   |   Outlet: ${options.outletName}   |   Tanggal Unduh: ${new Date().toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}`
  worksheet.getCell('A2').font = { name: 'Arial', size: 9, italic: true, color: { argb: 'FF555555' } }
  worksheet.getCell('A2').alignment = { vertical: 'middle', horizontal: 'left' }
  worksheet.getRow(2).height = 20

  // 3. Table Header
  const headerRowIndex = 4
  const headers = [
    'Tanggal',
    'Outlet / Cabang',
    'Kategori / Channel',
    'Nama Menu / Item',
    'Harga Jual (Rp)',
    'HPP Satuan (Rp)',
    'Qty',
    'Total HPP (Rp)',
    'Total Revenue (Rp)',
    'Potongan / Admin (Rp)',
    'Gross Profit (Rp)',
    'Margin GP (%)'
  ]

  const headerRow = worksheet.getRow(headerRowIndex)
  headerRow.values = headers
  headerRow.height = 26

  headerRow.eachCell((cell) => {
    cell.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FFFFFFFF' } }
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFF97316' } // Suka Orange
    }
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true }
    cell.border = {
      top: { style: 'thin', color: { argb: 'FFDDDDDD' } },
      left: { style: 'thin', color: { argb: 'FFDDDDDD' } },
      bottom: { style: 'medium', color: { argb: 'FFB45309' } },
      right: { style: 'thin', color: { argb: 'FFDDDDDD' } },
    }
  })

  // 4. Data Rows
  let curRow = headerRowIndex + 1
  let sumQty = 0
  let sumHppTotal = 0
  let sumRevenue = 0
  let sumAdmin = 0
  let sumGrossProfit = 0

  options.items.forEach((item, idx) => {
    const row = worksheet.getRow(curRow)
    const isEven = idx % 2 === 0
    const rowBg = isEven ? 'FFFFFFFF' : 'FFFDFBF7' // Soft cream zebra

    row.values = [
      item.date,
      item.outletName,
      item.channelName,
      item.itemName,
      Math.round(item.unitPrice),
      Math.round(item.hppSatuan),
      item.qty,
      Math.round(item.hppTotal),
      Math.round(item.revenue),
      Math.round(item.adminPlatform),
      Math.round(item.grossProfit),
      item.marginGpPct / 100
    ]

    row.height = 20

    // Formats & Alignments
    row.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' }
    row.getCell(2).alignment = { horizontal: 'left', vertical: 'middle' }
    row.getCell(3).alignment = { horizontal: 'left', vertical: 'middle' }
    row.getCell(4).alignment = { horizontal: 'left', vertical: 'middle' }
    row.getCell(5).numFmt = 'Rp #,##0'
    row.getCell(6).numFmt = 'Rp #,##0'
    row.getCell(7).numFmt = '#,##0'
    row.getCell(7).alignment = { horizontal: 'center', vertical: 'middle' }
    row.getCell(8).numFmt = 'Rp #,##0'
    row.getCell(9).numFmt = 'Rp #,##0'
    row.getCell(10).numFmt = 'Rp #,##0'
    row.getCell(11).numFmt = 'Rp #,##0'
    row.getCell(12).numFmt = '0.0%'
    row.getCell(12).alignment = { horizontal: 'right', vertical: 'middle' }

    // Color highlights for gross profit
    if (item.grossProfit < 0) {
      row.getCell(11).font = { name: 'Arial', size: 9, bold: true, color: { argb: 'FFDC2626' } }
      row.getCell(12).font = { name: 'Arial', size: 9, bold: true, color: { argb: 'FFDC2626' } }
    } else {
      row.getCell(11).font = { name: 'Arial', size: 9, bold: true, color: { argb: 'FF047857' } }
    }

    row.eachCell({ includeEmpty: true }, (cell) => {
      if (!cell.font) cell.font = { name: 'Arial', size: 9 }
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: rowBg } }
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFF0F0F0' } },
        left: { style: 'thin', color: { argb: 'FFF0F0F0' } },
        bottom: { style: 'thin', color: { argb: 'FFF0F0F0' } },
        right: { style: 'thin', color: { argb: 'FFF0F0F0' } },
      }
    })

    sumQty += item.qty
    sumHppTotal += item.hppTotal
    sumRevenue += item.revenue
    sumAdmin += item.adminPlatform
    sumGrossProfit += item.grossProfit
    curRow++
  })

  // 5. Total Row
  const totalRow = worksheet.getRow(curRow)
  const totalMarginGp = sumRevenue > 0 ? (sumGrossProfit / sumRevenue) : 0
  totalRow.values = [
    'TOTAL KESELURUHAN',
    '',
    '',
    '',
    '',
    '',
    sumQty,
    Math.round(sumHppTotal),
    Math.round(sumRevenue),
    Math.round(sumAdmin),
    Math.round(sumGrossProfit),
    totalMarginGp
  ]

  worksheet.mergeCells(`A${curRow}:F${curRow}`)
  totalRow.height = 26

  totalRow.eachCell({ includeEmpty: false }, (cell) => {
    cell.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FF701604' } }
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFFFEDD5' } // Soft amber / orange 100
    }
    cell.border = {
      top: { style: 'medium', color: { argb: 'FFF97316' } },
      bottom: { style: 'double', color: { argb: 'FF701604' } },
      left: { style: 'thin', color: { argb: 'FFDDDDDD' } },
      right: { style: 'thin', color: { argb: 'FFDDDDDD' } },
    }
  })

  totalRow.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' }
  totalRow.getCell(7).numFmt = '#,##0'
  totalRow.getCell(7).alignment = { horizontal: 'center', vertical: 'middle' }
  totalRow.getCell(8).numFmt = 'Rp #,##0'
  totalRow.getCell(9).numFmt = 'Rp #,##0'
  totalRow.getCell(10).numFmt = 'Rp #,##0'
  totalRow.getCell(11).numFmt = 'Rp #,##0'
  totalRow.getCell(12).numFmt = '0.0%'
  totalRow.getCell(12).alignment = { horizontal: 'right', vertical: 'middle' }

  // Column Widths
  worksheet.columns = [
    { width: 14 }, // Tanggal
    { width: 26 }, // Outlet
    { width: 28 }, // Kategori / Channel
    { width: 34 }, // Nama Menu
    { width: 16 }, // Harga Jual
    { width: 16 }, // HPP Satuan
    { width: 10 }, // Qty
    { width: 18 }, // Total HPP
    { width: 18 }, // Total Revenue
    { width: 20 }, // Potongan / Admin
    { width: 18 }, // Gross Profit
    { width: 14 }, // Margin GP %
  ]

  const buffer = await workbook.xlsx.writeBuffer()
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
  const cleanOutlet = options.outletName.replace(/[^a-zA-Z0-9]/g, '_')
  const cleanRange = options.dateRangeText.replace(/[^a-zA-Z0-9]/g, '_')
  saveAs(blob, `Laporan_Penjualan_${options.channelSuffix}_${cleanOutlet}_${cleanRange}.xlsx`)
}

export function exportSalesToCSV(options: SalesExportOptions) {
  const { items, outletName, dateRangeText, channelSuffix } = options
  
  let sumQty = 0
  let sumHppTotal = 0
  let sumRevenue = 0
  let sumAdmin = 0
  let sumGrossProfit = 0

  let csvContent = '\uFEFF' // UTF-8 BOM for Excel
  csvContent += `"Tanggal","Outlet / Cabang","Kategori / Channel","Nama Menu / Item","Harga Jual (Rp)","HPP Satuan (Rp)","Qty","Total HPP (Rp)","Total Revenue (Rp)","Potongan / Admin Platform (Rp)","Gross Profit (Rp)","Margin GP (%)"\n`

  items.forEach((item) => {
    const dateStr = `"${item.date}"`
    const outletStr = `"${item.outletName.replace(/"/g, '""')}"`
    const catStr = `"${item.channelName.replace(/"/g, '""')}"`
    const itemStr = `"${item.itemName.replace(/"/g, '""')}"`
    const unitPrice = Math.round(item.unitPrice)
    const hppSatuan = Math.round(item.hppSatuan)
    const hppTotal = Math.round(item.hppTotal)
    const revenue = Math.round(item.revenue)
    const admin = Math.round(item.adminPlatform)
    const gp = Math.round(item.grossProfit)
    const margin = `${item.marginGpPct.toFixed(1)}%`

    csvContent += `${dateStr},${outletStr},${catStr},${itemStr},${unitPrice},${hppSatuan},${item.qty},${hppTotal},${revenue},${admin},${gp},"${margin}"\n`

    sumQty += item.qty
    sumHppTotal += item.hppTotal
    sumRevenue += item.revenue
    sumAdmin += item.adminPlatform
    sumGrossProfit += item.grossProfit
  })

  const totalMargin = sumRevenue > 0 ? ((sumGrossProfit / sumRevenue) * 100).toFixed(1) : '0.0'
  csvContent += `"TOTAL KESELURUHAN","","","","","",${sumQty},${Math.round(sumHppTotal)},${Math.round(sumRevenue)},${Math.round(sumAdmin)},${Math.round(sumGrossProfit)},"${totalMargin}%"\n`

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  const cleanOutlet = outletName.replace(/[^a-zA-Z0-9]/g, '_')
  const cleanRange = dateRangeText.replace(/[^a-zA-Z0-9]/g, '_')
  link.setAttribute('download', `Laporan_Penjualan_${channelSuffix}_${cleanOutlet}_${cleanRange}.csv`)
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}
