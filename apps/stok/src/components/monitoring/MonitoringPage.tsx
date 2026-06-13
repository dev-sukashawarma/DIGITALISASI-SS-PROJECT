'use client';

import React, { useEffect, useState } from 'react';
import { SPVDashboard } from './SPVDashboard';
import { CrewDashboard } from './CrewDashboard';
import { useAuth } from '@suka/auth';

export function MonitoringPage() {
  const { outletStaff, loading } = useAuth();
  const [isSPV, setIsSPV] = useState(false);

  useEffect(() => {
    if (loading) return;

    const spvRoles = ['spv'];
    setIsSPV(spvRoles.includes(outletStaff?.role || ''));
  }, [outletStaff?.role, loading]);

  if (loading) {
    return <div className="text-center py-8">Loading...</div>;
  }

  if (!outletStaff) {
    return <div className="text-center py-8 text-red-600">Not authenticated or profile not found</div>;
  }

  return isSPV ? <SPVDashboard /> : <CrewDashboard />;
}
