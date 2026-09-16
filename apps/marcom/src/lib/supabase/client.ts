'use client'
import { createBrowserClient } from '@supabase/ssr'

const cookieDomain = process.env.NEXT_PUBLIC_COOKIE_DOMAIN || undefined

let browserClient: ReturnType<typeof createBrowserClient> | undefined

export function createClient() {
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
