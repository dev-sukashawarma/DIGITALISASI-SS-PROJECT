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
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-slate-900/30 backdrop-blur-sm transition-opacity duration-300" 
        onClick={onClose} 
      />
      
      {/* Drawer */}
      <div className="relative w-full max-w-lg bg-white h-full shadow-2xl flex flex-col animate-in slide-in-from-right duration-300">
        
        {/* Header */}
        <div className="px-6 py-5 border-b border-slate-100 flex justify-between items-start bg-slate-50/50">
          <div>
            <div className="flex items-center space-x-2 mb-1">
              <span className="flex h-2 w-2 rounded-full bg-emerald-500"></span>
              <span className="text-xs font-semibold text-emerald-600 uppercase tracking-wider">Live View</span>
            </div>
            <h2 className="text-2xl font-bold text-slate-900">{outlet.name}</h2>
            <p className="text-sm text-slate-500 mt-1 max-w-[320px] leading-relaxed">{outlet.address || 'Alamat tidak tersedia'}</p>
          </div>
          <button 
            onClick={onClose} 
            className="p-2.5 text-slate-400 bg-white border border-slate-200 hover:text-slate-700 hover:bg-slate-50 hover:border-slate-300 rounded-full transition-all shadow-sm"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        
        {/* Navigation Tabs */}
        <div className="px-4 pt-4 border-b border-slate-100 bg-white">
          <div className="flex overflow-x-auto space-x-2 pb-3 scrollbar-hide">
            {tabs.map((tab) => {
              const Icon = tab.icon
              const isActive = activeTab === tab.id
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as TabType)}
                  className={`flex items-center px-4 py-2 rounded-full text-sm font-semibold whitespace-nowrap transition-all duration-200 ${
                    isActive 
                      ? 'bg-amber-100 text-amber-800 shadow-sm border border-amber-200/50' 
                      : 'bg-white text-slate-500 border border-transparent hover:bg-slate-100 hover:text-slate-800'
                  }`}
                >
                  <Icon className={`w-4 h-4 mr-2 ${isActive ? 'text-amber-600' : 'text-slate-400'}`} />
                  {tab.label}
                </button>
              )
            })}
          </div>
        </div>
        
        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-6 bg-slate-50/30">
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
