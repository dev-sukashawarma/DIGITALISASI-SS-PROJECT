const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'http://localhost:54321'; // mock
const SUPABASE_KEY = 'mock';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const chan1 = supabase.channel('test');
const chan2 = supabase.channel('test');

console.log('Same channel?', chan1 === chan2);
