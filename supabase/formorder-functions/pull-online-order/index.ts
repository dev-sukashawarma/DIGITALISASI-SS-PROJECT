// Edge Function: pull-online-order  (project FormOrder_SS / order-system)
// Sumber yang ter-deploy disimpan di repo ini (supabase/formorder-functions/)
// karena project order-system terpisah dari project POS utama. Folder ini
// SENGAJA di luar supabase/functions/ supaya `supabase functions deploy`
// untuk project POS tidak ikut men-deploy-nya.
//
// Dipanggil oleh POS native (okhttp) saat ada order baru berstatus 'paid' di
// project ini. Menarik data order dari project ini dan menuliskannya ke tabel
// `orders`/`order_items` milik project POS utama — port dari
// apps/pos-kasir/lib/pullOnlineOrder.ts.
//
// Pengamanan (2026-11-06): fungsi ini bisa dipanggil dengan anon key publik
// project ini, jadi isinya harus aman dipanggil siapa pun:
//  - idempotensi HANYA lewat external_order_id. Dulu id juga dicocokkan ke
//    orders.id POS, dan kalau ketemu order kasir biasa, order itu diubah jadi
//    'online' — siapa pun yang tahu id order kasir bisa memindahkan omzetnya
//    ke kanal Website.
//  - id wajib UUID (sebelumnya disisipkan mentah ke filter .or()).
//  - order wajib sudah dibayar; order pending/expired dulu tetap ditarik dan
//    menjadi omzet tanpa uang.
// Yang tersisa bagi pemanggil tanpa hak: menarik order website yang memang
// sudah dibayar — hal yang sama dilakukan cron pos-kasir tiap menit.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const PAID_STATUSES = ["paid", "preparing", "ready", "done"];

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  let body: { external_order_id?: unknown };
  try { body = await req.json(); } catch {
    return Response.json({ error: "Body tidak valid" }, { status: 400, headers: CORS });
  }
  const external_order_id = body.external_order_id;
  if (typeof external_order_id !== "string" || !UUID_RE.test(external_order_id)) {
    return Response.json({ error: "external_order_id tidak valid" }, { status: 400, headers: CORS });
  }

  const SUPABASE_URL  = Deno.env.get("SUPABASE_URL")!;
  const SERVICE_KEY   = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const POS_URL        = Deno.env.get("POS_SUPABASE_URL");
  const POS_SERVICE_KEY = Deno.env.get("POS_SUPABASE_SERVICE_ROLE_KEY");
  if (!POS_URL || !POS_SERVICE_KEY) {
    console.error("POS_SUPABASE_URL / POS_SUPABASE_SERVICE_ROLE_KEY belum dikonfigurasi");
    return Response.json({ error: "Internal error" }, { status: 500, headers: CORS });
  }

  const ssOrderDb = createClient(SUPABASE_URL, SERVICE_KEY);
  const posDb = createClient(POS_URL, POS_SERVICE_KEY);

  // 1. Idempotensi: order website ini sudah pernah ditarik?
  const { data: existingList } = await posDb
    .from("orders")
    .select("id, order_number")
    .eq("external_order_id", external_order_id)
    .limit(1);
  if (existingList && existingList.length > 0) {
    return Response.json({
      success: true, message: "Order sudah ditarik sebelumnya",
      order_id: existingList[0].id, order_number: existingList[0].order_number,
    }, { headers: CORS });
  }

  // 2. Ambil order dari project ini
  const { data: order, error: orderErr } = await ssOrderDb
    .from("orders")
    .select(`
      id, status, customer_name, customer_wa, total, notes, outlet_id, pickup_time,
      outlets!inner(pos_outlet_id),
      order_items(item_name, quantity, unit_price, note)
    `)
    .eq("id", external_order_id)
    .single();

  if (orderErr || !order) {
    return Response.json({ error: "Order tidak ditemukan" }, { status: 404, headers: CORS });
  }
  if (!PAID_STATUSES.includes(order.status)) {
    return Response.json({ error: `Order belum dibayar (status ${order.status ?? "-"})` }, { status: 409, headers: CORS });
  }

  const posOutletId = Array.isArray(order.outlets)
    ? (order.outlets[0] as any)?.pos_outlet_id
    : (order.outlets as any)?.pos_outlet_id;
  if (!posOutletId) {
    return Response.json({ error: "Outlet belum dipetakan ke POS (pos_outlet_id kosong)" }, { status: 400, headers: CORS });
  }

  // 3. Soft-match: cegah duplikasi kalau kasir sudah input manual duluan
  const timeLimit = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const { data: softMatchList } = await posDb
    .from("orders")
    .select("id, order_number")
    .eq("outlet_id", posOutletId)
    .eq("customer_name", order.customer_name)
    .eq("total_amount", order.total)
    .is("external_order_id", null)
    .gte("created_at", timeLimit)
    .limit(1);

  if (softMatchList && softMatchList.length > 0) {
    const match = softMatchList[0];
    await posDb.from("orders").update({
      source: "online", sales_source: "online", external_order_id,
      updated_at: new Date().toISOString(),
    }).eq("id", match.id).is("external_order_id", null);
    return Response.json({
      success: true, message: "Order sudah ditarik sebelumnya (via soft-match)",
      order_id: match.id, order_number: match.order_number,
    }, { headers: CORS });
  }

  // 4. Format pickup_time & notes untuk POS database
  let posPickupTime: string | null = null;
  if (order.pickup_time && order.pickup_time !== "-") {
    const trimmed = order.pickup_time.trim();
    if (/^\d{1,2}:\d{2}$/.test(trimmed)) {
      const nowWib = new Date(Date.now() + 7 * 60 * 60 * 1000);
      const yyyy = nowWib.getUTCFullYear();
      const mm = String(nowWib.getUTCMonth() + 1).padStart(2, "0");
      const dd = String(nowWib.getUTCDate()).padStart(2, "0");
      const [h, m] = trimmed.split(":").map((v: string) => v.padStart(2, "0"));
      posPickupTime = `${yyyy}-${mm}-${dd}T${h}:${m}:00+07:00`;
    } else {
      posPickupTime = trimmed;
    }
  }

  let posNotes = order.notes || null;
  if (!posNotes || !posNotes.includes("-- INFO PEMESAN ONLINE --")) {
    const infoHeader = [
      `-- INFO PEMESAN ONLINE --`,
      `Nama: ${order.customer_name}`,
      `Telp: ${order.customer_wa || "-"}`,
      `Pembayaran: QRIS`,
      `Ambil: ${order.pickup_time || "-"}`
    ].join("\n");
    posNotes = posNotes ? `${infoHeader}\n\n-- CATATAN PELANGGAN --\n${posNotes}` : infoHeader;
  }

  const { data: newOrder, error: insertErr } = await posDb
    .from("orders")
    .insert({
      outlet_id: posOutletId,
      customer_name: order.customer_name,
      customer_phone: order.customer_wa,
      notes: posNotes,
      payment_method: "qris",
      total_amount: order.total,
      status: "preparing",
      source: "online",
      sales_source: "online",
      external_order_id: order.id,
      pickup_time: posPickupTime,
    })
    .select("id, order_number")
    .single();

  if (insertErr || !newOrder) {
    if ((insertErr as any)?.code === "23505") {
      const { data: retryList } = await posDb
        .from("orders")
        .select("id, order_number")
        .eq("external_order_id", external_order_id)
        .limit(1);
      if (retryList && retryList.length > 0) {
        return Response.json({
          success: true, message: "Order sudah ditarik sebelumnya (race condition)",
          order_id: retryList[0].id, order_number: retryList[0].order_number,
        }, { headers: CORS });
      }
    }
    console.error("Gagal insert order ke POS:", insertErr);
    return Response.json({ error: "Gagal menyimpan pesanan" }, { status: 500, headers: CORS });
  }

  // menu_item_id diisi trigger trg_order_items_isi_menu_dari_nama di DB POS
  // (migration 20260928200000) berdasarkan nama menu.
  const items = order.order_items || [];
  if (items.length > 0) {
    const { error: itemsErr } = await posDb.from("order_items").insert(
      items.map((i: any) => ({
        order_id: newOrder.id,
        menu_item_id: null,
        menu_item_name: i.note ? `${i.item_name}|NOTE|${i.note}` : i.item_name,
        quantity: i.quantity,
        unit_price: i.unit_price,
        subtotal: i.unit_price * i.quantity,
      }))
    );
    if (itemsErr) console.error("Gagal insert order_items:", itemsErr);
  }

  return Response.json({
    success: true, order_id: newOrder.id, order_number: newOrder.order_number,
  }, { headers: CORS });
});
