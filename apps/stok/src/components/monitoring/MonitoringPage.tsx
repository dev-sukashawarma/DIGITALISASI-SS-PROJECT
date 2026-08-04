'use client';

import React from 'react';
import { SPVDashboard } from './SPVDashboard';
import { CrewDashboard } from './CrewDashboard';
import { useAuth } from '@suka/auth';
import { useOutletScope } from '@/hooks/useOutletScope';

export function MonitoringPage() {
  const { outletStaff, loading } = useAuth();
  const { boundOutlets } = useOutletScope();

  if (loading) {
    return <div className="text-center py-8">Loading...</div>;
  }

  if (!outletStaff) {
    return <div className="text-center py-8 text-red-600">Not authenticated or profile not found</div>;
  }

  const role = outletStaff.role;
  // leader/area_manager: multi-outlet via staff_outlets (lihat useOutletScope),
  // TIDAK otomatis akses semua outlet -- perlu allowedOutletIds supaya
  // SPVDashboard tak menampilkan outlet di luar scope-nya.
  //
  // CATATAN: 'korlap' juga multi-outlet via staff_outlets di accessible_outlet_ids()
  // (lihat CLAUDE.md), TAPI tidak ada di union type Role (packages/auth) --
  // dan belum diverifikasi/diuji malam ini (fokus perbaikan cuma area_manager).
  // Sengaja TIDAK ditambahkan di sini supaya tidak menyentuh package auth
  // bersama tanpa verifikasi. Kalau korlap juga kena bug serupa (jatuh ke
  // CrewDashboard), itu perbaikan terpisah -- perlu tambah 'korlap' ke Role
  // union di packages/auth (butuh rebuild dist, lihat memori suka-auth-dist-gotcha)
  // baru aman ditambahkan ke check ini.
  const isMultiOutletScoped = role === 'leader' || role === 'area_manager';

  if (role === 'spv' || role === 'kitchen' || role === 'admin' || role === 'admin_hr' || role === 'regional_manager' || role === 'admin_finance') {
    return <SPVDashboard />;
  }

  if (isMultiOutletScoped) {
    return <SPVDashboard allowedOutletIds={boundOutlets.map((o) => o.id)} />;
  }

  return <CrewDashboard />;
}
