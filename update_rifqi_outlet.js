const url = 'https://khpkoreaaucvyqfhynfq.supabase.co';
const serviceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtocGtvcmVhYXVjdnlxZmh5bmZxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MDk2MzI5MiwiZXhwIjoyMDk2NTM5MjkyfQ.Dy0QMAHfB8EU9BK-JuyRrBidpG6iM94t9RtiJ_viZz8';

async function fixRifqi() {
  const staffId = 'fcdb3ada-0850-49da-b057-68f65cdbd743';
  const sentulId = '43b7bbd1-1fd4-44b5-87ca-b07a271151af';
  const pajajaranId = '550e8400-e29b-41d4-a716-446655440009';

  // 1. Delete Sentul entry
  const delRes = await fetch(`${url}/rest/v1/staff_outlets?staff_id=eq.${staffId}&outlet_id=eq.${sentulId}`, {
    method: 'DELETE',
    headers: {
      'apikey': serviceKey,
      'Authorization': `Bearer ${serviceKey}`
    }
  });
  console.log("Delete Sentul:", delRes.status, await delRes.text());

  // 2. Insert Pajajaran entry
  const insRes = await fetch(`${url}/rest/v1/staff_outlets`, {
    method: 'POST',
    headers: {
      'apikey': serviceKey,
      'Authorization': `Bearer ${serviceKey}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=representation'
    },
    body: JSON.stringify({
      staff_id: staffId,
      outlet_id: pajajaranId
    })
  });
  console.log("Insert Pajajaran:", insRes.status, await insRes.text());
  
  // 3. Update outlet_staff just in case (though it was already Pajajaran, let's just make sure)
  const upRes = await fetch(`${url}/rest/v1/outlet_staff?id=eq.${staffId}`, {
    method: 'PATCH',
    headers: {
      'apikey': serviceKey,
      'Authorization': `Bearer ${serviceKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      outlet_id: pajajaranId
    })
  });
  console.log("Update outlet_staff:", upRes.status, await upRes.text());
}

fixRifqi();
