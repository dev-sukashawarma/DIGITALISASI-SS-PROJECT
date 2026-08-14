import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  const { data, error } = await supabase.rpc('send_owner_message', {
    p_kind: 'motivasi',
    p_title: 'Title',
    p_body: 'Body',
    p_target_type: 'all',
    p_outlet_ids: ['00000000-0000-0000-0000-000000000000'],
    p_expires_at: null
  });
  console.log("Send msg result:", data, error);
}
run();
