import React from 'react'

/**
 * Kepala halaman seragam: judul + 1 kalimat penjelas + slot filter opsional.
 * Dipakai di atas setiap halaman fitur agar orang awam selalu tahu ada di mana.
 */
export function PageHeader({
  title,
  description,
  children,
}: {
  title: string
  description?: string
  /** Slot kanan, mis. filter periode/outlet. */
  children?: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between bg-white p-4 sm:p-5 rounded-2xl border border-suka-gray-200 shadow-sm">
      <div className="min-w-0">
        <h2 className="text-lg sm:text-xl font-extrabold text-suka-brown tracking-tight truncate">{title}</h2>
        {description && (
          <p className="text-xs text-suka-gray-500 font-medium mt-0.5">{description}</p>
        )}
      </div>
      {children && <div className="shrink-0">{children}</div>}
    </div>
  )
}
