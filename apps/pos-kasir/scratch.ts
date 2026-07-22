import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY! 

const supabase = createClient(supabaseUrl, supabaseKey)

async function checkPettyCashCalculation() {
  const dramagaId = '550e8400-e29b-41d4-a716-446655440013'

  // Get active shift
  const { data: activeShift } = await supabase
    .from('shifts')
    .select('*')
    .eq('outlet_id', dramagaId)
    .eq('status', 'open')
    .maybeSingle()

  // Get last closed shift
  const { data: lastClosedShift } = await supabase
    .from('shifts')
    .select('*')
    .eq('outlet_id', dramagaId)
    .eq('status', 'closed')
    .order('end_time', { ascending: false })
    .limit(1)
    .maybeSingle()

  console.log('=== ACTIVE SHIFT ===')
  console.log(activeShift)

  console.log('=== LAST CLOSED SHIFT ===')
  console.log(lastClosedShift)

  if (activeShift) {
    const shiftStartTime = activeShift.start_time

    const { data: shiftTopups } = await supabase
      .from('petty_cash_topups')
      .select('*')
      .eq('outlet_id', dramagaId)
      .gte('created_at', shiftStartTime)
      .in('status', ['approved', 'completed'])

    const { data: shiftExpenses } = await supabase
      .from('petty_cash_expenses')
      .select('*')
      .eq('outlet_id', dramagaId)
      .gte('created_at', shiftStartTime)

    const startingPettyCash = Number(activeShift.starting_petty_cash || 0)
    const totalShiftTopups = (shiftTopups || []).reduce((sum, t) => sum + Number(t.amount), 0)
    const totalShiftExpenses = (shiftExpenses || []).reduce((sum, e) => sum + Number(e.amount), 0)

    const currentShiftBalance = startingPettyCash + totalShiftTopups - totalShiftExpenses

    console.log('\n=== REKALKULASI SALDO PETTY CASH (SHIFT AKTIF) ===')
    console.log('Starting Petty Cash Shift Ini:', startingPettyCash)
    console.log('Total Topup Approved/Completed (Shift Ini):', totalShiftTopups, shiftTopups)
    console.log('Total Expenses (Shift Ini):', totalShiftExpenses, shiftExpenses)
    console.log('--> SALDO PETTY CASH SHIFT SAAT INI:', currentShiftBalance)

    if (lastClosedShift && lastClosedShift.actual_ending_petty_cash != null) {
      const carryOverBalance = Number(lastClosedShift.actual_ending_petty_cash) + totalShiftTopups - totalShiftExpenses
      console.log('--> JIKA MENGGUNAKAN SALDO AKHIR SHIFT LALU (Carry Over):', carryOverBalance)
    }
  }

  // Check cumulative overall
  const { data: allCompletedTopups } = await supabase
    .from('petty_cash_topups')
    .select('amount')
    .eq('outlet_id', dramagaId)
    .in('status', ['approved', 'completed'])

  const { data: allExpenses } = await supabase
    .from('petty_cash_expenses')
    .select('amount')
    .eq('outlet_id', dramagaId)

  const cumTopups = (allCompletedTopups || []).reduce((s, t) => s + Number(t.amount), 0)
  const cumExpenses = (allExpenses || []).reduce((s, e) => s + Number(e.amount), 0)
  console.log('\n=== KUKUMULATIF SEPANJANG WAKTU ===')
  console.log('Total All Topups Approved/Completed:', cumTopups)
  console.log('Total All Expenses:', cumExpenses)
  console.log('--> SELISIH KUMULATIF (Topups - Expenses):', cumTopups - cumExpenses)
}

checkPettyCashCalculation()
