import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

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

    // Validasi SPV caller
    const { data: callerProfile } = await admin
      .from("outlet_staff")
      .select("role, outlet_id")
      .eq("id", user.id)
      .single();
      
    if (!callerProfile || !["spv", "kepala_outlet"].includes(callerProfile.role)) {
      throw new Error("Unauthorized: Only SPV can delete staff");
    }

    const { staff_id } = await req.json();
    if (!staff_id) throw new Error("Missing staff_id");

    // Pastikan target staf ada di outlet yang sama
    const { data: targetStaff } = await admin
      .from("outlet_staff")
      .select("outlet_id, role")
      .eq("id", staff_id)
      .single();

    if (!targetStaff) throw new Error("Staff not found");
    if (targetStaff.outlet_id !== callerProfile.outlet_id) {
      throw new Error("Unauthorized: Cannot delete staff from another outlet");
    }

    // 1. Delete from outlet_staff
    const { error: deleteError } = await admin.from("outlet_staff").delete().eq("id", staff_id);
    if (deleteError) throw deleteError;

    // 2. Delete from auth.users (Cascades to other tables if there are foreign keys)
    const { error: authDeleteError } = await admin.auth.admin.deleteUser(staff_id);
    if (authDeleteError) throw authDeleteError;

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });

  } catch (err: any) {
    return new Response(JSON.stringify({ ok: false, error: err.message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});
