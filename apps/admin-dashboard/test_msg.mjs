import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  // Let's create an RPC that just returns the error instead of throwing, or better, we can just login.
  const { data, error } = await supabase.rpc('send_owner_message', {
    p_kind: 'motivasi',
    p_title: 'Title',
    p_body: 'Body',
    p_target_type: 'all',
    p_outlet_ids: [],
    p_expires_at: null
  });
  console.log("Send msg result:", data, error);
}
run();
