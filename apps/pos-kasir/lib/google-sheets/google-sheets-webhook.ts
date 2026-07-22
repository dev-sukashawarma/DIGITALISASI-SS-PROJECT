import { getGoogleSheetsConfig } from './google-sheets-config'

export interface GoogleSheetsItemPayload {
  menu_item_name: string
  quantity: number
  unit_price: number
  subtotal: number
}

export interface GoogleSheetsPayload {
  event: string
  timestamp: string
  day_of_month: number
  order_number: string
  outlet_name: string
  channel: string
  payment_method: string
  items: GoogleSheetsItemPayload[]
}

export interface WebhookOrderInput {
  order_number: string | number
  channel?: string
  sales_channel?: string
  source?: string
  payment_method?: string
  payment_type?: string
  created_at?: string
  timestamp?: string
}

export interface WebhookOrderItemInput {
  menu_item_name?: string
  name?: string
  menu_name?: string
  item_name?: string
  quantity?: number
  qty?: number
  unit_price?: number
  price?: number
  subtotal?: number
  total?: number
}

/**
 * Formats order data into GoogleSheetsPayload schema for Google Sheets real-time sync
 */
export function formatGoogleSheetsPayload(
  order: WebhookOrderInput,
  items: WebhookOrderItemInput[],
  outletName: string
): GoogleSheetsPayload {
  const timestamp =
    order.created_at || order.timestamp || new Date().toISOString()
  
  const dateObj = new Date(timestamp)
  // Get local date number in Asia/Jakarta timezone
  const dayOfMonthStr = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Jakarta',
    day: 'numeric'
  }).format(dateObj)
  const dayOfMonth = Number(dayOfMonthStr) || dateObj.getDate()

  const orderNumber = String(order.order_number ?? '')
  const channel =
    order.channel || order.sales_channel || order.source || 'POS'
  const paymentMethod =
    order.payment_method || order.payment_type || 'CASH'

  const formattedItems: GoogleSheetsItemPayload[] = (items || []).map((item) => {
    let name =
      item.menu_item_name || item.name || item.menu_name || item.item_name || ''
    
    // Clean up name by taking everything before the first '|' and uppercasing it
    name = name.split('|')[0].trim().toUpperCase()

    const quantity = item.quantity ?? item.qty ?? 0
    const unitPrice = item.unit_price ?? item.price ?? 0
    const subtotal =
      item.subtotal ?? item.total ?? quantity * unitPrice

    return {
      menu_item_name: name,
      quantity,
      unit_price: unitPrice,
      subtotal
    }
  })

  return {
    event: 'ORDER_COMPLETED',
    timestamp,
    day_of_month: dayOfMonth,
    order_number: orderNumber,
    outlet_name: outletName,
    channel,
    payment_method: paymentMethod,
    items: formattedItems
  }
}

/**
 * Sends order details to Google Sheets App Script / Webhook URL
 */
export async function sendOrderToGoogleSheets(
  webhookUrl: string,
  order: WebhookOrderInput,
  items: WebhookOrderItemInput[],
  outletName: string,
  customFetch: typeof fetch = fetch
): Promise<boolean> {
  if (!webhookUrl) {
    return false
  }

  try {
    const payload = formatGoogleSheetsPayload(order, items, outletName)
    const response = await customFetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain;charset=utf-8'
      },
      body: JSON.stringify(payload),
      redirect: 'follow'
    })

    if (response.ok) {
      return true
    }

    if (response.type === 'opaque' || response.status === 200 || response.status === 302) {
      return true
    }

    return false
  } catch (error) {
    console.error('Failed to send order to Google Sheets webhook:', error)
    return false
  }
}

/**
 * Triggers Google Sheets sync asynchronously (fire-and-forget) if enabled in settings
 */
export function triggerGoogleSheetsSyncIfActive(
  supabase: any,
  order: any,
  items: any[],
  outletName: string
) {
  // Asynchronous fire-and-forget
  getGoogleSheetsConfig(supabase)
    .then(config => {
      if (config.enabled && config.url) {
        sendOrderToGoogleSheets(config.url, order, items, outletName)
      }
    })
    .catch(err => {
      console.error('Trigger Google Sheets Sync Error:', err)
    })
}

