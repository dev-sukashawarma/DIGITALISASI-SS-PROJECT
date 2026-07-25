const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const envContent = fs.readFileSync(path.join(__dirname, '../.env.local'), 'utf-8');
const env = {};
envContent.split('\n').forEach(line => {
  const [key, ...value] = line.split('=');
  if (key && value.length > 0) {
    env[key.trim()] = value.join('=').trim().replace(/^"|"$/g, '');
  }
});

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
});

async function main() {
  console.log('Fetching outlets...');
  const { data: outlets, error: outletErr } = await supabase.from('outlets').select('*');
  if (outletErr) {
    console.error('Error fetching outlets:', outletErr);
    return;
  }

  console.log('Outlets found:');
  outlets.forEach(o => console.log(`- ID: ${o.id} | Name: ${o.name}`));

  const pajajaran = outlets.find(o => o.name.toLowerCase().includes('pajajaran'));
  const paledang = outlets.find(o => o.name.toLowerCase().includes('paledang'));

  if (!pajajaran) {
    console.error('Outlet Pajajaran not found!');
  } else {
    console.log(`Found Pajajaran: ${pajajaran.name} (${pajajaran.id})`);
  }

  if (!paledang) {
    console.error('Outlet Paledang not found!');
  } else {
    console.log(`Found Paledang: ${paledang.name} (${paledang.id})`);
  }

  const usersToAdd = [
    { email: 'fadli@ss.com', password: 'test1234', outlet: pajajaran, name: 'Fadli', role: 'crew' },
    { email: 'jamaludin@ss.com', password: 'test1234', outlet: paledang, name: 'Jamaludin', role: 'crew' }
  ];

  for (const item of usersToAdd) {
    if (!item.outlet) {
      console.error(`Skipping ${item.email} because outlet is missing.`);
      continue;
    }

    console.log(`\n========================================`);
    console.log(`Processing: ${item.email} for Outlet: ${item.outlet.name}`);

    let userId = null;

    // Try creating user first
    const { data: createData, error: createError } = await supabase.auth.admin.createUser({
      email: item.email,
      password: item.password,
      email_confirm: true,
      user_metadata: { name: item.name, outlet_id: item.outlet.id }
    });

    if (createError) {
      console.log(`Create note for ${item.email}:`, createError.message);
      // If user already exists, we will update the password
      // To get the user, let's query profiles or try to generate a link/update via service role
      // Or we can query profiles table for this email/username
    } else {
      userId = createData.user.id;
      console.log(`User created in Auth with ID: ${userId}`);
    }

    // If create failed (e.g. user already exists), let's find user ID from profiles or auth
    if (!userId) {
      const username = item.email.split('@')[0];
      const { data: existingProfile } = await supabase
        .from('profiles')
        .select('id')
        .eq('username', username)
        .maybeSingle();

      if (existingProfile) {
        userId = existingProfile.id;
        console.log(`Found existing user ID from profiles: ${userId}`);
        const { error: updateError } = await supabase.auth.admin.updateUserById(userId, {
          password: item.password,
          email_confirm: true,
          user_metadata: { name: item.name, outlet_id: item.outlet.id }
        });
        if (updateError) console.error('Error updating password:', updateError);
        else console.log('Password updated successfully for existing user.');
      } else {
        // Try getting from outlet_staff
        const { data: existingStaff } = await supabase
          .from('outlet_staff')
          .select('id')
          .eq('username', username)
          .maybeSingle();

        if (existingStaff) {
          userId = existingStaff.id;
          console.log(`Found existing user ID from outlet_staff: ${userId}`);
          const { error: updateError } = await supabase.auth.admin.updateUserById(userId, {
            password: item.password,
            email_confirm: true,
            user_metadata: { name: item.name, outlet_id: item.outlet.id }
          });
          if (updateError) console.error('Error updating password:', updateError);
          else console.log('Password updated successfully for existing user.');
        }
      }
    }

    if (!userId) {
      console.error(`Could not resolve userId for ${item.email}`);
      continue;
    }

    // Upsert into outlet_staff
    const username = item.email.split('@')[0];
    const { error: staffErr } = await supabase.from('outlet_staff').upsert({
      id: userId,
      outlet_id: item.outlet.id,
      name: item.name,
      username: username,
      role: item.role,
      is_active: true
    });
    if (staffErr) console.log('Note on outlet_staff upsert:', staffErr.message);
    else console.log('outlet_staff record upserted successfully.');

    // Upsert into mitra_profiles if exists
    const { error: mitraErr } = await supabase.from('mitra_profiles').upsert({
      id: userId,
      outlet_id: item.outlet.id,
      username: username,
      role: item.role
    });
    if (mitraErr) console.log('Note on mitra_profiles upsert:', mitraErr.message);
    else console.log('mitra_profiles record upserted successfully.');
  }

  console.log('\n========================================');
  console.log('FINISHED! Users setup completed.');
}

main().catch(console.error);
