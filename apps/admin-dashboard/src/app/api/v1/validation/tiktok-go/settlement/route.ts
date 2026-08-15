import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import storeMapRaw from '@/data/platform_store_map.json'

type StoreMapEntry = {
  byStoreId: Record<string, string>;
  byName: Record<string, string>;
  closed: Record<string, string>;
};

export async function POST(request: Request) {
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

    // 2. Parse Payload
    const body = await request.json()
    const { date, records } = body

    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return NextResponse.json({ error: 'Valid date parameter (YYYY-MM-DD) is required in JSON body' }, { status: 400 })
    }

    if (!records || !Array.isArray(records)) {
      return NextResponse.json({ error: 'records array is required in JSON body' }, { status: 400 })
    }

    // 3. Connect to Supabase
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

    if (!supabaseUrl || !supabaseKey) {
      return NextResponse.json({ error: 'Supabase configuration is missing' }, { status: 500 })
    }

    const supabase = createClient(supabaseUrl, supabaseKey)

    // 4. Fetch Outlets for Mapping
    const { data: outletsData, error: outletsErr } = await supabase
      .from('outlets')
      .select('id, name')

    if (outletsErr) {
      console.error('Error fetching outlets:', outletsErr)
      return NextResponse.json({ error: 'Failed to load outlets' }, { status: 500 })
    }

    const outletIdByName = new Map<string, string>(
      (outletsData || []).map((o) => [String(o.name).trim().toLowerCase(), o.id as string])
    )

    const map = (storeMapRaw as unknown as Record<string, StoreMapEntry>)['tiktokgo'] || { byStoreId: {}, byName: {}, closed: {} }

    const rowsToUpsert: any[] = []
    const unmapped: string[] = []

    for (const record of records) {
      const storeName = record.store_name
      
      if (!storeName) continue
      
      // Attempt to map using existing mapping logic
      const outletName = map.byName[storeName.trim().toLowerCase()] || null
      const outletId = outletName ? outletIdByName.get(outletName.trim().toLowerCase()) : null

      if (!outletId) {
        unmapped.push(storeName)
        continue
      }

      rowsToUpsert.push({
        platform: 'tiktokgo',
        outlet_id: outletId,
        tanggal: date,
        omzet_kotor: Number(record.omzet_kotor || 0),
        promo_merchant: Number(record.promo_merchant || 0),
        commission: Number(record.commission || 0),
        trx_count: Number(record.trx_count || 0),
        source_file: 'hermes_api_inject',
        imported_at: new Date().toISOString()
      })
    }

    if (rowsToUpsert.length === 0) {
      return NextResponse.json({ message: 'No valid records mapped', unmapped }, { status: 200 })
    }

    // 5. Upsert Data to platform_settlements
    const { error: upsertErr } = await supabase
      .from('platform_settlements')
      .upsert(rowsToUpsert, { onConflict: 'platform,outlet_id,tanggal' })

    if (upsertErr) {
      console.error('Error upserting settlement data:', upsertErr)
      return NextResponse.json({ error: 'Failed to insert data', details: upsertErr.message }, { status: 500 })
    }

    return NextResponse.json({
      message: 'Settlement data injected successfully',
      inserted: rowsToUpsert.length,
      unmapped: unmapped
    })

  } catch (error: any) {
    console.error('Settlement Inject API Error:', error)
    return NextResponse.json({ error: 'Internal Server Error', details: error.message }, { status: 500 })
  }
}
