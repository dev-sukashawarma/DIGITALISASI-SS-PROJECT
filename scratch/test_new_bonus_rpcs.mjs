import dotenv from 'dotenv';
dotenv.config({ path: 'apps/admin-dashboard/.env.local' });
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function test() {
  const month = 8;
  const year = 2026;

  console.log('--- Testing get_monthly_bonus_summary ---');
  const { data: summary, error: e1 } = await supabase.rpc('get_monthly_bonus_summary', { p_month: month, p_year: year });
  if (e1) console.error('Summary Error:', e1);
  else console.log('Summary:', summary);

  console.log('--- Testing get_monthly_crew_bonus ---');
  const { data: crew, error: e2 } = await supabase.rpc('get_monthly_crew_bonus', { p_month: month, p_year: year, p_outlet_id: null });
  if (e2) console.error('Crew Error:', e2);
  else console.log('Crew count:', crew?.length, 'Sample:', crew?.slice(0, 3));

  console.log('--- Testing get_monthly_am_bonus ---');
  const { data: am, error: e3 } = await supabase.rpc('get_monthly_am_bonus', { p_month: month, p_year: year });
  if (e3) console.error('AM Error:', e3);
  else console.log('AM count:', am?.length, 'Sample:', am);

  console.log('--- Testing get_monthly_rm_bonus ---');
  const { data: rm, error: e4 } = await supabase.rpc('get_monthly_rm_bonus', { p_month: month, p_year: year });
  if (e4) console.error('RM Error:', e4);
  else console.log('RM count:', rm?.length, 'Sample:', rm);
}

test();
