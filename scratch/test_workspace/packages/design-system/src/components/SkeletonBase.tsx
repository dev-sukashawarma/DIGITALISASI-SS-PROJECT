import React from 'react'
import { cn } from '../utils/cn'

export const Skeleton: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({ className, ...props }) => {
  return (
    <div
      className={cn(
        'animate-shimmer bg-gradient-to-r from-suka-gray-100 via-suka-gray-200 to-suka-gray-100 bg-[length:200%_100%] rounded-lg',
        className
      )}
      {...props}
    />
  )
}
Skeleton.displayName = 'Skeleton'
