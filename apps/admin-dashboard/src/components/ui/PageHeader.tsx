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
    <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between bg-white/40 backdrop-blur-md p-4 sm:p-5 rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] mb-6 relative z-50">
      <div className="flex-1">
        <h2 className="text-xl sm:text-2xl font-extrabold text-suka-brown tracking-tight leading-tight">{title}</h2>
        {description && (
          <p className="text-xs text-suka-gray-500 font-medium mt-0.5">{description}</p>
        )}
      </div>
      {children && <div className="shrink-0">{children}</div>}
    </div>
  )
}
