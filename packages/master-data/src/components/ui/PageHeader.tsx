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
    <div className="flex flex-col gap-4 2xl:flex-row 2xl:items-center 2xl:justify-between mb-6 sm:mb-8 relative z-50">
      <div className="flex-1 min-w-0">
        {/* Playful Display Header */}
        <h1 className="font-display text-3xl sm:text-4xl lg:text-5xl text-suka-brown tracking-wide flex items-center gap-2.5 sm:gap-3">
          {arguments[0].icon && React.createElement(arguments[0].icon, { className: "w-7 h-7 sm:w-8 sm:h-8 md:w-10 md:h-10 text-suka-orange" })}
          <span>{title}</span>
        </h1>
        {description && (
          <p className="text-suka-ink/60 mt-1.5 sm:mt-2 font-medium text-xs sm:text-sm">
            {description}
          </p>
        )}
      </div>
      {children && <div className="shrink-0 w-full 2xl:w-auto">{children}</div>}
    </div>
  )
}
