const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '../../.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  try {
    const { data: resepItems, error } = await supabase
      .from('resep_item')
      .select('resep_id, bahan_baku_id, qty_per_porsi, satuan')
      .eq('bahan_baku_id', '527682ad-96ee-43bb-9f77-eccad84c5976');
      
    if (error) throw error;
    
    console.log(resepItems);
  } catch (err) {
    console.error(err);
  }
}

run();
