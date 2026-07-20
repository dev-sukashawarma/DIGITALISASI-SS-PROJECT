import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  const { data: outletData } = await supabase.from('outlets').select('id').limit(1);
  if (!outletData || outletData.length === 0) return console.log('No outlet found');
  const outletId = outletData[0].id;
  
  let p_start = new Date();
  p_start.setDate(p_start.getDate() - 7);
  p_start.setHours(0, 0, 0, 0);
  let p_end = new Date();
  
  console.log('Fetching analytics for:', outletId, p_start, p_end);
  const { data, error } = await supabase.rpc('get_outlet_analytics', {
    p_outlet_id: outletId,
    p_start: p_start.toISOString(),
    p_end: p_end.toISOString()
  });
  
  if (error) console.error('Error:', error);
  else console.log('Analytics Data:', JSON.stringify(data, null, 2));
}

run();
