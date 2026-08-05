import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

const adminClient = createClient(supabaseUrl, supabaseServiceKey)
const userClient = createClient(supabaseUrl, supabaseAnonKey)

async function testRealtime() {
  const email = `testfinance${Date.now()}@ss.com`
  const password = 'password123'
  
  console.log('Creating test user...')
  const { data: userData, error: userError } = await adminClient.auth.admin.createUser({
    email,
    password,
    email_confirm: true
  })
  if (userError) throw userError

  const userId = userData.user.id

  console.log('Assigning finance role...')
  const { data: outlets } = await adminClient.from('outlets').select('id').limit(1)
  if (outlets && outlets.length > 0) {
    const { error: upsertError } = await adminClient.from('outlet_staff').upsert({
      id: userId,
      email,
      name: 'Test Finance',
      role: 'admin_finance',
      outlet_id: outlets[0].id
    })
    if (upsertError) {
      console.error('Failed to create outlet_staff:', upsertError)
      throw upsertError
    } else {
      console.log('Successfully created outlet_staff record.')
    }
  } else {
    console.error('No outlets found, cannot create outlet_staff')
  }

  console.log('Logging in as test user...')
  const { data: sessionData, error: loginError } = await userClient.auth.signInWithPassword({
    email,
    password
  })
  if (loginError) throw loginError

  console.log('Logged in successfully. User ID from admin:', userId, 'User ID from session:', sessionData.user.id)
  console.log('Setting up realtime channel with userClient and adminClient...')
  
  // Test SELECT directly to see if RLS allows it
  const { data: adminStaffData, error: adminStaffError } = await adminClient.from('outlet_staff').select('*').eq('id', sessionData.user.id)
  console.log('Admin staff SELECT test:', adminStaffData, adminStaffError)

  const { data: staffData, error: staffError } = await userClient.from('outlet_staff').select('*')
  console.log('User staff SELECT test:', staffData)

  const { data: selectData, error: selectError } = await userClient.from('petty_cash_topups').select('id').limit(1)
  console.log('User SELECT test:', selectError ? selectError.message : `Success, found ${selectData?.length} rows`)

  const userChannel = userClient.channel('finance-global-user')
  const adminChannel = adminClient.channel('finance-global-admin')
  
  userChannel.on('postgres_changes', { event: '*', schema: 'public', table: 'petty_cash_topups' }, (payload) => {
    console.log('[USER] REALTIME EVENT RECEIVED:', payload)
  })
  adminChannel.on('postgres_changes', { event: '*', schema: 'public', table: 'petty_cash_topups' }, (payload) => {
    console.log('[ADMIN] REALTIME EVENT RECEIVED:', payload)
  })
  
  adminChannel.subscribe()
  userChannel.subscribe((status) => {
    console.log('User Channel status:', status)
    
    if (status === 'SUBSCRIBED') {
      console.log('Subscribed! Now mutating a row as admin...')
      // Wait a moment then update a row
      setTimeout(async () => {
        // Fetch one row
        const { data: row } = await adminClient.from('petty_cash_topups').select('id, amount').limit(1).single()
        if (row) {
          console.log(`Updating amount of row ${row.id} from ${row.amount} to ${Number(row.amount) + 1}...`)
          const { error } = await adminClient.from('petty_cash_topups').update({ amount: Number(row.amount) + 1 }).eq('id', row.id)
          if (error) console.error('Update failed:', error)
          else console.log('Update executed. Waiting for broadcast...')
        } else {
          console.log('No rows found to test.')
        }
      }, 2000)
    }
  })

  // Keep alive for 5 seconds
  setTimeout(async () => {
    console.log('Cleaning up user...')
    await adminClient.auth.admin.deleteUser(userId)
    console.log('Test complete.')
    process.exit(0)
  }, 5000)
}

testRealtime().catch(console.error)
