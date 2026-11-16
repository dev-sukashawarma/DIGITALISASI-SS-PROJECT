import { createClient } from '@supabase/supabase-js'

export function createOrderOnlineAdminClient() {
  const orderOnlineUrl = process.env.ORDER_ONLINE_SUPABASE_URL?.trim().replace(/^['"]+|['"]+$/g, '')
  const orderOnlineKey = process.env.ORDER_ONLINE_SERVICE_ROLE_KEY?.trim().replace(/^['"]+|['"]+$/g, '')

  if (!orderOnlineUrl || !orderOnlineKey) {
    throw new Error('ORDER_ONLINE_SUPABASE_URL and ORDER_ONLINE_SERVICE_ROLE_KEY must be set')
  }
  return createClient(orderOnlineUrl, orderOnlineKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
}
