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
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://khpkoreaaucvyqfhynfq.supabase.co'
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtocGtvcmVhYXVjdnlxZmh5bmZxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA5NjMyOTIsImV4cCI6MjA5NjUzOTI5Mn0.RdsvP6OKs6aiRnqqd02BYiv5gzbh4uGqO88dapo0Gso'

  return createServerClient(
    url,
    anonKey,
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
