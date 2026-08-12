import React from 'react';
import ApprovalsClient from './ApprovalsClient';
import { getVoidOrders } from '../actions/cancellations';
import { getBypassRequests } from '../actions/bypass';

export const dynamic = 'force-dynamic';

export default async function ApprovalsPage() {
  const [voidRes, bypassRes] = await Promise.all([
    getVoidOrders(),
    getBypassRequests(),
  ]);

  if (!voidRes.success && !bypassRes.success) {
    return (
      <div className="p-8 text-center text-red-500 font-bold bg-white rounded-2xl shadow-sm">
        Gagal memuat data persetujuan: {voidRes.error || bypassRes.error}
      </div>
    );
  }

  return (
    <ApprovalsClient
      initialRequests={voidRes.data || []}
      initialBypassRequests={bypassRes.data || []}
    />
  );
}

