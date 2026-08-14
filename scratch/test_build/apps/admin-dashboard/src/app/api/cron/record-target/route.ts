import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  try {
    // Verifikasi cron secret jika ada di env (best practice untuk Vercel Cron)
    const authHeader = request.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET
    
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    
    if (!supabaseUrl || !supabaseKey) {
      return NextResponse.json({ error: 'Supabase credentials missing' }, { status: 500 })
    }

    const supabase = createClient(supabaseUrl, supabaseKey)

    // Panggil function snapshot yang sudah kita buat di database
    const { error } = await supabase.rpc('snapshot_daily_targets')
    
    if (error) {
      console.error('Error snapshotting targets:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, message: 'Daily targets snapshotted successfully' })
  } catch (err: any) {
    console.error('Cron error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
