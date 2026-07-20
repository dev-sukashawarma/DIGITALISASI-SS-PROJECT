const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkEmpang() {
  const { data, error } = await supabase
    .from('outlets')
    .select('id, name, address, lat, lng')
    .ilike('name', '%empang%');

  if (error) {
    console.error("Error fetching Empang outlet:", error);
  } else {
    console.log("Empang Outlet Data:", JSON.stringify(data, null, 2));
  }
}
checkEmpang();
