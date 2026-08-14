import React from 'react'
import { cn } from '../utils/cn'

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'outline'
  size?: 'sm' | 'md' | 'lg'
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', ...props }, ref) => {
    const baseStyles = 'font-medium rounded-md transition-colors focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed'
    const variants = {
      primary: 'bg-suka-orange text-white hover:bg-orange-600 active:bg-orange-700',
      secondary: 'border border-suka-brown text-suka-brown hover:bg-suka-cream',
      ghost: 'text-suka-brown hover:bg-suka-cream',
      danger: 'bg-red-500 text-white hover:bg-red-600 active:bg-red-700',
      outline: 'border border-gray-300 text-gray-700 hover:bg-gray-50',
    }
    const sizes = {
      sm: 'px-3 py-1 text-sm',
      md: 'px-4 py-2 text-base',
      lg: 'px-6 py-3 text-lg',
    }

    return (
      <button
        ref={ref}
        className={cn(baseStyles, variants[variant], sizes[size], className)}
        {...props}
      />
    )
  }
)
Button.displayName = 'Button'
