import { createClient } from '@supabase/supabase-js'

const DEFAULT_SUPABASE_URL = 'https://khpkoreaaucvyqfhynfq.supabase.co'

/**
 * Server-only Supabase service-role client.
 * Digunakan oleh Server Actions dan endpoint administratif (mis. expenses, import, office vouchers)
 * untuk bypass RLS dan menjalankan operasi database tingkat sistem.
 *
 * Kunci WAJIB dari env var SUPABASE_SERVICE_ROLE_KEY (panel Coolify + stage runner
 * Dockerfile). Dulu ada fallback kunci literal di sini -- itu membocorkan service
 * role key produksi ke repo publik (2026-09-22). Env hilang = gagal keras, jangan
 * pernah kembalikan fallback literal.
 */
export function getServiceSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || DEFAULT_SUPABASE_URL
  const rawKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!rawKey || rawKey.trim().length === 0 || rawKey === 'undefined') {
    throw new Error(
      'SUPABASE_SERVICE_ROLE_KEY belum di-set. Set di panel Coolify app ini ' +
        '(dan pastikan ARG/ENV-nya ada di stage runner Dockerfile), lalu redeploy.'
    )
  }
  const key = rawKey.trim()

  return createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  })
}
