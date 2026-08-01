const { createClient } = require('@supabase/supabase-js');
const url = 'https://khpkoreaaucvyqfhynfq.supabase.co';
const serviceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtocGtvcmVhYXVjdnlxZmh5bmZxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MDk2MzI5MiwiZXhwIjoyMDk2NTM5MjkyfQ.Dy0QMAHfB8EU9BK-JuyRrBidpG6iM94t9RtiJ_viZz8';

const admin = createClient(url, serviceKey);

async function run() {
  const { data: b } = await admin.from('cash_balance').select('*').limit(1);
  console.log("cash_balance sample:", b);
  
  const { data: t } = await admin.from('cash_transaction').select('*').limit(1);
  console.log("cash_transaction sample:", t);
  
  const { data: pt } = await admin.from('petty_cash_expenses').select('*').limit(1);
  console.log("petty_cash_expenses sample:", pt);
}
run();
