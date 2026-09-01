import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

export async function GET() {
  const db = createServiceClient()
  const { data, error } = await db
    .from('outlets')
    .select('id, name, address, lat, lng, is_active')
    .eq('app_enabled', true)
    .neq('type', 'marketplace')
    .order('name', { ascending: true })

  if (error) {
    return NextResponse.json({ error: 'Gagal memuat outlet' }, { status: 502 })
  }

  return NextResponse.json({ outlets: data ?? [] })
}
