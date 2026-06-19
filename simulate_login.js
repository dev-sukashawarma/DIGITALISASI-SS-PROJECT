const url = 'https://khpkoreaaucvyqfhynfq.supabase.co';
// Use ANON key because portal uses browser client
const anonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtocGtvcmVhYXVjdnlxZmh5bmZxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA5NjMyOTIsImV4cCI6MjA5NjUzOTI5Mn0.RdsvP6OKs6aiRnqqd02BYiv5gzbh4uGqO88dapo0Gso';

async function run() {
  // 1. Sign In
  const signInRes = await fetch(`${url}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: {
      'apikey': anonKey,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ email: 'buddi@outlet.local', password: '123456' })
  });
  const signInData = await signInRes.json();
  
  if (signInData.error) {
    console.error("Sign In failed:", signInData.error_description);
    return;
  }
  
  console.log("Signed in as:", signInData.user.id);
  const token = signInData.access_token;
  
  // 2. getOutletStaff equivalent query
  // .select('id, outlet_id, name, role, status, ref_photo_url, username, outlets!outlet_staff_outlet_id_fkey(name)')
  const staffQuery = `${url}/rest/v1/outlet_staff?select=id,outlet_id,name,role,status,ref_photo_url,username,outlets!outlet_staff_outlet_id_fkey(name)&id=eq.${signInData.user.id}`;
  
  const staffRes = await fetch(staffQuery, {
    headers: {
      'apikey': anonKey,
      'Authorization': `Bearer ${token}`
    }
  });
  
  const staffData = await staffRes.text();
  console.log("getOutletStaff response:", staffRes.status, staffData);
}
run();
