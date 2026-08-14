import { createClient } from '@supabase/supabase-js'

const orderOnlineUrl = process.env.ORDER_ONLINE_SUPABASE_URL!
const orderOnlineKey = process.env.ORDER_ONLINE_SERVICE_ROLE_KEY!

export function createOrderOnlineAdminClient() {
  if (!orderOnlineUrl || !orderOnlineKey) {
    throw new Error('ORDER_ONLINE_SUPABASE_URL and ORDER_ONLINE_SERVICE_ROLE_KEY must be set')
  }
  return createClient(orderOnlineUrl, orderOnlineKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  })
}
