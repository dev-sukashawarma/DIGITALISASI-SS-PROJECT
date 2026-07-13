require('dotenv').config({ path: 'apps/pos-kasir/.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  console.log('Fetching outlets...');
  const { data: outlets, error: outletError } = await supabase.from('outlets').select('id');
  
  if (outletError) {
    console.error('Error fetching outlets:', outletError);
    return;
  }
  
  const outletIds = outlets.map(o => o.id).join(',');
  console.log(`Found ${outlets.length} outlets. Activating BOM automation for them...`);
  
  const { data, error } = await supabase.from('global_settings')
    .upsert({ key: 'bom_automation_allowed_outlets', value: outletIds }, { onConflict: 'key' });
    
  if (error) {
    console.error('Error updating global_settings:', error);
  } else {
    console.log('Successfully activated BOM automation for all outlets!');
  }
}

main();
