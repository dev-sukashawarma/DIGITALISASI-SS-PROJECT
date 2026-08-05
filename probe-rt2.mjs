import fs from 'node:fs'
import { createClient } from '@supabase/supabase-js'

const env = Object.fromEntries(
  fs.readFileSync('apps/finance/.env.local', 'utf8')
    .split(/\r?\n/).filter(Boolean).map(l => {
      const i = l.indexOf('='); return [l.slice(0, i), l.slice(i + 1)]
    })
)
const url = env.NEXT_PUBLIC_SUPABASE_URL
const anon = env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const svc = env.SUPABASE_SERVICE_ROLE_KEY

const admin = createClient(url, svc, { auth: { persistSession: false } })

const target = { id: 'ed2bc2a2-0d10-49f3-ae01-84d3b767b6af', email: 'finance@ss.com' }
console.log('using user', target.id, target.email)

const { data: link, error: lerr } = await admin.auth.admin.generateLink({
  type: 'magiclink', email: target.email,
})
if (lerr) throw lerr

const user = createClient(url, anon, { auth: { persistSession: false } })
const { data: sess, error: verr } = await user.auth.verifyOtp({
  token_hash: link.properties.hashed_token, type: 'magiclink',
})
if (verr) throw verr
console.log('signed in as', sess.user.id)

// sanity: can this user SELECT?
const { data: rows, error: serr } = await user.from('petty_cash_topups').select('id, description').limit(1)
console.log('select ok:', !serr, 'rows:', rows?.length, serr?.message ?? '')

let got = 0
const ch = user.channel('probe-user-petty')
ch.on('postgres_changes', { event: '*', schema: 'public', table: 'petty_cash_topups' }, (p) => {
  got++; console.log('EVENT', p.eventType, p.new?.id ?? p.old?.id)
})
ch.subscribe(async (status, err) => {
  console.log('CHANNEL STATUS:', status, err ?? '')
  if (status !== 'SUBSCRIBED') return
  const row = rows[0]
  const { error: e2 } = await admin.from('petty_cash_topups')
    .update({ description: row.description }).eq('id', row.id)
  console.log('touched', row.id, 'err:', e2 ?? 'none')
})

setTimeout(() => { console.log('DONE events received:', got); process.exit(0) }, 12000)
