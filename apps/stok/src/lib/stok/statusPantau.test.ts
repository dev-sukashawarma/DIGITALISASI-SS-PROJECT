import { expect, it } from 'vitest'
import { statusPantau } from './statusPantau'

it('status belum diketahui tidak berubah menjadi aman', () => {
  expect(statusPantau(['unknown'])).toBe('unknown')
  expect(statusPantau(['ok', 'unknown'])).toBe('unknown')
  expect(statusPantau(['warning', 'unknown'])).toBe('warning')
  expect(statusPantau(['below', 'warning', 'unknown'])).toBe('below')
  expect(statusPantau(['ok'])).toBe('ok')
})
