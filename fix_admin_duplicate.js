const { createClient } = require('@supabase/supabase-js');
const url = 'https://khpkoreaaucvyqfhynfq.supabase.co';
const serviceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtocGtvcmVhYXVjdnlxZmh5bmZxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MDk2MzI5MiwiZXhwIjoyMDk2NTM5MjkyfQ.Dy0QMAHfB8EU9BK-JuyRrBidpG6iM94t9RtiJ_viZz8';

const admin = createClient(url, serviceKey);

async function run() {
  const cicurugId = 'd9a2ef93-c298-4501-a471-1c5e2b3dff08';
  const shiftId = 'f7430e25-8fb6-4580-b924-85427c6230af';
  const topupId = 'e1647d92-97d3-4b10-bb21-4a6cced33573';
  const newTimestamp = '2026-08-01T06:17:00+00:00'; // 13:17 WIB, which is AFTER shift started (13:16)

  // 1. Move the topup inside the shift window
  const { error: tErr } = await admin
    .from('petty_cash_topups')
    .update({ 
      created_at: newTimestamp, 
      completed_at: newTimestamp,
      finance_forwarded_at: newTimestamp,
      area_manager_forwarded_at: newTimestamp,
      leader_forwarded_at: newTimestamp
    })
    .eq('id', topupId);
    
  if (tErr) console.error("Error updating topup:", tErr);
  else console.log("Topup timestamp moved inside shift window.");

  // 2. Revert starting_petty_cash back to 1500
  const { error: sErr } = await admin
    .from('shifts')
    .update({ starting_petty_cash: 1500 })
    .eq('id', shiftId)
    .eq('outlet_id', cicurugId);

  if (sErr) console.error("Error reverting shift:", sErr);
  else console.log("Shift starting_petty_cash reverted to 1500.");
}
run();
