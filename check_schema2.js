import dotenv from 'dotenv';
dotenv.config({ path: 'apps/admin-dashboard/.env.local' });

async function check() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const res = await fetch(`${supabaseUrl}/rest/v1/?apikey=${supabaseKey}`);
  const spec = await res.json();
  
  const tables = ['attendance_logs', 'shifts', 'cash_transaction', 'petty_cash_expenses', 'orders', 'hr_cash_advances'];
  
  for (const table of tables) {
     if (spec.paths['/' + table]) {
        const methods = spec.paths['/' + table];
        if (methods.get && methods.get.parameters) {
            const columns = methods.get.parameters.filter(p => p.in === 'query').map(p => p.name);
            console.log(`\nTable ${table} columns:\n`, columns.filter(c => !c.includes('.') && c !== 'select' && c !== 'order' && c !== 'limit' && c !== 'offset'));
        }
     }
  }
}
check();
