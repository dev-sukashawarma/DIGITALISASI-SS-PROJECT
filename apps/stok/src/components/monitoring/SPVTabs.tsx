'use client';

import React from 'react';

interface SPVTabsProps {
  activeTab: 'overview' | 'alerts' | 'compliance';
  onTabChange: (tab: 'overview' | 'alerts' | 'compliance') => void;
  alertCount: number;
}

export function SPVTabs({ activeTab, onTabChange, alertCount }: SPVTabsProps) {
  const tabs = [
    { id: 'overview', label: 'Overview', count: null },
    { id: 'alerts', label: 'Alerts', count: alertCount },
    { id: 'compliance', label: 'Compliance', count: null },
  ] as const;

  return (
    <div className="flex gap-0 border-b border-gray-200">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => onTabChange(tab.id)}
          className={`px-4 py-3 font-medium text-sm border-b-2 transition-colors ${
            activeTab === tab.id
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-gray-600 hover:text-gray-900'
          }`}
        >
          {tab.label}
          {tab.count !== null && (
            <span className="ml-2 bg-red-500 text-white text-xs rounded-full px-2 py-0.5">
              {tab.count}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}
