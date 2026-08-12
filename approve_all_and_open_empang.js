const crypto = require('crypto');
const k = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtocGtvcmVhYXVjdnlxZmh5bmZxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MDk2MzI5MiwiZXhwIjoyMDk2NTM5MjkyfQ.Dy0QMAHfB8EU9BK-JuyRrBidpG6iM94t9RtiJ_viZz8';
const headers = { 'apikey': k, 'Authorization': 'Bearer ' + k, 'Content-Type': 'application/json', 'Prefer': 'return=representation' };

async function safeFetch(url, options = {}, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      const res = await fetch(url, options);
      return res;
    } catch (err) {
      if (i === retries - 1) throw err;
      await new Promise(r => setTimeout(r, 1000));
    }
  }
}

async function main() {
  const today = '2026-08-10';
  console.log('1. Approving ALL pending bypass_requests...');
  const pendingRes = await safeFetch('https://khpkoreaaucvyqfhynfq.supabase.co/rest/v1/bypass_requests?status=eq.pending', { headers });
  const pendingRequests = await pendingRes.json();
  console.log('Found pending requests:', pendingRequests.length);

  for (const req of pendingRequests) {
    const updateRes = await safeFetch(`https://khpkoreaaucvyqfhynfq.supabase.co/rest/v1/bypass_requests?id=eq.${req.id}`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({
        status: 'approved',
        resolved_at: new Date().toISOString()
      })
    });
    console.log(`Approved bypass request ${req.id} (${req.requested_by_name} - ${req.reason}):`, updateRes.status);
  }

  // 2. Open EMPANG outlet (550e8400-e29b-41d4-a716-446655440002) as well
  const empangId = '550e8400-e29b-41d4-a716-446655440002';
  const agungId = 'eb278581-f4db-466d-a76a-6e730beb6eac';

  console.log('2. Inserting attendance IN for Empang staff (Agung)...');
  const attRes = await safeFetch('https://khpkoreaaucvyqfhynfq.supabase.co/rest/v1/attendance', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      id: crypto.randomUUID(),
      outlet_id: empangId,
      outlet_staff_id: agungId,
      type: 'in',
      ts_server: new Date().toISOString(),
      ts_client: new Date().toISOString(),
      status: 'telat',
      is_manual_button: true
    })
  });
  console.log('Empang Attendance insert status:', attRes.status);

  console.log('3. Bypassing daily checklist for Empang...');
  let recRes = await safeFetch(`https://khpkoreaaucvyqfhynfq.supabase.co/rest/v1/daily_checklist_records?outlet_id=eq.${empangId}&date=eq.${today}`, { headers });
  let recs = await recRes.json();
  let recordId;
  if (!recs || recs.length === 0) {
    const newRecRes = await safeFetch('https://khpkoreaaucvyqfhynfq.supabase.co/rest/v1/daily_checklist_records', {
      method: 'POST',
      headers,
      body: JSON.stringify({ id: crypto.randomUUID(), outlet_id: empangId, date: today })
    });
    const newRec = await newRecRes.json();
    recordId = newRec[0].id;
  } else {
    recordId = recs[0].id;
  }

  const itemsRes = await safeFetch('https://khpkoreaaucvyqfhynfq.supabase.co/rest/v1/checklist_items?select=id', { headers });
  const items = await itemsRes.json();
  const ticks = items.map(i => ({ record_id: recordId, item_id: i.id }));

  await safeFetch('https://khpkoreaaucvyqfhynfq.supabase.co/rest/v1/daily_checklist_ticks', {
    method: 'POST',
    headers: { ...headers, 'Prefer': 'resolution=merge-duplicates' },
    body: JSON.stringify(ticks)
  });
  console.log('Empang Checklist bypassed!');

  console.log('4. Done! All pending requests approved and Empang opened.');
}

main().catch(console.error);
