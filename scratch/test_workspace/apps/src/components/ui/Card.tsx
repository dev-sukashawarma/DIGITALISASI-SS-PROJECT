import React from 'react'

/**
 * Kartu dasar seragam untuk seluruh dashboard.
 * Putih, sudut membulat, border tipis, padding lega. Satu gaya untuk semua.
 */
export function Card({
  children,
  className = '',
  padded = true,
}: {
  children: React.ReactNode
  className?: string
  padded?: boolean
}) {
  return (
    <div
      className={`bg-white rounded-2xl border border-suka-gray-200 shadow-sm ${padded ? 'p-5 sm:p-6' : ''} ${className}`}
    >
      {children}
    </div>
  )
}
