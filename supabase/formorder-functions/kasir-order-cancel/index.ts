// Edge Function: kasir-order-cancel  (project FormOrder_SS / order-system)
// Dipanggil oleh POS Kasir saat order dibatalkan (cancelled).
// Mengubah status order online menjadi 'cancelled' dan mengirim notifikasi WhatsApp.
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
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Body tidak valid" }, { status: 400, headers: CORS });
  }

  let { external_order_id } = body;
  if (!external_order_id && body.pos_order_id) {
    // Jalur native: cuma punya id order di project POS sendiri — cari sendiri
    // di sini lewat kolom yang sudah ditulis pull-online-order.
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

  // Cari order berdasarkan external_order_id (yaitu id di orders)
  const { data: order, error: orderErr } = await db
    .from("orders")
    .select("id, status")
    .eq("id", external_order_id)
    .maybeSingle();

  if (orderErr || !order) {
    console.error("Order tidak ditemukan untuk kasir-order-cancel:", external_order_id, orderErr);
    return Response.json({ error: "Order tidak ditemukan" }, { status: 404, headers: CORS });
  }

  // Idempoten: jika sudah dibatalkan, jangan lakukan perubahan atau trigger ulang
  if (order.status === "cancelled") {
    return Response.json({ ok: true, message: "Sudah dibatalkan sebelumnya (idempoten)" }, { headers: CORS });
  }

  // Update order's status to 'cancelled' dan set cancelled_at
  const { error: updateErr } = await db
    .from("orders")
    .update({
      status: "cancelled",
      cancelled_at: new Date().toISOString(),
    })
    .eq("id", order.id);

  if (updateErr) {
    console.error("Gagal update order ke cancelled:", updateErr);
    return Response.json({ error: "Internal error" }, { status: 500, headers: CORS });
  }

  console.info("Order diupdate ke cancelled via POS Kasir:", order.id);

  // Trigger send-wa-notifications asynchronously
  fetch(`${SUPABASE_URL}/functions/v1/send-wa-notifications`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${SERVICE_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ order_id: order.id, event: "cancelled" }),
  }).catch((err) => console.error("Gagal trigger send-wa-notifications:", err));

  return Response.json({ ok: true, message: "Order diupdate ke cancelled" }, { headers: CORS });
});
