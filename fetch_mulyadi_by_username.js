const url = 'https://khpkoreaaucvyqfhynfq.supabase.co';
const serviceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtocGtvcmVhYXVjdnlxZmh5bmZxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MDk2MzI5MiwiZXhwIjoyMDk2NTM5MjkyfQ.Dy0QMAHfB8EU9BK-JuyRrBidpG6iM94t9RtiJ_viZz8';

async function run() {
  const query = `${url}/rest/v1/outlet_staff?username=eq.mulyadi`;
  const res = await fetch(query, {
    headers: {
      'apikey': serviceKey,
      'Authorization': `Bearer ${serviceKey}`
    }
  });
  
  const data = await res.json();
  if (data.length > 0) {
    const rec = data[0];
    delete rec.face_descriptor;
    delete rec.face_descriptor_mobile;
    console.log(JSON.stringify(rec, null, 2));
  } else {
    console.log("Not found by username");
  }
}
run();
