require('dotenv').config({ path: 'apps/admin-dashboard/.env.local' })
const { createClient } = require('@supabase/supabase-js')

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

async function getTables() {
  try {
    const { data, error } = await supabase.from('information_schema.tables')
      .select('table_name')
      .eq('table_schema', 'public')
    
    if (data) {
      console.log(data.map(d => d.table_name))
    } else {
      console.error('No data or error:', error)
    }
  } catch (err) {
    console.error('Catch error:', err)
  }
}

getTables()
