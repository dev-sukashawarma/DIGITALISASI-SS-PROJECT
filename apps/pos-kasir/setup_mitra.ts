import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://khpkoreaaucvyqfhynfq.supabase.co'
const SUPABASE_SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtocGtvcmVhYXVjdnlxZmh5bmZxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MDk2MzI5MiwiZXhwIjoyMDk2NTM5MjkyfQ.Dy0QMAHfB8EU9BK-JuyRrBidpG6iM94t9RtiJ_viZz8'

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
})

async function setupMitra() {
  const email = 'mitra@sukashawarma.com'
  const password = 'test123'
  let userId = null

  console.log('Finding user...')
  const { data: { users }, error: listError } = await supabase.auth.admin.listUsers()
  if (listError) {
    console.error('Error listing users:', listError)
    return
  }

  const existingUser = users.find(u => u.email === email)
  
  if (existingUser) {
    console.log('User found. Updating password...')
    userId = existingUser.id
    const { error: updateError } = await supabase.auth.admin.updateUserById(userId, {
      password: password,
      email_confirm: true
    })
    if (updateError) {
      console.error('Error updating password:', updateError)
      return
    }
  } else {
    console.log('User not found. Creating user...')
    const { data: createData, error: createError } = await supabase.auth.admin.createUser({
      email: email,
      password: password,
      email_confirm: true
    })
    if (createError) {
      console.error('Error creating user:', createError)
      return
    }
    userId = createData.user.id
  }

  console.log('User ID:', userId)

  console.log('Checking outlet_staff table...')
  const { data: existingStaff, error: staffError } = await supabase
    .from('outlet_staff')
    .select('*')
    .eq('id', userId)
    .single()

  if (existingStaff) {
    console.log('Staff found. Updating role to mitra...')
    const { error: updateStaffError } = await supabase
      .from('outlet_staff')
      .update({ role: 'mitra' })
      .eq('id', userId)
      
    if (updateStaffError) console.error('Error updating staff:', updateStaffError)
    else console.log('Staff role updated to mitra.')
  } else {
    console.log('Staff not found. Inserting into outlet_staff...')
    const { error: insertError } = await supabase
      .from('outlet_staff')
      .insert({
        id: userId,
        name: 'Mitra',
        username: 'mitra',
        role: 'mitra',
        is_active: true
      })
      
    if (insertError) console.error('Error inserting staff:', insertError)
    else console.log('Staff created as mitra.')
  }
  
  console.log('Done.')
}

setupMitra().catch(console.error)
