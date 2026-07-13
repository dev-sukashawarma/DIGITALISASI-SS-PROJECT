import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

async function test() {
  // Check master bahan baku SAPI
  const { data: sapi, error: e1 } = await supabase
    .from('bahan_baku')
    .select('id, nama, satuan, satuan_tengah, faktor_tengah, satuan_kecil, faktor_tampilan, bahan_baku_harga(harga_beli, harga_beli_display, kemasan_qty, kemasan_satuan)')
    .ilike('nama', '%sapi%')
    .limit(5)

  if (e1) { console.error('Error bahan_baku:', e1.message); return }

  console.log('\n=== MASTER BAHAN BAKU (Sapi) ===')
  for (const s of sapi) {
    const h = Array.isArray(s.bahan_baku_harga) ? s.bahan_baku_harga[0] : s.bahan_baku_harga
    console.log(`
Nama         : ${s.nama}
Satuan Besar : ${s.satuan}
Satuan Tengah: ${s.satuan_tengah} (faktor: ${s.faktor_tengah})
Satuan Kecil : ${s.satuan_kecil}  (faktor: ${s.faktor_tampilan})
---
harga_beli         : ${h?.harga_beli}
harga_beli_display : ${h?.harga_beli_display}
kemasan_qty        : ${h?.kemasan_qty}
kemasan_satuan     : ${h?.kemasan_satuan}
---
Kalkulasi harga per satuan:
  Per ${s.satuan}   = Rp ${h?.harga_beli?.toLocaleString('id-ID')}
  Per ${s.satuan_tengah}     = Rp ${(h?.harga_beli / s.faktor_tengah)?.toLocaleString('id-ID')}  (${h?.harga_beli} / ${s.faktor_tengah})
  Per ${s.satuan_kecil}   = Rp ${(h?.harga_beli / s.faktor_tengah / s.faktor_tampilan)?.toLocaleString('id-ID')}  ((${h?.harga_beli} / ${s.faktor_tengah}) / ${s.faktor_tampilan})
---
Kalkulasi HPP Resep (harga_beli_display / kemasan_qty):
  Harga per ${h?.kemasan_satuan} = Rp ${h?.kemasan_qty > 0 ? (h?.harga_beli_display / h?.kemasan_qty)?.toFixed(2) : 'N/A'}
  Contoh 100 ${h?.kemasan_satuan} = Rp ${h?.kemasan_qty > 0 ? Math.round((h?.harga_beli_display / h?.kemasan_qty) * 100)?.toLocaleString('id-ID') : 'N/A'}
    `)
  }
}

test()
