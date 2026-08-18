const path = require('path');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

const mapping = {
  "SAOS CABE POUCH": "FOOD & BEVERAGE",
  "SAOS TOMAT KOMPAN": "FOOD & BEVERAGE",
  "SAOS TOMAT POUCH": "FOOD & BEVERAGE",
  "MAYONAISE": "FOOD & BEVERAGE",
  "MINYAK": "FOOD & BEVERAGE",
  "POWDER TEH": "FOOD & BEVERAGE",
  "POWDER JERUK": "FOOD & BEVERAGE",
  "SAYUR": "FOOD & BEVERAGE",
  
  "PLASTIK SUKA DRINK": "PACKAGING",
  "FOIL (48)": "PACKAGING",
  "TUTUP PACK": "PACKAGING",
  "SEDOTAN": "PACKAGING",
  
  "PLASTIK VACUUM JUMBO": "OPERASIONAL",
  "HAND GLOVE": "OPERASIONAL"
};

async function updateMissing() {
  let dbUpdatedCount = 0;
  for (const [nama, kategori] of Object.entries(mapping)) {
    const { data, error } = await supabase
      .from('bahan_baku')
      .update({ kategori: kategori })
      .eq('nama', nama)
      .select('nama');
      
    if (error) {
      console.error(`Error updating ${nama}:`, error);
    } else if (data && data.length > 0) {
      console.log(`Updated DB: ${nama} -> ${kategori}`);
      dbUpdatedCount += data.length;
    } else {
      console.log(`Skipped (not found or inactive): ${nama}`);
    }
  }
  console.log(`Successfully updated ${dbUpdatedCount} additional items in Supabase.`);
}

updateMissing().catch(console.error);
