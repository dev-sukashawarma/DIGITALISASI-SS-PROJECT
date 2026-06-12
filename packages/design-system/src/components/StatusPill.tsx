import React from 'react'
import { cn } from '../utils/cn'

export type StatusKind =
  | 'tepat' | 'telat' | 'alpha' | 'belum' | 'masuk' | 'keluar'

interface StatusPillProps extends React.HTMLAttributes<HTMLSpanElement> {
  kind: StatusKind
}

const STYLES: Record<StatusKind, string> = {
  tepat:  'bg-[#e1f5ee] text-[#085041]',
  masuk:  'bg-[#e1f5ee] text-[#085041]',
  telat:  'bg-[#faeeda] text-[#854f0b]',
  alpha:  'bg-[#fcebeb] text-[#a32d2d]',
  belum:  'bg-[#f1efe8] text-[#5f5e5a]',
  keluar: 'bg-[#eef0ff] text-[#26215c]',
}

export const StatusPill: React.FC<StatusPillProps> = ({ kind, className, children, ...props }) => (
  <span
    className={cn(
      'inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-full',
      STYLES[kind],
      className,
    )}
    {...props}
  >
    {children}
  </span>
)
StatusPill.displayName = 'StatusPill'
