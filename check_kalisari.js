const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://khpkoreaaucvyqfhynfq.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtocGtvcmVhYXVjdnlxZmh5bmZxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MDk2MzI5MiwiZXhwIjoyMDk2NTM5MjkyfQ.Dy0QMAHfB8EU9BK-JuyRrBidpG6iM94t9RtiJ_viZz8'
);

async function checkKalisari() {
  const { data: outlets, error: outletErr } = await supabase
    .from('outlets')
    .select('id, name')
    .ilike('name', '%kalisari%');

  if (outletErr) {
    console.error('Error fetching outlet:', outletErr);
    return;
  }

  console.log('--- OUTLETS ---');
  console.log(outlets);

  for (const outlet of outlets) {
    console.log(`\n\n--- DATA FOR ${outlet.name} (ID: ${outlet.id}) ---`);
    
    // Check if there is a petty_cash table
    const { data: pcData, error: pcErr } = await supabase
      .from('petty_cash')
      .select('*')
      .eq('outlet_id', outlet.id);
      
    if (pcErr) {
       console.error('No petty_cash table or error:', pcErr.message);
    } else {
       console.log('\nPetty Cash Balance Table:');
       console.log(pcData);
    }
    
    // Check petty_cash_topups
    const { data: topups, error: topupsErr } = await supabase
      .from('petty_cash_topups')
      .select('*, outlet_staff!petty_cash_topups_created_by_fkey(name)')
      .eq('outlet_id', outlet.id)
      .order('created_at', { ascending: false });
      
    if (topupsErr) {
       console.error('Error fetching topups:', topupsErr.message);
    } else {
       console.log('\nTopup History (latest first):');
       console.table(topups.map(t => ({
          date: t.created_at,
          amount: t.amount,
          status: t.status,
          notes: t.notes,
          created_by: t.outlet_staff?.name || t.created_by,
          approved_by: t.approved_by,
          approved_at: t.approved_at,
          proof_image_url: t.proof_image_url ? 'Yes' : 'No'
       })));
    }
    
    // Check petty_cash_transactions
    const { data: txs, error: txsErr } = await supabase
      .from('petty_cash_transactions')
      .select('*, outlet_staff!petty_cash_transactions_created_by_fkey(name)')
      .eq('outlet_id', outlet.id)
      .order('created_at', { ascending: false });
      
    if (txsErr) {
       console.error('Error fetching transactions:', txsErr.message);
    } else {
       console.log('\nTransaction History (latest first):');
       console.table(txs.map(t => ({
          date: t.created_at,
          type: t.type,
          amount: t.amount,
          balance_after: t.balance_after,
          notes: t.notes,
          created_by: t.outlet_staff?.name || t.created_by
       })));
    }
  }
}

checkKalisari();
