import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
dotenv.config({ path: 'apps/finance/.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

const supabase = createClient(supabaseUrl, supabaseKey)

async function run() {
  const idsToUpdate = [
    'e933406d-3b9b-4d85-aabe-d03e5a85c7e8', // Empang 700k
    'fa8bbd24-bb54-4ef7-ad6d-9460d3b79e4d'  // Pekayon 300k
  ]

  // Update status to 'forwarded_to_finance'
  const { data, error } = await supabase
    .from('petty_cash_topups')
    .update({ 
      status: 'forwarded_to_finance',
      finance_forwarded_at: new Date().toISOString()
    })
    .in('id', idsToUpdate)
    .select()

  if (error) {
    console.error("Error updating topups:", error)
  } else {
    console.log("Successfully updated topups:", data)
  }
}

run()
