'use client'

import React from 'react'

export function BorderBeam({
  className = '',
  colorFrom = '#f29744',
  colorTo = '#ffe58f',
}: {
  className?: string
  colorFrom?: string
  colorTo?: string
}) {
  return (
    <div
      aria-hidden
      className={`pointer-events-none absolute inset-0 rounded-[inherit] overflow-hidden p-[1.5px] ${className}`}
      style={{
        mask: 'linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)',
        WebkitMask: 'linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)',
        maskComposite: 'exclude',
        WebkitMaskComposite: 'xor',
      }}
    >
      <div
        className="absolute -inset-[150%] animate-border-beam"
        style={{
          background: `conic-gradient(from 0deg at 50% 50%, transparent 0deg, transparent 300deg, ${colorFrom} 340deg, ${colorTo} 360deg)`,
        }}
      />
    </div>
  )
}
