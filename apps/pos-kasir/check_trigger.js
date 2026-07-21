require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const query = `
SELECT p.proname, pg_get_functiondef(p.oid) 
FROM pg_proc p 
WHERE pg_get_functiondef(p.oid) ILIKE '%ledger_stok%'
  AND p.proname NOT ILIKE 'ledger_stamp_saldo';
`;
supabase.rpc('exec_sql', { sql: query }).then(r => console.log(r)).catch(e => {
  fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/rpc/exec_sql`, {
      method: 'POST',
      headers: {
          'Content-Type': 'application/json',
          'apikey': process.env.SUPABASE_SERVICE_ROLE_KEY,
          'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`
      },
      body: JSON.stringify({ sql: query })
  }).then(res => res.json()).then(console.log);
});
