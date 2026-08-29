import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { rupiah, MONTH_NAMES } from './format'
import type { PayrollRecord } from './types'
import { getPayrollBreakdown } from './payrollBreakdown'

export function generateSalarySlipPdf(slip: PayrollRecord) {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a5',
  })

  const b = getPayrollBreakdown(slip)
  const staffName = slip.outlet_staff?.name || 'Karyawan'
  const roleName = slip.outlet_staff?.role?.replace('_', ' ').toUpperCase() || 'STAFF'
  const outletName = slip.outlet_staff?.outlets?.name || 'Pusat / Seluruh Outlet'
  const periodText = `${MONTH_NAMES[slip.period_month - 1]} ${slip.period_year}`
  const bankName = slip.outlet_staff?.financials?.bank_name || '-'
  const bankAcc = slip.outlet_staff?.financials?.bank_account_number || '-'

  // Header Banner
  doc.setFillColor(74, 23, 19)
  doc.rect(0, 0, 148, 24, 'F')

  doc.setTextColor(255, 255, 255)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(14)
  doc.text('SUKA SHAWARMA', 10, 10)

  doc.setFontSize(9)
  doc.setFont('helvetica', 'normal')
  doc.text('SLIP GAJI RESMI KARYAWAN', 10, 15)
  doc.text(`Periode: ${periodText}`, 10, 20)

  // Status Badge
  doc.setFillColor(242, 151, 68)
  doc.roundedRect(105, 7, 33, 10, 2, 2, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8)
  doc.text(slip.status === 'finalized' ? 'FINAL / PAID' : 'DRAFT', 121.5, 13.5, { align: 'center' })

  // Data Staf Section
  doc.setTextColor(40, 40, 40)
  doc.setFontSize(8)

  doc.setFont('helvetica', 'bold')
  doc.text('Nama Staf', 10, 32)
  doc.text('Jabatan', 10, 37)
  doc.text('Outlet / Lokasi', 10, 42)

  doc.setFont('helvetica', 'normal')
  doc.text(`: ${staffName}`, 35, 32)
  doc.text(`: ${roleName}`, 35, 37)
  doc.text(`: ${outletName}`, 35, 42)

  doc.setFont('helvetica', 'bold')
  doc.text('Bank & Rekening', 80, 32)
  doc.text('Tanggal Cetak', 80, 37)

  doc.setFont('helvetica', 'normal')
  doc.text(`: ${bankName} - ${bankAcc}`, 105, 32)
  doc.text(`: ${new Date().toLocaleDateString('id-ID')}`, 105, 37)

  // Table with explicit Breakdown
  const earningsList: [string, string][] = [
    ['Gaji Pokok (Gapok)', rupiah(b.basicSalary)],
  ]
  if (b.overtime > 0) earningsList.push(['Lembur (Overtime)', rupiah(b.overtime)])
  if (b.mealAllowance > 0) earningsList.push(['Uang Makan (Meal)', rupiah(b.mealAllowance)])
  if (b.transportAllowance > 0) earningsList.push(['Uang Transport', rupiah(b.transportAllowance)])
  if (b.communicationAllowance > 0) earningsList.push(['Tunjangan Komunikasi', rupiah(b.communicationAllowance)])
  if (b.salesBonus > 0) earningsList.push(['Bonus Penjualan (Sales Bonus)', rupiah(b.salesBonus)])
  if (b.positionAllowance > 0) earningsList.push(['Tunjangan Jabatan', rupiah(b.positionAllowance)])

  const deductionsList: [string, string][] = []
  if (b.cashAdvanceDeduction > 0) deductionsList.push(['Potongan Kasbon', rupiah(b.cashAdvanceDeduction)])
  if (b.lateDeduction > 0) {
    deductionsList.push([`Denda Telat (${b.lateMinutes}m x Rp1.000)`, rupiah(b.lateDeduction)])
  }
  if (b.otherDeduction > 0) deductionsList.push(['Potongan Lain / Ganti Rugi', rupiah(b.otherDeduction)])
  if (deductionsList.length === 0) deductionsList.push(['Tidak ada potongan', 'Rp 0'])

  const maxRows = Math.max(earningsList.length, deductionsList.length)
  const bodyRows: string[][] = []

  for (let i = 0; i < maxRows; i++) {
    const earn = earningsList[i] || ['', '']
    const ded = deductionsList[i] || ['', '']
    bodyRows.push([earn[0], earn[1], ded[0], ded[1]])
  }

  autoTable(doc, {
    startY: 47,
    head: [['PENERIMAAN (EARNINGS)', 'JUMLAH (RP)', 'POTONGAN (DEDUCTIONS)', 'JUMLAH (RP)']],
    body: bodyRows,
    foot: [
      ['Total Penerimaan', rupiah(b.totalEarnings), 'Total Potongan', rupiah(b.totalDeductions)],
    ],
    theme: 'grid',
    headStyles: {
      fillColor: [74, 23, 19],
      textColor: [255, 255, 255],
      fontSize: 7.5,
      fontStyle: 'bold',
      halign: 'center',
    },
    bodyStyles: {
      fontSize: 7.5,
      textColor: [40, 40, 40],
    },
    footStyles: {
      fillColor: [245, 245, 245],
      textColor: [74, 23, 19],
      fontStyle: 'bold',
      fontSize: 8,
    },
    columnStyles: {
      0: { cellWidth: 42 },
      1: { cellWidth: 30, halign: 'right' },
      2: { cellWidth: 42 },
      3: { cellWidth: 26, halign: 'right' },
    },
    margin: { left: 10, right: 10 },
  })

  const finalY = (doc as any).lastAutoTable.finalY + 5
  doc.setFillColor(254, 243, 199)
  doc.roundedRect(10, finalY, 128, 14, 2, 2, 'F')
  doc.setDrawColor(242, 151, 68)
  doc.roundedRect(10, finalY, 128, 14, 2, 2, 'S')

  doc.setTextColor(74, 23, 19)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  doc.text('TOTAL GAJI BERSIH (TAKE HOME PAY):', 15, finalY + 9)

  doc.setFontSize(11)
  doc.setTextColor(180, 50, 20)
  doc.text(rupiah(b.takeHomePay), 133, finalY + 9, { align: 'right' })

  const signY = finalY + 24
  doc.setTextColor(60, 60, 60)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7.5)

  doc.text('Penerima,', 25, signY, { align: 'center' })
  doc.text('HR & Payroll Dept,', 115, signY, { align: 'center' })

  doc.line(10, signY + 16, 40, signY + 16)
  doc.line(100, signY + 16, 130, signY + 16)

  doc.setFont('helvetica', 'bold')
  doc.text(staffName, 25, signY + 20, { align: 'center' })
  doc.text('Suka Shawarma Management', 115, signY + 20, { align: 'center' })

  const cleanStaffName = staffName.replace(/[^a-zA-Z0-9]/g, '_')
  doc.save(`Slip_Gaji_${cleanStaffName}_${slip.period_month}_${slip.period_year}.pdf`)
}

export const generateSalarySlipPDF = generateSalarySlipPdf

export function buildSalarySlipWhatsAppMessage(slip: PayrollRecord): string {
  const b = getPayrollBreakdown(slip)
  const staffName = slip.outlet_staff?.name || 'Karyawan'
  const roleName = slip.outlet_staff?.role?.replace('_', ' ').toUpperCase() || 'STAFF'
  const outletName = slip.outlet_staff?.outlets?.name || 'Pusat'
  const periodText = `${MONTH_NAMES[slip.period_month - 1]} ${slip.period_year}`
  const slipIdShort = slip.id.slice(0, 8).toUpperCase()
  const generatedTime = new Date().toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Jakarta' })

  const earningsLines: string[] = [`• Gaji Pokok: ${rupiah(b.basicSalary)}`]
  if (b.overtime > 0) earningsLines.push(`• Lembur (Overtime): ${rupiah(b.overtime)}`)
  if (b.mealAllowance > 0) earningsLines.push(`• Uang Makan (Meal): ${rupiah(b.mealAllowance)}`)
  if (b.transportAllowance > 0) earningsLines.push(`• Uang Transport: ${rupiah(b.transportAllowance)}`)
  if (b.communicationAllowance > 0) earningsLines.push(`• Tunjangan Komunikasi: ${rupiah(b.communicationAllowance)}`)
  if (b.salesBonus > 0) earningsLines.push(`• Sales Bonus: ${rupiah(b.salesBonus)}`)
  if (b.positionAllowance > 0) earningsLines.push(`• Tunjangan Jabatan: ${rupiah(b.positionAllowance)}`)

  const deductionLines: string[] = []
  if (b.cashAdvanceDeduction > 0) deductionLines.push(`• Potongan Kasbon: -${rupiah(b.cashAdvanceDeduction)}`)
  if (b.lateDeduction > 0) {
    deductionLines.push(`• Denda Keterlambatan (${b.lateMinutes} menit @ Rp1.000): -${rupiah(b.lateDeduction)}`)
  }
  if (b.otherDeduction > 0) deductionLines.push(`• Potongan Lain: -${rupiah(b.otherDeduction)}`)
  if (deductionLines.length === 0) deductionLines.push(`• Tidak ada potongan: Rp 0`)

  return (
    `*SLIP GAJI RESMI — SUKA SHAWARMA*\n` +
    `============================\n` +
    `👤 Nama: *${staffName}*\n` +
    `💼 Jabatan: ${roleName}\n` +
    `📍 Outlet: ${outletName}\n` +
    `📅 Periode: *${periodText}*\n` +
    `🔖 Ref ID: \`SS-PAY-${slipIdShort}\`\n\n` +
    `*📋 RINCIAN PENERIMAAN (EARNINGS):*\n` +
    earningsLines.join('\n') +
    `\n*Total Penerimaan: ${rupiah(b.totalEarnings)}*\n\n` +
    `*✂️ POTONGAN (DEDUCTIONS):*\n` +
    deductionLines.join('\n') +
    `\n*Total Potongan: -${rupiah(b.totalDeductions)}*\n\n` +
    `----------------------------\n` +
    `💰 *TAKE HOME PAY: ${rupiah(b.takeHomePay)}*\n` +
    `============================\n` +
    `_Dokumen ini digenerate otomatis oleh Sistem HR Suka Shawarma pada ${generatedTime} WIB._\n` +
    `_Terima kasih atas kerja keras dan dedikasi Anda!_`
  )
}
