const url = 'https://khpkoreaaucvyqfhynfq.supabase.co';
const serviceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtocGtvcmVhYXVjdnlxZmh5bmZxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MDk2MzI5MiwiZXhwIjoyMDk2NTM5MjkyfQ.Dy0QMAHfB8EU9BK-JuyRrBidpG6iM94t9RtiJ_viZz8';

async function getOutlets() {
  const query = `${url}/rest/v1/outlets?select=id,name`;
  const res = await fetch(query, {
    headers: {
      'apikey': serviceKey,
      'Authorization': `Bearer ${serviceKey}`
    }
  });
  
  if (res.ok) {
    const data = await res.json();
    console.log(data.filter(o => o.name.toLowerCase().includes('test') || o.name.toLowerCase().includes('tes')));
  } else {
    console.log(await res.text());
  }
}

getOutlets();
