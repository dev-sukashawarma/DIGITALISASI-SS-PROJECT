import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { requireRole } from '@/lib/authz'
import { createOrderOnlineAdminClient } from '@/lib/supabase/order-online-client'

export async function GET() {
  const supabase = createServiceClient() // Using service client to bypass RLS for fetching settings
  
  const { data, error } = await supabase
    .from('global_settings')
    .select('key, value')

  if (error) {
    console.error('Error fetching settings:', error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const settings: Record<string, any> = {}
  data?.forEach((row) => {
    settings[row.key] = row.value
  })

  return NextResponse.json(settings)
}

export async function POST(request: Request) {
  const supabase = createServiceClient() // Service client bypasses RLS

  try {
    // API route middleware hanya cek session-punya-app-access, bukan role —
    // route ini menimpa global_settings company-wide (termasuk print layout
    // & brand logo semua outlet), wajib admin/owner.
    await requireRole(['admin', 'owner'])

    const body = await request.json()
    
    // Process base64 image upload for brand_logo
    if (body.brand_logo && body.brand_logo.startsWith('data:image/')) {
      const base64Data = body.brand_logo.replace(/^data:image\/\w+;base64,/, '')
      const mimeMatch = body.brand_logo.match(/^data:(image\/\w+);base64,/)
      const mimeType = mimeMatch ? mimeMatch[1] : 'image/png'
      const ext = mimeType.split('/')[1] || 'png'
      const fileName = `brand-logo-${Date.now()}.${ext}`
      
      const buffer = Buffer.from(base64Data, 'base64')
      
      const { error: uploadError } = await supabase.storage
        .from('kiosk-assets')
        .upload(fileName, buffer, {
          contentType: mimeType,
          upsert: true
        })
        
      if (uploadError) {
        throw uploadError
      }
      
      const { data: { publicUrl } } = supabase.storage
        .from('kiosk-assets')
        .getPublicUrl(fileName)
        
      body.brand_logo = publicUrl
    }
    
    // Convert object { key: value } to array of { key, value }
    const upserts = Object.keys(body).map(key => ({
      key,
      value: body[key],
      updated_at: new Date().toISOString()
    }))

    const { error } = await supabase
      .from('global_settings')
      .upsert(upserts, { onConflict: 'key' })

    if (error) {
      throw error
    }

    // Synchronize to Order Online (FormOrder_SS) database if available
    try {
      const orderOnline = createOrderOnlineAdminClient()
      const orderOnlineUpserts: Array<{ key: string; value: any; updated_at: string }> = []
      if (body.brand_name) {
        orderOnlineUpserts.push({ key: 'brand_name', value: body.brand_name, updated_at: new Date().toISOString() })
      }
      if (body.brand_logo !== undefined) {
        orderOnlineUpserts.push({ key: 'brand_logo', value: body.brand_logo, updated_at: new Date().toISOString() })
        if (body.brand_logo) {
          orderOnlineUpserts.push({ key: 'hero_logo_url', value: body.brand_logo, updated_at: new Date().toISOString() })
        }
      }
      if (orderOnlineUpserts.length > 0) {
        await orderOnline.from('app_settings').upsert(orderOnlineUpserts, { onConflict: 'key' })
      }
    } catch (orderOnlineErr: any) {
      console.warn('Sync brand to Order Online skipped or failed:', orderOnlineErr?.message)
    }

    return NextResponse.json({ success: true, brand_name: body.brand_name, brand_logo: body.brand_logo })
  } catch (err: any) {
    console.error('Error updating settings:', err.message)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
