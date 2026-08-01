const { createClient } = require('@supabase/supabase-js');
const url = 'https://khpkoreaaucvyqfhynfq.supabase.co';
const serviceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtocGtvcmVhYXVjdnlxZmh5bmZxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MDk2MzI5MiwiZXhwIjoyMDk2NTM5MjkyfQ.Dy0QMAHfB8EU9BK-JuyRrBidpG6iM94t9RtiJ_viZz8';

const admin = createClient(url, serviceKey);

async function run() {
  // Find user Zaki
  const { data: users, error: userError } = await admin
    .from('outlet_staff')
    .select('id, name, username, outlet_id')
    .ilike('username', '%zaki%');

  if (userError || !users || users.length === 0) {
    console.log("User 'zaki' not found:", userError);
    return;
  }
  const zaki = users[0];
  console.log("Found user:", zaki);

  // Find Dramaga outlet
  const { data: outlets, error: outletError } = await admin
    .from('outlets')
    .select('id, name')
    .ilike('name', '%Dramaga%');

  if (outletError || !outlets || outlets.length === 0) {
    console.log("Outlet 'Dramaga' not found:", outletError);
    return;
  }
  const dramaga = outlets[0];
  console.log("Found outlet:", dramaga);

  console.log(`Adding ${zaki.name} to ${dramaga.name}...`);
  
  const { error: insertError } = await admin.from('staff_outlets').insert({
    staff_id: zaki.id,
    outlet_id: dramaga.id
  });

  if (insertError) {
    if (insertError.code === '23505') {
      console.log("User is already assigned to Dramaga.");
    } else {
      console.error("Error inserting:", insertError);
    }
  } else {
    console.log(`Successfully added ${zaki.name} to ${dramaga.name}!`);
  }
}
run();
