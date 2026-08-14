import React from 'react'

interface EmptyStateProps {
  icon?: React.ReactNode
  title: string
  description?: string
}

export const EmptyState: React.FC<EmptyStateProps> = ({ icon, title, description }) => (
  <div className="flex flex-col items-center justify-center gap-2 py-12 text-center">
    {icon && <div className="text-suka-gray-400">{icon}</div>}
    <p className="font-medium text-suka-ink">{title}</p>
    {description && <p className="text-sm text-suka-gray-500">{description}</p>}
  </div>
)
EmptyState.displayName = 'EmptyState'
