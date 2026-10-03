import { rupiah, MONTH_NAMES } from './format'
import type { PayrollRecord } from './types'
import { getPayrollBreakdown } from './payrollBreakdown'
import { isRendyOrDeveloperStaff } from './staffFilters'

export function buildSalarySlipWhatsAppMessage(slip: PayrollRecord): string {
  const b = getPayrollBreakdown(slip)
  const staffName = slip.outlet_staff?.name || 'Karyawan'
  const roleName = slip.outlet_staff?.role?.replace('_', ' ').toUpperCase() || 'STAFF'
  const outletName = isRendyOrDeveloperStaff(slip.outlet_staff as any)
    ? 'Kantor Pusat'
    : (slip.outlet_staff?.outlets?.name || 'Pusat')
  const periodText = `${MONTH_NAMES[slip.period_month - 1]} ${slip.period_year}`
  const slipIdShort = slip.id.slice(0, 8).toUpperCase()
  const generatedTime = new Date().toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Jakarta' })

  const earningsLines: string[] = [`• Gaji Pokok: ${rupiah(b.basicSalary)}`]
  if (b.overtime > 0) earningsLines.push(`• Lembur (Overtime): ${rupiah(b.overtime)}`)
  if (b.mealAllowance > 0) earningsLines.push(`• Uang Makan (Meal): ${rupiah(b.mealAllowance)}`)
  if (b.transportAllowance > 0) earningsLines.push(`• Uang Transport: ${rupiah(b.transportAllowance)}`)
  if (b.communicationAllowance > 0) earningsLines.push(`• Tunjangan Komunikasi: ${rupiah(b.communicationAllowance)}`)
  if (b.salesBonus > 0) {
    const isRewardAbsensi = slip.bonus_note?.toLowerCase().includes('reward absensi')
    const bonusTitle = isRewardAbsensi ? 'Reward Absensi' : 'Sales Bonus'
    earningsLines.push(`• ${bonusTitle}: ${rupiah(b.salesBonus)}`)
  }
  if (b.positionAllowance > 0) earningsLines.push(`• Tunjangan Jabatan: ${rupiah(b.positionAllowance)}`)

  const deductionLines: string[] = []
  if (b.cashAdvanceDeduction > 0) deductionLines.push(`• Potongan Kasbon: -${rupiah(b.cashAdvanceDeduction)}`)
  if (b.bpjsDeduction > 0) deductionLines.push(`• Potongan BPJS: -${rupiah(b.bpjsDeduction)}`)
  if (b.lateDeduction > 0) {
    const lateTitle = b.lateMinutes > 0
      ? `• Denda Keterlambatan (${b.lateMinutes} menit @ Rp1.000): -${rupiah(b.lateDeduction)}`
      : `• Denda Keterlambatan: -${rupiah(b.lateDeduction)}`
    deductionLines.push(lateTitle)
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
