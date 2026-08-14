import React from 'react'

/** Kerangka abu berkedip untuk state loading. Persepsi lebih cepat dari teks "Memuat…". */
export function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`bg-suka-gray-200/70 rounded-xl animate-pulse ${className}`} />
}

/** Preset skeleton untuk baris kartu ringkasan (StatTile). */
export function StatTilesSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {Array.from({ length: count }).map((_, i) => (
        <Skeleton key={i} className="h-28" />
      ))}
    </div>
  )
}
