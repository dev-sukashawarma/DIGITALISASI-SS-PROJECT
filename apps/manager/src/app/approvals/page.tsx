import React from 'react';
import ApprovalsClient from './ApprovalsClient';
import { getVoidOrders } from '../actions/cancellations';
import { getBypassRequests } from '../actions/bypass';
import { getPendingReturRequests } from '../actions/retur';

export const dynamic = 'force-dynamic';

export default async function ApprovalsPage() {
  const [voidRes, bypassRes, returRes] = await Promise.all([
    getVoidOrders(),
    getBypassRequests(),
    getPendingReturRequests(),
  ]);

  if (!voidRes.success && !bypassRes.success && !returRes.success) {
    return (
      <div className="p-8 text-center text-red-500 font-bold bg-white rounded-2xl shadow-sm">
        Gagal memuat data persetujuan: {voidRes.error || bypassRes.error || returRes.error}
      </div>
    );
  }

  return (
    <ApprovalsClient
      initialRequests={voidRes.data || []}
      initialBypassRequests={bypassRes.data || []}
      initialReturRequests={returRes.data || []}
    />
  );
}

