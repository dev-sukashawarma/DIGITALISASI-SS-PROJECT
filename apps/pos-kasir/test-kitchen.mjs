import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const envContent = fs.readFileSync('../../.env', 'utf8');
const envVars = {};
envContent.split('\n').forEach(line => {
  const match = line.match(/^([^#\s]+)=(.*)$/);
  if (match) {
    envVars[match[1].trim()] = match[2].trim();
  }
});

const supabase = createClient(
  envVars.NEXT_PUBLIC_SUPABASE_URL,
  envVars.SUPABASE_SERVICE_ROLE_KEY || envVars.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function check() {
  console.log('Fetching outlets...');
  const { data: outlets, error: outletError } = await supabase.from('outlets').select('*');
  if (outletError) {
    console.error('Error fetching outlets:', outletError);
    return;
  }
  
  const kitchenOutlets = outlets.filter(o => o.name.toLowerCase().includes('kitchen'));
  console.log('Kitchen Outlets found:', kitchenOutlets.length);
  
  for (const outlet of kitchenOutlets) {
    console.log(`\n--- Outlet: ${outlet.name} (ID: ${outlet.id}) ---`);
    console.log('Fetching users for this outlet...');
    const { data: users, error: userError } = await supabase
      .from('users')
      .select('id, name, role, outlet_id, status')
      .eq('outlet_id', outlet.id);
      
    if (userError) {
      console.error('Error fetching users:', userError);
      continue;
    }
    
    console.log(`Users found in ${outlet.name}:`, users.length);
    if (users.length > 0) console.table(users);
  }
  
  console.log('\n--- Checking all users for kitchen role ---');
  const { data: allUsers } = await supabase.from('users').select('*');
  const kitchenUsers = (allUsers || []).filter(u => 
    (u.name && u.name.toLowerCase().includes('kitchen')) ||
    (u.role && u.role.toLowerCase().includes('kitchen'))
  );
  console.log('Users with "kitchen" in name or role:', kitchenUsers.length);
  if (kitchenUsers.length > 0) console.table(kitchenUsers);
}

check();
