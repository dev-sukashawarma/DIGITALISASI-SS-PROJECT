require('dotenv').config({ path: 'apps/admin-dashboard/.env.local' })

async function test() {
  const res = await fetch(process.env.NEXT_PUBLIC_SUPABASE_URL + '/rest/v1/rpc/pos_revenue_summary_guarded', {
    method: 'POST',
    headers: {
      'apikey': process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      'Authorization': 'Bearer ' + process.env.SUPABASE_SERVICE_ROLE_KEY,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      p_outlet_id: 'ba9c84cb-3bf8-466d-a60d-03cc3e6c3821',
      p_start: '2026-08-18T17:00:00.000Z',
      p_end: '2026-08-19T17:00:00.000Z',
      p_include_null_channel: false
    })
  });
  console.log(res.status, await res.text());
}
test();
