'use client';

import React from 'react';

interface SPVTabsProps {
  activeTab: 'overview' | 'alerts' | 'approval';
  onTabChange: (tab: 'overview' | 'alerts' | 'approval') => void;
  alertCount: number;
  approvalCount: number;
}

export function SPVTabs({ activeTab, onTabChange, alertCount, approvalCount }: SPVTabsProps) {
  const tabs = [
    { id: 'overview', label: 'Overview', count: null },
    { id: 'alerts', label: 'Alerts', count: alertCount },
    { id: 'approval', label: 'Approval Permintaan', count: approvalCount },
  ] as const;

  return (
    <nav className="bg-white border-b border-suka-brown/10 px-6 flex items-center gap-8">
      {tabs.map((tab) => {
        const isActive = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            className={`py-4 font-bold text-sm transition-all border-b-2 relative ${
              isActive
                ? 'border-suka-orange text-suka-orange'
                : 'border-transparent text-suka-brown/70 hover:text-suka-orange'
            }`}
          >
            {tab.label}
            {tab.count !== null && tab.count > 0 && (
              <span className="ml-1.5 bg-red-600 text-white text-[10px] px-1.5 py-0.5 rounded-full font-bold">
                {tab.count}
              </span>
            )}
          </button>
        );
      })}
    </nav>
  );
}
