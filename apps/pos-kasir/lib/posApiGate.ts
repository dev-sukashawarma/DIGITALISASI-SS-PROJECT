import { NextResponse } from 'next/server'
import { resolveApiUser } from '@/lib/api-auth'
import { createClient as createSupabaseJsClient } from '@supabase/supabase-js'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { isPosStaffRole, secretMatches } from '@/lib/onlineOrderRules'

// Middleware pos-kasir meneruskan SEMUA request `/api/*` tanpa memeriksa login
// (lihat middleware.ts `isApiPath`). Jadi route yang memakai service role WAJIB
// menjaga dirinya sendiri. Gerbang ini dipakai endpoint sinkron pesanan
// website: sebelumnya siapa pun di internet bisa memanggilnya tanpa login —
// mis. `sync-internal` bisa membatalkan order apa pun (omzet jadi 0, stok
// dikembalikan) hanya dengan id order.

export type PosCaller =
  | { ok: true; via: 'internal' }
  | { ok: true; via: 'staff'; staffId: string; role: string; outletId: string | null }

function readInternalToken(request: Request): string {
  const header = request.headers.get('x-internal-token')
  if (header) return header
  const auth = request.headers.get('authorization')
  return auth?.startsWith('Bearer ') ? auth.slice(7).trim() : ''
}

/** Rahasia server-ke-server (order-system / cron). Tak pernah cocok bila env kosong. */
function isInternalCall(request: Request): boolean {
  const token = readInternalToken(request)
  return (
    secretMatches(token, process.env.ORDER_TO_KASIR_SECRET) ||
    secretMatches(token, process.env.CRON_SECRET)
  )
}

/**
 * Izinkan: (a) pemanggil server dengan rahasia internal, atau (b) staf POS
 * aktif — lewat cookie sesi web kasir maupun Bearer access token aplikasi
 * Android (`resolveApiUser`). Selain itu 401/403.
 */
export async function requirePosCaller(request: Request): Promise<PosCaller | NextResponse> {
  if (isInternalCall(request)) return { ok: true, via: 'internal' }

  const user = await resolveApiUser(request)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: staff } = await createServiceClient()
    .from('outlet_staff')
    .select('id, role, outlet_id, status')
    .eq('id', user.id)
    .maybeSingle()

  if (!staff || staff.status !== 'active' || !isPosStaffRole(staff.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  return { ok: true, via: 'staff', staffId: staff.id, role: staff.role, outletId: staff.outlet_id }
}

/**
 * Apakah staf pemanggil boleh menyentuh outlet ini? Memakai
 * `accessible_outlet_ids()` yang dievaluasi dengan sesi staf itu sendiri —
 * sumber scope yang sama dengan RLS (leader via staff_outlets, regional
 * manager per wilayah, crew satu outlet). Jangan hardcode daftar outlet.
 */
export async function staffCanTouchOutlet(request: Request, primaryOutletId: string | null, outletId: string): Promise<boolean> {
  if (primaryOutletId === outletId) return true

  const auth = request.headers.get('authorization')
  const client = auth?.startsWith('Bearer ')
    ? createSupabaseJsClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
        global: { headers: { Authorization: auth } },
        auth: { persistSession: false, autoRefreshToken: false },
      })
    : await createClient()

  const { data, error } = await client.rpc('accessible_outlet_ids')
  if (error || !Array.isArray(data)) return false
  return data.some((row: unknown) =>
    (typeof row === 'string' ? row : (row as { accessible_outlet_ids?: string } | null)?.accessible_outlet_ids) === outletId
  )
}
