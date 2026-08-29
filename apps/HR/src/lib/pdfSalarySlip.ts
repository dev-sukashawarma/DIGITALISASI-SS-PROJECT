import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { rupiah, MONTH_NAMES } from './format'
import type { PayrollRecord } from './types'

export function generateSalarySlipPdf(slip: PayrollRecord) {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a5',
  })

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
  doc.text('SLIP GAJI KARYAWAN', 10, 15)
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

  const totalEarnings = slip.basic_salary + slip.allowance_position + slip.allowance_presence + slip.bonus
  const totalDeductions = slip.deductions
  const takeHomePay = totalEarnings - totalDeductions

  autoTable(doc, {
    startY: 47,
    head: [['PENERIMAAN (EARNINGS)', 'JUMLAH (RP)', 'POTONGAN (DEDUCTIONS)', 'JUMLAH (RP)']],
    body: [
      ['Gaji Pokok', rupiah(slip.basic_salary), 'Denda / Potongan Kasbon', rupiah(slip.deductions)],
      ['Tunjangan Jabatan', rupiah(slip.allowance_position), slip.deduction_note ? `(${slip.deduction_note})` : '-', '-'],
      ['Tunjangan Kehadiran', rupiah(slip.allowance_presence), '', ''],
      ['Bonus & Insentif', rupiah(slip.bonus), '', ''],
    ],
    foot: [
      ['Total Penerimaan', rupiah(totalEarnings), 'Total Potongan', rupiah(totalDeductions)],
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
      0: { cellWidth: 40 },
      1: { cellWidth: 32, halign: 'right' },
      2: { cellWidth: 40 },
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
  doc.text(rupiah(takeHomePay), 133, finalY + 9, { align: 'right' })

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
  const staffName = slip.outlet_staff?.name || 'Karyawan'
  const roleName = slip.outlet_staff?.role?.replace('_', ' ').toUpperCase() || 'STAFF'
  const outletName = slip.outlet_staff?.outlets?.name || 'Pusat'
  const periodText = `${MONTH_NAMES[slip.period_month - 1]} ${slip.period_year}`
  const totalEarnings = slip.basic_salary + slip.allowance_position + slip.allowance_presence + slip.bonus
  const totalDeductions = slip.deductions
  const takeHomePay = totalEarnings - totalDeductions
  const slipIdShort = slip.id.slice(0, 8).toUpperCase()
  const generatedTime = new Date().toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Jakarta' })

  return (
    `*SLIP GAJI RESMI — SUKA SHAWARMA*\n` +
    `============================\n` +
    `👤 Nama: *${staffName}*\n` +
    `💼 Jabatan: ${roleName}\n` +
    `📍 Outlet: ${outletName}\n` +
    `📅 Periode: *${periodText}*\n` +
    `🔖 Ref ID: \`SS-PAY-${slipIdShort}\`\n\n` +
    `*📋 RINCIAN PENERIMAAN (EARNINGS):*\n` +
    `• Gaji Pokok: ${rupiah(slip.basic_salary)}\n` +
    `• Tunjangan Jabatan: ${rupiah(slip.allowance_position)}\n` +
    `• Tunjangan Kehadiran: ${rupiah(slip.allowance_presence)}\n` +
    `• Bonus & Insentif: ${rupiah(slip.bonus)}\n` +
    (slip.bonus_note ? `  _(Ket: ${slip.bonus_note})_\n` : '') +
    `*Total Penerimaan: ${rupiah(totalEarnings)}*\n\n` +
    `*✂️ POTONGAN (DEDUCTIONS):*\n` +
    `• Potongan Denda/Kasbon: ${rupiah(slip.deductions)}\n` +
    (slip.deduction_note ? `  _(Ket: ${slip.deduction_note})_\n` : '') +
    `*Total Potongan: ${rupiah(totalDeductions)}*\n\n` +
    `----------------------------\n` +
    `💰 *TAKE HOME PAY: ${rupiah(takeHomePay)}*\n` +
    `============================\n` +
    `_Dokumen ini digenerate otomatis oleh Sistem HR Suka Shawarma pada ${generatedTime} WIB._\n` +
    `_Terima kasih atas kerja keras dan dedikasi Anda!_`
  )
}
