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
  // leader/korlap/area_manager: multi-outlet via staff_outlets (lihat
  // useOutletScope), TIDAK otomatis akses semua outlet -- perlu allowedOutletIds
  // supaya SPVDashboard tak menampilkan outlet di luar scope-nya.
  const isMultiOutletScoped = role === 'leader' || role === 'korlap' || role === 'area_manager';

  if (role === 'spv' || role === 'kitchen' || role === 'admin' || role === 'admin_hr' || role === 'regional_manager') {
    return <SPVDashboard />;
  }

  if (isMultiOutletScoped) {
    return <SPVDashboard allowedOutletIds={boundOutlets.map((o) => o.id)} />;
  }

  return <CrewDashboard />;
}
