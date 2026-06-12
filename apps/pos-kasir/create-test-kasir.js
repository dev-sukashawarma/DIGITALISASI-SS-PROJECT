const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const envContent = fs.readFileSync('.env.local', 'utf-8');
const env = {};
envContent.split('\n').forEach(line => {
  const [key, ...value] = line.split('=');
  if (key && value.length > 0) {
    env[key.trim()] = value.join('=').trim().replace(/^"|"$/g, '');
  }
});

const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const email = 'kasir_tes@outlet.local';
  const password = 'password123';

  // 1. Check if outlet exists, if not create one
  let { data: outlets } = await supabase.from('outlets').select('id, name').limit(1);
  let outletId = null;
  let outletName = 'Cabang Testing';
  if (outlets && outlets.length > 0) {
    outletId = outlets[0].id;
    outletName = outlets[0].name;
  } else {
    const { data: newOutlet } = await supabase.from('outlets').insert({ name: 'Cabang Testing' }).select().single();
    outletId = newOutlet.id;
  }

  // 2. Create user via admin api
  const { data: user, error: userError } = await supabase.auth.admin.createUser({
    email: email,
    password: password,
    email_confirm: true
  });

  if (userError) {
    // If exists, just update password
    if (userError.message.includes('already exists')) {
      const { data: existingUsers } = await supabase.auth.admin.listUsers();
      const existingUser = existingUsers.users.find(u => u.email === email);
      if (existingUser) {
        await supabase.auth.admin.updateUserById(existingUser.id, { password });
        console.log(`Updated password for existing kasir: ${email}`);
      }
    } else {
      console.log('Error creating user:', userError);
      return;
    }
  } else {
    console.log(`Created new kasir: ${email}`);
  }

  // 3. Get User ID to assign profile
  const { data: allUsers } = await supabase.auth.admin.listUsers();
  const targetUser = allUsers.users.find(u => u.email === email);
  
  if (targetUser) {
    // 4. Update profile role to kasir and set outlet_id
    const { error: profileError } = await supabase.from('profiles').upsert({
      id: targetUser.id,
      role: 'kasir',
      outlet_id: outletId
    });
    if (profileError) console.log('Error updating profile:', profileError);
    else {
      console.log('--- AKUN KASIR SIAP ---');
      console.log('Username:', 'kasir_tes');
      console.log('Email:', email);
      console.log('Password:', password);
      console.log('Outlet ID:', outletId);
      console.log('Branch Name:', outletName);
    }
  }
}

run();
