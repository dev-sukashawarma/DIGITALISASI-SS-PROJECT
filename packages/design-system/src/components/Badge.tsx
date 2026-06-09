import React from 'react'
import { cn } from '../utils/cn'

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'success' | 'warning' | 'error' | 'info'
}

export const Badge: React.FC<BadgeProps> = ({ variant = 'info', className, ...props }) => {
  const variants = {
    success: 'bg-suka-green text-white',
    warning: 'bg-yellow-500 text-white',
    error: 'bg-red-500 text-white',
    info: 'bg-blue-500 text-white',
  }
  return (
    <span
      className={cn('inline-block px-2 py-1 text-xs font-medium rounded-full', variants[variant], className)}
      {...props}
    />
  )
}
Badge.displayName = 'Badge'
