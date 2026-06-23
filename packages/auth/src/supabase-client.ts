import { createBrowserClient } from '@supabase/ssr'

/** Domain cookie sesi; kosong di lokal (per-port), '.sukashawarma.com' di prod. */
const cookieDomain = process.env.NEXT_PUBLIC_COOKIE_DOMAIN || undefined

/**
 * Singleton browser client. createBrowserClient() tidak memoize, jadi tiap
 * pemanggilan per-render dulu membuat GoTrueClient baru (auth listener + lock
 * berlebih, warning "Multiple GoTrueClient instances"). Cache 1 instance per
 * tab supaya hemat — config identik tiap pemanggilan, jadi aman dibagikan.
 */
let browserClient: ReturnType<typeof createBrowserClient> | undefined

export function createSupabaseBrowserClient() {
  if (browserClient) return browserClient
  browserClient = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookieOptions: {
        domain: cookieDomain,
        path: '/',
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
        maxAge: 31536000,
      },
    }
  )
  return browserClient
}
