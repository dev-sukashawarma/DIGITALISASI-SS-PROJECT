'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useAuth } from '@suka/auth'
import { useApprovalList } from '@/hooks/usePermintaan'
import { isApproverRole } from '@/lib/stok/approver'

// Bottom nav crew tunggal & konsisten — dipakai di semua halaman stok.
// Sebelumnya tiap halaman copy-paste nav sendiri dengan isi berbeda
// (Dashboard punya "Permintaan", Ledger/Opname punya "Terima", halaman
// Permintaan tak punya nav sama sekali).
const ITEMS = [
  { href: '/dashboard', icon: '📊', label: 'Dashboard' },
  { href: '/stok/ledger', icon: '📒', label: 'Ledger' },
  { href: '/stok/opname', icon: '📋', label: 'Opname' },
  { href: '/stok/permintaan', icon: '📝', label: 'Permintaan' },
  { href: '/stok/mutasi', icon: '🔄', label: 'Mutasi' },
] as const

export function BottomNav() {
  const pathname = usePathname()
  const { outletStaff } = useAuth()

  const isApprover = isApproverRole(outletStaff?.role)
  const { permintaan } = useApprovalList(isApprover)
  const pendingCount = permintaan.length

  const isActive = (href: string) =>
    href === '/dashboard' ? pathname === '/dashboard' : pathname.startsWith(href)

  return (
    <nav className="fixed bottom-0 left-0 w-full z-50 flex justify-around items-center px-1 py-3 pb-safe bg-[#f5ede3] border-t border-[#877365]/20 shadow-2xl rounded-t-2xl overflow-x-auto hide-scrollbar">
      {ITEMS.map((item) => {
        const active = isActive(item.href)
        const showBadge = item.href === '/stok/permintaan' && pendingCount > 0
        
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? 'page' : undefined}
            className={
              active
                ? 'flex flex-col items-center justify-center bg-[#f29744] text-white rounded-xl px-3 py-2 active:scale-95 transition-all duration-200 cursor-pointer relative shrink-0 min-w-[4rem]'
                : 'flex flex-col items-center justify-center text-[#544437]/75 hover:text-[#701604] px-2 py-1 active:scale-95 transition-all cursor-pointer relative shrink-0 min-w-[4rem]'
            }
          >
            <div className="relative">
              <span className="text-xl">{item.icon}</span>
              {showBadge && (
                <span className="absolute -top-1 -right-2 bg-red-500 text-white text-[9px] w-4 h-4 flex items-center justify-center rounded-full font-bold border-2 border-white/50 animate-in zoom-in duration-300">
                  {pendingCount > 9 ? '9+' : pendingCount}
                </span>
              )}
            </div>
            <span className="text-[9px] font-bold uppercase tracking-wider mt-1 leading-none text-center">
              {item.label}
            </span>
          </Link>
        )
      })}
    </nav>
  )
}
