const { createClient } = require('@supabase/supabase-js');
const url = 'https://khpkoreaaucvyqfhynfq.supabase.co';
const serviceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtocGtvcmVhYXVjdnlxZmh5bmZxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MDk2MzI5MiwiZXhwIjoyMDk2NTM5MjkyfQ.Dy0QMAHfB8EU9BK-JuyRrBidpG6iM94t9RtiJ_viZz8';

const admin = createClient(url, serviceKey);

async function run() {
  const { data: users, error } = await admin
    .from('outlet_staff')
    .select('id, name, username, outlet_id')
    .ilike('username', '%agung%');

  if (error) {
    console.error("Error finding user:", error);
    return;
  }

  if (users.length === 0) {
    console.log("User 'agung' not found.");
    return;
  }

  console.log("Found matches:", users);

  const agung = users[0];
  const empangId = '550e8400-e29b-41d4-a716-446655440002';

  console.log(`Adding ${agung.name} to Empang...`);
  
  const { error: insertError } = await admin.from('staff_outlets').insert({
    staff_id: agung.id,
    outlet_id: empangId
  });

  if (insertError) {
    if (insertError.code === '23505') {
      console.log("User is already assigned to Empang.");
    } else {
      console.error("Error inserting:", insertError);
    }
  } else {
    console.log(`Successfully added ${agung.name} to Empang!`);
  }
}
run();
