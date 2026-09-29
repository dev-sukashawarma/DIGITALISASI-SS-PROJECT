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
  /** Max digits accepted; 12 = hundreds of billions, safely within Number precision. */
  maxDigits?: number
}

/** Position in `formatted` right after its `n`-th digit (0 = start). */
function caretAfterDigits(formatted: string, n: number): number {
  if (n <= 0) return 0
  let seen = 0
  for (let i = 0; i < formatted.length; i++) {
    if (/\d/.test(formatted[i]) && ++seen === n) return i + 1
  }
  return formatted.length
}

/**
 * Text input for Rupiah amounts that shows thousand separators live while typing
 * (e.g. "50.000") instead of a raw number, to reduce input mistakes. The caret stays
 * next to the digit being edited even though separators are re-inserted on every key.
 */
export const CurrencyInput = React.forwardRef<HTMLInputElement, CurrencyInputProps>(
  ({ label, className, value, onChange, prefix = 'Rp', maxDigits = 12, ...props }, ref) => {
    const numeric = typeof value === 'number' ? value : parseInt(value || '0', 10) || 0
    const display = numeric > 0 ? numeric.toLocaleString('id-ID') : (value === '' ? '' : '0')

    const innerRef = React.useRef<HTMLInputElement | null>(null)
    const setRefs = (el: HTMLInputElement | null) => {
      innerRef.current = el
      if (typeof ref === 'function') ref(el)
      else if (ref) ref.current = el
    }
    // Digits left of the caret at the moment of the edit; restored after re-render.
    const pendingCaret = React.useRef<number | null>(null)

    React.useLayoutEffect(() => {
      const el = innerRef.current
      if (pendingCaret.current === null || !el || document.activeElement !== el) return
      const pos = caretAfterDigits(display, pendingCaret.current)
      el.setSelectionRange(pos, pos)
      pendingCaret.current = null
    }, [display])

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const raw = e.target.value
      const caret = e.target.selectionStart ?? raw.length
      const digits = raw.replace(/\D/g, '').replace(/^0+(?=\d)/, '').slice(0, maxDigits)
      pendingCaret.current = Math.min(raw.slice(0, caret).replace(/\D/g, '').length, digits.length)
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
            ref={setRefs}
            type="text"
            inputMode="numeric"
            autoComplete="off"
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
