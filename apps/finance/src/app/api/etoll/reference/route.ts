import { NextRequest, NextResponse } from 'next/server'
import { EtollAuthError, requireEtollActor } from '@/lib/etoll/auth'
import { getServiceSupabase } from '@/lib/supabase-service'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    await requireEtollActor(req, { financeOnly: true })
    const admin = getServiceSupabase()

    const [staffRes, outletsRes] = await Promise.all([
      admin
        .from('outlet_staff')
        .select('id, name, role, outlet_id')
        .eq('status', 'active')
        .order('name', { ascending: true })
        .limit(500),
      admin
        .from('outlets')
        .select('id, name, type')
        .eq('is_active', true)
        .order('name', { ascending: true }),
    ])

    if (staffRes.error) return NextResponse.json({ error: staffRes.error.message }, { status: 500 })
    if (outletsRes.error) return NextResponse.json({ error: outletsRes.error.message }, { status: 500 })

    return NextResponse.json({
      staff: staffRes.data ?? [],
      outlets: outletsRes.data ?? [],
    })
  } catch (err: any) {
    if (err instanceof EtollAuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status })
    }
    return NextResponse.json({ error: err?.message || 'Gagal memuat data referensi' }, { status: 500 })
  }
}
