import { NextRequest, NextResponse } from 'next/server'
import { EtollAuthError, requireEtollActor } from '@/lib/etoll/auth'
import { getServiceSupabase } from '@/lib/supabase-service'

export const dynamic = 'force-dynamic'

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    await requireEtollActor(req, { financeOnly: true })
    const { id } = await context.params
    const admin = getServiceSupabase()

    const [cardRes, assignmentsRes, scansRes, topupsRes] = await Promise.all([
      admin
        .from('etoll_cards')
        .select(`
          *,
          holder:outlet_staff!etoll_cards_holder_staff_id_fkey(id, name, role),
          outlet:outlets!etoll_cards_outlet_id_fkey(id, name),
          last_scanner:outlet_staff!etoll_cards_last_scanned_by_fkey(id, name)
        `)
        .eq('id', id)
        .maybeSingle(),
      admin
        .from('etoll_card_assignments')
        .select(`
          *,
          from_staff:outlet_staff!etoll_card_assignments_from_staff_id_fkey(id, name),
          to_staff:outlet_staff!etoll_card_assignments_to_staff_id_fkey(id, name),
          assigner:outlet_staff!etoll_card_assignments_assigned_by_fkey(id, name)
        `)
        .eq('card_id', id)
        .order('assigned_at', { ascending: false })
        .limit(50),
      admin
        .from('etoll_scans')
        .select(`
          *,
          scanner:outlet_staff!etoll_scans_scanned_by_fkey(id, name)
        `)
        .eq('card_id', id)
        .order('scanned_at', { ascending: false })
        .limit(50),
      admin
        .from('etoll_topups')
        .select(`
          *,
          creator:outlet_staff!etoll_topups_created_by_fkey(id, name)
        `)
        .eq('card_id', id)
        .order('topup_date', { ascending: false })
        .limit(50),
    ])

    if (cardRes.error) {
      return NextResponse.json({ error: cardRes.error.message }, { status: 500 })
    }
    if (!cardRes.data) {
      return NextResponse.json({ error: 'Kartu tidak ditemukan' }, { status: 404 })
    }

    return NextResponse.json({
      card: cardRes.data,
      assignments: assignmentsRes.data ?? [],
      scans: scansRes.data ?? [],
      topups: topupsRes.data ?? [],
    })
  } catch (err: any) {
    if (err instanceof EtollAuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status })
    }
    console.error('GET /api/etoll/cards/[id] error:', err)
    return NextResponse.json({ error: err?.message || 'Gagal memuat detail kartu' }, { status: 500 })
  }
}

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const actor = await requireEtollActor(req, { financeOnly: true })
    const { id } = await context.params
    const body = await req.json()
    const admin = getServiceSupabase()

    const { data: existing, error: exErr } = await admin
      .from('etoll_cards')
      .select('*')
      .eq('id', id)
      .maybeSingle()

    if (exErr) return NextResponse.json({ error: exErr.message }, { status: 500 })
    if (!existing) return NextResponse.json({ error: 'Kartu tidak ditemukan' }, { status: 404 })

    const patch: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    }
    if (typeof body.label === 'string' && body.label.trim()) {
      patch.label = body.label.trim()
    }
    if (body.status && ['active', 'inactive', 'lost'].includes(body.status)) {
      patch.status = body.status
    }
    if ('division' in body) {
      patch.division = body.division ? String(body.division).trim() : null
    }
    if ('outlet_id' in body) {
      patch.outlet_id = body.outlet_id || null
    }
    if ('notes' in body) {
      patch.notes = body.notes ? String(body.notes).trim() : null
    }

    const nextHolderId =
      'holder_staff_id' in body ? (body.holder_staff_id || null) : existing.holder_staff_id
    const nextPlate =
      'vehicle_plate' in body
        ? (body.vehicle_plate ? String(body.vehicle_plate).trim().toUpperCase() : null)
        : existing.vehicle_plate

    patch.holder_staff_id = nextHolderId
    patch.vehicle_plate = nextPlate

    const holderChanged =
      nextHolderId !== existing.holder_staff_id || nextPlate !== existing.vehicle_plate

    const { data: updated, error: updErr } = await admin
      .from('etoll_cards')
      .update(patch)
      .eq('id', id)
      .select(`
        *,
        holder:outlet_staff!etoll_cards_holder_staff_id_fkey(id, name, role),
        outlet:outlets!etoll_cards_outlet_id_fkey(id, name)
      `)
      .single()

    if (updErr) return NextResponse.json({ error: updErr.message }, { status: 500 })

    if (holderChanged) {
      await admin.from('etoll_card_assignments').insert({
        card_id: id,
        from_staff_id: existing.holder_staff_id,
        to_staff_id: nextHolderId,
        from_vehicle_plate: existing.vehicle_plate,
        to_vehicle_plate: nextPlate,
        balance_at_handover: existing.last_balance,
        note: body.handover_note?.trim() || 'Serah-terima pemegang / kendaraan kartu',
        assigned_by: actor.userId,
      })
    }

    return NextResponse.json({ card: updated, handover_recorded: holderChanged })
  } catch (err: any) {
    if (err instanceof EtollAuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status })
    }
    console.error('PATCH /api/etoll/cards/[id] error:', err)
    return NextResponse.json({ error: err?.message || 'Gagal memperbarui kartu' }, { status: 500 })
  }
}
