'use client'

import { useState } from 'react'
import { Info, ShoppingBag, Users, DollarSign, FileText, MessageSquare } from 'lucide-react'
import { TabInfoOutlet } from './tabs/TabInfoOutlet'
import { TabOrderan } from './tabs/TabOrderan'
import { TabTim } from './tabs/TabTim'
import { TabInvestasi } from './tabs/TabInvestasi'
import { TabTransfer } from './tabs/TabTransfer'
import { TabSaran } from './tabs/TabSaran'

type TabType = 'info' | 'orderan' | 'tim' | 'investasi' | 'transfer' | 'saran'

export function MitraOutletDetails({ 
  outlet, 
  userId 
}: { 
  outlet: any,
  userId: string
}) {
  const [activeTab, setActiveTab] = useState<TabType>('info')

  const tabs = [
    { id: 'info', label: 'Info', icon: Info },
    { id: 'orderan', label: 'Orderan', icon: ShoppingBag },
    { id: 'tim', label: 'Tim', icon: Users },
    { id: 'investasi', label: 'Investasi', icon: DollarSign },
    { id: 'transfer', label: 'Transfer', icon: FileText },
    { id: 'saran', label: 'Saran', icon: MessageSquare },
  ] as const

  return (
    <div className="flex flex-col space-y-4 mt-2">
      
      {/* Navigation Tabs */}
      <div className="flex overflow-x-auto space-x-2 pb-2 scrollbar-hide">
        {tabs.map((tab) => {
          const Icon = tab.icon
          const isActive = activeTab === tab.id
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as TabType)}
              className={`flex items-center px-5 py-2.5 rounded-xl text-sm font-bold whitespace-nowrap transition-all duration-200 ${
                isActive 
                  ? 'bg-suka-orange text-white shadow-md shadow-suka-orange/20' 
                  : 'bg-white text-suka-gray-500 border border-suka-gray-200 hover:bg-gray-50 hover:text-suka-brown shadow-sm'
              }`}
            >
              <Icon className={`w-4 h-4 mr-2 ${isActive ? 'text-white' : 'text-suka-gray-400'}`} />
              {tab.label}
            </button>
          )
        })}
      </div>
      
      {/* Content Area */}
      <div className={activeTab === 'info' ? 'w-full' : 'w-full bg-white border border-suka-gray-200 rounded-2xl shadow-sm p-6 sm:p-8'}>
        {activeTab === 'info' && <TabInfoOutlet outlet={outlet} />}
        {activeTab === 'orderan' && <TabOrderan outletId={outlet.id} />}
        {activeTab === 'tim' && <TabTim outletId={outlet.id} />}
        {activeTab === 'investasi' && <TabInvestasi outletId={outlet.id} />}
        {activeTab === 'transfer' && <TabTransfer outletId={outlet.id} />}
        {activeTab === 'saran' && <TabSaran outletId={outlet.id} userId={userId} />}
      </div>
    </div>
  )
}
