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
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-6">
      <div className="flex-1">
        <h1 className="text-2xl sm:text-3xl font-extrabold text-[#4A1713] tracking-tight flex items-center gap-2.5">
          {Icon && <Icon className="w-7 h-7 text-suka-orange shrink-0" />}
          {title}
        </h1>
        {description && (
          <p className="text-suka-gray-500 mt-1 font-medium text-xs sm:text-sm">
            {description}
          </p>
        )}
      </div>
      {children && <div className="shrink-0 flex items-center gap-2 flex-wrap">{children}</div>}
    </div>
  )
}
