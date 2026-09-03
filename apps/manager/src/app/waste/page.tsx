export const dynamic = 'force-dynamic'
export const revalidate = 0

import React from 'react'
import { headers } from 'next/headers'
import { parseStaffHeader, STAFF_HEADER } from '@suka/auth'
import WasteClient from './WasteClient'
import {
  getStaffAndAccessibleOutlets,
  getAccessibleOutletsForWaste,
  getPendingWasteReports,
  getWasteHistory,
  getWasteSummary,
} from '../actions/waste'

export const metadata = {
  title: 'Waste Stok | SS Manager',
  description: 'Pengawasan dan Persetujuan Laporan Waste Bahan Baku Outlet',
}

export default async function WastePage() {
  const headersList = await headers()
  const staff = parseStaffHeader(headersList.get(STAFF_HEADER))

  if (!staff) {
    return (
      <div className="p-8 text-center text-red-500 font-bold bg-white rounded-3xl shadow-sm border border-red-100 max-w-md mx-auto my-10">
        Silakan login terlebih dahulu untuk mengakses pengawasan waste.
      </div>
    )
  }

  const { isAllOutlets } = await getStaffAndAccessibleOutlets()
  const todayStr = new Date().toISOString().split('T')[0]

  const [outletsRes, pendingRes, historyRes, summaryRes] = await Promise.all([
    getAccessibleOutletsForWaste(),
    getPendingWasteReports(),
    getWasteHistory({
      from: todayStr,
      to: todayStr,
      page: 1,
      limit: 20,
    }),
    getWasteSummary({
      from: todayStr,
      to: todayStr,
    }),
  ])

  const accessibleOutlets = outletsRes.success ? outletsRes.data : []
  const initialPending = pendingRes.success ? pendingRes.data : []
  const initialHistory = {
    data: historyRes.success ? historyRes.data : [],
    totalCount: historyRes.success ? historyRes.totalCount : 0,
    page: historyRes.success ? historyRes.page : 1,
    totalPages: historyRes.success ? historyRes.totalPages : 1,
  }
  const initialSummary = summaryRes.success
    ? summaryRes.data
    : { totalNilaiWaste: 0, totalIncidents: 0, topItems: [], pendingCount: 0 }

  return (
    <WasteClient
      initialPendingReports={initialPending}
      initialHistory={initialHistory}
      initialSummary={initialSummary}
      accessibleOutlets={accessibleOutlets}
      staffRole={staff.role}
      staffName={staff.name}
      isAllOutlets={isAllOutlets}
    />
  )
}
