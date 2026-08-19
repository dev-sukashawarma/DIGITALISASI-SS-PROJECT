const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://khpkoreaaucvyqfhynfq.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtocGtvcmVhYXVjdnlxZmh5bmZxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MDk2MzI5MiwiZXhwIjoyMDk2NTM5MjkyfQ.Dy0QMAHfB8EU9BK-JuyRrBidpG6iM94t9RtiJ_viZz8'
);

async function checkKalisariFull() {
  const { data: outlets } = await supabase.from('outlets').select('id, name').ilike('name', '%kalisari%');
  if (!outlets || outlets.length === 0) return console.log('Outlet not found');
  const outlet = outlets[0];
  console.log('--- OUTLET ---', outlet.name);

  // Shifts
  const { data: shifts } = await supabase
    .from('shifts')
    .select('id, start_time, end_time, starting_petty_cash, expected_ending_petty_cash, actual_ending_petty_cash')
    .eq('outlet_id', outlet.id)
    .order('start_time', { ascending: false })
    .limit(5);

  console.log('\n--- 5 LAST SHIFTS ---');
  console.table(shifts);

  // Active shift current balance calculation logic (simplified)
  if (shifts && shifts.length > 0) {
      const activeShift = shifts.find(s => !s.end_time) || shifts[0];
      console.log('\nCurrent Petty Cash based on shift starting:', activeShift.starting_petty_cash);
      
      const { data: topups } = await supabase.from('petty_cash_topups')
        .select('amount')
        .eq('outlet_id', outlet.id)
        .gte('created_at', activeShift.start_time)
        .eq('status', 'completed');
        
      const { data: expenses } = await supabase.from('petty_cash_expenses')
        .select('amount')
        .eq('outlet_id', outlet.id)
        .gte('created_at', activeShift.start_time);
        
      const tTotal = (topups||[]).reduce((a,b)=>a+b.amount, 0);
      const eTotal = (expenses||[]).reduce((a,b)=>a+b.amount, 0);
      console.log('Active Shift Topups:', tTotal, 'Expenses:', eTotal);
      console.log('Calculated Current Balance:', Number(activeShift.starting_petty_cash||0) + tTotal - eTotal);
  }

  // Topups
  const { data: topups } = await supabase
    .from('petty_cash_topups')
    .select('*, outlet_staff!petty_cash_topups_created_by_fkey(name)')
    .eq('outlet_id', outlet.id)
    .order('created_at', { ascending: false });

  console.log('\n--- FULL TOPUP HISTORY ---');
  console.table(topups.map(t => ({
      date: t.created_at,
      amount: t.amount,
      status: t.status,
      created_by: t.outlet_staff?.name || t.created_by
  })));
  
  // Expenses (Kas Keluar)
  const { data: expenses } = await supabase
    .from('petty_cash_expenses')
    .select('*, outlet_staff!petty_cash_expenses_created_by_fkey(name)')
    .eq('outlet_id', outlet.id)
    .order('created_at', { ascending: false })
    .limit(10);
    
  console.log('\n--- 10 LATEST EXPENSES (KAS KELUAR) ---');
  console.table(expenses.map(t => ({
      date: t.created_at,
      amount: t.amount,
      category: t.category,
      notes: t.notes,
      created_by: t.outlet_staff?.name || t.created_by
  })));
}

checkKalisariFull();
