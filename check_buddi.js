const { createClient } = require('@supabase/supabase-js');
const url = 'https://khpkoreaaucvyqfhynfq.supabase.co';
const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtocGtvcmVhYXVjdnlxZmh5bmZxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MDk2MzI5MiwiZXhwIjoyMDk2NTM5MjkyfQ.Dy0QMAHfB8EU9BK-JuyRrBidpG6iM94t9RtiJ_viZz8';
const supabase = createClient(url, key);

async function check() {
  const { data: users, error: err1 } = await supabase.auth.admin.listUsers();
  console.log('Users in auth.users:');
  users.users.forEach(u => console.log(`- ${u.email} (id: ${u.id})`));

  const { data: staff, error: err2 } = await supabase.from('outlet_staff').select('*');
  console.log('\nStaff in outlet_staff:');
  staff.forEach(s => console.log(`- ${s.name} / ${s.username} (id: ${s.id})`));
}
check();
