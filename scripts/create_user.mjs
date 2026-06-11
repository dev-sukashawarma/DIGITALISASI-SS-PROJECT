import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load .env.local
dotenv.config({ path: join(__dirname, '../apps/absensi/.env.local') });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceKey) {
  console.error("Missing Supabase URL or Service Key in .env.local");
  process.exit(1);
}

const supabase = createClient(url, serviceKey);

async function main() {
  const args = process.argv.slice(2);
  if (args.length < 5) {
    console.log("Usage: node create_user.mjs <email> <password> <name> <role> <outlet_uuid>");
    process.exit(1);
  }

  const [email, password, name, role, outlet_id] = args;

  console.log(`Creating user: ${email}...`);
  
  // 1. Create Auth User
  const { data: authData, error: authError } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });

  if (authError) {
    console.error("Failed to create auth user:", authError.message);
    process.exit(1);
  }

  const userId = authData.user.id;
  console.log(`Auth user created with ID: ${userId}`);

  // 2. Insert into outlet_staff
  console.log(`Linking user to outlet ${outlet_id}...`);
  const { error: staffError } = await supabase.from('outlet_staff').insert({
    id: userId,
    outlet_id: outlet_id,
    name: name,
    role: role,
    status: 'active'
  });

  if (staffError) {
    console.error("Failed to insert into outlet_staff:", staffError.message);
    // Cleanup auth user
    await supabase.auth.admin.deleteUser(userId);
    process.exit(1);
  }

  console.log("✅ User created and linked successfully!");
}

main();
