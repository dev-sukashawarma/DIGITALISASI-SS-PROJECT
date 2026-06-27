// ============================================================
// sync-pos-sales — menyalin penjualan POS (paid + selesai) dari
// project "sistem order" (qntuh…) ke tabel orders DB Utama.
//
// Best practice: idempoten (UPSERT on external_order_id), pakai
// tabel pemetaan outlet (pos_outlet_map), incremental via cursor
// updated_at. Aman dipanggil berulang (cron) maupun manual.
//
// ENV (set via `supabase secrets set`):
//   SUPABASE_URL               -> DB Utama (otomatis tersedia di Edge runtime)
//   SUPABASE_SERVICE_ROLE_KEY  -> DB Utama (otomatis tersedia)
//   ORDER_SYS_URL              -> https://qntuhtkujpwudcpudwbj.supabase.co
//   ORDER_SYS_SERVICE_KEY      -> service role project sistem order
// ============================================================
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.0'

const mainUrl = Deno.env.get('SUPABASE_URL')!
const mainKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const orderUrl = Deno.env.get('ORDER_SYS_URL')!
const orderKey = Deno.env.get('ORDER_SYS_SERVICE_KEY')!

const main = createClient(mainUrl, mainKey)
const order = createClient(orderUrl, orderKey)

// "paid & selesai" = status done DAN (paid_at terisi ATAU bayar tunai/manual).
function isPaidDone(o: any): boolean {
  return o.status === 'done' && (o.paid_at != null || o.payment_method === 'cash' || o.payment_method === 'manual')
}

Deno.serve(async (req) => {
  try {
    // Cursor incremental: sync hanya order yang berubah sejak terakhir.
    // ?full=1 untuk backfill seluruh riwayat.
    const url = new URL(req.url)
    const full = url.searchParams.get('full') === '1'

    const { data: cursorRow } = await main
      .from('pos_sync_state')
      .select('value')
      .eq('key', 'pos_sync_cursor')
      .maybeSingle()
    const since = !full && cursorRow?.value ? String(cursorRow.value) : '1970-01-01T00:00:00Z'

    // 1. Tarik order kandidat dari sistem order.
    let q = order
      .from('orders')
      .select('id, outlet_id, status, payment_method, paid_at, total, created_at, updated_at, customer_name')
      .eq('status', 'done')
      .gte('updated_at', since)
      .order('updated_at', { ascending: true })
      .limit(2000)
    const { data: srcOrders, error: srcErr } = await q
    if (srcErr) throw srcErr

    const candidates = (srcOrders ?? []).filter(isPaidDone)

    // 2. Muat pemetaan outlet.
    const { data: maps, error: mapErr } = await main
      .from('pos_outlet_map')
      .select('source_outlet_id, main_outlet_id')
    if (mapErr) throw mapErr
    const outletMap = new Map<string, string>()
    for (const m of maps ?? []) outletMap.set(m.source_outlet_id, m.main_outlet_id)

    // 3. Bangun baris untuk UPSERT (order_number diisi otomatis oleh trigger DB).
    const rows: any[] = []
    const skipped: string[] = []
    let maxUpdated = since
    for (const o of candidates) {
      if (o.updated_at && o.updated_at > maxUpdated) maxUpdated = o.updated_at
      const mainOutlet = outletMap.get(o.outlet_id)
      if (!mainOutlet) { skipped.push(o.id); continue }
      rows.push({
        external_order_id: o.id,
        outlet_id: mainOutlet,
        customer_name: o.customer_name ?? 'POS Customer',
        status: 'completed',
        payment_method: o.payment_method ?? 'cash',
        total_amount: o.total,
        sales_source: 'pos',
        created_at: o.created_at,
        updated_at: o.updated_at ?? o.created_at,
      })
    }

    // 4. UPSERT idempoten (anti-duplikat lewat external_order_id).
    let upserted = 0
    if (rows.length > 0) {
      const { error: upErr, count } = await main
        .from('orders')
        .upsert(rows, { onConflict: 'external_order_id', count: 'exact' })
      if (upErr) throw upErr
      upserted = count ?? rows.length
    }

    // 5. Simpan cursor.
    if (maxUpdated !== since) {
      await main.from('pos_sync_state').upsert(
        { key: 'pos_sync_cursor', value: maxUpdated, updated_at: new Date().toISOString() },
        { onConflict: 'key' },
      )
    }

    return new Response(JSON.stringify({
      ok: true, full, since,
      candidates: candidates.length, upserted, skipped_unmapped: skipped.length,
      cursor: maxUpdated,
    }), { headers: { 'Content-Type': 'application/json' } })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown error'
    console.error('sync-pos-sales error:', msg)
    return new Response(JSON.stringify({ ok: false, error: msg }), {
      status: 500, headers: { 'Content-Type': 'application/json' },
    })
  }
})
