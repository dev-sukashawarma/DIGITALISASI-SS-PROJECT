import React from 'react'
import { cn } from '../utils/cn'

interface CurrencyInputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'type'> {
  label?: string
  /** Numeric value in Rupiah, or empty string while the field is blank. */
  value: number | string
  /** Called with the parsed numeric value (0 if the field is empty). */
  onChange: (value: number) => void
  /** Prefix shown before the formatted digits. Defaults to "Rp". Pass "" to omit. */
  prefix?: string
}

/**
 * Text input for Rupiah amounts that shows thousand separators live while typing
 * (e.g. "50.000") instead of a raw number, to reduce input mistakes.
 */
export const CurrencyInput = React.forwardRef<HTMLInputElement, CurrencyInputProps>(
  ({ label, className, value, onChange, prefix = 'Rp', ...props }, ref) => {
    const numeric = typeof value === 'number' ? value : parseInt(value || '0', 10) || 0
    const display = numeric > 0 ? numeric.toLocaleString('id-ID') : (value === '' ? '' : '0')

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const digits = e.target.value.replace(/\D/g, '')
      onChange(digits ? parseInt(digits, 10) : 0)
    }

    return (
      <div className="flex flex-col gap-2">
        {label && (
          <label htmlFor={props.id} className="text-sm font-medium text-suka-ink">
            {label}
          </label>
        )}
        <div className="relative">
          {prefix && (
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-suka-gray-500 pointer-events-none">
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
              'w-full px-3 py-2 border border-suka-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-suka-orange',
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
