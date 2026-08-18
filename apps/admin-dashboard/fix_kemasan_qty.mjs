import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

// Map item target names to their exact kemasan_qty (in satuan_kecil)
// Based on typical price conventions from user:
const kemasanQtyMap = {
  "AYAM": 1, // Jika resep porsi = 1 ekor (atau 1 potong?), biasanya 1 atau 1000 (1kg)? Tergantung resep. Kita pakai faktor_tampilan/konversi fallback
  "GAS 3Kg": 3000, 
  "KEJU": 10, // 10 lembar?
  "KENTANG": 1000, // 25rb per Kg
  "KULIT 25": 20, // 27rb per Pack (20 lembar)
  "KULIT 28": 20, // 32rb per Pack (20 lembar)
  "KULIT 32": 20, // 38rb per Pack (20 lembar)
  "MAYONES": 1000, // 23.706 per 1 Kg (1000 gram)
  "MAYONAISE": 1000, 
  "LETTUCE": 1000, // 22rb per Kg
  "MINYAK": 16000, // 368rb per Kompan (16 Kg = 16000 gram)
  "SAOS CABE POUCH": 1000, // 14.179 per Kg
  "SAOS CABE": 1000, 
  "SAOS CABE KOMPAN": 5500, // 79.656 per Kompan (5.5 Kg)
  "SAOS TOMAT KOMPAN": 5500, // 62.559 per Kompan (5.5 Kg)
  "SAOS TOMAT POUCH": 1000, // 10.613 per Kg
  "SAOS TOMAT": 1000, 
  "SAPI": 1000, // 100.000 per Kg (1000 gram)
  "BAWANG": 1000, 
  "CENGKEH": 1000, 
  "GARAM": 1000, 
  "JINTEN": 1000, 
  "KAYU MANIS": 1000, 
  "KETUMBAR": 1000, 
  "KUNYIT": 1000, 
  "SAOS SAMYANG": 1000, 
  "SASA": 1000, // 51.000 per Kg?
  "TEPUNG": 1000, 
  "ES BATU": 1, // 30rb per Balok/Dus?
  "POWDER TEH": 1000, 
  "POWDER JERUK": 1000, 
  "CUP": 1, // 1780 per cup
  "DUS PACKING": 1, // 10250 per dus
  "FOIL": 24, // 11554 per roll?
  "FOIL (48)": 48, 
  "KERTAS STRUK": 1, // 1600 per roll?
  "THERMAL STRUK": 1,
  "PAPER WRAP": 500, // 160 per lembar? Wait. If it is 160 per lembar, kemasan_qty = 1.
  "PLASTIK BESAR": 100, // 6000 per ikat (100 lembar?)
  "PLASTIK KECIL": 100, // 6996 per ikat (100 lembar?)
  "PLASTIK MERAH": 100, // 23500 per ikat (100 lembar?)
  "PLASTIK VACUM": 100, // 44000 per dus?
  "POLYBAG": 1,
  "SARUNG TANGAN BENING": 100,
  "STIKER": 1,
  "Cling Wrap": 1
};

// We will fix Paper Wrap. If User says Rp 160, and it's per lembar, kemasan_qty = 1.
kemasanQtyMap["PAPER WRAP"] = 1;

async function run() {
  const { data: allBahan, error: errBahan } = await supabase
    .from('bahan_baku')
    .select('id, nama, satuan, satuan_kecil')
  
  if (errBahan) {
    console.error(errBahan)
    return
  }

  let updatedCount = 0;
  for (const b of allBahan) {
    const targetQty = kemasanQtyMap[b.nama.trim().toUpperCase()] || kemasanQtyMap[b.nama.trim()];
    if (targetQty) {
      const { data, error } = await supabase
        .from('bahan_baku_harga')
        .update({ kemasan_qty: targetQty, kemasan_satuan: b.satuan_kecil || 'Gram' })
        .eq('bahan_baku_id', b.id);
        
      if (!error) {
        console.log(`Updated ${b.nama} -> kemasan_qty: ${targetQty}`);
        updatedCount++;
      } else {
         console.error(`Failed to update ${b.nama}:`, error.message);
      }
    }
  }
  console.log(`Updated ${updatedCount} items.`);
}

run();
