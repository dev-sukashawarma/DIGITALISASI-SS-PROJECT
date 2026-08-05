import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY")
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

async function run() {
  const recordId = '685a602e-4b86-4437-86df-1386ecba12ad';
  
  const { data, error } = await supabase
    .from('petty_cash_topups')
    .update({ 
      status: 'forwarded_to_finance',
      // Reset some of the forward/approval fields just in case they were set
      // The user just said "ubah aja di databse status nya", 
      // but to be safe we just update the status as requested.
    })
    .eq('id', recordId)
    .select()

  if (error) {
    console.error("Error updating:", error)
  } else {
    console.log("Successfully updated:", data)
  }
}

run()
