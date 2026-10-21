import React, { type ReactNode } from 'react'

export function PageHeader({
  title,
  description,
  children,
  icon,
}: {
  title: string
  description?: string
  children?: ReactNode
  icon?: React.ElementType
}) {
  return (
    <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between mb-5 relative z-10">
      <div className="flex-1 min-w-0">
        <h1 className="font-display text-2xl sm:text-3xl text-suka-brown tracking-wide flex items-center gap-2.5 font-bold">
          {icon && React.createElement(icon, { className: "w-6 h-6 sm:w-7 sm:h-7 text-suka-orange shrink-0" })}
          <span className="truncate">{title}</span>
        </h1>
        {description && (
          <p className="text-suka-ink/60 mt-1 font-medium text-xs sm:text-sm">
            {description}
          </p>
        )}
      </div>
      {children && <div className="shrink-0">{children}</div>}
    </div>
  )
}
