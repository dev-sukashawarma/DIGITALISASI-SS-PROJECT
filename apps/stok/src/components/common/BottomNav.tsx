'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useAuth, createSupabaseBrowserClient } from '@suka/auth'
import { useApprovalList } from '@/hooks/usePermintaan'
import { isApproverRole } from '@/lib/stok/approver'
import { useQuery } from '@tanstack/react-query'
import { fetchPendingWasteReports } from '@/app/actions/waste'

// Bottom nav crew tunggal & konsisten — dipakai di semua halaman stok.
export function BottomNav() {
  const pathname = usePathname()
  const { outletStaff } = useAuth()

  const role = outletStaff?.role
  const isApprover = isApproverRole(role)
  const isKitchenOrAdmin = ['kitchen', 'admin', 'admin_finance', 'owner', 'developer'].includes(role ?? '')
  const isLeaderOrSPV = ['spv', 'regional_manager', 'leader', 'area_manager'].includes(role ?? '')

  // 1. Pending Approvals
  const { permintaan } = useApprovalList(isApprover)
  const pendingCount = permintaan.length

  // 2. Pending Waste
  const { data: pendingWaste = [] } = useQuery<any[]>({
    queryKey: ['bottomnav-pending-waste'],
    queryFn: () => fetchPendingWasteReports(),
    enabled: isLeaderOrSPV || isKitchenOrAdmin,
    staleTime: 30000,
  })
  const pendingWasteCount = pendingWaste.length

  // 3. Pending Inbound POs
  const { data: inboundPos = [] } = useQuery({
    queryKey: ['bottomnav-inbound-pos'],
    queryFn: async () => {
      const supabase = createSupabaseBrowserClient()
      const { data, error } = await supabase.rpc('get_purchase_orders', {
        p_from: new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0],
        p_to: new Date().toISOString().split('T')[0],
        p_status: null
      })
      if (error) return []
      return (data ?? []).filter((p: any) => p.status === 'dikirim_ke_supplier' || p.status === 'sebagian_diterima')
    },
    enabled: isKitchenOrAdmin,
    staleTime: 30000,
  })
  const inboundPosCount = inboundPos.length

  const navItems = isKitchenOrAdmin
    ? [
        { href: '/dashboard', icon: '📊', label: 'Dashboard' },
        { href: '/stok/hpp-menu', icon: '🍱', label: 'HPP Menu' },
        { href: '/stok/harga-bahan', icon: '💰', label: 'Harga' },
        { href: '/stok/laporan-penjualan', icon: '📈', label: 'Penjualan' },
        { href: '/stok/penerimaan-po', icon: '🚚', label: 'Terima PO' },
        { href: '/stok/opname', icon: '📋', label: 'Opname' },
        { href: '/stok/permintaan', icon: '📝', label: 'Permintaan' },
        { href: '/stok/ledger', icon: '📒', label: 'Ledger' },
      ]
    : isLeaderOrSPV
    ? [
        { href: '/dashboard', icon: '📊', label: 'Dashboard' },
        { href: '/stok/opname', icon: '📋', label: 'Opname' },
        { href: '/stok/permintaan', icon: '📝', label: 'Permintaan' },
        { href: '/stok/waste-approval', icon: '🗑️', label: 'Waste' },
        { href: '/stok/ledger', icon: '📒', label: 'Ledger' },
      ]
    : [
        { href: '/dashboard', icon: '📊', label: 'Dashboard' },
        { href: '/stok/opname', icon: '📋', label: 'Opname' },
        { href: '/stok/permintaan', icon: '📝', label: 'Permintaan' },
        { href: '/stok/ledger', icon: '📒', label: 'Ledger' },
      ]

  const isActive = (href: string) =>
    href === '/dashboard' ? pathname === '/dashboard' : pathname.startsWith(href)

  return (
    <nav className="fixed bottom-0 left-0 w-full z-50 flex justify-around items-center px-1 py-3 pb-safe bg-[#f5ede3] border-t border-[#877365]/20 shadow-2xl rounded-t-2xl overflow-x-auto hide-scrollbar">
      {navItems.map((item) => {
        const active = isActive(item.href)
        let badgeCount = 0
        let badgeBg = 'bg-red-500'

        if (item.href === '/stok/permintaan') {
          badgeCount = pendingCount
          badgeBg = 'bg-red-500'
        } else if (item.href === '/stok/waste-approval') {
          badgeCount = pendingWasteCount
          badgeBg = 'bg-orange-500'
        } else if (item.href === '/stok/penerimaan-po') {
          badgeCount = inboundPosCount
          badgeBg = 'bg-amber-500'
        }
        
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
              {badgeCount > 0 && (
                <span className={`absolute -top-1 -right-2 ${badgeBg} text-white text-[9px] w-4 h-4 flex items-center justify-center rounded-full font-black border-2 border-white/50 animate-in zoom-in duration-300`}>
                  {badgeCount > 9 ? '9+' : badgeCount}
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
