import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { createSupabaseServerClient } from '@suka/auth'

/**
 * Server Supabase client (RSC / Server Action) untuk pos-kasir.
 *
 * Delegasi ke `@suka/auth` agar cookie options + nama (default
 * `sb-<project-ref>-auth-token`) identik dengan Portal & middleware — syarat
 * SSO gerbang tunggal. JANGAN set cookie name custom di sini. Lihat ADR-008.
 */
export async function createClient() {
  const cookieStore = await cookies()
  return createSupabaseServerClient({
    getAll: () => cookieStore.getAll(),
    setAll: (cookiesToSet) => {
      try {
        cookiesToSet.forEach(({ name, value, options }) =>
          cookieStore.set(name, value, options as Parameters<typeof cookieStore.set>[2])
        )
      } catch {
        // Server Component - cookie setting handled by middleware
      }
    },
  })
}

/** Dilempar saat env service-role tidak tersedia di RUNTIME container. */
export class ServiceRoleMissingError extends Error {
  constructor() {
    super(
      'Konfigurasi server belum lengkap: SUPABASE_SERVICE_ROLE_KEY tidak tersedia di runtime. ' +
      'Set variabel ini di panel VPS untuk app admin-dashboard, lalu redeploy.'
    )
    this.name = 'ServiceRoleMissingError'
  }
}

// Gunakan hanya di API Routes - bypasses RLS
export function createServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  // Tanpa guard ini, @supabase/ssr melempar "supabaseKey is required" mentah →
  // Next membalas HTML 500, client gagal `res.json()` dan hanya bisa bilang
  // "Gagal menghubungi server" (sebab aslinya tak pernah kelihatan).
  if (!url || !serviceKey) throw new ServiceRoleMissingError()

  return createServerClient(
    url,
    serviceKey,
    {
      cookies: {
        getAll() { return [] },
        setAll() {},
      },
    }
  )
}
