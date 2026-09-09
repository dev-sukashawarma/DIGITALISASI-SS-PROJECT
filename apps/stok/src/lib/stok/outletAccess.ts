// Gerbang scope-outlet server-side, dipakai Server Action yang menyentuh
// service-role client (bypass RLS). Mirror dari assertOutletAccessible() di
// lib/queries/monitoring.ts (dipakai dari komponen client), versi ini menerima
// client apa pun yang sudah authenticated (browser ATAU server via cookies)
// selama punya auth.uid() aktif — sumber kebenaran tetap RPC accessible_outlet_ids()
// yang sama dipakai RLS (admin/owner/spv/kitchen/admin_finance/admin_hr: semua
// outlet; leader/korlap: outlet di staff_outlets; crew/kiosk/dll: outlet sendiri).
//
// WAJIB dipanggil oleh action yang menerima outlet_id dari client sebelum
// membaca/menulis lewat service-role client — role check saja tidak cukup
// untuk role multi-outlet-scoped (leader/korlap) yang TIDAK otomatis berarti
// akses ke SEMUA outlet.

export interface AuthedClientLike {
  rpc: (fn: string) => PromiseLike<{ data: unknown; error: { message: string } | null }>
}

/**
 * PostgREST mengembalikan SETOF scalar sebagai array of plain value ATAU
 * array of single-key object tergantung versi client — tangani keduanya.
 */
export function parseAccessibleOutletIds(rows: unknown): Set<string> {
  const arr = Array.isArray(rows) ? rows : []
  return new Set(
    arr
      .map((row: unknown) =>
        typeof row === 'string' ? row : (row as { accessible_outlet_ids?: string } | null)?.accessible_outlet_ids
      )
      .filter((id): id is string => !!id)
  )
}

export async function getAccessibleOutletIds(supabase: AuthedClientLike): Promise<Set<string>> {
  const { data, error } = await supabase.rpc('accessible_outlet_ids')
  if (error) throw new Error(error.message)
  return parseAccessibleOutletIds(data)
}

export async function assertOutletAccessible(supabase: AuthedClientLike, outletId: string): Promise<void> {
  const allowed = await getAccessibleOutletIds(supabase)
  if (!allowed.has(outletId)) {
    throw new Error('Forbidden: outlet di luar scope akses Anda')
  }
}

/**
 * Validasi otorisasi outlet menggunakan service-role client secara langsung.
 * Mencakup role-role khusus (regional_manager, area_manager, purchasing, developer)
 * yang mungkin belum ter-cover oleh fungsi SQL RPC yang lama.
 */
export async function assertStaffCanAccessOutlet(serviceClient: any, staffId: string, outletId: string): Promise<void> {
  const { data: staff, error: staffErr } = await serviceClient
    .from('outlet_staff')
    .select('id, role, outlet_id, status')
    .eq('id', staffId)
    .maybeSingle()

  if (staffErr) throw new Error(`DB error: ${staffErr.message}`)
  if (!staff || staff.status !== 'active') throw new Error('Staff tidak aktif atau tidak ditemukan')

  const isPrivileged = [
    'admin', 'admin_hr', 'owner', 'spv', 'kitchen',
    'admin_finance', 'finance', 'purchasing', 'developer', 'regional_manager', 'area_manager'
  ].includes(staff.role)

  if (isPrivileged) return

  if (staff.outlet_id === outletId) return

  // Check staff_outlets untuk leader / korlap / area_manager
  const { data: so } = await serviceClient
    .from('staff_outlets')
    .select('outlet_id')
    .eq('staff_id', staffId)
    .eq('outlet_id', outletId)
    .maybeSingle()

  if (so) return

  throw new Error('Forbidden: outlet di luar scope akses Anda')
}
