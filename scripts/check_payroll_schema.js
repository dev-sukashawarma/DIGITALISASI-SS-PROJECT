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
  const { data, error } = await sb.from('payroll_records').select('*').limit(1);
  if (error) {
    console.error("Error reading payroll_records:", error.message);
  } else {
    console.log("payroll_records schema/sample:");
    if (data.length > 0) {
      console.log(Object.keys(data[0]));
      console.log(data[0]);
    } else {
      console.log("Table is empty. Need to check structure via RPC or PostgREST error hint.");
      // Force an error to see column hints
      const res = await sb.from('payroll_records').select('non_existent_column').limit(1);
      console.log("Hint:", res.error);
    }
  }
}

main();
