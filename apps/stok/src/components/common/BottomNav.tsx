'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useAuth, createSupabaseBrowserClient } from '@suka/auth'
import { useApprovalList } from '@/hooks/usePermintaan'
import { isApproverRole } from '@/lib/stok/approver'
import { useQuery } from '@tanstack/react-query'
import { fetchPendingWasteReports } from '@/app/actions/waste'
import {
  LayoutDashboard,
  ClipboardList,
  FileSpreadsheet,
  Truck,
  MoreHorizontal,
  Wallet,
  Tag,
  Calculator,
  TrendingUp,
  BookOpen,
  ArrowLeftRight,
  ArrowDownUp,
  Trash2,
  X,
  ChevronRight,
} from 'lucide-react'

export function BottomNav() {
  const pathname = usePathname()
  const { outletStaff } = useAuth()
  const [isMoreOpen, setIsMoreOpen] = useState(false)

  const role = outletStaff?.role
  const isApprover = isApproverRole(role)
  const isKitchenOrAdmin = ['kitchen', 'purchasing', 'admin', 'admin_finance', 'owner', 'developer'].includes(role ?? '')
  const isLeaderOrSPV = ['spv', 'regional_manager', 'leader', 'area_manager'].includes(role ?? '')
  // Inbound/Outbound = arus barang Gudang Pusat (vendor masuk, kirim ke outlet),
  // jadi khusus staff gudang. Role lain pakai Ledger Stok untuk riwayat outletnya.
  const canViewInboundOutbound = role === 'kitchen'

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
        p_status: null,
      })
      if (error) return []
      return (data ?? []).filter((p: any) => p.status === 'dikirim_ke_supplier' || p.status === 'sebagian_diterima')
    },
    enabled: isKitchenOrAdmin,
    staleTime: 30000,
  })
  const inboundPosCount = inboundPos.length

  // Secondary drawer items for "Lainnya"
  const kitchenAdminMoreItems = [
    {
      href: '/stok/budget-outlet',
      icon: Wallet,
      label: 'Plafon & Belanja',
      desc: 'Monitoring limit & riwayat belanja outlet',
      badge: 0,
    },
    {
      href: '/stok/harga-bahan',
      icon: Tag,
      label: 'Master Harga Bahan Baku',
      desc: 'Master harga beli & supplier bahan baku',
      badge: 0,
    },
    {
      href: '/stok/hpp-menu',
      icon: Calculator,
      label: 'Kalkulator HPP Menu',
      desc: 'Simulasi HPP, margin & harga jual',
      badge: 0,
    },
    {
      href: '/stok/laporan-penjualan',
      icon: TrendingUp,
      label: 'Laporan Penjualan',
      desc: 'Analisis omzet & utilisasi menu POS',
      badge: 0,
    },
    {
      href: '/stok/ledger',
      icon: BookOpen,
      label: 'Buku Ledger Stok',
      desc: 'Kartu stok masuk, keluar & saldo',
      badge: 0,
    },
    ...(canViewInboundOutbound
      ? [
          {
            href: '/stok/inbound-outbound',
            icon: ArrowDownUp,
            label: 'Inbound / Outbound',
            desc: 'Barang masuk vendor & keluar ke outlet',
            badge: 0,
          },
        ]
      : []),
    {
      href: '/stok/mutasi',
      icon: ArrowLeftRight,
      label: 'Mutasi Antar Outlet',
      desc: 'Kirim & terima transfer stok',
      badge: 0,
    },
    {
      href: '/stok/waste-approval',
      icon: Trash2,
      label: 'Approval Waste',
      desc: 'Persetujuan laporan bahan terbuang',
      badge: pendingWasteCount,
    },
  ]

  const leaderMoreItems = [
    {
      href: '/stok/budget-outlet',
      icon: Wallet,
      label: 'Plafon & Belanja',
      desc: 'Monitoring limit & saldo outlet binaan',
      badge: 0,
    },
    {
      href: '/stok/ledger',
      icon: BookOpen,
      label: 'Buku Ledger Stok',
      desc: 'Kartu stok masuk, keluar & saldo',
      badge: 0,
    },
    {
      href: '/stok/mutasi',
      icon: ArrowLeftRight,
      label: 'Mutasi Antar Outlet',
      desc: 'Transfer stok antar outlet binaan',
      badge: 0,
    },
    {
      href: '/stok/penerimaan-po',
      icon: Truck,
      label: 'Terima PO Supplier',
      desc: 'Penerimaan barang inbound',
      badge: inboundPosCount,
    },
  ]

  // Primary bottom tabs (Max 5 items)
  interface PrimaryTab {
    href?: string
    icon: React.ComponentType<{ className?: string }>
    label: string
    badge?: number
    isMore?: boolean
  }

  let primaryTabs: PrimaryTab[] = []

  if (isKitchenOrAdmin) {
    primaryTabs = [
      { href: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
      { href: '/stok/permintaan', icon: ClipboardList, label: 'Permintaan', badge: pendingCount },
      { href: '/stok/opname', icon: FileSpreadsheet, label: 'Opname' },
      { href: '/stok/penerimaan-po', icon: Truck, label: 'Terima PO', badge: inboundPosCount },
      { icon: MoreHorizontal, label: 'Lainnya', isMore: true, badge: pendingWasteCount },
    ]
  } else if (isLeaderOrSPV) {
    primaryTabs = [
      { href: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
      { href: '/stok/permintaan', icon: ClipboardList, label: 'Permintaan', badge: pendingCount },
      { href: '/stok/opname', icon: FileSpreadsheet, label: 'Opname' },
      { href: '/stok/waste-approval', icon: Trash2, label: 'Waste', badge: pendingWasteCount },
      { icon: MoreHorizontal, label: 'Lainnya', isMore: true },
    ]
  } else {
    primaryTabs = [
      { href: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
      { href: '/stok/permintaan', icon: ClipboardList, label: 'Permintaan' },
      { href: '/stok/opname', icon: FileSpreadsheet, label: 'Opname' },
      { href: '/stok/ledger', icon: BookOpen, label: 'Ledger' },
      { href: '/stok/mutasi', icon: ArrowLeftRight, label: 'Mutasi' },
    ]
  }

  const moreItems = isKitchenOrAdmin ? kitchenAdminMoreItems : leaderMoreItems
  const isMoreActive = moreItems.some((item) => pathname.startsWith(item.href))

  const isTabActive = (tab: PrimaryTab) => {
    if (tab.isMore) return isMoreActive
    if (!tab.href) return false
    return tab.href === '/dashboard' ? pathname === '/dashboard' : pathname.startsWith(tab.href)
  }

  return (
    <>
      {/* ── Main Fixed Bottom Nav (< lg) ── */}
      <nav
        aria-label="Navigasi Bawah Mobile"
        className="fixed bottom-0 left-0 right-0 z-40 bg-[#fffdfa]/95 backdrop-blur-md border-t border-suka-brown/15 shadow-[0_-4px_20px_rgba(0,0,0,0.06)] pb-safe"
      >
        <div className="max-w-md mx-auto grid grid-cols-5 items-center h-16 px-1">
          {primaryTabs.map((tab, idx) => {
            const active = isTabActive(tab)
            const Icon = tab.icon
            const badge = tab.badge ?? 0

            if (tab.isMore) {
              return (
                <button
                  key={`tab-more-${idx}`}
                  type="button"
                  onClick={() => setIsMoreOpen(true)}
                  className={`flex flex-col items-center justify-center h-full w-full relative transition-all active:scale-95 cursor-pointer ${
                    active ? 'text-suka-orange' : 'text-suka-brown/60 hover:text-suka-brown'
                  }`}
                >
                  <div className="relative flex items-center justify-center">
                    <div
                      className={`p-1 rounded-xl transition-colors ${
                        active ? 'bg-suka-orange/15 text-suka-orange' : ''
                      }`}
                    >
                      <Icon className="w-5 h-5" />
                    </div>
                    {badge > 0 && (
                      <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[9px] min-w-4 h-4 px-0.5 flex items-center justify-center rounded-full font-black border-2 border-white shadow-xs animate-in zoom-in">
                        {badge > 9 ? '9+' : badge}
                      </span>
                    )}
                  </div>
                  <span
                    className={`text-[10px] font-black tracking-tight leading-tight mt-0.5 ${
                      active ? 'text-suka-orange font-black' : 'text-suka-brown/70 font-semibold'
                    }`}
                  >
                    {tab.label}
                  </span>
                </button>
              )
            }

            return (
              <Link
                key={tab.href}
                href={tab.href!}
                aria-current={active ? 'page' : undefined}
                className={`flex flex-col items-center justify-center h-full w-full relative transition-all active:scale-95 cursor-pointer ${
                  active ? 'text-suka-orange' : 'text-suka-brown/60 hover:text-suka-brown'
                }`}
              >
                <div className="relative flex items-center justify-center">
                  <div
                    className={`p-1 rounded-xl transition-colors ${
                      active ? 'bg-suka-orange/15 text-suka-orange' : ''
                    }`}
                  >
                    <Icon className="w-5 h-5" />
                  </div>
                  {badge > 0 && (
                    <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[9px] min-w-4 h-4 px-0.5 flex items-center justify-center rounded-full font-black border-2 border-white shadow-xs animate-in zoom-in">
                      {badge > 9 ? '9+' : badge}
                    </span>
                  )}
                </div>
                <span
                  className={`text-[10px] tracking-tight leading-tight mt-0.5 truncate max-w-full px-0.5 ${
                    active ? 'text-suka-orange font-black' : 'text-suka-brown/70 font-semibold'
                  }`}
                >
                  {tab.label}
                </span>
              </Link>
            )
          })}
        </div>
      </nav>

      {/* ── Menu Lainnya Bottom Sheet Modal ── */}
      {isMoreOpen && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end lg:hidden">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/40 backdrop-blur-xs animate-in fade-in duration-200"
            onClick={() => setIsMoreOpen(false)}
          />

          {/* Drawer Content */}
          <div className="relative z-10 bg-white border-t border-suka-brown/15 rounded-t-3xl shadow-2xl p-5 pb-8 max-h-[85vh] overflow-y-auto animate-in slide-in-from-bottom duration-250">
            {/* Handle bar */}
            <div className="w-12 h-1.5 bg-suka-brown/20 rounded-full mx-auto mb-4" />

            <div className="flex items-center justify-between pb-3 border-b border-suka-brown/10 mb-4">
              <div>
                <h3 className="text-base font-black text-suka-brown tracking-tight">Menu & Fitur Lainnya</h3>
                <p className="text-[11px] text-suka-brown/60">Akses cepat modul dan laporan operasional stok</p>
              </div>
              <button
                type="button"
                onClick={() => setIsMoreOpen(false)}
                className="w-8 h-8 rounded-full bg-suka-cream/50 flex items-center justify-center text-suka-brown/60 hover:text-suka-brown hover:bg-suka-cream transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* List of secondary tools */}
            <div className="grid grid-cols-1 gap-2.5">
              {moreItems.map((item) => {
                const ItemIcon = item.icon
                const active = pathname.startsWith(item.href)

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setIsMoreOpen(false)}
                    className={`p-3.5 rounded-2xl border transition-all flex items-center justify-between gap-3 group active:scale-[0.99] ${
                      active
                        ? 'bg-suka-orange/10 border-suka-orange ring-1 ring-suka-orange/30'
                        : 'bg-white hover:bg-suka-cream/30 border-suka-brown/10'
                    }`}
                  >
                    <div className="flex items-center gap-3.5 min-w-0">
                      <div
                        className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition-colors ${
                          active
                            ? 'bg-suka-orange text-white shadow-2xs'
                            : 'bg-suka-cream text-suka-brown/80 group-hover:bg-suka-orange group-hover:text-white'
                        }`}
                      >
                        <ItemIcon className="w-5 h-5" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <p
                            className={`text-xs font-black tracking-tight truncate ${
                              active ? 'text-suka-orange' : 'text-suka-brown group-hover:text-suka-orange'
                            }`}
                          >
                            {item.label}
                          </p>
                          {item.badge > 0 && (
                            <span className="bg-red-500 text-white text-[9px] font-black px-1.5 py-0.2 rounded-full">
                              {item.badge}
                            </span>
                          )}
                        </div>
                        <p className="text-[10px] text-suka-brown/60 truncate mt-0.5">{item.desc}</p>
                      </div>
                    </div>
                    <ChevronRight
                      className={`w-4 h-4 shrink-0 transition-transform group-hover:translate-x-0.5 ${
                        active ? 'text-suka-orange' : 'text-suka-brown/30'
                      }`}
                    />
                  </Link>
                )
              })}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
