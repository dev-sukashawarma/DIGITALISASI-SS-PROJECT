// Re-export server client from @suka/auth for SSO cookie domain consistency
export { createSupabaseServerClient } from '@suka/auth'

import { cookies } from 'next/headers'
import { createSupabaseServerClient } from '@suka/auth'
import { createServerClient } from '@supabase/ssr'

/** Convenience wrapper for RSC/Server Actions using next/headers cookies. */
export async function createClient() {
  const cookieStore = await cookies()
  return createSupabaseServerClient({
    getAll: () => cookieStore.getAll(),
    setAll: (cookiesToSet) => {
      try {
        cookiesToSet.forEach(({ name, value, options }) =>
          cookieStore.set(name, value, { ...options as object, maxAge: 31536000 })
        )
      } catch {
        // Server Component — cookie setting handled by middleware
      }
    },
  })
}

/** Service-role client (bypasses RLS). Use only in API Routes. */
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
