import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);

async function run() {
  const { data: bb, error: bbError } = await supabase
    .from('bahan_baku')
    .select('id, nama')
    .ilike('nama', '%MINYAK SAYUR%')
    .limit(1);
    
  if (bbError || !bb || bb.length === 0) {
    console.log('MINYAK SAYUR not found');
    return;
  }
  
  const { data, error } = await supabase
    .from('resep_item')
    .select('resep_id, satuan, qty_per_porsi')
    .eq('bahan_baku_id', bb[0].id)
    .limit(5);
    
  if (error) {
    console.error('Error fetching data:', error);
  } else {
    console.log('Resep items for MINYAK SAYUR:', data);
  }
}

run();
