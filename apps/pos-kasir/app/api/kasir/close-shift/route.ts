import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { 
      shiftId, 
      actualCash, 
      expectedCash, 
      actualPettyCash, 
      expectedPettyCash,
      closedBy 
    } = body

    if (!shiftId) {
      return NextResponse.json({ error: 'shiftId required' }, { status: 400 })
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
    
    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Supabase credentials missing')
    }

    const supabase = createClient(supabaseUrl, supabaseKey)

    const variance = actualCash - expectedCash
    const pettyCashVariance = actualPettyCash - expectedPettyCash

    // Update the shifts table
    const { error } = await supabase
      .from('shifts')
      .update({
        status: 'closed',
        end_time: new Date().toISOString(),
        closed_by: closedBy || null,
        actual_ending_cash: actualCash,
        expected_ending_cash: expectedCash,
        variance: variance,
        actual_ending_petty_cash: actualPettyCash,
        expected_ending_petty_cash: expectedPettyCash,
        petty_cash_variance: pettyCashVariance
      })
      .eq('id', shiftId)
      .eq('status', 'open')

    if (error) {
      throw error
    }

    return NextResponse.json({ success: true })
  } catch (err: any) {
    console.error('Error in close-shift API:', err)
    return NextResponse.json({ error: err.message || 'Internal error' }, { status: 500 })
  }
}
