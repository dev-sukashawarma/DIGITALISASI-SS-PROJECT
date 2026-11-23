import { NextRequest, NextResponse } from 'next/server'
import { EtollAuthError, requireEtollActor } from '@/lib/etoll/auth'
import { getServiceSupabase } from '@/lib/supabase-service'

export const dynamic = 'force-dynamic'

export async function DELETE(
  req: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    await requireEtollActor(req, { financeOnly: true })
    const { id } = await context.params
    const admin = getServiceSupabase()

    const { error } = await admin
      .from('etoll_terminal_dictionary')
      .delete()
      .eq('id', id)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  } catch (err: any) {
    if (err instanceof EtollAuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status })
    }
    return NextResponse.json({ error: err?.message || 'Gagal menghapus kamus' }, { status: 500 })
  }
}
