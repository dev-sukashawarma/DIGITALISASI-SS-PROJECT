"use server";

import { createClient } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";

const SETTINGS_ALLOWED_ROLES = ["admin", "admin_hr", "regional_manager"];

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

async function verifySettingsRole(supabaseAdmin: ReturnType<typeof getSupabaseAdmin>, callerStaffId?: string | null) {
  if (!callerStaffId) return;
  const { data: staff } = await supabaseAdmin
    .from("outlet_staff")
    .select("role, status")
    .eq("id", callerStaffId)
    .maybeSingle();

  if (!staff || staff.status !== "active" || !SETTINGS_ALLOWED_ROLES.includes(staff.role)) {
    throw new Error("Akses Ditolak: Hanya Admin, Admin HR, dan Regional Manager yang diizinkan mengubah konfigurasi absensi.");
  }
}

export async function saveGlobalConfig(formData: FormData) {
  const supabaseAdmin = getSupabaseAdmin();
  const caller_staff_id = formData.get("caller_staff_id") as string | null;
  await verifySettingsRole(supabaseAdmin, caller_staff_id);

  const jam_masuk = formData.get("jam_masuk") as string;
  const jam_keluar = formData.get("jam_keluar") as string;
  const toleransi_menit = parseInt(formData.get("toleransi_menit") as string || "0", 10);
  const absen_window_mode = formData.get("absen_window_mode") as string;
  const is_active = formData.get("is_active") === "true";
  const overwrite_all = formData.get("overwrite_all") === "on";

  const globalValue = { jam_masuk, jam_keluar, toleransi_menit, absen_window_mode };

  const { error: errGlobal } = await supabaseAdmin
    .from("global_settings")
    .upsert({ key: "global_attendance_config", value: globalValue });
  
  if (errGlobal) throw new Error(errGlobal.message);

  const { error: errOutlet } = await supabaseAdmin
    .from("outlets")
    .update({ is_active })
    .neq("id", "00000000-0000-0000-0000-000000000000"); // update all
  
  if (errOutlet) throw new Error(errOutlet.message);

  if (overwrite_all) {
    const { error: errDel } = await supabaseAdmin
      .from("outlet_attendance_config")
      .delete()
      .neq("outlet_id", "00000000-0000-0000-0000-000000000000"); // delete all exceptions
    if (errDel) throw new Error(errDel.message);
  }

  revalidatePath("/dashboard/pengaturan");
  return { success: true };
}

export async function saveOutletException(formData: FormData) {
  const supabaseAdmin = getSupabaseAdmin();
  const caller_staff_id = formData.get("caller_staff_id") as string | null;
  await verifySettingsRole(supabaseAdmin, caller_staff_id);

  const outlet_id = formData.get("outlet_id") as string;
  const jam_masuk = formData.get("jam_masuk") as string;
  const jam_keluar = formData.get("jam_keluar") as string;
  const toleransi_menit = parseInt(formData.get("toleransi_menit") as string || "0", 10);
  const absen_window_mode = formData.get("absen_window_mode") as string;
  const is_active_str = formData.get("is_active");
  const is_active = is_active_str === "true";

  if (!outlet_id) throw new Error("Pilih outlet terlebih dahulu");

  const { error: errConfig } = await supabaseAdmin
    .from("outlet_attendance_config")
    .upsert({ 
      outlet_id, 
      jam_masuk, 
      jam_keluar, 
      toleransi_menit, 
      absen_window_mode 
    });
  
  if (errConfig) throw new Error(errConfig.message);

  if (is_active_str !== null) {
    const { error: errOutlet } = await supabaseAdmin
      .from("outlets")
      .update({ is_active })
      .eq("id", outlet_id);
    
    if (errOutlet) throw new Error(errOutlet.message);
  }

  revalidatePath("/dashboard/pengaturan");
  return { success: true };
}

export async function deleteOutletException(outlet_id: string, callerStaffId?: string) {
  const supabaseAdmin = getSupabaseAdmin();
  await verifySettingsRole(supabaseAdmin, callerStaffId);

  const { error } = await supabaseAdmin
    .from("outlet_attendance_config")
    .delete()
    .eq("outlet_id", outlet_id);
  
  if (error) throw new Error(error.message);

  revalidatePath("/dashboard/pengaturan");
  return { success: true };
}

export async function deleteAllExceptions(callerStaffId?: string) {
  const supabaseAdmin = getSupabaseAdmin();
  await verifySettingsRole(supabaseAdmin, callerStaffId);

  const { error } = await supabaseAdmin
    .from("outlet_attendance_config")
    .delete()
    .neq("outlet_id", "00000000-0000-0000-0000-000000000000"); // delete all
  
  if (error) throw new Error(error.message);

  revalidatePath("/dashboard/pengaturan");
  return { success: true };
}
