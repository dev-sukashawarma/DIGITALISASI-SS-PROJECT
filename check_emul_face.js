const url = 'https://khpkoreaaucvyqfhynfq.supabase.co';
const serviceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtocGtvcmVhYXVjdnlxZmh5bmZxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MDk2MzI5MiwiZXhwIjoyMDk2NTM5MjkyfQ.Dy0QMAHfB8EU9BK-JuyRrBidpG6iM94t9RtiJ_viZz8';

async function run() {
  const staffId = '5f472dc3-df8f-4990-a5cc-d53f1f6ae0b6'; // Emul Mulyana
  const query = `${url}/rest/v1/outlet_staff?id=eq.${staffId}`;
  const res = await fetch(query, {
    headers: {
      'apikey': serviceKey,
      'Authorization': `Bearer ${serviceKey}`
    }
  });
  
  const data = await res.json();
  if (data.length > 0) {
    const d = data[0];
    console.log("Emul face_descriptor exists?", Array.isArray(d.face_descriptor) && d.face_descriptor.length > 0);
    console.log("Length if exists:", d.face_descriptor ? d.face_descriptor.length : 0);
    console.log("face_descriptor_mobile exists?", Array.isArray(d.face_descriptor_mobile) && d.face_descriptor_mobile.length > 0);
  }
}
run();
