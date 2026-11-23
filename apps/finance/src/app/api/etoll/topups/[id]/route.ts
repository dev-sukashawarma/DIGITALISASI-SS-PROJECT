import { NextRequest, NextResponse } from 'next/server'
import { EtollAuthError, requireEtollActor } from '@/lib/etoll/auth'
import { getServiceSupabase } from '@/lib/supabase-service'

export const dynamic = 'force-dynamic'

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    await requireEtollActor(req, { financeOnly: true })
    const { id } = await context.params
    const body = await req.json()
    const admin = getServiceSupabase()

    if (!body.status || !['waiting_scan', 'matched', 'mismatch', 'void'].includes(body.status)) {
      return NextResponse.json({ error: 'Status rekonsiliasi tidak valid' }, { status: 400 })
    }

    const patch: Record<string, unknown> = {
      status: body.status,
      updated_at: new Date().toISOString(),
    }
    if ('mismatch_note' in body) {
      patch.mismatch_note = body.mismatch_note ? String(body.mismatch_note).trim() : null
    }
    if (body.status === 'matched') {
      patch.matched_at = new Date().toISOString()
    }

    const { data, error } = await admin
      .from('etoll_topups')
      .update(patch)
      .eq('id', id)
      .select(`
        *,
        card:etoll_cards!etoll_topups_card_id_fkey(id, label, card_number, issuer),
        creator:outlet_staff!etoll_topups_created_by_fkey(id, name)
      `)
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ topup: data })
  } catch (err: any) {
    if (err instanceof EtollAuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status })
    }
    return NextResponse.json({ error: err?.message || 'Gagal memperbarui status top-up' }, { status: 500 })
  }
}
