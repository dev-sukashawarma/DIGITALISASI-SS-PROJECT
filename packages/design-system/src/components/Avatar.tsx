import React from 'react'
import { cn } from '../utils/cn'

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase()
  return (parts[0]![0]! + parts[1]![0]!).toUpperCase()
}

interface AvatarProps extends React.HTMLAttributes<HTMLDivElement> {
  name: string
  size?: number
}

export const Avatar: React.FC<AvatarProps> = ({ name, size = 36, className, style, ...props }) => (
  <div
    className={cn('flex items-center justify-center rounded-full bg-suka-cream text-suka-brown font-medium', className)}
    style={{ width: size, height: size, fontSize: size * 0.36, ...style }}
    aria-hidden="true"
    {...props}
  >
    {initials(name)}
  </div>
)
Avatar.displayName = 'Avatar'
