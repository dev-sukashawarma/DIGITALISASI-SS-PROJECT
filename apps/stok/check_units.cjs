const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function run() {
  const { data } = await supabase.from('bahan_baku').select('nama, satuan, satuan_kecil, faktor_konversi, satuan_tengah, faktor_tengah')
  
  const targetNames = [
    'SAOS CABE', 'SAOS TOMAT', 'SAOS SAMYANG', 'MAYONAISE', 'MAYONES',
    'KULIT 25', 'KULIT 28', 'KULIT 32', 'AYAM', 'SAPI', 'KENTANG', 'KEJU',
    'TUM', 'BAWANG', 'TEPUNG', 'MINYAK SAYUR', 'MINYAK', 'FOIL', 'SARUNG TANGAN BENING', 'HAND GLOVE',
    'KERTAS STRUK', 'THERMAL STRUK', 'PLASTIK BENING', 'PLASTIK BESAR', 'PLASTIK KECIL', 'POLYBAG',
    'PLASTIK MERAH', 'PAPER WRAP', 'POWDER TEH', 'POWDER JERUK', 'CUP', 'TUTUP', 'SEDOTAN', 'STIKER',
    'MIE', 'SAYUR', 'ES BATU CRYSTAL', 'ES BATU'
  ];
  
  const map = {}
  for (const b of data) {
    if (targetNames.includes(b.nama.toUpperCase())) {
      map[b.nama] = {
        satuan: b.satuan,
        satuan_kecil: b.satuan_kecil,
        faktor_konversi: b.faktor_konversi,
        satuan_tengah: b.satuan_tengah,
        faktor_tengah: b.faktor_tengah
      }
    }
  }
  console.log(JSON.stringify(map, null, 2))
}

run()
