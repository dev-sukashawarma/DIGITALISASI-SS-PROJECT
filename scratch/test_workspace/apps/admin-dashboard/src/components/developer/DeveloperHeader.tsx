'use client'

import { Bell, Search, Menu } from 'lucide-react'


export const DeveloperHeader = () => {
  return (
    <header className="sticky top-0 z-30 flex items-center justify-between px-6 py-4 bg-white/40 backdrop-blur-xl border-b border-white/20 shadow-[0_4px_24px_rgba(0,0,0,0.02)]">
      <div className="flex items-center gap-4">
        <button className="md:hidden p-2 text-slate-500 hover:bg-white/60 rounded-xl transition-colors">
          <Menu size={20} />
        </button>
        <div className="hidden md:flex items-center gap-2 px-4 py-2 bg-white/60 border border-white/60 rounded-full shadow-sm">
          <Search size={16} className="text-slate-400" />
          <input 
            type="text" 
            placeholder="Search resources..." 
            className="bg-transparent border-none outline-none text-sm text-slate-700 placeholder-slate-400 w-64"
          />
        </div>
      </div>

      <div className="flex items-center gap-4">
        <button className="relative p-2.5 text-slate-500 bg-white/60 border border-white/60 hover:bg-white rounded-xl transition-all shadow-sm active:scale-95">
          <Bell size={18} />
          <span className="absolute top-2 right-2 w-2 h-2 bg-indigo-500 rounded-full ring-2 ring-white"></span>
        </button>
        <div className="flex items-center gap-3 pl-4 border-l border-white/40">
          <div className="text-right hidden sm:block">
            <div className="text-sm font-bold text-slate-800">Developer</div>
            <div className="text-[10px] font-medium text-slate-500 uppercase tracking-wider">Super Admin</div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-500 to-purple-500 flex items-center justify-center text-white font-bold shadow-md ring-2 ring-white/50">
            D
          </div>
        </div>
      </div>
    </header>
  )
}
