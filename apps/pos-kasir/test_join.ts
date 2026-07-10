import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function test() {
  const { data, error } = await supabase
    .from('orders')
    .select('*, order_items(*, menu_items(image_url))')
    .limit(1);
    
  if (error) {
    console.error("Join error:", error.message);
  } else {
    console.log("Success! Data:", JSON.stringify(data[0]?.order_items, null, 2));
  }
}

test();
