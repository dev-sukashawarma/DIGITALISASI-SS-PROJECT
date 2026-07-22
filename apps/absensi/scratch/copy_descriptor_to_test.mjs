import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://khpkoreaaucvyqfhynfq.supabase.co';
const serviceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtocGtvcmVhYXVjdnlxZmh5bmZxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MDk2MzI5MiwiZXhwIjoyMDk2NTM5MjkyfQ.Dy0QMAHfB8EU9BK-JuyRrBidpG6iM94t9RtiJ_viZz8';

const admin = createClient(supabaseUrl, serviceKey);

async function enableTestStaff() {
  const cicurugId = 'd9a2ef93-c298-4501-a471-1c5e2b3dff08';
  
  // Fetch Reza's face descriptor
  const { data: reza } = await admin.from('outlet_staff').select('face_descriptor').eq('name', 'Reza').eq('outlet_id', cicurugId).single();

  if (reza && reza.face_descriptor) {
    // Enable Test Cicurug with valid face descriptor for testing
    const { error } = await admin
      .from('outlet_staff')
      .update({ face_descriptor: reza.face_descriptor })
      .eq('name', 'Test Cicurug')
      .eq('outlet_id', cicurugId);

    if (error) {
      console.error('Error updating Test Cicurug:', error);
    } else {
      console.log('Successfully updated Test Cicurug with enrolled face descriptor!');
    }
  }
}

enableTestStaff();
