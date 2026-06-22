/// <reference lib="deno.ns" />

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { assertAdmin } from "../_shared/admin-guard.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const url = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(url, serviceKey);

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Missing auth header");
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: userError } = await admin.auth.getUser(token);
    if (userError || !user) throw new Error("Invalid token");

    const { data: caller } = await admin
      .from("outlet_staff").select("role").eq("id", user.id).single();
    assertAdmin(caller);

    const { staff_id, name, role, outlet_id, outlet_ids } = await req.json();
    if (!staff_id) throw new Error("Missing staff_id");

    const patch: Record<string, unknown> = {};
    if (name !== undefined) patch.name = name;
    if (role !== undefined) patch.role = role;
    if (outlet_id !== undefined) patch.outlet_id = outlet_id;

    if (Object.keys(patch).length > 0) {
      const { error } = await admin.from("outlet_staff").update(patch).eq("id", staff_id);
      if (error) throw error;
    }

    // Sinkronkan staff_outlets bila leader (delete-insert)
    if (role === "leader" && Array.isArray(outlet_ids)) {
      await admin.from("staff_outlets").delete().eq("staff_id", staff_id);
      if (outlet_ids.length > 0) {
        const rows = outlet_ids.map((oid: string) => ({ staff_id, outlet_id: oid }));
        const { error: soError } = await admin.from("staff_outlets").insert(rows);
        if (soError) throw soError;
      }
    }

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ ok: false, error: err.message }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
