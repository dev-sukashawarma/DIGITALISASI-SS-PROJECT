const url = 'https://khpkoreaaucvyqfhynfq.supabase.co';
const serviceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtocGtvcmVhYXVjdnlxZmh5bmZxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MDk2MzI5MiwiZXhwIjoyMDk2NTM5MjkyfQ.Dy0QMAHfB8EU9BK-JuyRrBidpG6iM94t9RtiJ_viZz8';

async function checkCols(table) {
  const query = `${url}/rest/v1/${table}?limit=1`;
  const res = await fetch(query, {
    headers: {
      'apikey': serviceKey,
      'Authorization': `Bearer ${serviceKey}`
    }
  });
  if (res.ok) {
    const data = await res.json();
    if (data.length > 0) {
      console.log(`${table} columns:`, Object.keys(data[0]));
    } else {
      console.log(`${table} is empty.`);
    }
  }
}

async function run() {
  await checkCols('cash_location');
  await checkCols('cash_balance');
  await checkCols('mutasi_antar_outlet');
}

run();
