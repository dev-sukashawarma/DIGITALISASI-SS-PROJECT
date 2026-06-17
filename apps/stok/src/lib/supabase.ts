import { createClient as createServerClient } from '@supabase/supabase-js'
import { createSupabaseBrowserClient } from '@suka/auth'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!

// Client-side Supabase instance.
// PENTING: delegasi ke factory @suka/auth (createSupabaseBrowserClient) yang
// memakai cookieOptions.domain = NEXT_PUBLIC_COOKIE_DOMAIN. Ini factory yang sama
// dengan yang dipakai AuthProvider, sehingga client membaca cookie sesi yang benar
// dan request membawa access token user (bukan anon). Bila pakai createBrowserClient
// polos tanpa cookieOptions, client tidak menemukan sesi → semua write jadi anon.
export const createClient = () => createSupabaseBrowserClient()

// Server-side (Edge Functions, API routes)
export const createServerSupabaseClient = () =>
  createServerClient(
    supabaseUrl,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
