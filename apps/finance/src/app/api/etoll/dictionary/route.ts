import { NextRequest, NextResponse } from 'next/server'
import { EtollAuthError, requireEtollActor } from '@/lib/etoll/auth'
import { isValidIssuer, normalizeTerminalCode } from '@/lib/etoll/reconcile'
import { getServiceSupabase } from '@/lib/supabase-service'

export const dynamic = 'force-dynamic'

const VALID_DICT_CATEGORIES = new Set([
  'tol',
  'parkir',
  'bbm_merchant',
  'operasional_lain',
  'pribadi_anomali',
  'topup',
])

export async function GET(req: NextRequest) {
  try {
    await requireEtollActor(req, { financeOnly: true })
    const admin = getServiceSupabase()

    const { data, error } = await admin
      .from('etoll_terminal_dictionary')
      .select('*')
      .order('updated_at', { ascending: false })

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ entries: data ?? [] })
  } catch (err: any) {
    if (err instanceof EtollAuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status })
    }
    return NextResponse.json({ error: err?.message || 'Gagal memuat kamus terminal' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const actor = await requireEtollActor(req, { financeOnly: true })
    const body = await req.json()

    const issuer = body.issuer === 'all' ? 'all' : body.issuer
    if (issuer !== 'all' && !isValidIssuer(issuer)) {
      return NextResponse.json({ error: 'Bank penerbit tidak valid' }, { status: 400 })
    }

    const terminalCode = normalizeTerminalCode(body.terminal_code)
    if (!terminalCode) {
      return NextResponse.json({ error: 'Kode terminal wajib diisi' }, { status: 400 })
    }

    const merchantName = String(body.merchant_name ?? '').trim()
    if (!merchantName) {
      return NextResponse.json({ error: 'Nama gerbang tol / merchant wajib diisi' }, { status: 400 })
    }

    const defaultCategory = body.default_category || 'tol'
    if (!VALID_DICT_CATEGORIES.has(defaultCategory)) {
      return NextResponse.json({ error: 'Kategori default tidak valid' }, { status: 400 })
    }

    const admin = getServiceSupabase()
    const { data: saved, error } = await admin
      .from('etoll_terminal_dictionary')
      .upsert(
        {
          issuer,
          terminal_code: terminalCode,
          merchant_name: merchantName,
          default_category: defaultCategory,
          notes: body.notes?.trim() || null,
          updated_by: actor.userId,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'issuer,terminal_code' },
      )
      .select('*')
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    // Backfill transaksi berkode sama yang masih belum dikategorikan
    if (body.backfill !== false) {
      await admin
        .from('etoll_transactions')
        .update({
          merchant_label: merchantName,
          category: defaultCategory,
        })
        .eq('terminal_code', terminalCode)
        .eq('category', 'belum_dikategorikan')
    }

    return NextResponse.json({ entry: saved }, { status: 201 })
  } catch (err: any) {
    if (err instanceof EtollAuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status })
    }
    return NextResponse.json({ error: err?.message || 'Gagal menyimpan kamus terminal' }, { status: 500 })
  }
}
