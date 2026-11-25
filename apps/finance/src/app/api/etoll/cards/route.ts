import { NextRequest, NextResponse } from 'next/server'
import { EtollAuthError, requireEtollActor } from '@/lib/etoll/auth'
import { isValidCardNumber, isValidIssuer, normalizeCardNumber } from '@/lib/etoll/reconcile'
import { getServiceSupabase } from '@/lib/supabase-service'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    await requireEtollActor(req, { financeOnly: false })
    const admin = getServiceSupabase()

    const { searchParams } = new URL(req.url)
    const status = searchParams.get('status')

    let query = admin
      .from('etoll_cards')
      .select(`
        *,
        holder:outlet_staff!etoll_cards_holder_staff_id_fkey(id, name, role),
        outlet:outlets!etoll_cards_outlet_id_fkey(id, name),
        last_scanner:outlet_staff!etoll_cards_last_scanned_by_fkey(id, name)
      `)
      .order('created_at', { ascending: false })

    if (status && ['active', 'inactive', 'lost'].includes(status)) {
      query = query.eq('status', status)
    }

    const { data, error } = await query
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ cards: data ?? [] })
  } catch (err: any) {
    if (err instanceof EtollAuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status })
    }
    console.error('GET /api/etoll/cards error:', err)
    return NextResponse.json({ error: err?.message || 'Gagal memuat kartu e-Toll' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const actor = await requireEtollActor(req, { cardRegistrarOnly: true })
    const body = await req.json()

    if (!body.card_number || !isValidCardNumber(body.card_number)) {
      return NextResponse.json(
        { error: 'Nomor kartu wajib diisi (8-24 karakter alfanumerik)' },
        { status: 400 },
      )
    }
    if (!isValidIssuer(body.issuer)) {
      return NextResponse.json({ error: 'Pilih bank penerbit yang valid' }, { status: 400 })
    }
    const label = String(body.label ?? '').trim()
    if (!label) {
      return NextResponse.json({ error: 'Label / nama kartu wajib diisi' }, { status: 400 })
    }

    const cardNumber = normalizeCardNumber(body.card_number)
    const initialBalance = Math.max(0, Math.round(Number(body.initial_balance ?? 0) || 0))
    const admin = getServiceSupabase()

    const { data: created, error } = await admin
      .from('etoll_cards')
      .insert({
        card_number: cardNumber,
        issuer: body.issuer,
        label,
        holder_staff_id: body.holder_staff_id || null,
        outlet_id: body.outlet_id || null,
        division: body.division?.trim() || null,
        vehicle_plate: body.vehicle_plate?.trim().toUpperCase() || null,
        status: 'active',
        last_balance: initialBalance,
        notes: body.notes?.trim() || null,
        created_by: actor.userId,
      })
      .select(`
        *,
        holder:outlet_staff!etoll_cards_holder_staff_id_fkey(id, name, role),
        outlet:outlets!etoll_cards_outlet_id_fkey(id, name)
      `)
      .single()

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json(
          { error: 'Nomor kartu e-Toll ini sudah terdaftar di sistem' },
          { status: 409 },
        )
      }
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    if (created.holder_staff_id || created.vehicle_plate) {
      await admin.from('etoll_card_assignments').insert({
        card_id: created.id,
        from_staff_id: null,
        to_staff_id: created.holder_staff_id,
        from_vehicle_plate: null,
        to_vehicle_plate: created.vehicle_plate,
        balance_at_handover: initialBalance,
        note: 'Registrasi awal kartu e-Toll',
        assigned_by: actor.userId,
      })
    }

    // Bersihkan buffer pending tap jika kartu ini baru saja didaftarkan dari hasil scan HP
    await admin.from('etoll_pending_taps').delete().eq('card_number', cardNumber)

    return NextResponse.json({ card: created }, { status: 201 })
  } catch (err: any) {
    if (err instanceof EtollAuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status })
    }
    console.error('POST /api/etoll/cards error:', err)
    return NextResponse.json({ error: err?.message || 'Gagal mendaftarkan kartu e-Toll' }, { status: 500 })
  }
}
