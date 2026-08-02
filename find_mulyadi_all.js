const url = 'https://khpkoreaaucvyqfhynfq.supabase.co';
const serviceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtocGtvcmVhYXVjdnlxZmh5bmZxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MDk2MzI5MiwiZXhwIjoyMDk2NTM5MjkyfQ.Dy0QMAHfB8EU9BK-JuyRrBidpG6iM94t9RtiJ_viZz8';

async function run() {
  const query = `${url}/rest/v1/outlet_staff`;
  const res = await fetch(query, {
    headers: {
      'apikey': serviceKey,
      'Authorization': `Bearer ${serviceKey}`
    }
  });
  
  const data = await res.json();
  const mulyadi = data.filter(d => 
    (d.username && d.username.toLowerCase().includes('mulyadi')) || 
    (d.name && d.name.toLowerCase().includes('mulyadi'))
  );
  
  console.log("Mulyadi records:");
  mulyadi.forEach(m => {
    console.log(`- ID: ${m.id}`);
    console.log(`  Name: ${m.name}`);
    console.log(`  Username: ${m.username}`);
    console.log(`  Role: ${m.role}`);
    console.log(`  Primary Outlet ID: ${m.outlet_id}`);
    console.log(`  Allowed Outlets: ${JSON.stringify(m.allowed_outlets)}`);
  });
}
run();
