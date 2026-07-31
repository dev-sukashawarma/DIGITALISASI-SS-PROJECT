import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://khpkoreaaucvyqfhynfq.supabase.co';
const serviceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtocGtvcmVhYXVjdnlxZmh5bmZxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MDk2MzI5MiwiZXhwIjoyMDk2NTM5MjkyfQ.Dy0QMAHfB8EU9BK-JuyRrBidpG6iM94t9RtiJ_viZz8';

const admin = createClient(supabaseUrl, serviceKey);

async function checkMore() {
  const staffId = 'eb2ad99d-0cc9-4853-84a1-8e3c914eff6f'; // mulyadi

  const { data: health, error: errHealth } = await admin
    .from('system_health_log')
    .select('*')
    .limit(100);
    
  if (errHealth) console.log('error system_health_log', errHealth.message);
  else {
    const myHealth = health.filter(s => JSON.stringify(s).includes(staffId) || JSON.stringify(s).includes('mulyadi'));
    console.log('system_health_log for mulyadi:', JSON.stringify(myHealth, null, 2));
  }
}

checkMore();
