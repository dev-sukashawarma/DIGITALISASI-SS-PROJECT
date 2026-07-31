
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve('./.env.local') });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  const { data: beji } = await supabase.from('outlets').select('id, name').ilike('name', '%beji%').single();
  console.log('Beji:', beji);
  
  if (beji) {
    const { data: attendance } = await supabase.from('attendance')
      .select('outlet_staff_id, type, ts_server, outlet_staff(name, role, outlet_id)')
      .eq('outlet_id', beji.id)
      .order('ts_server', { ascending: false })
      .limit(10);
      
    console.log('Attendance at Beji recently:');
    if (attendance) {
      for (const a of attendance) {
        console.log('- ' + (a.outlet_staff?.name || 'unknown') + ' (' + (a.outlet_staff?.role || '?') + ') type:' + a.type + ' ts:' + a.ts_server + ' current_outlet_id:' + a.outlet_staff?.outlet_id);
        
        if (a.outlet_staff?.role === 'leader' && a.outlet_staff?.outlet_id !== beji.id) {
            console.log('Updating leader ' + a.outlet_staff.name + ' to outlet ' + beji.id);
            const { error } = await supabase.from('outlet_staff').update({ outlet_id: beji.id }).eq('id', a.outlet_staff_id);
            console.log('Update error:', error);
        }
      }
    }
  }
}
run();

