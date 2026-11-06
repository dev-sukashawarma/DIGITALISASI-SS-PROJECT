// Edge Function: kasir-order-done  (project FormOrder_SS / order-system)
// Dipanggil oleh POS Kasir saat kasir menekan "Tandai Selesai" untuk order
// yang asalnya online. Update status order-system -> ready, lalu trigger
// WA notifikasi "pesanan siap diambil" ke customer.
//
// Pengamanan (2026-11-06): jalur JWT dulu menerima akun APA PUN yang sah di
// project POS (termasuk akun pelanggan aplikasi). Kini akun itu wajib staf
// POS aktif (outlet_staff, role kasir/superuser).

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const POS_STAFF_ROLES = ["leader", "crew", "regional_manager", "developer", "admin"];

// Perbandingan constant-time untuk cegah timing attack pada token comparison
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

/** Access token POS -> true bila pemiliknya staf POS aktif. */
async function isActivePosStaff(bearer: string): Promise<boolean> {
  const POS_URL = Deno.env.get("POS_SUPABASE_URL");
  const POS_ANON_KEY = Deno.env.get("POS_SUPABASE_ANON_KEY");
  const POS_SERVICE_KEY = Deno.env.get("POS_SUPABASE_SERVICE_ROLE_KEY");
  if (!bearer || !POS_URL || !POS_ANON_KEY || !POS_SERVICE_KEY) return false;

  const userRes = await fetch(`${POS_URL}/auth/v1/user`, {
    headers: { Authorization: `Bearer ${bearer}`, apikey: POS_ANON_KEY },
  });
  if (!userRes.ok) return false;
  const user = await userRes.json().catch(() => null);
  if (!user?.id) return false;

  const { data: staff } = await createClient(POS_URL, POS_SERVICE_KEY)
    .from("outlet_staff")
    .select("role, status")
    .eq("id", user.id)
    .maybeSingle();
  return !!staff && staff.status === "active" && POS_STAFF_ROLES.includes(staff.role);
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  const SHARED_SECRET = Deno.env.get("KASIR_TO_ORDER_SECRET");
  const internalToken = req.headers.get("x-internal-token") ?? "";
  const authorizedViaSecret = !!SHARED_SECRET && !!internalToken && timingSafeEqual(internalToken, SHARED_SECRET);

  let authorizedViaStaffJwt = false;
  if (!authorizedViaSecret) {
    // POS native mengirim access token kasir sendiri (bukan secret — APK
    // disebar lewat WhatsApp dan bisa di-decompile), diverifikasi balik ke
    // project POS.
    const bearer = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
    authorizedViaStaffJwt = await isActivePosStaff(bearer);
  }

  if (!authorizedViaSecret && !authorizedViaStaffJwt) {
    console.error("Token POS Kasir/native tidak valid");
    return Response.json({ error: "Forbidden" }, { status: 403, headers: CORS });
  }

  let body: { external_order_id?: string; pos_order_id?: string };
  try { body = await req.json(); } catch {
    return Response.json({ error: "Body tidak valid" }, { status: 400, headers: CORS });
  }

  let external_order_id = body.external_order_id;
  if (!external_order_id && body.pos_order_id) {
    // Jalur native: cuma punya id order di project POS sendiri (order.id),
    // bukan external_order_id — cari sendiri di sini lewat kolom yang sudah
    // ditulis pull-online-order.
    const POS_URL = Deno.env.get("POS_SUPABASE_URL");
    const POS_SERVICE_KEY = Deno.env.get("POS_SUPABASE_SERVICE_ROLE_KEY");
    if (POS_URL && POS_SERVICE_KEY) {
      const posDb = createClient(POS_URL, POS_SERVICE_KEY);
      const { data: posOrder } = await posDb
        .from("orders")
        .select("external_order_id")
        .eq("id", body.pos_order_id)
        .maybeSingle();
      external_order_id = posOrder?.external_order_id ?? undefined;
    }
  }
  if (!external_order_id) {
    return Response.json({ error: "external_order_id wajib" }, { status: 400, headers: CORS });
  }

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE_KEY  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const db = createClient(SUPABASE_URL, SERVICE_KEY);

  // external_order_id yang dikirim balik oleh pos-kasir = order.id di order-system
  const { data: order, error: orderErr } = await db
    .from("orders")
    .select("id, status, order_number")
    .eq("id", external_order_id)
    .maybeSingle();

  if (orderErr || !order) {
    console.error("Order tidak ditemukan untuk kasir-order-done:", external_order_id, orderErr);
    return Response.json({ error: "Order tidak ditemukan" }, { status: 404, headers: CORS });
  }

  // Idempoten: kalau sudah ready/done, jangan kirim WA dobel
  if (order.status === "ready" || order.status === "done") {
    return Response.json({ ok: true, message: "Sudah diproses sebelumnya (idempoten)" }, { headers: CORS });
  }

  if (order.status !== "paid" && order.status !== "preparing") {
    console.warn("Order status tidak valid untuk diupdate ke ready:", order.status);
    return Response.json({ ok: false, message: `Order status '${order.status}' tidak bisa diupdate ke ready` }, { headers: CORS });
  }

  const { error: updateErr } = await db
    .from("orders")
    .update({ status: "ready", ready_at: new Date().toISOString() })
    .eq("id", order.id)
    .in("status", ["paid", "preparing"]);

  if (updateErr) {
    console.error("Gagal update order ke ready:", updateErr);
    return Response.json({ error: "Internal error" }, { status: 500, headers: CORS });
  }

  console.info("Order diupdate ke ready via POS Kasir:", order.order_number);

  // Trigger send-wa-notifications (fire-and-forget) — notif "siap diambil" ke customer
  fetch(`${SUPABASE_URL}/functions/v1/send-wa-notifications`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${SERVICE_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ order_id: order.id, event: "ready" }),
  }).catch((err) => console.error("Gagal trigger send-wa-notifications:", err));

  return Response.json({ ok: true, message: "Order diupdate ke ready" }, { headers: CORS });
});
