// @ts-nocheck
import '@testing-library/jest-dom'
import { vi } from 'vitest'

vi.mock('react-countup', () => {
  return {
    default: ({ end, decimals }: any) => {
      const formatted = Number(end).toLocaleString('id-ID', { minimumFractionDigits: decimals || 0,
        maximumFractionDigits: decimals || 0,
      })
      return formatted
    }
  }
})
