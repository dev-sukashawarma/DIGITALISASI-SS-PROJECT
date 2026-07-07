import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://khpkoreaaucvyqfhynfq.supabase.co'
const SUPABASE_SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtocGtvcmVhYXVjdnlxZmh5bmZxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MDk2MzI5MiwiZXhwIjoyMDk2NTM5MjkyfQ.Dy0QMAHfB8EU9BK-JuyRrBidpG6iM94t9RtiJ_viZz8'

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
})

async function setupAllMitra() {
  const { data: outlets, error: outletError } = await supabase.from('outlets').select('*')
  if (outletError) {
    console.error('Error fetching outlets:', outletError)
    return
  }

  // Filter out HQ or non-operational if needed, but the user said "semuanya" (all).
  // We will exclude HQ and Kantor Pusat just in case, or we can include them.
  const validOutlets = outlets.filter(o => !o.name.includes('HQ') && !o.name.includes('Kantor Pusat'))

  console.log(`Processing ${validOutlets.length} outlets...`)

  for (const outlet of validOutlets) {
    // Extract region name
    let cleanName = outlet.name.replace(/MITRA |SUKA |SHAWARMA |\s*\(PUSAT\)\s*/gi, '').trim()
    if (!cleanName) cleanName = outlet.slug
    
    // Capitalize first letter of each word
    const displayName = cleanName.split(' ').map((w: string) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ')
    const area = cleanName.toLowerCase().replace(/\s+/g, '_')
    
    const email = `mitra_${area}@sukashawarma.com`
    const password = 'password123' // default password
    const username = `mitra_${area}`
    const mitraName = `Mitra ${displayName}`
    
    console.log(`\n--- Setting up ${mitraName} for outlet ${outlet.name} ---`)
    console.log(`Email: ${email}, Username: ${username}`)

    let userId = null

    // 1. Check if user exists by email
    const { data: { users }, error: listError } = await supabase.auth.admin.listUsers()
    if (listError) {
      console.error('Error listing users:', listError)
      continue
    }

    const existingUser = users.find(u => u.email === email)
    if (existingUser) {
      console.log('User found in auth. Updating password...')
      userId = existingUser.id
      const { error: updateError } = await supabase.auth.admin.updateUserById(userId, {
        password: password,
        email_confirm: true
      })
      if (updateError) console.error('Error updating password:', updateError)
    } else {
      console.log('User not found. Creating user in auth...')
      const { data: createData, error: createError } = await supabase.auth.admin.createUser({
        email: email,
        password: password,
        email_confirm: true
      })
      if (createError) {
        console.error('Error creating user:', createError)
        continue
      }
      userId = createData.user.id
    }

    // 2. Check if staff exists
    const { data: existingStaff, error: staffError } = await supabase
      .from('outlet_staff')
      .select('*')
      .eq('id', userId)
      .single()

    if (existingStaff) {
      console.log('Staff found in outlet_staff. Updating...')
      const { error: updateStaffError } = await supabase
        .from('outlet_staff')
        .update({ role: 'mitra', outlet_id: outlet.id })
        .eq('id', userId)
      if (updateStaffError) console.error('Error updating staff:', updateStaffError)
      else console.log('Staff updated successfully.')
    } else {
      console.log('Staff not found. Inserting into outlet_staff...')
      const { error: insertError } = await supabase
        .from('outlet_staff')
        .insert({
          id: userId,
          outlet_id: outlet.id,
          name: mitraName,
          username: username,
          role: 'mitra',
          is_active: true
        })
      if (insertError) console.error('Error inserting staff:', insertError)
      else console.log('Staff created successfully.')
    }
  }

  console.log('\nAll done!')
}

setupAllMitra().catch(console.error)
