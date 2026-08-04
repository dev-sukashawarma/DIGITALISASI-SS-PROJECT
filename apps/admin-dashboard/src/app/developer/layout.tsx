import React from 'react'
import { DeveloperSidebar } from '@/components/developer/DeveloperSidebar'
import { DeveloperHeader } from '@/components/developer/DeveloperHeader'

export default function DeveloperLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen w-full overflow-hidden bg-slate-50 relative font-sans text-slate-800">
      {/* Decorative Background Elements */}
      <div className="absolute top-[-20%] right-[-10%] w-[50%] h-[50%] bg-indigo-400/20 blur-[120px] rounded-full pointer-events-none z-0" />
      <div className="absolute bottom-[-20%] left-[-10%] w-[50%] h-[50%] bg-purple-400/20 blur-[120px] rounded-full pointer-events-none z-0" />
      
      <DeveloperSidebar />
      
      <div className="flex-1 flex flex-col overflow-hidden relative z-10 transition-all">
        <DeveloperHeader />
        
        <main className="flex-1 overflow-y-auto w-full scroll-smooth">
          <div className="w-full max-w-7xl mx-auto p-4 sm:p-6 lg:p-8">
            {children}
          </div>
        </main>
      </div>
    </div>
  )
}
