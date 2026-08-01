import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
import path from 'path'
import { formatGoogleSheetsPayload, GoogleSheetsPayload, GoogleSheetsItemPayload } from '../src/lib/google-sheets-webhook'

// Load environment variables from .env.local
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase credentials in .env.local')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function runBulkSync() {
  console.log('Starting bulk sync for July 2026...')

  // 1. Get Google Sheets Webhook URL
  const { data: configData, error: configError } = await supabase
    .from('global_settings')
    .select('*')
    .eq('key', 'google_sheets_webhook_url')
    .single()

  if (configError || !configData?.value) {
    console.error('Failed to get webhook URL from global_settings or it is not set.')
    process.exit(1)
  }
  const webhookUrl = configData.value
  console.log(`Webhook URL found: ${webhookUrl}`)

  // 2. Get all completed orders in July 2026 (Pagination to avoid 1000 limit)
  let allOrders: any[] = []
  let from = 0
  let step = 999
  let hasMore = true

  while (hasMore) {
    const { data: ordersPage, error: ordersError } = await supabase
      .from('orders')
      .select(`
        *,
        order_items (*)
      `)
      .eq('status', 'completed')
      .gte('created_at', '2026-07-01T00:00:00+07:00')
      .lt('created_at', '2026-08-01T00:00:00+07:00')
      .range(from, from + step)

    if (ordersError) {
      console.error('Error fetching orders:', ordersError)
      process.exit(1)
    }

    if (ordersPage && ordersPage.length > 0) {
      allOrders = allOrders.concat(ordersPage)
      from += step + 1
    } else {
      hasMore = false
    }
  }

  const orders = allOrders
  console.log(`Fetched ${orders.length} completed orders for July.`)

  // 3. Aggregate quantities per Day, per Outlet, per Channel, per Item
  // Structure: aggregated[outletName][dayOfMonth][channel][menuItemName] = { quantity, unit_price, subtotal }
  const aggregated: Record<string, Record<number, Record<string, Record<string, { quantity: number, unit_price: number, subtotal: number }>>>> = {}

  for (const order of orders) {
    const timestamp = order.created_at || order.timestamp
    const dateObj = new Date(timestamp)
    const dayOfMonthStr = new Intl.DateTimeFormat('en-US', {
      timeZone: 'Asia/Jakarta',
      day: 'numeric'
    }).format(dateObj)
    const dayOfMonth = Number(dayOfMonthStr) || dateObj.getDate()
    const outletName = order.outlet_name || 'Cabang Pusat'

    if (!aggregated[outletName]) aggregated[outletName] = {}
    if (!aggregated[outletName][dayOfMonth]) aggregated[outletName][dayOfMonth] = {}

    const orderChannel = order.channel || order.sales_channel || order.source || 'offline'

    for (const item of (order.order_items || [])) {
      const itemChannel = (item.channel || orderChannel).toLowerCase()
      
      let name = item.menu_item_name || item.name || item.menu_name || item.item_name || ''
      name = name.split('|')[0].trim().toUpperCase()

      const qty = item.quantity ?? item.qty ?? 0
      const price = item.unit_price ?? item.price ?? 0
      const sub = item.subtotal ?? item.total ?? (qty * price)

      if (qty <= 0) continue;

      if (!aggregated[outletName][dayOfMonth][itemChannel]) {
        aggregated[outletName][dayOfMonth][itemChannel] = {}
      }

      if (!aggregated[outletName][dayOfMonth][itemChannel][name]) {
        aggregated[outletName][dayOfMonth][itemChannel][name] = { quantity: 0, unit_price: price, subtotal: 0 }
      }

      aggregated[outletName][dayOfMonth][itemChannel][name].quantity += qty
      aggregated[outletName][dayOfMonth][itemChannel][name].subtotal += sub
    }
  }

  // 4. Send payloads to Webhook sequentially
  let totalRequests = 0
  let successRequests = 0

  for (const outlet of Object.keys(aggregated)) {
    for (const dayStr of Object.keys(aggregated[outlet])) {
      const day = Number(dayStr)
      const itemsList: GoogleSheetsItemPayload[] = []

      for (const channel of Object.keys(aggregated[outlet][day])) {
        for (const itemName of Object.keys(aggregated[outlet][day][channel])) {
          const stats = aggregated[outlet][day][channel][itemName]
          itemsList.push({
            menu_item_name: itemName,
            quantity: stats.quantity,
            unit_price: stats.unit_price,
            subtotal: stats.subtotal,
            channel: channel
          })
        }
      }

      if (itemsList.length === 0) continue;

      const payload: GoogleSheetsPayload = {
        event: 'BULK_SYNC_JULY',
        timestamp: new Date(`2026-07-${day.toString().padStart(2, '0')}T12:00:00+07:00`).toISOString(),
        day_of_month: day,
        order_number: 'BULK',
        outlet_name: outlet,
        channel: 'bulk',
        payment_method: 'bulk',
        items: itemsList
      }

      totalRequests++;
      
      try {
        console.log(`Syncing ${outlet} for July ${day}... (${itemsList.length} distinct item-channels)`)
        const response = await fetch(webhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          body: JSON.stringify(payload)
        })

        if (response.ok || response.type === 'opaque' || response.status === 200 || response.status === 302) {
          successRequests++;
        } else {
          console.error(`Failed to sync ${outlet} day ${day}: ${response.status} ${response.statusText}`)
        }
      } catch (err) {
        console.error(`Error sending payload for ${outlet} day ${day}:`, err)
      }

      // 500ms delay to prevent Google Apps Script rate limiting
      await new Promise(r => setTimeout(r, 500))
    }
  }

  console.log(`Bulk sync finished! Successfully sent ${successRequests} out of ${totalRequests} requests.`)
}

runBulkSync().catch(console.error)
