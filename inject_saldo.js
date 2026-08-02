const { createClient } = require('@supabase/supabase-js');
const url = 'https://khpkoreaaucvyqfhynfq.supabase.co';
const serviceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtocGtvcmVhYXVjdnlxZmh5bmZxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MDk2MzI5MiwiZXhwIjoyMDk2NTM5MjkyfQ.Dy0QMAHfB8EU9BK-JuyRrBidpG6iM94t9RtiJ_viZz8';

const admin = createClient(url, serviceKey);

async function run() {
  const cicurugId = 'd9a2ef93-c298-4501-a471-1c5e2b3dff08';
  const shiftId = 'f7430e25-8fb6-4580-b924-85427c6230af';

  const { data, error } = await admin
    .from('shifts')
    .update({ starting_petty_cash: 401500 })
    .eq('id', shiftId)
    .eq('outlet_id', cicurugId)
    .select();

  if (error) {
    console.error("Error updating DB:", error);
  } else {
    console.log("DB Update Success! New shift data:", data);
  }
}
run();
