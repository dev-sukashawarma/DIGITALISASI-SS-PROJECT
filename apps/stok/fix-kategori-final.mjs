import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  'https://khpkoreaaucvyqfhynfq.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtocGtvcmVhYXVjdnlxZmh5bmZxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MDk2MzI5MiwiZXhwIjoyMDk2NTM5MjkyfQ.Dy0QMAHfB8EU9BK-JuyRrBidpG6iM94t9RtiJ_viZz8'
)

async function fixKategori() {
  // First, check what we have
  const { data: all } = await supabase.from('bahan_baku').select('id, nama, kategori, kategori_core')
  
  for (const item of all) {
    let newKategori = item.kategori

    // Map based on nama or kategori_core
    if (item.nama.startsWith('KULIT')) {
      newKategori = 'item core'
    } else if (item.kategori_core === 'daging_ayam' || item.kategori_core === 'daging_sapi' || item.kategori_core === 'sayuran' || item.kategori_core === 'kentang') {
      newKategori = 'item core'
    } else if (item.kategori_core === 'saos' || item.kategori_core === 'tum') {
      newKategori = 'bumbu'
    } else if (item.nama === 'GARAM' || item.nama === 'KUNYIT' || item.nama === 'KETUMBAR' || item.nama === 'KAYU MANIS' || item.nama === 'JINTEN' || item.nama === 'CENGKEH') {
      newKategori = 'bumbu'
    } else if (item.nama === 'GAS 3Kg' || item.nama === 'SABUN') {
      newKategori = 'lainnya'
    } else if (item.kategori_core === 'keju') {
      newKategori = 'bumbu' // Keju is in saos/bumbu
    } else if (item.nama === 'ES BATU' || item.nama === 'POWDER MIX') {
      newKategori = 'minuman'
    } else if (item.kategori === 'kemasan' || item.nama.includes('PLASTIK') || item.nama.includes('PAPER') || item.nama.includes('POLYBAG') || item.nama.includes('FOIL') || item.nama.includes('CUP') || item.nama.includes('DUS')) {
      newKategori = 'kemasan'
    }

    // fallback
    if (!['item core', 'bumbu', 'minuman', 'kemasan', 'lainnya'].includes(newKategori)) {
      if (item.kategori === 'protein' || item.kategori === 'sayur') newKategori = 'item core'
      else if (item.kategori === 'saus') newKategori = 'bumbu'
      else newKategori = 'lainnya'
    }

    if (newKategori !== item.kategori) {
      console.log(`Fixing ${item.nama}: ${item.kategori} -> ${newKategori}`)
      const { error } = await supabase.from('bahan_baku').update({ kategori: newKategori }).eq('id', item.id)
      if (error) console.error(`Error updating ${item.nama}:`, error)
    }
  }
  console.log('Done fixing categories')
}

fixKategori().catch(console.error)
