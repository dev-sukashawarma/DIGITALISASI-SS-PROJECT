'use client'

import { ClipboardList, LayoutDashboard, ShieldCheck } from 'lucide-react'
import { useRouter } from 'next/navigation'

type Section = 'reports' | 'sidak'

const entries = [
  { id: 'reports' as const, label: 'Laporan inventaris', mobileLabel: 'Laporan', icon: ClipboardList, href: '/dashboard/reports' },
  { id: 'sidak' as const, label: 'Hasil sidak', mobileLabel: 'Sidak', icon: ShieldCheck, href: '/dashboard/reports/sidak' },
]

export function AdminInventoryNavigation({ active }: { active: Section }) {
  const router = useRouter()
  const navigate = (href: string) => router.push(href)
  return <>
    <aside className="hidden self-start rounded-3xl border border-orange-100 bg-white p-3 shadow-sm md:sticky md:top-5 md:block">
      <p className="px-3 pb-2 pt-1 text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">Admin Inventori</p>
      <nav aria-label="Navigasi admin inventori" className="space-y-1">
        {entries.map(({ id, label, icon: Icon, href }) => <button key={id} type="button" onClick={() => navigate(href)} className={`flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left text-sm font-extrabold transition ${active === id ? 'bg-[#701604] text-white shadow-md shadow-orange-950/15' : 'text-slate-600 hover:bg-orange-50 hover:text-[#701604]'}`}><Icon size={17} />{label}</button>)}
      </nav>
      <button type="button" onClick={() => navigate('/dashboard')} className="mt-3 flex w-full items-center gap-3 rounded-2xl border border-orange-100 px-3 py-3 text-left text-sm font-bold text-slate-500 transition hover:border-orange-200 hover:bg-orange-50 hover:text-[#701604]"><LayoutDashboard size={17} /> Dashboard</button>
    </aside>
    <nav aria-label="Navigasi admin inventori mobile" className="fixed inset-x-3 bottom-3 z-40 flex items-center justify-around rounded-2xl border border-orange-100 bg-white/95 p-1.5 shadow-2xl shadow-orange-950/15 backdrop-blur md:hidden">
      {[...entries, { id: 'dashboard' as const, label: 'Dashboard', mobileLabel: 'Beranda', icon: LayoutDashboard, href: '/dashboard' }].map(({ id, mobileLabel, icon: Icon, href }) => <button key={id} type="button" onClick={() => navigate(href)} className={`grid min-w-20 place-items-center gap-1 rounded-xl px-3 py-2 text-[10px] font-extrabold transition ${active === id ? 'bg-orange-50 text-[#701604]' : 'text-slate-500'}`}><Icon size={18} />{mobileLabel}</button>)}
    </nav>
  </>
}
