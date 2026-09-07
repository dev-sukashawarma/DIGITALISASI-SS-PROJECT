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
      
    if (!callerProfile || !["spv", "leader", "admin", "admin_hr", "owner"].includes(callerProfile.role)) {
      throw new Error("Unauthorized: Only SPV/Leader or privileged roles can delete staff");
    }

    const { staff_id } = await req.json();
    if (!staff_id) throw new Error("Missing staff_id");

    // Pastikan target staf ada di outlet yang sama (jika bukan role admin/admin_hr/owner)
    const { data: targetStaff } = await admin
      .from("outlet_staff")
      .select("outlet_id, role")
      .eq("id", staff_id)
      .single();

    if (!targetStaff) throw new Error("Staff not found");

    const isPrivileged = ["admin", "admin_hr", "owner"].includes(callerProfile.role);
    if (!isPrivileged && targetStaff.outlet_id !== callerProfile.outlet_id) {
      throw new Error("Unauthorized: Cannot delete staff from another outlet");
    }

    // Check if staff has operational records (shifts / attendance)
    const { count: shiftCount } = await admin
      .from("shifts")
      .select("*", { count: "exact", head: true })
      .or(`staff_id.eq.${staff_id},closed_by.eq.${staff_id}`);

    const { count: attendanceCount } = await admin
      .from("attendance")
      .select("*", { count: "exact", head: true })
      .eq("outlet_staff_id", staff_id);

    const hasOperationalData = (shiftCount ?? 0) > 0 || (attendanceCount ?? 0) > 0;

    if (hasOperationalData) {
      const today = new Date().toISOString().split('T')[0];
      await admin
        .from("outlet_staff")
        .update({
          status: "inactive",
          is_active: false,
          inactive_reason: "Diarsipkan (memiliki riwayat operasional shift/absensi)",
          resign_date: (targetStaff as any).resign_date || today,
        })
        .eq("id", staff_id);

      await admin.from("staff_outlets").delete().eq("staff_id", staff_id);

      try {
        await admin.auth.admin.deleteUser(staff_id);
      } catch (_) {}

      return new Response(
        JSON.stringify({
          ok: true,
          archived: true,
          message: "Karyawan memiliki riwayat operasional. Akun berhasil diarsipkan (status Nonaktif) & akses login dicabut.",
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Try hard delete
    await admin.from("staff_outlets").delete().eq("staff_id", staff_id);
    await admin.from("staff_financials").delete().eq("staff_id", staff_id);

    const { error: deleteError } = await admin.from("outlet_staff").delete().eq("id", staff_id);
    if (deleteError) {
      // Fallback on foreign key constraint violation
      if (deleteError.code === "23503" || deleteError.message.includes("foreign key constraint")) {
        const today = new Date().toISOString().split('T')[0];
        await admin
          .from("outlet_staff")
          .update({
            status: "inactive",
            is_active: false,
            inactive_reason: "Diarsipkan (terkait data historis)",
            resign_date: today,
          })
          .eq("id", staff_id);

        try {
          await admin.auth.admin.deleteUser(staff_id);
        } catch (_) {}

        return new Response(
          JSON.stringify({
            ok: true,
            archived: true,
            message: "Karyawan terkait dengan data sistem. Akun berhasil diarsipkan (status Nonaktif) & akses login dicabut.",
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      throw deleteError;
    }

    // Delete from auth.users
    try {
      await admin.auth.admin.deleteUser(staff_id);
    } catch (_) {}

    return new Response(JSON.stringify({ ok: true, archived: false, message: "Karyawan berhasil dihapus permanen." }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });

  } catch (err: any) {
    return new Response(JSON.stringify({ ok: false, error: err.message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});
