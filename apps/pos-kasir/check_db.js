const url = 'https://khpkoreaaucvyqfhynfq.supabase.co';
const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtocGtvcmVhYXVjdnlxZmh5bmZxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MDk2MzI5MiwiZXhwIjoyMDk2NTM5MjkyfQ.Dy0QMAHfB8EU9BK-JuyRrBidpG6iM94t9RtiJ_viZz8';

async function run() {
  const checkRes = await fetch(`${url}/rest/v1/outlet_stock?outlet_id=eq.550e8400-e29b-41d4-a716-446655440001`, {
      headers: {
        'apikey': key,
        'Authorization': `Bearer ${key}`
      }
  });
  const data = await checkRes.json();
  console.log('Response:', data);
}
run();
