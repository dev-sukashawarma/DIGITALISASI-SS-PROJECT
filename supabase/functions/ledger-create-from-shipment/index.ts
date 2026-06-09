// Edge Function: M3 (supply chain) calls this when a shipment is verified.
// M2 owns ledger creation. Creates a terima_kiriman entry per item; the
// ledger triggers update stok_balance. POST JSON:
// { shipment_id, outlet_id, items: [{ bahan_baku_id, qty_terima }] }
import { createClient } from 'jsr:@supabase/supabase-js@2'

interface Item { bahan_baku_id: string; qty_terima: number }
interface Payload { shipment_id: string; outlet_id: string; items: Item[] }

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 })

  let body: Payload
  try { body = await req.json() } catch { return json({ error: 'invalid json' }, 400) }

  if (!body.outlet_id || !body.shipment_id || !Array.isArray(body.items) || body.items.length === 0) {
    return json({ error: 'missing outlet_id/shipment_id/items' }, 400)
  }
  for (const it of body.items) {
    if (!it.bahan_baku_id || typeof it.qty_terima !== 'number' || it.qty_terima <= 0) {
      return json({ error: 'each item needs bahan_baku_id and positive qty_terima' }, 400)
    }
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )

  const rows = body.items.map(it => ({
    outlet_id: body.outlet_id,
    bahan_baku_id: it.bahan_baku_id,
    tipe: 'terima_kiriman',
    qty: it.qty_terima,
    ref_shipment_id: body.shipment_id,
    catatan: 'Terima kiriman (verifikasi M3)',
  }))

  const { data, error } = await supabase.from('ledger_stok').insert(rows).select('id')
  if (error) return json({ error: error.message }, 500)

  return json({ status: 'created', ledger_ids: data?.map(d => d.id) ?? [] }, 200)
})

function json(obj: unknown, status: number) {
  return new Response(JSON.stringify(obj), { status, headers: { 'Content-Type': 'application/json' } })
}
