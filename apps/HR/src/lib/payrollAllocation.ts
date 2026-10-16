import type { PayrollAllocation } from '@/lib/types'

export const PAYROLL_COMPANIES = ['PT Suka Profit Berkah', 'PT Akbar Capital'] as const

export const DEFAULT_PAYROLL_ALLOCATION: PayrollAllocation[] = [
  { company_name: 'PT Suka Profit Berkah', percentage: 100 },
]

export function normalizePayrollAllocations(value: unknown): PayrollAllocation[] {
  if (!Array.isArray(value) || value.length === 0) return DEFAULT_PAYROLL_ALLOCATION
  const normalized = value.map((item: any) => ({
    company_name: String(item?.company_name ?? '').trim(),
    percentage: Number(item?.percentage) || 0,
  }))
  const usable = normalized.filter((item) => item.company_name || item.percentage > 0)
  return usable.length > 0 ? usable : DEFAULT_PAYROLL_ALLOCATION
}

export function payrollAllocationError(allocations: PayrollAllocation[]): string | null {
  const active = allocations.filter((item) => item.company_name.trim() || item.percentage > 0)
  if (active.length === 0) return 'Tambahkan minimal satu PT penanggung.'
  if (active.some((item) => !item.company_name.trim())) return 'Nama PT wajib diisi untuk setiap persentase.'
  if (active.some((item) => item.percentage <= 0 || item.percentage > 100)) {
    return 'Persentase setiap PT harus lebih dari 0% dan maksimal 100%.'
  }
  const uniqueNames = new Set(active.map((item) => item.company_name.toLocaleLowerCase('id-ID')))
  if (uniqueNames.size !== active.length) return 'Nama PT tidak boleh duplikat.'
  if (active.some((item) => !PAYROLL_COMPANIES.includes(item.company_name as typeof PAYROLL_COMPANIES[number]))) {
    return `PT harus dipilih dari: ${PAYROLL_COMPANIES.join(' atau ')}.`
  }
  const total = active.reduce((sum, item) => sum + item.percentage, 0)
  if (Math.abs(total - 100) > 0.0001) return `Total alokasi harus tepat 100% (saat ini ${total}%).`
  return null
}

export function splitPayrollAmount(amount: number, allocations: PayrollAllocation[]) {
  const active = allocations.filter((item) => item.company_name.trim() && item.percentage > 0)
  let assigned = 0
  return active.map((item, index) => {
    const allocatedAmount = index === active.length - 1
      ? amount - assigned
      : Math.round((amount * item.percentage) / 100)
    assigned += allocatedAmount
    return { ...item, amount: allocatedAmount }
  })
}
