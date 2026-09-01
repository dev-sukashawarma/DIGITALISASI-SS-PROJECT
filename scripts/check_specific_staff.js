const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const env = {};
try {
  fs.readFileSync(path.join(__dirname, '../apps/HR/.env.local'), 'utf8')
    .split('\n')
    .forEach(l => {
      const m = l.match(/^([^=]+)=(.*)$/);
      if (m) env[m[1].trim()] = m[2].trim().replace(/^['"]|['"]$/g, '');
    });
} catch (e) {
  process.exit(1);
}

const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

async function main() {
  console.log("=== CHECKING SPECIFIC STAFF ===\n");

  // 1. Abyansah
  const { data: aby } = await sb.from('outlet_staff').select('id, name, role, username, email, outlet_id').ilike('name', '%Abyansah%');
  console.log("Found Abyansah:", aby);

  // 2. rm@ss.com
  const { data: rm1 } = await sb.from('outlet_staff').select('id, name, role, username, email').eq('email', 'rm@ss.com');
  const { data: rm2 } = await sb.from('outlet_staff').select('id, name, role, username, email').eq('username', 'rm@ss.com');
  console.log("Found rm@ss.com by email:", rm1);
  console.log("Found rm@ss.com by username:", rm2);
  
  // also check if "Indra" exists just in case
  const { data: indra } = await sb.from('outlet_staff').select('id, name, role, username, email').ilike('name', '%Indra%');
  console.log("Found 'Indra' in DB:", indra);

  // 3. Muchtar
  const { data: muchtar } = await sb.from('outlet_staff').select('id, name, role, username, email, outlet_id').ilike('name', '%Muchtar%');
  console.log("Found Muchtar:", muchtar);
  
  // Get Outlets for reference
  const { data: outlets } = await sb.from('outlets').select('id, name').ilike('name', '%gudang pusat%');
  console.log("Gudang Pusat Outlets:", outlets);
}

main();
