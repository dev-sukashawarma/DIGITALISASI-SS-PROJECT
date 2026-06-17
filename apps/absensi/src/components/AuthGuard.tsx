'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { useAuth, hasAppAccess } from '@suka/auth';

const PORTAL_URL = process.env.NEXT_PUBLIC_PORTAL_URL ?? 'https://app.sukashawarma.com';

// Rute yang tidak butuh gate. `/kiosk/*` adalah device kiosk (aktivasi lokal,
// bukan SSO staff) — lihat ADR-008.
const PUBLIC_ROUTES = ['/login', '/'];

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const { session, outletStaff, loading } = useAuth();
  const pathname = usePathname();

  const isPublic = PUBLIC_ROUTES.includes(pathname) || pathname.startsWith('/kiosk');

  // Gate client-side untuk app static-export (ADR-008): tolak ke Portal bila
  // belum login / role tak punya akses 'absensi' / status bukan active.
  const denied =
    !session ||
    !outletStaff ||
    !hasAppAccess(outletStaff.role, 'absensi') ||
    outletStaff.status !== 'active';

  useEffect(() => {
    if (loading || isPublic) return;
    if (denied) {
      // Keamanan data tetap di RLS; ini hanya redirect UX ke gerbang tunggal.
      window.location.replace(PORTAL_URL);
    }
  }, [loading, isPublic, denied]);

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

  // Jangan render halaman protected saat akses ditolak (menunggu redirect).
  if (!isPublic && denied) return null;

  return <>{children}</>;
}
