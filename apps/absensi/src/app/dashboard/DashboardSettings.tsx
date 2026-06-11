"use client";

import { Trash2, ShieldAlert, ChevronDown } from "lucide-react";
import { createClient } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/lib/feedback/toast";

// Pengaturan jam kerja sudah pindah sepenuhnya ke /dashboard/pengaturan
// (menu "Pengaturan Absensi") agar tidak ada dua tempat pengaturan yang membingungkan.
// Di sini hanya tersisa alat bantu testing, dilipat agar tidak mengganggu.
export function DashboardSettings() {
  const { outletStaff } = useAuth();
  const supabase = createClient();
  const toast = useToast();

  async function resetFaces() {
    if (!outletStaff || !confirm("Yakin mereset semua wajah staff?")) return;
    const { error } = await supabase.from("outlet_staff")
      .update({ face_descriptor: null, ref_photo_url: null, enrolled_at: null })
      .eq("outlet_id", outletStaff.outlet_id);
    if (error) toast.show("err", "Gagal reset wajah");
    else toast.show("ok", "Semua wajah berhasil direset (belum terdaftar)");
  }

  async function resetAttendance() {
    if (!outletStaff || !confirm("Yakin menghapus SEMUA log absensi hari ini?")) return;
    const today = new Date().toISOString().slice(0, 10);
    const { error } = await supabase.from("attendance")
      .delete()
      .eq("outlet_id", outletStaff.outlet_id)
      .gte("ts_server", `${today}T00:00:00`)
      .lte("ts_server", `${today}T23:59:59`);
    if (error) toast.show("err", "Gagal reset log absensi. " + error.message);
    else {
      toast.show("ok", "Log absensi hari ini dihapus. Silakan refresh halaman.");
      setTimeout(() => window.location.reload(), 1500);
    }
  }

  return (
    <details className="group rounded-2xl border border-suka-gray-200 bg-white">
      <summary className="flex cursor-pointer select-none items-center gap-2 px-4 py-3 text-sm font-medium text-gray-500 [&::-webkit-details-marker]:hidden">
        <ShieldAlert size={16} className="text-gray-400" />
        Alat testing (developer)
        <ChevronDown size={16} className="ml-auto text-gray-400 transition-transform group-open:rotate-180" />
      </summary>
      <div className="border-t border-suka-gray-200 px-4 py-4 space-y-3">
        <p className="text-xs text-red-600">Hanya untuk keperluan testing. Data yang dihapus tidak bisa dikembalikan.</p>
        <div className="flex flex-col gap-2 sm:flex-row">
          <button onClick={resetFaces} className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-100 transition-colors">
            <Trash2 size={15} /> Reset Wajah (Un-enroll)
          </button>
          <button onClick={resetAttendance} className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-medium text-amber-700 hover:bg-amber-100 transition-colors">
            <Trash2 size={15} /> Reset Log Hari Ini
          </button>
        </div>
      </div>
    </details>
  );
}
