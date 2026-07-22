import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function clean() {
  const GUDANG_ID = 'd23e11b3-23f1-4f9a-b428-cc73e1aa9b90';
  
  const wibOffset = 7 * 60; // WIB is UTC+7
  const now = new Date();
  const wibNow = new Date(now.getTime() + wibOffset * 60 * 1000);
  const todayWIB = wibNow.toISOString().slice(0, 10);
  
  const { data: opnames } = await supabase.from('opname')
    .select('id')
    .eq('outlet_id', GUDANG_ID)
    .eq('tanggal', todayWIB);
    
  if (!opnames || opnames.length === 0) {
    console.log("No opnames found");
    return;
  }
  
  for (const op of opnames) {
    await supabase.from('opname_item').delete().eq('opname_id', op.id);
    await supabase.from('opname').delete().eq('id', op.id);
  }
  console.log("Deleted", opnames.length, "opnames for Gudang today");
}

clean();
