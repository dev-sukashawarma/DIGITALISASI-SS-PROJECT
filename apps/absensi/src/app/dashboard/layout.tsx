"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { LayoutDashboard, ClipboardList, Camera, LogOut, Store, X, Settings2, Users, UserRound, ListChecks, ClipboardCheck, Clock, AlertTriangle, MoreHorizontal } from "lucide-react";

type NavItem = { href: string; label: string; mobileLabel?: string; icon: React.ReactNode };

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { outletStaff, signOut, loading, staffError } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const [moreOpen, setMoreOpen] = useState(false);

  const isSPV = outletStaff?.role === "spv" || outletStaff?.role === "kepala_outlet";

  const navItems: NavItem[] = isSPV ? [
    { href: "/dashboard", label: "Absen", icon: <Clock size={20} /> },
    { href: "/dashboard/papan-kehadiran", label: "Papan Kehadiran", icon: <LayoutDashboard size={20} /> },
    { href: "/dashboard/manajemen-kru", label: "Manajemen Kru", icon: <Users size={20} /> },
    { href: "/dashboard/rekap", label: "Rekap & Riwayat", icon: <ClipboardList size={20} /> },
    { href: "/dashboard/checklist", label: "Manajemen Checklist", icon: <ListChecks size={20} /> },
    { href: "/dashboard/checklist-monitor", label: "Monitor Checklist", icon: <ClipboardCheck size={20} /> },
    { href: "/dashboard/enroll", label: "Daftarkan Wajah", icon: <Camera size={20} /> },
    { href: "/dashboard/pengaturan", label: "Pengaturan Absensi", icon: <Settings2 size={20} /> },
  ] : [
    { href: "/dashboard/kru", label: "Beranda Saya", icon: <LayoutDashboard size={20} /> },
    { href: "/dashboard/kru-checklist", label: "Checklist Harian", icon: <ClipboardCheck size={20} /> },
    { href: "/dashboard/profil", label: "Profil & Password", icon: <UserRound size={20} /> },
  ];

  // ── Bottom bar mobile: hanya menu utama, sisanya masuk sheet "Lainnya" ──
  const mobileMainItems: NavItem[] = isSPV ? [
    { href: "/dashboard", label: "Absen", icon: <Clock size={22} /> },
    { href: "/dashboard/rekap", label: "Rekap", icon: <ClipboardList size={22} /> },
    { href: "/dashboard/checklist-monitor", label: "Monitor", icon: <ClipboardCheck size={22} /> },
    { href: "/dashboard/enroll", label: "Daftar Wajah", icon: <Camera size={22} /> },
  ] : [
    { href: "/dashboard/kru", label: "Beranda", icon: <LayoutDashboard size={22} /> },
    { href: "/dashboard/kru-checklist", label: "Checklist", icon: <ClipboardCheck size={22} /> },
    { href: "/dashboard/profil", label: "Profil", icon: <UserRound size={22} /> },
  ];
  const mobileMainHrefs = new Set(mobileMainItems.map((i) => i.href));
  const mobileMoreItems: NavItem[] = navItems.filter((i) => !mobileMainHrefs.has(i.href));

  const isActive = (href: string) =>
    pathname === href || (href !== "/dashboard" && pathname.startsWith(href + "/"));
  const moreActive = mobileMoreItems.some((i) => isActive(i.href));

  // Redirect crew trying to access SPV-only routes
  // Gunakan WHITELIST rute kru (lebih aman dari blacklist yang bisa salah tangkap)
  React.useEffect(() => {
    if (!loading && outletStaff && !isSPV) {
      const kruAllowedPaths = ["/dashboard/kru", "/dashboard/kru-checklist", "/dashboard/profil"];
      const isAllowed = kruAllowedPaths.some(p => pathname === p || pathname.startsWith(p + "/"));
      if (!isAllowed) {
        router.replace("/dashboard/kru");
      }
    }
  }, [outletStaff, isSPV, loading, pathname, router]);

  // Tutup sheet "Lainnya" tiap pindah halaman
  React.useEffect(() => { setMoreOpen(false); }, [pathname]);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-50">
        <div className="w-8 h-8 border-4 border-suka-orange border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // ── Akun login valid tapi tidak punya record outlet_staff ──
  // Tampilkan pesan error yang informatif alih-alih loading selamanya
  if (!outletStaff) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-50 p-4">
        <div className="w-full max-w-md bg-white rounded-2xl shadow-lg border border-gray-200 p-8 text-center space-y-4">
          <div className="mx-auto w-16 h-16 rounded-full bg-amber-50 flex items-center justify-center">
            <AlertTriangle size={32} className="text-amber-500" />
          </div>
          <h2 className="text-xl font-bold text-suka-ink">Profil Staff Tidak Ditemukan</h2>
          <p className="text-sm text-gray-500 leading-relaxed">
            {staffError || "Akun Anda belum terhubung dengan data staff outlet. Hubungi admin / SPV untuk mendaftarkan akun Anda ke outlet."}
          </p>
          <button
            onClick={async () => { await signOut(); router.replace("/login"); }}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium text-red-600 hover:bg-red-50 transition-colors border border-red-200"
          >
            <LogOut size={18} />
            Keluar & Login Ulang
          </button>
        </div>
      </div>
    );
  }

  async function handleLogout() {
    await signOut();
    router.replace("/login");
  }

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden">
      {/* Sidebar — hanya desktop. Di mobile diganti bottom navigation bar */}
      <aside className="hidden lg:flex w-64 bg-white border-r border-gray-200 flex-col shrink-0">
        <div className="h-full flex flex-col">
          {/* Logo / Outlet Info */}
          <div className="p-6 border-b border-gray-100">
            <h2 className="text-2xl font-bold text-suka-orange flex items-center gap-2">
              <Store className="text-suka-brown" />
              SukaAbsen
            </h2>
            <p className="mt-2 text-sm text-gray-500 font-medium">
              Cabang: <span className="text-suka-ink">{outletStaff?.outlets?.name || "–"}</span>
            </p>
          </div>

          {/* Nav Links */}
          <nav className="flex-1 px-4 py-6 space-y-1 overflow-y-auto">
            {navItems.map((item) => {
              // Root dashboard hanya aktif saat persis; menu lain juga aktif di sub-halamannya
              const active = isActive(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-colors ${
                    active
                      ? "bg-suka-orange/10 text-suka-orange"
                      : "text-gray-600 hover:bg-gray-50 hover:text-suka-ink"
                  }`}
                >
                  <span className={active ? "text-suka-orange" : "text-gray-400"}>{item.icon}</span>
                  {item.label}
                </Link>
              );
            })}
          </nav>

          {/* User Profile & Logout */}
          <div className="p-4 border-t border-gray-100">
            <div className="flex items-center gap-3 px-4 py-3 bg-slate-50 rounded-lg border border-gray-100 mb-3">
              <div className="w-8 h-8 rounded-full bg-suka-brown flex items-center justify-center text-white font-bold text-sm">
                {outletStaff?.name?.charAt(0) || "?"}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-suka-ink truncate">{outletStaff?.name}</p>
                <p className="text-xs text-gray-500 capitalize truncate">{outletStaff?.role}</p>
              </div>
            </div>

            <button
              onClick={handleLogout}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium text-red-600 hover:bg-red-50 transition-colors"
            >
              <LogOut size={18} />
              Keluar
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden">
        {/* Mobile Header — tanpa hamburger, navigasi pindah ke bottom bar */}
        <header className="lg:hidden sticky top-0 z-10 flex items-center justify-between px-4 py-3 bg-white/95 backdrop-blur border-b border-gray-200">
          <h2 className="text-base font-bold text-suka-brown flex items-center gap-2 truncate">
            <Store size={20} className="shrink-0" />
            <span className="truncate">{outletStaff?.outlets?.name || "SukaAbsen"}</span>
          </h2>
          <div className="w-7 h-7 rounded-full bg-suka-brown flex items-center justify-center text-white font-bold text-xs shrink-0">
            {outletStaff?.name?.charAt(0) || "?"}
          </div>
        </header>

        {/* Content Scrollable — beri ruang bawah untuk bottom bar di mobile */}
        <main className="flex-1 overflow-y-auto bg-slate-50 px-4 pt-5 pb-28 sm:px-6 sm:pt-6 lg:p-8 lg:pb-8">
          <div className="max-w-4xl mx-auto">
            {children}
          </div>
        </main>
      </div>

      {/* ── Sheet "Lainnya" (mobile) ── */}
      {moreOpen && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/50 lg:hidden"
            onClick={() => setMoreOpen(false)}
          />
          <div className="fixed inset-x-0 bottom-0 z-50 lg:hidden bg-white rounded-t-2xl shadow-2xl border-t border-gray-200 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] animate-[slideUp_0.2s_ease-out]">
            <div className="flex items-center justify-between px-5 pt-4 pb-2">
              <span className="text-sm font-bold text-suka-ink">Menu Lainnya</span>
              <button onClick={() => setMoreOpen(false)} className="p-1.5 text-gray-400 rounded-lg hover:bg-gray-50" aria-label="Tutup menu">
                <X size={20} />
              </button>
            </div>

            {mobileMoreItems.length > 0 && (
              <nav className="px-3 pb-2 space-y-0.5 max-h-[50vh] overflow-y-auto">
                {mobileMoreItems.map((item) => {
                  const active = isActive(item.href);
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setMoreOpen(false)}
                      className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-colors ${
                        active
                          ? "bg-suka-orange/10 text-suka-orange"
                          : "text-gray-600 hover:bg-gray-50"
                      }`}
                    >
                      <span className={active ? "text-suka-orange" : "text-gray-400"}>{item.icon}</span>
                      {item.label}
                    </Link>
                  );
                })}
              </nav>
            )}

            {/* User Profile & Logout */}
            <div className="px-3 pt-2 border-t border-gray-100 mx-2">
              <div className="flex items-center gap-3 px-4 py-3">
                <div className="w-9 h-9 rounded-full bg-suka-brown flex items-center justify-center text-white font-bold text-sm">
                  {outletStaff?.name?.charAt(0) || "?"}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-suka-ink truncate">{outletStaff?.name}</p>
                  <p className="text-xs text-gray-500 capitalize truncate">{outletStaff?.role}</p>
                </div>
                <button
                  onClick={handleLogout}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium text-red-600 hover:bg-red-50 transition-colors"
                >
                  <LogOut size={16} />
                  Keluar
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* ── Bottom Navigation Bar (mobile only) ── */}
      <nav className="lg:hidden fixed inset-x-0 bottom-0 z-30 bg-white/95 backdrop-blur border-t border-gray-200 pb-[env(safe-area-inset-bottom)]">
        <div className={`grid ${mobileMainItems.length === 3 ? "grid-cols-4" : "grid-cols-5"}`}>
          {mobileMainItems.map((item) => {
            const active = isActive(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMoreOpen(false)}
                className={`flex flex-col items-center justify-center gap-1 pt-2.5 pb-2 transition-colors ${
                  active && !moreOpen ? "text-suka-orange" : "text-gray-400"
                }`}
              >
                {item.icon}
                <span className="text-[10px] font-semibold leading-none">{item.label}</span>
              </Link>
            );
          })}
          <button
            onClick={() => setMoreOpen((v) => !v)}
            className={`flex flex-col items-center justify-center gap-1 pt-2.5 pb-2 transition-colors ${
              moreOpen || moreActive ? "text-suka-orange" : "text-gray-400"
            }`}
            aria-label="Menu lainnya"
          >
            <MoreHorizontal size={22} />
            <span className="text-[10px] font-semibold leading-none">Lainnya</span>
          </button>
        </div>
      </nav>
    </div>
  );
}
