import { renderHook, waitFor } from '@testing-library/react'
import { useFormattedDate } from '../useFormattedDate'

describe('useFormattedDate', () => {
  it('returns empty string before mount effect for nullish input', () => {
    const { result } = renderHook(() => useFormattedDate(null))
    expect(result.current).toBe('')
  })

  it('formats an ISO date to id-ID after mount', async () => {
    const { result } = renderHook(() => useFormattedDate('2026-06-15T00:00:00Z'))
    await waitFor(() => expect(result.current).not.toBe(''))
    expect(result.current).toMatch(/2026/)
  })
})
