import { createServerClient } from '@supabase/ssr'

const cookieDomain = process.env.NEXT_PUBLIC_COOKIE_DOMAIN || undefined

type CookieToSet = { name: string; value: string; options?: Record<string, unknown> }

/**
 * Buat server client untuk middleware / RSC.
 * `getAll`/`setAll` di-inject oleh pemanggil (next/headers cookies, atau request/response middleware).
 */
export function createSupabaseServerClient(cookieAdapter: {
  getAll: () => { name: string; value: string }[]
  setAll: (cookies: CookieToSet[]) => void
}) {
  return createServerClient(
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
      cookies: {
        getAll: cookieAdapter.getAll,
        setAll: cookieAdapter.setAll,
      },
    }
  )
}
