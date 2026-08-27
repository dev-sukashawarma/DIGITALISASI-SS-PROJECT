import dotenv from 'dotenv';
dotenv.config({ path: 'apps/admin-dashboard/.env.local' });

async function check() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  const tables = ['attendance_logs', 'shifts', 'cash_transaction', 'petty_cash_expenses', 'orders', 'hr_cash_advances', 'staff_outlets', 'payroll_records', 'staff_kpi', 'leave_requests'];
  
  for (const table of tables) {
     const res = await fetch(`${supabaseUrl}/rest/v1/${table}?limit=1`, {
       headers: {
         apikey: supabaseKey,
         Authorization: `Bearer ${supabaseKey}`
       }
     });
     const data = await res.json();
     if (Array.isArray(data) && data.length > 0) {
        console.log(`\nTable ${table} keys:\n`, Object.keys(data[0]));
     } else if (Array.isArray(data) && data.length === 0) {
        // can't infer keys easily if empty, but maybe we can query pg_meta directly via SQL function?
        console.log(`\nTable ${table} is empty`);
     } else {
        console.log(`\nTable ${table} error:`, data);
     }
  }
}
check();
