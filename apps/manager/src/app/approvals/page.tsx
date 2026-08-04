import React from 'react';
import ApprovalsClient from './ApprovalsClient';
import { getVoidOrders } from '../actions/cancellations';

export const dynamic = 'force-dynamic';

export default async function ApprovalsPage() {
  const { data: requests, success, error } = await getVoidOrders();

  if (!success) {
    return (
      <div className="p-8 text-center text-red-500 font-bold bg-white rounded-2xl shadow-sm">
        Gagal memuat data persetujuan: {error}
      </div>
    );
  }

  return <ApprovalsClient initialRequests={requests || []} />;
}
