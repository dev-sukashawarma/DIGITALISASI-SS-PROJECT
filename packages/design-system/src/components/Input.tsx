import React from 'react'
import { cn } from '../utils/cn'

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ label, className, ...props }, ref) => (
    <div className="flex flex-col gap-2">
      {label && <label className="text-sm font-medium text-suka-ink">{label}</label>}
      <input
        ref={ref}
        className={cn(
          'px-3 py-2 border border-suka-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-suka-orange',
          className
        )}
        {...props}
      />
    </div>
  )
)
Input.displayName = 'Input'
