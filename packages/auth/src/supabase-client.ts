import { createBrowserClient } from '@supabase/ssr'
import { decodeJwtExpSeconds, extractSessionTokensFromCookies } from './jwt'

/** Domain cookie sesi; kosong di lokal (per-port), '.sukashawarma.com' di prod. */
const cookieDomain = process.env.NEXT_PUBLIC_COOKIE_DOMAIN || undefined

/**
 * Membersihkan cookie auth yatim/duplikat di browser sebelum `@supabase/ssr` membaca `document.cookie`:
 * 1. Bila `cookieDomain` aktif (mis. `.sukashawarma.com`) dan nama cookie `sb-*` muncul ganda
 *    di `document.cookie` (akibat bayangan host-only di `finance.sukashawarma.com`), hapus
 *    salinan host-only (`Max-Age=0; path=/` tanpa `domain=`) — spesifikasi RFC 6265 menjamin
 *    cookie `Domain=.sukashawarma.com` tidak ikut terhapus.
 * 2. Bila cookie utuh `sb-<ref>-auth-token` DAN pecahan `sb-<ref>-auth-token.0` muncul bersamaan
 *    (sisa transisi sesi utuh <-> chunked), buang representasi yang sudah kedaluwarsa/rusak agar
 *    `combineChunks` milik `@supabase/ssr` tidak tertipu membaca cookie utuh yang sudah mati.
 */
export function purgeStaleBrowserAuthCookies(explicitDomain?: string) {
  if (typeof document === 'undefined' || !document.cookie) return
  const domain = explicitDomain ?? cookieDomain

  const rawEntries: Array<{ name: string; value: string }> = []
  const counts = new Map<string, number>()

  for (const part of document.cookie.split(';')) {
    const eqIdx = part.indexOf('=')
    if (eqIdx <= 0) continue
    const name = part.slice(0, eqIdx).trim()
    const value = part.slice(eqIdx + 1).trim()
    if (!name) continue
    rawEntries.push({ name, value })
    counts.set(name, (counts.get(name) ?? 0) + 1)
  }

  // 1. Bila domain bersama aktif, singkirkan duplikat host-only untuk nama cookie yang muncul >1 kali
  if (domain) {
    for (const [name, count] of counts) {
      if (count > 1 && (name.startsWith('sb-') || name === '_suka_gate')) {
        document.cookie = `${name}=; Max-Age=0; path=/`
      }
    }
  }

  // 2. Deteksi tabrakan cookie utuh (`sb-xxx-auth-token`) vs chunked (`sb-xxx-auth-token.0`, ...)
  const baseNames = new Set<string>()
  for (const { name } of rawEntries) {
    const m = /^(sb-[a-z0-9_-]+-auth-token)(?:\.\d+)?$/i.exec(name)
    if (m) baseNames.add(m[1])
  }

  const expireEverywhere = (cookieName: string) => {
    document.cookie = `${cookieName}=; Max-Age=0; path=/`
    if (domain) {
      document.cookie = `${cookieName}=; Max-Age=0; path=/; domain=${domain}`
    }
  }

  for (const base of baseNames) {
    const exactItems = rawEntries.filter((e) => e.name === base && e.value)
    const chunkItems = rawEntries.filter((e) => e.name.startsWith(`${base}.`) && e.value)
    if (exactItems.length === 0 || chunkItems.length === 0) continue

    const exactPair = extractSessionTokensFromCookies(exactItems)
    const chunkPair = extractSessionTokensFromCookies(chunkItems)
    const exactExp = decodeJwtExpSeconds(exactPair.accessToken) ?? -1
    const chunkExp = decodeJwtExpSeconds(chunkPair.accessToken) ?? -1

    if (chunkExp > exactExp) {
      expireEverywhere(base)
    } else if (exactExp > chunkExp) {
      for (const ch of chunkItems) {
        expireEverywhere(ch.name)
      }
    }
  }
}

/**
 * Singleton browser client. Cache 1 instance per tab supaya tidak memicu
 * warning "Multiple GoTrueClient instances".
 */
let browserClient: ReturnType<typeof createBrowserClient> | undefined

export function createSupabaseBrowserClient() {
  if (typeof window !== 'undefined') {
    purgeStaleBrowserAuthCookies()
  }
  if (browserClient) return browserClient

  const client = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookieOptions: {
        domain: cookieDomain,
        path: '/',
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
        maxAge: 31536000,
      },
    }
  )

  // Jangan simpan singleton saat dieksekusi pada tahap SSR pre-render (`window === undefined`),
  // supaya saat hidrasi di browser ia tetap membuat client dengan storage `document.cookie` asli.
  if (typeof window !== 'undefined') {
    browserClient = client
  }
  return client
}
