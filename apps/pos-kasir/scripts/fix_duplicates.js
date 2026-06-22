const { createClient } = require('@supabase/supabase-js');

const POS_URL = 'https://khpkoreaaucvyqfhynfq.supabase.co';
const POS_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtocGtvcmVhYXVjdnlxZmh5bmZxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MDk2MzI5MiwiZXhwIjoyMDk2NTM5MjkyfQ.Dy0QMAHfB8EU9BK-JuyRrBidpG6iM94t9RtiJ_viZz8';

const ORDER_URL = 'https://qntuhtkujpwudcpudwbj.supabase.co';
const ORDER_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFudHVodGt1anB3dWRjcHVkd2JqIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3OTI1MzI2NywiZXhwIjoyMDk0ODI5MjY3fQ.aYtkLDltwLjCoULF-i4Jgt_s3D8N5G9tHDDoEe2zju4';

const posDb = createClient(POS_URL, POS_KEY);
const orderDb = createClient(ORDER_URL, ORDER_KEY);

async function run() {
  console.log('1. Deleting duplicates in SS_ORDER (where pos_outlet_id IS NOT NULL)...');
  const { data: toDelete, error: delErr } = await orderDb.from('outlets').select('id').not('pos_outlet_id', 'is', null);
  if (toDelete && toDelete.length > 0) {
    for (let o of toDelete) {
      await orderDb.from('outlets').delete().eq('id', o.id);
    }
    console.log(`Deleted ${toDelete.length} duplicates.`);
  }

  console.log('2. Fetching POS Kasir outlets...');
  const { data: posOutlets } = await posDb.from('outlets').select('*');
  console.log('3. Fetching SS_ORDER existing outlets...');
  const { data: orderOutlets } = await orderDb.from('outlets').select('id, name');

  let matchCount = 0;
  for (const pos of posOutlets) {
    let cleanPosName = pos.name.toLowerCase().replace('mitra ', '').trim();
    
    // Find matching order outlet
    let match = orderOutlets.find(o => o.name.toLowerCase().replace('mitra ', '').trim() === cleanPosName);
    
    // If not exact match, try partial match
    if (!match) {
      match = orderOutlets.find(o => cleanPosName.includes(o.name.toLowerCase()) || o.name.toLowerCase().includes(cleanPosName));
    }

    if (match) {
      console.log(`Mapped POS [${pos.name}] => ORDER [${match.name}]`);
      await orderDb.from('outlets').update({ pos_outlet_id: pos.id }).eq('id', match.id);
      matchCount++;
    } else {
      console.log(`⚠️ No match found for POS outlet: ${pos.name}`);
      // if no match, we should just insert it as a new one (since it genuinely didn't exist in SS_ORDER before)
      let baseSlug = pos.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '');
      if (!baseSlug) baseSlug = 'outlet';
      
      let finalSlug = baseSlug;
      let slugCounter = 1;
      while (true) {
        const { data: checkSlug } = await orderDb.from('outlets').select('id').eq('slug', finalSlug).maybeSingle();
        if (!checkSlug) break;
        finalSlug = `${baseSlug}-${slugCounter}`;
        slugCounter++;
      }
      
      const payload = {
        name: pos.name, // new ones get ALL CAPS, but the old ones keep mixed case!
        address: pos.address || '-',
        phone_wa: pos.phone || '-',
        is_active: pos.is_active,
        type: pos.type === 'mitra' ? 'partner' : 'owned',
        open_hour: pos.open_hour ? pos.open_hour.substring(0, 5) + ':00' : '13:00:00',
        close_hour: pos.close_hour ? pos.close_hour.substring(0, 5) + ':00' : '22:00:00',
        pos_outlet_id: pos.id,
        updated_at: new Date().toISOString(),
        slug: finalSlug
      };

      await orderDb.from('outlets').insert(payload);
      console.log(`Inserted as new outlet.`);
    }
  }

  console.log(`✅ Fixed! Successfully matched and mapped ${matchCount} existing outlets.`);
}

run();
