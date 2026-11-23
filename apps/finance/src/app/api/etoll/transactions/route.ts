import { NextRequest, NextResponse } from 'next/server'
import { EtollAuthError, requireEtollActor } from '@/lib/etoll/auth'
import { getServiceSupabase } from '@/lib/supabase-service'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    await requireEtollActor(req, { financeOnly: true })
    const admin = getServiceSupabase()
    const { searchParams } = new URL(req.url)

    const from = searchParams.get('from') // YYYY-MM-DD
    const to = searchParams.get('to') // YYYY-MM-DD
    const cardId = searchParams.get('cardId')
    const holderId = searchParams.get('holderId')
    const category = searchParams.get('category')
    const txType = searchParams.get('txType')
    const source = searchParams.get('source')
    const search = searchParams.get('search')?.trim().toLowerCase()

    let query = admin
      .from('etoll_transactions')
      .select(`
        *,
        card:etoll_cards!etoll_transactions_card_id_fkey(id, label, card_number, issuer, vehicle_plate),
        holder:outlet_staff!etoll_transactions_holder_staff_id_fkey(id, name),
        tagger:outlet_staff!etoll_transactions_tagged_by_fkey(id, name)
      `)
      .order('occurred_at', { ascending: false })
      .limit(1000)

    if (from) {
      query = query.gte('occurred_at', `${from}T00:00:00+07:00`)
    }
    if (to) {
      query = query.lte('occurred_at', `${to}T23:59:59+07:00`)
    }
    if (cardId && cardId !== 'all') {
      query = query.eq('card_id', cardId)
    }
    if (holderId && holderId !== 'all') {
      query = query.eq('holder_staff_id', holderId)
    }
    if (category && category !== 'all') {
      query = query.eq('category', category)
    }
    if (txType && (txType === 'debit' || txType === 'topup')) {
      query = query.eq('tx_type', txType)
    }
    if (source && ['chip', 'untracked_gap', 'manual'].includes(source)) {
      query = query.eq('source', source)
    }

    const { data, error } = await query
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    let rows = (data ?? []) as any[]
    if (search) {
      rows = rows.filter((r) => {
        const hay = [
          r.merchant_label,
          r.terminal_code,
          r.note,
          r.card?.label,
          r.card?.card_number,
          r.holder?.name,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()
        return hay.includes(search)
      })
    }

    const summary = rows.reduce(
      (acc, r) => {
        const amt = Number(r.amount || 0)
        if (r.tx_type === 'debit') {
          acc.totalDebit += amt
          if (r.source === 'untracked_gap') acc.totalUntrackedGap += amt
          if (r.category === 'belum_dikategorikan') acc.uncategorizedCount += 1
        } else if (r.tx_type === 'topup') {
          acc.totalTopup += amt
        }
        return acc
      },
      {
        totalDebit: 0,
        totalTopup: 0,
        totalUntrackedGap: 0,
        uncategorizedCount: 0,
        count: rows.length,
      },
    )

    return NextResponse.json({ transactions: rows, summary })
  } catch (err: any) {
    if (err instanceof EtollAuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status })
    }
    console.error('GET /api/etoll/transactions error:', err)
    return NextResponse.json(
      { error: err?.message || 'Gagal memuat histori transaksi e-Toll' },
      { status: 500 },
    )
  }
}
