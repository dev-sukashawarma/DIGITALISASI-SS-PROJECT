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
  const { data: outlets } = await sb.from('outlets').select('id, name').ilike('name', '%backup%');
  console.log("Found backup outlets:", outlets);
  
  const { data: ricki } = await sb.from('outlet_staff').select('id, name, role, outlet_id').ilike('name', 'ricki');
  console.log("Found Ricki in DB:", ricki);
}

main();
