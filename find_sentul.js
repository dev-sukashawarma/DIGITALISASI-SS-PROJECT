const url = 'https://khpkoreaaucvyqfhynfq.supabase.co';
const serviceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtocGtvcmVhYXVjdnlxZmh5bmZxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MDk2MzI5MiwiZXhwIjoyMDk2NTM5MjkyfQ.Dy0QMAHfB8EU9BK-JuyRrBidpG6iM94t9RtiJ_viZz8';

async function checkTable(tableName) {
  const query = `${url}/rest/v1/${tableName}`;
  const res = await fetch(query, {
    headers: {
      'apikey': serviceKey,
      'Authorization': `Bearer ${serviceKey}`
    }
  });
  
  if (res.ok) {
    const data = await res.json();
    const sentulOutletId = "43b7bbd1-1fd4-44b5-87ca-b07a271151af"; // MITRA SENTUL
    const matches = data.filter(d => d.outlet_id === sentulOutletId || (d.outlets && (d.outlets.name.includes("sentul") || d.outlets.name.includes("Sentul"))));
    if (matches.length > 0) {
      console.log(`\nStaff in MITRA SENTUL in ${tableName}:`);
      matches.forEach(m => {
        const minimal = { id: m.id, name: m.name, full_name: m.full_name, username: m.username, outlet_id: m.outlet_id, role: m.role };
        console.log(JSON.stringify(minimal));
      });
    }
  }
}

async function run() {
  await checkTable('outlet_staff');
}
run();
