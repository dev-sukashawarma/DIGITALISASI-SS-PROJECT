"use client";

import { useEffect, useState } from "react";
import { Avatar, Button, Spinner } from "@suka/design-system";
import { Users, UserPlus, KeyRound, Edit, Trash2, Check, X as XIcon, Power } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { createClient } from "@/lib/supabase";
import { useToast } from "@/lib/feedback/toast";
import { generateStaffEmail } from "@/lib/utils/email-generator";
import { PageHeader } from "@/components/PageHeader";

type StaffRow = {
  id: string;
  name: string;
  role: string;
  status: string;
};

export default function ManajemenKruPage() {
  const { outletStaff, session } = useAuth();
  const supabase = createClient();
  const toast = useToast();

  const [staff, setStaff] = useState<StaffRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Add Form State (semua staf baru dibuat sebagai "crew"; role diubah lewat Edit)
  const [showAddForm, setShowAddForm] = useState(false);
  const [newName, setNewName] = useState("");
  const newRole = "crew";
  const [newPassword, setNewPassword] = useState("sukashawarma123");

  // Edit State
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editRole, setEditRole] = useState("");

  useEffect(() => {
    if (!outletStaff?.outlet_id) return;
    loadStaff();
  }, [outletStaff]);

  async function loadStaff() {
    setLoading(true);
    const { data } = await supabase
      .from("outlet_staff")
      .select("id, name, role, status")
      .eq("outlet_id", outletStaff!.outlet_id)
      .order("created_at", { ascending: false });
    if (data) setStaff(data);
    setLoading(false);
  }

  async function handleCreateStaff(e: React.FormEvent) {
    e.preventDefault();
    if (!newName || !newPassword || !session?.access_token) return;

    const generatedEmail = generateStaffEmail(newName, outletStaff!.outlet_id);
    setSubmitting(true);
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/create-staff`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          name: newName,
          email: generatedEmail,
          password: newPassword,
          role: newRole
        })
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "Gagal membuat staf");

      toast.show("ok", `Staf ${newName} berhasil dibuat! Email login: ${generatedEmail}`);
      setNewName("");
      setNewPassword("sukashawarma123");
      setShowAddForm(false);
      loadStaff();
    } catch (err: any) {
      toast.show("err", err.message);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSaveEdit(id: string) {
    const { error } = await supabase.from("outlet_staff")
      .update({ name: editName, role: editRole })
      .eq("id", id);

    if (error) {
      toast.show("err", "Gagal menyimpan perubahan");
    } else {
      toast.show("ok", "Data staf berhasil diupdate");
      setEditingId(null);
      loadStaff();
    }
  }

  async function handleToggleStatus(id: string, currentStatus: string) {
    const newStatus = currentStatus === "active" ? "inactive" : "active";
    const { error } = await supabase.from("outlet_staff").update({ status: newStatus }).eq("id", id);
    if (error) toast.show("err", "Gagal merubah status");
    else loadStaff();
  }

  async function handleDelete(id: string, name: string) {
    if (!confirm(`Yakin ingin MENGHAPUS staf ${name} secara permanen? Akun login mereka juga akan dihapus.`)) return;
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/delete-staff`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${session?.access_token}`
        },
        body: JSON.stringify({ staff_id: id })
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error);
      toast.show("ok", `Staf ${name} berhasil dihapus`);
      loadStaff();
    } catch (err: any) {
      toast.show("err", err.message);
    }
  }

  function startEdit(s: StaffRow) {
    setEditingId(s.id);
    setEditName(s.name);
    setEditRole(s.role);
  }

  if (loading) return <div className="p-8 flex justify-center"><Spinner /></div>;

  const statusBadge = (status: string) => (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${
      status === "active" ? "bg-[#e1f5ee] text-[#085041]" : "bg-[#fcebeb] text-[#a32d2d]"
    }`}>
      <span className={`h-1.5 w-1.5 rounded-full ${status === "active" ? "bg-suka-green" : "bg-red-500"}`} />
      {status === "active" ? "Aktif" : "Nonaktif"}
    </span>
  );

  return (
    <div className="space-y-5">
      <PageHeader
        icon={<Users size={20} />}
        title="Manajemen Kru"
        subtitle="Kelola daftar karyawan di cabang Anda"
        action={
          <Button onClick={() => setShowAddForm(!showAddForm)} className="flex w-full items-center justify-center gap-2 rounded-xl sm:w-auto">
            <UserPlus size={18} /> Tambah Staf Baru
          </Button>
        }
      />

      {showAddForm && (
        <div className="rounded-2xl border-2 border-suka-orange/40 bg-white p-4 sm:p-6">
          <h2 className="mb-4 flex items-center gap-2 text-base font-bold text-suka-ink">
            <UserPlus size={18} className="text-suka-orange" /> Form Pendaftaran Staf Baru
          </h2>
          <form onSubmit={handleCreateStaff} className="space-y-4">
            <div className="grid grid-cols-1 gap-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Nama Lengkap</label>
                <input
                  type="text" required value={newName} onChange={e => setNewName(e.target.value)}
                  className="w-full rounded-xl border border-gray-300 px-3 py-2.5 outline-none focus:border-suka-orange focus:ring-2 focus:ring-suka-orange/20"
                  placeholder="Budi Santoso"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Password Sementara</label>
                <div className="flex">
                  <span className="inline-flex items-center rounded-l-xl border border-r-0 border-gray-300 bg-gray-50 px-3 text-gray-500">
                    <KeyRound size={16} />
                  </span>
                  <input type="text" required value={newPassword} onChange={e => setNewPassword(e.target.value)} className="w-full rounded-r-xl border border-gray-300 px-3 py-2.5 outline-none focus:border-suka-orange focus:ring-2 focus:ring-suka-orange/20" />
                </div>
                <p className="mt-1 text-xs text-gray-400">Kru bisa mengganti password sendiri di menu Profil setelah login.</p>
              </div>
            </div>
            <div className="flex flex-col-reverse gap-2 pt-1 sm:flex-row sm:justify-end">
              <Button type="button" variant="ghost" onClick={() => setShowAddForm(false)} className="rounded-xl">Batal</Button>
              <Button type="submit" disabled={submitting} className="rounded-xl">{submitting ? <Spinner /> : "Simpan Akun Kru"}</Button>
            </div>
          </form>
        </div>
      )}

      {/* ===== Mobile: daftar kartu ===== */}
      <div className="space-y-3 md:hidden">
        {staff.map((s) => {
          const isEditing = editingId === s.id;
          const isMe = s.id === outletStaff?.id;
          return (
            <div key={s.id} className="rounded-2xl border border-suka-gray-200 bg-white p-4">
              {isEditing ? (
                <div className="space-y-3">
                  <input type="text" value={editName} onChange={(e) => setEditName(e.target.value)}
                    className="w-full rounded-xl border border-suka-orange px-3 py-2.5 outline-none focus:ring-2 focus:ring-suka-orange/20" />
                  <select value={editRole} onChange={(e) => setEditRole(e.target.value)}
                    className="w-full rounded-xl border border-suka-orange px-3 py-2.5 outline-none">
                    <option value="crew">Crew</option>
                    <option value="kasir">Kasir</option>
                    <option value="spv">SPV</option>
                    <option value="kepala_outlet">Kepala Outlet</option>
                  </select>
                  <div className="flex gap-2">
                    <button onClick={() => setEditingId(null)} className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl border border-gray-200 px-3 py-2.5 text-sm font-medium text-gray-600">
                      <XIcon size={16} /> Batal
                    </button>
                    <button onClick={() => handleSaveEdit(s.id)} className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl bg-suka-green px-3 py-2.5 text-sm font-medium text-white">
                      <Check size={16} /> Simpan
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="flex items-center gap-3">
                    <Avatar name={s.name} size={40} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="truncate text-sm font-semibold text-suka-ink">{s.name}</span>
                        {isMe && <span className="shrink-0 rounded-full bg-suka-brown px-1.5 py-0.5 text-[10px] text-white">Anda</span>}
                      </div>
                      <div className="text-xs capitalize text-gray-500">{s.role}</div>
                    </div>
                    {statusBadge(s.status)}
                  </div>
                  <div className="mt-3 flex gap-2 border-t border-suka-gray-200/70 pt-3">
                    <button onClick={() => startEdit(s)}
                      className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl border border-gray-200 px-2 py-2 text-xs font-medium text-blue-600 hover:bg-blue-50">
                      <Edit size={14} /> Edit
                    </button>
                    {!isMe && (
                      <>
                        <button onClick={() => handleToggleStatus(s.id, s.status)}
                          className={`flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl border border-gray-200 px-2 py-2 text-xs font-medium ${s.status === "active" ? "text-amber-600 hover:bg-amber-50" : "text-suka-green hover:bg-green-50"}`}>
                          <Power size={14} /> {s.status === "active" ? "Nonaktifkan" : "Aktifkan"}
                        </button>
                        <button onClick={() => handleDelete(s.id, s.name)}
                          className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl border border-gray-200 px-2 py-2 text-xs font-medium text-red-600 hover:bg-red-50">
                          <Trash2 size={14} /> Hapus
                        </button>
                      </>
                    )}
                  </div>
                </>
              )}
            </div>
          );
        })}
        {staff.length === 0 && (
          <div className="rounded-2xl border border-suka-gray-200 bg-white px-4 py-10 text-center text-sm text-gray-500">
            Belum ada staf terdaftar di cabang ini.
          </div>
        )}
      </div>

      {/* ===== Desktop: tabel ===== */}
      <div className="hidden overflow-hidden rounded-2xl border border-suka-gray-200 bg-white md:block">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-suka-gray-200 bg-suka-gray-50/60 text-gray-500">
            <tr>
              <th className="px-4 py-3 font-medium">Nama Staf</th>
              <th className="px-4 py-3 font-medium">Posisi</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 text-right font-medium">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-suka-gray-200/70">
            {staff.map((s) => {
              const isEditing = editingId === s.id;
              const isMe = s.id === outletStaff?.id;
              return (
                <tr key={s.id} className="group transition-colors hover:bg-suka-gray-50/50">
                  <td className="px-4 py-3 font-medium text-suka-ink">
                    {isEditing ? (
                      <input type="text" value={editName} onChange={(e) => setEditName(e.target.value)} className="w-full rounded-lg border border-suka-orange px-2 py-1.5 outline-none" />
                    ) : (
                      <div className="flex items-center gap-2.5">
                        <Avatar name={s.name} size={32} />
                        {s.name} {isMe && <span className="rounded-full bg-suka-brown px-1.5 py-0.5 text-[10px] text-white">Anda</span>}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3 capitalize text-gray-500">
                    {isEditing ? (
                      <select value={editRole} onChange={(e) => setEditRole(e.target.value)} className="w-full rounded-lg border border-suka-orange px-2 py-1.5 outline-none">
                        <option value="crew">Crew</option>
                        <option value="kasir">Kasir</option>
                        <option value="spv">SPV</option>
                        <option value="kepala_outlet">Kepala Outlet</option>
                      </select>
                    ) : (
                      s.role
                    )}
                  </td>
                  <td className="px-4 py-3">{statusBadge(s.status)}</td>
                  <td className="px-4 py-3 text-right">
                    {isEditing ? (
                      <div className="flex justify-end gap-1">
                        <button onClick={() => setEditingId(null)} className="rounded-lg p-2 text-gray-500 hover:bg-gray-100" title="Batal"><XIcon size={16} /></button>
                        <button onClick={() => handleSaveEdit(s.id)} className="rounded-lg p-2 text-suka-green hover:bg-green-50" title="Simpan"><Check size={16} /></button>
                      </div>
                    ) : (
                      <div className="flex justify-end gap-1">
                        <button onClick={() => startEdit(s)}
                          className="rounded-lg p-2 text-blue-600 hover:bg-blue-50" title="Edit Staf"><Edit size={16} /></button>
                        {!isMe && (
                          <>
                            <button onClick={() => handleToggleStatus(s.id, s.status)}
                              className={`rounded-lg p-2 ${s.status === "active" ? "text-amber-600 hover:bg-amber-50" : "text-suka-green hover:bg-green-50"}`}
                              title={s.status === "active" ? "Nonaktifkan" : "Aktifkan"}><Power size={16} /></button>
                            <button onClick={() => handleDelete(s.id, s.name)}
                              className="rounded-lg p-2 text-red-600 hover:bg-red-50" title="Hapus Permanen"><Trash2 size={16} /></button>
                          </>
                        )}
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
            {staff.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-gray-500">
                  Belum ada staf terdaftar di cabang ini.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
