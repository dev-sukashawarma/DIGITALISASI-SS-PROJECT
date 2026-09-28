import type { ReactNode } from "react";
import { createClient } from "@supabase/supabase-js";
import { MapPinned, ShieldAlert, TriangleAlert } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { staffTepercaya } from "@/lib/auth-server";
import AksesAbsenClient, { type CrewAkses, type OutletPilihan } from "./AksesAbsenClient";
import { PERAN_PENGATUR_AKSES } from "./peran";

// Data izin berubah lewat server action di halaman ini (revalidatePath) — jangan di-cache.
export const dynamic = "force-dynamic";

function Kotak({ ikon, judul, children, nada }: { ikon: ReactNode; judul: string; children: ReactNode; nada: "amber" | "rose" }) {
  const warna = nada === "amber"
    ? "border-amber-200/80 bg-amber-50 text-amber-600"
    : "border-rose-200/80 bg-rose-50 text-rose-600";
  return (
    <div className="max-w-xl mx-auto py-12 px-4">
      <div className={`bg-white rounded-3xl p-8 border shadow-xl text-center space-y-5 ${nada === "amber" ? "border-amber-200/80" : "border-rose-200/80"}`}>
        <div className={`w-16 h-16 rounded-2xl mx-auto flex items-center justify-center border ${warna}`}>
          {ikon}
        </div>
        <div className="space-y-2">
          <h3 className="text-xl font-black text-slate-900 tracking-tight">{judul}</h3>
          <div className="text-sm text-slate-600 leading-relaxed max-w-md mx-auto">{children}</div>
        </div>
      </div>
    </div>
  );
}

/**
 * Akses Absen — admin & developer mengatur outlet tempat crew boleh absen masuk/pulang.
 * Peran dicek di server dari header tepercaya middleware; RPC-nya pun menjaga peran sendiri.
 */
export default async function AksesAbsenPage() {
  const staff = await staffTepercaya();
  if (!staff || staff.status !== "active" || !PERAN_PENGATUR_AKSES.includes(staff.role)) {
    return (
      <Kotak ikon={<ShieldAlert size={32} />} judul="Akses Dibatasi" nada="amber">
        Pengaturan akses absen hanya dapat diubah oleh <strong>Admin</strong> dan <strong>Developer</strong>.
      </Kotak>
    );
  }

  // Baca dengan service role (peran sudah dicek di atas); dua query paralel.
  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || "dummy_key_for_build",
  );
  const [crewRes, outletRes] = await Promise.all([
    admin.rpc("daftar_akses_absen"),
    admin
      .from("outlets")
      .select("id, name, type")
      // Sama dengan atur_akses_absen: outlet nonaktif ditolak (NULL dianggap aktif).
      .not("is_active", "is", false)
      // Outlet virtual tidak ditawarkan; tipe NULL tetap ikut.
      .or("type.is.null,type.not.in.(marketplace,system)")
      .order("name"),
  ]);

  if (crewRes.error || outletRes.error) {
    return (
      <Kotak ikon={<TriangleAlert size={32} />} judul="Gagal Memuat Data Akses" nada="rose">
        <p>{crewRes.error?.message || outletRes.error?.message}</p>
        <p className="mt-2 text-xs text-slate-400">Muat ulang halaman. Bila berlanjut, pastikan migrasi akses absen sudah diterapkan.</p>
      </Kotak>
    );
  }

  const crew: CrewAkses[] = ((crewRes.data ?? []) as any[]).map((r) => ({
    staff_id: r.staff_id,
    nama: r.nama ?? "",
    role: r.role ?? "",
    outlet_id: r.outlet_id ?? null,
    semua_outlet: !!r.semua_outlet,
    penempatan: Array.isArray(r.penempatan) ? r.penempatan : [],
    akses: Array.isArray(r.akses) ? r.akses : [],
  }));
  const outlets: OutletPilihan[] = ((outletRes.data ?? []) as any[]).map((o) => ({
    id: o.id,
    name: o.name ?? "",
    type: o.type ?? null,
  }));

  return (
    <div className="space-y-5 pb-4">
      <PageHeader
        icon={<MapPinned size={22} />}
        title="Akses Absen"
        subtitle="Atur outlet tempat crew boleh absen masuk & pulang"
      />
      <AksesAbsenClient crew={crew} outlets={outlets} />
    </div>
  );
}
