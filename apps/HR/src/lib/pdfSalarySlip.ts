import { rupiah, MONTH_NAMES } from './format'
import type { PayrollRecord } from './types'
import { getPayrollBreakdown } from './payrollBreakdown'
import { isRendyOrDeveloperStaff } from './staffFilters'
import { SUKA_LOGO_BASE64 } from './logoBase64'

export async function generateSalarySlipPdf(slip: PayrollRecord) {
  const { jsPDF } = await import('jspdf')
  const autoTable = (await import('jspdf-autotable')).default

  // Document setup: A5 Portrait (148 x 210 mm)
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a5',
  })

  const b = getPayrollBreakdown(slip)
  const isFinal = slip.status === 'finalized'
  const staffName = slip.outlet_staff?.name || 'Karyawan'
  const roleName = slip.outlet_staff?.role?.replace('_', ' ').toUpperCase() || 'STAFF'
  const outletName = isRendyOrDeveloperStaff(slip.outlet_staff as any)
    ? 'Kantor Pusat'
    : (slip.outlet_staff?.outlets?.name || 'Pusat / Seluruh Outlet')
  const periodText = `${MONTH_NAMES[slip.period_month - 1]} ${slip.period_year}`
  const bankName = slip.outlet_staff?.financials?.bank_name || '-'
  const bankAcc = slip.outlet_staff?.financials?.bank_account_number || '-'
  const currentDate = new Date().toLocaleDateString('id-ID')
  const refCode = `SS/PAY/${slip.period_year}${String(slip.period_month).padStart(2, '0')}/${slip.id ? slip.id.slice(0, 6).toUpperCase() : 'REC001'}`

  // ── 0. Watermark if Draft ──
  if (!isFinal) {
    if (typeof (doc as any).saveGraphicsState === 'function') {
      ;(doc as any).saveGraphicsState()
    }
    doc.setTextColor(245, 244, 240)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(28)
    doc.text('DRAFT — PRATINJAU', 74, 115, { align: 'center', angle: 30 })
    if (typeof (doc as any).restoreGraphicsState === 'function') {
      ;(doc as any).restoreGraphicsState()
    }
  }

  // ── 1. Top Header Banner ──
  // Primary brand brown bar (0, 0, 148, 26)
  doc.setFillColor(58, 20, 16)
  doc.rect(0, 0, 148, 26, 'F')

  // Warm Amber / Gold bottom accent stripe
  doc.setFillColor(217, 119, 6)
  doc.rect(0, 26, 148, 1.2, 'F')

  // Suka Shawarma Logo inside a clean white circular badge
  doc.setFillColor(255, 255, 255)
  doc.circle(20, 13, 9.8, 'F')
  try {
    doc.addImage(SUKA_LOGO_BASE64, 'PNG', 10.5, 3.5, 19, 19)
  } catch (err) {
    console.warn('Could not render logo in PDF:', err)
  }

  // Header Typography
  doc.setTextColor(255, 255, 255)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(13)
  doc.text('SUKA SHAWARMA', 33, 10.5)

  doc.setFontSize(7.5)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(254, 240, 225)
  doc.text('SLIP GAJI RESMI KARYAWAN', 33, 15.5)

  doc.setFont('helvetica', 'bold')
  doc.setTextColor(251, 191, 36) // Warm Gold
  doc.text(`Periode: ${periodText}`, 33, 20.5)

  // Status Badge (Top-Right)
  if (isFinal) {
    doc.setFillColor(220, 252, 231)
    doc.setDrawColor(34, 197, 94)
    doc.setLineWidth(0.3)
    doc.roundedRect(105, 5.5, 33, 7.5, 2, 2, 'FD')
    doc.setTextColor(20, 83, 45)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(7.5)
    doc.text('FINAL / RESMI', 121.5, 10.5, { align: 'center' })
  } else {
    doc.setFillColor(254, 243, 199)
    doc.setDrawColor(245, 158, 11)
    doc.setLineWidth(0.3)
    doc.roundedRect(105, 5.5, 33, 7.5, 2, 2, 'FD')
    doc.setTextColor(146, 64, 14)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(7.5)
    doc.text('DRAFT / PREVIEW', 121.5, 10.5, { align: 'center' })
  }

  // Reference Code & Print Date
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(6.5)
  doc.setTextColor(220, 210, 205)
  doc.text(`Ref: ${refCode}`, 138, 18, { align: 'right' })
  doc.text(`Tgl Cetak: ${currentDate}`, 138, 22, { align: 'right' })

  // ── 2. Employee Profile & Payment Card ──
  doc.setFillColor(250, 250, 250)
  doc.setDrawColor(228, 228, 231)
  doc.setLineWidth(0.2)
  doc.roundedRect(10, 30, 128, 22, 2, 2, 'FD')

  // Center subtle divider
  doc.setDrawColor(235, 235, 238)
  doc.line(74, 32, 74, 50)

  // Left Column: Informasi Karyawan
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(6)
  doc.setTextColor(115, 115, 115)
  doc.text('INFORMASI KARYAWAN', 14, 34.5)

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  doc.setTextColor(58, 20, 16)
  doc.text(staffName, 14, 39.5)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7.5)
  doc.setTextColor(70, 70, 70)
  doc.text(`Jabatan : ${roleName}`, 14, 44)
  doc.text(`Lokasi   : ${outletName}`, 14, 48)

  // Right Column: Rincian Pembayaran
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(6)
  doc.setTextColor(115, 115, 115)
  doc.text('RINCIAN PEMBAYARAN', 78, 34.5)

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8)
  doc.setTextColor(40, 40, 40)
  doc.text(`${bankName} • ${bankAcc}`, 78, 39.5)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7.5)
  doc.setTextColor(70, 70, 70)
  doc.text('Metode : Transfer Bank', 78, 44)

  doc.setFont('helvetica', 'bold')
  if (isFinal) {
    doc.setTextColor(22, 101, 52)
    doc.text('Status   : Terverifikasi (Terkunci)', 78, 48)
  } else {
    doc.setTextColor(180, 83, 9)
    doc.text('Status   : Menunggu Finalisasi HR', 78, 48)
  }

  // ── 3. Table Breakdown (Earnings & Deductions) ──
  const isRewardAbsensi = slip.bonus_note?.toLowerCase().includes('reward absensi')
  const earningsList: [string, string][] = [
    ['Gaji Pokok (Gapok)', rupiah(b.basicSalary)],
  ]
  if (b.overtime > 0) earningsList.push(['Lembur (Overtime)', rupiah(b.overtime)])
  if (b.mealAllowance > 0) earningsList.push(['Uang Makan (Meal)', rupiah(b.mealAllowance)])
  if (b.transportAllowance > 0) earningsList.push(['Uang Transport', rupiah(b.transportAllowance)])
  if (b.communicationAllowance > 0) earningsList.push(['Tunjangan Komunikasi', rupiah(b.communicationAllowance)])
  if (b.salesBonus > 0) {
    earningsList.push([
      isRewardAbsensi ? 'Reward Absensi (Staff Office)' : 'Bonus Penjualan (Sales Bonus)',
      rupiah(b.salesBonus),
    ])
  }
  if (b.positionAllowance > 0) earningsList.push(['Tunjangan Jabatan', rupiah(b.positionAllowance)])

  const deductionsList: [string, string][] = []
  if (b.cashAdvanceDeduction > 0) deductionsList.push(['Potongan Kasbon', `- ${rupiah(b.cashAdvanceDeduction)}`])
  if (b.bpjsDeduction > 0) deductionsList.push(['Potongan BPJS', `- ${rupiah(b.bpjsDeduction)}`])
  if (b.lateDeduction > 0) {
    deductionsList.push([`Denda Telat (${b.lateMinutes}m x Rp1.000)`, `- ${rupiah(b.lateDeduction)}`])
  }
  if (b.otherDeduction > 0) deductionsList.push(['Potongan Lain / Ganti Rugi', `- ${rupiah(b.otherDeduction)}`])
  if (deductionsList.length === 0) deductionsList.push(['Tidak ada potongan', 'Rp 0'])

  const maxRows = Math.max(earningsList.length, deductionsList.length)
  const bodyRows: string[][] = []

  for (let i = 0; i < maxRows; i++) {
    const earn = earningsList[i] || ['', '']
    const ded = deductionsList[i] || ['', '']
    bodyRows.push([earn[0], earn[1], ded[0], ded[1]])
  }

  autoTable(doc, {
    startY: 55,
    head: [['PENERIMAAN (EARNINGS)', 'JUMLAH (RP)', 'POTONGAN (DEDUCTIONS)', 'JUMLAH (RP)']],
    body: bodyRows,
    foot: [
      ['Total Penerimaan', rupiah(b.totalEarnings), 'Total Potongan', b.totalDeductions > 0 ? `- ${rupiah(b.totalDeductions)}` : 'Rp 0'],
    ],
    theme: 'plain',
    headStyles: {
      fillColor: [58, 20, 16],
      textColor: [255, 255, 255],
      fontSize: 7.5,
      fontStyle: 'bold',
      cellPadding: 2.2,
    },
    bodyStyles: {
      fontSize: 7.5,
      textColor: [45, 45, 45],
      cellPadding: 2,
      lineWidth: { bottom: 0.1 },
      lineColor: [230, 230, 230],
    },
    alternateRowStyles: {
      fillColor: [250, 250, 251],
    },
    footStyles: {
      fillColor: [243, 244, 246],
      textColor: [58, 20, 16],
      fontStyle: 'bold',
      fontSize: 8,
      cellPadding: 2.2,
      lineWidth: { top: 0.2, bottom: 0.2 },
      lineColor: [215, 215, 215],
    },
    columnStyles: {
      0: { cellWidth: 40, halign: 'left' },
      1: { cellWidth: 24, halign: 'right' },
      2: { cellWidth: 40, halign: 'left' },
      3: { cellWidth: 24, halign: 'right' },
    },
    didParseCell: (data) => {
      if (data.section === 'foot') {
        if (data.column.index === 1) {
          data.cell.styles.textColor = [22, 101, 52] // Green
        }
        if (data.column.index === 3) {
          data.cell.styles.textColor = [185, 28, 28] // Red
        }
      }
      if (data.section === 'body' && data.column.index === 3) {
        if (data.cell.raw && String(data.cell.raw).startsWith('-')) {
          data.cell.styles.textColor = [185, 28, 28] // Red for deductions
        }
      }
    },
    margin: { left: 10, right: 10 },
  })

  const finalY = (doc as any).lastAutoTable.finalY + 4

  // ── 4. Total Gaji Bersih Card ──
  doc.setFillColor(255, 251, 235)
  doc.setDrawColor(217, 119, 6)
  doc.setLineWidth(0.4)
  doc.roundedRect(10, finalY, 128, 14, 2, 2, 'FD')

  doc.setTextColor(120, 53, 15)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8.5)
  doc.text('TOTAL GAJI BERSIH (TAKE HOME PAY):', 15, finalY + 6.5)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(6.5)
  doc.setTextColor(146, 64, 14)
  doc.text('Hak bersih yang ditransfer setelah seluruh potongan resmi', 15, finalY + 11)

  doc.setFontSize(12.5)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(194, 65, 12)
  doc.text(rupiah(b.takeHomePay), 133, finalY + 9.5, { align: 'right' })

  // ── 5. Signatures Section ──
  const signY = finalY + 20
  doc.setTextColor(100, 100, 100)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7)

  doc.text('Penerima / Karyawan,', 32.5, signY, { align: 'center' })
  doc.text('HR & Payroll Dept,', 115.5, signY, { align: 'center' })

  // If finalized, render official digital verification stamp
  if (isFinal) {
    doc.setFillColor(240, 253, 244)
    doc.setDrawColor(74, 222, 128)
    doc.setLineWidth(0.2)
    doc.roundedRect(100, signY + 3, 31, 8.5, 1.5, 1.5, 'FD')
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(5.5)
    doc.setTextColor(21, 128, 61)
    doc.text('[ VERIFIED & SIGNED ]', 115.5, signY + 6.5, { align: 'center' })
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(5)
    doc.setTextColor(100, 116, 139)
    doc.text('Sistem HR Digital SS', 115.5, signY + 9.8, { align: 'center' })
  }

  doc.setDrawColor(210, 210, 210)
  doc.setLineWidth(0.2)
  doc.line(15, signY + 14, 50, signY + 14)
  doc.line(98, signY + 14, 133, signY + 14)

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(7.5)
  doc.setTextColor(50, 50, 50)
  doc.text(staffName, 32.5, signY + 18, { align: 'center' })
  doc.text('Suka Shawarma Management', 115.5, signY + 18, { align: 'center' })

  // ── 6. Bottom Disclaimer ──
  doc.setDrawColor(230, 230, 230)
  doc.line(10, 201, 138, 201)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(6)
  doc.setTextColor(150, 150, 150)
  doc.text(
    'Dokumen ini diterbitkan resmi secara elektronik oleh HR Suka Shawarma & bersifat RAHASIA (CONFIDENTIAL).',
    74,
    204.5,
    { align: 'center' }
  )

  const cleanStaffName = staffName.replace(/[^a-zA-Z0-9]/g, '_')
  const statusPrefix = isFinal ? 'Slip_Gaji' : 'Draft_Slip_Gaji'
  doc.save(`${statusPrefix}_${cleanStaffName}_${slip.period_month}_${slip.period_year}.pdf`)
}

export const generateSalarySlipPDF = generateSalarySlipPdf

export { buildSalarySlipWhatsAppMessage } from './whatsappSalarySlip'
