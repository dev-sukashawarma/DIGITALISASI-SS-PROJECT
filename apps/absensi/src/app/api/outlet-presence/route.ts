import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const outlet_id = searchParams.get('outlet_id')

  if (!outlet_id) {
    return NextResponse.json({ error: 'outlet_id is required' }, { status: 400 })
  }

  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  }

  const supabase = createServerSupabaseClient()

  try {
    // Cari absensi dalam 18 jam terakhir untuk outlet ini
    const eighteenHoursAgo = new Date(Date.now() - 18 * 60 * 60 * 1000).toISOString()
    
    const { data, error } = await supabase
      .from('attendance')
      .select('outlet_staff_id, type')
      .eq('outlet_id', outlet_id)
      .gte('ts_server', eighteenHoursAgo)
      .order('ts_server', { ascending: false })

    if (error) throw error;

    let hasPresence = false;
    const staffStatus = new Map<string, string>();
    
    if (data) {
        // Karena di-order dari yang paling baru, status pertama yang kita temukan untuk staff tersebut adalah status terkininya
        for (const record of data) {
            if (!staffStatus.has(record.outlet_staff_id)) {
                staffStatus.set(record.outlet_staff_id, record.type)
            }
        }
        
        // Jika ada minimal 1 staff yang status terkininya adalah 'in', berarti outlet sedang 'Buka'
        for (const [_, type] of Array.from(staffStatus.entries())) {
            if (type === 'in') {
                hasPresence = true;
                break;
            }
        }
    }

    return NextResponse.json({ hasPresence }, { headers })
  } catch (error: any) {
    console.error('Error checking presence:', error)
    return NextResponse.json({ error: error.message }, { status: 500, headers })
  }
}

export async function OPTIONS() {
  return NextResponse.json({}, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    }
  })
}
