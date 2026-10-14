'use client'

import Link from 'next/link'
import { ExternalLink, Truck, Tags, ArrowLeft } from 'lucide-react'

export default function Page() {
  const adminUrl = process.env.NEXT_PUBLIC_APP_URL_ADMIN_DASHBOARD || 'https://admin.sukashawarma.com'
  let resolvedAdminUrl = adminUrl
  if (typeof window !== 'undefined' && window.location.hostname === 'localhost') {
    resolvedAdminUrl = 'http://localhost:3005'
  }

  return (
    <div className="mx-auto max-w-xl space-y-4 rounded-3xl border border-suka-brown/10 bg-white p-6 text-sm text-suka-brown shadow-sm">
      <div>
        <h1 className="text-lg font-extrabold text-suka-brown">Database Supplier & Bahan Baku Terpusat</h1>
        <p className="mt-1 text-xs text-suka-brown/70 leading-relaxed">
          Data supplier, kontak mitra, dan harga katalog vendor kini dikelola terpusat di Admin Dashboard.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
        <a
          href={`${resolvedAdminUrl}/dashboard/pembelian/supplier`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-between gap-3 rounded-2xl border border-suka-brown/10 bg-suka-cream/50 px-4 py-3 font-bold text-xs text-suka-brown hover:border-suka-orange/40 hover:bg-suka-cream transition-all"
        >
          <span className="flex items-center gap-2.5">
            <Truck className="w-4 h-4 text-suka-orange shrink-0" />
            Buka Master Supplier
          </span>
          <ExternalLink className="w-3.5 h-3.5 text-suka-brown/40 shrink-0" />
        </a>

        <a
          href={`${resolvedAdminUrl}/dashboard/bahan-baku`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-between gap-3 rounded-2xl border border-suka-brown/10 bg-suka-cream/50 px-4 py-3 font-bold text-xs text-suka-brown hover:border-suka-orange/40 hover:bg-suka-cream transition-all"
        >
          <span className="flex items-center gap-2.5">
            <Tags className="w-4 h-4 text-suka-orange shrink-0" />
            Buka Master Bahan Baku
          </span>
          <ExternalLink className="w-3.5 h-3.5 text-suka-brown/40 shrink-0" />
        </a>
      </div>

      <div className="pt-2 border-t border-suka-brown/5">
        <Link
          href="/pembelian/dashboard"
          className="inline-flex items-center gap-1.5 text-xs font-bold text-suka-orange hover:text-suka-brown transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Kembali ke Dashboard Purchasing
        </Link>
      </div>
    </div>
  )
}

