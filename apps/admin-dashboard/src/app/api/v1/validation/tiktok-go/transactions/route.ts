import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function GET(request: Request) {
  try {
    // 1. Verifikasi API Key
    const apiKey = request.headers.get('x-api-key')
    const validApiKey = process.env.VALIDATION_API_KEY
    
    if (!validApiKey) {
      console.error('VALIDATION_API_KEY is not set in environment variables.')
      return NextResponse.json({ error: 'Server misconfiguration' }, { status: 500 })
    }

    if (apiKey !== validApiKey) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // 2. Parse Date
    const { searchParams } = new URL(request.url)
    const dateParam = searchParams.get('date') // Format: YYYY-MM-DD
    const outletParam = searchParams.get('outlet')
    
    if (!dateParam || !/^\d{4}-\d{2}-\d{2}$/.test(dateParam)) {
      return NextResponse.json({ error: 'Valid date parameter (YYYY-MM-DD) is required' }, { status: 400 })
    }

    // Asumsi timezone WIB (UTC+7)
    const startOfDay = new Date(`${dateParam}T00:00:00+07:00`)
    const endOfDay = new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000)

    // 3. Connect to Supabase
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

    if (!supabaseUrl || !supabaseKey) {
      return NextResponse.json({ error: 'Supabase configuration is missing' }, { status: 500 })
    }

    const supabase = createClient(supabaseUrl, supabaseKey)

    // 4. Fetch data from Supabase
    let query = supabase
      .from('orders')
      .select('id, order_number, total_amount, order_items(menu_item_name, quantity), outlet:outlets!inner(name)')
      .in('source', ['manual', 'online'])
      .in('channel', ['tiktok_go', 'tiktokgo', 'TikTok Go'])
      .eq('status', 'completed')
      .gte('created_at', startOfDay.toISOString())
      .lt('created_at', endOfDay.toISOString())

    if (outletParam) {
      query = query.ilike('outlets.name', `%${outletParam}%`)
    }

    const { data: orders, error } = await query

    if (error) {
      console.error('Error fetching orders:', error)
      return NextResponse.json({ error: 'Database error' }, { status: 500 })
    }

    // 5. Format transactions
    const transactions = (orders || []).map((order: any) => {
      // Create a summary string of items, e.g., "1x Nasi Goreng, 2x Es Teh"
      const itemsSummary = (order.order_items || [])
        .map((item: any) => `${item.quantity}x ${item.menu_item_name}`)
        .join(', ')

      return {
        id: order.id,
        order_number: order.order_number,
        amount: Number(order.total_amount || 0),
        items_summary: itemsSummary,
        store_name: order.outlet?.name || 'Unknown'
      }
    }) || []

    return NextResponse.json({
      date: dateParam,
      transactions: transactions
    })

  } catch (error: any) {
    console.error('Validation Transactions API Error:', error)
    return NextResponse.json({ error: 'Internal Server Error', details: error.message }, { status: 500 })
  }
}
