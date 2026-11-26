import { cookies } from 'next/headers'
import { createSupabaseServerClient } from '@suka/auth'

export async function createServerComponentClient() {
  const cookieStore = await cookies()
  return createSupabaseServerClient({
    getAll: () => cookieStore.getAll(),
    setAll: (cookiesToSet) => {
      try {
        cookiesToSet.forEach(({ name, value, options }) => {
          // Jangan pernah menghapus cookie sesi dari Server Component / Action biasa
          if (!value || (typeof options?.maxAge === 'number' && options.maxAge <= 0)) return
          cookieStore.set(name, value, options as Parameters<typeof cookieStore.set>[2])
        })
      } catch {
        // Server Component: penulisan cookie ditangani middleware.
      }
    },
  })
}
