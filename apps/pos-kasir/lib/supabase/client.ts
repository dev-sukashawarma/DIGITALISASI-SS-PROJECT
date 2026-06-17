import { createSupabaseBrowserClient } from '@suka/auth'

/**
 * Browser Supabase client untuk pos-kasir.
 *
 * Delegasi ke `@suka/auth` agar sesi disimpan di cookie default
 * (`sb-<project-ref>-auth-token`) yang sama dengan Portal & app lain — syarat
 * SSO gerbang tunggal. JANGAN pakai cookie name custom di sini (dulu
 * `sb-pos-kasir-auth-token`) karena memutus sharing sesi. Lihat ADR-008.
 */
export function createClient() {
  return createSupabaseBrowserClient()
}
