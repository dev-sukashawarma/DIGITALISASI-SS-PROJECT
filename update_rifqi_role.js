const url = 'https://khpkoreaaucvyqfhynfq.supabase.co';
const serviceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtocGtvcmVhYXVjdnlxZmh5bmZxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MDk2MzI5MiwiZXhwIjoyMDk2NTM5MjkyfQ.Dy0QMAHfB8EU9BK-JuyRrBidpG6iM94t9RtiJ_viZz8';

async function updateRole() {
  const staffId = 'fcdb3ada-0850-49da-b057-68f65cdbd743';
  const pajajaranId = '550e8400-e29b-41d4-a716-446655440009';

  const upRes = await fetch(`${url}/rest/v1/outlet_staff?id=eq.${staffId}&outlet_id=eq.${pajajaranId}`, {
    method: 'PATCH',
    headers: {
      'apikey': serviceKey,
      'Authorization': `Bearer ${serviceKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      role: 'leader'
    })
  });
  console.log("Update outlet_staff status:", upRes.status, await upRes.text());
}

updateRole();
