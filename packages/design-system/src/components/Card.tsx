import React from 'react'
import { cn } from '../utils/cn'

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {}

export const Card: React.FC<CardProps> = ({ className, ...props }) => (
  <div className={cn('bg-white border border-suka-gray-200 rounded-lg p-4', className)} {...props} />
)
Card.displayName = 'Card'
