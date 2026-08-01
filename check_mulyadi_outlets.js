const url = 'https://khpkoreaaucvyqfhynfq.supabase.co';
const serviceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtocGtvcmVhYXVjdnlxZmh5bmZxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MDk2MzI5MiwiZXhwIjoyMDk2NTM5MjkyfQ.Dy0QMAHfB8EU9BK-JuyRrBidpG6iM94t9RtiJ_viZz8';

async function run() {
  const staffId = 'eb2ad99d-0cc9-4853-84a1-8e3c914eff6f';
  const query = `${url}/rest/v1/staff_outlets?staff_id=eq.${staffId}&select=outlet_id,outlets(name)`;
  const res = await fetch(query, {
    headers: {
      'apikey': serviceKey,
      'Authorization': `Bearer ${serviceKey}`
    }
  });
  
  if (res.ok) {
    const data = await res.json();
    console.log("Mulyadi's current allowed outlets:", JSON.stringify(data, null, 2));
  } else {
    console.log("Failed:", res.status, res.statusText);
  }
}
run();
