require('dotenv').config({ path: '.env.local' });
const { Client } = require('pg');

const client = new Client({
  connectionString: process.env.NEXT_PUBLIC_SUPABASE_URL.replace('https://', 'postgres://postgres:').replace('.supabase.co', '') // wait, we don't have db password.
});
// wait, we don't have direct db connection string in env maybe.
// let's check .env.local
