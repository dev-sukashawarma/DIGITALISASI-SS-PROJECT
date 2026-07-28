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
  icon?: React.ElementType
}) {
  return (
    <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between mb-8 relative z-50">
      <div className="flex-1">
        {/* Playful Display Header */}
        <h1 className="font-display text-4xl md:text-5xl text-suka-brown tracking-wide flex items-center gap-3">
          {arguments[0].icon && React.createElement(arguments[0].icon, { className: "w-8 h-8 md:w-10 md:h-10 text-suka-orange" })}
          {title}
        </h1>
        {description && (
          <p className="text-suka-ink/60 mt-3 font-medium text-sm">
            {description}
          </p>
        )}
      </div>
      {children && <div className="shrink-0 xl:mt-2">{children}</div>}
    </div>
  )
}
