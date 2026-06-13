// One-off script: import Suka Shawarma menu items (with prices & photos) into Supabase.
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
const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_ROLE_KEY = env.SUPABASE_SERVICE_ROLE_KEY
const BUCKET = 'menu-images'
const IMG_DIR = 'C:\\Users\\AK\\Downloads\\produk\\extracted'

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY in .env.local')
}

const sb = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)

const CATEGORIES = [
  'Original Shawarma Ayam',
  'Original Shawarma Sapi',
  'Original Shawarma Mix',
  'Suka Suka',
  'Shawarmie',
  'Topping',
]

const ITEMS = [
  { name: 'Original Ayam Sedang', price: 28000, category: 'Original Shawarma Ayam', image: 'original ayam besar.jpg' },
  { name: 'Original Ayam Besar', price: 33000, category: 'Original Shawarma Ayam', image: 'original ayam besar.jpg' },
  { name: 'Original Ayam Jumbo', price: 38000, category: 'Original Shawarma Ayam', image: 'original ayam besar.jpg' },

  { name: 'Original Sapi Sedang', price: 31000, category: 'Original Shawarma Sapi', image: 'original sapi sedang.jpg' },
  { name: 'Original Sapi Besar', price: 36000, category: 'Original Shawarma Sapi', image: 'original sapi besar.jpg' },
  { name: 'Original Sapi Jumbo', price: 46000, category: 'Original Shawarma Sapi', image: 'original sapi jumbo.jpg' },

  { name: 'Original Mix Besar', price: 41000, category: 'Original Shawarma Mix', image: 'original mix.jpg' },
  { name: 'Original Mix Jumbo', price: 51000, category: 'Original Shawarma Mix', image: 'original mix.jpg' },

  { name: 'Suka Chicken', price: 33000, category: 'Suka Suka', image: 'suka chicken (2).jpg' },
  { name: 'Suka Beef', price: 36000, category: 'Suka Suka', image: 'sukabeef.jpg' },
  { name: 'Suka Fried Chicken', price: 34000, category: 'Suka Suka', image: 'suka fried chicken (2).jpg' },
  { name: 'Suka Samyang', price: 34000, category: 'Suka Suka', image: 'suka samyang.jpg' },

  { name: 'Shawarmie Ayam', price: 28000, category: 'Shawarmie', image: 'shawarmie ayam.jpg' },
  { name: 'Shawarmie Sapi', price: 31000, category: 'Shawarmie', image: 'shawarmie sapi.jpg' },

  { name: 'Extra Keju', price: 8000, category: 'Topping', image: 'KEJU.jpg' },
  { name: 'Extra Kentang', price: 10000, category: 'Topping', image: 'KENTANG.jpg' },
]

async function main() {
  // 1. Ensure categories exist
  const categoryIds = {}
  for (let i = 0; i < CATEGORIES.length; i++) {
    const name = CATEGORIES[i]
    const { data, error } = await sb
      .from('categories')
      .insert({ name, sort_order: i })
      .select('id')
      .single()
    if (error) throw new Error(`category ${name}: ${error.message}`)
    categoryIds[name] = data.id
    console.log(`category created: ${name} -> ${data.id}`)
  }

  // 2. Upload images + insert menu items
  let sortOrder = 0
  for (const item of ITEMS) {
    const filePath = path.join(IMG_DIR, item.image)
    const fileBuffer = fs.readFileSync(filePath)
    const ext = path.extname(item.image).slice(1).toLowerCase()
    const contentType = ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' : `image/${ext}`
    const storageName = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}.${ext === 'jpeg' ? 'jpg' : ext}`

    const { error: uploadErr } = await sb.storage
      .from(BUCKET)
      .upload(storageName, fileBuffer, { contentType })
    if (uploadErr) throw new Error(`upload ${item.name}: ${uploadErr.message}`)

    const imageUrl = sb.storage.from(BUCKET).getPublicUrl(storageName).data.publicUrl

    const { error: insertErr } = await sb.from('menu_items').insert({
      name: item.name,
      price: item.price,
      category_id: categoryIds[item.category],
      image_url: imageUrl,
      is_available: true,
      sort_order: sortOrder++,
    })
    if (insertErr) throw new Error(`insert ${item.name}: ${insertErr.message}`)

    console.log(`menu item created: ${item.name} (Rp ${item.price.toLocaleString('id-ID')})`)
  }

  console.log('DONE')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
