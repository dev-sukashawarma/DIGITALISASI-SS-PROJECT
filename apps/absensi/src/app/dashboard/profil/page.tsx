"use client";

import { useState } from "react";
import { Button, Card, Spinner } from "@suka/design-system";
import { KeyRound, UserRound, AlertTriangle } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { createClient } from "@/lib/supabase";
import { useToast } from "@/lib/feedback/toast";
import { PageHeader } from "@/components/PageHeader";

export default function ProfilKruPage() {
  const { outletStaff, user } = useAuth();
  const supabase = createClient();
  const toast = useToast();

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleUpdatePassword(e: React.FormEvent) {
    e.preventDefault();
    if (password !== confirm) {
      toast.show("err", "Password baru tidak cocok!");
      return;
    }
    if (password.length < 6) {
      toast.show("err", "Password minimal 6 karakter");
      return;
    }

    setSubmitting(true);
    const { error } = await supabase.auth.updateUser({ password });
    
    if (error) {
      toast.show("err", error.message);
    } else {
      toast.show("ok", "Password akun Anda berhasil diperbarui!");
      setPassword("");
      setConfirm("");
    }
    setSubmitting(false);
  }

  if (!outletStaff) return <div className="p-8 flex justify-center"><Spinner /></div>;

  return (
    <div className="space-y-5">
      <PageHeader
        icon={<UserRound size={20} />}
        title="Profil & Keamanan"
        subtitle="Kelola informasi akun pribadi Anda"
      />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-5">
        <div className="md:col-span-1 space-y-4">
          <Card className="p-6 text-center rounded-2xl">
            <div className="w-24 h-24 bg-suka-cream text-suka-brown text-3xl font-bold rounded-full flex items-center justify-center mx-auto mb-4">
              {outletStaff.name.charAt(0)}
            </div>
            <h2 className="text-xl font-bold text-suka-ink">{outletStaff.name}</h2>
            <p className="text-sm text-gray-500 capitalize">{outletStaff.role} · {outletStaff.outlets?.name}</p>
            <div className="mt-4 inline-flex items-center gap-2 px-3 py-1 bg-green-50 text-suka-green rounded-full text-xs font-medium border border-green-200">
              <span className="w-2 h-2 rounded-full bg-suka-green animate-pulse" /> Akun Aktif
            </div>
          </Card>

          <Card className="p-4 rounded-2xl bg-suka-cream border-suka-orange/20 text-sm text-suka-brown flex items-start gap-3">
            <AlertTriangle className="text-suka-orange shrink-0" size={18} />
            <p>Untuk mengubah nama, peran, atau foto biometrik wajah, silakan hubungi SPV / Kepala Outlet Anda.</p>
          </Card>
        </div>

        <div className="md:col-span-2">
          <Card className="p-5 sm:p-6 rounded-2xl">
            <h2 className="text-lg font-bold text-suka-ink mb-4 flex items-center gap-2 border-b border-gray-100 pb-4">
              <KeyRound size={20} className="text-gray-400" /> Ganti Password Login
            </h2>
            
            <form onSubmit={handleUpdatePassword} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email Login</label>
                <input 
                  type="text" 
                  disabled 
                  value={user?.email || ""} 
                  className="w-full px-3 py-2 border border-gray-200 bg-gray-50 text-gray-500 rounded-md" 
                />
                <p className="text-xs text-gray-400 mt-1">Email otomatis, tidak dapat diubah.</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Password Baru</label>
                <input 
                  type="password" 
                  required
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-suka-orange focus:border-suka-orange" 
                  placeholder="Minimal 6 karakter"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Konfirmasi Password Baru</label>
                <input 
                  type="password" 
                  required
                  value={confirm}
                  onChange={e => setConfirm(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-suka-orange focus:border-suka-orange" 
                  placeholder="Ulangi password baru"
                />
              </div>

              <div className="pt-3 flex justify-end">
                <Button type="submit" disabled={submitting || !password} className="w-full sm:w-auto rounded-xl">
                  {submitting ? <Spinner /> : "Update Password"}
                </Button>
              </div>
            </form>
          </Card>
        </div>
      </div>
    </div>
  );
}
