import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const WINDOW_MS = 10 * 60 * 1000
const MAX_IDENTIFIER_FAILS = 8
const MAX_IP_FAILS = 20
const MAX_TRACKED_KEYS = 4096

type Bucket = { fails: number[] }

const identBuckets = new Map<string, Bucket>()
const ipBuckets = new Map<string, Bucket>()

function pruneTimestamps(list: number[], cutoff: number): number[] {
  let idx = 0
  while (idx < list.length && list[idx] < cutoff) idx++
  return idx > 0 ? list.slice(idx) : list
}

function getActiveFails(map: Map<string, Bucket>, key: string, now: number): number[] {
  const entry = map.get(key)
  if (!entry) return []
  const fresh = pruneTimestamps(entry.fails, now - WINDOW_MS)
  if (fresh.length === 0) {
    map.delete(key)
    return []
  }
  entry.fails = fresh
  return fresh
}

function recordMemoryFail(map: Map<string, Bucket>, key: string, now: number) {
  if (!key || key === 'unknown') return
  if (map.size >= MAX_TRACKED_KEYS && !map.has(key)) {
    const oldestKey = map.keys().next().value
    if (oldestKey) map.delete(oldestKey)
  }
  const existing = getActiveFails(map, key, now)
  existing.push(now)
  map.set(key, { fails: existing })
}

let cachedServiceClient: { url: string; key: string; client: SupabaseClient } | null = null

/**
 * Server-only Supabase Service Role client untuk operasi keamanan internal
 * (rate-limit login & resolusi username -> email tanpa membocorkan tabel outlet_staff ke anon).
 */
export function createSupabaseServiceClient(): SupabaseClient | null {
  if (typeof window !== 'undefined') {
    throw new Error('createSupabaseServiceClient hanya boleh dipanggil di server')
  }
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return null

  if (!cachedServiceClient || cachedServiceClient.url !== url || cachedServiceClient.key !== key) {
    cachedServiceClient = {
      url,
      key,
      client: createClient(url, key, {
        auth: { autoRefreshToken: false, persistSession: false },
      }),
    }
  }
  return cachedServiceClient.client
}

/** Ekstrak IP klien dengan batas panjang aman agar header palsu tidak membebani DB/memori. */
export function extractClientIp(headers: Headers): string {
  const candidates = [
    headers.get('cf-connecting-ip'),
    headers.get('x-real-ip'),
    headers.get('x-forwarded-for')?.split(',')[0],
  ]
  for (const raw of candidates) {
    const ip = raw?.trim()
    if (ip && ip.length <= 64 && /^[a-fA-F0-9.:]+$/.test(ip)) {
      return ip
    }
  }
  return 'unknown'
}

/** Validasi header Origin untuk mencegah Cross-Site Login CSRF. */
export function isTrustedAuthOrigin(originHeader: string | null, requestOrigin: string): boolean {
  if (!originHeader) return true
  try {
    const originUrl = new URL(originHeader)
    const reqUrl = new URL(requestOrigin)
    if (originUrl.origin === reqUrl.origin) return true
    const host = originUrl.hostname.toLowerCase()
    if (host === 'sukashawarma.com' || host.endsWith('.sukashawarma.com')) return true
    if (host === 'localhost' || host === '127.0.0.1') return true
    return false
  } catch {
    return false
  }
}

export type RateLimitStatus = {
  allowed: boolean
  retryAfterSec: number
}

/**
 * Cek batas percobaan login berlapis:
 * 1. Memori lokal (instan <0.05ms untuk menahan banjir request mendadak)
 * 2. PostgreSQL terdistribusi (`check_login_rate_limit`) agar konsisten lintas instance/restart
 */
export async function checkAuthRateLimit(
  ip: string,
  identifier: string,
  serviceClient: SupabaseClient | null = createSupabaseServiceClient(),
  nowMs: number = Date.now()
): Promise<RateLimitStatus> {
  const normIdent = identifier.trim().toLowerCase()
  const normIp = ip.trim() || 'unknown'

  const identFails = getActiveFails(identBuckets, normIdent, nowMs)
  if (identFails.length >= MAX_IDENTIFIER_FAILS) {
    const retrySec = Math.max(60, Math.ceil((identFails[0] + WINDOW_MS - nowMs) / 1000))
    return { allowed: false, retryAfterSec: Math.min(600, retrySec) }
  }

  if (normIp !== 'unknown') {
    const ipFails = getActiveFails(ipBuckets, normIp, nowMs)
    if (ipFails.length >= MAX_IP_FAILS) {
      const retrySec = Math.max(60, Math.ceil((ipFails[0] + WINDOW_MS - nowMs) / 1000))
      return { allowed: false, retryAfterSec: Math.min(600, retrySec) }
    }
  }

  if (serviceClient) {
    try {
      const { data, error } = await serviceClient.rpc('check_login_rate_limit', {
        p_ip: normIp,
        p_identifier: normIdent,
      })
      if (!error && data && typeof data === 'object') {
        const res = data as { allowed?: boolean; retry_after_sec?: number }
        if (res.allowed === false) {
          return {
            allowed: false,
            retryAfterSec: typeof res.retry_after_sec === 'number' && res.retry_after_sec > 0 ? res.retry_after_sec : 300,
          }
        }
      }
    } catch {
      // Fallback ke proteksi memori bila koneksi DB sesaat terganggu
    }
  }

  return { allowed: true, retryAfterSec: 0 }
}

/** Catat hasil percobaan login ke memori & tabel audit rate-limit DB. */
export async function recordAuthAttempt(
  ip: string,
  identifier: string,
  success: boolean,
  serviceClient: SupabaseClient | null = createSupabaseServiceClient(),
  nowMs: number = Date.now()
): Promise<void> {
  const normIdent = identifier.trim().toLowerCase()
  const normIp = ip.trim() || 'unknown'

  if (success) {
    identBuckets.delete(normIdent)
  } else {
    recordMemoryFail(identBuckets, normIdent, nowMs)
    recordMemoryFail(ipBuckets, normIp, nowMs)
  }

  if (serviceClient) {
    try {
      await serviceClient.rpc('record_login_attempt', {
        p_ip: normIp,
        p_identifier: normIdent,
        p_success: success,
      })
    } catch {
      // Abaikan kegagalan pencatatan agar login sah tidak pernah terganggu
    }
  }
}

/** Reset state memori khusus pengujian unit. */
export function __resetAuthRateLimitMemoryForTests(): void {
  identBuckets.clear()
  ipBuckets.clear()
}

/**
 * Resolusi identitas login (email atau username) ke daftar kandidat email otoritatif
 * secara server-side tanpa mengekspos tabel `outlet_staff` ke browser anonim.
 */
export async function resolveLoginCandidates(
  identifier: string,
  serviceClient: SupabaseClient | null = createSupabaseServiceClient()
): Promise<string[]> {
  const cleanId = identifier.trim()
  if (!cleanId) return []

  if (cleanId.includes('@')) {
    return [cleanId.toLowerCase()]
  }

  const candidates: string[] = []

  if (serviceClient && /^[a-zA-Z0-9_.-]{1,64}$/.test(cleanId)) {
    try {
      const { data: staffMatch } = await serviceClient
        .from('outlet_staff')
        .select('id, email, username')
        .ilike('username', cleanId)
        .maybeSingle()

      if (staffMatch?.id) {
        const { data: authUserRes } = await serviceClient.auth.admin.getUserById(staffMatch.id)
        if (authUserRes?.user?.email) {
          candidates.push(authUserRes.user.email.toLowerCase())
        }
      }

      const rawUser = (staffMatch?.username || cleanId).toLowerCase()
      candidates.push(`${rawUser}@ss.com`)
      if (staffMatch?.email) {
        candidates.push(staffMatch.email.toLowerCase())
      }
      candidates.push(`${rawUser}@outlet.local`)
    } catch {
      // Jatuh ke kandidat standar di bawah bila query gagal
    }
  }

  const lower = cleanId.toLowerCase()
  candidates.push(`${lower}@ss.com`)
  candidates.push(`${lower}@outlet.local`)

  return Array.from(new Set(candidates.filter(Boolean)))
}

/** Normalisasi waktu respons saat gagal login untuk mencegah timing user-enumeration. */
export async function enforceMinimumAuthDelay(startedAtMs: number, minMs = 280): Promise<void> {
  const jitter = Math.floor(Math.random() * 45)
  const remaining = minMs + jitter - (Date.now() - startedAtMs)
  if (remaining > 0) {
    await new Promise((resolve) => setTimeout(resolve, remaining))
  }
}
