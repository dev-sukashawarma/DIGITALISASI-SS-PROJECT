import type { PayrollRecord } from './types'

export interface PayrollBreakdown {
  // ── 1. Komponen Take Home Pay (Penerimaan) ──
  basicSalary: number // gapok
  overtime: number // overtime / lembur
  mealAllowance: number // meal / uang makan
  transportAllowance: number // transport / uang transport
  communicationAllowance: number // communication / tunjangan pulsa/komunikasi
  salesBonus: number // sales bonus / bonus target omset
  positionAllowance: number // tunjangan jabatan (opsional)

  // ── 2. Komponen Potongan ──
  cashAdvanceDeduction: number // kasbon
  bpjsDeduction: number // iuran / potongan BPJS
  lateMinutes: number // total menit keterlambatan dari absensi
  lateDeduction: number // keterlambatan = lateMinutes * 1000
  otherDeduction: number // ganti rugi / denda lainnya

  // ── 3. Kalkulasi ──
  totalEarnings: number
  totalDeductions: number
  takeHomePay: number
}

export const LATE_FEE_PER_MINUTE = 1000 // Rp 1.000 / menit keterlambatan

/**
 * Ekstrak rincian komponen THP dan Potongan dari objek PayrollRecord
 */
export function getPayrollBreakdown(slip: PayrollRecord): PayrollBreakdown {
  const basicSalary = Number(slip.basic_salary) || 0
  let mealAllowance =
    slip.allowance_meal !== undefined && slip.allowance_meal !== null
      ? Number(slip.allowance_meal)
      : (Number(slip.allowance_presence) || 0)
  const positionAllowance = Number(slip.allowance_position) || 0

  let overtime = 0
  let salesBonus =
    slip.sales_bonus !== undefined && slip.sales_bonus !== null ? Number(slip.sales_bonus) : 0
  let transportAllowance =
    slip.allowance_transport !== undefined && slip.allowance_transport !== null
      ? Number(slip.allowance_transport)
      : 0
  let communicationAllowance =
    slip.allowance_communication !== undefined && slip.allowance_communication !== null
      ? Number(slip.allowance_communication)
      : 0

  // Coba parse bonus_note jika ada format terstruktur JSON atau string
  if (slip.bonus_note) {
    try {
      if (slip.bonus_note.startsWith('{')) {
        const parsed = JSON.parse(slip.bonus_note)
        overtime = Number(parsed.overtime) || 0
        if (salesBonus === 0) salesBonus = Number(parsed.salesBonus) || 0
        if (transportAllowance === 0) transportAllowance = Number(parsed.transport) || 0
        if (communicationAllowance === 0) communicationAllowance = Number(parsed.communication) || 0
      } else {
        // Parse string patterns e.g. "Overtime: Rp 100.000, Sales Bonus: Rp 200.000"
        const otMatch = slip.bonus_note.match(/(?:overtime|lembur)[:\s]*rp?\s*([0-9.,]+)/i)
        const sbMatch = slip.bonus_note.match(/(?:sales bonus|bonus omset|bonus penjualan)[:\s]*rp?\s*([0-9.,]+)/i)
        const trMatch = slip.bonus_note.match(/(?:transport)[:\s]*rp?\s*([0-9.,]+)/i)
        const comMatch = slip.bonus_note.match(/(?:communication|komunikasi|pulsa)[:\s]*rp?\s*([0-9.,]+)/i)

        if (otMatch) overtime = Number(otMatch[1].replace(/[^0-9]/g, '')) || 0
        if (sbMatch && salesBonus === 0) salesBonus = Number(sbMatch[1].replace(/[^0-9]/g, '')) || 0
        if (trMatch && transportAllowance === 0) transportAllowance = Number(trMatch[1].replace(/[^0-9]/g, '')) || 0
        if (comMatch && communicationAllowance === 0) communicationAllowance = Number(comMatch[1].replace(/[^0-9]/g, '')) || 0
      }
    } catch {
      // Fallback
    }
  }

  // Jika tidak terurai tapi bonus > 0, defaultkan ke overtime / bonus
  if (overtime === 0 && salesBonus === 0 && (Number(slip.bonus) || 0) > 0) {
    if (slip.bonus_note?.toLowerCase().includes('sales')) {
      salesBonus = Number(slip.bonus)
    } else {
      overtime = Number(slip.bonus)
    }
  }

  // Potongan parsing
  let cashAdvanceDeduction =
    slip.deduction_kasbon !== undefined && slip.deduction_kasbon !== null
      ? Number(slip.deduction_kasbon)
      : 0
  let bpjsDeduction =
    slip.deduction_bpjs !== undefined && slip.deduction_bpjs !== null
      ? Number(slip.deduction_bpjs)
      : 0
  let lateMinutes = 0
  let lateDeduction = 0
  let otherDeduction = 0

  if (slip.deduction_note) {
    try {
      if (slip.deduction_note.startsWith('{')) {
        const parsed = JSON.parse(slip.deduction_note)
        if (cashAdvanceDeduction === 0) cashAdvanceDeduction = Number(parsed.kasbon) || 0
        if (bpjsDeduction === 0) bpjsDeduction = Number(parsed.bpjs) || 0
        lateMinutes = Number(parsed.lateMinutes) || 0
        lateDeduction = Number(parsed.lateDeduction) || lateMinutes * LATE_FEE_PER_MINUTE
        otherDeduction = Number(parsed.other) || 0
      } else {
        const kasbonMatch = slip.deduction_note.match(/(?:kasbon|pinjaman)[:\s]*rp?\s*([0-9.,]+)/i)
        const bpjsMatch = slip.deduction_note.match(/(?:bpjs)[:\s]*rp?\s*([0-9.,]+)/i)
        const lateMinMatch = slip.deduction_note.match(/(?:telat|keterlambatan)\s*\(?([0-9]+)\s*m/i)
        const lateDedMatch = slip.deduction_note.match(/(?:denda telat|telat|keterlambatan)[:\s]*rp?\s*([0-9.,]+)/i)
        const otherMatch = slip.deduction_note.match(/(?:ganti rugi|denda|potongan lain)[:\s]*rp?\s*([0-9.,]+)/i)

        if (kasbonMatch && cashAdvanceDeduction === 0) {
          cashAdvanceDeduction = Number(kasbonMatch[1].replace(/[^0-9]/g, '')) || 0
        }
        if (bpjsMatch && bpjsDeduction === 0) {
          bpjsDeduction = Number(bpjsMatch[1].replace(/[^0-9]/g, '')) || 0
        }
        if (lateMinMatch) lateMinutes = Number(lateMinMatch[1]) || 0
        if (lateDedMatch) lateDeduction = Number(lateDedMatch[1].replace(/[^0-9]/g, '')) || 0
        else if (lateMinutes > 0) lateDeduction = lateMinutes * LATE_FEE_PER_MINUTE
        if (otherMatch) otherDeduction = Number(otherMatch[1].replace(/[^0-9]/g, '')) || 0
      }
    } catch {
      // Fallback
    }
  }

  // Fallback jika deductions > 0 tapi belum terurai
  if (cashAdvanceDeduction === 0 && bpjsDeduction === 0 && lateDeduction === 0 && otherDeduction === 0 && (Number(slip.deductions) || 0) > 0) {
    if (slip.deduction_note?.toLowerCase().includes('kasbon')) {
      cashAdvanceDeduction = Number(slip.deductions)
    } else if (slip.deduction_note?.toLowerCase().includes('bpjs')) {
      bpjsDeduction = Number(slip.deductions)
    } else if (slip.deduction_note?.toLowerCase().includes('telat')) {
      lateDeduction = Number(slip.deductions)
      lateMinutes = Math.floor(lateDeduction / LATE_FEE_PER_MINUTE)
    } else {
      otherDeduction = Number(slip.deductions)
    }
  }

  const totalEarnings =
    basicSalary +
    overtime +
    mealAllowance +
    transportAllowance +
    communicationAllowance +
    salesBonus +
    positionAllowance

  const totalDeductions = cashAdvanceDeduction + bpjsDeduction + lateDeduction + otherDeduction
  const takeHomePay = Math.max(0, totalEarnings - totalDeductions)

  return {
    basicSalary,
    overtime,
    mealAllowance,
    transportAllowance,
    communicationAllowance,
    salesBonus,
    positionAllowance,
    cashAdvanceDeduction,
    bpjsDeduction,
    lateMinutes,
    lateDeduction,
    otherDeduction,
    totalEarnings,
    totalDeductions,
    takeHomePay,
  }
}

/**
 * Format notes human-readable and JSON encoded
 */
export function buildPayrollNotes(data: {
  overtime?: number
  salesBonus?: number
  transport?: number
  communication?: number
  customBonusNote?: string
  kasbon?: number
  bpjs?: number
  lateMinutes?: number
  lateDeduction?: number
  otherDeduction?: number
  customDeductionNote?: string
}) {
  const bonusParts: string[] = []
  if (data.overtime && data.overtime > 0) bonusParts.push(`Lembur: Rp ${data.overtime.toLocaleString('id-ID')}`)
  if (data.salesBonus && data.salesBonus > 0) bonusParts.push(`Sales Bonus: Rp ${data.salesBonus.toLocaleString('id-ID')}`)
  if (data.transport && data.transport > 0) bonusParts.push(`Transport: Rp ${data.transport.toLocaleString('id-ID')}`)
  if (data.communication && data.communication > 0) bonusParts.push(`Komunikasi: Rp ${data.communication.toLocaleString('id-ID')}`)
  if (data.customBonusNote) bonusParts.push(data.customBonusNote)

  const dedParts: string[] = []
  if (data.kasbon && data.kasbon > 0) dedParts.push(`Kasbon: Rp ${data.kasbon.toLocaleString('id-ID')}`)
  if (data.bpjs && data.bpjs > 0) dedParts.push(`BPJS: Rp ${data.bpjs.toLocaleString('id-ID')}`)
  const lateMin = data.lateMinutes || 0
  const lateFee = data.lateDeduction || lateMin * LATE_FEE_PER_MINUTE
  if (lateFee > 0) {
    dedParts.push(`Telat (${lateMin} mnt x Rp 1.000): Rp ${lateFee.toLocaleString('id-ID')}`)
  }
  if (data.otherDeduction && data.otherDeduction > 0) {
    dedParts.push(`Potongan Lain: Rp ${data.otherDeduction.toLocaleString('id-ID')}`)
  }
  if (data.customDeductionNote) dedParts.push(data.customDeductionNote)

  return {
    bonus_note: bonusParts.join(' | ') || null,
    deduction_note: dedParts.join(' | ') || null,
  }
}
