const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(
  'https://khpkoreaaucvyqfhynfq.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtocGtvcmVhYXVjdnlxZmh5bmZxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MDk2MzI5MiwiZXhwIjoyMDk2NTM5MjkyfQ.Dy0QMAHfB8EU9BK-JuyRrBidpG6iM94t9RtiJ_viZz8'
);

async function run() {
  const { data: users, error: selectError } = await supabase.from('outlet_staff').select('id, name').eq('name', 'buddi');
  if (selectError) { console.error(selectError); return; }
  
  if (users && users.length > 0) {
    const userId = users[0].id;
    console.log("Found buddi ID:", userId);
    
    // Update outlet_staff
    const { error: updateError } = await supabase.from('outlet_staff').update({ username: 'buddi' }).eq('id', userId);
    if (updateError) { console.error("Update outlet_staff error:", updateError); }
    else { console.log("Updated outlet_staff username to buddi"); }

    // Update auth.users email (using admin API)
    const { error: authError } = await supabase.auth.admin.updateUserById(userId, { email: 'buddi@outlet.local' });
    if (authError) { console.error("Update auth.users error:", authError); }
    else { console.log("Updated auth.users email to buddi@outlet.local"); }
  } else {
    console.log("Buddi not found");
  }
}
run();
