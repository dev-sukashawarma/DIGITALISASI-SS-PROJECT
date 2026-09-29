// Uji RLS dengan LOGIN SUNGGUHAN per role (bukan asumsi). Read-only.
// Pakai (secret dari panel Coolify, JANGAN di-commit):
//   SB_URL=... SB_ANON=... SB_SERVICE=... SB_JWT_SECRET=... node optimize/scripts/rls-check.example.js payroll_records leave_requests
// Keluaran: jumlah baris yang terlihat tiap role vs jumlah milik sendiri.
const crypto = require('crypto')
const { SB_URL, SB_ANON, SB_SERVICE, SB_JWT_SECRET } = process.env
const tables = process.argv.slice(2)
if (!SB_URL || !SB_ANON || !SB_SERVICE || !SB_JWT_SECRET || !tables.length) {
  console.error('Set SB_URL, SB_ANON, SB_SERVICE, SB_JWT_SECRET lalu beri nama tabel')
  process.exit(1)
}
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url')
function jwtFor(sub) {
  const h = b64({ alg: 'HS256', typ: 'JWT' })
  const p = b64({ sub, role: 'authenticated', aud: 'authenticated', exp: Math.floor(Date.now() / 1000) + 600 })
  return `${h}.${p}.${crypto.createHmac('sha256', SB_JWT_SECRET).update(`${h}.${p}`).digest('base64url')}`
}
const svc = (path) =>
  fetch(`${SB_URL}/rest/v1/${path}`, { headers: { apikey: SB_SERVICE, Authorization: `Bearer ${SB_SERVICE}` } }).then((r) => r.json())
async function count(token, table) {
  const r = await fetch(`${SB_URL}/rest/v1/${table}?select=*`, {
    headers: { apikey: SB_ANON, Authorization: `Bearer ${token}`, Prefer: 'count=exact', Range: '0-0' },
  })
  return r.status >= 400 ? `ERR${r.status}` : (r.headers.get('content-range') || '').split('/')[1]
}
;(async () => {
  const roles = ['crew', 'leader', 'mitra', 'admin_finance', 'admin_hr', 'admin', 'owner']
  console.log(['role'.padEnd(16), ...tables].join('\t'))
  console.log(['anon'.padEnd(16), ...(await Promise.all(tables.map((t) => count(SB_ANON, t))))].join('\t'))
  for (const role of roles) {
    const [u] = await svc(`outlet_staff?select=id&role=eq.${role}&status=eq.active&limit=1`)
    if (!u) continue
    const seen = await Promise.all(tables.map((t) => count(jwtFor(u.id), t)))
    console.log([role.padEnd(16), ...seen].join('\t'))
  }
})()
