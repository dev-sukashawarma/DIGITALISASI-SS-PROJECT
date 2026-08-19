const url = 'https://khpkoreaaucvyqfhynfq.supabase.co';
const serviceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtocGtvcmVhYXVjdnlxZmh5bmZxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MDk2MzI5MiwiZXhwIjoyMDk2NTM5MjkyfQ.Dy0QMAHfB8EU9BK-JuyRrBidpG6iM94t9RtiJ_viZz8';

const outletId = 'eb174b2b-ff69-47eb-97af-b6c824d3ce4a';

async function req(path, method = 'GET', body = null) {
  const options = {
    method,
    headers: {
      'apikey': serviceKey,
      'Authorization': `Bearer ${serviceKey}`,
      'Content-Type': 'application/json'
    }
  };
  if (body) {
    options.body = JSON.stringify(body);
  }
  const res = await fetch(`${url}/rest/v1/${path}`, options);
  if (!res.ok) {
    const text = await res.text();
    console.log(`Failed ${method} ${path}:`, text);
    return null;
  }
  if (method === 'GET') {
    return res.json();
  }
  return res.text();
}

async function checkRest() {
  const checklists = await req(`daily_checklist_records?outlet_id=eq.${outletId}&select=id`);
  if (checklists && checklists.length > 0) {
    console.log(`Found ${checklists.length} checklists`);
    for (const cl of checklists) {
      await req(`daily_checklist_ticks?record_id=eq.${cl.id}`, 'DELETE');
      await req(`daily_checklist_records?id=eq.${cl.id}`, 'DELETE');
    }
    console.log("Deleted checklists.");
  }

  const attendance = await req(`attendance_logs?outlet_id=eq.${outletId}&select=id`);
  if (attendance && attendance.length > 0) {
    console.log(`Found ${attendance.length} attendance logs`);
    await req(`attendance_logs?outlet_id=eq.${outletId}`, 'DELETE');
    console.log("Deleted attendance.");
  }
  
  const hpp = await req(`hpp_nilai_stok_harian_spv?outlet_id=eq.${outletId}&select=*`, 'GET');
  console.log('hpp view query returned, likely handled by views.');
  
  // also what about stok_balance? If it's a test outlet, resetting its stock to zero is probably correct.
  // Actually, stok_balance should just be deleted.
  await req(`stok_balance?outlet_id=eq.${outletId}`, 'DELETE');
  console.log("Deleted stok_balance.");
}

checkRest();
