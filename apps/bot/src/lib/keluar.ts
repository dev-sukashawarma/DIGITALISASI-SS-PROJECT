// Pola sama dengan signOut() di @suka/auth AuthProvider: hapus sesi lokal + cookie sb-* (juga di
// domain bersama), lalu kembali ke portal. Batas 1 dtk agar tombol tak menggantung bila jaringan lambat.
import { createSupabaseBrowserClient } from '@suka/auth'

export async function keluar(portalUrl: string) {
  try {
    await Promise.race([
      createSupabaseBrowserClient().auth.signOut({ scope: 'local' }),
      new Promise((r) => setTimeout(r, 1000)),
    ])
  } catch {}
  const domain = process.env.NEXT_PUBLIC_COOKIE_DOMAIN || undefined
  for (const raw of document.cookie.split(';')) {
    const name = raw.split('=')[0].trim()
    if (!name.startsWith('sb-')) continue
    document.cookie = `${name}=; Max-Age=0; path=/`
    if (domain) document.cookie = `${name}=; Max-Age=0; path=/; domain=${domain}`
  }
  window.location.href = portalUrl
}
