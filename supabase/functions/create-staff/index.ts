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
      throw new Error("Unauthorized: Only SPV can create staff");
    }

    const { name, email, password, role } = await req.json();

    if (!name || !email || !password || !role) {
      throw new Error("Missing required fields");
    }

    // SPV hanya boleh membuat kru atau kasir
    if (!["crew", "kasir"].includes(role)) {
       throw new Error("Unauthorized: Cannot create higher roles");
    }

    // 1. Buat User Auth (Bypass confirmation)
    const { data: newUser, error: createError } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { role, name, outlet_id: callerProfile.outlet_id }
    });

    if (createError) throw createError;

    // 2. Insert ke outlet_staff dengan ID yang sama dengan Auth User ID
    const { error: insertError } = await admin.from("outlet_staff").insert({
      id: newUser.user.id,
      outlet_id: callerProfile.outlet_id,
      name,
      role,
      status: "active"
    });

    if (insertError) {
       // Rollback: hapus auth user jika gagal masuk ke outlet_staff
       await admin.auth.admin.deleteUser(newUser.user.id);
       throw insertError;
    }

    return new Response(JSON.stringify({ ok: true, staff_id: newUser.user.id }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });

  } catch (err: any) {
    return new Response(JSON.stringify({ ok: false, error: err.message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});
