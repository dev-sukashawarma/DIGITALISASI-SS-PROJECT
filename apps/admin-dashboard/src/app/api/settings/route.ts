import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

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

    return NextResponse.json({ success: true })
  } catch (err: any) {
    console.error('Error updating settings:', err.message)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
