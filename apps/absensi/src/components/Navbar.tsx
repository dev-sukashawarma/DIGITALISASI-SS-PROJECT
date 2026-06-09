'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';

export function Navbar() {
  const { outletStaff, signOut } = useAuth();
  const pathname = usePathname();
  const router = useRouter();

  // Sembunyikan navbar di halaman login
  if (pathname === '/login') return null;

  async function handleLogout() {
    await signOut();
    router.push('/login');
  }

  const links = [
    { href: '/clock',   label: '🕐 Absensi' },
    { href: '/enroll',  label: '📷 Enroll' },
    { href: '/rekap',   label: '📋 Rekap' },
  ];

  return (
    <nav className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between sticky top-0 z-50 shadow-sm">
      {/* Kiri: nama outlet + staff */}
      <div>
        <span className="font-bold text-suka-brown text-sm">🥙 Sukashawarma</span>
        {outletStaff && (
          <span className="ml-2 text-xs text-gray-500">
            ({outletStaff.name} · {outletStaff.role})
          </span>
        )}
      </div>

      {/* Tengah: navigasi */}
      <div className="flex gap-1">
        {links.map(({ href, label }) => (
          <Link
            key={href}
            href={href}
            className={`px-3 py-1.5 rounded-md text-sm font-medium transition ${
              pathname === href
                ? 'bg-suka-orange text-white'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            {label}
          </Link>
        ))}
      </div>

      {/* Kanan: tombol logout */}
      <button
        onClick={handleLogout}
        className="px-3 py-1.5 rounded-md text-sm font-medium text-red-600 hover:bg-red-50 transition border border-red-200"
      >
        Keluar →
      </button>
    </nav>
  );
}
