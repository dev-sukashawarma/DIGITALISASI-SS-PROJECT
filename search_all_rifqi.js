const url = 'https://khpkoreaaucvyqfhynfq.supabase.co';
const serviceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtocGtvcmVhYXVjdnlxZmh5bmZxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MDk2MzI5MiwiZXhwIjoyMDk2NTM5MjkyfQ.Dy0QMAHfB8EU9BK-JuyRrBidpG6iM94t9RtiJ_viZz8';

async function getTables() {
  const query = `${url}/rest/v1/?apikey=${serviceKey}`;
  const res = await fetch(query, {
    headers: {
      'Authorization': `Bearer ${serviceKey}`
    }
  });
  if (res.ok) {
    const data = await res.json();
    return data.definitions;
  }
  return null;
}

async function searchRifqi() {
  // Let's just query a few known tables that might hold user data
  const tables = ['staff', 'employee', 'karyawan', 'users', 'profiles', 'outlet_staff'];
  
  for (const table of tables) {
    const query = `${url}/rest/v1/${table}?select=*`;
    const res = await fetch(query, {
      headers: {
        'apikey': serviceKey,
        'Authorization': `Bearer ${serviceKey}`
      }
    });
    if (res.ok) {
      const data = await res.json();
      const matches = data.filter(d => JSON.stringify(d).toLowerCase().includes('rifqi'));
      if (matches.length > 0) {
        console.log(`Found in ${table}:`, matches.map(m => ({ id: m.id, name: m.name, username: m.username, outlet_id: m.outlet_id })));
      }
    }
  }
}

searchRifqi();
