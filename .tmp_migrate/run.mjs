import { Client } from 'pg';
import fs from 'fs';

// Cukup set PGPASSWORD = password database project Anda.
// Host/user/port diambil dari pooler-url tersimpan CLI (tanpa password).
const poolerUrl = fs.readFileSync('supabase/.temp/pooler-url','utf8').trim();
const u = new URL(poolerUrl);
const pw = process.env.PGPASSWORD;
if (!pw) { console.error('Set PGPASSWORD dulu (password database project).'); process.exit(2); }

const files = [
  'supabase/migrations/20260613000000_pos_kasir_checklist_gate.sql',
  'supabase/migrations/20260613000100_unify_profiles_into_outlet_staff.sql',
];

const client = new Client({
  host: u.hostname,
  port: Number(u.port || 5432),
  user: decodeURIComponent(u.username),
  password: pw,
  database: u.pathname.replace(/^\//,'') || 'postgres',
  ssl: { rejectUnauthorized: false },
});
await client.connect();
console.log('Connected to DB.');

for (const f of files) {
  const sql = fs.readFileSync(f, 'utf8');
  process.stdout.write(`\n>>> Applying ${f} ... `);
  try {
    await client.query(sql);
    console.log('OK');
  } catch (e) {
    console.log('FAILED');
    console.error('   ERROR:', e.message);
    if (e.where) console.error('   WHERE:', e.where);
    await client.end();
    process.exit(1);
  }
}

await client.end();
console.log('\nAll migrations applied successfully.');
