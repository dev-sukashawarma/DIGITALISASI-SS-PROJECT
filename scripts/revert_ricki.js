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
  const rickiId = 'b7d6bc3f-11de-4764-8716-4c436326a60b';
  const pajajaranId = '550e8400-e29b-41d4-a716-446655440009';
  
  const { error } = await sb.from('outlet_staff').update({
    outlet_id: pajajaranId,
    role: 'leader'
  }).eq('id', rickiId);
  
  if (error) {
    console.error("Gagal mengembalikan Ricki:", error.message);
  } else {
    console.log("Berhasil mengembalikan Ricki Septiawanto ke SS Pajajaran sebagai Leader.");
  }
}

main();
