import { cookies } from 'next/headers'
import { createSupabaseServerClient } from '@suka/auth'

/**
 * Supabase client untuk Server Component / Server Action — memakai SESI USER,
 * jadi RLS tetap berlaku.
 *
 * Delegasi ke `@suka/auth` supaya cookie options + nama cookie (default
 * `sb-<project-ref>-auth-token`) identik dengan Portal & middleware — syarat SSO
 * gerbang tunggal. JANGAN bikin `createServerClient` sendiri di halaman: adapter
 * cookie gaya lama (`cookies: { get(name) }`) tidak kompatibel dengan
 * @supabase/ssr 0.5.x dan membuat sesi gagal di-parse. Lihat ADR-008.
 *
 * Berbeda dari `createServerSupabaseClient()` di `@/lib/supabase` yang memakai
 * service role (bypass RLS, khusus API route).
 *
 * File ini SENGAJA terpisah dari `@/lib/supabase` karena mengimpor `next/headers`,
 * yang tidak boleh ikut ter-bundle ke client component.
 */
export async function createServerComponentClient() {
  const cookieStore = await cookies()
  return createSupabaseServerClient({
    getAll: () => cookieStore.getAll(),
    setAll: (cookiesToSet) => {
      try {
        cookiesToSet.forEach(({ name, value, options }) =>
          cookieStore.set(name, value, options as Parameters<typeof cookieStore.set>[2])
        )
      } catch {
        // Server Component: penulisan cookie ditangani middleware.
      }
    },
  })
}
