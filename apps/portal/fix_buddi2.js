const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(
  'https://khpkoreaaucvyqfhynfq.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtocGtvcmVhYXVjdnlxZmh5bmZxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MDk2MzI5MiwiZXhwIjoyMDk2NTM5MjkyfQ.Dy0QMAHfB8EU9BK-JuyRrBidpG6iM94t9RtiJ_viZz8'
);

async function run() {
  // 1. Get user 'buddi' from auth.users (actually, we have to list them)
  const { data: { users }, error: authError } = await supabase.auth.admin.listUsers();
  if (authError) {
    console.error("Auth error:", authError);
    return;
  }
  
  // They probably created buddi with email buddi@... or just username buddi. Let's find it.
  const buddiUser = users.find(u => u.email && u.email.includes('buddi'));
  if (!buddiUser) {
    console.log("Buddi user not found in auth.users!");
    // Create it?
    return;
  }
  
  console.log("Found buddi in auth.users! ID:", buddiUser.id, "Email:", buddiUser.email);
  
  // 2. Check if in outlet_staff
  const { data: staffData } = await supabase.from('outlet_staff').select('*').eq('id', buddiUser.id).single();
  if (!staffData) {
    console.log("Buddi not in outlet_staff. Inserting now...");
    // Just pick the first outlet for testing
    const { data: outlets } = await supabase.from('outlets').select('id').limit(1);
    const outlet_id = outlets[0].id;
    
    const { error: insertError } = await supabase.from('outlet_staff').insert({
      id: buddiUser.id,
      outlet_id: outlet_id,
      name: 'Buddi',
      role: 'owner',
      status: 'active',
      username: 'buddi'
    });
    if (insertError) {
      console.error("Insert error:", insertError);
    } else {
      console.log("Successfully inserted buddi into outlet_staff!");
    }
  } else {
    console.log("Buddi IS in outlet_staff. Data:", staffData);
    // Maybe update username?
    await supabase.from('outlet_staff').update({ username: 'buddi', status: 'active' }).eq('id', buddiUser.id);
  }
}
run();
