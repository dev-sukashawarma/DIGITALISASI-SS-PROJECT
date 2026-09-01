'use client'

import { ClipboardCheck, ClipboardList, LayoutDashboard, LogOut, ShieldCheck } from 'lucide-react'
import Link from 'next/link'
import { useAuth } from '@suka/auth'

type Section = 'dashboard' | 'reports' | 'sidak'
const entries = [
  { id: 'dashboard' as const, label: 'Dashboard', shortLabel: 'Beranda', icon: LayoutDashboard, href: '/dashboard' },
  { id: 'reports' as const, label: 'Laporan Inventaris', shortLabel: 'Laporan', icon: ClipboardList, href: '/dashboard/reports' },
  { id: 'sidak' as const, label: 'Hasil Sidak', shortLabel: 'Sidak', icon: ShieldCheck, href: '/dashboard/reports/sidak' },
]

export function AdminInventoryNavigation({ active }: { active: Section }) {
  const { signOut } = useAuth()
  const handleLogout = async () => { await signOut(); window.location.href = process.env.NEXT_PUBLIC_PORTAL_URL || 'https://app.sukashawarma.com' }
  return <>
    <aside className="hidden w-[260px] shrink-0 self-stretch rounded-[2rem] bg-[#4A1713] text-white shadow-xl shadow-orange-950/10 lg:flex lg:flex-col">
      <div className="flex flex-col items-center justify-center p-6 pb-3 text-center"><div className="mb-2 grid h-14 w-14 place-items-center rounded-full border border-white/10 bg-white/5 text-[#f29744] shadow-inner"><ClipboardCheck size={27} /></div><div className="text-lg font-extrabold tracking-tight">Suka<span className="text-[#f29744]">Admin</span></div><div className="mt-1 text-[9px] font-black uppercase tracking-[0.2em] text-[#f29744]/80">Inventori Hub</div></div>
      <div className="flex-1 px-3 py-4"><p className="px-4 py-2 text-[10px] font-black uppercase tracking-[0.18em] text-[#f29744]/80">Inventaris Outlet</p><nav aria-label="Navigasi admin inventori" className="space-y-1">{entries.map(({ id, label, icon: Icon, href }) => <Link key={id} href={href} className={`group flex items-center gap-3 rounded-xl px-4 py-3 text-[13px] font-semibold transition-all ${active === id ? 'bg-white text-[#4A1713] shadow-md' : 'text-white/70 hover:bg-white/10 hover:text-white'}`}><Icon size={17} className={active === id ? 'text-[#4A1713]' : 'text-white/50 group-hover:text-white/80'} />{label}</Link>)}</nav></div>
      <div className="p-4"><button type="button" onClick={() => void handleLogout()} className="flex w-full items-center justify-center gap-2 rounded-xl px-3 py-3 text-[13px] font-bold text-white/60 transition hover:bg-white/10 hover:text-white"><LogOut size={16} /> Logout</button></div>
    </aside>
    <nav aria-label="Navigasi admin inventori mobile" className="fixed inset-x-0 bottom-0 z-40 rounded-t-[24px] border-t border-orange-100 bg-white/95 shadow-[0_-8px_32px_rgba(112,22,4,0.08)] backdrop-blur-2xl lg:hidden" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}><div className="flex h-[76px] items-center justify-around px-2 pt-2">{entries.map(({ id, label, shortLabel, icon: Icon, href }) => <Link key={id} href={href} className="relative flex min-w-0 flex-1 flex-col items-center justify-center gap-1 px-0.5"><span className={`flex h-10 w-10 items-center justify-center rounded-full transition-all duration-300 ${active === id ? 'scale-105 bg-gradient-to-br from-[#f29744] to-[#701604] text-white shadow-md shadow-orange-300/30' : 'text-slate-400'}`}><Icon size={20} /></span><span className={`truncate text-[10px] font-extrabold leading-tight tracking-wide ${active === id ? 'text-[#701604]' : 'text-slate-400'}`}>{shortLabel ?? label}</span></Link>)}</div></nav>
  </>
}
