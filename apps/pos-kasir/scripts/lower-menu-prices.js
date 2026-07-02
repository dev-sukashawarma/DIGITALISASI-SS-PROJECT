// One-off script: lower all menu_items prices by Rp4.000, except the "Toping"
// category which is lowered by Rp1.000. Prints before/after for every row and
// refuses to write a price <= 0.
const fs = require('fs')
const path = require('path')
const { createClient } = require('@supabase/supabase-js')

function loadEnvLocal() {
  const envPath = path.join(__dirname, '..', '.env.local')
  const content = fs.readFileSync(envPath, 'utf8')
  const env = {}
  for (const line of content.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const idx = trimmed.indexOf('=')
    if (idx === -1) continue
    env[trimmed.slice(0, idx).trim()] = trimmed.slice(idx + 1).trim()
  }
  return env
}

const env = loadEnvLocal()
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)

const TOPING_CATEGORY_ID = 'cb046ea9-5566-42e1-b01d-74ed9d9d8e2e'
const DEFAULT_DROP = 4000
const TOPING_DROP = 1000

const rp = (n) => 'Rp ' + Number(n).toLocaleString('id-ID')

async function main() {
  const { data: items, error } = await sb
    .from('menu_items')
    .select('id, name, price, category_id')
    .order('category_id')
  if (error) throw new Error(`fetch: ${error.message}`)

  console.log(`fetched ${items.length} menu items\n`)

  const updates = []
  const skipped = []
  for (const it of items) {
    const drop = it.category_id === TOPING_CATEGORY_ID ? TOPING_DROP : DEFAULT_DROP
    const newPrice = Number(it.price) - drop
    if (newPrice <= 0) {
      skipped.push({ ...it, drop, newPrice })
      continue
    }
    updates.push({ ...it, drop, newPrice })
  }

  for (const s of skipped) {
    console.log(`[SKIP] ${s.name}: ${rp(s.price)} - ${rp(s.drop)} would be <= 0 — left unchanged`)
  }
  if (skipped.length) console.log('')

  for (const u of updates) {
    const tag = u.category_id === TOPING_CATEGORY_ID ? '[Toping -1k]' : '[-4k]'
    const { error: uErr } = await sb
      .from('menu_items')
      .update({ price: u.newPrice, updated_at: new Date().toISOString() })
      .eq('id', u.id)
    if (uErr) throw new Error(`update ${u.id}: ${uErr.message}`)
    console.log(`${tag} ${u.name}: ${rp(u.price)} -> ${rp(u.newPrice)}`)
  }

  console.log(`\nDONE — updated ${updates.length} items`)
}

main().catch((err) => {
  console.error('\nERROR:', err.message)
  process.exit(1)
})
