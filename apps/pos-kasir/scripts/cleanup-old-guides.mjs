// Hapus kategori panduan lama yang sudah digantikan struktur baru.
// Jalankan sekali saja: node scripts/cleanup-old-guides.mjs
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { createClient } from '@supabase/supabase-js'

const __dirname = dirname(fileURLToPath(import.meta.url))
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
const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })

const OLD_CATEGORIES = [
  'Bab 2 · Mengelola Pesanan',
  'Bab 3 · Mengatur Menu',
  'Bab 4 · Device Pelanggan',
  'Bab 5 · Laporan & Histori',
  'Bab 6 · Pengaturan & Keluar',
]

const { error, data } = await supabase.from('guides').delete().in('category', OLD_CATEGORIES).select('id')
if (error) { console.error(error.message); process.exit(1) }
console.log('Deleted rows:', data.length)
