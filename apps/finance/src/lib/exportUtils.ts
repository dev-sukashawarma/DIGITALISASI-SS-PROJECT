import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
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

export function exportToCSV(
  data: any[],
  mode: 'ringkasan' | 'item',
  startDate: string,
  endDate: string,
  outletName: string,
  channelName: string
) {
  let csvContent = `Laporan Omzet Outlet\n`
  csvContent += `Periode: ${startDate} s/d ${endDate}\n`
  csvContent += `Outlet: ${outletName}\n`
  csvContent += `Channel: ${channelName}\n\n`

  if (mode === 'ringkasan') {
    csvContent += 'Tanggal,Nama Outlet,Channel,Jumlah Order,Total Omzet\n'
    data.forEach((row: RingkasanData) => {
      const name = `"${row.outletName}"`
      const channel = `"${row.channel}"`
      csvContent += `${row.date},${name},${channel},${row.totalOrders},${row.totalRevenue}\n`
    })
  } else {
    csvContent += 'Tanggal,Nama Outlet,Channel,Nama Item,Qty Terjual,Total Omzet Item\n'
    data.forEach((row: ItemData) => {
      const oName = `"${row.outletName}"`
      const cName = `"${row.channel}"`
      const iName = `"${row.itemName}"`
      csvContent += `${row.date},${oName},${cName},${iName},${row.totalQty},${row.totalRevenue}\n`
    })
  }

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.setAttribute('href', url)
  link.setAttribute('download', `Laporan_Omzet_${mode}_${startDate}_${endDate}.csv`)
  link.style.visibility = 'hidden'
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}

export async function exportToPDF(
  data: any[],
  mode: 'ringkasan' | 'item',
  startDate: string,
  endDate: string,
  outletName: string,
  channelName: string
) {
  const doc = new jsPDF('landscape')
  
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
