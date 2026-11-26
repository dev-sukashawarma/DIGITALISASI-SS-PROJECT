import { cookies } from 'next/headers'
import { createSupabaseServerClient, hasActiveSessionCookieWrite } from '@suka/auth'

export async function createServerComponentClient() {
  const cookieStore = await cookies()
  return createSupabaseServerClient({
    getAll: () => cookieStore.getAll(),
    setAll: (cookiesToSet) => {
      if (!hasActiveSessionCookieWrite(cookiesToSet)) return
      try {
        cookiesToSet.forEach(({ name, value, options }) => {
          cookieStore.set(name, value, options as Parameters<typeof cookieStore.set>[2])
        })
      } catch {
        // Server Component: penulisan cookie ditangani middleware.
      }
    },
  })
}
