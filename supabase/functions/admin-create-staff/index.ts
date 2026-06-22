/// <reference lib="deno.ns" />

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { assertAdmin, validateCreateInput } from "../_shared/admin-guard.ts";

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

    const body = await req.json();
    validateCreateInput(body);
    const {
      name, username, password, role, outlet_id, outlet_ids,
      nik, email: personal_email, phone, address_ktp, address_domicile,
      birth_place, birth_date, gender, religion,
      emergency_name, emergency_relationship, emergency_phone,
      nip, contract_type, join_date, resign_date, leave_quota,
      basic_salary, allowance_position, allowance_presence,
      bank_name, bank_account_number, bank_account_name,
      npwp, bpjs_ketenagakerjaan, bpjs_kesehatan
    } = body;
    const email = `${String(username).toLowerCase().replace(/[^a-z0-9_]/g, "")}@outlet.local`;

    // 1. Buat auth user
    const { data: newUser, error: createError } = await admin.auth.admin.createUser({
      email, password, email_confirm: true,
      user_metadata: { role, name, outlet_id },
    });
    if (createError) throw createError;

    // 2. Insert outlet_staff dengan id = auth user id
    const { error: insertError } = await admin.from("outlet_staff").insert({
      id: newUser.user.id,
      outlet_id,
      name,
      role,
      username,
      status: "active",
      nik: nik || null,
      email: personal_email || null,
      phone: phone || null,
      address_ktp: address_ktp || null,
      address_domicile: address_domicile || null,
      birth_place: birth_place || null,
      birth_date: birth_date || null,
      gender: gender || null,
      religion: religion || null,
      emergency_name: emergency_name || null,
      emergency_relationship: emergency_relationship || null,
      emergency_phone: emergency_phone || null,
      nip: nip || null,
      contract_type: contract_type || null,
      join_date: join_date || null,
      resign_date: resign_date || null,
      leave_quota: typeof leave_quota === "number" ? leave_quota : 12,
    });
    if (insertError) {
      await admin.auth.admin.deleteUser(newUser.user.id); // rollback
      throw insertError;
    }

    // 2.5 Insert financials if provided
    if (bank_name || bank_account_number || bank_account_name || basic_salary !== undefined) {
      const { error: finError } = await admin.from("staff_financials").insert({
        staff_id: newUser.user.id,
        basic_salary: basic_salary || 0,
        allowance_position: allowance_position || 0,
        allowance_presence: allowance_presence || 0,
        bank_name: bank_name || "",
        bank_account_number: bank_account_number || "",
        bank_account_name: bank_account_name || "",
        npwp: npwp || null,
        bpjs_ketenagakerjaan: bpjs_ketenagakerjaan || null,
        bpjs_kesehatan: bpjs_kesehatan || null,
      });
      if (finError) {
        await admin.from("outlet_staff").delete().eq("id", newUser.user.id);
        await admin.auth.admin.deleteUser(newUser.user.id);
        throw finError;
      }
    }

    // 3. staff_outlets untuk leader
    if (role === "leader" && Array.isArray(outlet_ids)) {
      const rows = outlet_ids.map((oid: string) => ({ staff_id: newUser.user.id, outlet_id: oid }));
      const { error: soError } = await admin.from("staff_outlets").insert(rows);
      if (soError) {
        await admin.from("staff_financials").delete().eq("staff_id", newUser.user.id);
        await admin.from("outlet_staff").delete().eq("id", newUser.user.id);
        await admin.auth.admin.deleteUser(newUser.user.id);
        throw soError;
      }
    }

    return new Response(JSON.stringify({ ok: true, staff_id: newUser.user.id }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ ok: false, error: err.message }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
