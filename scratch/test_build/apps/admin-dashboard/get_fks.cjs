const { createClient } = require('@supabase/supabase-js');
const url = 'https://khpkoreaaucvyqfhynfq.supabase.co';
const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtocGtvcmVhYXVjdnlxZmh5bmZxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MDk2MzI5MiwiZXhwIjoyMDk2NTM5MjkyfQ.Dy0QMAHfB8EU9BK-JuyRrBidpG6iM94t9RtiJ_viZz8';
const supabase = createClient(url, key);

async function main() {
  const query = `
    SELECT
      tc.table_name, 
      kcu.column_name
    FROM 
      information_schema.table_constraints AS tc 
      JOIN information_schema.key_column_usage AS kcu
        ON tc.constraint_name = kcu.constraint_name
      JOIN information_schema.constraint_column_usage AS ccu
        ON ccu.constraint_name = tc.constraint_name
    WHERE constraint_type = 'FOREIGN KEY' AND ccu.table_name='outlets';
  `;
  const { data, error } = await supabase.rpc('exec_sql', { query });
  
  if (error) {
    console.error('RPC failed, trying raw query via pg or rest:', error);
  } else {
    console.log('Foreign keys:', data);
  }
}

main();
