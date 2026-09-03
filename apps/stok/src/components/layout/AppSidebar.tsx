'use client'

import React from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useAuth, createSupabaseBrowserClient } from '@suka/auth'
import { useOutletScope } from '@/hooks/useOutletScope'
import { useOutletBudgetStatus } from '@/hooks/useOutletBudget'
import { useApprovalList } from '@/hooks/usePermintaan'
import { isApproverRole } from '@/lib/stok/approver'
import { useQuery } from '@tanstack/react-query'
import { fetchPendingWasteReports } from '@/app/actions/waste'
import {
  LayoutDashboard,
  Tag,
  Truck,
  ClipboardList,
  FileSpreadsheet,
  Trash2,
  TrendingUp,
  BookOpen,
  ArrowLeftRight,
  ArrowDownUp,
  Calculator,
  LogOut,
  ExternalLink,
  ChefHat,
  Store,
  Wallet,
} from 'lucide-react'

function formatRp(n: number) {
  return `Rp ${Math.round(n).toLocaleString('id-ID')}`
}

function getPeriodLabel(periodType: string | null, customDays?: number | null): string {
  if (!periodType) return ''
  if (periodType === 'custom' && customDays) return `${customDays} Hari`
  const labels: Record<string, string> = { harian: 'Harian', mingguan: 'Mingguan', bulanan: 'Bulanan' }
  return labels[periodType] ?? periodType
}

interface AppSidebarProps {
  onCloseMobile?: () => void
}

export function AppSidebar({ onCloseMobile }: AppSidebarProps) {
  const pathname = usePathname()
  const { outletStaff, signOut } = useAuth()
  const { selectedOutletId } = useOutletScope()

  const targetOutletId = selectedOutletId || outletStaff?.outlet_id || undefined
  const { status: budget } = useOutletBudgetStatus(targetOutletId)

  const pct = budget?.hasConfig && budget.nominal > 0
    ? Math.min(100, (budget.terpakai / budget.nominal) * 100)
    : 0
  const isOver = budget?.hasConfig && budget.terpakai > budget.nominal
  const isNear = !isOver && pct >= 80

  const role = outletStaff?.role

  // Role permissions
  const isApprover = isApproverRole(role)
  const canReceivePO = ['kitchen', 'purchasing', 'admin', 'owner', 'admin_finance', 'developer'].includes(role ?? '')
  const canViewVendorPrices = ['kitchen', 'purchasing', 'admin_finance', 'admin', 'owner', 'spv', 'regional_manager', 'leader', 'area_manager', 'developer'].includes(role ?? '')
  const canApproveWaste = ['kitchen', 'spv', 'regional_manager', 'leader', 'area_manager', 'admin', 'owner', 'developer', 'purchasing'].includes(role ?? '')
  const canViewSales = ['kitchen', 'admin', 'owner', 'admin_finance', 'developer', 'purchasing'].includes(role ?? '')
  // Inbound/Outbound = arus barang Gudang Pusat (vendor masuk, kirim ke outlet),
  // jadi khusus staff gudang. Role lain pakai Ledger Stok untuk riwayat outletnya.
  const canViewInboundOutbound = role === 'kitchen'
  const canViewHPP = ['kitchen', 'purchasing', 'admin_finance', 'admin', 'owner', 'spv', 'regional_manager', 'developer'].includes(role ?? '')

  // 1. Pending Approvals Permintaan
  const { permintaan } = useApprovalList(isApprover)
  const pendingApprovalsCount = permintaan.length

  // 2. Pending Waste Reports
  const { data: pendingWaste = [] } = useQuery<any[]>({
    queryKey: ['sidebar-pending-waste'],
    queryFn: () => fetchPendingWasteReports(),
    enabled: canApproveWaste,
    staleTime: 30000,
  })
  const pendingWasteCount = pendingWaste.length

  // 3. Pending Inbound POs
  const { data: inboundPos = [] } = useQuery({
    queryKey: ['sidebar-inbound-pos'],
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
    enabled: canReceivePO,
    staleTime: 30000,
  })
  const inboundPosCount = inboundPos.length

  const handleLogout = async () => {
    await signOut()
    const portalUrl = process.env.NEXT_PUBLIC_PORTAL_URL || 'https://app.sukashawarma.com'
    let url = portalUrl
    if (typeof window !== 'undefined' && window.location.hostname === 'localhost') {
      url = 'http://localhost:3010'
    }
    window.location.href = url
  }

  const portalUrl = process.env.NEXT_PUBLIC_PORTAL_URL || 'https://app.sukashawarma.com'
  let resolvedPortalUrl = portalUrl
  if (typeof window !== 'undefined' && window.location.hostname === 'localhost') {
    resolvedPortalUrl = 'http://localhost:3010'
  }

  const isActive = (href: string) => {
    if (href === '/dashboard') return pathname === '/dashboard'
    return pathname.startsWith(href)
  }

  const navGroups = [
    {
      title: 'UTAMA',
      items: [
        {
          label: 'Monitoring Stok',
          href: '/dashboard',
          icon: LayoutDashboard,
        },
        ...(canViewVendorPrices
          ? [
              {
                label: 'Master Harga Bahan Baku',
                href: '/stok/harga-bahan',
                icon: Tag,
              },
            ]
          : []),
      ],
    },
    {
      title: 'OPERASIONAL DAPUR',
      items: [
        ...(canReceivePO
          ? [
              {
                label: 'Penerimaan PO (Inbound)',
                href: '/stok/penerimaan-po',
                icon: Truck,
                badge: inboundPosCount > 0 ? `${inboundPosCount}` : undefined,
                badgeColor: 'bg-amber-500 text-white',
              },
            ]
          : []),
        {
          label: 'Permintaan Bahan',
          href: '/stok/permintaan',
          icon: ClipboardList,
          badge: isApprover && pendingApprovalsCount > 0 ? `${pendingApprovalsCount}` : undefined,
          badgeColor: 'bg-red-500 text-white',
        },
        {
          label: 'Stok Opname',
          href: '/stok/opname',
          icon: FileSpreadsheet,
        },
        ...(canApproveWaste
          ? [
              {
                label: 'Persetujuan Waste',
                href: '/stok/waste-approval',
                icon: Trash2,
                badge: pendingWasteCount > 0 ? `${pendingWasteCount}` : undefined,
                badgeColor: 'bg-orange-500 text-white',
              },
            ]
          : []),
      ],
    },
    {
      title: 'ANALISIS & LAPORAN',
      items: [
        ...(canViewHPP
          ? [
              {
                label: 'HPP Setiap Menu',
                href: '/stok/hpp-menu',
                icon: Calculator,
              },
            ]
          : []),
        ...(canViewSales
          ? [
              {
                label: 'Laporan Penjualan',
                href: '/stok/laporan-penjualan',
                icon: TrendingUp,
              },
              {
                label: 'Plafon & Belanja Outlet',
                href: '/stok/budget-outlet',
                icon: Wallet,
              },
            ]
          : []),
        ...(canViewInboundOutbound
          ? [
              {
                label: 'Inbound / Outbound',
                href: '/stok/inbound-outbound',
                icon: ArrowDownUp,
              },
            ]
          : []),
        {
          label: 'Ledger Stok',
          href: '/stok/ledger',
          icon: BookOpen,
        },
        {
          label: 'Mutasi Stok',
          href: '/stok/mutasi',
          icon: ArrowLeftRight,
        },
      ],
    },
  ]

  const getRoleLabel = (role?: string) => {
    switch (role) {
      case 'kitchen': return '👨‍🍳 Central Kitchen'
      case 'purchasing': return '🛒 Purchasing / Pengadaan'
      case 'spv': return '👔 Supervisor'
      case 'admin': return '⚡ Admin Pusat'
      case 'owner': return '👑 Owner'
      case 'area_manager':
      case 'leader': return '🎖️ Area Leader'
      default: return '🏪 Outlet Staff'
    }
  }

  return (
    <aside className="w-64 h-full flex flex-col justify-between bg-white border-r border-suka-brown/10 select-none">
      {/* Top Branding, Profile, Budget & Navigation */}
      <div className="flex flex-col flex-1 min-h-0">
        {/* Brand Logo & Name */}
        <div className="p-5 border-b border-suka-brown/10 flex items-center justify-between shrink-0">
          <Link
            href="/dashboard"
            onClick={onCloseMobile}
            className="flex items-center gap-2.5 group"
          >
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-suka-orange to-orange-500 flex items-center justify-center text-white shadow-xs group-hover:scale-105 transition-transform">
              <ChefHat className="w-5 h-5" />
            </div>
            <div>
              <div className="font-black text-sm text-suka-brown tracking-tight leading-tight">
                SUKA SHAWARMA
              </div>
              <div className="text-[10px] font-bold text-suka-orange uppercase tracking-wider">
                Stok & Kitchen Hub
              </div>
            </div>
          </Link>
        </div>

        {/* User Profile Card */}
        {outletStaff && (
          <div className="p-3 mx-3 mt-3 bg-suka-cream/40 rounded-2xl border border-suka-brown/10 flex items-center gap-2.5 shrink-0">
            <div className="w-8 h-8 rounded-full bg-suka-orange/20 text-suka-orange flex items-center justify-center font-black text-xs shrink-0">
              {outletStaff.name?.charAt(0) || 'U'}
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-xs font-black text-suka-brown truncate leading-tight">
                {outletStaff.name}
              </div>
              <div className="text-[10px] font-bold text-suka-brown/60 truncate mt-0.5">
                {getRoleLabel(outletStaff.role)}
              </div>
            </div>
          </div>
        )}

        {/* Plafon Budget Saldo Card */}
        {budget?.hasConfig && (
          <div className={`p-3 mx-3 mt-2.5 rounded-2xl border transition-all shadow-2xs shrink-0 ${
            isOver
              ? 'bg-red-50/90 border-red-200 text-red-950'
              : isNear
              ? 'bg-amber-50/90 border-amber-200 text-amber-950'
              : 'bg-emerald-50/80 border-emerald-200/80 text-emerald-950'
          }`}>
            <div className="flex items-center justify-between mb-1.5">
              <div className="flex items-center gap-1.5 min-w-0">
                <div className={`w-6 h-6 rounded-lg flex items-center justify-center shrink-0 ${
                  isOver
                    ? 'bg-red-200/70 text-red-700'
                    : isNear
                    ? 'bg-amber-200/70 text-amber-700'
                    : 'bg-emerald-200/70 text-emerald-700'
                }`}>
                  <Wallet className="w-3.5 h-3.5" />
                </div>
                <div className="min-w-0">
                  <span className="text-[9px] font-black uppercase tracking-wider opacity-60 block leading-none truncate">
                    Plafon Budget
                  </span>
                  <span className="text-[10px] font-extrabold leading-tight truncate block">
                    {getPeriodLabel(budget.periodType ?? null, budget.customDays)}
                  </span>
                </div>
              </div>
              {budget.periodStart && budget.periodEnd && (
                <span className="text-[8px] opacity-75 font-bold bg-white/80 px-1.5 py-0.5 rounded-md border border-black/5 shrink-0 ml-1">
                  {budget.periodStart} - {budget.periodEnd}
                </span>
              )}
            </div>

            {/* Progress bar */}
            <div className="w-full h-1.5 bg-black/10 rounded-full overflow-hidden my-2">
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  isOver ? 'bg-red-500' : isNear ? 'bg-amber-500' : 'bg-emerald-500'
                }`}
                style={{ width: `${pct}%` }}
              />
            </div>

            {/* Saldo Details */}
            <div className="space-y-1 pt-0.5">
              <div className="flex items-center justify-between text-[10px]">
                <span className="opacity-75 font-bold">Sisa Saldo:</span>
                <span className={`font-black ${
                  isOver ? 'text-red-600' : isNear ? 'text-amber-700' : 'text-emerald-700'
                }`}>
                  {isOver
                    ? `⚠ Lebih ${formatRp(budget.terpakai - budget.nominal)}`
                    : formatRp(budget.sisa)}
                </span>
              </div>
              <div className="flex items-center justify-between text-[9px] opacity-65 font-medium">
                <span>Terpakai: {formatRp(budget.terpakai)}</span>
                <span>Plafon: {formatRp(budget.nominal)}</span>
              </div>
            </div>
          </div>
        )}

        {/* Navigation Menu List */}
        <nav className="p-3 space-y-5 overflow-y-auto flex-1 min-h-0 scrollbar-thin">
          {navGroups.map((group) => (
            <div key={group.title} className="space-y-1">
              <div className="px-3 text-[9px] font-black uppercase tracking-widest text-suka-brown/40">
                {group.title}
              </div>
              <div className="space-y-0.5 mt-1">
                {group.items.map((item) => {
                  const active = isActive(item.href)
                  const Icon = item.icon

                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={onCloseMobile}
                      className={`flex items-center justify-between px-3 py-2 rounded-xl text-xs font-bold transition-all group cursor-pointer ${
                        active
                          ? 'bg-suka-orange text-white shadow-xs font-extrabold'
                          : 'text-suka-brown/80 hover:bg-suka-cream/60 hover:text-suka-orange'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 truncate">
                        <Icon
                          className={`w-4 h-4 shrink-0 transition-colors ${
                            active
                              ? 'text-white'
                              : 'text-suka-brown/50 group-hover:text-suka-orange'
                          }`}
                        />
                        <span className="truncate">{item.label}</span>
                      </div>

                      {item.badge && (
                        <span
                          className={`text-[9px] font-black px-1.5 py-0.5 rounded-full ${
                            active ? 'bg-white text-suka-orange' : item.badgeColor
                          }`}
                        >
                          {item.badge}
                        </span>
                      )}
                    </Link>
                  )
                })}
              </div>
            </div>
          ))}
        </nav>
      </div>

      {/* Bottom Footer Actions */}
      <div className="p-3 border-t border-suka-brown/10 space-y-1 bg-white">
        <a
          href={resolvedPortalUrl}
          className="flex items-center justify-between px-3 py-2 rounded-xl text-xs font-bold text-suka-brown/70 hover:bg-suka-cream/50 hover:text-suka-brown transition-colors group"
        >
          <div className="flex items-center gap-2.5">
            <Store className="w-4 h-4 text-suka-brown/40 group-hover:text-suka-orange" />
            <span>Portal Aplikasi</span>
          </div>
          <ExternalLink className="w-3 h-3 text-suka-brown/40" />
        </a>

        <button
          type="button"
          onClick={handleLogout}
          className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-bold text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
        >
          <LogOut className="w-4 h-4" />
          <span>Keluar</span>
        </button>
      </div>
    </aside>
  )
}
