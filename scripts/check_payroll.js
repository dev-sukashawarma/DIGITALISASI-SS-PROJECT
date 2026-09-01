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
  const { data, error } = await sb.from('payroll_slips').select('*').limit(1);
  if (error) {
    console.log("No payroll_slips table. Trying 'payrolls'...");
    const { data: d2, error: e2 } = await sb.from('payrolls').select('*').limit(1);
    console.log("payrolls table:", e2 ? e2.message : "Exists!");
  } else {
    console.log("payroll_slips table exists!");
  }
}

main();
