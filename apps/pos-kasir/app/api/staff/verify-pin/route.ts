import crypto from 'crypto'
import { NextResponse } from 'next/server'
import { extractClientIp } from '@suka/auth'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { resolveApiUser } from '@/lib/api-auth'

function constantTimeEquals(a: string, b: string): boolean {
  const bufA = Buffer.from(a, 'utf8')
  const bufB = Buffer.from(b, 'utf8')
  if (bufA.length !== bufB.length) {
    // Tetap jalankan perbandingan dummy agar waktu eksekusi konstan
    crypto.timingSafeEqual(bufA, bufA)
    return false
  }
  return crypto.timingSafeEqual(bufA, bufB)
}

export async function POST(request: Request) {
  try {
    const caller = await resolveApiUser(request)
    if (!caller) {
      return NextResponse.json({ error: 'Tidak terautentikasi' }, { status: 401 })
    }

    const body = await request.json().catch(() => null)
    const pin = typeof body?.pin === 'string' ? body.pin.trim() : ''
    const outlet_id = typeof body?.outlet_id === 'string' ? body.outlet_id.trim() : ''

    if (!pin || !outlet_id || pin.length > 32) {
      return NextResponse.json({ error: 'Missing pin or outlet_id' }, { status: 400 })
    }

    const supabaseService = createServiceClient()
    const clientIp = extractClientIp(request.headers)

    // Verifikasi pemanggil adalah staf aktif yang punya akses ke outlet tersebut
    const { data: callerProfile } = await supabaseService
      .from('outlet_staff')
      .select('id, status, outlet_id, role')
      .eq('id', caller.id)
      .maybeSingle()

    if (!callerProfile || callerProfile.status !== 'active') {
      return NextResponse.json({ error: 'Akun kasir tidak aktif' }, { status: 403 })
    }

    if (callerProfile.outlet_id !== outlet_id && !['admin', 'owner', 'developer', 'regional_manager', 'spv'].includes(callerProfile.role)) {
      const authedClient = await createClient()
      const { data: allowedOutlets } = await authedClient.rpc('accessible_outlet_ids')
      const allowedSet = new Set(
        (Array.isArray(allowedOutlets) ? allowedOutlets : []).map((r: unknown) =>
          typeof r === 'string' ? r : (r as { accessible_outlet_ids?: string })?.accessible_outlet_ids
        )
      )
      if (!allowedSet.has(outlet_id)) {
        return NextResponse.json({ error: 'Outlet di luar cakupan akses Anda' }, { status: 403 })
      }
    }

    // Cek rate-limit PIN (maksimal 5 gagal dalam 10 menit per outlet + IP)
    const { data: allowed } = await supabaseService.rpc('check_pin_rate_limit', {
      p_outlet_id: outlet_id,
      p_ip: clientIp,
    })

    if (allowed === false) {
      return NextResponse.json(
        { error: 'Terlalu banyak percobaan PIN salah. Silakan tunggu 10 menit.' },
        { status: 429 }
      )
    }

    // Ambil kandidat SPV/Leader aktif di outlet tersebut lalu cocokkan secara timing-safe
    const { data: candidates, error } = await supabaseService
      .from('outlet_staff')
      .select('id, name, role, pin')
      .eq('outlet_id', outlet_id)
      .in('role', ['spv', 'kepala_outlet', 'regional_manager'])
      .eq('status', 'active')
      .not('pin', 'is', null)

    if (error || !candidates) {
      await supabaseService.rpc('record_pin_attempt', {
        p_outlet_id: outlet_id,
        p_ip: clientIp,
        p_caller_id: caller.id,
        p_success: false,
      })
      return NextResponse.json(
        { error: 'PIN tidak valid atau Anda tidak memiliki akses (Supervisor/Leader)' },
        { status: 401 }
      )
    }

    let matchedStaff: { id: string; name: string; role: string } | null = null
    for (const candidate of candidates) {
      if (typeof candidate.pin === 'string' && constantTimeEquals(candidate.pin, pin)) {
        matchedStaff = { id: candidate.id, name: candidate.name, role: candidate.role }
      }
    }

    await supabaseService.rpc('record_pin_attempt', {
      p_outlet_id: outlet_id,
      p_ip: clientIp,
      p_caller_id: caller.id,
      p_success: Boolean(matchedStaff),
    })

    if (!matchedStaff) {
      return NextResponse.json(
        { error: 'PIN tidak valid atau Anda tidak memiliki akses (Supervisor/Leader)' },
        { status: 401 }
      )
    }

    return NextResponse.json({ success: true, staff: matchedStaff })
  } catch (err) {
    console.error('Verify PIN error:', err)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
