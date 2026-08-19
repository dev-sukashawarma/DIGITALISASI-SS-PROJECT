const url = 'https://khpkoreaaucvyqfhynfq.supabase.co';
const serviceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtocGtvcmVhYXVjdnlxZmh5bmZxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MDk2MzI5MiwiZXhwIjoyMDk2NTM5MjkyfQ.Dy0QMAHfB8EU9BK-JuyRrBidpG6iM94t9RtiJ_viZz8';

async function checkAll() {
  const query = `${url}/rest/v1/outlet_staff`;
  const res = await fetch(query, {
    headers: {
      'apikey': serviceKey,
      'Authorization': `Bearer ${serviceKey}`
    }
  });
  
  if (res.ok) {
    const data = await res.json();
    const rifqis = data.filter(d => (d.name && d.name.toLowerCase().includes('rifqi')) || (d.username && d.username.toLowerCase().includes('rifqi')));
    console.log(rifqis);
  }
}

checkAll();
