const { createClient } = require('@supabase/supabase-js');
const url = 'https://khpkoreaaucvyqfhynfq.supabase.co';
const serviceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtocGtvcmVhYXVjdnlxZmh5bmZxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MDk2MzI5MiwiZXhwIjoyMDk2NTM5MjkyfQ.Dy0QMAHfB8EU9BK-JuyRrBidpG6iM94t9RtiJ_viZz8';

const admin = createClient(url, serviceKey);

async function run() {
  const outletId = '550e8400-e29b-41d4-a716-446655440003'; // Paledang
  
  const { data: allowedStaffData } = await admin
    .from("staff_outlets")
    .select("staff_id")
    .eq("outlet_id", outletId);
    
  const allowedStaffIds = (allowedStaffData || []).map((row) => row.staff_id);
  console.log("Allowed staff:", allowedStaffIds);

  let orQuery = `outlet_id.eq.${outletId},role.in.(spv,admin,owner,admin_hr,leader,korlap,regional_manager)`;
  if (allowedStaffIds.length > 0) {
    // using quotes in case uuid needs it? Let's try without first
    orQuery += `,id.in.(${allowedStaffIds.join(',')})`;
  }

  console.log("Query:", orQuery);

  const { data, error } = await admin
    .from("outlet_staff")
    .select("id, name")
    .or(orQuery);

  if (error) {
    console.error("Error:", error);
  } else {
    console.log("Success. Found candidates:", data.length);
    console.log(data.find(d => d.name.includes("Emul")));
  }
}
run();
