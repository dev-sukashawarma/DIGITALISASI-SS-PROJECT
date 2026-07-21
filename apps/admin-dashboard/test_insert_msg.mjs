import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  const { data, error } = await supabase.from('owner_messages').insert({
    sender_id: null,
    kind: 'motivasi',
    title: 'Testing Direct Insert',
    body: 'This is a test body',
    target_type: 'all',
    expires_at: null
  });
  console.log("Insert Message result:", data, error);
}
run();
