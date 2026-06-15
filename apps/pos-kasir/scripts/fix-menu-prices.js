// One-off script: fix menu_items prices/names/categories based on the official
// Suka Shawarma pricelist, and remove the bogus pricelist-image item.
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
const BUCKET = 'menu-images'

const CATEGORIES = {
  Ayam: '958fb873-1bd1-47d1-b750-acf1b38327b8',
  Beef: 'c70da221-de32-4526-98e0-c8ff4bd4541b',
  Suka: '4127194d-e356-4840-b63f-751a1cec2bd9',
  Mie: '4c53e2be-ed7b-4eb0-be35-600aeb4fbf14',
  Mix: 'f54aa6b4-65b6-45ae-b3ac-e8e4f327ba25',
  Toping: '1ec85af4-23a4-48da-a3a7-d3746c2a9010',
}

// id -> { name, price, category }
const FIXES = {
  '8c2f0258-a506-4395-8a77-d5ee66661bf3': { name: 'Shawarmie Ayam', price: 28000, category: 'Mie' },
  '5a6a70b0-ac1b-449b-8a9c-2ba9698d2980': { name: 'Shawarmie Sapi', price: 31000, category: 'Mie' },
  'e79f7234-ad8f-4144-a3aa-331a6b768db0': { name: 'Suka Fried Chicken', price: 34000, category: 'Suka' },
  '630aabbb-bf03-42a5-a736-3c1ecb437b7f': { name: 'Suka Samyang', price: 34000, category: 'Suka' },
  'd3f041b9-70ee-4fcb-afe3-65e255f09ee8': { name: 'Suka Beef', price: 36000, category: 'Suka' },
  '4e9f799a-4638-479d-9fd3-efca09f46fc3': { name: 'Extra Kentang', price: 10000, category: 'Toping' },
  'a9eac60c-6fd5-47e5-af93-e3b07c36a8d9': { name: 'Suka Chicken', price: 33000, category: 'Suka' },
  'dd287d81-eb02-47be-b241-c8eb4615c0ed': { name: 'Original Ayam Besar', price: 33000, category: 'Ayam' },
  '169c0043-4bf3-42b9-8cf2-61c3ebca04f8': { name: 'Original Sapi Jumbo', price: 46000, category: 'Beef' },
  '3f64982d-3b41-47f9-9705-190483142080': { name: 'Extra Keju', price: 8000, category: 'Toping' },
  'af8da093-bb6b-4713-b552-940002e29d5c': { name: 'Original Mix Jumbo', price: 51000, category: 'Mix' },
  '7ce5a260-d12a-438a-8ca7-db0d6dfd15e3': { name: 'Original Sapi Besar', price: 36000, category: 'Beef' },
  '14242684-9f11-45a7-97be-e62114da822b': { name: 'Original Sapi Sedang', price: 31000, category: 'Beef' },
}

const REMOVE_ID = '9e500b1b-9ce0-4ff7-af43-4fa33837a681' // "Whatsapp Image..." pricelist photo

async function deleteStorageImage(url) {
  const marker = `/object/public/${BUCKET}/`
  const idx = url.indexOf(marker)
  if (idx === -1) return
  const objectPath = decodeURIComponent(url.slice(idx + marker.length).split('?')[0])
  await sb.storage.from(BUCKET).remove([objectPath])
}

async function main() {
  // 1. Remove the bogus pricelist-image item
  const { data: removeItem } = await sb.from('menu_items').select('image_url').eq('id', REMOVE_ID).maybeSingle()
  if (removeItem) {
    if (removeItem.image_url) await deleteStorageImage(removeItem.image_url)
    const { error } = await sb.from('menu_items').delete().eq('id', REMOVE_ID)
    if (error) throw new Error(`remove ${REMOVE_ID}: ${error.message}`)
    console.log(`removed pricelist-image item ${REMOVE_ID}`)
  }

  // 2. Fix names/prices/categories for the rest
  for (const [id, fix] of Object.entries(FIXES)) {
    const { error } = await sb
      .from('menu_items')
      .update({
        name: fix.name,
        price: fix.price,
        category_id: CATEGORIES[fix.category],
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
    if (error) throw new Error(`update ${id}: ${error.message}`)
    console.log(`updated ${id} -> ${fix.name} (Rp ${fix.price.toLocaleString('id-ID')}, ${fix.category})`)
  }

  console.log('DONE')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
