import { createClient } from '@/lib/supabase/client'

// Logout cepat & andal untuk POS (admin & crew).
//
// Masalah lama: `supabase.auth.signOut()` default memakai scope 'global' yang
// meng-enumerasi & mencabut SEMUA sesi user di server, lalu baru menghapus
// cookie lokal SETELAH panggilan jaringan itu selesai. Di jaringan lambat ini
// bisa memblokir UI ~10 detik.
//
// Perbaikan:
//   1. scope 'local'  -> cabut sesi ini saja (tanpa enumerasi), jauh lebih cepat.
//   2. race 1 detik   -> jaringan lambat/hang tak pernah menahan UI > ~1s.
//   3. clear cookie    -> jaminan logout lokal supaya middleware tak memantulkan
//                         user kembali ke dashboard saat mendarat di /login.
//   4. hard redirect   -> reset seluruh state React & re-evaluasi middleware.

/** Hapus semua cookie sesi Supabase (`sb-*`), termasuk pecahan .0/.1 & code-verifier. */
function clearSupabaseAuthCookies() {
  if (typeof document === 'undefined') return
  // Prod memakai domain induk (.sukashawarma.com) untuk SSO; lokal host-only.
  const domain = process.env.NEXT_PUBLIC_COOKIE_DOMAIN || undefined
  for (const raw of document.cookie.split(';')) {
    const name = raw.split('=')[0].trim()
    if (!name.startsWith('sb-')) continue
    document.cookie = `${name}=; Max-Age=0; path=/`
    if (domain) document.cookie = `${name}=; Max-Age=0; path=/; domain=${domain}`
  }
}

export async function fastLogout(redirectTo: string) {
  const supabase = createClient()
  try {
    // Cabut sesi lokal di server (best-effort), tapi jangan menunggu > 1 detik.
    await Promise.race([
      supabase.auth.signOut({ scope: 'local' }),
      new Promise((resolve) => setTimeout(resolve, 1000)),
    ])
  } catch {
    // Abaikan — apa pun hasilnya kita tetap paksa logout lokal di bawah.
  }
  clearSupabaseAuthCookies()
  if (typeof window !== 'undefined') {
    try {
      sessionStorage.removeItem('pos_gate_bypassed_types')
    } catch (e) {}
  }
  // Hard redirect: pastikan cookie yang sudah dibersihkan terbaca ulang oleh
  // middleware & seluruh state klien ter-reset.
  window.location.replace(redirectTo)
}
