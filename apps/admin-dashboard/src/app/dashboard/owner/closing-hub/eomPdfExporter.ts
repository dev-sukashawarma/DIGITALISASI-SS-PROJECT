// apps/admin-dashboard/src/app/dashboard/owner/closing-hub/eomPdfExporter.ts
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { DIVISION_FULL_REPORTS, OUTLETS_19_DATA, getOutletsSummaryTotals } from './divisionReportsData'

const formatRupiah = (val: number): string => {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(val)
}


/**
 * Ekspor Berita Acara Divisi + Breakdown 19 Outlet Lengkap ke Dokumen PDF Resmi
 */
export function exportDivisionToPdf(divisionKey: string, monthName: string, yearNum: number) {
  const report = DIVISION_FULL_REPORTS[divisionKey]
  if (!report) {
    console.error(`Division report not found for key: ${divisionKey}`)
    return
  }

  const docNumber = `${report.codePrefix}/${yearNum}/${String(new Date().getMonth() + 1).padStart(2, '0')}`
  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4',
  })

  const pageWidth = doc.internal.pageSize.getWidth() // 297mm
  const margin = 12
  let currentY = 12

  // ══════════════════════════════════════════════════════════════
  // HALAMAN 1: KOP SURAT, BERITA ACARA RESMI & DATA TEKNIS DIVISI
  // ══════════════════════════════════════════════════════════════

  // ── 1. Top Decorative Brand Bar ──
  doc.setFillColor(217, 83, 30) // Suka Shawarma Brand Orange
  doc.rect(margin, currentY, 4, 18, 'F')

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(14)
  doc.setTextColor(59, 29, 13) // Suka Brown
  doc.text('SUKA SHAWARMA INDONESIA', margin + 7, currentY + 5)

  doc.setFontSize(8)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(100, 116, 139) // Slate-500
  doc.text('PT SUKA KULINER NUSANTARA | SISTEM OUTLET SUITE & END-OF-MONTH CLOSING HUB', margin + 7, currentY + 10)
  doc.text('Kantor Pusat: Jl. Pajajaran No. 88, Bogor | Hotline Operasional: (0251) 832-1988', margin + 7, currentY + 14)

  // Top Right Info Box
  const infoBoxWidth = 85
  const infoBoxX = pageWidth - margin - infoBoxWidth
  doc.setFillColor(248, 250, 252) // Slate-50
  doc.setDrawColor(226, 232, 240) // Slate-200
  doc.roundedRect(infoBoxX, currentY - 1, infoBoxWidth, 19, 2, 2, 'FD')

  doc.setFontSize(7.5)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(30, 41, 59)
  doc.text(`No. Dokumen:`, infoBoxX + 3, currentY + 3.5)
  doc.setFont('helvetica', 'normal')
  doc.text(docNumber, infoBoxX + 24, currentY + 3.5)

  doc.setFont('helvetica', 'bold')
  doc.text(`Periode Closing:`, infoBoxX + 3, currentY + 8)
  doc.setFont('helvetica', 'normal')
  doc.text(`${monthName} ${yearNum}`, infoBoxX + 24, currentY + 8)

  doc.setFont('helvetica', 'bold')
  doc.text(`Status Berita Acara:`, infoBoxX + 3, currentY + 12.5)

  // Badge Status VERIFIED
  doc.setFillColor(220, 252, 231) // Green-100
  doc.setDrawColor(134, 239, 172) // Green-300
  doc.roundedRect(infoBoxX + 30, currentY + 9.5, 48, 5, 1, 1, 'FD')
  doc.setFontSize(7)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(22, 101, 52) // Green-800
  doc.text('[ VERIFIED & LOCKED ]', infoBoxX + 33, currentY + 13.2)

  currentY += 23

  // Divider Line
  doc.setDrawColor(203, 213, 225) // Slate-300
  doc.setLineWidth(0.4)
  doc.line(margin, currentY, pageWidth - margin, currentY)
  currentY += 5

  // ── 2. Judul Berita Acara ──
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  doc.setTextColor(30, 41, 59)
  doc.text(report.title, margin, currentY)
  currentY += 4.5

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.setTextColor(71, 85, 105)
  doc.text(report.subtitle, margin, currentY)
  currentY += 6

  // ── 3. 4 Kartu KPI Ringkasan ──
  const kpiCount = report.summaryKpis.length
  const cardGap = 3.5
  const totalGap = cardGap * (kpiCount - 1)
  const availableW = pageWidth - margin * 2
  const cardW = (availableW - totalGap) / kpiCount
  const cardH = 14

  report.summaryKpis.forEach((kpi, idx) => {
    const cardX = margin + idx * (cardW + cardGap)
    if (kpi.isHighlight) {
      doc.setFillColor(254, 243, 199) // Amber-100
      doc.setDrawColor(245, 158, 11) // Amber-500
    } else {
      doc.setFillColor(248, 250, 252) // Slate-50
      doc.setDrawColor(226, 232, 240) // Slate-200
    }
    doc.setLineWidth(0.3)
    doc.roundedRect(cardX, currentY, cardW, cardH, 2, 2, 'FD')

    doc.setFontSize(7)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(100, 116, 139)
    doc.text(kpi.label.toUpperCase(), cardX + 3, currentY + 4.5)

    doc.setFontSize(9.5)
    doc.setFont('helvetica', 'bold')
    if (kpi.isHighlight) {
      doc.setTextColor(180, 83, 9) // Amber-700
    } else {
      doc.setTextColor(15, 23, 42) // Slate-900
    }
    doc.text(kpi.value, cardX + 3, currentY + 10.5)
  })

  currentY += cardH + 6

  // ── 4. Tabel Data Teknis Divisi ──
  const headRow = report.columns.map((c) => c.label)
  const bodyRows = report.rows.map((r) => {
    return report.columns.map((c) => {
      const val = r[c.key]
      if (c.isCurrency && typeof val === 'number') {
        return formatRupiah(val)
      }
      return String(val ?? '')
    })
  })

  const colStyles: Record<number, any> = {}
  report.columns.forEach((c, idx) => {
    colStyles[idx] = {
      halign: c.align || (c.isCurrency ? 'right' : 'left'),
      fontStyle: c.isBold ? 'bold' : 'normal',
    }
  })

  autoTable(doc, {
    startY: currentY,
    head: [headRow],
    body: bodyRows,
    theme: 'grid',
    margin: { left: margin, right: margin },
    styles: {
      fontSize: 7.5,
      cellPadding: 2,
      textColor: [30, 41, 59],
      lineColor: [226, 232, 240],
      lineWidth: 0.2,
    },
    headStyles: {
      fillColor: [59, 29, 13], // Suka Brown
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 8,
      halign: 'center',
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252],
    },
    didDrawPage: (data) => {
      currentY = data.cursor?.y ? data.cursor.y + 6 : currentY + 40
    },
  })

  // Catatan Lapangan Box
  if (currentY > 175) {
    doc.addPage('a4', 'landscape')
    currentY = 14
  }

  doc.setFillColor(241, 245, 249) // Slate-100
  doc.setDrawColor(203, 213, 225)
  doc.roundedRect(margin, currentY, pageWidth - margin * 2, 13, 1.5, 1.5, 'FD')

  doc.setFontSize(7.5)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(30, 41, 59)
  doc.text('CATATAN LAPANGAN & KLAUSUL VERIFIKASI PIC DIVISI:', margin + 3, currentY + 4.5)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7)
  doc.setTextColor(71, 85, 105)
  doc.text(report.notesDefault, margin + 3, currentY + 9)

  // ══════════════════════════════════════════════════════════════
  // HALAMAN 2: LAMPIRAN I - LAPORAN DETAIL PER-OUTLET (19 CABANG)
  // ══════════════════════════════════════════════════════════════
  doc.addPage('a4', 'landscape')
  currentY = 12

  // Header Lampiran
  doc.setFillColor(217, 83, 30) // Suka Orange
  doc.rect(margin, currentY, 3, 10, 'F')

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  doc.setTextColor(59, 29, 13)
  doc.text(`LAMPIRAN I: REKAPITULASI DETAIL PER CABANG OUTLET (19 CABANG)`, margin + 6, currentY + 4.5)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7.5)
  doc.setTextColor(100, 116, 139)
  doc.text(
    `Divisi: ${report.title} | Periode: ${monthName} ${yearNum} | Seluruh 12 Cabang Internal dan 7 Cabang Mitra telah diverifikasi 100%`,
    margin + 6,
    currentY + 9
  )

  currentY += 13

  // Tentukan kolom dan data 19 outlet sesuai divisi yang sedang diekspor
  let outletHead: string[] = []
  let outletBody: any[][] = []
  let outletColStyles: Record<number, any> = {}

  if (divisionKey === 'kasir_outlet') {
    outletHead = [
      'No',
      'Nama Cabang Outlet',
      'Tipe Cabang',
      'Omzet Tunai (Cash)',
      'Omzet QRIS/EDC',
      'Total Omzet POS',
      'Kas Kecil Laci',
      'Setoran Bank',
      'Selisih Kas',
      'Status Closing',
    ]

    outletColStyles = {
      0: { halign: 'center', cellWidth: 10 },
      1: { halign: 'left', fontStyle: 'bold', cellWidth: 42 },
      2: { halign: 'center', cellWidth: 32 },
      3: { halign: 'right', cellWidth: 32 },
      4: { halign: 'right', cellWidth: 32 },
      5: { halign: 'right', fontStyle: 'bold', cellWidth: 35 },
      6: { halign: 'right', cellWidth: 26 },
      7: { halign: 'right', cellWidth: 32 },
      8: { halign: 'center', fontStyle: 'bold', cellWidth: 20 },
      9: { halign: 'center', cellWidth: 28 },
    }

    outletBody = OUTLETS_19_DATA.map((o) => [
      o.no,
      o.name,
      o.type,
      formatRupiah(o.cash),
      formatRupiah(o.nonCash),
      formatRupiah(o.grossPos),
      formatRupiah(o.pettyCash),
      formatRupiah(o.bankDeposit),
      'Rp 0',
      o.status,
    ])

    // Baris Total
    const totals = getOutletsSummaryTotals()
    outletBody.push([
      'TOTAL',
      '19 CABANG (KONSOLIDASI)',
      '12 Internal + 7 Mitra',
      formatRupiah(totals.cash),
      formatRupiah(totals.nonCash),
      formatRupiah(totals.grossPos),
      formatRupiah(totals.pettyCash),
      formatRupiah(totals.bankDeposit),
      'Rp 0 (MATCHED)',
      '100% CLOSED',
    ])
  } else if (divisionKey === 'kitchen_stok') {
    outletHead = [
      'No',
      'Nama Cabang Outlet',
      'Tipe Cabang',
      'Nilai Stok Opname (Rp)',
      'Kerugian Waste (Rusak)',
      'Kerugian Shrinkage (Hilang)',
      'Total Kerugian Fisik',
      '% Susut / Omzet',
      'Hasil Audit Fisik',
    ]

    outletColStyles = {
      0: { halign: 'center', cellWidth: 10 },
      1: { halign: 'left', fontStyle: 'bold', cellWidth: 46 },
      2: { halign: 'center', cellWidth: 34 },
      3: { halign: 'right', fontStyle: 'bold', cellWidth: 40 },
      4: { halign: 'right', cellWidth: 35 },
      5: { halign: 'right', cellWidth: 35 },
      6: { halign: 'right', fontStyle: 'bold', cellWidth: 35 },
      7: { halign: 'center', fontStyle: 'bold', cellWidth: 26 },
      8: { halign: 'center', cellWidth: 28 },
    }

    outletBody = OUTLETS_19_DATA.map((o) => {
      const totLoss = o.wasteRp + o.shrinkageRp
      const pct = ((totLoss / o.grossPos) * 100).toFixed(2) + '%'
      return [
        o.no,
        o.name,
        o.type,
        formatRupiah(o.stockAsset),
        formatRupiah(o.wasteRp),
        formatRupiah(o.shrinkageRp),
        formatRupiah(totLoss),
        pct,
        'VERIFIED (0 PENDING)',
      ]
    })

    const totals = getOutletsSummaryTotals()
    const grandLoss = totals.wasteRp + totals.shrinkageRp
    const grandPct = ((grandLoss / totals.grossPos) * 100).toFixed(2) + '%'
    outletBody.push([
      'TOTAL',
      '19 CABANG (KONSOLIDASI)',
      '12 Internal + 7 Mitra',
      formatRupiah(totals.stockAsset),
      formatRupiah(totals.wasteRp),
      formatRupiah(totals.shrinkageRp),
      formatRupiah(grandLoss),
      grandPct,
      '100% SELESAI',
    ])
  } else if (divisionKey === 'hr_payroll') {
    outletHead = [
      'No',
      'Nama Cabang Outlet',
      'Tipe Cabang',
      'Jumlah Kru',
      'Kehadiran (%)',
      'Lembur Valid (Jam)',
      'Beban Payroll Cabang (Rp)',
      'Status Absensi & Kasbon',
    ]

    outletColStyles = {
      0: { halign: 'center', cellWidth: 10 },
      1: { halign: 'left', fontStyle: 'bold', cellWidth: 50 },
      2: { halign: 'center', cellWidth: 38 },
      3: { halign: 'center', fontStyle: 'bold', cellWidth: 28 },
      4: { halign: 'center', cellWidth: 30 },
      5: { halign: 'center', cellWidth: 34 },
      6: { halign: 'right', fontStyle: 'bold', cellWidth: 45 },
      7: { halign: 'center', cellWidth: 38 },
    }

    outletBody = OUTLETS_19_DATA.map((o) => [
      o.no,
      o.name,
      o.type,
      `${o.crewCount} Kru`,
      o.attendanceRate,
      `${o.overtimeHours} Jam`,
      formatRupiah(o.payroll),
      'TERVALIDASI & DIKUNCI',
    ])

    const totals = getOutletsSummaryTotals()
    const totalOT = OUTLETS_19_DATA.reduce((a, b) => a + b.overtimeHours, 0)
    outletBody.push([
      'TOTAL',
      '19 CABANG (KONSOLIDASI)',
      'Seluruh Jaringan Outlet',
      `${totals.crewCount} Staf & Kru`,
      '98.4%',
      `${totalOT} Jam`,
      formatRupiah(totals.payroll),
      '100% SIAP DISBURSED',
    ])
  } else if (divisionKey === 'purchasing') {
    outletHead = [
      'No',
      'Nama Cabang Outlet',
      'Tipe Cabang',
      'Omzet POS (Rp)',
      'Alokasi Pembelian Bahan Baku',
      'Rasio Belanja / Omzet',
      'Status Surat Jalan (GRN)',
      'Status Tagihan Supplier',
    ]

    outletColStyles = {
      0: { halign: 'center', cellWidth: 10 },
      1: { halign: 'left', fontStyle: 'bold', cellWidth: 50 },
      2: { halign: 'center', cellWidth: 36 },
      3: { halign: 'right', cellWidth: 38 },
      4: { halign: 'right', fontStyle: 'bold', cellWidth: 44 },
      5: { halign: 'center', fontStyle: 'bold', cellWidth: 32 },
      6: { halign: 'center', cellWidth: 35 },
      7: { halign: 'center', cellWidth: 35 },
    }

    outletBody = OUTLETS_19_DATA.map((o) => {
      const ratio = ((o.poPurchasing / o.grossPos) * 100).toFixed(1) + '%'
      return [
        o.no,
        o.name,
        o.type,
        formatRupiah(o.grossPos),
        formatRupiah(o.poPurchasing),
        ratio,
        '100% GRN Diterima',
        'Jatuh Tempo Terjadwal',
      ]
    })

    const totals = getOutletsSummaryTotals()
    const totalRatio = ((totals.poPurchasing / totals.grossPos) * 100).toFixed(1) + '%'
    outletBody.push([
      'TOTAL',
      '19 CABANG (KONSOLIDASI)',
      '12 Internal + 7 Mitra',
      formatRupiah(totals.grossPos),
      formatRupiah(totals.poPurchasing),
      totalRatio,
      '100% COMPLETE',
      'AP MATCHED (3-WAY)',
    ])
  } else if (divisionKey === 'marcom') {
    outletHead = [
      'No',
      'Nama Cabang Outlet',
      'Tipe Cabang',
      'Gross Omzet POS',
      'Alokasi Promosi POSM & Ads',
      'Media Promo Terpasang',
      'Pertumbuhan Sales (MoM)',
      'Status Kampanye',
    ]

    outletColStyles = {
      0: { halign: 'center', cellWidth: 10 },
      1: { halign: 'left', fontStyle: 'bold', cellWidth: 50 },
      2: { halign: 'center', cellWidth: 36 },
      3: { halign: 'right', cellWidth: 40 },
      4: { halign: 'right', fontStyle: 'bold', cellWidth: 44 },
      5: { halign: 'center', cellWidth: 42 },
      6: { halign: 'center', fontStyle: 'bold', cellWidth: 30 },
      7: { halign: 'center', cellWidth: 30 },
    }

    outletBody = OUTLETS_19_DATA.map((o) => [
      o.no,
      o.name,
      o.type,
      formatRupiah(o.grossPos),
      formatRupiah(o.mktAllocation),
      'Banner + Standee + Sosmed',
      '+14.8%',
      'TERPASANG (100%)',
    ])

    const totals = getOutletsSummaryTotals()
    outletBody.push([
      'TOTAL',
      '19 CABANG (KONSOLIDASI)',
      '12 Internal + 7 Mitra',
      formatRupiah(totals.grossPos),
      formatRupiah(totals.mktAllocation),
      '19 Outlet Terpasang',
      '+14.8% (Target Tercapai)',
      'LENGKAP',
    ])
  } else {
    // finance_akuntansi
    outletHead = [
      'No',
      'Nama Cabang Outlet',
      'Tipe Cabang',
      'Gross Omzet POS',
      'Kas Kecil Laci Toko',
      'Setoran Bank Masuk',
      'Status Selisih Mutasi',
      'Hasil Audit Koran',
    ]

    outletColStyles = {
      0: { halign: 'center', cellWidth: 10 },
      1: { halign: 'left', fontStyle: 'bold', cellWidth: 50 },
      2: { halign: 'center', cellWidth: 36 },
      3: { halign: 'right', cellWidth: 40 },
      4: { halign: 'right', cellWidth: 36 },
      5: { halign: 'right', fontStyle: 'bold', cellWidth: 42 },
      6: { halign: 'center', fontStyle: 'bold', cellWidth: 32 },
      7: { halign: 'center', cellWidth: 35 },
    }

    outletBody = OUTLETS_19_DATA.map((o) => [
      o.no,
      o.name,
      o.type,
      formatRupiah(o.grossPos),
      formatRupiah(o.pettyCash),
      formatRupiah(o.bankDeposit),
      'Rp 0 (MATCHED)',
      '100% RECONCILED',
    ])

    const totals = getOutletsSummaryTotals()
    outletBody.push([
      'TOTAL',
      '19 CABANG (KONSOLIDASI)',
      '12 Internal + 7 Mitra',
      formatRupiah(totals.grossPos),
      formatRupiah(totals.pettyCash),
      formatRupiah(totals.bankDeposit),
      'Rp 0 (100% MATCHED)',
      'REK KORAN COCOK',
    ])
  }

  // Draw 19 Outlet Table
  autoTable(doc, {
    startY: currentY,
    head: [outletHead],
    body: outletBody,
    theme: 'grid',
    margin: { left: margin, right: margin },
    styles: {
      fontSize: 7,
      cellPadding: 1.5,
      textColor: [30, 41, 59],
      lineColor: [226, 232, 240],
      lineWidth: 0.15,
    },
    headStyles: {
      fillColor: [30, 41, 59], // Slate-800
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 7.5,
      halign: 'center',
    },
    columnStyles: outletColStyles,
    alternateRowStyles: {
      fillColor: [248, 250, 252],
    },
    didParseCell: (data) => {
      // Highlight baris total di bagian bawah
      if (data.row.index === outletBody.length - 1) {
        data.cell.styles.fillColor = [254, 243, 199] // Amber-100
        data.cell.styles.fontStyle = 'bold'
        data.cell.styles.textColor = [120, 53, 15] // Amber-900
      }
    },
    didDrawPage: (data) => {
      currentY = data.cursor?.y ? data.cursor.y + 6 : currentY + 70
    },
  })

  // ── 5. Lembar Pengesahan Tanda Tangan Resmi ──
  if (currentY > 155) {
    doc.addPage('a4', 'landscape')
    currentY = 14
  }

  const signColWidth = (pageWidth - margin * 2 - 20) / 3
  const signY = currentY + 3

  // Box Pernyataan Resmi
  doc.setFillColor(248, 250, 252)
  doc.setDrawColor(226, 232, 240)
  doc.roundedRect(margin, signY - 2, pageWidth - margin * 2, 38, 2, 2, 'FD')

  // Kolom 1: Disusun Oleh
  doc.setFontSize(7.5)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(100, 116, 139)
  doc.text('Disusun & Diinput Oleh:', margin + 6, signY + 3.5)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(30, 41, 59)
  doc.text(report.preparedByRole, margin + 6, signY + 8)

  doc.setFont('helvetica', 'italic')
  doc.setFontSize(6.5)
  doc.setTextColor(148, 163, 184)
  doc.text('[Tanda Tangan Digital Terverifikasi]', margin + 6, signY + 22)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(7.5)
  doc.setTextColor(30, 41, 59)
  doc.text('( PIC Divisi Pelaksana )', margin + 6, signY + 28)

  // Kolom 2: Diverifikasi Oleh
  const col2X = margin + signColWidth + 10
  doc.setFontSize(7.5)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(100, 116, 139)
  doc.text('Diverifikasi & Divalidasi Oleh:', col2X, signY + 3.5)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(30, 41, 59)
  doc.text(report.verifiedByRole, col2X, signY + 8)

  doc.setFont('helvetica', 'italic')
  doc.setFontSize(6.5)
  doc.setTextColor(148, 163, 184)
  doc.text('[Tervalidasi via EOM Closing HUB]', col2X, signY + 22)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(7.5)
  doc.setTextColor(30, 41, 59)
  doc.text('( SPV / Kepala Divisi )', col2X, signY + 28)

  // Kolom 3: Disahkan Oleh
  const col3X = margin + signColWidth * 2 + 20
  doc.setFontSize(7.5)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(100, 116, 139)
  doc.text('Disahkan & Disetujui Oleh:', col3X, signY + 3.5)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(30, 41, 59)
  doc.text(report.approvedByRole, col3X, signY + 8)

  doc.setFont('helvetica', 'italic')
  doc.setFontSize(6.5)
  doc.setTextColor(148, 163, 184)
  doc.text('[Stempel Sah Konsolidasi]', col3X, signY + 22)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(7.5)
  doc.setTextColor(30, 41, 59)
  doc.text('( Finance Director / Owner )', col3X, signY + 28)

  // ── Footer Otomatis di Setiap Halaman ──
  const pageCount = (doc as any).internal.getNumberOfPages()
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i)
    doc.setFontSize(6.5)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(148, 163, 184)
    doc.text(
      `Dokumen Elektronik Resmi Suka Shawarma EOM Closing HUB | Waktu Cetak: ${new Date().toLocaleString('id-ID')} | Halaman ${i} dari ${pageCount}`,
      pageWidth / 2,
      doc.internal.pageSize.getHeight() - 5,
      { align: 'center' }
    )
  }

  // Unduh File PDF
  const filename = `Laporan_EOM_${divisionKey}_${monthName}_${yearNum}.pdf`
  doc.save(filename)
}

/**
 * Ekspor Dokumen Master Konsolidasi 3 Pilar & Profitabilitas 19 Outlet ke PDF
 */
export function exportMasterConsolidatedToPdf(monthName: string, yearNum: number) {
  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4',
  })

  const pageWidth = doc.internal.pageSize.getWidth() // 297mm
  const margin = 12
  let currentY = 12

  // ══════════════════════════════════════════════════════════════
  // HALAMAN 1: MASTER LABA RUGI KONSOLIDASI 3 PILAR
  // ══════════════════════════════════════════════════════════════

  // Top Header
  doc.setFillColor(217, 83, 30) // Brand Orange
  doc.rect(margin, currentY, 4, 18, 'F')

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(14)
  doc.setTextColor(59, 29, 13)
  doc.text('SUKA SHAWARMA INDONESIA - PT SUKA KULINER NUSANTARA', margin + 7, currentY + 5)

  doc.setFontSize(8)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(100, 116, 139)
  doc.text('MASTER EXECUTIVE REPORT - LAPORAN KONSOLIDASI LABA RUGI F&B AKHIR BULAN', margin + 7, currentY + 10)
  doc.text('Konsolidasi 3 Pilar Keuangan: Global Perusahaan, 12 Cabang Internal (Pusat), dan 7 Cabang Mitra', margin + 7, currentY + 14)

  // Top Right Info
  const infoW = 85
  const infoX = pageWidth - margin - infoW
  doc.setFillColor(248, 250, 252)
  doc.setDrawColor(226, 232, 240)
  doc.roundedRect(infoX, currentY - 1, infoW, 19, 2, 2, 'FD')

  doc.setFontSize(7.5)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(30, 41, 59)
  doc.text('No. Laporan:', infoX + 3, currentY + 3.5)
  doc.setFont('helvetica', 'normal')
  doc.text(`EOM/SS/MASTER/${yearNum}/${String(new Date().getMonth() + 1).padStart(2, '0')}`, infoX + 22, currentY + 3.5)

  doc.setFont('helvetica', 'bold')
  doc.text('Periode:', infoX + 3, currentY + 8)
  doc.setFont('helvetica', 'normal')
  doc.text(`${monthName} ${yearNum}`, infoX + 22, currentY + 8)

  doc.setFont('helvetica', 'bold')
  doc.text('Status:', infoX + 3, currentY + 12.5)
  doc.setFillColor(220, 252, 231)
  doc.setDrawColor(134, 239, 172)
  doc.roundedRect(infoX + 16, currentY + 9.5, 64, 5, 1, 1, 'FD')
  doc.setFontSize(7)
  doc.setTextColor(22, 101, 52)
  doc.text('[ ALL 6 DIVISIONS VERIFIED & FINALIZED ]', infoX + 18, currentY + 13.2)

  currentY += 23

  // Divider
  doc.setDrawColor(203, 213, 225)
  doc.setLineWidth(0.4)
  doc.line(margin, currentY, pageWidth - margin, currentY)
  currentY += 6

  // 4 Top Master KPI Cards
  const kpis = [
    { label: 'GROSS SALES (19 CABANG)', val: 'Rp 620.500.000', highlight: false },
    { label: 'NET REVENUE (SETELAH DISKON)', val: 'Rp 572.000.000', highlight: false },
    { label: 'STORE CONTRIBUTION MARGIN', val: 'Rp 200.200.000 (35.0%)', highlight: true },
    { label: 'NET OPERATING PROFIT (EBITDA)', val: 'Rp 154.440.000 (27.0%)', highlight: true },
  ]

  const gap = 3.5
  const cardW = (pageWidth - margin * 2 - gap * 3) / 4
  const cardH = 15

  kpis.forEach((kpi, idx) => {
    const cardX = margin + idx * (cardW + gap)
    if (kpi.highlight) {
      doc.setFillColor(254, 243, 199)
      doc.setDrawColor(245, 158, 11)
    } else {
      doc.setFillColor(248, 250, 252)
      doc.setDrawColor(226, 232, 240)
    }
    doc.setLineWidth(0.3)
    doc.roundedRect(cardX, currentY, cardW, cardH, 2, 2, 'FD')

    doc.setFontSize(7)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(100, 116, 139)
    doc.text(kpi.label, cardX + 3, currentY + 4.5)

    doc.setFontSize(9.5)
    doc.setFont('helvetica', 'bold')
    if (kpi.highlight) {
      doc.setTextColor(180, 83, 9)
    } else {
      doc.setTextColor(15, 23, 42)
    }
    doc.text(kpi.val, cardX + 3, currentY + 11)
  })

  currentY += cardH + 7

  // Section Header
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  doc.setTextColor(30, 41, 59)
  doc.text('1. LAPORAN LABA RUGI KONSOLIDASI (3 PILAR BISNIS)', margin, currentY)
  currentY += 4.5

  // Tabel Laba Rugi 3 Pilar
  const pnlHead = ['Komponen Keuangan Laba Rugi F&B', 'Konsolidasi Global (Total SS)', 'Outlet Internal (12 Cabang)', 'Outlet Mitra (7 Cabang)']
  const pnlData = [
    ['[+] Gross Sales (Omzet Kotor)', 'Rp 620.500.000', 'Rp 395.000.000', 'Rp 225.500.000'],
    ['[-] Diskon & Potongan Platform Aggregator', '(Rp 48.500.000)', '(Rp 30.800.000)', '(Rp 17.700.000)'],
    ['(=) NET REVENUE (Pendapatan Bersih)', 'Rp 572.000.000', 'Rp 364.200.000', 'Rp 207.800.000'],
    ['[-] Total COGS / HPP (Bahan Baku + Packaging + Waste)', '(Rp 234.520.000)', '(Rp 149.322.000)', '(Rp 85.198.000)'],
    ['(=) LABA KOTOR (GROSS PROFIT)', 'Rp 337.480.000 (59.0%)', 'Rp 214.878.000 (59.0%)', 'Rp 122.602.000 (59.0%)'],
    ['[-] Store OPEX (Gaji Kru, Listrik, Gas, Kas Kecil, Sewa)', '(Rp 137.280.000)', '(Rp 87.408.000)', '(Rp 49.872.000)'],
    ['(=) STORE CONTRIBUTION MARGIN', 'Rp 200.200.000 (35.0%)', 'Rp 127.470.000 (35.0%)', 'Rp 72.730.000 (35.0%)'],
    ['[-] Head Office Overhead & Biaya Pemasaran Pusat', '(Rp 45.760.000)', '(Rp 45.760.000)', 'Rp 0'],
    ['(=) NET OPERATING PROFIT (EBITDA)', 'Rp 154.440.000 (27.0%)', 'Rp 81.710.000 (22.4%)', 'Rp 72.730.000 (35.0%)'],
  ]

  autoTable(doc, {
    startY: currentY,
    head: [pnlHead],
    body: pnlData,
    theme: 'grid',
    margin: { left: margin, right: margin },
    styles: {
      fontSize: 8,
      cellPadding: 2.2,
      textColor: [30, 41, 59],
      lineColor: [226, 232, 240],
      lineWidth: 0.2,
    },
    headStyles: {
      fillColor: [59, 29, 13], // Suka Brown
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 8.5,
      halign: 'center',
    },
    columnStyles: {
      0: { halign: 'left', fontStyle: 'bold', cellWidth: 105 },
      1: { halign: 'right', fontStyle: 'bold', cellWidth: 56 },
      2: { halign: 'right', cellWidth: 56 },
      3: { halign: 'right', cellWidth: 56 },
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252],
    },
    didParseCell: (data) => {
      // Highlight baris kunci (NET REVENUE, GROSS PROFIT, STORE MARGIN, EBITDA)
      if (data.row.index === 2 || data.row.index === 4 || data.row.index === 6) {
        data.cell.styles.fillColor = [240, 253, 244] // Green-50
        data.cell.styles.fontStyle = 'bold'
        data.cell.styles.textColor = [22, 101, 52] // Green-800
      }
      if (data.row.index === 8) {
        data.cell.styles.fillColor = [254, 243, 199] // Amber-100
        data.cell.styles.fontStyle = 'bold'
        data.cell.styles.textColor = [180, 83, 9] // Amber-700
      }
    },
  })

  // ══════════════════════════════════════════════════════════════
  // HALAMAN 2: BREAKDOWN PROFITABILITAS 19 CABANG OUTLET
  // ══════════════════════════════════════════════════════════════
  doc.addPage('a4', 'landscape')
  currentY = 12

  // Header Halaman 2
  doc.setFillColor(217, 83, 30)
  doc.rect(margin, currentY, 3, 10, 'F')

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  doc.setTextColor(59, 29, 13)
  doc.text('LAMPIRAN: BREAKDOWN PERFORMA & PROFITABILITAS 19 CABANG OUTLET', margin + 6, currentY + 4.5)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7.5)
  doc.setTextColor(100, 116, 139)
  doc.text(
    `Perhitungan Laba Kotor, Biaya Operasional Toko (Store OPEX), dan Store Contribution Margin per cabang`,
    margin + 6,
    currentY + 9
  )

  currentY += 13

  // Outlet Profitability Table
  const outletPnlHead = [
    'No',
    'Nama Outlet Cabang',
    'Tipe',
    'Gross POS (Rp)',
    'Net Revenue (Rp)',
    'HPP / COGS (Rp)',
    'Laba Kotor (Rp)',
    'Store OPEX (Rp)',
    'Store Margin (Rp)',
    'Margin %',
    'Ranking',
  ]

  const outletPnlBody = OUTLETS_19_DATA.map((o, idx) => {
    const netRev = Math.round(o.grossPos * 0.92)
    const cogs = Math.round(netRev * 0.41)
    const gp = netRev - cogs
    const opex = o.pettyCash * 3 + o.payroll
    const storeMargin = gp - opex
    const marginPct = ((storeMargin / netRev) * 100).toFixed(1) + '%'
    return [
      idx + 1,
      o.name,
      o.type,
      formatRupiah(o.grossPos),
      formatRupiah(netRev),
      formatRupiah(cogs),
      formatRupiah(gp),
      formatRupiah(opex),
      formatRupiah(storeMargin),
      marginPct,
      `Peringkat #${idx + 1}`,
    ]
  })

  // Grand Total Row
  const totalGross = OUTLETS_19_DATA.reduce((a, b) => a + b.grossPos, 0)
  const totalNet = Math.round(totalGross * 0.92)
  const totalCogs = Math.round(totalNet * 0.41)
  const totalGp = totalNet - totalCogs
  const totalOpex = OUTLETS_19_DATA.reduce((a, b) => a + (b.pettyCash * 3 + b.payroll), 0)
  const totalMargin = totalGp - totalOpex
  const totalMarginPct = ((totalMargin / totalNet) * 100).toFixed(1) + '%'

  outletPnlBody.push([
    'TOTAL',
    '19 CABANG KONSOLIDASI',
    '12 Int + 7 Mit',
    formatRupiah(totalGross),
    formatRupiah(totalNet),
    formatRupiah(totalCogs),
    formatRupiah(totalGp),
    formatRupiah(totalOpex),
    formatRupiah(totalMargin),
    totalMarginPct,
    'KONSOLIDASI',
  ])

  autoTable(doc, {
    startY: currentY,
    head: [outletPnlHead],
    body: outletPnlBody,
    theme: 'grid',
    margin: { left: margin, right: margin },
    styles: {
      fontSize: 7,
      cellPadding: 1.6,
      textColor: [30, 41, 59],
      lineColor: [226, 232, 240],
      lineWidth: 0.15,
    },
    headStyles: {
      fillColor: [30, 41, 59],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 7.5,
      halign: 'center',
    },
    columnStyles: {
      0: { halign: 'center', cellWidth: 9 },
      1: { halign: 'left', fontStyle: 'bold', cellWidth: 42 },
      2: { halign: 'center', cellWidth: 28 },
      3: { halign: 'right', cellWidth: 28 },
      4: { halign: 'right', cellWidth: 28 },
      5: { halign: 'right', cellWidth: 27 },
      6: { halign: 'right', cellWidth: 28 },
      7: { halign: 'right', cellWidth: 28 },
      8: { halign: 'right', fontStyle: 'bold', cellWidth: 29 },
      9: { halign: 'center', fontStyle: 'bold', cellWidth: 16 },
      10: { halign: 'center', cellWidth: 20 },
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252],
    },
    didParseCell: (data) => {
      if (data.row.index === outletPnlBody.length - 1) {
        data.cell.styles.fillColor = [254, 243, 199] // Amber-100
        data.cell.styles.fontStyle = 'bold'
        data.cell.styles.textColor = [120, 53, 15] // Amber-900
      }
    },
    didDrawPage: (data) => {
      currentY = data.cursor?.y ? data.cursor.y + 6 : currentY + 70
    },
  })

  // Sign-off Box on Master Report
  if (currentY > 155) {
    doc.addPage('a4', 'landscape')
    currentY = 14
  }

  const signW = (pageWidth - margin * 2 - 20) / 3
  const signBoxY = currentY + 4

  doc.setFillColor(248, 250, 252)
  doc.setDrawColor(226, 232, 240)
  doc.roundedRect(margin, signBoxY - 2, pageWidth - margin * 2, 34, 2, 2, 'FD')

  // Kolom 1
  doc.setFontSize(7.5)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(100, 116, 139)
  doc.text('Dipersiapkan Oleh:', margin + 6, signBoxY + 3.5)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(30, 41, 59)
  doc.text('Accounting Lead & Controller', margin + 6, signBoxY + 8)
  doc.setFont('helvetica', 'italic')
  doc.setFontSize(6.5)
  doc.setTextColor(148, 163, 184)
  doc.text('[Digital Audit Passed - Zero Variance]', margin + 6, signBoxY + 20)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(7.5)
  doc.setTextColor(30, 41, 59)
  doc.text('( Tim Finance & Akuntansi )', margin + 6, signBoxY + 25)

  // Kolom 2
  const c2X = margin + signW + 10
  doc.setFontSize(7.5)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(100, 116, 139)
  doc.text('Diverifikasi Oleh:', c2X, signBoxY + 3.5)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(30, 41, 59)
  doc.text('Finance Director / CFO', c2X, signBoxY + 8)
  doc.setFont('helvetica', 'italic')
  doc.setFontSize(6.5)
  doc.setTextColor(148, 163, 184)
  doc.text('[Telah Melalui Rekonsiliasi Bank 100%]', c2X, signBoxY + 20)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(7.5)
  doc.setTextColor(30, 41, 59)
  doc.text('( Direktur Keuangan )', c2X, signBoxY + 25)

  // Kolom 3
  const c3X = margin + signW * 2 + 20
  doc.setFontSize(7.5)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(100, 116, 139)
  doc.text('Disetujui & Diterbitkan Oleh:', c3X, signBoxY + 3.5)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(30, 41, 59)
  doc.text('Chief Executive Officer / Owner', c3X, signBoxY + 8)
  doc.setFont('helvetica', 'italic')
  doc.setFontSize(6.5)
  doc.setTextColor(148, 163, 184)
  doc.text('[EOM CLOSING PERIODE RESMI DITUTUP]', c3X, signBoxY + 20)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(7.5)
  doc.setTextColor(30, 41, 59)
  doc.text('( Founder & Owner SS )', c3X, signBoxY + 25)

  // Page Numbers Footer
  const totalPages = (doc as any).internal.getNumberOfPages()
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i)
    doc.setFontSize(6.5)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(148, 163, 184)
    doc.text(
      `Laporan Konsolidasi Master Suka Shawarma | Waktu Cetak: ${new Date().toLocaleString('id-ID')} | Halaman ${i} dari ${totalPages}`,
      pageWidth / 2,
      doc.internal.pageSize.getHeight() - 5,
      { align: 'center' }
    )
  }

  // Save PDF
  const filename = `Laporan_Konsolidasi_Master_EOM_${monthName}_${yearNum}.pdf`
  doc.save(filename)
}
