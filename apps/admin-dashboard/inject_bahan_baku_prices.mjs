import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

const inputItems = [
  { rawName: "Ayam", price: 51000, targets: ["AYAM"] },
  { rawName: "Gas", price: 22000, targets: ["GAS 3Kg"] },
  { rawName: "Keju", price: 10850, targets: ["KEJU"] },
  { rawName: "Kentang", price: 25000, targets: ["KENTANG"] },
  { rawName: "Kulit 25", price: 27000, targets: ["KULIT 25"] },
  { rawName: "Kulit 28", price: 32000, targets: ["KULIT 28"] },
  { rawName: "Kulit 32", price: 38000, targets: ["KULIT 32"] },
  { rawName: "Mayones", price: 23706, targets: ["MAYONES", "MAYONAISE"] },
  { rawName: "Lettuce", price: 22000, targets: ["LETTUCE"] },
  { rawName: "Minyak Sayur", price: 368000, targets: ["MINYAK"] },
  { rawName: "Saos Cabe Pack", price: 14179, targets: ["SAOS CABE POUCH", "SAOS CABE"] },
  { rawName: "Saos Cabe Kompan", price: 79656, targets: ["SAOS CABE KOMPAN"] },
  { rawName: "Saos Tomat Kompan", price: 62559, targets: ["SAOS TOMAT KOMPAN"] },
  { rawName: "Saos Tomat Pack", price: 10613, targets: ["SAOS TOMAT POUCH", "SAOS TOMAT"] },
  { rawName: "Sapi", price: 100000, targets: ["SAPI"] },
  { rawName: "Bawang Putih", price: 32500, targets: ["BAWANG"] },
  { rawName: "Cengkeh", price: 165000, targets: ["CENGKEH"] },
  { rawName: "Garam", price: 90000, targets: ["GARAM"] },
  { rawName: "Jinten", price: 75000, targets: ["JINTEN"] },
  { rawName: "Kayu Manis", price: 90000, targets: ["KAYU MANIS"] },
  { rawName: "Ketumbar", price: 32500, targets: ["KETUMBAR"] },
  { rawName: "Kunyit", price: 10972, targets: ["KUNYIT"] },
  { rawName: "Saos Samyang", price: 14774, targets: ["SAOS SAMYANG"] },
  { rawName: "Sasa", price: 51000, targets: ["SASA"] },
  { rawName: "Tepung", price: 18000, targets: ["TEPUNG"] },
  { rawName: "Es Batu", price: 30000, targets: ["ES BATU"] },
  { rawName: "Powder Teh", price: 55250, targets: ["POWDER TEH"] },
  { rawName: "Powder Jeruk", price: 55250, targets: ["POWDER JERUK"] },
  { rawName: "Cup dan Tutup", price: 1780, targets: ["CUP"] },
  { rawName: "Dus Packing", price: 10250, targets: ["DUS PACKING"] },
  { rawName: "Foil Daimaru", price: 11554, targets: ["FOIL", "FOIL (48)"] },
  { rawName: "Kertas Struk", price: 1600, targets: ["KERTAS STRUK", "THERMAL STRUK"] },
  { rawName: "Paper Wrap", price: 160, targets: ["PAPER WRAP"] },
  { rawName: "Plastik Besar", price: 6000, targets: ["PLASTIK BESAR"] },
  { rawName: "Plastik Kecil", price: 6996, targets: ["PLASTIK KECIL"] },
  { rawName: "Plastik Merah", price: 23500, targets: ["PLASTIK MERAH"] },
  { rawName: "Plastik Vacum", price: 44000, targets: ["PLASTIK VACUM"] },
  { rawName: "Poly Bag", price: 9000, targets: ["POLYBAG"] },
  { rawName: "Sarung Tangan Bening", price: 7500, targets: ["SARUNG TANGAN BENING"] },
  { rawName: "Sticker", price: 10000, targets: ["STIKER"] },
  { rawName: "Cling Wrap", price: 10135, targets: ["Cling Wrap"] },
]

async function run() {
  console.log(`Processing ${inputItems.length} items for price injection...`)

  const { data: allBahan, error: errBahan } = await supabase
    .from('bahan_baku')
    .select('id, nama, satuan')
  
  if (errBahan) {
    console.error('Error fetching bahan_baku:', errBahan)
    return
  }

  const bahanMap = new Map()
  allBahan.forEach(b => {
    bahanMap.set(b.nama.toLowerCase().trim(), b)
  })

  let updatedCount = 0
  const results = []

  for (const item of inputItems) {
    for (const targetName of item.targets) {
      const b = bahanMap.get(targetName.toLowerCase().trim())
      if (!b) {
        console.warn(`[NOT FOUND] Target "${targetName}" for "${item.rawName}" not found in DB!`)
        results.push({ item: item.rawName, target: targetName, status: 'NOT FOUND' })
        continue
      }

      // Upsert into bahan_baku_harga
      const now = new Date().toISOString()
      const { data, error } = await supabase
        .from('bahan_baku_harga')
        .upsert({
          bahan_baku_id: b.id,
          harga_beli: item.price,
          harga_beli_display: item.price,
          harga_updated_at: now
        }, { onConflict: 'bahan_baku_id' })
        .select()

      if (error) {
        console.error(`[ERROR] Failed to update ${b.nama} (${b.id}):`, error)
        results.push({ item: item.rawName, target: b.nama, id: b.id, status: 'ERROR: ' + error.message })
      } else {
        console.log(`[SUCCESS] ${b.nama.padEnd(22)} (${b.satuan.padEnd(6)}) -> Rp ${item.price.toLocaleString('id-ID')}`)
        results.push({ item: item.rawName, target: b.nama, id: b.id, satuan: b.satuan, price: item.price, status: 'SUCCESS' })
        updatedCount++
      }
    }
  }

  console.log(`\nInjection finished. Total records updated/upserted: ${updatedCount}`)
}

run()
