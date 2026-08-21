import { render, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import SsoHandoffPage from './page'

describe('SsoHandoffPage', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    window.history.replaceState({}, '', '/')
  })

  it('menghapus token dari URL lalu menyerahkannya ke API same-origin', async () => {
    const fetchMock = vi.fn(() => new Promise<Response>(() => undefined))
    vi.stubGlobal('fetch', fetchMock)
    window.history.replaceState(
      {},
      '',
      `/auth/sso#access_token=${encodeURIComponent('access-token-from-pos')}` +
        `&refresh_token=${encodeURIComponent('refresh-token-from-pos')}` +
        '&next=%2Fdashboard'
    )

    render(<SsoHandoffPage />)

    await waitFor(() => expect(fetchMock).toHaveBeenCalledOnce())
    expect(window.location.hash).toBe('')
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/auth/sso',
      expect.objectContaining({
        method: 'POST',
        credentials: 'same-origin',
        body: JSON.stringify({
          accessToken: 'access-token-from-pos',
          refreshToken: 'refresh-token-from-pos',
        }),
      })
    )
  })
})
