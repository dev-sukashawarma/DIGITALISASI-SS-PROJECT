import { useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase'
import type { PayrollStatus } from '@/lib/types'
import { LATE_FEE_PER_MINUTE } from '@/lib/payrollBreakdown'

/**
 * Fetch total late minutes for all staff in a specific month & year from attendance & attendance_logs
 */
async function fetchMonthlyLateMinutes(
  supabase: ReturnType<typeof createClient>,
  month: number,
  year: number
): Promise<Map<string, number>> {
  const startDay = `${year}-${String(month).padStart(2, '0')}-01`
  const lastDate = new Date(year, month, 0).getDate()
  const endDay = `${year}-${String(month).padStart(2, '0')}-${String(lastDate).padStart(2, '0')}`

  const lateMinutesMap = new Map<string, number>()

  // 1. Query attendance table (used by Mobile Clock In)
  try {
    const { data: rawAtt } = await supabase
      .from('attendance')
      .select('outlet_staff_id, telat_menit, type, status, ts_server')
      .gte('ts_server', `${startDay}T00:00:00.000+07:00`)
      .lte('ts_server', `${endDay}T23:59:59.999+07:00`)

    rawAtt?.forEach((a: any) => {
      if (a.type === 'in' && (a.telat_menit > 0 || a.status === 'telat' || a.status === 'terlambat')) {
        const staffId = a.outlet_staff_id
        const mins = Number(a.telat_menit) || 0
        const prev = lateMinutesMap.get(staffId) || 0
        lateMinutesMap.set(staffId, prev + mins)
      }
    })
  } catch (e) {
    // Ignore if table schema difference
  }

  // 2. Query attendance_logs table (used by manual / synced logs)
  try {
    const { data: logs } = await supabase
      .from('attendance_logs')
      .select('staff_id, late_minutes')
      .gte('date', startDay)
      .lte('date', endDay)

    logs?.forEach((l: any) => {
      const mins = Number(l.late_minutes) || 0
      if (mins > 0) {
        const staffId = l.staff_id
        const current = lateMinutesMap.get(staffId) || 0
        // If logs has higher, use max
        if (mins > current) {
          lateMinutesMap.set(staffId, mins)
        }
      }
    })
  } catch (e) {
    // Ignore
  }

  return lateMinutesMap
}

export function usePayrollMutations() {
  const supabase = createClient()
  const queryClient = useQueryClient()

  const generate = useMutation({
    mutationFn: async ({ month, year }: { month: number; year: number }) => {
      /* 1. Fetch all active staff with their financials */
      const { data: staff, error: staffErr } = await supabase
        .from('outlet_staff')
        .select(`
          id,
          name,
          role,
          status,
          staff_financials(
            basic_salary,
            allowance_position,
            allowance_presence
          )
        `)
        .eq('status', 'active')
        .neq('role', 'kiosk')

      if (staffErr) throw staffErr
      if (!staff || staff.length === 0) throw new Error('Tidak ada staf aktif ditemukan.')

      /* 2. Fetch Automatic Attendance Late Minutes */
      const lateMinutesMap = await fetchMonthlyLateMinutes(supabase, month, year)

      /* 3. Fetch active Kasbon (Cash Advances) */
      const { data: kasbons } = await supabase
        .from('cash_advances')
        .select('staff_id, remaining, amount')
        .eq('status', 'active')

      const kasbonMap = new Map<string, number>()
      kasbons?.forEach((k: any) => {
        const prev = kasbonMap.get(k.staff_id) || 0
        kasbonMap.set(k.staff_id, prev + (Number(k.remaining) || 0))
      })

      /* 4. Build payroll rows with auto late deduction (Rp 1.000/mnt) and kasbon */
      const rows = staff.map((s: any) => {
        const fin = Array.isArray(s.staff_financials)
          ? s.staff_financials[0]
          : s.staff_financials

        const basicSalary = Number(fin?.basic_salary) || 0
        const allowancePosition = Number(fin?.allowance_position) || 0
        const allowancePresence = Number(fin?.allowance_presence) || 0

        const lateMinutes = lateMinutesMap.get(s.id) || 0
        const lateDeduction = lateMinutes * LATE_FEE_PER_MINUTE
        const kasbonDeduction = kasbonMap.get(s.id) || 0

        const totalDeductions = lateDeduction + kasbonDeduction
        const deductionNotes: string[] = []
        if (kasbonDeduction > 0) {
          deductionNotes.push(`Kasbon: Rp ${kasbonDeduction.toLocaleString('id-ID')}`)
        }
        if (lateMinutes > 0) {
          deductionNotes.push(`Telat (${lateMinutes} mnt x Rp 1.000): Rp ${lateDeduction.toLocaleString('id-ID')}`)
        }

        const totalEarnings = basicSalary + allowancePosition + allowancePresence
        const totalSalary = Math.max(0, totalEarnings - totalDeductions)

        return {
          staff_id: s.id,
          period_month: month,
          period_year: year,
          basic_salary: basicSalary,
          allowance_position: allowancePosition,
          allowance_presence: allowancePresence,
          bonus: 0,
          bonus_note: null,
          deductions: totalDeductions,
          deduction_note: deductionNotes.join(' | ') || null,
          total_salary: totalSalary,
          status: 'draft' as PayrollStatus,
        }
      })

      /* 5. Bulk upsert */
      const { error: upsertErr } = await supabase
        .from('payroll_records')
        .upsert(rows, { onConflict: 'staff_id,period_month,period_year' })

      if (upsertErr) throw upsertErr

      return rows.length
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payroll'] })
    },
  })

  const syncAttendanceDeductions = useMutation({
    mutationFn: async ({ month, year }: { month: number; year: number }) => {
      // 1. Fetch current draft slips
      const { data: slips, error: slipsErr } = await supabase
        .from('payroll_records')
        .select('*')
        .eq('period_month', month)
        .eq('period_year', year)
        .eq('status', 'draft')

      if (slipsErr) throw slipsErr
      if (!slips || slips.length === 0) throw new Error('Tidak ada slip draft untuk disinkronkan.')

      // 2. Fetch monthly late minutes
      const lateMinutesMap = await fetchMonthlyLateMinutes(supabase, month, year)

      let updatedCount = 0

      for (const slip of slips) {
        const lateMinutes = lateMinutesMap.get(slip.staff_id) || 0
        const lateDeduction = lateMinutes * LATE_FEE_PER_MINUTE

        // Check if there is kasbon in current note or table
        let kasbonDeduction = 0
        if (slip.deduction_note) {
          const m = slip.deduction_note.match(/kasbon[:\s]*rp?\s*([0-9.,]+)/i)
          if (m) kasbonDeduction = Number(m[1].replace(/[^0-9]/g, '')) || 0
        }

        const totalDeductions = kasbonDeduction + lateDeduction
        const notes: string[] = []
        if (kasbonDeduction > 0) notes.push(`Kasbon: Rp ${kasbonDeduction.toLocaleString('id-ID')}`)
        if (lateMinutes > 0) {
          notes.push(`Telat (${lateMinutes} mnt x Rp 1.000): Rp ${lateDeduction.toLocaleString('id-ID')}`)
        }

        const totalEarnings =
          Number(slip.basic_salary) +
          Number(slip.allowance_position) +
          Number(slip.allowance_presence) +
          Number(slip.bonus)

        const totalSalary = Math.max(0, totalEarnings - totalDeductions)

        await supabase
          .from('payroll_records')
          .update({
            deductions: totalDeductions,
            deduction_note: notes.join(' | ') || null,
            total_salary: totalSalary,
          })
          .eq('id', slip.id)

        updatedCount++
      }

      return updatedCount
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payroll'] })
    },
  })

  const updateSlip = useMutation({
    mutationFn: async ({
      id,
      basic_salary,
      allowance_position,
      allowance_presence,
      bonus,
      bonus_note,
      deductions,
      deduction_note,
    }: {
      id: string
      basic_salary: number
      allowance_position: number
      allowance_presence: number
      bonus: number
      bonus_note: string | null
      deductions: number
      deduction_note: string | null
    }) => {
      const totalSalary =
        basic_salary + allowance_position + allowance_presence + bonus - deductions

      const { error } = await supabase
        .from('payroll_records')
        .update({
          basic_salary,
          allowance_position,
          allowance_presence,
          bonus,
          bonus_note,
          deductions,
          deduction_note,
          total_salary: totalSalary,
        })
        .eq('id', id)

      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payroll'] })
    },
  })

  const finalizeAll = useMutation({
    mutationFn: async ({ month, year }: { month: number; year: number }) => {
      const { error } = await supabase
        .from('payroll_records')
        .update({ status: 'finalized' as PayrollStatus })
        .eq('period_month', month)
        .eq('period_year', year)
        .eq('status', 'draft')

      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payroll'] })
    },
  })

  return { generate, syncAttendanceDeductions, updateSlip, finalizeAll }
}
