'use client'
import React, { useState } from 'react'
import { ChevronDown } from 'lucide-react'

/**
 * Blok berjudul untuk isi halaman. Opsional bisa dibuka-tutup (collapsible)
 * agar detail sekunder tidak membebani layar ("Lihat rincian").
 */
export function Section({
  title,
  children,
  collapsible = false,
  defaultOpen = true,
  className = '',
}: {
  title?: string
  children: React.ReactNode
  collapsible?: boolean
  defaultOpen?: boolean
  className?: string
}) {
  const [open, setOpen] = useState(defaultOpen)

  return (
    <div className={`bg-white rounded-2xl border border-suka-gray-200 shadow-sm ${className}`}>
      {title && (
        collapsible ? (
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="w-full flex items-center justify-between px-5 sm:px-6 py-4 text-left"
          >
            <h3 className="font-extrabold text-suka-brown text-sm tracking-tight uppercase">{title}</h3>
            <ChevronDown className={`w-5 h-5 text-suka-gray-400 transition-transform ${open ? 'rotate-180' : ''}`} />
          </button>
        ) : (
          <div className="px-5 sm:px-6 pt-5 sm:pt-6">
            <h3 className="font-extrabold text-suka-brown text-sm tracking-tight uppercase">{title}</h3>
          </div>
        )
      )}
      {open && <div className={`px-5 sm:px-6 pb-5 sm:pb-6 ${title && !collapsible ? 'pt-4' : collapsible ? 'pt-0' : 'pt-5 sm:pt-6'}`}>{children}</div>}
    </div>
  )
}
