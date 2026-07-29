import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
async function run() {
  const { data, error } = await supabase.from('menu_items').select(`
    name, 
    hpp_override,
    is_package,
    package_items:menu_packages!package_id (
        quantity,
        component:menu_items!menu_item_id ( hpp_override )
    )
  `).ilike('name', '%Suka duo Favorite%');
  console.log(JSON.stringify(data, null, 2), error);
}
run();
