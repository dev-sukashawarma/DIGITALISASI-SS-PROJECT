const axios = require('axios');
require('dotenv').config();
async function run() {
  const url = process.env.SUPABASE_URL + '/rest/v1/checklist_categories?outlet_id=in.%28550e8400-e29b-41d4-a716-446655440010%2C00000000-0000-0000-0000-000000000000%29&phase=eq.tutup&select=id,checklist_items(id,is_required)';
  console.log('Testing url:', url);
  try {
    const res = await axios.get(url, { headers: { apikey: process.env.SUPABASE_SERVICE_ROLE_KEY, Authorization: 'Bearer ' + process.env.SUPABASE_SERVICE_ROLE_KEY } });
    console.log(JSON.stringify(res.data, null, 2));
  } catch(e) {
    console.error(e.response ? e.response.data : e.message);
  }
}
run();
