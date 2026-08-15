const { createClient } = require('@supabase/supabase-js');
const url = 'https://khpkoreaaucvyqfhynfq.supabase.co';
const serviceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtocGtvcmVhYXVjdnlxZmh5bmZxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MDk2MzI5MiwiZXhwIjoyMDk2NTM5MjkyfQ.Dy0QMAHfB8EU9BK-JuyRrBidpG6iM94t9RtiJ_viZz8';

const admin = createClient(url, serviceKey);

async function checkShifts() {
  const cicurugId = 'd9a2ef93-c298-4501-a471-1c5e2b3dff08';

  const { data: shifts, error } = await admin
    .from('shifts')
    .select('id, status, start_time, end_time, starting_petty_cash, expected_ending_petty_cash, actual_ending_petty_cash, starting_cash, actual_ending_cash, created_at, updated_at')
    .eq('outlet_id', cicurugId)
    .order('start_time', { ascending: false })
    .limit(5);

  console.log("Recent shifts for Cicurug:", shifts);
}

checkShifts();
