
require('dotenv').config({ path: 'apps/admin-dashboard/.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://khpkoreaaucvyqfhynfq.supabase.co';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

async function main() {
  const query = "SELECT 1 as test;";
  
  try {
    const res = await fetch(`${supabaseUrl}/pg-meta/default/query`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseServiceKey}`,
        'apikey': supabaseServiceKey
      },
      body: JSON.stringify({ query })
    });
    
    if (res.ok) {
      const data = await res.json();
      console.log('Success:', data);
    } else {
      const text = await res.text();
      console.error('Failed:', res.status, text);
    }
  } catch (err) {
    console.error('Error:', err.message);
  }
}

main();
