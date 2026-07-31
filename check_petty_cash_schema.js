const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://khpkoreaaucvyqfhynfq.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtocGtvcmVhYXVjdnlxZmh5bmZxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MDk2MzI5MiwiZXhwIjoyMDk2NTM5MjkyfQ.Dy0QMAHfB8EU9BK-JuyRrBidpG6iM94t9RtiJ_viZz8'
);

async function main() {
  const { data, error } = await supabase
    .from('petty_cash_transactions')
    .select('*')
    .limit(1);
    
  if (error) {
     console.error('petty_cash_transactions error:', error.message);
  } else {
     console.log('petty_cash_transactions schema:', Object.keys(data[0] || {}));
  }
  
  const { data: d2, error: e2 } = await supabase
    .from('petty_cash')
    .select('*')
    .limit(1);
    
  if (e2) {
     console.error('petty_cash error:', e2.message);
  } else {
     console.log('petty_cash schema:', Object.keys(d2[0] || {}));
  }
}
main();
