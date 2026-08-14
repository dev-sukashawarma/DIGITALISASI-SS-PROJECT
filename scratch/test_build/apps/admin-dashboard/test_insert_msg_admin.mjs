import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

async function run() {
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
  
  // Login as admin
  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email: 'hr@sukashawarma.com',
    password: 'password123'
  });
  
  if(authError) {
    console.error("Login failed:", authError);
    return;
  }
  
  console.log("Logged in as:", authData.user.id);
  
  const { data, error } = await supabase.from('owner_messages').insert({
    sender_id: authData.user.id,
    kind: 'motivasi',
    title: 'Testing Direct Insert from Admin',
    body: 'This is a test body',
    target_type: 'all',
    expires_at: null
  });
  
  console.log("Insert Message result:", data, error);
}
run();
