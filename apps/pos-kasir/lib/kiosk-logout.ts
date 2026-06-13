// Logika murni untuk menentukan akun kiosk mana yang boleh di-logout oleh requester.
// Dipisah dari API route agar mudah diuji (vitest, node).

export interface KioskAccount {
  id: string
  outlet_id: string | null
}

export interface LogoutRequest {
  // 'all' = logout semua kiosk di outlet requester; selain itu = user_id akun kiosk target.
  target: string
}

export interface RequesterProfile {
  role: string
  outlet_id: string | null
}

export interface ResolveResult {
  ok: boolean
  status: number
  targetUserIds: string[]
  error?: string
}

/**
 * Tentukan daftar akun kiosk yang akan di-logout.
 *
 * @param requester  Profil user yang meminta (harus role 'kasir' dengan outlet_id).
 * @param body       Payload request { target }.
 * @param outletKiosks  SEMUA akun kiosk milik outlet requester (sudah difilter di API).
 */
export function resolveLogoutTargets(
  requester: RequesterProfile,
  body: LogoutRequest,
  outletKiosks: KioskAccount[]
): ResolveResult {
  if (requester.role !== 'kasir') {
    return { ok: false, status: 403, targetUserIds: [], error: 'Hanya kasir yang dapat me-logout kiosk' }
  }
  if (!requester.outlet_id) {
    return { ok: false, status: 403, targetUserIds: [], error: 'Akun Anda tidak terhubung ke cabang' }
  }
  if (!body || !body.target) {
    return { ok: false, status: 400, targetUserIds: [], error: 'Target logout wajib diisi' }
  }

  if (body.target === 'all') {
    return { ok: true, status: 200, targetUserIds: outletKiosks.map((k) => k.id) }
  }

  const match = outletKiosks.find((k) => k.id === body.target)
  if (!match) {
    return { ok: false, status: 403, targetUserIds: [], error: 'Kiosk tersebut bukan milik cabang Anda' }
  }
  return { ok: true, status: 200, targetUserIds: [match.id] }
}
