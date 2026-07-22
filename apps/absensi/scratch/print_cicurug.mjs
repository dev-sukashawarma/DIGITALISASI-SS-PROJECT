import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://khpkoreaaucvyqfhynfq.supabase.co';
const serviceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtocGtvcmVhYXVjdnlxZmh5bmZxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MDk2MzI5MiwiZXhwIjoyMDk2NTM5MjkyfQ.Dy0QMAHfB8EU9BK-JuyRrBidpG6iM94t9RtiJ_viZz8';

const admin = createClient(supabaseUrl, serviceKey);

async function run() {
  const { data: outlets } = await admin.from('outlets').select('*').ilike('name', '%cicurug%');
  console.log('CICURUG OUTLET DETAIL:', JSON.stringify(outlets, null, 2));

  if (outlets && outlets.length > 0) {
    const cicurugId = outlets[0].id;
    const { data: attendance } = await admin.from('attendance').select('*').eq('outlet_id', cicurugId).order('created_at', { ascending: false }).limit(5);
    console.log('RECENT ATTENDANCE FOR CICURUG:', JSON.stringify(attendance, null, 2));
  }
}

run();
