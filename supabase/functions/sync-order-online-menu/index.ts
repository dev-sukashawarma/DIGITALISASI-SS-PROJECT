import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

serve(async (req) => {
  if (req.method !== "POST") return new Response("Method Not Allowed", { status: 405 });
  const adminUrl = Deno.env.get("SUPABASE_URL");
  const adminKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const onlineUrl = Deno.env.get("ORDER_ONLINE_SUPABASE_URL");
  const onlineKey = Deno.env.get("ORDER_ONLINE_SERVICE_ROLE_KEY");
  if (!adminUrl || !adminKey || !onlineUrl || !onlineKey) return new Response(JSON.stringify({ error: "Sync configuration is incomplete" }), { status: 500 });
  if (req.headers.get("Authorization") !== `Bearer ${adminKey}`) return new Response("Unauthorized", { status: 401 });

  const admin = createClient(adminUrl, adminKey);
  const online = createClient(onlineUrl, onlineKey);
  const { data: jobs, error: loadError } = await admin.from("order_online_menu_sync_queue")
    .select("*").in("status", ["pending", "failed"]).lte("next_attempt_at", new Date().toISOString()).order("created_at").limit(50);
  if (loadError) return new Response(JSON.stringify({ error: loadError.message }), { status: 500 });

  let processed = 0;
  for (const job of jobs || []) {
    await admin.from("order_online_menu_sync_queue").update({ status: "processing", attempts: job.attempts + 1 }).eq("id", job.id);
    try {
      if (job.operation === "delete") {
        const { error } = await online.from("menu_items").delete().eq("id", job.menu_item_id);
        if (error) throw error;
      } else {
        const row = job.payload;
        if (!row.category_id) throw new Error("Menu tidak memiliki kategori");
        const { data: cat } = await admin.from("categories").select("id,name,sort_order").eq("id", row.category_id).single();
        if (!cat) throw new Error("Kategori Admin tidak ditemukan");
        const { data: mapping } = await admin.from("order_online_category_mapping").select("online_category_id").eq("admin_category_id", cat.id).maybeSingle();
        let categoryId = mapping?.online_category_id;
        if (categoryId) {
          const { error: categoryUpdateError } = await online.from("categories").update({ name: cat.name, sort_order: cat.sort_order, is_active: true }).eq("id", categoryId);
          if (categoryUpdateError) throw categoryUpdateError;
        }
        if (!categoryId) {
          const { data: existing } = await online.from("categories").select("id").ilike("name", cat.name).limit(1).maybeSingle();
          if (existing?.id) categoryId = existing.id;
          else {
            const { data: created, error } = await online.from("categories").insert({ name: cat.name, sort_order: cat.sort_order, is_active: true }).select("id").single();
            if (error) throw error;
            categoryId = created.id;
          }
          await admin.from("order_online_category_mapping").upsert({ admin_category_id: cat.id, online_category_id: categoryId, admin_name_snapshot: cat.name });
        }
        const { error } = await online.from("menu_items").upsert({
          id: row.id, category_id: categoryId, name: row.name, description: row.description,
          photo_url: row.image_url, base_price: Number(row.price), compare_price: row.strike_price == null ? null : Number(row.strike_price),
          is_active: true, sort_order: row.sort_order || 0,
        }, { onConflict: "id" });
        if (error) throw error;
        await admin.from("menu_items").update({ order_online_sync_status: "synced", order_online_sync_error: null, order_online_sync_updated_at: new Date().toISOString() }).eq("id", row.id);
      }
      await admin.from("order_online_menu_sync_queue").update({ status: "succeeded", last_error: null }).eq("id", job.id);
      processed++;
    } catch (error) {
      const attempts = job.attempts + 1;
      const delay = Math.min(3600, 30 * 2 ** Math.min(attempts, 7));
      const message = error instanceof Error ? error.message : "Unknown sync error";
      await admin.from("order_online_menu_sync_queue").update({ status: "failed", last_error: message, next_attempt_at: new Date(Date.now() + delay * 1000).toISOString() }).eq("id", job.id);
      if (job.menu_item_id) await admin.from("menu_items").update({ order_online_sync_status: "failed", order_online_sync_error: message, order_online_sync_updated_at: new Date().toISOString() }).eq("id", job.menu_item_id);
    }
  }
  return new Response(JSON.stringify({ processed, queued: jobs?.length || 0 }), { headers: { "Content-Type": "application/json" } });
});
