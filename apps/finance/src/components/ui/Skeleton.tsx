export function StatTilesSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="h-32 bg-white/80 rounded-3xl border border-suka-brown/10 shadow-sm animate-pulse p-5">
          <div className="h-4 bg-gray-200 rounded w-1/3 mb-4"></div>
          <div className="h-8 bg-gray-200 rounded w-2/3"></div>
        </div>
      ))}
    </div>
  )
}
