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
    const { data: orders, error } = await supabase
      .from('orders')
      .select('id, total_amount, order_items(quantity)')
      .in('source', ['manual', 'online'])
      .in('channel', ['tiktok_go', 'tiktokgo', 'TikTok Go'])
      .gte('created_at', startOfDay.toISOString())
      .lt('created_at', endOfDay.toISOString())

    if (error) {
      console.error('Error fetching orders:', error)
      return NextResponse.json({ error: 'Database error' }, { status: 500 })
    }

    // 5. Aggregate
    let grossRevenue = 0
    let totalItems = 0

    if (orders) {
      for (const order of orders) {
        grossRevenue += Number(order.total_amount || 0)
        
        if (order.order_items && Array.isArray(order.order_items)) {
          for (const item of order.order_items) {
            totalItems += Number(item.quantity || 0)
          }
        }
      }
    }

    return NextResponse.json({
      date: dateParam,
      gross_revenue: grossRevenue,
      total_items: totalItems
    })

  } catch (error: any) {
    console.error('Validation Summary API Error:', error)
    return NextResponse.json({ error: 'Internal Server Error', details: error.message }, { status: 500 })
  }
}
