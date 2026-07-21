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
    <div className="flex flex-col space-y-4 mt-6">
      
      {/* Navigation Tabs (Glassmorphic) */}
      <div className="flex overflow-x-auto space-x-2 pb-2 px-1 scrollbar-hide">
        {tabs.map((tab) => {
          const Icon = tab.icon
          const isActive = activeTab === tab.id
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as TabType)}
              className={`flex items-center px-6 py-3 rounded-full text-sm font-extrabold whitespace-nowrap transition-all duration-300 relative overflow-hidden group ${
                isActive 
                  ? 'text-white bg-gradient-to-r from-suka-orange to-suka-orange/90 shadow-lg shadow-suka-orange/30 scale-105' 
                  : 'bg-white/60 backdrop-blur-md text-suka-gray-500 border border-white hover:bg-white/90 hover:text-suka-brown hover:shadow-md hover:scale-105'
              }`}
            >
              {isActive && (
                <div className="absolute inset-0 bg-white/20 w-1/2 -skew-x-12 -translate-x-full group-hover:translate-x-[250%] transition-transform duration-700 ease-in-out"></div>
              )}
              <Icon className={`w-4 h-4 mr-2 relative z-10 transition-colors duration-300 ${isActive ? 'text-white' : 'text-suka-gray-400 group-hover:text-suka-orange'}`} />
              <span className="relative z-10">{tab.label}</span>
            </button>
          )
        })}
      </div>
      
      {/* Content Area */}
      <div className="w-full animate-fade-in">
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
