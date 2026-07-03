const fs = require('fs')
const { createClient } = require('@supabase/supabase-js')

const env = Object.fromEntries(
  fs.readFileSync('.env.local', 'utf8').split('\n')
    .filter(l => l.includes('=') && !l.trim().startsWith('#'))
    .map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()] })
)
const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)
const DO_DELETE = process.argv.includes('--delete')

async function count(filterFn) {
  let q = supabase.from('orders').select('id', { count: 'exact', head: true })
  q = filterFn(q); const { count, error } = await q; if (error) throw error; return count
}

async function run() {
  const toDelete = await count(q => q.in('source', ['pos', 'manual']))
  const keepOnline = await count(q => q.eq('source', 'online'))
  const keepNull = await count(q => q.is('source', null))

  // remaining (online) order_number range
  const { data: minRow } = await supabase.from('orders').select('order_number').eq('source', 'online').order('order_number', { ascending: true }).limit(1)
  const { data: maxRow } = await supabase.from('orders').select('order_number').eq('source', 'online').order('order_number', { ascending: false }).limit(1)

  console.log('=== PLAN ===')
  console.log('  will DELETE (source pos+manual, all outlets):', toDelete)
  console.log('  will KEEP  (source online):', keepOnline, ' | (source null):', keepNull)
  console.log('  remaining online order_number range:', minRow?.[0]?.order_number, '..', maxRow?.[0]?.order_number)

  if (!DO_DELETE) { console.log('\n(DRY RUN — no rows deleted. Re-run with --delete to execute.)'); return }

  console.log('\n=== DELETING ... ===')
  // Delete in batches by fetching ids (order_items cascade automatically)
  let totalDeleted = 0
  for (;;) {
    const { data: batch, error } = await supabase.from('orders').select('id').in('source', ['pos', 'manual']).limit(500)
    if (error) throw error
    if (!batch || batch.length === 0) break
    const ids = batch.map(r => r.id)
    const { error: delErr } = await supabase.from('orders').delete().in('id', ids)
    if (delErr) throw delErr
    totalDeleted += ids.length
    console.log('  deleted batch:', ids.length, ' (running total:', totalDeleted, ')')
    if (batch.length < 500) break
  }
  const remaining = await count(q => q.in('source', ['pos', 'manual']))
  console.log('  DONE. pos+manual remaining:', remaining, ' | total deleted:', totalDeleted)
  const grandTotal = await count(q => q)
  console.log('  orders table total now:', grandTotal)
}
run().catch(e => { console.error('ERROR:', e.message || e); process.exit(1) })
