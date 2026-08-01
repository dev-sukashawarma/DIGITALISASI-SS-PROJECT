const url = 'https://khpkoreaaucvyqfhynfq.supabase.co';
const serviceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtocGtvcmVhYXVjdnlxZmh5bmZxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MDk2MzI5MiwiZXhwIjoyMDk2NTM5MjkyfQ.Dy0QMAHfB8EU9BK-JuyRrBidpG6iM94t9RtiJ_viZz8';

async function run() {
  const staffId = 'eb2ad99d-0cc9-4853-84a1-8e3c914eff6f';
  const empangId = '550e8400-e29b-41d4-a716-446655440002'; // SUKA SHAWARMA EMPANG
  const paledangId = '550e8400-e29b-41d4-a716-446655440003'; // MITRA PALEDANG
  
  // 1. Update outlet_id in outlet_staff to Empang
  console.log("Updating outlet_id to Empang...");
  const updateRes = await fetch(`${url}/rest/v1/outlet_staff?id=eq.${staffId}`, {
    method: 'PATCH',
    headers: {
      'apikey': serviceKey,
      'Authorization': `Bearer ${serviceKey}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=representation'
    },
    body: JSON.stringify({ outlet_id: empangId })
  });
  
  if (!updateRes.ok) {
    console.error("Failed to update outlet_staff:", await updateRes.text());
    return;
  }
  console.log("Updated outlet_staff:", await updateRes.json());
  
  // 2. Add Empang and Paledang to staff_outlets
  const outletsToAdd = [empangId, paledangId];
  
  for (const oid of outletsToAdd) {
    console.log(`Adding outlet ${oid} to staff_outlets...`);
    const addRes = await fetch(`${url}/rest/v1/staff_outlets`, {
      method: 'POST',
      headers: {
        'apikey': serviceKey,
        'Authorization': `Bearer ${serviceKey}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation'
      },
      body: JSON.stringify({ staff_id: staffId, outlet_id: oid })
    });
    
    if (addRes.ok) {
      console.log(`Added outlet ${oid} successfully.`);
    } else {
      const err = await addRes.text();
      // Ignore conflict (already exists)
      if (err.includes('duplicate key value')) {
        console.log(`Outlet ${oid} already exists for this staff.`);
      } else {
        console.error(`Failed to add outlet ${oid}:`, err);
      }
    }
  }
}
run();
