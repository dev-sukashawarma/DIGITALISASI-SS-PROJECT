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

function buatRetailClient(url: string, key: string) {
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    db: { schema: 'retail' },
  })
}

let cachedRetail: ReturnType<typeof buatRetailClient> | null = null

/**
 * Client yang menargetkan skema `retail`.
 * Dipakai ulang antar permintaan seperti `createServiceClient`: kuncinya
 * service role (bukan sesi pengguna), `persistSession` mati, jadi client ini
 * tidak menyimpan status per permintaan. Identitas pelanggan tetap WAJIB
 * diturunkan dari token sesi di tiap endpoint.
 */
export function createRetailClient() {
  if (cachedRetail) return cachedRetail
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Kredensial Supabase belum lengkap')
  cachedRetail = buatRetailClient(url, key)
  return cachedRetail
}
