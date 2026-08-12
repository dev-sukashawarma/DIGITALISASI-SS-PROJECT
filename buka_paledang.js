const crypto = require('crypto');
const k = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtocGtvcmVhYXVjdnlxZmh5bmZxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MDk2MzI5MiwiZXhwIjoyMDk2NTM5MjkyfQ.Dy0QMAHfB8EU9BK-JuyRrBidpG6iM94t9RtiJ_viZz8';
const headers = { 'apikey': k, 'Authorization': 'Bearer ' + k, 'Content-Type': 'application/json', 'Prefer': 'return=representation' };
const outletId = '550e8400-e29b-41d4-a716-446655440003';
const staffId = '5f472dc3-df8f-4990-a5cc-d53f1f6ae0b6';
const today = '2026-08-10';

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
  console.log('1. Inserting attendance IN for Paledang staff...');
  const attRes = await safeFetch('https://khpkoreaaucvyqfhynfq.supabase.co/rest/v1/attendance', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      id: crypto.randomUUID(),
      outlet_id: outletId,
      outlet_staff_id: staffId,
      type: 'in',
      ts_server: new Date().toISOString(),
      ts_client: new Date().toISOString(),
      status: 'telat',
      is_manual_button: true
    })
  });
  console.log('Attendance insert status:', attRes.status, await attRes.json());

  console.log('2. Bypassing daily checklist...');
  let recRes = await safeFetch(`https://khpkoreaaucvyqfhynfq.supabase.co/rest/v1/daily_checklist_records?outlet_id=eq.${outletId}&date=eq.${today}`, { headers });
  let recs = await recRes.json();
  let recordId;
  if (!recs || recs.length === 0) {
    const newRecRes = await safeFetch('https://khpkoreaaucvyqfhynfq.supabase.co/rest/v1/daily_checklist_records', {
      method: 'POST',
      headers,
      body: JSON.stringify({ id: crypto.randomUUID(), outlet_id: outletId, date: today })
    });
    const newRec = await newRecRes.json();
    recordId = newRec[0].id;
  } else {
    recordId = recs[0].id;
  }
  console.log('Checklist Record ID:', recordId);

  const itemsRes = await safeFetch('https://khpkoreaaucvyqfhynfq.supabase.co/rest/v1/checklist_items?select=id', { headers });
  const items = await itemsRes.json();
  const ticks = items.map(i => ({ record_id: recordId, item_id: i.id }));
  
  const ticksRes = await safeFetch('https://khpkoreaaucvyqfhynfq.supabase.co/rest/v1/daily_checklist_ticks', {
    method: 'POST',
    headers: { ...headers, 'Prefer': 'resolution=merge-duplicates' },
    body: JSON.stringify(ticks)
  });
  console.log('Checklist ticks status:', ticksRes.status);

  console.log('3. Inserting approved bypass requests for all staff...');
  const staffList = ['5f472dc3-df8f-4990-a5cc-d53f1f6ae0b6', '13733eb2-e9e8-4069-8f6c-f01f00a38b69', '757c12ae-f042-44c2-83bf-2d4dca9b3ddc'];
  for (const sid of staffList) {
    await safeFetch('https://khpkoreaaucvyqfhynfq.supabase.co/rest/v1/bypass_requests', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        id: crypto.randomUUID(),
        outlet_id: outletId,
        requested_by_name: 'Admin Auto Bypass',
        reason: 'Buka pos paledang',
        status: 'approved',
        requested_by: sid
      })
    });
  }
  console.log('Done bypassing all gates for Paledang!');
}

main().catch(console.error);
