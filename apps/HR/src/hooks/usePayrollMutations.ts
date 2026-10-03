import { useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase'
import type { PayrollStatus, CashAdvanceStatus } from '@/lib/types'
import { LATE_FEE_PER_MINUTE } from '@/lib/payrollBreakdown'
import { isTestOrDevStaff } from '@/lib/staffFilters'

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

  // 1. Menit telat dari `attendance`, diagregasi per staf di database.
  //    (Dulu: select semua baris sebulan tanpa pagination → terpotong 1.000 baris,
  //    sebagian staf dapat denda Rp 0.) Error sengaja dilempar: denda yang diam-diam
  //    nol lebih berbahaya daripada generate yang gagal.
  const { data: rekap, error: rekapErr } = await supabase.rpc('hr_rekap_absensi_staf', {
    p_from: startDay,
    p_to: endDay,
  })
  if (rekapErr) throw new Error(`Gagal membaca rekap absensi: ${rekapErr.message}`)
  for (const r of (rekap ?? []) as { staff_id: string; telat_menit_total: number }[]) {
    if (r.telat_menit_total > 0) lateMinutesMap.set(r.staff_id, r.telat_menit_total)
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

/**
 * Fetch automatic monthly sales bonuses for Crew, AM, and RM from RPCs
 */
async function fetchMonthlySalesBonuses(
  supabase: ReturnType<typeof createClient>,
  month: number,
  year: number
): Promise<Map<string, { bonus: number; note: string }>> {
  const bonusMap = new Map<string, { bonus: number; note: string }>()

  try {
    const [crewRes, amRes, rmRes] = await Promise.all([
      supabase.rpc('get_monthly_crew_bonus', { p_month: month, p_year: year, p_outlet_id: null }),
      supabase.rpc('get_monthly_am_bonus', { p_month: month, p_year: year }),
      supabase.rpc('get_monthly_rm_bonus', { p_month: month, p_year: year }),
    ])

    // 1. Crew & Leader Bonuses (mendukung akumulasi multi-outlet bagi crew backup)
    if (crewRes.data && Array.isArray(crewRes.data)) {
      const crewAggMap = new Map<string, { total: number; details: string[] }>()
      crewRes.data.forEach((c: any) => {
        const amount = Number(c.total_bonus) || 0
        if (amount > 0) {
          const daysText = c.attendance_days > 0 ? `${c.attendance_days} hari` : `${c.active_crew_count} kru`
          const outNameClean = (c.outlet_name || '').replace('SUKA SHAWARMA ', '').replace('MITRA SUKA ', 'MITRA ')
          const itemText = `${outNameClean} (${daysText}: Rp ${amount.toLocaleString('id-ID')})`
          const prev = crewAggMap.get(c.crew_id)
          if (prev) {
            prev.total += amount
            prev.details.push(itemText)
          } else {
            crewAggMap.set(c.crew_id, {
              total: amount,
              details: [itemText],
            })
          }
        }
      })

      crewAggMap.forEach((val, staffId) => {
        if (val.details.length > 1) {
          bonusMap.set(staffId, {
            bonus: val.total,
            note: `Sales Bonus Multi-Outlet: Rp ${val.total.toLocaleString('id-ID')} (${val.details.join(', ')})`,
          })
        } else {
          bonusMap.set(staffId, {
            bonus: val.total,
            note: `Sales Bonus: Rp ${val.total.toLocaleString('id-ID')} (${val.details[0]})`,
          })
        }
      })
    }

    // 2. Area Manager Bonuses
    if (amRes.data && Array.isArray(amRes.data)) {
      amRes.data.forEach((a: any) => {
        const amount = Number(a.total_bonus) || 0
        if (amount > 0) {
          bonusMap.set(a.staff_id, {
            bonus: amount,
            note: `Sales Bonus AM: Rp ${amount.toLocaleString('id-ID')} (${a.total_pcs} pcs x Rp 50)`,
          })
        }
      })
    }

    // 3. Regional Manager Bonuses
    if (rmRes.data && Array.isArray(rmRes.data)) {
      rmRes.data.forEach((r: any) => {
        const amount = Number(r.total_bonus) || 0
        if (amount > 0) {
          bonusMap.set(r.staff_id, {
            bonus: amount,
            note: `Sales Bonus RM: Rp ${amount.toLocaleString('id-ID')} (${r.total_pcs_global} pcs x Rp 50)`,
          })
        }
      })
    }
  } catch (e) {
    console.error('Error fetching monthly sales bonuses:', e)
  }

  return bonusMap
}

export function usePayrollMutations() {
  const supabase = createClient()
  const queryClient = useQueryClient()

  const generate = useMutation({
    mutationFn: async ({ month, year }: { month: number; year: number }) => {
      /* 1. Fetch all eligible staff with their financials */
      const { data: staff, error: staffErr } = await supabase
        .from('outlet_staff')
        .select(`
          id,
          name,
          role,
          username,
          status,
          is_active,
          account_category,
          outlet_id,
          resign_date,
          staff_financials(
            basic_salary,
            allowance_meal,
            allowance_transport,
            allowance_communication,
            sales_bonus,
            deduction_kasbon,
            deduction_bpjs,
            allowance_position,
            allowance_presence
          )
        `)
        .neq('role', 'kiosk')

      if (staffErr) throw staffErr

      // Filter: Hanya staf operasional (employee) yang aktif atau yang resign di bulan ini
      const eligibleStaff = (staff || []).filter((s: any) => {
        if (isTestOrDevStaff(s)) return false

        const isActive = s.status === 'active' || s.is_active === true
        if (isActive) return true

        // Karyawan non-aktif tapi keluar di bulan berjalan (tetap dibayarkan)
        if (s.resign_date) {
          const rDate = new Date(s.resign_date)
          const rMonth = rDate.getMonth() + 1
          const rYear = rDate.getFullYear()
          if (rMonth === month && rYear === year) {
            return true
          }
        }

        return false
      })

      if (eligibleStaff.length === 0) throw new Error('Tidak ada staf yang memenuhi syarat ditemukan.')

      /* 2. Fetch Automatic Attendance Late Minutes */
      const lateMinutesMap = await fetchMonthlyLateMinutes(supabase, month, year)

      /* 3. Fetch Automatic Sales Bonuses (Crew, AM, RM) */
      const salesBonusMap = await fetchMonthlySalesBonuses(supabase, month, year)

      /* 4. Fetch active Kasbon (Cash Advances) */
      const { data: kasbons } = await supabase
        .from('cash_advances')
        .select('staff_id, remaining, amount, installment_months')
        .eq('status', 'active')

      const kasbonMap = new Map<string, number>()
      kasbons?.forEach((k: any) => {
        const prev = kasbonMap.get(k.staff_id) || 0
        const rem = Number(k.remaining) || 0
        const amt = Number(k.amount) || rem
        const months = Number(k.installment_months) || 1
        const monthlyInstallment = months > 1 ? Math.min(rem, Math.ceil(amt / months)) : rem
        kasbonMap.set(k.staff_id, prev + monthlyInstallment)
      })

      /* 5. Build payroll rows with auto late deduction, kasbon, and sales bonus */
      const rows = eligibleStaff.map((s: any) => {
        const fin = Array.isArray(s.staff_financials)
          ? s.staff_financials[0]
          : s.staff_financials

        const basicSalary = Number(fin?.basic_salary) || 0
        const allowanceMeal = Number(fin?.allowance_meal) || Number(fin?.allowance_presence) || 0
        const allowanceTransport = Number(fin?.allowance_transport) || 0
        const allowanceCommunication = Number(fin?.allowance_communication) || 0
        const allowancePosition = Number(fin?.allowance_position) || 0
        const staffSalesBonus = Number(fin?.sales_bonus) || 0

        const lateMinutes = lateMinutesMap.get(s.id) || 0
        const lateDeduction = lateMinutes * LATE_FEE_PER_MINUTE
        const kasbonActive = kasbonMap.get(s.id) || 0
        const kasbonDeduction = kasbonActive > 0 ? kasbonActive : (Number(fin?.deduction_kasbon) || 0)
        const bpjsDeduction = Number(fin?.deduction_bpjs) || 0

        const totalDeductions = lateDeduction + kasbonDeduction + bpjsDeduction
        const deductionNotes: string[] = []
        if (kasbonDeduction > 0) {
          deductionNotes.push(`Kasbon: Rp ${kasbonDeduction.toLocaleString('id-ID')}`)
        }
        if (bpjsDeduction > 0) {
          deductionNotes.push(`BPJS: Rp ${bpjsDeduction.toLocaleString('id-ID')}`)
        }
        if (lateMinutes > 0) {
          deductionNotes.push(`Telat (${lateMinutes} mnt x Rp 1.000): Rp ${lateDeduction.toLocaleString('id-ID')}`)
        }

        const autoBonusInfo = salesBonusMap.get(s.id)
        const autoBonusAmount = autoBonusInfo?.bonus || 0
        const finalSalesBonus = autoBonusAmount > 0 ? autoBonusAmount : staffSalesBonus
        const bonusNote = autoBonusInfo?.note || (staffSalesBonus > 0 ? `Sales Bonus: Rp ${staffSalesBonus.toLocaleString('id-ID')}` : null)

        const totalEarnings =
          basicSalary +
          allowanceMeal +
          allowanceTransport +
          allowanceCommunication +
          allowancePosition +
          finalSalesBonus
        const totalSalary = Math.max(0, totalEarnings - totalDeductions)

        return {
          staff_id: s.id,
          period_month: month,
          period_year: year,
          basic_salary: basicSalary,
          allowance_meal: allowanceMeal,
          allowance_transport: allowanceTransport,
          allowance_communication: allowanceCommunication,
          sales_bonus: finalSalesBonus,
          deduction_kasbon: kasbonDeduction,
          deduction_bpjs: bpjsDeduction,
          allowance_position: allowancePosition,
          allowance_presence: allowanceMeal,
          bonus: finalSalesBonus,
          bonus_note: bonusNote,
          deductions: totalDeductions,
          deduction_note: deductionNotes.join(' | ') || null,
          total_salary: totalSalary,
          status: 'draft' as PayrollStatus,
        }
      })

      /* 6. Bulk upsert */
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

      // 2. Fetch monthly late minutes & sales bonuses
      const lateMinutesMap = await fetchMonthlyLateMinutes(supabase, month, year)
      const salesBonusMap = await fetchMonthlySalesBonuses(supabase, month, year)

      let updatedCount = 0

      for (const slip of slips) {
        const lateMinutes = lateMinutesMap.get(slip.staff_id) || 0
        const lateDeduction = lateMinutes * LATE_FEE_PER_MINUTE

        // Check if there is kasbon in current record or note
        let kasbonDeduction = Number(slip.deduction_kasbon) || 0
        if (kasbonDeduction === 0 && slip.deduction_note) {
          const m = slip.deduction_note.match(/kasbon[:\s]*rp?\s*([0-9.,]+)/i)
          if (m) kasbonDeduction = Number(m[1].replace(/[^0-9]/g, '')) || 0
        }

        const bpjsDeduction = Number(slip.deduction_bpjs) || 0
        const totalDeductions = kasbonDeduction + lateDeduction + bpjsDeduction
        const dedNotes: string[] = []
        if (kasbonDeduction > 0) dedNotes.push(`Kasbon: Rp ${kasbonDeduction.toLocaleString('id-ID')}`)
        if (bpjsDeduction > 0) dedNotes.push(`BPJS: Rp ${bpjsDeduction.toLocaleString('id-ID')}`)
        if (lateMinutes > 0) {
          dedNotes.push(`Telat (${lateMinutes} mnt x Rp 1.000): Rp ${lateDeduction.toLocaleString('id-ID')}`)
        }

        // Sync sales bonus while preserving overtime if any
        let currentOvertime = 0
        if (slip.bonus_note) {
          const otMatch = slip.bonus_note.match(/(?:overtime|lembur)[:\s]*rp?\s*([0-9.,]+)/i)
          if (otMatch) currentOvertime = Number(otMatch[1].replace(/[^0-9]/g, '')) || 0
        }

        const autoBonusInfo = salesBonusMap.get(slip.staff_id)
        const autoBonusAmount = autoBonusInfo?.bonus || 0
        const totalBonus = currentOvertime + autoBonusAmount

        const bonusNotes: string[] = []
        if (currentOvertime > 0) bonusNotes.push(`Lembur: Rp ${currentOvertime.toLocaleString('id-ID')}`)
        if (autoBonusInfo?.note) bonusNotes.push(autoBonusInfo.note)

        const totalEarnings =
          Number(slip.basic_salary) +
          Number(slip.allowance_position) +
          Number(slip.allowance_presence) +
          Number(totalBonus)

        const totalSalary = Math.max(0, totalEarnings - totalDeductions)

        await supabase
          .from('payroll_records')
          .update({
            bonus: totalBonus,
            bonus_note: bonusNotes.join(' | ') || null,
            deductions: totalDeductions,
            deduction_note: dedNotes.join(' | ') || null,
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
      allowance_meal,
      allowance_transport,
      allowance_communication,
      sales_bonus,
      deduction_kasbon,
      deduction_bpjs,
      allowance_position,
      allowance_presence,
      bonus,
      bonus_note,
      deductions,
      deduction_note,
    }: {
      id: string
      basic_salary: number
      allowance_meal?: number
      allowance_transport?: number
      allowance_communication?: number
      sales_bonus?: number
      deduction_kasbon?: number
      deduction_bpjs?: number
      allowance_position: number
      allowance_presence: number
      bonus: number
      bonus_note: string | null
      deductions: number
      deduction_note: string | null
    }) => {
      const meal = allowance_meal !== undefined ? allowance_meal : allowance_presence
      const totalEarnings =
        basic_salary +
        meal +
        (allowance_transport || 0) +
        (allowance_communication || 0) +
        allowance_position +
        bonus
      const totalSalary = Math.max(0, totalEarnings - deductions)

      const patch: Record<string, unknown> = {
        basic_salary,
        allowance_position,
        allowance_presence: meal,
        bonus,
        bonus_note,
        deductions,
        deduction_note,
        total_salary: totalSalary,
      }
      if (allowance_meal !== undefined) patch.allowance_meal = allowance_meal
      if (allowance_transport !== undefined) patch.allowance_transport = allowance_transport
      if (allowance_communication !== undefined) patch.allowance_communication = allowance_communication
      if (sales_bonus !== undefined) patch.sales_bonus = sales_bonus
      if (deduction_kasbon !== undefined) patch.deduction_kasbon = deduction_kasbon
      if (deduction_bpjs !== undefined) patch.deduction_bpjs = deduction_bpjs

      const { error } = await supabase
        .from('payroll_records')
        .update(patch)
        .eq('id', id)

      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payroll'] })
    },
  })

  const finalizeAll = useMutation({
    mutationFn: async ({ month, year }: { month: number; year: number }) => {
      // 1. Fetch all draft slips in this period
      const { data: draftSlips, error: slipsErr } = await supabase
        .from('payroll_records')
        .select('*')
        .eq('period_month', month)
        .eq('period_year', year)
        .eq('status', 'draft')

      if (slipsErr) throw slipsErr
      if (!draftSlips || draftSlips.length === 0) {
        throw new Error('Tidak ada slip draft untuk difinalisasi.')
      }

      const paymentDate = new Date().toISOString().split('T')[0]
      let settledKasbonCount = 0

      // 2. Process kasbon settlement for each draft slip
      for (const slip of draftSlips) {
        let kasbonAmount = Number(slip.deduction_kasbon) || 0
        if (kasbonAmount === 0 && slip.deduction_note) {
          const m = slip.deduction_note.match(/kasbon[:\s]*rp?\s*([0-9.,]+)/i)
          if (m) kasbonAmount = Number(m[1].replace(/[^0-9]/g, '')) || 0
        }

        if (kasbonAmount > 0) {
          const { data: activeKasbons } = await supabase
            .from('cash_advances')
            .select('id, amount, remaining')
            .eq('staff_id', slip.staff_id)
            .eq('status', 'active')
            .order('created_at', { ascending: true })

          if (activeKasbons && activeKasbons.length > 0) {
            let remainingToDeduct = kasbonAmount
            for (const adv of activeKasbons) {
              if (remainingToDeduct <= 0) break
              const advRemaining = Number(adv.remaining) || 0
              if (advRemaining <= 0) continue

              const deduct = Math.min(remainingToDeduct, advRemaining)
              const newRemaining = Math.max(0, advRemaining - deduct)

              await supabase.from('cash_advance_payments').insert({
                cash_advance_id: adv.id,
                amount: deduct,
                payment_date: paymentDate,
                note: `Potong Slip Payroll Periode ${month}/${year}`,
              })

              const updatePayload: { remaining: number; status?: CashAdvanceStatus } = {
                remaining: newRemaining,
              }
              if (newRemaining <= 0) {
                updatePayload.status = 'paid_off'
              }

              await supabase
                .from('cash_advances')
                .update(updatePayload)
                .eq('id', adv.id)

              remainingToDeduct -= deduct
              settledKasbonCount++
            }
          } else {
            // Manual kasbon on slip without existing cash_advances record: create completed record for audit
            const { data: newAdv, error: createAdvErr } = await supabase
              .from('cash_advances')
              .insert({
                staff_id: slip.staff_id,
                amount: kasbonAmount,
                remaining: 0,
                reason: `Potongan Kasbon Payroll Periode ${month}/${year} (Otomatis via Slip)`,
                status: 'paid_off',
                status_hr: 'approved',
                installment_months: 1,
                approved_at: new Date().toISOString(),
              })
              .select('id')
              .single()

            if (!createAdvErr && newAdv?.id) {
              await supabase.from('cash_advance_payments').insert({
                cash_advance_id: newAdv.id,
                amount: kasbonAmount,
                payment_date: paymentDate,
                note: `Pelunasan otomatis via Slip Payroll Periode ${month}/${year}`,
              })
              settledKasbonCount++
            }
          }
        }
      }

      // 3. Mark all draft slips as finalized
      const { error } = await supabase
        .from('payroll_records')
        .update({ status: 'finalized' as PayrollStatus })
        .eq('period_month', month)
        .eq('period_year', year)
        .eq('status', 'draft')

      if (error) throw error

      return {
        finalizedCount: draftSlips.length,
        settledKasbonCount,
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payroll'] })
      queryClient.invalidateQueries({ queryKey: ['cash-advances'] })
      queryClient.invalidateQueries({ queryKey: ['perizinan-summary'] })
      queryClient.invalidateQueries({ queryKey: ['hr-activity'] })
    },
  })

  const finalizeSlip = useMutation({
    mutationFn: async ({ id }: { id: string }) => {
      const { data: slip, error: slipErr } = await supabase
        .from('payroll_records')
        .select('*')
        .eq('id', id)
        .single()

      if (slipErr) throw slipErr
      if (!slip) throw new Error('Slip tidak ditemukan.')
      if (slip.status === 'finalized') throw new Error('Slip sudah berstatus final.')

      const paymentDate = new Date().toISOString().split('T')[0]
      let kasbonAmount = Number(slip.deduction_kasbon) || 0
      if (kasbonAmount === 0 && slip.deduction_note) {
        const m = slip.deduction_note.match(/kasbon[:\s]*rp?\s*([0-9.,]+)/i)
        if (m) kasbonAmount = Number(m[1].replace(/[^0-9]/g, '')) || 0
      }

      if (kasbonAmount > 0) {
        const { data: activeKasbons } = await supabase
          .from('cash_advances')
          .select('id, amount, remaining')
          .eq('staff_id', slip.staff_id)
          .eq('status', 'active')
          .order('created_at', { ascending: true })

        if (activeKasbons && activeKasbons.length > 0) {
          let remainingToDeduct = kasbonAmount
          for (const adv of activeKasbons) {
            if (remainingToDeduct <= 0) break
            const advRemaining = Number(adv.remaining) || 0
            if (advRemaining <= 0) continue

            const deduct = Math.min(remainingToDeduct, advRemaining)
            const newRemaining = Math.max(0, advRemaining - deduct)

            await supabase.from('cash_advance_payments').insert({
              cash_advance_id: adv.id,
              amount: deduct,
              payment_date: paymentDate,
              note: `Potong Slip Payroll Periode ${slip.period_month}/${slip.period_year}`,
            })

            const updatePayload: { remaining: number; status?: CashAdvanceStatus } = {
              remaining: newRemaining,
            }
            if (newRemaining <= 0) updatePayload.status = 'paid_off'

            await supabase
              .from('cash_advances')
              .update(updatePayload)
              .eq('id', adv.id)

            remainingToDeduct -= deduct
          }
        } else {
          const { data: newAdv, error: createAdvErr } = await supabase
            .from('cash_advances')
            .insert({
              staff_id: slip.staff_id,
              amount: kasbonAmount,
              remaining: 0,
              reason: `Potongan Kasbon Payroll Periode ${slip.period_month}/${slip.period_year} (Otomatis via Slip)`,
              status: 'paid_off',
              status_hr: 'approved',
              installment_months: 1,
              approved_at: new Date().toISOString(),
            })
            .select('id')
            .single()

          if (!createAdvErr && newAdv?.id) {
            await supabase.from('cash_advance_payments').insert({
              cash_advance_id: newAdv.id,
              amount: kasbonAmount,
              payment_date: paymentDate,
              note: `Pelunasan otomatis via Slip Payroll Periode ${slip.period_month}/${slip.period_year}`,
            })
          }
        }
      }

      const { error: updErr } = await supabase
        .from('payroll_records')
        .update({ status: 'finalized' as PayrollStatus })
        .eq('id', id)

      if (updErr) throw updErr
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payroll'] })
      queryClient.invalidateQueries({ queryKey: ['cash-advances'] })
      queryClient.invalidateQueries({ queryKey: ['perizinan-summary'] })
      queryClient.invalidateQueries({ queryKey: ['hr-activity'] })
    },
  })

  /**
   * Sync basic_salary (dan tunjangan) dari staff_financials ke payroll_records draft.
   * - Jika forceAll = false (default): hanya update slip yang basic_salary = 0
   * - Jika forceAll = true: update semua slip draft dengan data terkini dari DB karyawan
   */
  const syncSalaryFromDatabase = useMutation({
    mutationFn: async ({
      month,
      year,
      forceAll = true,
    }: {
      month: number
      year: number
      forceAll?: boolean
    }) => {
      // 1. Fetch slip draft yang perlu di-sync
      let query = supabase
        .from('payroll_records')
        .select('id, staff_id, basic_salary, allowance_meal, allowance_transport, allowance_communication, allowance_position, allowance_presence, bonus, deductions, deduction_note, bonus_note')
        .eq('period_month', month)
        .eq('period_year', year)
        .eq('status', 'draft')

      if (!forceAll) {
        query = query.eq('basic_salary', 0)
      }

      const { data: slips, error: slipsErr } = await query
      if (slipsErr) throw slipsErr
      if (!slips || slips.length === 0) {
        return { updatedCount: 0, skippedCount: 0 }
      }

      // 2. Fetch data gaji terbaru dari staff_financials
      const staffIds = slips.map((s: any) => s.staff_id)
      const { data: financials, error: finErr } = await supabase
        .from('staff_financials')
        .select('staff_id, basic_salary, allowance_meal, allowance_transport, allowance_communication, allowance_position, allowance_presence, deduction_bpjs')
        .in('staff_id', staffIds)

      if (finErr) throw finErr

      const finMap = new Map<string, any>()
      financials?.forEach((f: any) => finMap.set(f.staff_id, f))

      let updatedCount = 0
      let skippedCount = 0

      for (const slip of slips) {
        const fin = finMap.get(slip.staff_id)
        if (!fin) {
          skippedCount++
          continue
        }

        const basicSalary = Number(fin.basic_salary) || 0
        if (!forceAll && basicSalary === 0) {
          // Data di staff_financials juga 0, tidak bisa sync
          skippedCount++
          continue
        }

        const allowanceMeal =
          fin.allowance_meal !== undefined && fin.allowance_meal !== null
            ? Number(fin.allowance_meal)
            : Number(fin.allowance_presence) || 0
        const allowanceTransport = Number(fin.allowance_transport) || 0
        const allowanceCommunication = Number(fin.allowance_communication) || 0
        const allowancePosition = Number(fin.allowance_position) || 0

        // Pertahankan bonus & potongan yang sudah ada, hanya update komponen gaji pokok
        const currentBonus = Number(slip.bonus) || 0
        const currentDeductions = Number(slip.deductions) || 0

        const totalEarnings =
          basicSalary +
          allowanceMeal +
          allowanceTransport +
          allowanceCommunication +
          allowancePosition +
          currentBonus
        const totalSalary = Math.max(0, totalEarnings - currentDeductions)

        const { error: updateErr } = await supabase
          .from('payroll_records')
          .update({
            basic_salary: basicSalary,
            allowance_meal: allowanceMeal,
            allowance_transport: allowanceTransport,
            allowance_communication: allowanceCommunication,
            allowance_position: allowancePosition,
            allowance_presence: allowanceMeal,
            total_salary: totalSalary,
          })
          .eq('id', slip.id)

        if (!updateErr) updatedCount++
        else skippedCount++
      }

      return { updatedCount, skippedCount }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payroll'] })
    },
  })

  return { generate, syncAttendanceDeductions, syncSalaryFromDatabase, updateSlip, finalizeAll, finalizeSlip }
}
