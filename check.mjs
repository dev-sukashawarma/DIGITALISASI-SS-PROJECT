import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
dotenv.config({ path: 'apps/admin-dashboard/.env.local' })
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
supabase.from('menu_items').select('id, name, available_outlets').limit(5).then(res => console.log(JSON.stringify(res.data, null, 2)))
