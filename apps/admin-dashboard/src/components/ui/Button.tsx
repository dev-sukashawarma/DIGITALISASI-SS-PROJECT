import React from 'react'

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary'
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className = '', variant = 'primary', children, ...props }, ref) => {
    // Definisi base style dan variant yang menggantikan .btn-primary dan .btn-secondary
    const baseStyle =
      'inline-flex items-center justify-center gap-2 font-semibold rounded-2xl transition-all active:scale-[.98] disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none'

    const variantStyles = {
      primary: 'bg-gradient-to-r from-amber-400 to-orange-500 text-white px-6 py-3.5 shadow-lg shadow-amber-500/30 hover:shadow-orange-500/40 hover:-translate-y-0.5 duration-300 border border-white/20',
      secondary: 'bg-white/70 backdrop-blur-md text-gray-700 px-6 py-3 border border-gray-200 hover:border-gray-300 hover:bg-white hover:shadow-md duration-300',
    }

    const appliedStyle = `${baseStyle} ${variantStyles[variant]} ${className}`.trim()

    return (
      <button ref={ref} className={appliedStyle} {...props}>
        {children}
      </button>
    )
  }
)

Button.displayName = 'Button'
