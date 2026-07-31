
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve('./.env.local') });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  const { data: beji } = await supabase.from('outlets').select('id, name').ilike('name', '%beji%').single();
  console.log('Beji:', beji);
  
  if (beji) {
    // Find who checked in at Beji lately
    const { data: attendance } = await supabase.from('attendance')
      .select('outlet_staff_id, ts_server, outlet_staff(name, role)')
      .eq('outlet_id', beji.id)
      .order('ts_server', { ascending: false })
      .limit(20);
      
    if (attendance && attendance.length > 0) {
      console.log('Recent attendance at Beji:');
      attendance.forEach(a => {
         console.log(a.outlet_staff?.name, a.outlet_staff?.role, a.ts_server);
      });
    } else {
      console.log('No attendance at Beji found in latest records!');
    }
    
    // Who is authorized for Beji?
    const { data: auth } = await supabase.from('staff_outlets').select('staff_id, outlet_staff(name, role)').eq('outlet_id', beji.id);
    console.log('Authorized staff for Beji:', auth);
  }
}
run();

