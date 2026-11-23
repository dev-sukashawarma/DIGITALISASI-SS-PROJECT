import { NextRequest, NextResponse } from 'next/server'
import { EtollAuthError, requireEtollActor } from '@/lib/etoll/auth'
import { normalizeTerminalCode } from '@/lib/etoll/reconcile'
import { getServiceSupabase } from '@/lib/supabase-service'

export const dynamic = 'force-dynamic'

const ALLOWED_CATEGORIES = new Set([
  'belum_dikategorikan',
  'tol',
  'parkir',
  'bbm_merchant',
  'operasional_lain',
  'pribadi_anomali',
  'topup',
  'untracked_gap',
])

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const actor = await requireEtollActor(req, { financeOnly: false })
    const { id } = await context.params
    const body = await req.json()
    const admin = getServiceSupabase()

    const { data: tx, error: txErr } = await admin
      .from('etoll_transactions')
      .select('*, card:etoll_cards!etoll_transactions_card_id_fkey(id, issuer)')
      .eq('id', id)
      .maybeSingle()

    if (txErr) return NextResponse.json({ error: txErr.message }, { status: 500 })
    if (!tx) return NextResponse.json({ error: 'Transaksi tidak ditemukan' }, { status: 404 })

    const patch: Record<string, unknown> = {
      tagged_by: actor.userId,
      tagged_at: new Date().toISOString(),
    }

    if (body.category !== undefined) {
      if (!ALLOWED_CATEGORIES.has(body.category)) {
        return NextResponse.json({ error: 'Kategori tidak valid' }, { status: 400 })
      }
      patch.category = body.category
    }
    if ('note' in body) {
      patch.note = body.note ? String(body.note).trim() : null
    }
    if ('merchant_label' in body && body.merchant_label && String(body.merchant_label).trim()) {
      patch.merchant_label = String(body.merchant_label).trim()
    }

    const { data: updated, error: updErr } = await admin
      .from('etoll_transactions')
      .update(patch)
      .eq('id', id)
      .select(`
        *,
        card:etoll_cards!etoll_transactions_card_id_fkey(id, label, card_number, issuer, vehicle_plate),
        holder:outlet_staff!etoll_transactions_holder_staff_id_fkey(id, name),
        tagger:outlet_staff!etoll_transactions_tagged_by_fkey(id, name)
      `)
      .single()

    if (updErr) return NextResponse.json({ error: updErr.message }, { status: 500 })

    // Jika Finance/Admin memilih simpan ke kamus terminal -> simpan & backfill transaksi lain berkode sama
    let dictionarySaved = false
    if (
      actor.isFinance &&
      body.save_to_dictionary === true &&
      tx.terminal_code &&
      updated.merchant_label
    ) {
      const normCode = normalizeTerminalCode(tx.terminal_code)
      const dictCat =
        updated.category !== 'belum_dikategorikan' && updated.category !== 'untracked_gap'
          ? updated.category
          : 'tol'
      const issuer = tx.card?.issuer ?? 'all'

      if (normCode) {
        const { error: dictErr } = await admin
          .from('etoll_terminal_dictionary')
          .upsert(
            {
              issuer,
              terminal_code: normCode,
              merchant_name: updated.merchant_label,
              default_category: dictCat,
              updated_by: actor.userId,
              updated_at: new Date().toISOString(),
            },
            { onConflict: 'issuer,terminal_code' },
          )

        if (!dictErr) {
          dictionarySaved = true
          // Backfill transaksi lain dengan terminal_code sama yang belum dikategorikan
          await admin
            .from('etoll_transactions')
            .update({
              merchant_label: updated.merchant_label,
              category: dictCat,
            })
            .eq('terminal_code', normCode)
            .eq('category', 'belum_dikategorikan')
        }
      }
    }

    return NextResponse.json({
      transaction: updated,
      dictionary_saved: dictionarySaved,
    })
  } catch (err: any) {
    if (err instanceof EtollAuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status })
    }
    console.error('PATCH /api/etoll/transactions/[id]/tag error:', err)
    return NextResponse.json(
      { error: err?.message || 'Gagal memperbarui label transaksi' },
      { status: 500 },
    )
  }
}
