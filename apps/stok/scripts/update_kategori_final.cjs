const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing Supabase credentials in .env.local");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

const food_beverage = [
  "BAWANG", "CENGKEH", "GARAM", "JINTEN", "KAYU MANIS", "KETUMBAR", "KUNYIT",
  "SAOS SAMYANG", "SASA", "TEPUNG", "AYAM", "GAS 3Kg", "KEJU", "KENTANG",
  "KULIT 25", "KULIT 28", "KULIT 32", "LETTUCE", "MAYONES", "MINYAK SAYUR",
  "SAOS CABE", "SAOS TOMAT", "SAPI", "TUM", "MIE", "ES BATU", "POWDER MIX"
];

const packaging = [
  "CUP", "TUTUP", "DUS PACKING", "FOIL", "PAPER WRAP", "PLASTIK BESAR",
  "PLASTIK KECIL", "PLASTIK MERAH", "STIKER"
];

const operasional = [
  "KERTAS STRUK", "PLASTIK VACUM", "POLYBAG", "SARUNG TANGAN BENING",
  "Cling Wrap", "SABUN"
];

async function updateData() {
  // 1. Update local JSON
  const jsonPath = path.join(__dirname, '..', 'bahan_baku.json');
  let data = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
  let updatedCount = 0;

  for (let item of data) {
    let newCat = "";
    if (food_beverage.includes(item.nama)) {
      newCat = "FOOD & BEVERAGE";
    } else if (packaging.includes(item.nama)) {
      newCat = "PACKAGING";
    } else if (operasional.includes(item.nama)) {
      newCat = "OPERASIONAL";
    } else {
      console.warn("Item not matched in mapping:", item.nama);
      continue;
    }

    if (item.kategori !== newCat) {
      item.kategori = newCat;
      updatedCount++;
    }
  }

  fs.writeFileSync(jsonPath, JSON.stringify(data, null, 2));
  console.log(`Updated ${updatedCount} items in bahan_baku.json`);

  // 2. Update Supabase
  console.log("Fetching active items from Supabase...");
  const { data: dbItems, error: fetchErr } = await supabase
    .from('bahan_baku')
    .select('id, nama, kategori')
    .eq('is_active', true);

  if (fetchErr) {
    console.error("Error fetching from Supabase:", fetchErr);
    return;
  }

  let dbUpdatedCount = 0;
  for (let dbItem of dbItems) {
    let newCat = "";
    if (food_beverage.includes(dbItem.nama)) {
      newCat = "FOOD & BEVERAGE";
    } else if (packaging.includes(dbItem.nama)) {
      newCat = "PACKAGING";
    } else if (operasional.includes(dbItem.nama)) {
      newCat = "OPERASIONAL";
    } else {
      console.warn("DB Item not matched in mapping:", dbItem.nama);
      continue;
    }

    if (dbItem.kategori !== newCat) {
      const { error: updateErr } = await supabase
        .from('bahan_baku')
        .update({ kategori: newCat })
        .eq('id', dbItem.id);
        
      if (updateErr) {
        console.error(`Error updating DB for ${dbItem.nama}:`, updateErr);
      } else {
        console.log(`DB Updated: ${dbItem.nama} -> ${newCat}`);
        dbUpdatedCount++;
      }
    }
  }
  
  console.log(`Successfully updated ${dbUpdatedCount} items in Supabase.`);
}

updateData().catch(console.error);
