const url = 'https://khpkoreaaucvyqfhynfq.supabase.co';
const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtocGtvcmVhYXVjdnlxZmh5bmZxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA5NjMyOTIsImV4cCI6MjA5NjUzOTI5Mn0.RdsvP6OKs6aiRnqqd02BYiv5gzbh4uGqO88dapo0Gso';

async function test() {
  const outletsRes = await fetch(`${url}/rest/v1/outlets?select=id&limit=1`, {
    headers: { 'apikey': key, 'Authorization': `Bearer ${key}` }
  });
  const outlets = await outletsRes.json();
  const outletId = outlets[0].id;
  console.log('Outlet ID:', outletId);

  const p_start = new Date(0).toISOString();
  const p_end = new Date().toISOString();

  console.log('p_start:', p_start);
  console.log('p_end:', p_end);

  const res1 = await fetch(`${url}/rest/v1/rpc/get_outlet_analytics`, {
    method: 'POST',
    headers: { 'apikey': key, 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ p_outlet_id: outletId, p_start, p_end })
  });
  const data1 = await res1.json();
  console.log('get_outlet_analytics:', data1);

  const res2 = await fetch(`${url}/rest/v1/rpc/search_outlet_orders`, {
    method: 'POST',
    headers: { 'apikey': key, 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ p_outlet_id: outletId, p_start, p_end, p_search: '', p_limit: 1, p_offset: 0 })
  });
  const data2 = await res2.json();
  console.log('search_outlet_orders count:', data2.length > 0 ? data2[0] : 0);
}

test().catch(console.error);
