'use client';

import React from 'react';

export type SPVTabId = 
  | 'overview' 
  | 'alerts' 
  | 'approval' 
  | 'retur_approval' 
  | 'waste_approval' 
  | 'po_inbound' 
  | 'harga_bahan' 
  | 'budget_outlet';

interface SPVTabsProps {
  activeTab: SPVTabId;
  onTabChange: (tab: SPVTabId) => void;
  alertCount: number;
  approvalCount: number;
  returApprovalCount?: number;
  wasteApprovalCount?: number;
  poInboundCount?: number;
  readOnlyTabs?: boolean;
  showPOInbound?: boolean;
  showReturApproval?: boolean;
  showApproval?: boolean;
  showBudgetOutlet?: boolean;
  showWasteApproval?: boolean;
  showHargaBahan?: boolean;
  wasteTabLabel?: string;
}

export function SPVTabs({ 
  activeTab, 
  onTabChange, 
  alertCount, 
  approvalCount, 
  returApprovalCount,
  wasteApprovalCount, 
  poInboundCount, 
  readOnlyTabs = false,
  showPOInbound = false,
  showReturApproval = false,
  showApproval = false,
  showBudgetOutlet = false,
  showWasteApproval = false,
  showHargaBahan = false,
  wasteTabLabel = 'Approval Waste',
}: SPVTabsProps) {
  const allTabs: { id: SPVTabId; label: string; count: number | null }[] = [
    { id: 'overview', label: 'Overview Stok', count: null },
    { id: 'alerts', label: 'Peringatan Stok', count: alertCount },
    ...(showApproval ? [{ id: 'approval' as SPVTabId, label: 'Approval Permintaan', count: approvalCount }] : []),
    ...(showReturApproval ? [{ id: 'retur_approval' as SPVTabId, label: 'Approval Retur', count: returApprovalCount || 0 }] : []),
    ...(showBudgetOutlet ? [{ id: 'budget_outlet' as SPVTabId, label: 'Plafon & Belanja Outlet', count: null }] : []),
    ...(showWasteApproval ? [{ id: 'waste_approval' as SPVTabId, label: wasteTabLabel, count: wasteApprovalCount || 0 }] : []),
    ...(showPOInbound ? [{ id: 'po_inbound' as SPVTabId, label: 'Penerimaan PO Supplier', count: poInboundCount || 0 }] : []),
    ...(showHargaBahan ? [{ id: 'harga_bahan' as SPVTabId, label: 'Master Harga Bahan Baku', count: null }] : []),
  ];

  const tabs = readOnlyTabs
    ? allTabs.filter(t => t.id === 'overview' || t.id === 'alerts')
    : allTabs;

  return (
    <nav className="bg-white border-b border-suka-brown/10 px-4 md:px-6 flex items-center gap-2 overflow-x-auto scrollbar-none whitespace-nowrap py-2">
      {tabs.map((tab) => {
        const isActive = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            className={`px-3.5 py-2 rounded-xl text-xs md:text-sm font-bold transition-all flex items-center gap-2 cursor-pointer ${
              isActive
                ? 'bg-suka-orange text-white shadow-2xs'
                : 'text-suka-brown/70 hover:text-suka-brown hover:bg-suka-cream/50'
            }`}
          >
            <span>{tab.label}</span>
            {tab.count !== null && tab.count > 0 && (
              <span
                className={`text-[10px] font-black px-1.5 py-0.5 rounded-full ${
                  isActive
                    ? 'bg-white text-suka-orange'
                    : 'bg-red-500 text-white'
                }`}
              >
                {tab.count}
              </span>
            )}
          </button>
        );
      })}
    </nav>
  );
}
