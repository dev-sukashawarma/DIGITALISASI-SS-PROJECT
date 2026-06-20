import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function GET() {
  const startedAt = Date.now()
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
  const admin = createClient(supabaseUrl, serviceKey)

  let db: 'ok' | 'error' = 'ok'

  const { error } = await admin.from('outlets').select('id').limit(1)
  if (error) {
    db = 'error'
  }

  return NextResponse.json({
    status: 'ok',
    db,
    lastActivity: null,
    responseTimeMs: Date.now() - startedAt,
  })
}
