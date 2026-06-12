import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { resolveLogoutTargets } from '@/lib/kiosk-logout'

export async function POST(request: Request) {
  // 1. Identifikasi requester (harus kasir) dari cookie sesi
  const cookieStore = cookies()
  const supabaseAuth = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll() { return cookieStore.getAll() }, setAll() {} } }
  )

  const { data: { user } } = await supabaseAuth.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Tidak terautentikasi' }, { status: 401 })
  }

  const service = createServiceClient()
  const { data: profile } = await service
    .from('profiles')
    .select('role, outlet_id')
    .eq('id', user.id)
    .single()

  if (!profile) {
    return NextResponse.json({ error: 'Profil tidak ditemukan' }, { status: 403 })
  }

  let body: { target?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Request body tidak valid' }, { status: 400 })
  }

  // 2. Ambil semua akun kiosk di outlet requester (otoritatif dari server)
  const { data: kiosks } = await service
    .from('profiles')
    .select('id, outlet_id')
    .eq('role', 'kiosk')
    .eq('outlet_id', profile.outlet_id ?? '__none__')

  // 3. Validasi & tentukan target (logika murni teruji)
  const resolved = resolveLogoutTargets(
    { role: profile.role, outlet_id: profile.outlet_id },
    { target: body.target ?? '' },
    kiosks ?? []
  )
  if (!resolved.ok) {
    return NextResponse.json({ error: resolved.error }, { status: resolved.status })
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

  // 4. HARD REVOKE (untuk tablet OFFLINE / abai sinyal): hapus sesi server by user_id.
  //    Best-effort — butuh fungsi SQL `revoke_kiosk_sessions` (lihat migration-kiosk-logout.sql).
  //    Jika belum dipasang, fitur tetap berfungsi: tablet ONLINE tetap hard-logout via langkah 5
  //    (kiosk memanggil signOut({scope:'global'}) sendiri saat menerima broadcast).
  let hardRevoke = true
  for (const id of resolved.targetUserIds) {
    const { error } = await service.rpc('revoke_kiosk_sessions', { target_user: id })
    if (error) hardRevoke = false
  }

  // 5. SINYAL INSTAN ke tablet yang online: broadcast force_logout ke channel outlet.
  //    Ini mekanisme utama yang menentukan sukses/gagal yang dilihat kasir.
  let broadcastOk = false
  try {
    const res = await fetch(`${url}/realtime/v1/api/broadcast`, {
      method: 'POST',
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messages: [
          {
            topic: `kiosk-control:${profile.outlet_id}`,
            event: 'force_logout',
            payload: { target: body.target },
            private: false,
          },
        ],
      }),
    })
    broadcastOk = res.ok
  } catch {
    broadcastOk = false
  }

  if (!broadcastOk) {
    return NextResponse.json(
      { error: 'Gagal mengirim sinyal logout ke kiosk' },
      { status: 502 }
    )
  }

  return NextResponse.json({
    success: true,
    hardRevoke, // false jika fungsi SQL belum dipasang (tablet offline belum dijamin ter-revoke)
    targets: resolved.targetUserIds,
  })
}
