import { createClient as createServerClient } from '@supabase/supabase-js'
import { createSupabaseBrowserClient } from '@suka/auth'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://khpkoreaaucvyqfhynfq.supabase.co'
const supabaseServiceKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtocGtvcmVhYXVjdnlxZmh5bmZxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MDk2MzI5MiwiZXhwIjoyMDk2NTM5MjkyfQ.Dy0QMAHfB8EU9BK-JuyRrBidpG6iM94t9RtiJ_viZz8'

// Client-side Supabase instance.
// PENTING: delegasi ke factory @suka/auth (createSupabaseBrowserClient) yang memakai
// cookieOptions.domain = NEXT_PUBLIC_COOKIE_DOMAIN. Factory yang sama dengan AuthProvider,
// sehingga client membaca cookie sesi yang benar dan request membawa access token user
// (bukan anon). Bila pakai createBrowserClient polos → semua write jadi anon.
export const createClient = () => createSupabaseBrowserClient()

// Server-side (API routes) — service role. Semua tulis kas WAJIB lewat RPC maker-checker.
export const createServerSupabaseClient = () =>
  createServerClient(supabaseUrl, supabaseServiceKey)
