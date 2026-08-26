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

    const body = await req.json();
    const {
      staff_id, name, role, outlet_id, outlet_ids, status, is_bonus_eligible,
      nik, email: personal_email, phone, address_ktp, address_domicile,
      birth_place, birth_date, gender, religion,
      emergency_name, emergency_relationship, emergency_phone,
      nip, contract_type, join_date, resign_date, leave_quota,
      basic_salary, allowance_position, allowance_presence,
      bank_name, bank_account_number, bank_account_name,
      npwp, bpjs_ketenagakerjaan, bpjs_kesehatan
    } = body;
    if (!staff_id) throw new Error("Missing staff_id");

    const patch: Record<string, unknown> = {};
    if (name !== undefined) patch.name = name;
    if (role !== undefined) patch.role = role;
    if (outlet_id !== undefined) patch.outlet_id = outlet_id;
    if (status !== undefined) patch.status = status;
    if (is_bonus_eligible !== undefined) patch.is_bonus_eligible = Boolean(is_bonus_eligible);
    if (nik !== undefined) patch.nik = nik || null;
    if (personal_email !== undefined) patch.email = personal_email || null;
    if (phone !== undefined) patch.phone = phone || null;
    if (address_ktp !== undefined) patch.address_ktp = address_ktp || null;
    if (address_domicile !== undefined) patch.address_domicile = address_domicile || null;
    if (birth_place !== undefined) patch.birth_place = birth_place || null;
    if (birth_date !== undefined) patch.birth_date = birth_date || null;
    if (gender !== undefined) patch.gender = gender || null;
    if (religion !== undefined) patch.religion = religion || null;
    if (emergency_name !== undefined) patch.emergency_name = emergency_name || null;
    if (emergency_relationship !== undefined) patch.emergency_relationship = emergency_relationship || null;
    if (emergency_phone !== undefined) patch.emergency_phone = emergency_phone || null;
    if (nip !== undefined) patch.nip = nip || null;
    if (contract_type !== undefined) patch.contract_type = contract_type || null;
    if (join_date !== undefined) patch.join_date = join_date || null;
    if (resign_date !== undefined) patch.resign_date = resign_date || null;
    if (leave_quota !== undefined) patch.leave_quota = leave_quota !== null ? Number(leave_quota) : 12;

    if (Object.keys(patch).length > 0) {
      const { error } = await admin.from("outlet_staff").update(patch).eq("id", staff_id);
      if (error) throw error;
    }

    // 2.5 Update financials if provided
    const hasFinancialsInput =
      basic_salary !== undefined ||
      allowance_position !== undefined ||
      allowance_presence !== undefined ||
      bank_name !== undefined ||
      bank_account_number !== undefined ||
      bank_account_name !== undefined ||
      npwp !== undefined ||
      bpjs_ketenagakerjaan !== undefined ||
      bpjs_kesehatan !== undefined;

    if (hasFinancialsInput) {
      const { data: existingFin } = await admin
        .from("staff_financials")
        .select("staff_id")
        .eq("staff_id", staff_id)
        .maybeSingle();

      if (existingFin) {
        const finPatch: Record<string, unknown> = {};
        if (basic_salary !== undefined) finPatch.basic_salary = basic_salary;
        if (allowance_position !== undefined) finPatch.allowance_position = allowance_position;
        if (allowance_presence !== undefined) finPatch.allowance_presence = allowance_presence;
        if (bank_name !== undefined) finPatch.bank_name = bank_name;
        if (bank_account_number !== undefined) finPatch.bank_account_number = bank_account_number;
        if (bank_account_name !== undefined) finPatch.bank_account_name = bank_account_name;
        if (npwp !== undefined) finPatch.npwp = npwp || null;
        if (bpjs_ketenagakerjaan !== undefined) finPatch.bpjs_ketenagakerjaan = bpjs_ketenagakerjaan || null;
        if (bpjs_kesehatan !== undefined) finPatch.bpjs_kesehatan = bpjs_kesehatan || null;
        finPatch.updated_at = new Date().toISOString();

        const { error: finError } = await admin
          .from("staff_financials")
          .update(finPatch)
          .eq("staff_id", staff_id);
        if (finError) throw finError;
      } else {
        const { error: finError } = await admin.from("staff_financials").insert({
          staff_id,
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
        if (finError) throw finError;
      }
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
