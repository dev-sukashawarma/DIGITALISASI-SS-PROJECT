import dotenv from 'dotenv';
dotenv.config({ path: 'apps/admin-dashboard/.env.local' });

async function check() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const res = await fetch(`${supabaseUrl}/rest/v1/?apikey=${supabaseKey}`);
  const spec = await res.json();
  
  const relevantTables = [];
  
  for (const [path, methods] of Object.entries(spec.paths)) {
     if (methods.get && methods.get.parameters) {
        const table = path.substring(1); // remove leading slash
        const columns = methods.get.parameters
           .filter(p => p.in === 'query')
           .map(p => p.name);
           
        const hasStaffId = columns.includes('staff_id') || columns.includes('user_id');
        const hasOutletId = columns.includes('outlet_id');
        
        if (hasStaffId && hasOutletId) {
            relevantTables.push(table);
        }
     }
  }
  
  console.log("Tables with both staff_id/user_id and outlet_id:", relevantTables);
}
check();
