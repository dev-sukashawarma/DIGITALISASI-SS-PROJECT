
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve('./.env.local') });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
async function run() {
  const d = new Date(); d.setDate(1); d.setHours(0, 0, 0, 0);
  const buildQuery = () => supabase.from('orders').select('id, outlet_id, status').order('created_at', { ascending: false }).gte('created_at', d.toISOString());
  
  let all = [];
  let offset = 0;
  while(true) {
     const { data, error } = await buildQuery().range(offset, offset + 1000 - 1);
     if (error) { console.error(error); break; }
     const page = data || [];
     all.push(...page);
     if (page.length < 1000) break;
     offset += 1000;
  }
  console.log('Total fetched via pagination:', all.length);
  const fromOutletTes = all.filter(o => o.outlet_id === 'eb174b2b-ff69-47eb-97af-b6c824d3ce4a');
  console.log('Orders from outlet tes:', fromOutletTes.length);
  const completedTes = fromOutletTes.filter(o => o.status === 'completed');
  console.log('Completed from outlet tes:', completedTes.length);
}
run();

