'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';

const PUBLIC_ROUTES = ['/login', '/'];

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const { session, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  const isPublic = PUBLIC_ROUTES.includes(pathname) || pathname.startsWith('/kiosk');

  useEffect(() => {
    if (loading) return;

    if (!session && !isPublic) {
      // Belum login → paksa ke login, replace history supaya back button tidak bisa balik
      router.replace('/login');
    }

    if (session && pathname === '/login') {
      // Sudah login tapi buka /login → redirect ke dashboard SPV
      router.replace('/dashboard');
    }
  }, [session, loading, isPublic, pathname, router]);

  // Tampilkan loading spinner saat cek auth
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-suka-orange border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm text-gray-500">Memuat...</p>
        </div>
      </div>
    );
  }

  // Jangan render halaman protected kalau belum login
  if (!session && !isPublic) return null;

  return <>{children}</>;
}
