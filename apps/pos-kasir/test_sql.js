require('dotenv').config({ path: '.env.local' });

async function run() {
  const projectId = process.env.SUPABASE_PROJECT_ID;
  const token = process.env.SUPABASE_ACCESS_TOKEN;
  
  const res = await fetch(`https://api.supabase.com/v1/projects/${projectId}/query`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ query: 'SELECT 1 as test_val;' })
  });
  
  const text = await res.text();
  console.log("Status:", res.status);
  console.log("Response:", text);
}
run();
