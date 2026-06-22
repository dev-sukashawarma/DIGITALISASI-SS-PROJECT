const { createClient } = require('@supabase/supabase-js');

const POS_URL = 'https://khpkoreaaucvyqfhynfq.supabase.co';
const POS_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtocGtvcmVhYXVjdnlxZmh5bmZxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MDk2MzI5MiwiZXhwIjoyMDk2NTM5MjkyfQ.Dy0QMAHfB8EU9BK-JuyRrBidpG6iM94t9RtiJ_viZz8';

const ORDER_URL = 'https://qntuhtkujpwudcpudwbj.supabase.co';
const ORDER_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFudHVodGt1anB3dWRjcHVkd2JqIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3OTI1MzI2NywiZXhwIjoyMDk0ODI5MjY3fQ.aYtkLDltwLjCoULF-i4Jgt_s3D8N5G9tHDDoEe2zju4';

const posDb = createClient(POS_URL, POS_KEY);
const orderDb = createClient(ORDER_URL, ORDER_KEY);

async function syncOutlets() {
  console.log('Fetching outlets from POS Kasir...');
  const { data: posOutlets, error: posError } = await posDb.from('outlets').select('*');
  
  if (posError) {
    console.error('Error fetching POS outlets:', posError);
    process.exit(1);
  }
  
  console.log(`Found ${posOutlets.length} outlets in POS Kasir. Synchronizing...`);

  let successCount = 0;
  
  for (const outlet of posOutlets) {
    let baseSlug = outlet.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '');
    if (!baseSlug) baseSlug = 'outlet';

    // Check if it already exists in ORDER by pos_outlet_id
    const { data: existing } = await orderDb
      .from('outlets')
      .select('id')
      .eq('pos_outlet_id', outlet.id)
      .maybeSingle();

    const payload = {
      name: outlet.name,
      address: outlet.address || '-',
      phone_wa: outlet.phone || '-',
      is_active: outlet.is_active,
      type: outlet.type === 'mitra' ? 'partner' : 'owned',
      open_hour: outlet.open_hour ? outlet.open_hour.substring(0, 5) + ':00' : '13:00:00',
      close_hour: outlet.close_hour ? outlet.close_hour.substring(0, 5) + ':00' : '22:00:00',
      pos_outlet_id: outlet.id,
      updated_at: new Date().toISOString()
    };

    if (existing) {
      console.log(`Updating existing outlet: ${outlet.name}`);
      const { error } = await orderDb.from('outlets').update(payload).eq('id', existing.id);
      if (error) {
        console.error(`Error updating ${outlet.name}:`, error);
      } else {
        successCount++;
      }
    } else {
      console.log(`Creating new outlet: ${outlet.name}`);
      // find unique slug
      let finalSlug = baseSlug;
      let slugCounter = 1;
      while (true) {
        const { data: checkSlug } = await orderDb.from('outlets').select('id').eq('slug', finalSlug).maybeSingle();
        if (!checkSlug) break;
        finalSlug = `${baseSlug}-${slugCounter}`;
        slugCounter++;
      }
      
      const { error } = await orderDb.from('outlets').insert({ ...payload, slug: finalSlug });
      if (error) {
        console.error(`Error creating ${outlet.name}:`, error);
      } else {
        successCount++;
      }
    }
  }

  console.log(`✅ Synchronization complete. Successfully synced ${successCount}/${posOutlets.length} outlets.`);
}

syncOutlets();
