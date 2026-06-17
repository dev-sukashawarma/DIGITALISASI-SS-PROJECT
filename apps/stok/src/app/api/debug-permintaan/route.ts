import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createSupabaseServerClient } from '@suka/auth'
import { createClient } from '@supabase/supabase-js'

export async function GET() {
  const cookieStore = await cookies()

  // Client pakai user session
  const supabase = createSupabaseServerClient({
    getAll: () => cookieStore.getAll(),
    setAll: (toSet) =>
      toSet.forEach(({ name, value, options }) =>
        cookieStore.set(name, value, options as any)
      ),
  })

  const { data: { user } } = await supabase.auth.getUser()

  // Service role — bypass RLS
  const svc = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  // Cek outlet_staff record untuk user ini
  const { data: staffRow } = await svc
    .from('outlet_staff')
    .select('id, role, outlet_id, status, nama')
    .eq('id', user?.id ?? '')
    .single()

  // Cek accessible_outlet_ids via RPC (pakai user session)
  const { data: accessibleOutlets } = await supabase.rpc('accessible_outlet_ids')

  const { data: allRows, error: svcErr } = await svc
    .from('permintaan_bahan')
    .select('id, outlet_id, status, created_at, dibuat_oleh')
    .order('created_at', { ascending: false })
    .limit(5)

  const { data: userRows, error: userErr } = await supabase
    .from('permintaan_bahan')
    .select('id, outlet_id, status, created_at')
    .order('created_at', { ascending: false })
    .limit(20)

  return NextResponse.json({
    server_auth_uid: user?.id ?? 'ANON/NULL',
    outlet_staff_record: staffRow ?? 'NOT FOUND',
    accessible_outlet_ids: accessibleOutlets ?? [],
    service_role: {
      count: allRows?.length ?? 0,
      error: svcErr?.message ?? null,
      rows: allRows ?? [],
    },
    user_session: {
      count: userRows?.length ?? 0,
      error: userErr?.message ?? null,
      rows: userRows ?? [],
    },
  })
}
