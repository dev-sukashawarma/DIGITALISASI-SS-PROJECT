const { createClient } = require('@supabase/supabase-js');
const url = 'https://khpkoreaaucvyqfhynfq.supabase.co';
const serviceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtocGtvcmVhYXVjdnlxZmh5bmZxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MDk2MzI5MiwiZXhwIjoyMDk2NTM5MjkyfQ.Dy0QMAHfB8EU9BK-JuyRrBidpG6iM94t9RtiJ_viZz8';

const admin = createClient(url, serviceKey);

async function run() {
  const cicurugId = 'd9a2ef93-c298-4501-a471-1c5e2b3dff08';

  const { data: shiftData, error: shiftError } = await admin
    .from('shifts')
    .select('*')
    .eq('outlet_id', cicurugId)
    .eq('status', 'open')
    .maybeSingle()

  if (shiftError || !shiftData) {
    console.log("No open shift found.");
    return;
  }

  const [expRes, topRes] = await Promise.all([
    admin.from('petty_cash_expenses').select('*').eq('outlet_id', cicurugId).gte('created_at', shiftData.start_time),
    admin.from('petty_cash_topups').select('*').eq('outlet_id', cicurugId).or(`created_at.gte.${shiftData.start_time},completed_at.gte.${shiftData.start_time}`)
  ])

  const snapExpenses = expRes.data || [];
  const snapTopups = topRes.data || [];

  const startPetty = Number(shiftData.starting_petty_cash) || 0
  const topupsTotal = snapTopups
    .filter(t => t.status === 'completed' || t.status === 'approved')
    .reduce((sum, t) => sum + (Number(t.amount) || 0), 0)
  const expensesTotal = snapExpenses
    .filter(e => !e.deleted_at)
    .reduce((sum, e) => sum + (Number(e.amount) || 0), 0)

  const calculatedBalance = startPetty + topupsTotal - expensesTotal

  console.log(`=== SIMULASI APLIKASI KASIR ===`);
  console.log(`Starting Petty Cash: Rp ${startPetty}`);
  console.log(`Topups Total       : Rp ${topupsTotal}`);
  console.log(`Expenses Total     : Rp ${expensesTotal}`);
  console.log(`===============================`);
  console.log(`Calculated Balance : Rp ${calculatedBalance}`);
}
run();
