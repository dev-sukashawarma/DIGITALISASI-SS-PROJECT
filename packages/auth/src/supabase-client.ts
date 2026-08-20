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
  // Pada handoff dari POS, halaman `/auth/sso` menangani token fragmen sendiri
  // agar bisa mengubahnya menjadi cookie sesi. Bila client global juga mencoba
  // mendeteksi fragmen tersebut, dua proses auth memakai lock yang sama dan
  // handoff Android dapat berakhir time-out. Rute login normal tetap memakai
  // perilaku bawaan Supabase untuk memproses URL auth.
  const isSsoHandoff =
    typeof window !== 'undefined' && window.location.pathname === '/auth/sso'
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
      auth: {
        detectSessionInUrl: !isSsoHandoff,
      },
    }
  )
  return browserClient
}
