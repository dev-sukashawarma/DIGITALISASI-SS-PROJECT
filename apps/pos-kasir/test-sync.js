
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
// just print to check envs
console.log('SUPABASE_URL:', process.env.NEXT_PUBLIC_SUPABASE_URL);
