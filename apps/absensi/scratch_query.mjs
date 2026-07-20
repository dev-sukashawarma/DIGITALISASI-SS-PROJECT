import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://khpkoreaaucvyqfhynfq.supabase.co';
const serviceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtocGtvcmVhYXVjdnlxZmh5bmZxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MDk2MzI5MiwiZXhwIjoyMDk2NTM5MjkyfQ.Dy0QMAHfB8EU9BK-JuyRrBidpG6iM94t9RtiJ_viZz8';

const admin = createClient(supabaseUrl, serviceKey);

async function findStaff() {
  const { data: staff, error: err1 } = await admin
    .from('outlet_staff')
    .select('id, name')
    .ilike('name', '%staff_pusat%');
    
  if (err1) {
    console.error('Error fetching outlet_staff:', err1);
  } else {
    console.log('outlet_staff:', JSON.stringify(staff, null, 2));
    
    if (staff && staff.length > 0) {
      const staffId = staff[0].id;
      
      // Delete today's attendance for this staff
      const today = new Date();
      today.setUTCHours(0,0,0,0);
      
      const { data: del, error: err2 } = await admin
        .from('attendance')
        .delete()
        .eq('outlet_staff_id', staffId)
        .gte('created_at', today.toISOString())
        .select();
        
      if (err2) {
        console.error('Error deleting attendance:', err2);
      } else {
        console.log('Deleted attendance:', JSON.stringify(del, null, 2));
      }
    }
  }
}

findStaff();
