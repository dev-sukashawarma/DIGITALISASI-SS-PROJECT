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

// Gunakan hanya di API Routes - bypasses RLS
export function createServiceClient() {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      cookies: {
        getAll() { return [] },
        setAll() {},
      },
    }
  )
}
