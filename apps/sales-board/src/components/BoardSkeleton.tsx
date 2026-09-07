export function BoardSkeleton() {
  return (
    <div className="flex flex-col min-h-screen p-6 md:p-8 space-y-6 animate-pulse">
      {/* Header Skeleton */}
      <div className="flex items-center justify-between border-b border-[var(--border-subtle)] pb-4">
        <div className="flex items-center gap-4">
          <div className="h-9 w-44 rounded-lg bg-[var(--card-bg)] animate-shimmer" />
          <div className="h-6 w-32 rounded-full bg-[var(--card-bg)] animate-shimmer" />
        </div>
        <div className="flex items-center gap-4">
          <div className="h-8 w-28 rounded-full bg-[var(--card-bg)] animate-shimmer" />
          <div className="h-8 w-32 rounded-lg bg-[var(--card-bg)] animate-shimmer" />
        </div>
      </div>

      {/* KPI Cards Skeleton */}
      <div className="grid grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="rounded-xl border border-[var(--border-card)] bg-[var(--card-bg)] p-5 space-y-3"
          >
            <div className="h-4 w-28 rounded bg-white/5 animate-shimmer" />
            <div className="h-10 w-36 rounded bg-white/10 animate-shimmer" />
            <div className="h-3 w-20 rounded bg-white/5 animate-shimmer" />
          </div>
        ))}
      </div>

      {/* Table Skeleton */}
      <div className="rounded-xl border border-[var(--border-card)] bg-[var(--card-bg)] p-4 space-y-2">
        <div className="h-6 w-full rounded bg-white/5 animate-shimmer mb-3" />
        {[...Array(15)].map((_, idx) => (
          <div
            key={idx}
            className="h-8 w-full rounded bg-white/5 animate-shimmer flex items-center px-3"
          />
        ))}
      </div>
    </div>
  )
}
