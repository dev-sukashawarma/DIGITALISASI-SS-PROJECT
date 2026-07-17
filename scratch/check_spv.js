const { createClient } = require('@supabase/supabase-js');
const url = 'https://khpkoreaaucvyqfhynfq.supabase.co';
const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtocGtvcmVhYXVjdnlxZmh5bmZxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MDk2MzI5MiwiZXhwIjoyMDk2NTM5MjkyfQ.Dy0QMAHfB8EU9BK-JuyRrBidpG6iM94t9RtiJ_viZz8';

const supabase = createClient(url, key);

async function main() {
  console.log("Checking outlet_staff for spv@test.com...");
  const { data: staff, error: staffError } = await supabase
    .from('outlet_staff')
    .select('*')
    .eq('email', 'spv@test.com');
  
  console.log("Staff:", staff);
  console.log("Staff Error:", staffError);
  
  console.log("Checking user via admin api...");
  const { data: { users }, error: adminError } = await supabase.auth.admin.listUsers();
  if (adminError) {
    console.error("Admin Error:", adminError);
  } else {
    const user = users.find(u => u.email === 'spv@test.com');
    console.log("Auth User:", user);
  }
}
main().catch(console.error);
