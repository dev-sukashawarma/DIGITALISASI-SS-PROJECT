import React from 'react'
import { cn } from '../utils/cn'

export const Spinner: React.FC<{ size?: number; className?: string }> = ({ size = 24, className }) => (
  <span
    role="status"
    aria-label="Memuat"
    className={cn('inline-block animate-spin rounded-full border-2 border-suka-gray-200 border-t-suka-orange', className)}
    style={{ width: size, height: size }}
  />
)
Spinner.displayName = 'Spinner'
