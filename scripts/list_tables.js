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
  // trick to get all tables: call an invalid table and look at the hints, or query pg_tables via RPC if exists, but we can't easily.
  // let's just do a GET /rest/v1/?apikey=...
  const res = await fetch(`${env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/`, {
    headers: { 'apikey': env.SUPABASE_SERVICE_ROLE_KEY }
  });
  const data = await res.json();
  console.log("Tables:");
  Object.keys(data.paths).forEach(p => console.log(p));
}

main();
