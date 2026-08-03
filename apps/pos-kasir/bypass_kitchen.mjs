import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve('./.env.local') });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  const { data: outlets } = await supabase.from('outlets').select('id, name');
  const target = outlets.find(o => o.name.toLowerCase().includes('bnr'));
  
  if (!target) {
    console.error('Kitchen BNR outlet not found');
    console.log('Available outlets:', outlets.map(o => o.name));
    return;
  }
  
  console.log('Found Kitchen BNR outlet:', target.id);
  
  const { data, error } = await supabase.from('bypass_requests').insert({
    outlet_id: target.id,
    requested_by_name: 'System Admin',
    reason: 'Bypass Darurat Request by User (Manual)',
    status: 'approved'
  }).select();
  
  if (error) {
    console.error('Error inserting bypass request:', error);
  } else {
    console.log('Successfully inserted approved bypass request:', data);
  }
}

run();
