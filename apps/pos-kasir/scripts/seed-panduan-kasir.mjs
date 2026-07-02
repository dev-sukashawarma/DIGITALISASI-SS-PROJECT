// Seed Buku Panduan Kasir ke tabel `guides`.
// Memakai service role (bypass RLS). Idempotent: hapus dulu bab-bab panduan
// kasir yang lama, lalu insert ulang dari scripts/guide-content.json
// (dihasilkan oleh generate-guide-assets.mjs).
// Jalankan: node scripts/generate-guide-assets.mjs && node scripts/seed-panduan-kasir.mjs
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { createClient } from '@supabase/supabase-js'

const __dirname = dirname(fileURLToPath(import.meta.url))

// Ambil kredensial dari .env.local tanpa menampilkannya
function readEnv() {
  const txt = readFileSync(join(__dirname, '..', '.env.local'), 'utf8')
  const env = {}
  for (const line of txt.split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
    if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, '')
  }
  return env
}

const env = readEnv()
const url = env.NEXT_PUBLIC_SUPABASE_URL
const key = env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !key) { console.error('Kredensial Supabase tidak ditemukan di .env.local'); process.exit(1) }

const supabase = createClient(url, key, { auth: { persistSession: false } })

const raw = JSON.parse(readFileSync(join(__dirname, 'guide-content.json'), 'utf8'))
const IMG = (f) => `/guide-assets/${f}`
const guides = raw.map((g) => ({
  category: g.category,
  sort_order: g.sort_order,
  title: g.title,
  content: g.content,
  image_url: IMG(g.file),
}))
const CATEGORIES = [...new Set(guides.map((g) => g.category))]

async function main() {
  // Idempotent: hapus bab panduan kasir lama (berdasarkan kategori)
  const { error: delErr } = await supabase.from('guides').delete().in('category', CATEGORIES)
  if (delErr) { console.error('Gagal hapus data lama:', delErr.message); process.exit(1) }

  const { data, error } = await supabase.from('guides').insert(guides).select('id, category, title, sort_order')
  if (error) { console.error('Gagal insert:', error.message); process.exit(1) }

  console.log(`OK: ${data.length} langkah panduan tersimpan.`)
  const byCat = {}
  for (const g of data) (byCat[g.category] ??= []).push(g)
  for (const cat of CATEGORIES) {
    console.log(`\n${cat}  (${byCat[cat]?.length || 0} langkah)`)
    for (const g of (byCat[cat] || []).sort((a, b) => a.sort_order - b.sort_order)) {
      console.log(`   ${g.sort_order}. ${g.title}`)
    }
  }
}

main()
