import React from 'react'
import { cn } from '@/lib/utils'

export interface CurrencyInputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'type'> {
  label?: string
  value: number | string
  onChange: (value: number | string) => void
  prefix?: string
}

export const CurrencyInput = React.forwardRef<HTMLInputElement, CurrencyInputProps>(
  ({ label, className, value, onChange, prefix = 'Rp', ...props }, ref) => {
    const rawStr = value !== undefined && value !== null ? String(value) : ''
    const digits = rawStr.replace(/\D/g, '')
    const numeric = digits ? parseInt(digits, 10) : 0
    const display = digits ? numeric.toLocaleString('id-ID') : (rawStr === '0' ? '0' : '')

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const inputDigits = e.target.value.replace(/\D/g, '')
      onChange(inputDigits ? parseInt(inputDigits, 10) : 0)
    }

    return (
      <div className="flex flex-col gap-1.5 w-full">
        {label && (
          <label htmlFor={props.id} className="text-xs font-bold text-stone-700 uppercase tracking-wider">
            {label}
          </label>
        )}
        <div className="relative">
          {prefix && (
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400 font-semibold text-xs pointer-events-none select-none">
              {prefix}
            </span>
          )}
          <input
            ref={ref}
            type="text"
            inputMode="numeric"
            value={display}
            onChange={handleChange}
            className={cn(
              'w-full px-3 py-2 border border-stone-200 rounded-xl bg-white text-stone-900 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-colors',
              prefix && 'pl-9',
              className
            )}
            {...props}
          />
        </div>
      </div>
    )
  }
)

CurrencyInput.displayName = 'CurrencyInput'
