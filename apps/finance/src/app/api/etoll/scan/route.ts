import { NextRequest, NextResponse } from 'next/server'
import { EtollAuthError, requireEtollActor } from '@/lib/etoll/auth'
import {
  computeUntrackedGap,
  isValidCardNumber,
  isValidIssuer,
  matchPendingTopups,
  normalizeCardNumber,
  prepareNewChipTransactions,
} from '@/lib/etoll/reconcile'
import type { IncomingScanPayload } from '@/lib/etoll/types'
import { getServiceSupabase } from '@/lib/supabase-service'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    const actor = await requireEtollActor(req, { financeOnly: false })
    const body = (await req.json()) as Partial<IncomingScanPayload>

    if (!body.card_number || !isValidCardNumber(body.card_number)) {
      return NextResponse.json(
        { error: 'Nomor kartu tidak valid' },
        { status: 400 },
      )
    }
    if (!isValidIssuer(body.issuer)) {
      return NextResponse.json(
        { error: 'Bank penerbit kartu tidak dikenali' },
        { status: 400 },
      )
    }
    const balance = Math.round(Number(body.balance))
    if (!Number.isFinite(balance) || balance < 0) {
      return NextResponse.json(
        { error: 'Saldo kartu tidak valid' },
        { status: 400 },
      )
    }

    const cardNumber = normalizeCardNumber(body.card_number)
    const admin = getServiceSupabase()

    // 1. Cari kartu terdaftar (kartu tak terdaftar ditolak agar kartu pribadi tidak tercampur)
    const { data: card, error: cardErr } = await admin
      .from('etoll_cards')
      .select(`
        *,
        holder:outlet_staff!etoll_cards_holder_staff_id_fkey(id, name, role),
        outlet:outlets!etoll_cards_outlet_id_fkey(id, name)
      `)
      .eq('card_number', cardNumber)
      .maybeSingle()

    if (cardErr) {
      return NextResponse.json({ error: cardErr.message }, { status: 500 })
    }
    if (!card) {
      return NextResponse.json(
        {
          error:
            'Kartu belum terdaftar sebagai kartu operasional perusahaan. Hubungi tim Finance untuk mendaftarkannya.',
          code: 'CARD_NOT_REGISTERED',
          card_number: cardNumber,
          issuer: body.issuer,
          balance,
          can_register: actor.isFinance,
        },
        { status: 404 },
      )
    }
    if (card.status !== 'active') {
      return NextResponse.json(
        {
          error: `Kartu "${card.label}" berstatus ${card.status}. Scan ditolak.`,
          code: 'CARD_INACTIVE',
        },
        { status: 403 },
      )
    }

    const scannedAt =
      body.scanned_at && !Number.isNaN(new Date(body.scanned_at).getTime())
        ? new Date(body.scanned_at).toISOString()
        : new Date().toISOString()

    // 2. Ambil dedup keys terbaru & kamus terminal
    const [{ data: existingTxRows, error: exErr }, { data: dictRows, error: dictErr }] =
      await Promise.all([
        admin
          .from('etoll_transactions')
          .select('dedup_key')
          .eq('card_id', card.id)
          .order('occurred_at', { ascending: false })
          .limit(300),
        admin
          .from('etoll_terminal_dictionary')
          .select('issuer, terminal_code, merchant_name, default_category'),
      ])

    if (exErr) return NextResponse.json({ error: exErr.message }, { status: 500 })
    if (dictErr) return NextResponse.json({ error: dictErr.message }, { status: 500 })

    const existingDedupKeys = new Set<string>(
      (existingTxRows ?? []).map((r: { dedup_key: string }) => r.dedup_key),
    )

    const incomingTxs = Array.isArray(body.transactions) ? body.transactions : []
    const preparedChipTxs = prepareNewChipTransactions({
      issuer: card.issuer,
      incoming: incomingTxs,
      existingDedupKeys,
      dictionary: (dictRows ?? []) as any[],
    })

    // 3. Hitung selisih saldo tak terlacak dibanding scan sebelumnya
    const hasPriorScan = Boolean(card.last_scanned_at)
    const previousBalance = Number(card.last_balance ?? 0)
    const gap = computeUntrackedGap({
      hasPriorScan,
      previousBalance,
      currentBalance: balance,
      newChipTransactions: preparedChipTxs,
    })

    // 4. Simpan log scan
    const { data: scanRow, error: scanErr } = await admin
      .from('etoll_scans')
      .insert({
        card_id: card.id,
        scanned_by: actor.userId,
        scanned_at: scannedAt,
        balance_before: hasPriorScan ? previousBalance : null,
        balance_after: balance,
        chip_records_found: incomingTxs.length,
        new_transactions_count:
          preparedChipTxs.length + (gap.syntheticTransaction ? 1 : 0),
        untracked_gap_amount: gap.gapAmount,
        gps_lat: typeof body.gps_lat === 'number' ? body.gps_lat : null,
        gps_lng: typeof body.gps_lng === 'number' ? body.gps_lng : null,
        device_info: body.device_info?.trim() || null,
        raw_diagnostics: body.raw_diagnostics ?? {},
      })
      .select('*')
      .single()

    if (scanErr || !scanRow) {
      return NextResponse.json(
        { error: scanErr?.message || 'Gagal menyimpan log scan' },
        { status: 500 },
      )
    }

    // 5. Insert transaksi chip baru + baris selisih tak terlacak bila ada
    const rowsToInsert: Record<string, unknown>[] = preparedChipTxs.map((tx) => ({
      card_id: card.id,
      scan_id: scanRow.id,
      holder_staff_id: card.holder_staff_id,
      source: 'chip',
      tx_type: tx.tx_type,
      dedup_key: tx.dedup_key,
      occurred_at: tx.occurred_at,
      amount: tx.amount,
      balance_after: tx.balance_after,
      terminal_code: tx.terminal_code,
      merchant_label: tx.merchant_label,
      category: tx.category,
      raw_hex: tx.raw_hex,
    }))

    if (gap.syntheticTransaction) {
      rowsToInsert.push({
        card_id: card.id,
        scan_id: scanRow.id,
        holder_staff_id: card.holder_staff_id,
        source: 'untracked_gap',
        tx_type: gap.syntheticTransaction.tx_type,
        dedup_key: `gap:${scanRow.id}`,
        occurred_at: scannedAt,
        amount: gap.syntheticTransaction.amount,
        balance_after: balance,
        terminal_code: null,
        merchant_label: gap.syntheticTransaction.merchant_label,
        category: gap.syntheticTransaction.category,
        note: gap.syntheticTransaction.note,
      })
    }

    let insertedTxs: any[] = []
    if (rowsToInsert.length > 0) {
      const { data: txData, error: txErr } = await admin
        .from('etoll_transactions')
        .upsert(rowsToInsert, { onConflict: 'card_id,dedup_key', ignoreDuplicates: true })
        .select('*')

      if (txErr) {
        return NextResponse.json({ error: txErr.message }, { status: 500 })
      }
      insertedTxs = txData ?? []
    }

    // 6. Update saldo & metadata scan terakhir di master kartu
    const { data: updatedCard, error: updErr } = await admin
      .from('etoll_cards')
      .update({
        last_balance: balance,
        last_scanned_at: scannedAt,
        last_scanned_by: actor.userId,
        updated_at: new Date().toISOString(),
      })
      .eq('id', card.id)
      .select(`
        *,
        holder:outlet_staff!etoll_cards_holder_staff_id_fkey(id, name, role),
        outlet:outlets!etoll_cards_outlet_id_fkey(id, name)
      `)
      .single()

    if (updErr) {
      return NextResponse.json({ error: updErr.message }, { status: 500 })
    }

    // 7. Rekonsiliasi otomatis catatan top-up Finance yang masih waiting_scan
    let matchedTopupsCount = 0
    const newTopupTxs = insertedTxs.filter((t) => t.tx_type === 'topup')
    if (newTopupTxs.length > 0) {
      const { data: pendingTopups } = await admin
        .from('etoll_topups')
        .select('id, topup_date, amount')
        .eq('card_id', card.id)
        .eq('status', 'waiting_scan')

      if (pendingTopups && pendingTopups.length > 0) {
        const pairs = matchPendingTopups(
          pendingTopups.map((p: any) => ({
            id: p.id,
            topup_date: p.topup_date,
            amount: Number(p.amount),
          })),
          newTopupTxs.map((t: any) => ({
            id: t.id,
            occurred_at: t.occurred_at,
            amount: Number(t.amount),
          })),
        )

        for (const pair of pairs) {
          const { error: matchErr } = await admin
            .from('etoll_topups')
            .update({
              status: 'matched',
              matched_transaction_id: pair.transactionId,
              matched_scan_id: scanRow.id,
              matched_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            })
            .eq('id', pair.topupId)

          if (!matchErr) matchedTopupsCount++
        }
      }
    }

    return NextResponse.json({
      ok: true,
      scan: scanRow,
      card: updatedCard,
      new_transactions: insertedTxs.sort((a, b) =>
        String(b.occurred_at).localeCompare(String(a.occurred_at)),
      ),
      untracked_gap_amount: gap.gapAmount,
      matched_topups_count: matchedTopupsCount,
    })
  } catch (err: any) {
    if (err instanceof EtollAuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status })
    }
    console.error('POST /api/etoll/scan error:', err)
    return NextResponse.json(
      { error: err?.message || 'Gagal memproses scan e-Toll' },
      { status: 500 },
    )
  }
}
