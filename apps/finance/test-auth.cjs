const { createClient } = require('@supabase/supabase-js');
const supabaseUrl = 'https://khpkoreaaucvyqfhynfq.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtocGtvcmVhYXVjdnlxZmh5bmZxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MDk2MzI5MiwiZXhwIjoyMDk2NTM5MjkyfQ.Dy0QMAHfB8EU9BK-JuyRrBidpG6iM94t9RtiJ_viZz8';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function run() {
  console.log("Creating test user...");
  const { data: user, error: userError } = await supabase.auth.admin.createUser({
    email: 'test_finance_admin@example.com',
    password: 'password123',
    email_confirm: true
  });
  if (userError) {
    console.log("User might exist", userError);
  }

  // Get user ID to insert into outlet_staff
  const { data: users } = await supabase.auth.admin.listUsers();
  const testUser = users.users.find(u => u.email === 'test_finance_admin@example.com');

  if (testUser) {
    // Insert into outlet_staff
    await supabase.from('outlet_staff').upsert({
      id: testUser.id,
      role: 'admin_finance',
      username: 'Test Finance Admin'
    });

    console.log("Logging in...");
    const client = createClient(supabaseUrl, 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtocGtvcmVhYXVjdnlxZmh5bmZxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA5NjMyOTIsImV4cCI6MjA5NjUzOTI5Mn0.RdsvP6OKs6aiRnqqd02BYiv5gzbh4uGqO88dapo0Gso');
    const { data: session, error: loginError } = await client.auth.signInWithPassword({
      email: 'test_finance_admin@example.com',
      password: 'password123'
    });
    
    if (loginError) {
      console.log("Login error", loginError);
      return;
    }

    console.log("Querying sales_daily_spv as admin_finance...");
    const { data, error } = await client.from('sales_daily_spv').select('*').limit(5);
    console.log("Result:", data ? data.length : "null", error);
    
    console.log("Querying outlets as admin_finance...");
    const { data: outData, error: outErr } = await client.from('outlets').select('id, name').limit(5);
    console.log("Outlets:", outData ? outData.length : "null", outErr);
  }
}
run();
