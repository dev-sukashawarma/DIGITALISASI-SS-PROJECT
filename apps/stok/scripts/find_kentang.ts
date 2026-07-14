import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);

async function run() {
  const { data: bb, error: bbError } = await supabase
    .from('bahan_baku')
    .select('id, nama')
    .ilike('nama', '%KENTANG%')
    .limit(1);
    
  if (bbError || !bb || bb.length === 0) {
    console.log('KENTANG not found');
    return;
  }
  
  console.log('BB:', bb[0]);
  
  const { data, error } = await supabase
    .from('stok_balance')
    .select('outlet_id, saldo')
    .eq('bahan_baku_id', bb[0].id)
    .order('saldo', { ascending: false })
    .limit(5);
    
  if (error) {
    console.error('Error fetching data:', error);
  } else {
    console.log('Top quantities for KENTANG:', data);
  }
}

run();
