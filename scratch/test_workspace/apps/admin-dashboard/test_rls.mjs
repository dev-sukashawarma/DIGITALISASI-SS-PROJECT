import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

async function run() {
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
  
  // No auth, so RLS should block this
  const { data, error } = await supabase.from('owner_messages').insert({
    sender_id: null,
    kind: 'motivasi',
    title: 'Testing RLS Violation',
    body: 'This should be blocked',
    target_type: 'all',
    expires_at: null
  });
  
  console.log("Insert Message result without auth:", data, error);
}
run();
