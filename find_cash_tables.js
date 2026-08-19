const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://khpkoreaaucvyqfhynfq.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtocGtvcmVhYXVjdnlxZmh5bmZxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MDk2MzI5MiwiZXhwIjoyMDk2NTM5MjkyfQ.Dy0QMAHfB8EU9BK-JuyRrBidpG6iM94t9RtiJ_viZz8'
);

async function listTables() {
  const { data, error } = await supabase.rpc('get_tables');
  if (error) {
     console.log('Error calling get_tables RPC, trying raw postgres query via REST if possible, or we will query known possible names.', error);
     
     // query pg_stat_user_tables is not directly possible via select.
     // Let's just try to select from 'cash_transactions', 'outlet_cash' etc.
     const tables = ['cash_transactions', 'outlet_cash', 'petty_cash_topups', 'petty_cash_saldo'];
     for(let table of tables) {
        const {error} = await supabase.from(table).select('id').limit(1);
        if(!error) console.log('Table exists:', table);
     }
  } else {
     console.log(data);
  }
}

listTables();
