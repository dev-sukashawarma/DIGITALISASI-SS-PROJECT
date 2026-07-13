import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { pin, outlet_id } = body

    if (!pin || !outlet_id) {
      return NextResponse.json({ error: 'Missing pin or outlet_id' }, { status: 400 })
    }

    const supabase = createServiceClient()

    // Cari staff berdasarkan pin dan outlet, dengan role spv atau kepala_outlet
    const { data: staff, error } = await supabase
      .from('outlet_staff')
      .select('id, name, role')
      .eq('outlet_id', outlet_id)
      .eq('pin', pin)
      .in('role', ['spv', 'kepala_outlet'])
      .eq('status', 'active')
      .single()

    if (error || !staff) {
      return NextResponse.json({ error: 'PIN tidak valid atau Anda tidak memiliki akses (Supervisor/Leader)' }, { status: 401 })
    }

    return NextResponse.json({ success: true, staff })
  } catch (err) {
    console.error('Verify PIN error:', err)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
