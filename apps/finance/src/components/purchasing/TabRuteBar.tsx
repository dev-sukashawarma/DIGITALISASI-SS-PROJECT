'use client'

import Link from 'next/link'
import { tabUntuk } from '@/lib/purchasing/ringkas'

/** Tab penghubung halaman sealur (mis. Usulan sistem | Permintaan cabang). Kosong bila tak ada grup. */
export function TabRuteBar({ pathname }: { pathname: string | null }) {
  const tabs = tabUntuk(pathname)
  if (!tabs) return null
  const aktif = (pathname ?? '').replace(/\/+$/, '') || '/'
  return (
    <nav aria-label="Bagian halaman" className="mb-4 flex gap-1 overflow-x-auto rounded-2xl bg-white/80 p-1 text-sm font-semibold shadow-2xs print:hidden">
      {tabs.map((t) => (
        <Link
          key={t.href}
          href={t.href}
          aria-current={t.href === aktif ? 'page' : undefined}
          className={`whitespace-nowrap rounded-xl px-4 py-2 transition-colors ${
            t.href === aktif ? 'bg-suka-orange text-white shadow-sm' : 'text-suka-brown/70 hover:bg-suka-cream hover:text-suka-brown'
          }`}
        >
          {t.label}
        </Link>
      ))}
    </nav>
  )
}
