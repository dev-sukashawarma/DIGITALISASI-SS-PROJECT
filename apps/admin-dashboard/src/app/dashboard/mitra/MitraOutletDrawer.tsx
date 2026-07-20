'use client'

import { useState } from 'react'
import { Info, ShoppingBag, Users, DollarSign, FileText, MessageSquare, X } from 'lucide-react'
import { TabInfoOutlet } from './tabs/TabInfoOutlet'
import { TabOrderan } from './tabs/TabOrderan'
import { TabTim } from './tabs/TabTim'
import { TabInvestasi } from './tabs/TabInvestasi'
import { TabTransfer } from './tabs/TabTransfer'
import { TabSaran } from './tabs/TabSaran'

type TabType = 'info' | 'orderan' | 'tim' | 'investasi' | 'transfer' | 'saran'

export function MitraOutletDrawer({ 
  outlet, 
  userId,
  onClose 
}: { 
  outlet: any,
  userId: string,
  onClose: () => void 
}) {
  const [activeTab, setActiveTab] = useState<TabType>('info')

  const tabs = [
    { id: 'info', label: 'Info Outlet', icon: Info },
    { id: 'orderan', label: 'Orderan', icon: ShoppingBag },
    { id: 'tim', label: 'Tim', icon: Users },
    { id: 'investasi', label: 'Investasi & ROI', icon: DollarSign },
    { id: 'transfer', label: 'Bukti Transfer', icon: FileText },
    { id: 'saran', label: 'Saran', icon: MessageSquare },
  ] as const

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div 
        className="absolute inset-0 bg-black/40 backdrop-blur-sm transition-opacity" 
        onClick={onClose} 
      />
      
      <div className="relative w-full max-w-md bg-white h-full shadow-2xl flex flex-col animate-in slide-in-from-right duration-300">
        <div className="px-6 py-4 border-b flex justify-between items-center bg-gray-50/80">
          <div>
            <h2 className="text-xl font-bold">{outlet.name}</h2>
            <p className="text-sm text-gray-500 truncate max-w-[300px]">{outlet.address || '-'}</p>
          </div>
          <button 
            onClick={onClose} 
            className="p-2 text-gray-500 hover:bg-gray-200 rounded-full transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <div className="px-4 pt-4 border-b">
          <div className="flex overflow-x-auto space-x-2 pb-2 scrollbar-hide">
            {tabs.map((tab) => {
              const Icon = tab.icon
              const isActive = activeTab === tab.id
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as TabType)}
                  className={`flex items-center px-3 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
                    isActive 
                      ? 'bg-blue-100 text-blue-700' 
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  <Icon className="w-4 h-4 mr-1.5" />
                  {tab.label}
                </button>
              )
            })}
          </div>
        </div>
        
        <div className="flex-1 overflow-y-auto p-6">
          {activeTab === 'info' && <TabInfoOutlet outlet={outlet} />}
          {activeTab === 'orderan' && <TabOrderan outletId={outlet.id} />}
          {activeTab === 'tim' && <TabTim outletId={outlet.id} />}
          {activeTab === 'investasi' && <TabInvestasi outletId={outlet.id} />}
          {activeTab === 'transfer' && <TabTransfer outletId={outlet.id} />}
          {activeTab === 'saran' && <TabSaran outletId={outlet.id} userId={userId} />}
        </div>
      </div>
    </div>
  )
}
