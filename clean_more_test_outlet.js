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

async function cleanMore() {
  // mutasi_antar_outlet_item
  // Get mutasi where asal or tujuan is the outlet
  const mutasiAsal = await req(`mutasi_antar_outlet?outlet_asal_id=eq.${outletId}&select=id`);
  const mutasiTujuan = await req(`mutasi_antar_outlet?outlet_tujuan_id=eq.${outletId}&select=id`);
  
  const mutasiIds = [...(mutasiAsal || []), ...(mutasiTujuan || [])].map(m => m.id);
  console.log(`Found ${mutasiIds.length} mutasi_antar_outlet records.`);
  
  for (const mid of mutasiIds) {
    await req(`mutasi_antar_outlet_item?mutasi_id=eq.${mid}`, 'DELETE');
    await req(`mutasi_antar_outlet?id=eq.${mid}`, 'DELETE');
  }

  // cash_location -> cash_balance
  const locations = await req(`cash_location?outlet_id=eq.${outletId}&select=id`);
  if (locations) {
    console.log(`Found ${locations.length} cash_locations.`);
    for (const loc of locations) {
      await req(`cash_balance?cash_location_id=eq.${loc.id}`, 'DELETE');
    }
  }
  
  // also delete attendance logs? The prompt says "hapus seluruh data transaksi". Usually attendance isn't transaction, but could be related to shifts.
  
  // wait, did I check ecommerce_sales?
  // Let's check ecommerce_sales schema.
  const ecom = await req(`ecommerce_sales?limit=1`);
  if (ecom && ecom.length > 0) {
    console.log('ecommerce_sales cols:', Object.keys(ecom[0]));
  }
}

cleanMore();
