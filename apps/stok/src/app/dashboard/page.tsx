'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { AuthGuard } from '@/components/common/AuthGuard';

const CREW_MENU = [
  {
    href: '/stok/opname',
    label: 'Opname Stok',
    desc: 'Hitung & catat stok fisik harian',
    icon: '📋',
    action: '+ Opname Baru',
    actionHref: '/stok/opname/new',
  },
  {
    href: '/stok/ledger',
    label: 'Ledger Stok',
    desc: 'Log pergerakan · waste · transfer',
    icon: '📒',
    action: '+ Entri Manual',
    actionHref: '/stok/ledger/new',
  },
  {
    href: '/stok/monitoring',
    label: 'Monitoring Stok',
    desc: 'Status saldo bahan baku outlet',
    icon: '📊',
  },
];

const SPV_EXTRA = [
  {
    href: '/stok/monitoring-live',
    label: 'Live Monitoring',
    desc: 'Realtime semua outlet · alarm & sound',
    icon: '🔴',
    badge: 'LIVE',
  },
];

function DashboardHub() {
  const router = useRouter();
  const { outletStaff } = useAuth();
  const isSPV = outletStaff?.role === 'spv';
  const menu = isSPV ? [...CREW_MENU, ...SPV_EXTRA] : CREW_MENU;

  return (
    <div className="min-h-screen bg-[#fff8f1] text-[#400a07]">
      {/* Header */}
      <header className="bg-white border-b border-[#701604]/10 px-6 py-4 flex items-center justify-between shadow-sm sticky top-0 z-40">
        <div className="flex items-center gap-3">
          <img src="/logo.png" alt="Logo Suka Shawarma" className="h-10 w-auto object-contain" />
          <div>
            <p className="text-[10px] font-bold text-[#701604]/50 uppercase tracking-widest">Outlet Suite</p>
            <h1 className="text-lg font-extrabold text-[#701604] uppercase tracking-tight leading-tight">Dashboard</h1>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="bg-[#faf2e9] border border-[#701604]/10 px-3 py-1.5 rounded-xl text-xs font-bold text-[#701604]/70">
            {outletStaff?.name ?? '—'}
            <span className="ml-1.5 uppercase text-[#701604]/40 font-medium">
              · {outletStaff?.role}
            </span>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-2xl mx-auto px-4 pt-10 pb-16 space-y-4">
        <p className="text-xs font-bold text-[#701604]/40 uppercase tracking-widest mb-6">Menu Utama</p>

        {menu.map((item) => (
          <div
            key={item.href}
            onClick={() => router.push(item.href)}
            className="block group cursor-pointer"
          >
            <div className="bg-white border border-[#701604]/10 rounded-2xl px-5 py-4 flex items-center justify-between shadow-sm hover:shadow-md hover:border-[#701604]/25 transition-all">
              <div className="flex items-center gap-4">
                <span className="text-2xl">{item.icon}</span>
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-extrabold text-[#701604] text-sm uppercase tracking-tight">{item.label}</p>
                    {'badge' in item && item.badge && (
                      <span className="bg-red-500 text-white text-[9px] font-black px-1.5 py-0.5 rounded-full tracking-wider animate-pulse">
                        {item.badge}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-[#701604]/50 mt-0.5">{item.desc}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {'actionHref' in item && item.actionHref && (
                  <Link
                    href={item.actionHref}
                    onClick={(e) => e.stopPropagation()}
                    className="px-3 py-1.5 bg-[#701604] text-white text-[10px] font-bold rounded-lg hover:bg-[#591002] transition-colors"
                  >
                    {item.action}
                  </Link>
                )}
                <span className="text-[#701604]/30 group-hover:text-[#701604]/60 transition-colors text-lg">›</span>
              </div>
            </div>
          </div>
        ))}
      </main>
    </div>
  );
}

export default function DashboardPage() {
  return (
    <AuthGuard>
      <DashboardHub />
    </AuthGuard>
  );
}
