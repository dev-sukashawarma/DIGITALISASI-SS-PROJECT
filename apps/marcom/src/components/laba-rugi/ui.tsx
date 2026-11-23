import React from 'react'

export function PageHeader({
  title,
  description,
  children,
  icon: Icon,
}: {
  title: string
  description?: string
  children?: React.ReactNode
  icon?: React.ElementType
}) {
  return (
    <div className="flex flex-col gap-4 2xl:flex-row 2xl:items-center 2xl:justify-between mb-6 sm:mb-8 relative z-20">
      <div className="flex-1 min-w-0">
        <h1 className="font-black text-2xl sm:text-3xl lg:text-4xl text-suka-brown tracking-tight flex items-center gap-2.5 sm:gap-3">
          {Icon && <Icon className="w-7 h-7 sm:w-8 sm:h-8 text-suka-orange shrink-0" />}
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

export function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`bg-suka-gray-200/70 rounded-xl animate-pulse ${className}`} />
}

export function StatTilesSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {Array.from({ length: count }).map((_, i) => (
        <Skeleton key={i} className="h-28" />
      ))}
    </div>
  )
}
