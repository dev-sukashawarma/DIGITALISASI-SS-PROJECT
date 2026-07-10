import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
supabase.from('menu_items').select('*').limit(1).then(res => {
  if (res.data && res.data.length > 0) {
    console.log(Object.keys(res.data[0]));
  } else {
    console.log('No data');
  }
}).catch(console.error);
