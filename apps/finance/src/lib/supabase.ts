import { createSupabaseBrowserClient } from '@suka/auth'
import { getServiceSupabase } from './supabase-service'

// Client-side Supabase instance.
// PENTING: delegasi ke factory @suka/auth (createSupabaseBrowserClient) yang memakai
// cookieOptions.domain = NEXT_PUBLIC_COOKIE_DOMAIN. Factory yang sama dengan AuthProvider,
// sehingga client membaca cookie sesi yang benar dan request membawa access token user
// (bukan anon). Bila pakai createBrowserClient polos → semua write jadi anon.
export const createClient = () => createSupabaseBrowserClient()

// Server-side (API routes) — service role. Semua tulis kas WAJIB lewat RPC maker-checker.
export const createServerSupabaseClient = () => getServiceSupabase()
