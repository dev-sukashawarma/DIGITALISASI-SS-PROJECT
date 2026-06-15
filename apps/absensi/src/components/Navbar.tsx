'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@suka/auth';
import { Clock, Camera, ClipboardList, LayoutDashboard, LogOut } from 'lucide-react';

export function Navbar() {
  const { outletStaff, signOut } = useAuth();
  const pathname = usePathname();
  const router = useRouter();

  // Sembunyikan navbar di halaman login
  if (pathname === '/login') return null;

  async function handleLogout() {
    await signOut();
    router.replace('/login'); // replace agar back button tidak bisa balik ke halaman protected
  }

  const links = [
    { href: '/dashboard', label: 'Papan', Icon: LayoutDashboard },
    { href: '/clock',     label: 'Absensi', Icon: Clock },
    { href: '/enroll',    label: 'Enroll', Icon: Camera },
    { href: '/rekap',     label: 'Rekap', Icon: ClipboardList },
  ];

  return (
    <nav className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between sticky top-0 z-50 shadow-sm">
      {/* Kiri: nama outlet + staff */}
      <div>
        <span className="font-bold text-suka-brown text-sm">
          Sukashawarma {outletStaff?.outlets?.name ? `· ${outletStaff.outlets.name}` : ''}
        </span>
        {outletStaff && (
          <span className="ml-2 text-xs text-gray-500">
            ({outletStaff.name} · {outletStaff.role})
          </span>
        )}
      </div>

      {/* Tengah: navigasi */}
      <div className="flex gap-1">
        {links.map(({ href, label, Icon }) => (
          <Link
            key={href}
            href={href}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition ${
              pathname === href
                ? 'bg-suka-orange text-white'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            <Icon size={16} />
            {label}
          </Link>
        ))}
      </div>

      {/* Kanan: tombol logout */}
      <button
        onClick={handleLogout}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium text-red-600 hover:bg-red-50 transition border border-red-200"
      >
        <LogOut size={16} /> Keluar
      </button>
    </nav>
  );
}
