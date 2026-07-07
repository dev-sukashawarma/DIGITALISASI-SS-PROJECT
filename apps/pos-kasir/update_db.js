const url = 'https://khpkoreaaucvyqfhynfq.supabase.co';
const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtocGtvcmVhYXVjdnlxZmh5bmZxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MDk2MzI5MiwiZXhwIjoyMDk2NTM5MjkyfQ.Dy0QMAHfB8EU9BK-JuyRrBidpG6iM94t9RtiJ_viZz8';

async function run() {
  const outRes = await fetch(`${url}/rest/v1/outlets?select=id,name`, { headers: { 'apikey': key, 'Authorization': `Bearer ${key}` } });
  const outlets = await outRes.json();
  const targets = outlets.filter(o => o.name.toLowerCase().includes('kitchen') || o.name.toLowerCase().includes('pusat') || o.name.toLowerCase().includes('hq'));
  
  const bbRes = await fetch(`${url}/rest/v1/bahan_baku?select=id`, { headers: { 'apikey': key, 'Authorization': `Bearer ${key}` } });
  const bahan_baku = await bbRes.json();
  
  for (const t of targets) {
      const inserts = bahan_baku.map(bb => ({
          outlet_id: t.id,
          bahan_baku_id: bb.id,
          saldo: 9999
      }));
      const upsertRes = await fetch(`${url}/rest/v1/stok_balance?on_conflict=outlet_id,bahan_baku_id`, {
          method: 'POST',
          headers: {
            'apikey': key,
            'Authorization': `Bearer ${key}`,
            'Content-Type': 'application/json',
            'Prefer': 'resolution=merge-duplicates,return=representation'
          },
          body: JSON.stringify(inserts)
      });
      const text = await upsertRes.text();
      try {
        const json = JSON.parse(text);
        console.log(`Response for ${t.name}: Upserted ${json.length}`);
      } catch (e) {
        console.log(`Error for ${t.name}:`, text);
      }
  }
}
run();
