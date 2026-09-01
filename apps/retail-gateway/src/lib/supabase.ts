import { createClient, type SupabaseClient } from '@supabase/supabase-js'

let cached: SupabaseClient | null = null

/**
 * Client service-role. Satu-satunya jalan Gateway menyentuh database.
 * Melewati RLS -- karena itu setiap endpoint WAJIB menurunkan identitas
 * pelanggan dari token sesi, tidak pernah dari isi permintaan.
 */
export function createServiceClient(): SupabaseClient {
  if (cached) return cached

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url) throw new Error('NEXT_PUBLIC_SUPABASE_URL belum di-set')
  if (!key) throw new Error('SUPABASE_SERVICE_ROLE_KEY belum di-set')

  cached = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    db: { schema: 'public' },
  })
  return cached
}

/** Client yang menargetkan skema `retail`. */
export function createRetailClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Kredensial Supabase belum lengkap')
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    db: { schema: 'retail' },
  })
}
