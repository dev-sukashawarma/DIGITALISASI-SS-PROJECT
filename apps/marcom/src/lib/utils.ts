import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatRupiah(value: number | string | null | undefined): string {
  if (value === null || value === undefined || value === '') return 'Rp 0'
  const numeric = typeof value === 'number' ? value : Number(value)
  if (isNaN(numeric)) return 'Rp 0'
  return `Rp ${numeric.toLocaleString('id-ID')}`
}
