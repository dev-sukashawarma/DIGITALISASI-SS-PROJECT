'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { 
  LogOut, 
  Terminal, 
  Users, 
  Activity, 
  Key, 
  LayoutDashboard,
  ShoppingCart
} from 'lucide-react'
import { useAuth } from '@suka/auth'
import { motion } from 'framer-motion'

const DEV_MENU = [
  { href: '/developer', label: 'Overview', icon: LayoutDashboard },
  { href: '/developer/users', label: 'Global Users', icon: Users },
  { href: '/developer/orders', label: 'Global Orders', icon: ShoppingCart },
  { href: '/developer/system', label: 'System Health', icon: Activity },
  { href: '/developer/apikeys', label: 'API Keys', icon: Key },
]

export const DeveloperSidebar = () => {
  const pathname = usePathname()
  const { signOut } = useAuth()

  const handleLogout = async () => {
    await signOut()
    window.location.href = '/'
  }

  return (
    <aside className="hidden w-[280px] shrink-0 md:flex flex-col z-40 relative border-r border-white/20 bg-white/40 backdrop-blur-xl shadow-[4px_0_24px_rgba(0,0,0,0.02)]">
      <div className="p-8 pb-4 flex flex-col items-center justify-center">
        <div className="w-16 h-16 mb-4 rounded-2xl overflow-hidden flex items-center justify-center bg-gradient-to-br from-indigo-500 to-purple-600 shadow-lg border border-white/40 relative">
          <Terminal className="text-white w-8 h-8 absolute" />
        </div>
        <div className="text-xl font-black text-slate-800 tracking-tight leading-tight">
          Dev<span className="text-indigo-600">Portal</span>
        </div>
        <div className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mt-1">
          Super Admin
        </div>
      </div>

      <div className="flex-1 overflow-y-auto py-6 px-4 space-y-2">
        {DEV_MENU.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(href + '/')
          return (
            <Link
              key={href}
              href={href}
              className="relative group flex items-center gap-4 rounded-2xl px-4 py-3 font-semibold transition-all active:scale-95 overflow-hidden"
            >
              {active && (
                <motion.div 
                  layoutId="devSidebarActive" 
                  className="absolute inset-0 bg-white shadow-sm border border-white/60 rounded-2xl z-0" 
                  transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                />
              )}
              
              <div className={`relative z-10 flex items-center justify-center w-8 h-8 rounded-xl transition-colors ${
                active ? 'bg-indigo-50 text-indigo-600' : 'bg-transparent text-slate-400 group-hover:bg-white/50 group-hover:text-slate-600'
              }`}>
                <Icon size={18} strokeWidth={active ? 2.5 : 2} />
              </div>
              
              <span className={`relative z-10 text-sm transition-colors ${
                active ? 'text-slate-800 font-bold' : 'text-slate-500 group-hover:text-slate-700'
              }`}>
                {label}
              </span>
            </Link>
          )
        })}
      </div>

      <div className="p-6 relative z-10 border-t border-white/20">
        <button
          onClick={handleLogout}
          className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-2xl font-bold text-sm text-slate-500 hover:text-red-600 hover:bg-white/60 transition-all active:scale-95 border border-transparent hover:border-red-100 hover:shadow-sm"
        >
          <LogOut size={18} />
          Sign Out
        </button>
      </div>
    </aside>
  )
}
