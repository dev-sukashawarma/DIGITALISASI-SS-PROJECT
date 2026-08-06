const { createClient } = require('@supabase/supabase-js');
const url = 'https://khpkoreaaucvyqfhynfq.supabase.co';
const serviceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtocGtvcmVhYXVjdnlxZmh5bmZxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MDk2MzI5MiwiZXhwIjoyMDk2NTM5MjkyfQ.Dy0QMAHfB8EU9BK-JuyRrBidpG6iM94t9RtiJ_viZz8';
const admin = createClient(url, serviceKey);

async function run() {
  const { data, error } = await admin
    .from('cash_transaction')
    .update({ status: 'paid' })
    .eq('source_type', 'petty_cash_topup')
    .eq('status', 'pending_approval')
    .select('id, amount, status');
  
  if (error) console.error('Error updating:', error);
  else console.log(`Updated ${data.length} historical petty cash transactions to 'paid'.`);
}

run();
