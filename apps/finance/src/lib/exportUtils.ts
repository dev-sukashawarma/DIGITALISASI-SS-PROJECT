import { rupiah, formatNumber } from '@/lib/format'

export type RingkasanData = {
  date: string
  outletId: string
  outletName: string
  channel: string
  totalRevenue: number
  totalOrders: number
}

export type ItemData = {
  date: string
  outletId: string
  outletName: string
  channel: string
  itemName: string
  totalQty: number
  totalRevenue: number
}

export async function exportToExcel(
  data: any[],
  mode: 'ringkasan' | 'item',
  startDate: string,
  endDate: string,
  outletName: string,
  channelName: string
) {
  const ExcelJS = (await import('exceljs')).default
  const { saveAs } = await import('file-saver')
  const workbook = new ExcelJS.Workbook()
  const worksheet = workbook.addWorksheet('Laporan Omzet')

  worksheet.mergeCells('A1:F1')
  const titleCell = worksheet.getCell('A1')
  titleCell.value = 'Laporan Omzet Outlet - SukaShawarma'
  titleCell.font = { size: 16, bold: true }

  worksheet.getCell('A3').value = 'Periode:'
  worksheet.getCell('B3').value = `${startDate} s/d ${endDate}`
  worksheet.getCell('A4').value = 'Outlet:'
  worksheet.getCell('B4').value = outletName
  worksheet.getCell('A5').value = 'Channel:'
  worksheet.getCell('B5').value = channelName

  ;['A3', 'A4', 'A5'].forEach((cell) => {
    worksheet.getCell(cell).font = { bold: true }
  })

  const headerRowIndex = 7
  let headers: string[] = []

  if (mode === 'ringkasan') {
    headers = ['Tanggal', 'Nama Outlet', 'Channel', 'Jumlah Order', 'Total Omzet']
    worksheet.getColumn(1).width = 15
    worksheet.getColumn(2).width = 30
    worksheet.getColumn(3).width = 20
    worksheet.getColumn(4).width = 15
    worksheet.getColumn(5).width = 25
  } else {
    headers = ['Tanggal', 'Nama Outlet', 'Channel', 'Nama Item', 'Qty Terjual', 'Total Omzet Item']
    worksheet.getColumn(1).width = 15
    worksheet.getColumn(2).width = 30
    worksheet.getColumn(3).width = 15
    worksheet.getColumn(4).width = 35
    worksheet.getColumn(5).width = 15
    worksheet.getColumn(6).width = 25
  }

  const headerRow = worksheet.getRow(headerRowIndex)
  headerRow.values = headers

  headerRow.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } }
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFF97316' }
    }
    cell.alignment = { vertical: 'middle', horizontal: 'center' }
  })

  let totalOrder = 0
  let totalOmzet = 0
  let totalQty = 0

  let currentRowIndex = headerRowIndex + 1

  data.forEach((row) => {
    const dataRow = worksheet.getRow(currentRowIndex)
    if (mode === 'ringkasan') {
      dataRow.values = [
        row.date,
        row.outletName,
        row.channel,
        row.totalOrders,
        row.totalRevenue
      ]
      totalOrder += row.totalOrders
      totalOmzet += row.totalRevenue
      
      dataRow.getCell(4).numFmt = '#,##0'
      dataRow.getCell(5).numFmt = 'Rp #,##0'
    } else {
      dataRow.values = [
        row.date,
        row.outletName,
        row.channel,
        row.itemName,
        row.totalQty,
        row.totalRevenue
      ]
      totalQty += row.totalQty
      totalOmzet += row.totalRevenue

      dataRow.getCell(5).numFmt = '#,##0'
      dataRow.getCell(6).numFmt = 'Rp #,##0'
    }
    currentRowIndex++
  })

  const totalRow = worksheet.getRow(currentRowIndex)
  if (mode === 'ringkasan') {
    totalRow.values = ['TOTAL KESELURUHAN', '', '', totalOrder, totalOmzet]
    worksheet.mergeCells(`A${currentRowIndex}:C${currentRowIndex}`)
    
    totalRow.getCell(4).numFmt = '#,##0'
    totalRow.getCell(5).numFmt = 'Rp #,##0'
  } else {
    totalRow.values = ['TOTAL KESELURUHAN', '', '', '', totalQty, totalOmzet]
    worksheet.mergeCells(`A${currentRowIndex}:D${currentRowIndex}`)
    
    totalRow.getCell(5).numFmt = '#,##0'
    totalRow.getCell(6).numFmt = 'Rp #,##0'
  }

  totalRow.eachCell({ includeEmpty: false }, (cell) => {
    cell.font = { bold: true, color: { argb: 'FF000000' } }
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFFFEDD5' }
    }
    if (Number(cell.col) === 1) {
      cell.alignment = { horizontal: 'center' }
    }
  })

  const buffer = await workbook.xlsx.writeBuffer()
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
  saveAs(blob, `Laporan_Omzet_${mode}_${startDate}_${endDate}.xlsx`)
}

export async function exportToPDF(
  data: any[],
  mode: 'ringkasan' | 'item',
  startDate: string,
  endDate: string,
  outletName: string,
  channelName: string
) {
  const { jsPDF } = await import('jspdf')
  const autoTable = (await import('jspdf-autotable')).default
  const doc = new jsPDF({ orientation: 'landscape' })
  
  try {
    const logoUrl = '/logo.png'
    const img = new Image()
    img.src = logoUrl
    await new Promise((resolve, reject) => {
      img.onload = resolve
      img.onerror = reject
    })
    
    doc.addImage(img, 'PNG', 14, 10, 20, 20)
  } catch (err) {
    console.warn("Could not load logo for PDF", err)
  }

  doc.setFontSize(16)
  doc.setTextColor(40)
  doc.text('Laporan Omzet Outlet', 40, 18)
  
  doc.setFontSize(10)
  doc.setTextColor(100)
  doc.text(`Periode  : ${startDate} s/d ${endDate}`, 40, 24)
  doc.text(`Outlet   : ${outletName}`, 40, 29)
  doc.text(`Channel  : ${channelName}`, 40, 34)

  if (mode === 'ringkasan') {
    const tableData = data.map((row: RingkasanData) => [
      row.date,
      row.outletName,
      row.channel,
      formatNumber(row.totalOrders),
      rupiah(row.totalRevenue)
    ])
    
    const totalOmzet = data.reduce((acc, r) => acc + r.totalRevenue, 0)
    const totalOrder = data.reduce((acc, r) => acc + r.totalOrders, 0)

    tableData.push([
      'TOTAL',
      '',
      '',
      formatNumber(totalOrder),
      rupiah(totalOmzet)
    ])

    autoTable(doc, {
      startY: 40,
      head: [['Tanggal', 'Nama Outlet', 'Channel', 'Jumlah Order', 'Total Omzet']],
      body: tableData,
      theme: 'grid',
      headStyles: { fillColor: [249, 115, 22] },
      columnStyles: {
        3: { halign: 'right' },
        4: { halign: 'right' }
      },
      didParseCell: function (data) {
        if (data.row.index === tableData.length - 1) {
          data.cell.styles.fontStyle = 'bold'
          data.cell.styles.fillColor = [255, 237, 213]
        }
      }
    })
  } else {
    const tableData = data.map((row: ItemData) => [
      row.date,
      row.outletName,
      row.channel,
      row.itemName,
      formatNumber(row.totalQty),
      rupiah(row.totalRevenue)
    ])

    const totalOmzet = data.reduce((acc, r) => acc + r.totalRevenue, 0)
    const totalQty = data.reduce((acc, r) => acc + r.totalQty, 0)

    tableData.push([
      'TOTAL',
      '',
      '',
      '',
      formatNumber(totalQty),
      rupiah(totalOmzet)
    ])

    autoTable(doc, {
      startY: 40,
      head: [['Tanggal', 'Nama Outlet', 'Channel', 'Nama Item', 'Qty Terjual', 'Total Omzet Item']],
      body: tableData,
      theme: 'grid',
      headStyles: { fillColor: [249, 115, 22] },
      columnStyles: {
        4: { halign: 'right' },
        5: { halign: 'right' }
      },
      didParseCell: function (data) {
        if (data.row.index === tableData.length - 1) {
          data.cell.styles.fontStyle = 'bold'
          data.cell.styles.fillColor = [255, 237, 213]
        }
      }
    })
  }

  doc.save(`Laporan_Omzet_${mode}_${startDate}_${endDate}.pdf`)
}
