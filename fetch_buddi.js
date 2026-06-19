const url = 'https://khpkoreaaucvyqfhynfq.supabase.co';
const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtocGtvcmVhYXVjdnlxZmh5bmZxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MDk2MzI5MiwiZXhwIjoyMDk2NTM5MjkyfQ.Dy0QMAHfB8EU9BK-JuyRrBidpG6iM94t9RtiJ_viZz8';

async function run() {
  // 1. Get users from Auth API
  const authRes = await fetch(`${url}/auth/v1/admin/users`, {
    headers: {
      'apikey': key,
      'Authorization': `Bearer ${key}`
    }
  });
  const authData = await authRes.json();
  const users = authData.users || [];
  
  let buddiUser = users.find(u => u.email && u.email.includes('buddi'));
  if (!buddiUser) {
    console.log("Buddi user not found in auth.users! Let's create him via REST API.");
    // Actually we can just create using the existing create_user.mjs later.
    return;
  }
  
  console.log("Found buddi in auth.users! ID:", buddiUser.id, "Email:", buddiUser.email);
  
  // 2. Check outlet_staff
  const staffRes = await fetch(`${url}/rest/v1/outlet_staff?id=eq.${buddiUser.id}`, {
    headers: {
      'apikey': key,
      'Authorization': `Bearer ${key}`
    }
  });
  const staffData = await staffRes.json();
  
  if (staffData.length === 0) {
    console.log("Buddi not in outlet_staff. Inserting now...");
    const outletsRes = await fetch(`${url}/rest/v1/outlets?select=id&limit=1`, {
      headers: {
        'apikey': key,
        'Authorization': `Bearer ${key}`
      }
    });
    const outlets = await outletsRes.json();
    const outlet_id = outlets[0].id;
    
    const insertRes = await fetch(`${url}/rest/v1/outlet_staff`, {
      method: 'POST',
      headers: {
        'apikey': key,
        'Authorization': `Bearer ${key}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation'
      },
      body: JSON.stringify({
        id: buddiUser.id,
        outlet_id: outlet_id,
        name: 'Buddi',
        role: 'owner',
        status: 'active',
        username: 'buddi'
      })
    });
    const insertData = await insertRes.json();
    console.log("Insert result:", insertData);
  } else {
    console.log("Buddi IS in outlet_staff. Data:", staffData);
    // Update username if missing
    const updateRes = await fetch(`${url}/rest/v1/outlet_staff?id=eq.${buddiUser.id}`, {
      method: 'PATCH',
      headers: {
        'apikey': key,
        'Authorization': `Bearer ${key}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        username: 'buddi',
        status: 'active'
      })
    });
    console.log("Updated username and status to active.");
  }
}
run();
