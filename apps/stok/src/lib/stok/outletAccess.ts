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
