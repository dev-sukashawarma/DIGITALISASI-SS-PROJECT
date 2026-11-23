import { NextRequest, NextResponse } from 'next/server'
import { EtollAuthError, requireEtollActor } from '@/lib/etoll/auth'
import { matchPendingTopups } from '@/lib/etoll/reconcile'
import { getServiceSupabase } from '@/lib/supabase-service'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    await requireEtollActor(req, { financeOnly: true })
    const admin = getServiceSupabase()
    const { searchParams } = new URL(req.url)
    const cardId = searchParams.get('cardId')
    const status = searchParams.get('status')

    let query = admin
      .from('etoll_topups')
      .select(`
        *,
        card:etoll_cards!etoll_topups_card_id_fkey(id, label, card_number, issuer),
        creator:outlet_staff!etoll_topups_created_by_fkey(id, name)
      `)
      .order('topup_date', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(300)

    if (cardId && cardId !== 'all') {
      query = query.eq('card_id', cardId)
    }
    if (status && ['waiting_scan', 'matched', 'mismatch', 'void'].includes(status)) {
      query = query.eq('status', status)
    }

    const { data, error } = await query
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ topups: data ?? [] })
  } catch (err: any) {
    if (err instanceof EtollAuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status })
    }
    return NextResponse.json({ error: err?.message || 'Gagal memuat catatan top-up' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const actor = await requireEtollActor(req, { financeOnly: true })
    const body = await req.json()

    if (!body.card_id) {
      return NextResponse.json({ error: 'Pilih kartu e-Toll terlebih dahulu' }, { status: 400 })
    }
    const amount = Math.round(Number(body.amount))
    if (!Number.isFinite(amount) || amount <= 0) {
      return NextResponse.json({ error: 'Nominal top-up harus lebih dari Rp 0' }, { status: 400 })
    }
    const topupDate = String(body.topup_date ?? '').trim()
    if (!/^\d{4}-\d{2}-\d{2}$/.test(topupDate)) {
      return NextResponse.json({ error: 'Tanggal top-up tidak valid (YYYY-MM-DD)' }, { status: 400 })
    }

    const admin = getServiceSupabase()

    const { data: created, error } = await admin
      .from('etoll_topups')
      .insert({
        card_id: body.card_id,
        topup_date: topupDate,
        amount,
        funding_source: body.funding_source?.trim() || null,
        reference_no: body.reference_no?.trim() || null,
        note: body.note?.trim() || null,
        status: 'waiting_scan',
        created_by: actor.userId,
      })
      .select(`
        *,
        card:etoll_cards!etoll_topups_card_id_fkey(id, label, card_number, issuer),
        creator:outlet_staff!etoll_topups_created_by_fkey(id, name)
      `)
      .single()

    if (error || !created) {
      return NextResponse.json({ error: error?.message || 'Gagal mencatat top-up' }, { status: 500 })
    }

    // Coba langsung cocokkan bila kartu ternyata sudah di-scan sebelumnya dan ada transaksi topup yang belum terpakai
    const [{ data: chipTopups }, { data: alreadyMatched }] = await Promise.all([
      admin
        .from('etoll_transactions')
        .select('id, occurred_at, amount, scan_id')
        .eq('card_id', body.card_id)
        .eq('tx_type', 'topup')
        .order('occurred_at', { ascending: false })
        .limit(50),
      admin
        .from('etoll_topups')
        .select('matched_transaction_id')
        .eq('card_id', body.card_id)
        .not('matched_transaction_id', 'is', null),
    ])

    const usedTxIds = new Set(
      (alreadyMatched ?? [])
        .map((r: any) => r.matched_transaction_id)
        .filter(Boolean),
    )
    const availableTxs = (chipTopups ?? []).filter((t: any) => !usedTxIds.has(t.id))
    const pairs = matchPendingTopups(
      [{ id: created.id, topup_date: created.topup_date, amount: Number(created.amount) }],
      availableTxs.map((t: any) => ({
        id: t.id,
        occurred_at: t.occurred_at,
        amount: Number(t.amount),
      })),
    )

    if (pairs.length > 0) {
      const matchedTx = availableTxs.find((t: any) => t.id === pairs[0].transactionId)
      const { data: matchedRow } = await admin
        .from('etoll_topups')
        .update({
          status: 'matched',
          matched_transaction_id: pairs[0].transactionId,
          matched_scan_id: matchedTx?.scan_id ?? null,
          matched_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', created.id)
        .select(`
          *,
          card:etoll_cards!etoll_topups_card_id_fkey(id, label, card_number, issuer),
          creator:outlet_staff!etoll_topups_created_by_fkey(id, name)
        `)
        .single()

      if (matchedRow) {
        return NextResponse.json({ topup: matchedRow, auto_matched: true }, { status: 201 })
      }
    }

    return NextResponse.json({ topup: created, auto_matched: false }, { status: 201 })
  } catch (err: any) {
    if (err instanceof EtollAuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status })
    }
    return NextResponse.json({ error: err?.message || 'Gagal mencatat top-up' }, { status: 500 })
  }
}
