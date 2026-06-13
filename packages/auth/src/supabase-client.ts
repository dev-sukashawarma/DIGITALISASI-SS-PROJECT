import { createBrowserClient } from '@supabase/ssr'

/** Domain cookie sesi; kosong di lokal (per-port), '.sukashawarma.com' di prod. */
const cookieDomain = process.env.NEXT_PUBLIC_COOKIE_DOMAIN || undefined

export function createSupabaseBrowserClient() {
  return createBrowserClient(
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
}
