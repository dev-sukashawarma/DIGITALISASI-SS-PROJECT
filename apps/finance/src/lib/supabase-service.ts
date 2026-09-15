import { createClient } from '@supabase/supabase-js'

const DEFAULT_SUPABASE_URL = 'https://khpkoreaaucvyqfhynfq.supabase.co'
const FALLBACK_SERVICE_ROLE_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtocGtvcmVhYXVjdnlxZmh5bmZxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MDk2MzI5MiwiZXhwIjoyMDk2NTM5MjkyfQ.Dy0QMAHfB8EU9BK-JuyRrBidpG6iM94t9RtiJ_viZz8'

/**
 * Server-only Supabase service-role client.
 * Digunakan oleh Server Actions dan endpoint administratif (mis. expenses, import, office vouchers)
 * untuk bypass RLS dan menjalankan operasi database tingkat sistem.
 *
 * Mengutamakan env var SUPABASE_SERVICE_ROLE_KEY dari runtime environment (VPS/Coolify),
 * dan memiliki fallback service role key jika env var belum di-set di panel hosting.
 */
export function getServiceSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || DEFAULT_SUPABASE_URL
  const rawKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const key =
    rawKey && rawKey.trim().length > 0 && rawKey !== 'undefined'
      ? rawKey.trim()
      : FALLBACK_SERVICE_ROLE_KEY

  return createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  })
}
