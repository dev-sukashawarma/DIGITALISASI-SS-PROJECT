import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function check() {
  const GUDANG_ID = 'd23e11b3-23f1-4f9a-b428-cc73e1aa9b90';
  const { data } = await supabase.from('opname').select('*').eq('outlet_id', GUDANG_ID).order('created_at', { ascending: false }).limit(3);
  console.log(data);
}
check();
