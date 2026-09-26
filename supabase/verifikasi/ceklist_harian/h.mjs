// Pembantu bersama uji ceklist harian.
//
// Kredensial dibaca dari env (NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY,
// SUPABASE_SERVICE_ROLE_KEY, SUPABASE_JWT_SECRET) atau, bila kosong, dari
// apps/manager/.env.local. Tidak ada rahasia yang ditulis di berkas ini.
import fs from 'node:fs'

const berkasEnv = new URL('../../../apps/manager/.env.local', import.meta.url)
const dariBerkas = fs.existsSync(berkasEnv)
  ? Object.fromEntries(fs.readFileSync(berkasEnv, 'utf8').split(/\r?\n/).filter((l) => l.includes('='))
      .map((l) => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim()]))
  : {}
const ambil = (k) => process.env[k] || dariBerkas[k] || ''

export const U = ambil('NEXT_PUBLIC_SUPABASE_URL')
export const K = ambil('SUPABASE_SERVICE_ROLE_KEY')
export const ANON = ambil('NEXT_PUBLIC_SUPABASE_ANON_KEY')
export const JWTS = ambil('SUPABASE_JWT_SECRET')
if (!U || !K) throw new Error('Set NEXT_PUBLIC_SUPABASE_URL & SUPABASE_SERVICE_ROLE_KEY (atau isi apps/manager/.env.local).')

/** Menjalankan SQL lewat exec_sql (service role). Uji selalu diakhiri RAISE -> rollback; pesannya = hasil. */
export async function sql(q) {
  const r = await fetch(`${U}/rest/v1/rpc/exec_sql`, {
    method: 'POST',
    headers: { apikey: K, Authorization: `Bearer ${K}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ sql: q }),
  })
  const t = await r.text()
  let j
  try { j = JSON.parse(t) } catch { j = t }
  return { status: r.status, msg: j?.message ?? t }
}
