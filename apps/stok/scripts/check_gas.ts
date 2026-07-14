import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);

async function run() {
  const { data: viewData, error: viewError } = await supabase
    .from('monitoring_view_crew')
    .select('*')
    .eq('item_name', 'GAS 3Kg')
    .limit(5);

  console.log('View Data:', viewData);

  const { data: bbData } = await supabase
    .from('bahan_baku')
    .select('id, nama, default_reorder_point')
    .eq('nama', 'GAS 3Kg');
  
  console.log('Bahan Baku Data:', bbData);

  if (viewData && viewData.length > 0) {
    const { data: orpData } = await supabase
      .from('outlet_reorder_point')
      .select('*')
      .eq('bahan_baku_id', viewData[0].bahan_baku_id);
    console.log('Outlet Reorder Points:', orpData);
  }
}

run();
