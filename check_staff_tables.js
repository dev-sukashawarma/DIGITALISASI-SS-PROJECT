import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: 'apps/admin-dashboard/.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  const { data: tables, error } = await supabase.rpc('get_tables_and_columns_test');
  
  if (error) {
     console.error("RPC Error:", error);
     // Fallback: try getting all tables via pg_meta if possible?
     // We can just query known tables one by one.
  }
}

const tablesToCheck = [
  'attendance_logs', 'shifts', 'cash_transaction', 
  'petty_cash_expenses', 'hr_cash_advances', 'staff_financials', 'orders', 'daily_checklist_records', 'opname', 'leave_requests', 'payroll_records', 'staff_kpi', 'staff_warnings'
];

async function check() {
  for (const table of tablesToCheck) {
    const { data, error } = await supabase.from(table).select('*').limit(1);
    if (data && data.length > 0) {
      console.log(`Table ${table}:`, Object.keys(data[0]).filter(k => k.includes('staff') || k.includes('user') || k.includes('outlet')));
    } else if (data && data.length === 0) {
       // Need to insert a dummy or just use options? We can't easily get columns if empty via REST without doing a trick
       // Let's just do an OPTIONS request
       const res = await fetch(`${supabaseUrl}/rest/v1/${table}?limit=1`, {
         method: 'OPTIONS',
         headers: {
           apikey: supabaseKey,
           Authorization: `Bearer ${supabaseKey}`
         }
       });
       // Actually OPTIONS returns OpenAPI spec or something.
    }
  }
}
check();
