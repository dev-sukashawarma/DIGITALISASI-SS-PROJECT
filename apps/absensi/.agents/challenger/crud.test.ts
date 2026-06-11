import { createClient } from '@supabase/supabase-js';
import { test, expect } from 'vitest';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://127.0.0.1:54321';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'fake-key';

test('Test checklist cascade deletion', async () => {
  const supabase = createClient(supabaseUrl, supabaseKey);
  console.log("Supabase URL:", supabaseUrl);
});
