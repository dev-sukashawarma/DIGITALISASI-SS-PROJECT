import { cookies } from 'next/headers'
import { createSupabaseServerClient } from '@suka/auth'

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
        // Server Component: cookie writing handled by middleware.
      }
    },
  })
}
