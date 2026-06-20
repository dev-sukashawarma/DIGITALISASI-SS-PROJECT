import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function GET() {
  const startedAt = Date.now()
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
  const admin = createClient(supabaseUrl, serviceKey)

  let db: 'ok' | 'error' = 'ok'
  let lastActivity: string | null = null

  const { data, error } = await admin
    .from('orders')
    .select('created_at')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) {
    db = 'error'
  } else {
    lastActivity = data?.created_at ?? null
  }

  return NextResponse.json({
    status: 'ok',
    db,
    lastActivity,
    responseTimeMs: Date.now() - startedAt,
  })
}
